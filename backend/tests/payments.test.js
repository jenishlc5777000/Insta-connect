const crypto = require('crypto');

// Razorpay SDK is replaced with an in-memory fake (no network calls in tests)
const mockGateway = { payments: new Map(), refundStatus: 'processed' };
jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn(async (o) => ({ id: `order_${require('crypto').randomBytes(6).toString('hex')}`, amount: o.amount })) },
    payments: {
      fetch: jest.fn(async (id) => mockGateway.payments.get(id)),
      capture: jest.fn(async (id) => ({ ...mockGateway.payments.get(id), status: 'captured' })),
      refund: jest.fn(async (_id, { amount }) => ({ id: `rfnd_${require('crypto').randomBytes(5).toString('hex')}`, amount, status: mockGateway.refundStatus })),
    },
  }))
);

const h = require('./helpers');

beforeAll(h.connect);
afterAll(h.disconnect);

const SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

describe('Payments & commissions', () => {
  let admin;
  let inf;
  let workshop;

  beforeEach(async () => {
    await h.reset();
    mockGateway.refundStatus = 'processed';
    ({ agent: admin } = await h.createAdmin());
    inf = (await h.createInfluencer(admin, { subdomain: 'arun' })).influencer;
    workshop = await h.createWorkshop(admin, { price: 250000, discountPrice: 200000 });
  });

  async function registerAndOrder(host = 'arun.jencorps.test') {
    const visitor = h.agent(host);
    const reg = await visitor.post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const { lead, accessToken } = reg.body.data;
    const order = await visitor.post('/api/v1/payments/order').send({ leadId: lead._id, accessToken });
    return { visitor, lead, accessToken, order };
  }

  function gatewayPays(orderId, amount) {
    const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
    mockGateway.payments.set(paymentId, { id: paymentId, order_id: orderId, amount, status: 'captured', fee: 4720, tax: 720, method: 'upi' });
    return { paymentId, signature: h.sign(`${orderId}|${paymentId}`, SECRET) };
  }

  it('creates orders with the price from the database, not the client', async () => {
    const visitor = h.agent();
    const reg = await visitor.post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const order = await visitor.post('/api/v1/payments/order').send({ leadId: reg.body.data.lead._id, accessToken: reg.body.data.accessToken, amount: 1 });
    expect(order.status).toBe(201);
    expect(order.body.data.amount).toBe(200000); // discount price
    expect(order.body.data.keyId).toBe('rzp_test_key');
    expect(JSON.stringify(order.body)).not.toContain(SECRET);
  });

  it('refuses to create an order without the lead access token', async () => {
    const reg = await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const order = await h.agent().post('/api/v1/payments/order').send({ leadId: reg.body.data.lead._id });
    expect(order.status).toBe(404);
  });

  it('rejects an invalid checkout signature', async () => {
    const { visitor, order } = await registerAndOrder();
    const { paymentId } = gatewayPays(order.body.data.orderId, 200000);
    const res = await visitor.post('/api/v1/payments/verify').send({ razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId, razorpay_signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect(await h.models.Commission.countDocuments()).toBe(0);
  });

  it('verifies payment, confirms the lead and creates exactly one 50% commission', async () => {
    const { visitor, lead, order } = await registerAndOrder();
    const { orderId } = order.body.data;
    const { paymentId, signature } = gatewayPays(orderId, 200000);
    const body = { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };

    const res = await visitor.post('/api/v1/payments/verify').send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('paid');
    await visitor.post('/api/v1/payments/verify').send(body); // replay

    const dbLead = await h.models.Lead.findById(lead._id);
    expect(dbLead.paymentStatus).toBe('paid');
    expect(dbLead.registrationStatus).toBe('confirmed');
    const commissions = await h.models.Commission.find();
    expect(commissions).toHaveLength(1);
    expect(commissions[0].commissionAmount).toBe(100000);
    expect(commissions[0].commissionRate).toBe(50);
    expect(String(commissions[0].influencerId)).toBe(String(inf._id));
    expect(commissions[0].status).toBe('pending');
    const payment = await h.models.Payment.findOne({ gatewayOrderId: orderId });
    expect(payment.gatewayFee).toBe(4720);
  });

  it('rejects a payment whose amount differs from the order', async () => {
    const { visitor, order } = await registerAndOrder();
    const { orderId } = order.body.data;
    const { paymentId, signature } = gatewayPays(orderId, 100);
    const res = await visitor.post('/api/v1/payments/verify').send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
    expect(res.status).toBe(400);
  });

  describe('webhooks', () => {
    const send = (payload, { eventId = crypto.randomBytes(8).toString('hex'), secret = WEBHOOK_SECRET } = {}) => {
      const raw = JSON.stringify(payload);
      return h
        .agent()
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', h.sign(raw, secret))
        .set('x-razorpay-event-id', eventId)
        .send(raw);
    };

    it('rejects webhooks with an invalid signature', async () => {
      const res = await send({ event: 'payment.captured', payload: {} }, { secret: 'wrong' });
      expect(res.status).toBe(400);
    });

    it('confirms payment via webhook and ignores duplicate deliveries', async () => {
      const { lead, order } = await registerAndOrder();
      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_wh1', order_id: order.body.data.orderId, amount: 200000, fee: 4720, tax: 720, method: 'card' } } },
      };
      const first = await send(payload, { eventId: 'evt_1' });
      expect(first.status).toBe(200);
      const dup = await send(payload, { eventId: 'evt_1' });
      expect(dup.body.data.duplicate).toBe(true);
      const second = await send({ ...payload, event: 'order.paid' }, { eventId: 'evt_2' }); // different event, same payment
      expect(second.status).toBe(200);

      expect((await h.models.Lead.findById(lead._id)).paymentStatus).toBe('paid');
      expect(await h.models.Commission.countDocuments()).toBe(1);
    });

    it('marks failed payments', async () => {
      const { lead, order } = await registerAndOrder();
      await send({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: order.body.data.orderId, error_description: 'Card declined' } } } });
      expect((await h.models.Lead.findById(lead._id)).paymentStatus).toBe('failed');
      expect((await h.models.Payment.findOne({ gatewayOrderId: order.body.data.orderId })).failureReason).toBe('Card declined');
    });

    it('applies refunds created in the Razorpay dashboard', async () => {
      const { order } = await registerAndOrder();
      await send({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_r', order_id: order.body.data.orderId, amount: 200000 } } } });
      await send({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_x', payment_id: 'pay_r', amount: 200000 } } } });
      await send({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_x', payment_id: 'pay_r', amount: 200000 } } } });
      const c = await h.models.Commission.findOne();
      expect(c.status).toBe('reversed');
      const p = await h.models.Payment.findOne({ gatewayPaymentId: 'pay_r' });
      expect(p.refundedAmount).toBe(200000);
      expect(p.refundStatus).toBe('full');
    });
  });

  describe('refund commission reversal', () => {
    async function paid() {
      const { visitor, lead, order } = await registerAndOrder();
      const { paymentId, signature } = gatewayPays(order.body.data.orderId, 200000);
      await visitor.post('/api/v1/payments/verify').send({ razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
      const payment = await h.models.Payment.findOne({ gatewayOrderId: order.body.data.orderId });
      return { lead, payment };
    }

    it('reverses the commission on a full refund and cancels the registration', async () => {
      const { lead, payment } = await paid();
      const res = await admin.post(`/api/v1/payments/${payment._id}/refund`).send({ reason: 'Customer request' });
      expect(res.status).toBe(200);
      const c = await h.models.Commission.findOne({ paymentId: payment._id });
      expect(c.status).toBe('reversed');
      const l = await h.models.Lead.findById(lead._id);
      expect(l.paymentStatus).toBe('refunded');
      expect(l.registrationStatus).toBe('cancelled');
    });

    it('adjusts the commission on a partial refund', async () => {
      const { payment } = await paid();
      await admin.post(`/api/v1/payments/${payment._id}/refund`).send({ amount: 50000, reason: 'Partial goodwill refund' });
      const c = await h.models.Commission.findOne({ paymentId: payment._id });
      expect(c.status).toBe('pending');
      expect(c.commissionAmount).toBe(75000);
      const over = await admin.post(`/api/v1/payments/${payment._id}/refund`).send({ amount: 200000, reason: 'too much' });
      expect(over.status).toBe(400);
    });

    it('records a clawback when a paid-out commission is refunded', async () => {
      const { payment } = await paid();
      const c = await h.models.Commission.findOne({ paymentId: payment._id });
      await admin.patch(`/api/v1/commissions/${c._id}/approve`);
      const payout = await admin.post('/api/v1/payouts').send({ influencerId: String(inf._id), commissionIds: [String(c._id)], paymentMethod: 'upi', transactionId: 'UTR123', markPaid: true });
      expect(payout.status).toBe(201);
      expect((await h.models.Commission.findById(c._id)).status).toBe('paid');

      await admin.post(`/api/v1/payments/${payment._id}/refund`).send({ reason: 'Event cancelled' });
      const after = await h.models.Commission.findById(c._id);
      expect(after.status).toBe('reversed');
      expect(after.clawbackAmount).toBe(100000);
    });

    it('waits for the gateway when the refund is still pending', async () => {
      mockGateway.refundStatus = 'pending';
      const { payment } = await paid();
      await admin.post(`/api/v1/payments/${payment._id}/refund`).send({ reason: 'Pending refund' });
      expect((await h.models.Commission.findOne({ paymentId: payment._id })).status).toBe('pending');
      expect((await h.models.Payment.findById(payment._id)).refundStatus).toBe('pending');
    });
  });

  describe('per-influencer commission rate', () => {
    async function paidLead() {
      const { visitor, order } = await registerAndOrder();
      const { paymentId, signature } = gatewayPays(order.body.data.orderId, 200000);
      await visitor.post('/api/v1/payments/verify').send({ razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
      return h.models.Commission.findOne({ paymentId: (await h.models.Payment.findOne({ gatewayOrderId: order.body.data.orderId }))._id });
    }

    it('uses the new rate for new sales and optionally re-prices only pending commissions', async () => {
      const approved = await paidLead();
      await admin.patch(`/api/v1/commissions/${approved._id}/approve`);
      const pending = await paidLead();
      expect(pending.commissionAmount).toBe(100000); // 50% default

      const res = await admin.patch(`/api/v1/influencers/${inf._id}`).send({ commissionRate: 30, applyToPendingCommissions: true });
      expect(res.status).toBe(200);
      expect(res.body.data.commissionRate).toBe(30);
      expect(res.body.data.pendingRecalculated).toBe(1);

      expect((await h.models.Commission.findById(pending._id)).commissionAmount).toBe(60000);
      expect((await h.models.Commission.findById(approved._id)).commissionAmount).toBe(100000); // untouched

      const next = await paidLead();
      expect(next.commissionRate).toBe(30);
      expect(next.commissionAmount).toBe(60000);

      const log = await h.models.AuditLog.findOne({ action: 'influencer.update', entityId: inf._id });
      expect(log.previousValue.commissionRate).toBeNull();
      expect(log.newValue.commissionRate).toBe(30);
    });

    it('leaves pending commissions alone unless asked, and validates the range', async () => {
      const pending = await paidLead();
      await admin.patch(`/api/v1/influencers/${inf._id}`).send({ commissionRate: 25 });
      expect((await h.models.Commission.findById(pending._id)).commissionAmount).toBe(100000);
      expect((await admin.patch(`/api/v1/influencers/${inf._id}`).send({ commissionRate: 120 })).status).toBe(400);
      // back to the default (null)
      const reset = await admin.patch(`/api/v1/influencers/${inf._id}`).send({ commissionRate: null, applyToPendingCommissions: true });
      expect(reset.body.data.commissionRate).toBeNull();
    });
  });

  describe('commission workflow', () => {
    it('approves, pays out and prevents double payouts', async () => {
      const { visitor, order } = await registerAndOrder();
      const { paymentId, signature } = gatewayPays(order.body.data.orderId, 200000);
      await visitor.post('/api/v1/payments/verify').send({ razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
      const c = await h.models.Commission.findOne();

      const notApproved = await admin.post('/api/v1/payouts').send({ influencerId: String(inf._id), commissionIds: [String(c._id)], paymentMethod: 'upi' });
      expect(notApproved.status).toBe(400);

      expect((await admin.patch(`/api/v1/commissions/${c._id}/approve`)).status).toBe(200);
      const p1 = await admin.post('/api/v1/payouts').send({ influencerId: String(inf._id), commissionIds: [String(c._id)], paymentMethod: 'upi' });
      expect(p1.status).toBe(201);
      const p2 = await admin.post('/api/v1/payouts').send({ influencerId: String(inf._id), commissionIds: [String(c._id)], paymentMethod: 'upi' });
      expect(p2.status).toBe(400);

      const paidRes = await admin.patch(`/api/v1/payouts/${p1.body.data._id}/mark-paid`).send({ transactionId: 'UTR999' });
      expect(paidRes.status).toBe(200);
      const after = await h.models.Commission.findById(c._id);
      expect(after.status).toBe('paid');
      expect(String(after.payoutId)).toBe(p1.body.data._id);
    });
  });
});
