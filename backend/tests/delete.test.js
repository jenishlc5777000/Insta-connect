const h = require('./helpers');

beforeAll(h.connect);
afterAll(h.disconnect);

describe('Admin delete', () => {
  let admin;
  let workshop;
  let inf;

  beforeEach(async () => {
    await h.reset();
    ({ agent: admin } = await h.createAdmin());
    inf = await h.createInfluencer(admin, { subdomain: 'arun' });
    workshop = await h.createWorkshop(admin);
  });

  const register = async (extra) => (await h.agent('arun.jencorps.test').post('/api/v1/leads/register').send(h.leadBody(workshop._id, extra))).body.data.lead._id;
  const capture = (leadId, refundStatus = 'none') =>
    h.models.Payment.create({ leadId, workshopId: workshop._id, influencerId: inf.influencer._id, amount: 200000, gateway: 'razorpay', gatewayOrderId: `order_${leadId}`, status: 'captured', refundStatus });

  it('deletes an unpaid lead with its unpaid order, and audit-logs it', async () => {
    const id = await register();
    await h.models.Payment.create({ leadId: id, workshopId: workshop._id, amount: 200000, gateway: 'razorpay', gatewayOrderId: 'order_unpaid', status: 'created' });
    const res = await admin.delete(`/api/v1/leads/${id}`);
    expect(res.status).toBe(200);
    expect(await h.models.Lead.exists({ _id: id })).toBeNull();
    expect(await h.models.Payment.countDocuments({ leadId: id })).toBe(0);
    expect(await h.models.AuditLog.exists({ action: 'lead.delete', entityId: id })).toBeTruthy();
  });

  it('refuses to delete a lead with a successful payment, but allows it once fully refunded', async () => {
    const id = await register();
    const p = await capture(id);
    const blocked = await admin.delete(`/api/v1/leads/${id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/Refund/);
    expect(await h.models.Lead.exists({ _id: id })).toBeTruthy();

    await h.models.Payment.updateOne({ _id: p._id }, { refundStatus: 'full', refundedAmount: 200000 });
    expect((await admin.delete(`/api/v1/leads/${id}`)).status).toBe(200);
  });

  it('bulk-deletes selected leads and reports the ones it skipped', async () => {
    const a = await register();
    const b = await register();
    const paid = await register();
    await capture(paid);
    const res = await admin.post('/api/v1/leads/delete').send({ leadIds: [a, b, paid] });
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(2);
    expect(res.body.data.blocked).toHaveLength(1);
    expect(await h.models.Lead.countDocuments()).toBe(1);
  });

  it('protects influencers who earned commission; deletes others and detaches their leads', async () => {
    const leadId = await register();
    await h.models.Commission.create({ influencerId: inf.influencer._id, leadId, workshopId: workshop._id, paymentId: (await capture(leadId))._id, grossAmount: 200000, eligibleNetRevenue: 200000, commissionRate: 50, commissionAmount: 100000 });
    const blocked = await admin.delete(`/api/v1/influencers/${inf.influencer._id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/Deactivate/);

    const other = await h.createInfluencer(admin, { subdomain: 'priya' });
    const otherLead = (await h.agent('priya.jencorps.test').post('/api/v1/leads/register').send(h.leadBody(workshop._id))).body.data.lead._id;
    const res = await admin.delete(`/api/v1/influencers/${other.influencer._id}`);
    expect(res.status).toBe(200);
    expect(await h.models.Influencer.exists({ _id: other.influencer._id })).toBeNull();
    expect(await h.models.User.exists({ email: other.email })).toBeNull();
    const lead = await h.models.Lead.findById(otherLead);
    expect(lead.influencerId).toBeNull();
    expect(lead.attributionMethod).toBe('none');
    // the deleted influencer can no longer log in
    expect((await h.agent().post('/api/v1/auth/login').send({ email: other.email, password: 'Influencer@123', portal: 'influencer' })).status).toBe(401);
  });

  it('deletes influencer applications', async () => {
    const app = await h.models.InfluencerApplication.create({ name: 'Applicant', email: 'app@example.com', phone: '9000000000', instagramUsername: 'applicant', followers: 1000, avgViews: { instagram: 1000 } });
    expect((await admin.delete(`/api/v1/influencer-applications/${app._id}`)).status).toBe(200);
    expect(await h.models.InfluencerApplication.exists({ _id: app._id })).toBeNull();
  });

  it('only admins can delete', async () => {
    const id = await register();
    expect((await inf.agent.delete(`/api/v1/leads/${id}`)).status).toBe(403);
    expect((await h.agent().delete(`/api/v1/leads/${id}`)).status).toBe(401);
    expect((await inf.agent.delete(`/api/v1/influencers/${inf.influencer._id}`)).status).toBe(403);
  });
});
