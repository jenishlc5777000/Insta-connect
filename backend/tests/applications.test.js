const h = require('./helpers');
const emailService = require('../src/services/emailService');

beforeAll(h.connect);
afterAll(h.disconnect);
afterEach(() => jest.restoreAllMocks());

const body = (extra = {}) => ({
  name: 'Meera Nair',
  email: 'meera@example.com',
  phone: '9876501234',
  instagramUsername: '@Meera.Creates',
  followers: 25000,
  avgViews: { instagram: 10000, youtube: 5000, facebook: null },
  youtubeChannel: 'https://youtube.com/@meera',
  niche: 'Tech & AI',
  city: 'Kochi',
  preferredSubdomain: 'meera',
  message: 'I teach AI tools to students.',
  password: 'MyOwnPass123',
  consent: true,
  ...extra,
});

describe('Join as an Instagram influencer (instant, auto-approved signup)', () => {
  let admin;
  beforeEach(async () => {
    await h.reset();
    ({ agent: admin } = await h.createAdmin());
  });

  it('creates the influencer account with their own password and logs them straight in', async () => {
    const spy = jest.spyOn(emailService, 'sendTemplate');
    const a = h.agent();
    const res = await a.post('/api/v1/influencer-applications').send(body());
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('influencer');
    expect(res.body.data.user.mustChangePassword).toBe(false);
    expect(res.body.data.influencer.subdomain).toBe('meera');
    expect(res.headers['set-cookie'].join(';')).toMatch(/jc_at=.*HttpOnly/);

    // already logged in: dashboard data is available immediately
    const me = await a.get('/api/v1/influencers/me');
    expect(me.status).toBe(200);
    expect(me.body.data.instagramUsername).toBe('meera.creates');
    expect(me.body.data.audience).toMatchObject({ followers: 25000, avgViews: { instagram: 10000, youtube: 5000 } });

    // and can log in later with the password they chose
    const login = await h.agent().post('/api/v1/auth/login').send({ email: 'meera@example.com', password: 'MyOwnPass123', portal: 'influencer' });
    expect(login.status).toBe(200);

    const app = await h.models.InfluencerApplication.findOne({ email: 'meera@example.com' });
    expect(app.status).toBe('approved');
    expect(String(app.influencerId)).toBe(String(me.body.data._id));
    const welcome = spy.mock.calls.find((c) => c[0] === 'influencerWelcome');
    expect(welcome[2].tempPassword).toBeUndefined(); // never email their chosen password
  });

  it('validates input, including a strong password', async () => {
    const res = await h.agent().post('/api/v1/influencer-applications').send({ name: 'x', email: 'bad', phone: '1', instagramUsername: '!!', followers: -5, password: 'short', consent: false });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'instagramUsername', 'followers', 'avgViews', 'password', 'consent']));
    const noIg = await h.agent().post('/api/v1/influencer-applications').send(body({ avgViews: { youtube: 5000 } }));
    expect(noIg.body.error.details.map((d) => d.field)).toContain('avgViews.instagram');
  });

  it('prevents duplicate accounts, handles and taken subdomains', async () => {
    expect((await h.agent().post('/api/v1/influencer-applications').send(body())).status).toBe(201);
    expect((await h.agent().post('/api/v1/influencer-applications').send(body({ preferredSubdomain: 'meera2' }))).status).toBe(409); // email
    expect((await h.agent().post('/api/v1/influencer-applications').send(body({ email: 'b@example.com', phone: '9876500000', preferredSubdomain: 'meera3' }))).status).toBe(409); // instagram
    expect((await h.agent().post('/api/v1/influencer-applications').send(body({ email: 'c@example.com', instagramUsername: 'other', preferredSubdomain: 'meera' }))).status).toBe(400); // subdomain
    const check = await h.agent().get('/api/v1/influencer-applications/subdomain-available?subdomain=meera');
    expect(check.body.data.available).toBe(false);
  });

  it('picks a free link name when none was requested', async () => {
    const res = await h.agent().post('/api/v1/influencer-applications').send(body({ preferredSubdomain: '' }));
    expect(res.body.data.influencer.subdomain).toBe('meera-creates');
  });

  it('admins see auto-approved signups and can still review legacy pending applications', async () => {
    await h.agent().post('/api/v1/influencer-applications').send(body());
    const list = await admin.get('/api/v1/influencer-applications?status=approved');
    expect(list.body.data).toHaveLength(1);

    const pending = await h.models.InfluencerApplication.create({ name: 'Old Applicant', email: 'old@example.com', phone: '9000000001', instagramUsername: 'old.applicant', followers: 1000, avgViews: { instagram: 1000 } });
    const approved = await admin.post(`/api/v1/influencer-applications/${pending._id}/approve`).send({ subdomain: 'oldapplicant', sendWelcomeEmail: false });
    expect(approved.status).toBe(200);
    expect(approved.body.data.tempPassword).toBeTruthy();

    const pending2 = await h.models.InfluencerApplication.create({ name: 'Another', email: 'another@example.com', phone: '9000000002', instagramUsername: 'another', followers: 1000, avgViews: { instagram: 1000 } });
    expect((await admin.post(`/api/v1/influencer-applications/${pending2._id}/reject`).send({ reason: 'Not a fit' })).status).toBe(200);
  });
});
