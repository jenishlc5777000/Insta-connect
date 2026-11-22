const Razorpay = require('razorpay');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { Payment, Lead, Workshop, WebhookEvent } = require('../models');
const { hmacSha256, safeEqual, randomToken, sha256, so } = require('../utils/helpers');
const { withTransaction } = require('../utils/transaction');
const { createForPayment, adjustForRefund, reverseForPayment } = require('./commissionService');
const { getLeadForOwner, assertOpenForRegistration } = require('./leadService');
const { recordAudit } = require('./auditService');
const emailService = require('./emailService');

const PAID_STATES = ['paid', 'not_required', 'partially_refunded'];

let razorpayClient;
function razorpay() {
  if (!env.razorpayConfigured) throw new ApiError(503, 'Payments are not configured', undefined, 'PAYMENTS_DISABLED');
  if (!razorpayClient) razorpayClient = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return razorpayClient;
}

const activeGateway = () => (env.paymentMock ? 'mock' : 'razorpay');

function paymentConfig() {
  return {
    gateway: activeGateway(),
    keyId: env.paymentMock ? null : env.razorpay.keyId || null,
    enabled: env.paymentMock || env.razorpayConfigured,
  };
}

/* ------------------------------------------------------------------ orders */

async function createOrder({ leadId, accessToken }, user) {
  const lead = await getLeadForOwner(leadId, { accessToken, user });
  if (PAID_STATES.includes(lead.paymentStatus)) throw ApiError.conflict('This registration is already paid');
  if (lead.registrationStatus === 'cancelled') throw ApiError.badRequest('This registration was cancelled');

  const workshop = await Workshop.findById(lead.workshopId);
  await assertOpenForRegistration(workshop);
  const amount = workshop.effectivePrice; // amount always comes from the database, never the client
  if (amount <= 0) throw ApiError.badRequest('This workshop does not require payment');

  const gateway = activeGateway();
  // Re-use a recent unpaid order so double clicks don't create many orders
  let payment = await Payment.findOne({
    leadId: lead._id,
    status: 'created',
    amount,
    gateway,
    createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
  });

  if (!payment) {
    let orderId;
    if (gateway === 'mock') {
      orderId = `mock_order_${randomToken(10)}`;
    } else {
      const order = await razorpay().orders.create({
        amount,
        currency: workshop.currency || 'INR',
        receipt: `lead_${lead._id}`.slice(0, 40),
        notes: { leadId: String(lead._id), workshopId: String(workshop._id) },
      });
      orderId = order.id;
    }
    payment = await Payment.create({
      leadId: lead._id,
      workshopId: workshop._id,
      influencerId: lead.influencerId,
      amount,
      currency: workshop.currency || 'INR',
      gateway,
      gatewayOrderId: orderId,
    });
  }

  return {
    orderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.gateway,
    keyId: payment.gateway === 'razorpay' ? env.razorpay.keyId : null,
    workshopTitle: workshop.title,
    prefill: { name: lead.name, email: lead.email, contact: lead.phone },
  };
}

/* ----------------------------------------------------------------- capture */

/**
 * Marks a payment captured exactly once (atomic status transition) and, in the same transaction,
 * confirms the lead and creates the commission.
 */
async function markCaptured(paymentDocId, info, via) {
  const result = await withTransaction(async (session) => {
    const current = await Payment.findById(paymentDocId).session(session || null);
    if (!current) throw ApiError.notFound('Payment not found');
    if (info.amount !== undefined && info.amount !== current.amount) {
      throw ApiError.badRequest('Payment amount does not match the order');
    }

    const update = {
      status: 'captured',
      gatewayPaymentId: info.paymentId,
      capturedAt: new Date(),
      verifiedVia: via,
    };
    if (info.method) update.method = info.method;
    if (info.fee !== undefined) update.gatewayFee = info.fee;
    if (info.tax !== undefined) update.gatewayTax = info.tax;

    const payment = await Payment.findOneAndUpdate({ _id: paymentDocId, status: { $ne: 'captured' } }, { $set: update, $unset: { failureReason: 1 } }, { new: true, ...so(session) });

    if (!payment) {
      // Already captured (e.g. checkout + webhook both arrived). Fill in fee details if we learned them now.
      if (info.fee !== undefined && !current.gatewayFee) {
        await Payment.updateOne({ _id: paymentDocId }, { gatewayFee: info.fee, gatewayTax: info.tax || 0, method: info.method || current.method }, so(session));
      }
      return { payment: current, alreadyCaptured: true };
    }

    const lead = await Lead.findById(payment.leadId).session(session || null);
    const otherCaptured = await Payment.exists({ leadId: payment.leadId, status: 'captured', _id: { $ne: payment._id } }).session(session || null);
    if (otherCaptured) {
      // The customer paid twice: keep the record, flag it for refund, no second commission.
      payment.failureReason = 'Duplicate payment for an already-paid registration - refund required';
      await payment.save(so(session));
      return { payment, lead, alreadyCaptured: false, duplicate: true };
    }

    lead.paymentStatus = 'paid';
    lead.registrationStatus = 'confirmed';
    await lead.save(so(session));
    const commission = await createForPayment(payment, session);
    return { payment, lead, commission, alreadyCaptured: false };
  });

  if (!result.alreadyCaptured && result.lead && !result.duplicate) {
    const workshop = await Workshop.findById(result.payment.workshopId).lean();
    const token = randomToken(24);
    await Lead.updateOne({ _id: result.lead._id }, { $push: { accessTokenHashes: { $each: [sha256(token)], $slice: -10 } } });
    await emailService.sendTemplate('paymentConfirmed', result.lead.email, {
      name: result.lead.name,
      workshop,
      amount: result.payment.amount,
      paymentId: result.payment.gatewayPaymentId,
      statusUrl: `${env.frontendUrl}/registration/${result.lead._id}?token=${token}`,
    });
  }
  return result;
}

async function markFailed(paymentDocId, reason) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentDocId, status: { $in: ['created', 'authorized'] } },
    { status: 'failed', failureReason: reason?.slice(0, 300) },
    { new: true }
  );
  if (payment) {
    await Lead.updateOne({ _id: payment.leadId, paymentStatus: { $in: ['pending', 'failed'] } }, { paymentStatus: 'failed' });
  }
  return payment;
}

/** Called by the frontend after Razorpay Checkout. The signature is verified server-side. */
async function verifyCheckout({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }) {
  const payment = await Payment.findOne({ gatewayOrderId: orderId, gateway: 'razorpay' });
  if (!payment) throw ApiError.notFound('Order not found');

  const expected = hmacSha256(`${orderId}|${paymentId}`, env.razorpay.keySecret);
  if (!env.razorpay.keySecret || !safeEqual(expected, signature)) {
    throw ApiError.badRequest('Payment signature verification failed', [{ field: 'razorpay_signature' }]);
  }

  // Signature proves authorisation for this order; fetch details (fee, method, amount) when reachable.
  const info = { paymentId };
  try {
    let entity = await razorpay().payments.fetch(paymentId);
    if (entity.order_id !== orderId) throw ApiError.badRequest('Payment does not belong to this order');
    if (entity.status === 'authorized') {
      entity = await razorpay().payments.capture(paymentId, payment.amount, payment.currency);
    }
    Object.assign(info, { amount: Number(entity.amount), fee: entity.fee || 0, tax: entity.tax || 0, method: entity.method });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.warn(`Could not fetch Razorpay payment ${paymentId}: ${err.message}`);
  }

  const result = await markCaptured(payment._id, info, 'checkout');
  return summarize(result);
}

/** Development-only: simulates the gateway */
async function mockComplete({ orderId, outcome }) {
  if (!env.paymentMock) throw ApiError.notFound();
  const payment = await Payment.findOne({ gatewayOrderId: orderId, gateway: 'mock' });
  if (!payment) throw ApiError.notFound('Order not found');
  if (outcome === 'failure') {
    await markFailed(payment._id, 'Simulated failure');
    throw ApiError.badRequest('Payment failed (simulated)');
  }
  const fee = Math.round(payment.amount * 0.02);
  const result = await markCaptured(payment._id, { paymentId: `mock_pay_${randomToken(8)}`, amount: payment.amount, fee, tax: Math.round(fee * 0.18), method: 'mock' }, 'mock');
  return summarize(result);
}

function summarize({ payment, lead, duplicate }) {
  return {
    paymentId: payment._id,
    status: payment.status,
    leadId: payment.leadId,
    paymentStatus: lead?.paymentStatus,
    duplicate: Boolean(duplicate),
  };
}

/* ----------------------------------------------------------------- refunds */

function deriveRefundStatus(payment) {
  const processed = payment.refunds.filter((r) => r.status === 'processed').reduce((s, r) => s + r.amount, 0);
  payment.refundedAmount = Math.min(processed, payment.amount);
  if (payment.refundedAmount >= payment.amount) return 'full';
  if (payment.refundedAmount > 0) return 'partial';
  if (payment.refunds.some((r) => r.status === 'pending')) return 'pending';
  return 'none';
}

async function refundPayment(paymentId, { amount, reason }, req) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status !== 'captured') throw ApiError.badRequest('Only captured payments can be refunded');

  const committed = payment.refunds.filter((r) => r.status !== 'failed').reduce((s, r) => s + r.amount, 0);
  const refundable = payment.amount - committed;
  const refundAmount = amount ?? refundable;
  if (refundAmount <= 0 || refundAmount > refundable) {
    throw ApiError.badRequest(`Refund amount must be between ₹1 and ₹${(refundable / 100).toFixed(2)}`);
  }

  let refund;
  if (payment.gateway === 'mock') {
    refund = { id: `mock_rfnd_${randomToken(8)}`, status: 'processed' };
  } else {
    refund = await razorpay().payments.refund(payment.gatewayPaymentId, { amount: refundAmount, notes: { reason: reason.slice(0, 250) } });
  }

  payment.refunds.push({ refundId: refund.id, amount: refundAmount, status: 'pending', reason, initiatedBy: req.user._id });
  payment.refundStatus = deriveRefundStatus(payment);
  await payment.save();
  await recordAudit({ req, action: 'payment.refund', entityType: 'Payment', entityId: payment._id, newValue: { refundId: refund.id, amount: refundAmount }, reason });

  if (refund.status === 'processed') await applyRefund(payment._id, { refundId: refund.id, amount: refundAmount });
  return Payment.findById(payment._id);
}

/** Applies a processed refund exactly once: updates payment + lead and adjusts/reverses the commission */
async function applyRefund(paymentDocId, { refundId, amount }) {
  return withTransaction(async (session) => {
    const payment = await Payment.findById(paymentDocId).session(session || null);
    if (!payment) throw ApiError.notFound('Payment not found');
    const entry = payment.refunds.find((r) => r.refundId === refundId);
    if (entry?.status === 'processed') return payment; // idempotent
    if (entry) {
      entry.status = 'processed';
      entry.processedAt = new Date();
      if (amount) entry.amount = amount;
    } else {
      payment.refunds.push({ refundId, amount, status: 'processed', processedAt: new Date(), reason: 'Refunded via gateway dashboard' });
    }
    payment.refundStatus = deriveRefundStatus(payment);
    await payment.save(so(session));

    const lead = await Lead.findById(payment.leadId).session(session || null);
    if (lead) {
      if (payment.refundStatus === 'full') {
        lead.paymentStatus = 'refunded';
        lead.registrationStatus = 'cancelled';
      } else if (payment.refundStatus === 'partial') {
        lead.paymentStatus = 'partially_refunded';
      }
      await lead.save(so(session));
    }
    await adjustForRefund(payment, session);
    return payment;
  });
}

/* ---------------------------------------------------------------- webhooks */

function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret) throw new ApiError(503, 'Webhook secret not configured', undefined, 'WEBHOOK_DISABLED');
  const expected = hmacSha256(rawBody, env.razorpay.webhookSecret);
  if (!safeEqual(expected, signature)) throw ApiError.badRequest('Invalid webhook signature');
}

async function handleWebhook(rawBody, headers) {
  verifyWebhookSignature(rawBody, headers['x-razorpay-signature']);
  const event = JSON.parse(rawBody.toString('utf8'));
  const eventId = headers['x-razorpay-event-id'] || sha256(rawBody);

  try {
    await WebhookEvent.create({ eventId, event: event.event });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }

  try {
    const status = await processEvent(event);
    await WebhookEvent.updateOne({ eventId }, { status, processedAt: new Date() });
    return { processed: status === 'processed' };
  } catch (err) {
    // Allow Razorpay to retry
    await WebhookEvent.deleteOne({ eventId });
    throw err;
  }
}

async function processEvent(event) {
  const paymentEntity = event.payload?.payment?.entity;
  const refundEntity = event.payload?.refund?.entity;

  switch (event.event) {
    case 'payment.captured':
    case 'order.paid': {
      if (!paymentEntity?.order_id) return 'ignored';
      const payment = await Payment.findOne({ gatewayOrderId: paymentEntity.order_id });
      if (!payment) return 'ignored';
      await markCaptured(
        payment._id,
        { paymentId: paymentEntity.id, amount: Number(paymentEntity.amount), fee: paymentEntity.fee || 0, tax: paymentEntity.tax || 0, method: paymentEntity.method },
        'webhook'
      );
      return 'processed';
    }
    case 'payment.failed': {
      if (!paymentEntity?.order_id) return 'ignored';
      const payment = await Payment.findOne({ gatewayOrderId: paymentEntity.order_id });
      if (!payment) return 'ignored';
      await markFailed(payment._id, paymentEntity.error_description || 'Payment failed');
      return 'processed';
    }
    case 'refund.processed': {
      const payment = await Payment.findOne({ gatewayPaymentId: refundEntity?.payment_id });
      if (!payment) return 'ignored';
      await applyRefund(payment._id, { refundId: refundEntity.id, amount: Number(refundEntity.amount) });
      return 'processed';
    }
    case 'refund.failed': {
      const payment = await Payment.findOne({ gatewayPaymentId: refundEntity?.payment_id });
      if (!payment) return 'ignored';
      const entry = payment.refunds.find((r) => r.refundId === refundEntity.id);
      if (entry && entry.status !== 'processed') {
        entry.status = 'failed';
        payment.refundStatus = deriveRefundStatus(payment);
        await payment.save();
      }
      return 'processed';
    }
    case 'payment.dispute.lost': {
      const paymentId = event.payload?.dispute?.entity?.payment_id;
      const payment = paymentId && (await Payment.findOne({ gatewayPaymentId: paymentId }));
      if (!payment) return 'ignored';
      await reverseForPayment(payment._id, 'Payment dispute lost');
      return 'processed';
    }
    default:
      return 'ignored';
  }
}

module.exports = {
  paymentConfig,
  createOrder,
  verifyCheckout,
  mockComplete,
  markCaptured,
  markFailed,
  refundPayment,
  applyRefund,
  handleWebhook,
};
