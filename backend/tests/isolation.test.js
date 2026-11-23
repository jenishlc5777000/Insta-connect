const h = require('./helpers');

beforeAll(h.connect);
afterAll(h.disconnect);

describe('Influencer data isolation & admin authorization', () => {
  let admin;
  let arun;
  let priya;
  let workshop;
  let arunLeadId;
  let priyaLeadId;

  beforeAll(async () => {
    await h.reset();
    ({ agent: admin } = await h.createAdmin());
    arun = await h.createInfluencer(admin, { subdomain: 'arun' });
    priya = await h.createInfluencer(admin, { subdomain: 'priya' });
    workshop = await h.createWorkshop(admin);
    arunLeadId = (await h.agent('arun.jencorps.test').post('/api/v1/leads/register').send(h.leadBody(workshop._id, { name: 'Arun Lead', email: 'arunlead@example.com' }))).body.data.lead._id;
    priyaLeadId = (await h.agent('priya.jencorps.test').post('/api/v1/leads/register').send(h.leadBody(workshop._id, { name: 'Priya Lead' }))).body.data.lead._id;
  });

  it('lists only the authenticated influencer\'s leads, even if another id is passed as a filter', async () => {
    const res = await arun.agent.get(`/api/v1/influencers/me/leads?influencerId=${priya.influencer._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l._id)).toEqual([arunLeadId]);
  });

  it('returns 404 when an influencer requests another influencer\'s lead by id', async () => {
    const res = await arun.agent.get(`/api/v1/influencers/me/leads/${priyaLeadId}`);
    expect(res.status).toBe(404);
    const own = await arun.agent.get(`/api/v1/influencers/me/leads/${arunLeadId}`);
    expect(own.status).toBe(200);
  });

  it('masks lead contact details for influencers', async () => {
    const res = await arun.agent.get(`/api/v1/influencers/me/leads/${arunLeadId}`);
    expect(res.body.data.email).not.toBe('arunlead@example.com');
    expect(res.body.data.email).toMatch(/\*/);
    expect(res.body.data.phone).toMatch(/^\*+\d{4}$/);
  });

  it('blocks influencers from admin endpoints and other influencers\' records', async () => {
    const paths = [
      `/api/v1/influencers/${priya.influencer._id}`,
      `/api/v1/influencers/${priya.influencer._id}/leads`,
      `/api/v1/leads/${priyaLeadId}`,
      '/api/v1/leads',
      '/api/v1/payments',
      '/api/v1/commissions',
      '/api/v1/payouts',
      '/api/v1/reports/influencers',
      '/api/v1/admin/settings',
      '/api/v1/analytics/admin/overview',
    ];
    for (const p of paths) {
      const res = await arun.agent.get(p);
      expect([p, res.status]).toEqual([p, 403]);
    }
    const create = await arun.agent.post('/api/v1/influencers').send({ name: 'X', email: 'x@x.com', subdomain: 'xxx' });
    expect(create.status).toBe(403);
    const patch = await arun.agent.patch(`/api/v1/leads/${priyaLeadId}/attribution`).send({ influencerId: String(arun.influencer._id), reason: 'steal it' });
    expect(patch.status).toBe(403);
  });

  it('keeps payout details private', async () => {
    await priya.agent.put('/api/v1/influencers/me/payout-details').send({ method: 'bank', accountHolderName: 'Priya', ifsc: 'HDFC0001234', accountNumber: '123456789012' });
    const self = await priya.agent.get('/api/v1/influencers/me');
    expect(self.body.data.payoutDetails.accountNumber).toBe('XXXX9012');
    const raw = await h.models.Influencer.findById(priya.influencer._id).select('+payoutDetails.accountNumberEnc');
    expect(raw.payoutDetails.accountNumberEnc).not.toContain('123456789012');
    const asAdmin = await admin.get(`/api/v1/influencers/${priya.influencer._id}`);
    expect(asAdmin.body.data.payoutDetails.accountNumber).toBe('123456789012');
  });

  it('scopes dashboard summaries to the influencer', async () => {
    const res = await arun.agent.get('/api/v1/influencers/me/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.summary.leads).toBe(1);
    expect(res.body.data.commissionRate).toBe(50);
    expect(res.body.data.trends.registrations).toBeNull(); // no previous-period data => "New"
    expect(res.body.data.summary.commission.thisMonth).toBe(0);
    const scoped = await arun.agent.get(`/api/v1/influencers/me/summary?workshopId=${workshop._id}`);
    expect(scoped.body.data.summary.leads).toBe(1);
  });

  it('separates successful (paid) registrations from pending-payment ones', async () => {
    // both leads start unpaid
    let res = await admin.get('/api/v1/analytics/admin/overview');
    expect(res.body.data.summary.successfulRegistrations).toBe(0);
    expect(res.body.data.summary.pendingPaymentRegistrations).toBe(2);
    expect(res.body.data.byInfluencer.total).toBe(0); // donut counts successful only

    // Arun's lead pays
    await h.models.Lead.updateOne({ _id: arunLeadId }, { paymentStatus: 'paid', registrationStatus: 'confirmed' });
    res = await admin.get('/api/v1/analytics/admin/overview');
    expect(res.body.data.summary.successfulRegistrations).toBe(1);
    expect(res.body.data.summary.pendingPaymentRegistrations).toBe(1);
    const { total, items } = res.body.data.byInfluencer;
    expect(total).toBe(1);
    expect(items.map((i) => i.share).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(res.body.data.trends).toHaveProperty('successful');

    // each influencer only sees their own split
    const a = (await arun.agent.get('/api/v1/influencers/me/summary')).body.data.summary;
    const p = (await priya.agent.get('/api/v1/influencers/me/summary')).body.data.summary;
    expect([a.successfulRegistrations, a.pendingPaymentRegistrations]).toEqual([1, 0]);
    expect([p.successfulRegistrations, p.pendingPaymentRegistrations]).toEqual([0, 1]);

    await h.models.Lead.updateOne({ _id: arunLeadId }, { paymentStatus: 'pending', registrationStatus: 'registered' });
  });

  it('requires authentication and the admin role', async () => {
    expect((await h.agent().get('/api/v1/leads')).status).toBe(401);
    const customer = h.agent();
    await customer.post('/api/v1/auth/register').send({ name: 'Cust', email: 'cust@example.com', password: 'Secret123' });
    await customer.post('/api/v1/auth/login').send({ email: 'cust@example.com', password: 'Secret123' });
    expect((await customer.get('/api/v1/leads')).status).toBe(403);
    expect((await customer.get('/api/v1/influencers/me/leads')).status).toBe(403);
    expect((await admin.get('/api/v1/leads')).status).toBe(200);
  });

  it('revokes access when an influencer is deactivated', async () => {
    await admin.patch(`/api/v1/influencers/${priya.influencer._id}/status`).send({ status: 'inactive' });
    const res = await priya.agent.get('/api/v1/influencers/me');
    expect(res.status).toBe(403);
    await admin.patch(`/api/v1/influencers/${priya.influencer._id}/status`).send({ status: 'active' });
  });

  it('validates influencer creation (reserved & duplicate subdomains)', async () => {
    expect((await admin.post('/api/v1/influencers').send({ name: 'Www', email: 'w@example.com', subdomain: 'www' })).status).toBe(400);
    expect((await admin.post('/api/v1/influencers').send({ name: 'Dup', email: 'd@example.com', subdomain: 'arun' })).status).toBe(409);
    expect((await admin.post('/api/v1/influencers').send({ name: 'Bad', email: 'b@example.com', subdomain: 'Bad_Name!' })).status).toBe(400);
    const okRes = await admin.post('/api/v1/influencers').send({ name: 'New One', email: 'new@example.com', subdomain: 'newone', sendWelcomeEmail: false });
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.influencer.influencerCode).toMatch(/^INF-10\d\d$/);
    expect(okRes.body.data.tempPassword).toBeTruthy();
  });
});
