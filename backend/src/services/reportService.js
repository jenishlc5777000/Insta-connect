const ExcelJS = require('exceljs');
const ApiError = require('../utils/ApiError');
const { Influencer, Lead, Commission, Payout, Payment } = require('../models');
const { statsFor } = require('./influencerService');
const analytics = require('./analyticsService');

const rupees = (p) => Number(((p || 0) / 100).toFixed(2));
const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(1)) : 0);

function rangeFilter({ from, to }, field = 'createdAt') {
  if (!from && !to) return {};
  const f = {};
  if (from) f.$gte = new Date(from);
  if (to) f.$lte = new Date(`${to}T23:59:59.999Z`);
  return { [field]: f };
}

const REPORTS = {
  async influencers() {
    const infs = await Influencer.find().populate('userId', 'name email phone').sort('influencerCode').lean();
    const stats = await statsFor(infs.map((i) => i._id));
    return {
      columns: [
        ['influencerCode', 'Code'], ['name', 'Name'], ['email', 'Email'], ['subdomain', 'Subdomain'], ['status', 'Status'],
        ['commissionRate', 'Commission %'], ['clicks', 'Clicks'], ['leads', 'Leads'], ['paid', 'Paid'], ['conversion', 'Conversion %'],
        ['revenue', 'Revenue (₹)'], ['commission', 'Commission (₹)'], ['commissionPending', 'Payable (₹)'], ['commissionPaid', 'Paid out (₹)'],
      ],
      rows: infs.map((i) => {
        const s = stats.get(String(i._id));
        return {
          influencerCode: i.influencerCode, name: i.userId?.name, email: i.userId?.email, subdomain: i.subdomain, status: i.status,
          commissionRate: i.commissionRate ?? 'default', clicks: s.clicks, leads: s.leads, paid: s.paid, conversion: pct(s.paid, s.leads),
          revenue: rupees(s.revenue), commission: rupees(s.commission), commissionPending: rupees(s.commissionPending), commissionPaid: rupees(s.commissionPaid),
        };
      }),
    };
  },

  async workshops() {
    const rows = await analytics.workshopPerformance();
    return {
      columns: [['title', 'Workshop'], ['startDate', 'Date'], ['status', 'Status'], ['capacity', 'Capacity'], ['leads', 'Leads'], ['paid', 'Paid/confirmed'], ['conversionRate', 'Conversion %'], ['attended', 'Attended'], ['attendanceRate', 'Attendance %'], ['revenue', 'Revenue (₹)']],
      rows: rows.map((r) => ({ ...r, startDate: date(r.startDate), revenue: rupees(r.revenue), capacity: r.capacity || 'Unlimited' })),
    };
  },

  async conversion(q) {
    const base = await REPORTS.influencers(q);
    return {
      columns: [['influencerCode', 'Code'], ['name', 'Name'], ['clicks', 'Clicks'], ['leads', 'Leads'], ['paid', 'Paid'], ['clickToLead', 'Click → Lead %'], ['conversion', 'Lead → Paid %']],
      rows: base.rows.map((r) => ({ ...r, clickToLead: pct(r.leads, r.clicks) })),
    };
  },

  async revenue(q) {
    const days = q.from ? Math.ceil((Date.now() - new Date(q.from)) / 864e5) + 1 : 90;
    const series = await analytics.timeseries({ days, workshopId: q.workshopId, influencerId: q.influencerId });
    return {
      columns: [['date', 'Date'], ['clicks', 'Clicks'], ['leads', 'Leads'], ['paid', 'Paid'], ['revenue', 'Net revenue (₹)']],
      rows: series.filter((r) => !q.to || r.date <= q.to).map((r) => ({ ...r, revenue: rupees(r.revenue) })),
    };
  },

  async commissions(q) {
    const filter = { ...rangeFilter(q) };
    if (q.influencerId) filter.influencerId = q.influencerId;
    if (q.workshopId) filter.workshopId = q.workshopId;
    if (q.status) filter.status = q.status;
    const list = await Commission.find(filter)
      .populate({ path: 'influencerId', select: 'influencerCode userId', populate: { path: 'userId', select: 'name' } })
      .populate('workshopId', 'title')
      .populate('leadId', 'name')
      .sort('-createdAt')
      .limit(50000)
      .lean();
    return {
      columns: [['createdAt', 'Date'], ['influencerCode', 'Influencer code'], ['influencer', 'Influencer'], ['workshop', 'Workshop'], ['lead', 'Lead'], ['gross', 'Gross (₹)'], ['eligible', 'Eligible net (₹)'], ['rate', 'Rate %'], ['amount', 'Commission (₹)'], ['clawback', 'Clawback (₹)'], ['status', 'Status'], ['paidAt', 'Paid on']],
      rows: list.map((c) => ({
        createdAt: date(c.createdAt), influencerCode: c.influencerId?.influencerCode, influencer: c.influencerId?.userId?.name, workshop: c.workshopId?.title,
        lead: c.leadId?.name, gross: rupees(c.grossAmount), eligible: rupees(c.eligibleNetRevenue), rate: c.commissionRate, amount: rupees(c.commissionAmount),
        clawback: rupees(c.clawbackAmount), status: c.status, paidAt: date(c.paidAt),
      })),
    };
  },

  async attendance(q) {
    const filter = {};
    if (q.workshopId) filter.workshopId = q.workshopId;
    filter.paymentStatus = { $in: ['paid', 'partially_refunded', 'not_required'] };
    const leads = await Lead.find(filter).populate('workshopId', 'title startDate').sort('workshopId name').limit(50000).lean();
    return {
      columns: [['workshop', 'Workshop'], ['date', 'Date'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['mode', 'Mode'], ['attendanceStatus', 'Attendance']],
      rows: leads.map((l) => ({ workshop: l.workshopId?.title, date: date(l.workshopId?.startDate), name: l.name, email: l.email, phone: l.phone, mode: l.mode, attendanceStatus: l.attendanceStatus })),
    };
  },

  async traffic(q) {
    const { ReferralClick } = require('../models');
    const match = { ...rangeFilter(q) };
    if (q.influencerId) match.influencerId = require('mongoose').Types.ObjectId.createFromHexString(q.influencerId);
    const rows = await ReferralClick.aggregate([
      { $match: match },
      { $group: { _id: { i: '$influencerId', s: { $ifNull: ['$utmSource', 'direct'] }, c: { $ifNull: ['$utmCampaign', ''] } }, clicks: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
      { $sort: { clicks: -1 } },
    ]);
    const infs = await Influencer.find({ _id: { $in: rows.map((r) => r._id.i) } }).populate('userId', 'name').lean();
    const im = new Map(infs.map((i) => [String(i._id), i]));
    return {
      columns: [['influencerCode', 'Code'], ['name', 'Influencer'], ['source', 'UTM source'], ['campaign', 'UTM campaign'], ['clicks', 'Clicks'], ['visitors', 'Unique visitors']],
      rows: rows.map((r) => ({ influencerCode: im.get(String(r._id.i))?.influencerCode, name: im.get(String(r._id.i))?.userId?.name, source: r._id.s, campaign: r._id.c, clicks: r.clicks, visitors: r.sessions.length })),
    };
  },

  async leads(q) {
    const filter = { ...rangeFilter(q) };
    if (q.influencerId) filter.influencerId = q.influencerId;
    if (q.workshopId) filter.workshopId = q.workshopId;
    if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
    if (q.attendanceStatus) filter.attendanceStatus = q.attendanceStatus;
    const leads = await Lead.find(filter)
      .populate('workshopId', 'title')
      .populate({ path: 'influencerId', select: 'influencerCode userId', populate: { path: 'userId', select: 'name' } })
      .sort('-createdAt')
      .limit(50000)
      .lean();
    return {
      columns: [['createdAt', 'Registered'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['workshop', 'Workshop'], ['mode', 'Mode'], ['influencerCode', 'Influencer code'], ['influencer', 'Influencer'], ['attributionMethod', 'Attribution'], ['utmSource', 'UTM source'], ['utmMedium', 'UTM medium'], ['utmCampaign', 'UTM campaign'], ['utmContent', 'UTM content'], ['registrationStatus', 'Registration'], ['paymentStatus', 'Payment'], ['attendanceStatus', 'Attendance']],
      rows: leads.map((l) => ({ ...l, createdAt: date(l.createdAt), workshop: l.workshopId?.title, influencerCode: l.influencerId?.influencerCode, influencer: l.influencerId?.userId?.name })),
    };
  },

  async payouts(q) {
    const filter = { ...rangeFilter(q) };
    if (q.influencerId) filter.influencerId = q.influencerId;
    const list = await Payout.find(filter).populate({ path: 'influencerId', select: 'influencerCode userId', populate: { path: 'userId', select: 'name' } }).sort('-createdAt').lean();
    return {
      columns: [['createdAt', 'Created'], ['influencerCode', 'Code'], ['influencer', 'Influencer'], ['amount', 'Amount (₹)'], ['commissions', 'Commissions'], ['paymentMethod', 'Method'], ['transactionId', 'Transaction ID'], ['status', 'Status'], ['paidAt', 'Paid on']],
      rows: list.map((p) => ({ createdAt: date(p.createdAt), influencerCode: p.influencerId?.influencerCode, influencer: p.influencerId?.userId?.name, amount: rupees(p.amount), commissions: p.commissionIds.length, paymentMethod: p.paymentMethod, transactionId: p.transactionId, status: p.status, paidAt: date(p.paidAt) })),
    };
  },

  async payments(q) {
    const filter = { ...rangeFilter(q) };
    if (q.influencerId) filter.influencerId = q.influencerId;
    if (q.workshopId) filter.workshopId = q.workshopId;
    const list = await Payment.find(filter).populate('leadId', 'name email').populate('workshopId', 'title').sort('-createdAt').limit(50000).lean();
    return {
      columns: [['createdAt', 'Date'], ['customer', 'Customer'], ['email', 'Email'], ['workshop', 'Workshop'], ['amount', 'Amount (₹)'], ['gateway', 'Gateway'], ['orderId', 'Order ID'], ['paymentId', 'Payment ID'], ['status', 'Status'], ['refundStatus', 'Refund'], ['refunded', 'Refunded (₹)']],
      rows: list.map((p) => ({ createdAt: date(p.createdAt), customer: p.leadId?.name, email: p.leadId?.email, workshop: p.workshopId?.title, amount: rupees(p.amount), gateway: p.gateway, orderId: p.gatewayOrderId, paymentId: p.gatewayPaymentId, status: p.status, refundStatus: p.refundStatus, refunded: rupees(p.refundedAmount) })),
    };
  },
};

const REPORT_TYPES = Object.keys(REPORTS);

async function build(type, query) {
  if (!REPORTS[type]) throw ApiError.notFound(`Unknown report: ${type}`);
  const { columns, rows } = await REPORTS[type](query);
  return { columns: columns.map(([key, header]) => ({ key, header })), rows };
}

// Spreadsheet formula-injection guard
const safeCell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
};

function toCsv({ columns, rows }) {
  const esc = (v) => {
    const s = String(safeCell(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(r[c.key])).join(','));
  return `﻿${lines.join('\r\n')}`;
}

async function toXlsx({ columns, rows }, sheetName = 'Report') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JenCorps';
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.min(40, Math.max(12, c.header.length + 4)) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } };
  rows.forEach((r) => ws.addRow(Object.fromEntries(columns.map((c) => [c.key, safeCell(r[c.key])]))));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb.xlsx.writeBuffer();
}

/** Sends a report as CSV / XLSX download or JSON preview */
async function send(res, type, query) {
  const report = await build(type, query);
  const format = query.format || 'json';
  const filename = `jencorps-${type}-${new Date().toISOString().slice(0, 10)}`;
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(report));
  }
  if (format === 'xlsx') {
    const buf = await toXlsx(report, type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  const limit = Math.min(500, Number(query.limit) || 200);
  return res.json({ success: true, data: { columns: report.columns, rows: report.rows.slice(0, limit) }, meta: { total: report.rows.length, truncated: report.rows.length > limit } });
}

module.exports = { build, send, toCsv, toXlsx, REPORT_TYPES };
