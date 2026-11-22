const h = require('./helpers');

beforeAll(h.connect);
afterAll(h.disconnect);

describe('Lead creation & duplicate prevention', () => {
  let admin;
  let workshop;

  beforeEach(async () => {
    await h.reset();
    ({ agent: admin } = await h.createAdmin());
    workshop = await h.createWorkshop(admin);
  });

  it('creates a lead with captured metadata and returns an access token', async () => {
    const res = await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id, { utm: { source: 'instagram', medium: 'story', campaign: 'launch', content: 'v1' }, mode: 'online', referralSource: 'Instagram' }));
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toHaveLength(48);
    expect(res.body.data.requiresPayment).toBe(true);
    expect(res.body.data.amount).toBe(200000);
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(lead).toMatchObject({ utmSource: 'instagram', utmMedium: 'story', utmCampaign: 'launch', utmContent: 'v1', paymentStatus: 'pending', registrationStatus: 'registered' });
    expect(lead.consentAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email in the same workshop', async () => {
    const body = h.leadBody(workshop._id, { email: 'dup@example.com' });
    await h.agent().post('/api/v1/leads/register').send(body);
    const res = await h.agent().post('/api/v1/leads/register').send({ ...body, phone: '9000000001', email: 'DUP@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/email/i);
  });

  it('rejects a duplicate phone number written in a different format', async () => {
    await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id, { phone: '9876543210' }));
    const res = await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id, { phone: '+91 98765-43210' }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/phone/i);
  });

  it('enforces uniqueness at the database level too', async () => {
    const body = h.leadBody(workshop._id, { email: 'race@example.com', phone: '9123456780' });
    const results = await Promise.all([1, 2, 3].map(() => h.agent().post('/api/v1/leads/register').send(body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await h.models.Lead.countDocuments({ email: 'race@example.com' })).toBe(1);
  });

  it('allows an existing lead to register for another workshop', async () => {
    const other = await h.createWorkshop(admin);
    const body = h.leadBody(workshop._id, { email: 'multi@example.com', phone: '9111111111' });
    expect((await h.agent().post('/api/v1/leads/register').send(body)).status).toBe(201);
    expect((await h.agent().post('/api/v1/leads/register').send({ ...body, workshopId: other._id })).status).toBe(201);
  });

  it('validates input', async () => {
    const res = await h.agent().post('/api/v1/leads/register').send({ name: 'x', email: 'bad', phone: '12', workshopId: workshop._id, consent: false });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'consent']));
  });

  it('refuses draft, past-deadline and sold-out workshops', async () => {
    const draft = await h.createWorkshop(admin, { status: 'draft' });
    expect((await h.agent().post('/api/v1/leads/register').send(h.leadBody(draft._id))).status).toBe(404);

    const closed = await h.createWorkshop(admin, { registrationDeadline: new Date(Date.now() - 864e5).toISOString() });
    expect((await h.agent().post('/api/v1/leads/register').send(h.leadBody(closed._id))).status).toBe(400);

    const free = await h.createWorkshop(admin, { price: 0, capacity: 1 });
    expect((await h.agent().post('/api/v1/leads/register').send(h.leadBody(free._id))).status).toBe(201);
    expect((await h.agent().post('/api/v1/leads/register').send(h.leadBody(free._id))).status).toBe(409);
  });

  it('confirms free workshops without payment', async () => {
    const free = await h.createWorkshop(admin, { price: 0 });
    const res = await h.agent().post('/api/v1/leads/register').send(h.leadBody(free._id));
    expect(res.body.data.requiresPayment).toBe(false);
    expect(res.body.data.lead.paymentStatus).toBe('not_required');
    expect(res.body.data.lead.registrationStatus).toBe('confirmed');
  });

  it('exposes registration status only with the access token', async () => {
    const res = await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const { lead, accessToken } = res.body.data;
    expect((await h.agent().get(`/api/v1/leads/status/${lead._id}`)).status).toBe(404);
    expect((await h.agent().get(`/api/v1/leads/status/${lead._id}?token=wrong`)).status).toBe(404);
    const ok = await h.agent().get(`/api/v1/leads/status/${lead._id}?token=${accessToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.workshop.meetingLink).toBeUndefined();
  });

  it('admin can search, filter and export leads', async () => {
    await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id, { name: 'Findable Person' }));
    await h.agent().post('/api/v1/leads/register').send(h.leadBody(workshop._id, { name: 'Another One' }));
    const search = await admin.get('/api/v1/leads?search=findable');
    expect(search.body.data).toHaveLength(1);
    expect(search.body.meta.total).toBe(1);
    const filtered = await admin.get(`/api/v1/leads?workshopId=${workshop._id}&paymentStatus=pending&sort=-createdAt&page=1&limit=1`);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.meta.pages).toBe(2);
    const csv = await admin.get('/api/v1/leads/export?format=csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toMatch(/Findable Person/);
  });
});
