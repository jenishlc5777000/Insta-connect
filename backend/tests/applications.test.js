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
  consent: true,
  ...extra,
});

describe('Join as an Instagram influencer', () => {
  let admin;
  beforeEach(async () => {
    await h.reset();
    ({ agent: admin } = await h.createAdmin());
  });

  it('accepts a public application, normalises the handle and emails the applicant', async () => {
    const spy = jest.spyOn(emailService, 'sendTemplate');
    const res = await h.agent().post('/api/v1/influencer-applications').send(body());
    expect(res.status).toBe(201);
    const app = await h.models.InfluencerApplication.findById(res.body.data._id);
    expect(app.instagramUsername).toBe('meera.creates');
    expect(app.status).toBe('pending');
    expect(spy).toHaveBeenCalledWith('applicationReceived', 'meera@example.com', expect.any(Object));
  });

  it('validates input and requires consent', async () => {
    const res = await h.agent().post('/api/v1/influencer-applications').send({ name: 'x', email: 'bad', phone: '1', instagramUsername: '!!', followers: -5, consent: false });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'instagramUsername', 'followers', 'avgViews', 'consent']));
  });

  it('requires average Instagram Reel views; other channels are optional', async () => {
    const noIg = await h.agent().post('/api/v1/influencer-applications').send(body({ avgViews: { youtube: 5000 } }));
    expect(noIg.status).toBe(400);
    expect(noIg.body.error.details.map((d) => d.field)).toContain('avgViews.instagram');
    const igOnly = await h.agent().post('/api/v1/influencer-applications').send(body({ avgViews: { instagram: 1000 }, youtubeChannel: '' }));
    expect(igOnly.status).toBe(201);
    const app = await h.models.InfluencerApplication.findById(igOnly.body.data._id);
    expect(app.avgViews.instagram).toBe(1000);
    expect(app.avgViews.youtube).toBeNull();
  });

  it('prevents duplicate pending applications and taken subdomains', async () => {
    await h.agent().post('/api/v1/influencer-applications').send(body());
    expect((await h.agent().post('/api/v1/influencer-applications').send(body({ preferredSubdomain: 'meera2' }))).status).toBe(409);
    expect((await h.agent().post('/api/v1/influencer-applications').send(body({ email: 'other@example.com', instagramUsername: 'other', preferredSubdomain: 'meera' }))).status).toBe(400);
    const check = await h.agent().get('/api/v1/influencer-applications/subdomain-available?subdomain=meera');
    expect(check.body.data.available).toBe(false);
    const www = await h.agent().get('/api/v1/influencer-applications/subdomain-available?subdomain=www');
    expect(www.body.data.available).toBe(false);
  });

  it('only admins can list and review applications', async () => {
    const anon = await h.agent().get('/api/v1/influencer-applications');
    expect(anon.status).toBe(401);
    await h.agent().post('/api/v1/influencer-applications').send(body());
    const list = await admin.get('/api/v1/influencer-applications?status=pending');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.pending).toBe(1);
  });

  it('approving creates a working influencer account with the requested subdomain', async () => {
    const id = (await h.agent().post('/api/v1/influencer-applications').send(body())).body.data._id;
    const res = await admin.post(`/api/v1/influencer-applications/${id}/approve`).send({ commissionRate: 40, sendWelcomeEmail: false });
    expect(res.status).toBe(200);
    expect(res.body.data.influencer.subdomain).toBe('meera');
    expect(res.body.data.influencer.commissionRate).toBe(40);
    expect(res.body.data.influencer.instagramUsername).toBe('meera.creates');
    const saved = await h.models.Influencer.findById(res.body.data.influencer._id).lean();
    expect(saved.audience).toMatchObject({ followers: 25000, avgViews: { instagram: 10000, youtube: 5000 }, youtubeChannel: 'https://youtube.com/@meera' });
    expect(res.body.data.tempPassword).toBeTruthy();

    const login = await h.agent().post('/api/v1/auth/login').send({ email: 'meera@example.com', password: res.body.data.tempPassword, portal: 'influencer' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);

    const track = await h.agent('meera.jencorps.test').post('/api/v1/referrals/track').send({});
    expect(track.body.data.hostInfluencer.subdomain).toBe('meera');

    const again = await admin.post(`/api/v1/influencer-applications/${id}/approve`).send({});
    expect(again.status).toBe(400);
    // an approved applicant cannot re-apply with the same email
    expect((await h.agent().post('/api/v1/influencer-applications').send(body({ preferredSubdomain: '' }))).status).toBe(409);
  });

  it('suggests a free subdomain when none was requested', async () => {
    const id = (await h.agent().post('/api/v1/influencer-applications').send(body({ preferredSubdomain: '' }))).body.data._id;
    const s = await admin.get(`/api/v1/influencer-applications/${id}/suggest-subdomain`);
    expect(s.body.data.subdomain).toBe('meera-creates');
  });

  it('rejecting notifies the applicant and allows a future re-application', async () => {
    const spy = jest.spyOn(emailService, 'sendTemplate');
    const id = (await h.agent().post('/api/v1/influencer-applications').send(body())).body.data._id;
    const res = await admin.post(`/api/v1/influencer-applications/${id}/reject`).send({ reason: 'Audience outside our focus for now' });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('applicationRejected', 'meera@example.com', expect.objectContaining({ reason: 'Audience outside our focus for now' }));
    expect((await h.agent().post('/api/v1/influencer-applications').send(body())).status).toBe(201);
  });
});
