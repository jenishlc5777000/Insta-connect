const ApiError = require('../utils/ApiError');
const { asyncHandler, ok, created, isObjectId, parseListQuery, buildMeta, escapeRegex } = require('../utils/helpers');
const workshopService = require('../services/workshopService');
const payoutService = require('../services/payoutService');
const analytics = require('../services/analyticsService');
const reportService = require('../services/reportService');
const referralService = require('../services/referralService');
const { getSettings, updateSettings, publicSettings } = require('../services/settingsService');
const { uploadFile, deleteFile } = require('../services/storageService');
const { recordAudit } = require('../services/auditService');
const { AuditLog, Resource, User, Workshop } = require('../models');

const requireId = (id, what = 'Resource') => {
  if (!isObjectId(id)) throw ApiError.notFound(`${what} not found`);
  return id;
};

/* -------------------------------- Workshops ------------------------------- */
exports.workshops = {
  list: asyncHandler(async (req, res) => {
    const admin = req.user?.role === 'admin' && req.query.scope === 'admin';
    const { items, meta } = await workshopService.list(req.query, { admin });
    ok(res, items, meta);
  }),
  featured: asyncHandler(async (_req, res) => ok(res, await workshopService.getFeatured())),
  getBySlug: asyncHandler(async (req, res) => ok(res, await workshopService.getBySlug(req.params.slug, { admin: req.user?.role === 'admin' }))),
  getById: asyncHandler(async (req, res) => ok(res, await workshopService.getById(requireId(req.params.id, 'Workshop')))),
  create: asyncHandler(async (req, res) => created(res, await workshopService.create(req.body, req))),
  update: asyncHandler(async (req, res) => ok(res, await workshopService.update(requireId(req.params.id, 'Workshop'), req.body, req))),
  remove: asyncHandler(async (req, res) => {
    await workshopService.remove(requireId(req.params.id, 'Workshop'), req);
    ok(res, { deleted: true });
  }),
  uploadImage: asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Choose an image to upload');
    const { url } = await uploadFile(req.file, 'workshops');
    ok(res, { url });
  }),
};

/* -------------------------------- Referrals ------------------------------- */
exports.referrals = {
  track: asyncHandler(async (req, res) => ok(res, await referralService.trackVisit(req, res, req.body))),
};

/* --------------------------------- Payouts -------------------------------- */
exports.payouts = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await payoutService.list(req.query);
    ok(res, items, meta);
  }),
  eligible: asyncHandler(async (_req, res) => ok(res, await payoutService.eligible())),
  create: asyncHandler(async (req, res) => created(res, await payoutService.create(req.body, req))),
  markPaid: asyncHandler(async (req, res) => ok(res, await payoutService.markPaid(requireId(req.params.id, 'Payout'), req.body, req))),
  markFailed: asyncHandler(async (req, res) => ok(res, await payoutService.markFailed(requireId(req.params.id, 'Payout'), req.body, req))),
};

/* -------------------------------- Analytics ------------------------------- */
const scopeFrom = (q) => ({
  workshopId: isObjectId(q.workshopId) ? q.workshopId : undefined,
  influencerId: isObjectId(q.influencerId) ? q.influencerId : undefined,
  from: q.from || undefined,
  to: q.to ? `${q.to}T23:59:59.999Z` : undefined,
});

exports.analytics = {
  adminOverview: asyncHandler(async (req, res) => {
    const scope = scopeFrom(req.query);
    const days = req.query.days || (scope.from ? Math.max(1, Math.ceil((new Date(scope.to || Date.now()) - new Date(scope.from)) / 864e5)) : 30);
    const [summary, series, top, workshops, sources, activity, trends, byInfluencer] = await Promise.all([
      analytics.adminOverview(scope),
      analytics.timeseries({ ...scope, days }),
      analytics.topInfluencers({ limit: 8, from: scope.from, to: scope.to }),
      analytics.workshopPerformance(),
      analytics.trafficSources(scope),
      analytics.recentActivity({ limit: 10 }),
      analytics.trends({ workshopId: scope.workshopId }, days),
      analytics.registrationsByInfluencer(scope),
    ]);
    ok(res, { summary, series, topInfluencers: top, workshops: workshops.slice(0, 8), sources, activity, trends, byInfluencer });
  }),
  timeseries: asyncHandler(async (req, res) => ok(res, await analytics.timeseries({ ...scopeFrom(req.query), days: req.query.days }))),
  influencerOverview: asyncHandler(async (req, res) => {
    const id = req.influencer._id;
    const [summary, series] = await Promise.all([analytics.summary({ influencerId: id }), analytics.timeseries({ influencerId: id, days: req.query.days })]);
    ok(res, { summary, series });
  }),
};

/* --------------------------------- Reports -------------------------------- */
exports.reports = {
  types: (_req, res) => ok(res, reportService.REPORT_TYPES),
  get: asyncHandler(async (req, res) => {
    const q = { ...req.query };
    for (const k of ['influencerId', 'workshopId']) if (q[k] && !isObjectId(q[k])) delete q[k];
    if (q.format && !['csv', 'xlsx', 'json'].includes(q.format)) q.format = 'json';
    await reportService.send(res, req.params.type, q);
  }),
};

/* ------------------------------ Admin settings ---------------------------- */
exports.admin = {
  getSettings: asyncHandler(async (_req, res) => ok(res, await getSettings({ fresh: true }))),
  publicSettings: asyncHandler(async (_req, res) => ok(res, publicSettings(await getSettings()))),
  updateSettings: asyncHandler(async (req, res) => {
    const before = await getSettings({ fresh: true });
    if (req.body.featuredWorkshopId && !(await Workshop.exists({ _id: req.body.featuredWorkshopId }))) {
      throw ApiError.badRequest('Featured workshop not found');
    }
    const after = await updateSettings(req.body, req.user._id);
    const keys = Object.keys(req.body);
    await recordAudit({
      req,
      action: 'settings.update',
      entityType: 'Setting',
      entityId: after._id,
      previousValue: Object.fromEntries(keys.map((k) => [k, before[k]])),
      newValue: Object.fromEntries(keys.map((k) => [k, after[k]])),
    });
    ok(res, after);
  }),
  auditLogs: asyncHandler(async (req, res) => {
    const { page, limit, skip, sort } = parseListQuery(req.query, { allowedSort: ['createdAt', 'action'] });
    const filter = {};
    if (req.query.entityType) filter.entityType = String(req.query.entityType);
    if (isObjectId(req.query.entityId)) filter.entityId = req.query.entityId;
    if (req.query.action) filter.action = new RegExp(`^${escapeRegex(String(req.query.action))}`);
    const [items, total] = await Promise.all([
      AuditLog.find(filter).populate('adminId', 'name email').sort(sort).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    ok(res, items, buildMeta(total, page, limit));
  }),
  users: asyncHandler(async (req, res) => {
    const { page, limit, skip, sort } = parseListQuery(req.query, { allowedSort: ['createdAt', 'name', 'email'] });
    const filter = {};
    if (req.query.role) filter.role = String(req.query.role);
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [items, total] = await Promise.all([User.find(filter).sort(sort).skip(skip).limit(limit), User.countDocuments(filter)]);
    ok(res, items, buildMeta(total, page, limit));
  }),
  setUserStatus: asyncHandler(async (req, res) => {
    const user = await User.findById(requireId(req.params.id, 'User'));
    if (!user) throw ApiError.notFound('User not found');
    if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own status');
    const prev = user.status;
    user.status = req.body.status;
    await user.save();
    if (user.status !== 'active') await require('../services/tokenService').revokeAllForUser(user._id);
    await recordAudit({ req, action: 'user.status', entityType: 'User', entityId: user._id, previousValue: { status: prev }, newValue: { status: user.status } });
    ok(res, user);
  }),
};

/* --------------------------- Marketing resources -------------------------- */
exports.resources = {
  list: asyncHandler(async (req, res) => {
    const filter = {};
    if (isObjectId(req.query.workshopId)) filter.workshopId = req.query.workshopId;
    if (req.query.type) filter.type = String(req.query.type);
    ok(res, await Resource.find(filter).populate('workshopId', 'title').sort('-createdAt').lean());
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.file && !req.body.textContent) throw ApiError.badRequest('Upload a file or enter text content');
    let file = {};
    if (req.file) {
      const up = await uploadFile(req.file, 'resources');
      file = { fileUrl: up.url, filePublicId: up.publicId, mimeType: req.file.mimetype };
    }
    const resource = await Resource.create({ ...req.body, ...file, createdBy: req.user._id });
    await recordAudit({ req, action: 'resource.create', entityType: 'Resource', entityId: resource._id, newValue: { title: resource.title, type: resource.type } });
    created(res, resource);
  }),
  remove: asyncHandler(async (req, res) => {
    const resource = await Resource.findById(requireId(req.params.id));
    if (!resource) throw ApiError.notFound('Resource not found');
    await deleteFile(resource.filePublicId);
    await resource.deleteOne();
    await recordAudit({ req, action: 'resource.delete', entityType: 'Resource', entityId: resource._id, previousValue: { title: resource.title } });
    ok(res, { deleted: true });
  }),
};
