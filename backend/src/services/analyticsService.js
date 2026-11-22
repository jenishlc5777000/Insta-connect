const mongoose = require('mongoose');
const { Lead, ReferralClick, Payment, Commission, Influencer, Workshop } = require('../models');

const TZ = 'Asia/Kolkata';
const oid = (v) => (v ? new mongoose.Types.ObjectId(String(v)) : undefined);

function baseMatch({ influencerId, workshopId, from, to } = {}, dateField = 'createdAt') {
  const m = {};
  if (influencerId) m.influencerId = oid(influencerId);
  if (workshopId) m.workshopId = oid(workshopId);
  if (from || to) {
    m[dateField] = {};
    if (from) m[dateField].$gte = new Date(from);
    if (to) m[dateField].$lte = new Date(to);
  }
  return m;
}

/** Headline numbers. All money in paise. Scoped to one influencer when influencerId is given. */
async function summary(scope = {}) {
  const match = baseMatch(scope);
  const [clicks, leadAgg, payAgg, comAgg] = await Promise.all([
    ReferralClick.countDocuments(match),
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          leads: { $sum: 1 },
          registrations: { $sum: { $cond: [{ $ne: ['$registrationStatus', 'cancelled'] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded']] }, 1, 0] } },
          attended: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'attended'] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...baseMatch(scope, 'capturedAt'), status: 'captured' } },
      { $group: { _id: null, gross: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } },
    ]),
    Commission.aggregate([
      { $match: match },
      { $group: { _id: '$status', amount: { $sum: '$commissionAmount' }, count: { $sum: 1 }, clawback: { $sum: '$clawbackAmount' } } },
    ]),
  ]);

  const l = leadAgg[0] || { leads: 0, registrations: 0, paid: 0, attended: 0 };
  const p = payAgg[0] || { gross: 0, refunded: 0 };
  const c = Object.fromEntries(comAgg.map((r) => [r._id, r]));
  const amt = (s) => c[s]?.amount || 0;

  return {
    clicks,
    leads: l.leads,
    registrations: l.registrations,
    paidRegistrations: l.paid,
    attended: l.attended,
    conversionRate: l.leads ? Number(((l.paid / l.leads) * 100).toFixed(1)) : 0,
    clickToLeadRate: clicks ? Number(((l.leads / clicks) * 100).toFixed(1)) : 0,
    grossRevenue: p.gross,
    refunded: p.refunded,
    revenue: p.gross - p.refunded,
    commission: {
      total: amt('pending') + amt('approved') + amt('paid'),
      pending: amt('pending'),
      approved: amt('approved'),
      payable: amt('pending') + amt('approved'),
      paid: amt('paid'),
      rejected: amt('rejected'),
      reversed: amt('reversed'),
      clawbackOutstanding: comAgg.reduce((s, r) => s + (r.clawback || 0), 0),
    },
  };
}

async function adminOverview(scope = {}) {
  const [base, totalInfluencers, activeInfluencers, workshops] = await Promise.all([
    summary(scope),
    Influencer.countDocuments(),
    Influencer.countDocuments({ status: 'active' }),
    Workshop.countDocuments({ status: 'published', endDate: { $gte: new Date() } }),
  ]);
  return { ...base, totalInfluencers, activeInfluencers, upcomingWorkshops: workshops };
}

/** Daily series of clicks, leads, paid registrations and revenue (filled with zeroes) */
async function timeseries({ influencerId, workshopId, days = 30 } = {}) {
  const n = Math.min(365, Math.max(7, Number(days) || 30));
  const from = new Date(Date.now() - (n - 1) * 864e5);
  from.setHours(0, 0, 0, 0);
  const day = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: TZ } });
  const scope = { influencerId, workshopId };

  const [clicks, leads, payments] = await Promise.all([
    ReferralClick.aggregate([{ $match: baseMatch({ ...scope, from }) }, { $group: { _id: day('createdAt'), n: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: baseMatch({ ...scope, from }) }, { $group: { _id: day('createdAt'), n: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: { ...baseMatch({ ...scope, from }, 'capturedAt'), status: 'captured' } },
      { $group: { _id: day('capturedAt'), n: { $sum: 1 }, revenue: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
    ]),
  ]);
  const toMap = (rows) => new Map(rows.map((r) => [r._id, r]));
  const cm = toMap(clicks);
  const lm = toMap(leads);
  const pm = toMap(payments);

  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const key = fmt.format(new Date(from.getTime() + i * 864e5 + 12 * 3600e3));
    out.push({
      date: key,
      clicks: cm.get(key)?.n || 0,
      leads: lm.get(key)?.n || 0,
      paid: pm.get(key)?.n || 0,
      revenue: pm.get(key)?.revenue || 0,
    });
  }
  return out;
}

async function topInfluencers({ limit = 10, from, to } = {}) {
  const match = baseMatch({ from, to });
  const rows = await Lead.aggregate([
    { $match: { ...match, influencerId: { $ne: null } } },
    {
      $group: {
        _id: '$influencerId',
        leads: { $sum: 1 },
        paid: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded']] }, 1, 0] } },
      },
    },
    { $sort: { paid: -1, leads: -1 } },
    { $limit: Math.min(50, Number(limit) || 10) },
  ]);
  const ids = rows.map((r) => r._id);
  const [infs, comm, rev] = await Promise.all([
    Influencer.find({ _id: { $in: ids } }).populate('userId', 'name').lean(),
    Commission.aggregate([
      { $match: { influencerId: { $in: ids }, status: { $in: ['pending', 'approved', 'paid'] } } },
      { $group: { _id: '$influencerId', amount: { $sum: '$commissionAmount' } } },
    ]),
    Payment.aggregate([
      { $match: { influencerId: { $in: ids }, status: 'captured' } },
      { $group: { _id: '$influencerId', amount: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
    ]),
  ]);
  const im = new Map(infs.map((i) => [String(i._id), i]));
  const cm = new Map(comm.map((c) => [String(c._id), c.amount]));
  const rm = new Map(rev.map((c) => [String(c._id), c.amount]));
  return rows.map((r) => ({
    influencerId: r._id,
    name: im.get(String(r._id))?.userId?.name,
    influencerCode: im.get(String(r._id))?.influencerCode,
    leads: r.leads,
    paid: r.paid,
    revenue: rm.get(String(r._id)) || 0,
    commission: cm.get(String(r._id)) || 0,
  }));
}

async function workshopPerformance({ influencerId } = {}) {
  const match = influencerId ? { influencerId: oid(influencerId) } : {};
  const [leads, revenue, workshops] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$workshopId',
          leads: { $sum: 1 },
          paid: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'not_required']] }, 1, 0] } },
          attended: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'attended'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...match, status: 'captured' } },
      { $group: { _id: '$workshopId', amount: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
    ]),
    Workshop.find(influencerId ? { status: { $ne: 'draft' } } : {})
      .select('title slug startDate status capacity price discountPrice')
      .sort('-startDate')
      .lean(),
  ]);
  const lm = new Map(leads.map((l) => [String(l._id), l]));
  const rm = new Map(revenue.map((r) => [String(r._id), r.amount]));
  return workshops.map((w) => {
    const l = lm.get(String(w._id)) || { leads: 0, paid: 0, attended: 0, absent: 0 };
    return {
      workshopId: w._id,
      title: w.title,
      slug: w.slug,
      startDate: w.startDate,
      status: w.status,
      capacity: w.capacity,
      leads: l.leads,
      paid: l.paid,
      attended: l.attended,
      absent: l.absent,
      conversionRate: l.leads ? Number(((l.paid / l.leads) * 100).toFixed(1)) : 0,
      attendanceRate: l.paid ? Number(((l.attended / l.paid) * 100).toFixed(1)) : 0,
      revenue: rm.get(String(w._id)) || 0,
    };
  });
}

async function trafficSources({ influencerId, from, to } = {}) {
  const rows = await ReferralClick.aggregate([
    { $match: baseMatch({ influencerId, from, to }) },
    { $group: { _id: { $ifNull: ['$utmSource', 'direct'] }, clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: 10 },
  ]);
  return rows.map((r) => ({ source: r._id, clicks: r.clicks }));
}

/** Recent activity feed: registrations, verified payments and (admin) commission approvals */
async function recentActivity({ influencerId, limit = 10 } = {}) {
  const match = influencerId ? { influencerId: oid(influencerId) } : {};
  const [leads, payments, approvals] = await Promise.all([
    Lead.find(match).sort('-createdAt').limit(limit).populate('workshopId', 'title').populate({ path: 'influencerId', select: 'userId', populate: { path: 'userId', select: 'name' } }).lean(),
    Payment.find({ ...match, status: 'captured' }).sort('-capturedAt').limit(limit).populate('leadId', 'name').populate('workshopId', 'title').lean(),
    Commission.find({ ...match, approvedAt: { $ne: null } }).sort('-approvedAt').limit(limit).populate({ path: 'influencerId', select: 'userId', populate: { path: 'userId', select: 'name' } }).populate('workshopId', 'title').lean(),
  ]);
  const items = [
    ...leads.map((l) => ({ type: 'lead', at: l.createdAt, name: l.name, workshop: l.workshopId?.title, influencer: l.influencerId?.userId?.name })),
    ...payments.map((p) => ({ type: 'payment', at: p.capturedAt, name: p.leadId?.name, workshop: p.workshopId?.title, amount: p.amount })),
    ...approvals.map((c) => ({ type: 'commission', at: c.approvedAt, name: c.influencerId?.userId?.name, workshop: c.workshopId?.title, amount: c.commissionAmount })),
  ];
  return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

/** % change of the last `days` vs the `days` before. null = no previous data (new). */
async function trends(scope = {}, days = 30) {
  const n = Math.min(365, Math.max(1, Number(days) || 30));
  const now = Date.now();
  const cur = { ...scope, from: new Date(now - n * 864e5), to: new Date(now) };
  const prev = { ...scope, from: new Date(now - 2 * n * 864e5), to: new Date(now - n * 864e5) };
  const [a, b] = await Promise.all([summary(cur), summary(prev)]);
  const pct = (x, y) => (y ? Number((((x - y) / y) * 100).toFixed(1)) : x ? null : 0);
  return {
    days: n,
    clicks: pct(a.clicks, b.clicks),
    leads: pct(a.leads, b.leads),
    registrations: pct(a.registrations, b.registrations),
    paid: pct(a.paidRegistrations, b.paidRegistrations),
    revenue: pct(a.revenue, b.revenue),
    earnings: pct(a.commission.total, b.commission.total),
    payable: pct(a.commission.payable, b.commission.payable),
  };
}

/** Commission earned (pending/approved/paid) since the 1st of the current month, IST */
async function commissionThisMonth(influencerId) {
  const ist = new Date(Date.now() + 5.5 * 3600e3);
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 5.5 * 3600e3);
  const [row] = await Commission.aggregate([
    { $match: { influencerId: oid(influencerId), status: { $in: ['pending', 'approved', 'paid'] }, createdAt: { $gte: start } } },
    { $group: { _id: null, amount: { $sum: '$commissionAmount' } } },
  ]);
  return row?.amount || 0;
}

/** Share of registrations per influencer (top N + Others + Direct) for the donut chart */
async function registrationsByInfluencer(scope = {}, top = 4) {
  const rows = await Lead.aggregate([
    { $match: { ...baseMatch({ workshopId: scope.workshopId, from: scope.from, to: scope.to }), registrationStatus: { $ne: 'cancelled' } } },
    { $group: { _id: '$influencerId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const attributed = rows.filter((r) => r._id);
  const direct = rows.find((r) => !r._id)?.count || 0;
  const head = attributed.slice(0, top);
  const others = attributed.slice(top).reduce((s, r) => s + r.count, 0);
  const infs = await Influencer.find({ _id: { $in: head.map((r) => r._id) } }).populate('userId', 'name').lean();
  const im = new Map(infs.map((i) => [String(i._id), i]));
  const share = (c) => (total ? Number(((c / total) * 100).toFixed(1)) : 0);
  const items = head.map((r) => ({ key: String(r._id), name: im.get(String(r._id))?.userId?.name || 'Unknown', count: r.count, share: share(r.count) }));
  if (others) items.push({ key: 'others', name: 'Other influencers', count: others, share: share(others) });
  if (direct) items.push({ key: 'direct', name: 'Direct (no referral)', count: direct, share: share(direct) });
  return { total, items };
}

module.exports = { summary, adminOverview, timeseries, topInfluencers, workshopPerformance, trafficSources, recentActivity, trends, commissionThisMonth, registrationsByInfluencer };
