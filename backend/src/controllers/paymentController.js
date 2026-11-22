const ApiError = require('../utils/ApiError');
const { asyncHandler, ok, created, parseListQuery, buildMeta, isObjectId, escapeRegex } = require('../utils/helpers');
const { Payment, Commission, Lead } = require('../models');
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');

exports.config = (_req, res) => ok(res, paymentService.paymentConfig());

exports.createOrder = asyncHandler(async (req, res) => {
  created(res, await paymentService.createOrder(req.body, req.user));
});

exports.verify = asyncHandler(async (req, res) => {
  ok(res, await paymentService.verifyCheckout(req.body));
});

exports.mockComplete = asyncHandler(async (req, res) => {
  ok(res, await paymentService.mockComplete(req.body));
});

/** Razorpay webhook: raw body (signature is computed over exact bytes) */
exports.webhook = async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body)) throw ApiError.badRequest('Expected raw body');
    const result = await paymentService.handleWebhook(req.body, req.headers);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error('Webhook processing failed', err);
    res.status(status).json({ success: false, error: { message: err.message } });
  }
};

/* ---------------------------------- Admin --------------------------------- */

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parseListQuery(req.query, { allowedSort: ['createdAt', 'amount', 'status', 'capturedAt'] });
  const filter = {};
  for (const k of ['status', 'refundStatus', 'gateway']) if (req.query[k]) filter[k] = String(req.query[k]);
  for (const k of ['influencerId', 'workshopId']) if (isObjectId(req.query[k])) filter[k] = req.query[k];
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }
  if (req.query.search) {
    const s = String(req.query.search).slice(0, 100);
    const rx = new RegExp(escapeRegex(s), 'i');
    const leads = await Lead.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id').limit(1000).lean();
    filter.$or = [{ leadId: { $in: leads.map((l) => l._id) } }, { gatewayOrderId: s }, { gatewayPaymentId: s }];
  }
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('leadId', 'name email phone')
      .populate('workshopId', 'title')
      .populate({ path: 'influencerId', select: 'influencerCode userId', populate: { path: 'userId', select: 'name' } })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  const commissions = await Commission.find({ paymentId: { $in: items.map((p) => p._id) } })
    .select('paymentId status commissionAmount commissionRate eligibleNetRevenue clawbackAmount')
    .lean();
  const cm = new Map(commissions.map((c) => [String(c.paymentId), c]));
  ok(res, items.map((p) => ({ ...p, commission: cm.get(String(p._id)) || null })), buildMeta(total, page, limit));
});

exports.get = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Payment not found');
  const p = await Payment.findById(req.params.id).populate('leadId', 'name email phone').populate('workshopId', 'title').lean();
  if (!p) throw ApiError.notFound('Payment not found');
  const commission = await Commission.findOne({ paymentId: p._id }).lean();
  ok(res, { ...p, commission });
});

exports.refund = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Payment not found');
  ok(res, await paymentService.refundPayment(req.params.id, req.body, req));
});
