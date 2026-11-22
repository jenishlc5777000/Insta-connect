const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { asyncHandler, ok, created, isObjectId } = require('../utils/helpers');
const influencerService = require('../services/influencerService');
const analytics = require('../services/analyticsService');
const payoutService = require('../services/payoutService');
const { uploadFile, deleteFile } = require('../services/storageService');
const { recordAudit } = require('../services/auditService');
const { Workshop, ReferralClick, Lead, Resource, Influencer } = require('../models');
const { listLeads } = require('./leadController');
const { listCommissions } = require('./commissionController');
const { resolveCommissionRate } = require('../services/commissionService');
const { getSettings } = require('../services/settingsService');

const idParam = (req) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Influencer not found');
  return req.params.id;
};

/* --------------------------------- Admin ---------------------------------- */

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await influencerService.list(req.query);
  ok(res, items, meta);
});

exports.create = asyncHandler(async (req, res) => {
  created(res, await influencerService.create(req.body, req));
});

exports.get = asyncHandler(async (req, res) => {
  ok(res, await influencerService.getById(idParam(req), { revealPayout: true }));
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, await influencerService.update(idParam(req), req.body, req));
});

exports.setStatus = asyncHandler(async (req, res) => {
  ok(res, await influencerService.update(idParam(req), { status: req.body.status }, req));
});

exports.resetPassword = asyncHandler(async (req, res) => {
  ok(res, await influencerService.resetPassword(idParam(req), req));
});

exports.performance = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const [summary, series, workshops, sources] = await Promise.all([
    analytics.summary({ influencerId: id }),
    analytics.timeseries({ influencerId: id, days: req.query.days || 30 }),
    analytics.workshopPerformance({ influencerId: id }),
    analytics.trafficSources({ influencerId: id }),
  ]);
  ok(res, { summary, series, workshops: workshops.filter((w) => w.leads > 0), sources });
});

exports.leads = asyncHandler(async (req, res) => {
  const { items, meta } = await listLeads(req.query, { influencerId: idParam(req), admin: true });
  ok(res, items, meta);
});

exports.earnings = asyncHandler(async (req, res) => {
  const { items, meta } = await listCommissions(req.query, { influencerId: idParam(req) });
  ok(res, items, meta);
});

/* ------------------------------ Self-service ------------------------------ */

exports.me = asyncHandler(async (req, res) => {
  ok(res, await influencerService.getById(req.influencer._id));
});

exports.updateMe = asyncHandler(async (req, res) => {
  ok(res, await influencerService.updateSelf(req.influencer, req.user, req.body));
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const { url } = await uploadFile(req.file, 'avatars');
  await Influencer.updateOne({ _id: req.influencer._id }, { profileImage: url });
  ok(res, { profileImage: url });
});

exports.updatePayoutDetails = asyncHandler(async (req, res) => {
  ok(res, await influencerService.updatePayoutDetails(req.influencer, req.body));
});

exports.mySummary = asyncHandler(async (req, res) => {
  const id = req.influencer._id;
  const workshopId = isObjectId(req.query.workshopId) ? req.query.workshopId : undefined;
  const days = req.query.days || 30;
  const scope = { influencerId: id, workshopId };
  const workshop = workshopId ? await Workshop.findById(workshopId).lean() : null;
  const [summary, series, activity, sources, trends, thisMonth, settings] = await Promise.all([
    analytics.summary(scope),
    analytics.timeseries({ ...scope, days }),
    analytics.recentActivity({ influencerId: id, limit: 8 }),
    analytics.trafficSources({ influencerId: id }),
    analytics.trends(scope, days),
    analytics.commissionThisMonth(id),
    getSettings(),
  ]);
  const commissionRate = resolveCommissionRate({ influencer: req.influencer, workshop, settings });
  ok(res, { summary: { ...summary, commission: { ...summary.commission, thisMonth } }, series, activity, sources, trends, commissionRate });
});

exports.myLeads = asyncHandler(async (req, res) => {
  const { items, meta } = await listLeads(req.query, { influencerId: req.influencer._id, admin: false });
  ok(res, items, meta);
});

exports.myLead = asyncHandler(async (req, res) => {
  // Ownership is part of the query: another influencer's lead id returns 404
  if (!isObjectId(req.params.leadId)) throw ApiError.notFound('Lead not found');
  const { items } = await listLeads({ ids: req.params.leadId, limit: 1 }, { influencerId: req.influencer._id, admin: false });
  if (!items.length) throw ApiError.notFound('Lead not found');
  ok(res, items[0]);
});

exports.myEarnings = asyncHandler(async (req, res) => {
  const [list, summary] = await Promise.all([
    listCommissions(req.query, { influencerId: req.influencer._id }),
    analytics.summary({ influencerId: req.influencer._id }),
  ]);
  ok(res, { items: list.items, summary: summary.commission }, list.meta);
});

exports.myPayouts = asyncHandler(async (req, res) => {
  const { items, meta } = await payoutService.list(req.query, { influencerId: req.influencer._id });
  ok(res, items.map(({ createdBy, ...p }) => p), meta);
});

exports.myReferralLinks = asyncHandler(async (req, res) => {
  const inf = req.influencer;
  const baseUrl = influencerService.referralUrlFor(inf.subdomain);
  const workshops = await Workshop.find({ status: 'published', endDate: { $gte: new Date() } }).sort('startDate').lean({ virtuals: true });
  const ids = workshops.map((w) => w._id);
  const oid = new mongoose.Types.ObjectId(String(inf._id));
  const [clicks, leads, totalClicks] = await Promise.all([
    ReferralClick.aggregate([{ $match: { influencerId: oid, workshopId: { $in: ids } } }, { $group: { _id: '$workshopId', n: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: { influencerId: oid, workshopId: { $in: ids } } },
      { $group: { _id: '$workshopId', n: { $sum: 1 }, paid: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded']] }, 1, 0] } } } },
    ]),
    ReferralClick.countDocuments({ influencerId: oid }),
  ]);
  const cm = new Map(clicks.map((c) => [String(c._id), c.n]));
  const lm = new Map(leads.map((l) => [String(l._id), l]));
  const campaignLink = (w, source, medium) =>
    `${baseUrl}/workshops/${w.slug}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${encodeURIComponent(w.campaignCode)}`;
  ok(res, {
    subdomain: `${inf.subdomain}`,
    referralUrl: baseUrl,
    referralCode: inf.influencerCode,
    totalClicks,
    campaigns: workshops.map((w) => ({
      workshopId: w._id,
      title: w.title,
      slug: w.slug,
      startDate: w.startDate,
      campaignCode: w.campaignCode,
      links: {
        default: `${baseUrl}/workshops/${w.slug}`,
        instagram: campaignLink(w, 'instagram', 'social'),
        whatsapp: campaignLink(w, 'whatsapp', 'messaging'),
        facebook: campaignLink(w, 'facebook', 'social'),
        youtube: campaignLink(w, 'youtube', 'video'),
      },
      clicks: cm.get(String(w._id)) || 0,
      leads: lm.get(String(w._id))?.n || 0,
      paid: lm.get(String(w._id))?.paid || 0,
    })),
  });
});

exports.myWorkshops = asyncHandler(async (req, res) => {
  const workshops = await Workshop.find({ status: { $in: ['published', 'completed'] } }).sort('-startDate').limit(50);
  ok(res, workshops.map((w) => w.toJSON()));
});

exports.myResources = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.workshopId && isObjectId(req.query.workshopId)) filter.workshopId = { $in: [req.query.workshopId, null] };
  if (req.query.type) filter.type = req.query.type;
  const items = await Resource.find(filter).populate('workshopId', 'title slug').sort('-createdAt').lean();
  ok(res, items);
});

/** Admin: remove an influencer's profile image */
exports.removeAvatar = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const inf = await Influencer.findById(id);
  if (!inf) throw ApiError.notFound('Influencer not found');
  await deleteFile(inf.profileImage);
  inf.profileImage = undefined;
  await inf.save();
  await recordAudit({ req, action: 'influencer.remove_avatar', entityType: 'Influencer', entityId: inf._id });
  ok(res, { ok: true });
});

