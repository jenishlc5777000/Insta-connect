const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { asyncHandler, ok, parseListQuery, buildMeta, isObjectId } = require('../utils/helpers');
const { Commission } = require('../models');
const commissionService = require('../services/commissionService');
const analytics = require('../services/analyticsService');

async function listCommissions(query, { influencerId } = {}) {
  const { page, limit, skip, sort } = parseListQuery(query, { allowedSort: ['createdAt', 'commissionAmount', 'status', 'paidAt'] });
  const filter = {};
  if (influencerId) filter.influencerId = new mongoose.Types.ObjectId(String(influencerId));
  else if (isObjectId(query.influencerId)) filter.influencerId = query.influencerId;
  if (isObjectId(query.workshopId)) filter.workshopId = query.workshopId;
  if (query.status) filter.status = String(query.status);
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }
  const [items, total] = await Promise.all([
    Commission.find(filter)
      .populate('workshopId', 'title slug')
      .populate('leadId', 'name')
      .populate({ path: 'influencerId', select: 'influencerCode userId', populate: { path: 'userId', select: 'name' } })
      .populate('paymentId', 'gatewayPaymentId amount refundedAmount refundStatus')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Commission.countDocuments(filter),
  ]);
  return {
    items: items.map((c) => ({
      ...c,
      history: influencerId ? undefined : c.history,
      approvedBy: influencerId ? undefined : c.approvedBy,
    })),
    meta: buildMeta(total, page, limit),
  };
}
exports.listCommissions = listCommissions;

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await listCommissions(req.query);
  ok(res, items, meta);
});

exports.summary = asyncHandler(async (req, res) => {
  const scope = {};
  if (isObjectId(req.query.influencerId)) scope.influencerId = req.query.influencerId;
  if (isObjectId(req.query.workshopId)) scope.workshopId = req.query.workshopId;
  const s = await analytics.summary(scope);
  ok(res, s.commission);
});

exports.approve = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Commission not found');
  const [c] = await commissionService.approve([req.params.id], req);
  ok(res, c);
});

exports.reject = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Commission not found');
  const [c] = await commissionService.reject([req.params.id], req.body.reason, req);
  ok(res, c);
});

exports.bulk = asyncHandler(async (req, res) => {
  const { ids, action, reason } = req.body;
  if (action === 'reject' && (!reason || reason.length < 3)) throw ApiError.badRequest('A reason is required to reject');
  const list = action === 'approve' ? await commissionService.approve(ids, req) : await commissionService.reject(ids, reason, req);
  ok(res, { updated: list.length });
});
