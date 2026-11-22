const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { asyncHandler, ok, created, parseListQuery, buildMeta, escapeRegex, isObjectId, normalizePhone } = require('../utils/helpers');
const { Lead, Commission, User } = require('../models');
const leadService = require('../services/leadService');
const reportService = require('../services/reportService');
const { recordAudit } = require('../services/auditService');

const maskEmail = (e = '') => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(6, b.length))}${c}`);
const maskPhone = (p = '') => {
  const d = p.replace(/\D/g, '');
  return d.length > 4 ? `******${d.slice(-4)}` : '****';
};

/**
 * Shared lead query. When influencerId is set the filter is ALWAYS scoped to it (data isolation);
 * influencers receive masked contact details.
 */
async function listLeads(query, { influencerId, admin }) {
  const { page, limit, skip, sort } = parseListQuery(query, {
    allowedSort: ['createdAt', 'name', 'paymentStatus', 'registrationStatus', 'attendanceStatus'],
  });
  const filter = {};
  if (influencerId) filter.influencerId = new mongoose.Types.ObjectId(String(influencerId));
  else if (query.influencerId === 'none') filter.influencerId = null;
  else if (isObjectId(query.influencerId)) filter.influencerId = new mongoose.Types.ObjectId(query.influencerId);

  if (query.ids && isObjectId(query.ids)) filter._id = new mongoose.Types.ObjectId(query.ids);
  if (isObjectId(query.workshopId)) filter.workshopId = new mongoose.Types.ObjectId(query.workshopId);
  for (const k of ['paymentStatus', 'attendanceStatus', 'registrationStatus']) if (query[k]) filter[k] = String(query[k]);
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }
  if (query.search) {
    const s = String(query.search).slice(0, 100);
    const rx = new RegExp(escapeRegex(s), 'i');
    filter.$or = admin ? [{ name: rx }, { email: rx }, { phone: rx }, { city: rx }] : [{ name: rx }, { city: rx }];
    const digits = normalizePhone(s);
    if (admin && digits.length >= 4) filter.$or.push({ phoneNormalized: new RegExp(escapeRegex(digits)) });
  }

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .populate('workshopId', 'title slug startDate')
      .populate({ path: 'influencerId', select: 'influencerCode subdomain userId', populate: { path: 'userId', select: 'name' } })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  const commissions = await Commission.find({ leadId: { $in: items.map((l) => l._id) } })
    .select('leadId status commissionAmount')
    .lean();
  const cm = new Map(commissions.map((c) => [String(c.leadId), c]));

  return {
    items: items.map((l) => {
      const c = cm.get(String(l._id));
      const base = {
        _id: l._id,
        name: l.name,
        city: l.city,
        mode: l.mode,
        workshop: l.workshopId ? { _id: l.workshopId._id, title: l.workshopId.title, slug: l.workshopId.slug, startDate: l.workshopId.startDate } : null,
        registrationStatus: l.registrationStatus,
        paymentStatus: l.paymentStatus,
        attendanceStatus: l.attendanceStatus,
        commissionStatus: c?.status || (l.influencerId ? 'not_eligible' : null),
        commissionAmount: c?.commissionAmount || 0,
        utmSource: l.utmSource,
        utmCampaign: l.utmCampaign,
        createdAt: l.createdAt,
      };
      if (!admin) return { ...base, email: maskEmail(l.email), phone: maskPhone(l.phone) };
      return {
        ...base,
        email: l.email,
        phone: l.phone,
        referralSource: l.referralSource,
        referralCode: l.referralCode,
        referralSubdomain: l.referralSubdomain,
        campaignId: l.campaignId,
        attributionMethod: l.attributionMethod,
        utmMedium: l.utmMedium,
        utmContent: l.utmContent,
        notes: l.notes,
        influencer: l.influencerId
          ? { _id: l.influencerId._id, influencerCode: l.influencerId.influencerCode, subdomain: l.influencerId.subdomain, name: l.influencerId.userId?.name }
          : null,
      };
    }),
    meta: buildMeta(total, page, limit),
  };
}
exports.listLeads = listLeads;

/* --------------------------------- Public --------------------------------- */

exports.register = asyncHandler(async (req, res) => {
  created(res, await leadService.register(req, req.body));
});

exports.status = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Registration not found');
  ok(res, await leadService.getRegistrationStatus(req.params.id, { accessToken: req.query.token, user: req.user }));
});

/** Customer: own registrations */
exports.mine = asyncHandler(async (req, res) => {
  const leads = await Lead.find({ userId: req.user._id }).populate('workshopId', 'title slug startDate endDate mode location bannerImage').sort('-createdAt').lean();
  ok(res, leads.map((l) => ({ ...leadService.publicLead(l, null), workshop: l.workshopId })));
});

/* ---------------------------------- Admin --------------------------------- */

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await listLeads(req.query, { admin: true });
  ok(res, items, meta);
});

exports.get = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Lead not found');
  const { items } = await listLeads({ ids: req.params.id, limit: 1 }, { admin: true });
  if (!items.length) throw ApiError.notFound('Lead not found');
  const { AuditLog, Payment, ReferralClick } = require('../models');
  const raw = await Lead.findById(req.params.id).populate('userId', 'name email emailVerified').lean();
  const [history, payments, commission, click] = await Promise.all([
    AuditLog.find({ entityType: 'Lead', entityId: req.params.id }).populate('adminId', 'name email').sort('-createdAt').lean(),
    Payment.find({ leadId: req.params.id }).sort('-createdAt').lean(),
    Commission.findOne({ leadId: req.params.id }).populate('payoutId', 'transactionId paidAt status').lean(),
    raw.clickId ? ReferralClick.findById(raw.clickId).select('landingPath referrer createdAt utmSource utmCampaign').lean() : null,
  ]);
  ok(res, {
    ...items[0],
    consentAt: raw.consentAt,
    attributedAt: raw.attributedAt,
    updatedAt: raw.updatedAt,
    account: raw.userId || null,
    firstClick: click,
    history,
    payments,
    commission,
  });
});

exports.update = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Lead not found');
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');
  const before = lead.toObject();
  const patch = { ...req.body };
  if (patch.phone) patch.phoneNormalized = normalizePhone(patch.phone);
  lead.set(patch);
  await lead.save();
  const changed = Object.keys(req.body);
  await recordAudit({
    req,
    action: 'lead.update',
    entityType: 'Lead',
    entityId: lead._id,
    previousValue: Object.fromEntries(changed.map((k) => [k, before[k]])),
    newValue: Object.fromEntries(changed.map((k) => [k, lead[k]])),
  });
  if (patch.email) {
    const owner = await User.findOne({ email: patch.email, role: 'customer', emailVerified: true }).select('_id').lean();
    await Lead.updateOne({ _id: lead._id }, owner ? { userId: owner._id } : { $unset: { userId: 1 } });
  }
  ok(res, lead);
});

exports.reassignAttribution = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Lead not found');
  ok(res, await leadService.reassignAttribution(req.params.id, req.body, req));
});

exports.setAttendance = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Lead not found');
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');
  const prev = lead.attendanceStatus;
  lead.attendanceStatus = req.body.attendanceStatus;
  await lead.save();
  await recordAudit({ req, action: 'lead.attendance', entityType: 'Lead', entityId: lead._id, previousValue: { attendanceStatus: prev }, newValue: { attendanceStatus: lead.attendanceStatus } });
  ok(res, lead);
});

exports.bulkAttendance = asyncHandler(async (req, res) => {
  const result = await Lead.updateMany({ _id: { $in: req.body.leadIds } }, { attendanceStatus: req.body.attendanceStatus });
  await Promise.all(
    req.body.leadIds.map((id) => recordAudit({ req, action: 'lead.attendance', entityType: 'Lead', entityId: id, newValue: { attendanceStatus: req.body.attendanceStatus } }))
  );
  ok(res, { updated: result.modifiedCount });
});

exports.export = asyncHandler(async (req, res) => {
  const q = { ...req.query, format: req.query.format === 'xlsx' ? 'xlsx' : 'csv' };
  for (const k of ['influencerId', 'workshopId']) if (q[k] && !isObjectId(q[k])) delete q[k];
  await reportService.send(res, 'leads', q);
});
