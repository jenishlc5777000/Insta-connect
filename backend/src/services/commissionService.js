const ApiError = require('../utils/ApiError');
const { Commission, Influencer, Workshop } = require('../models');
const { so } = require('../utils/helpers');
const { getSettings } = require('./settingsService');
const { withTransaction } = require('../utils/transaction');
const { recordAudit } = require('./auditService');

/**
 * Commission rate precedence: influencer override -> workshop campaign rate -> platform default (50%).
 */
function resolveCommissionRate({ influencer, workshop, settings }) {
  if (influencer?.commissionRate !== null && influencer?.commissionRate !== undefined) return influencer.commissionRate;
  if (workshop?.commissionRate !== null && workshop?.commissionRate !== undefined) return workshop.commissionRate;
  return settings.defaultCommissionRate ?? 50;
}

/**
 * Pure calculation (all values in paise).
 *   base      = amount paid - refunded amount
 *   tax       = GST portion of base when "exclude tax" is on (prices are tax-inclusive)
 *   fee       = actual gateway fee (or configured %) when "deduct gateway fees" is on
 *   eligible  = base - tax - fee (never negative)
 *   commission= round(eligible * rate / 100)
 */
function calculateCommission({ amount, refundedAmount = 0, gatewayFee = 0, rate, settings }) {
  const base = Math.max(0, amount - refundedAmount);
  const tax =
    settings.excludeTaxFromCommission && settings.taxRatePercent > 0
      ? Math.round(base - base / (1 + settings.taxRatePercent / 100))
      : 0;
  let fee = 0;
  if (settings.deductGatewayFees && base > 0) {
    fee = gatewayFee > 0 ? gatewayFee : Math.round((amount * (settings.gatewayFeePercent || 0)) / 100);
  }
  const eligibleNetRevenue = Math.max(0, base - tax - fee);
  const commissionAmount = Math.round((eligibleNetRevenue * rate) / 100);
  return {
    grossAmount: amount,
    deductions: { tax, gatewayFee: fee, refunds: refundedAmount },
    eligibleNetRevenue,
    commissionRate: rate,
    commissionAmount,
  };
}

/** Creates the commission for a captured payment. Idempotent (unique paymentId). */
async function createForPayment(payment, session) {
  if (!payment.influencerId || payment.status !== 'captured') return null;
  const existing = await Commission.findOne({ paymentId: payment._id }).session(session || null);
  if (existing) return existing;

  const [settings, influencer, workshop] = await Promise.all([
    getSettings(),
    Influencer.findById(payment.influencerId).session(session || null).lean(),
    Workshop.findById(payment.workshopId).session(session || null).lean(),
  ]);
  if (!influencer) return null;

  const rate = resolveCommissionRate({ influencer, workshop, settings });
  const calc = calculateCommission({
    amount: payment.amount,
    refundedAmount: payment.refundedAmount || 0,
    gatewayFee: payment.gatewayFee || 0,
    rate,
    settings,
  });
  const status = settings.autoApproveCommissions ? 'approved' : 'pending';

  try {
    const [commission] = await Commission.create(
      [
        {
          influencerId: payment.influencerId,
          leadId: payment.leadId,
          workshopId: payment.workshopId,
          paymentId: payment._id,
          ...calc,
          status,
          approvedAt: status === 'approved' ? new Date() : undefined,
          history: [{ status, note: 'Created after verified payment' }],
        },
      ],
      so(session)
    );
    return commission;
  } catch (err) {
    if (err.code === 11000) return Commission.findOne({ paymentId: payment._id });
    throw err;
  }
}

/** Re-calculates (or reverses) a commission after a refund. */
async function adjustForRefund(payment, session) {
  const commission = await Commission.findOne({ paymentId: payment._id }).session(session || null);
  if (!commission || ['rejected', 'reversed'].includes(commission.status)) return commission;

  const settings = await getSettings();
  const fullyRefunded = payment.refundedAmount >= payment.amount;
  const calc = calculateCommission({
    amount: payment.amount,
    refundedAmount: payment.refundedAmount,
    gatewayFee: payment.gatewayFee,
    rate: commission.commissionRate,
    settings,
  });
  const previousAmount = commission.commissionAmount;

  if (fullyRefunded) {
    if (commission.status === 'paid') commission.clawbackAmount = previousAmount;
    commission.status = 'reversed';
    commission.reversedAt = new Date();
    commission.reversalReason = 'Payment fully refunded';
    commission.deductions = calc.deductions;
    commission.eligibleNetRevenue = 0;
    commission.history.push({ status: 'reversed', note: 'Payment fully refunded' });
  } else {
    if (commission.status === 'paid') {
      commission.clawbackAmount = Math.max(0, previousAmount - calc.commissionAmount);
    } else {
      commission.commissionAmount = calc.commissionAmount;
    }
    commission.eligibleNetRevenue = calc.eligibleNetRevenue;
    commission.deductions = calc.deductions;
    commission.history.push({
      status: commission.status,
      note: `Adjusted for partial refund (${previousAmount} -> ${calc.commissionAmount} paise)`,
    });
  }
  await commission.save(so(session));
  return commission;
}

/** Cancels a commission when its payment is cancelled/failed after capture (e.g. chargeback). */
async function reverseForPayment(paymentId, reason, session) {
  const commission = await Commission.findOne({ paymentId }).session(session || null);
  if (!commission || ['rejected', 'reversed'].includes(commission.status)) return commission;
  if (commission.status === 'paid') commission.clawbackAmount = commission.commissionAmount;
  commission.status = 'reversed';
  commission.reversedAt = new Date();
  commission.reversalReason = reason;
  commission.history.push({ status: 'reversed', note: reason });
  await commission.save(so(session));
  return commission;
}

async function approve(ids, req) {
  return withTransaction(async (session) => {
    const list = await Commission.find({ _id: { $in: ids } }).session(session || null);
    if (list.length !== ids.length) throw ApiError.notFound('One or more commissions were not found');
    const notPending = list.filter((c) => c.status !== 'pending');
    if (notPending.length) throw ApiError.badRequest('Only pending commissions can be approved');
    for (const c of list) {
      c.status = 'approved';
      c.approvedAt = new Date();
      c.approvedBy = req.user._id;
      c.history.push({ status: 'approved', by: req.user._id });
      await c.save(so(session));
      await recordAudit({ req, action: 'commission.approve', entityType: 'Commission', entityId: c._id, previousValue: { status: 'pending' }, newValue: { status: 'approved' } }, session);
    }
    return list;
  });
}

async function reject(ids, reason, req) {
  return withTransaction(async (session) => {
    const list = await Commission.find({ _id: { $in: ids } }).session(session || null);
    if (list.length !== ids.length) throw ApiError.notFound('One or more commissions were not found');
    if (list.some((c) => !['pending', 'approved'].includes(c.status))) {
      throw ApiError.badRequest('Only pending or approved commissions can be rejected');
    }
    for (const c of list) {
      const prev = c.status;
      c.status = 'rejected';
      c.rejectionReason = reason;
      c.history.push({ status: 'rejected', by: req.user._id, note: reason });
      await c.save(so(session));
      await recordAudit({ req, action: 'commission.reject', entityType: 'Commission', entityId: c._id, previousValue: { status: prev }, newValue: { status: 'rejected' }, reason }, session);
    }
    return list;
  });
}

module.exports = {
  resolveCommissionRate,
  calculateCommission,
  createForPayment,
  adjustForRefund,
  reverseForPayment,
  approve,
  reject,
};
