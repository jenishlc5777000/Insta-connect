const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { Payout, Commission, Influencer } = require('../models');
const { so, parseListQuery, buildMeta } = require('../utils/helpers');
const { withTransaction } = require('../utils/transaction');
const { recordAudit } = require('./auditService');
const { getSettings } = require('./settingsService');

async function create(data, req) {
  const influencer = await Influencer.findById(data.influencerId).lean();
  if (!influencer) throw ApiError.notFound('Influencer not found');
  if (data.markPaid && !data.transactionId) throw ApiError.badRequest('A transaction ID is required to mark the payout as paid', [{ field: 'transactionId' }]);

  const settings = await getSettings();

  return withTransaction(async (session) => {
    const ids = [...new Set(data.commissionIds)];
    const commissions = await Commission.find({ _id: { $in: ids } }).session(session || null);
    if (commissions.length !== ids.length) throw ApiError.notFound('One or more commissions were not found');
    if (commissions.some((c) => String(c.influencerId) !== String(influencer._id))) {
      throw ApiError.badRequest('All commissions must belong to the selected influencer');
    }
    if (commissions.some((c) => c.status !== 'approved' || c.payoutId)) {
      throw ApiError.badRequest('Only approved commissions that are not already in a payout can be paid');
    }
    const amount = commissions.reduce((s, c) => s + c.commissionAmount, 0);
    if (amount < (settings.minimumPayoutAmount || 0)) {
      throw ApiError.badRequest(`Payout is below the minimum payout amount of ₹${settings.minimumPayoutAmount / 100}`);
    }

    const [payout] = await Payout.create(
      [
        {
          influencerId: influencer._id,
          amount,
          commissionIds: ids,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId,
          notes: data.notes,
          status: data.markPaid ? 'paid' : 'pending',
          paidAt: data.markPaid ? new Date() : undefined,
          createdBy: req.user._id,
        },
      ],
      so(session)
    );

    // Lock commissions into the payout (guards against concurrent payouts of the same commission)
    const res = await Commission.updateMany(
      { _id: { $in: ids }, status: 'approved', payoutId: null },
      {
        $set: { payoutId: payout._id, ...(data.markPaid ? { status: 'paid', paidAt: new Date() } : {}) },
        $push: { history: { status: data.markPaid ? 'paid' : 'approved', by: req.user._id, note: `Added to payout ${payout._id}`, at: new Date() } },
      },
      so(session)
    );
    if (res.modifiedCount !== ids.length) throw ApiError.conflict('Some commissions changed while creating the payout. Please retry.');

    await recordAudit({ req, action: 'payout.create', entityType: 'Payout', entityId: payout._id, newValue: { amount, commissions: ids.length, status: payout.status, transactionId: payout.transactionId } }, session);
    return payout;
  });
}

async function markPaid(id, { transactionId, notes }, req) {
  return withTransaction(async (session) => {
    const payout = await Payout.findById(id).session(session || null);
    if (!payout) throw ApiError.notFound('Payout not found');
    if (payout.status !== 'pending') throw ApiError.badRequest('Only pending payouts can be marked as paid');
    payout.status = 'paid';
    payout.transactionId = transactionId;
    payout.paidAt = new Date();
    if (notes) payout.notes = notes;
    await payout.save(so(session));
    await Commission.updateMany(
      { payoutId: payout._id, status: 'approved' },
      { $set: { status: 'paid', paidAt: payout.paidAt }, $push: { history: { status: 'paid', by: req.user._id, note: `Txn ${transactionId}`, at: new Date() } } },
      so(session)
    );
    await recordAudit({ req, action: 'payout.mark_paid', entityType: 'Payout', entityId: payout._id, previousValue: { status: 'pending' }, newValue: { status: 'paid', transactionId } }, session);
    return payout;
  });
}

async function markFailed(id, { notes }, req) {
  return withTransaction(async (session) => {
    const payout = await Payout.findById(id).session(session || null);
    if (!payout) throw ApiError.notFound('Payout not found');
    if (payout.status !== 'pending') throw ApiError.badRequest('Only pending payouts can be marked as failed');
    payout.status = 'failed';
    payout.notes = notes;
    await payout.save(so(session));
    // Release commissions so they can be paid in a new payout
    await Commission.updateMany(
      { payoutId: payout._id, status: 'approved' },
      { $set: { payoutId: null }, $push: { history: { status: 'approved', by: req.user._id, note: `Payout failed: ${notes}`, at: new Date() } } },
      so(session)
    );
    await recordAudit({ req, action: 'payout.mark_failed', entityType: 'Payout', entityId: payout._id, newValue: { status: 'failed' }, reason: notes }, session);
    return payout;
  });
}

async function list(query, { influencerId } = {}) {
  const { page, limit, skip, sort } = parseListQuery(query, { allowedSort: ['createdAt', 'amount', 'paidAt', 'status'] });
  const filter = {};
  if (influencerId) filter.influencerId = influencerId;
  else if (query.influencerId && mongoose.isValidObjectId(query.influencerId)) filter.influencerId = query.influencerId;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Payout.find(filter)
      .populate({ path: 'influencerId', select: 'influencerCode subdomain userId', populate: { path: 'userId', select: 'name email' } })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payout.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
}

/** Influencers with approved, unpaid commissions - the payout queue */
async function eligible() {
  const rows = await Commission.aggregate([
    { $match: { status: 'approved', payoutId: null } },
    { $group: { _id: '$influencerId', amount: { $sum: '$commissionAmount' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $sort: { amount: -1 } },
  ]);
  const influencers = await Influencer.find({ _id: { $in: rows.map((r) => r._id) } })
    .populate('userId', 'name email')
    .lean();
  const byId = new Map(influencers.map((i) => [String(i._id), i]));
  const clawbacks = await Commission.aggregate([
    { $match: { influencerId: { $in: rows.map((r) => r._id) }, clawbackAmount: { $gt: 0 } } },
    { $group: { _id: '$influencerId', amount: { $sum: '$clawbackAmount' } } },
  ]);
  const clawById = new Map(clawbacks.map((c) => [String(c._id), c.amount]));
  return rows.map((r) => {
    const inf = byId.get(String(r._id));
    return {
      influencerId: r._id,
      influencerCode: inf?.influencerCode,
      name: inf?.userId?.name,
      email: inf?.userId?.email,
      payoutMethod: inf?.payoutDetails?.method,
      payoutReady: Boolean(inf?.payoutDetails?.accountNumberLast4 || inf?.payoutDetails?.upiMasked),
      amount: r.amount,
      count: r.count,
      commissionIds: r.ids,
      clawbackOutstanding: clawById.get(String(r._id)) || 0,
    };
  });
}

module.exports = { create, markPaid, markFailed, list, eligible };
