/**
 * Regression test: on Vercel the Node runtime pre-populates req.cookies before Express runs.
 * cookie-parser then skips itself, which broke signed cookies (500 on /referrals/track)
 * and dropped referral attribution. This simulates that runtime.
 */
const http = require('http');
const request = require('supertest');
const h = require('./helpers');

// Mimic @vercel/node helpers: a lazy, configurable req.cookies getter set before the app runs
const vercelLike = http.createServer((req, res) => {
  Object.defineProperty(req, 'cookies', { get: () => ({}), configurable: true, enumerable: true });
  h.app(req, res);
});

beforeAll(h.connect);
afterAll(async () => {
  vercelLike.close();
  await h.disconnect();
});

describe('Vercel runtime cookies', () => {
  let code;
  let workshop;

  beforeAll(async () => {
    await h.reset();
    const { agent: admin } = await h.createAdmin();
    code = (await h.createInfluencer(admin, { subdomain: 'arun' })).influencer.influencerCode;
    workshop = await h.createWorkshop(admin);
  });

  it('sets signed cookies and keeps referral attribution through registration', async () => {
    const agent = request.agent(vercelLike);
    const track = await agent.post('/api/v1/referrals/track').set('Host', h.HOST).send({ path: '/', ref: code });
    expect(track.status).toBe(200);
    expect(track.body.data.attribution.influencer.influencerCode).toBe(code);
    expect(track.headers['set-cookie'].join(';')).toMatch(/jc_ref=s%3A/);

    const reg = await agent.post('/api/v1/leads/register').set('Host', h.HOST).send(h.leadBody(workshop._id));
    expect(reg.status).toBe(201);
    const lead = await h.models.Lead.findById(reg.body.data.lead._id);
    expect(lead.referralCode).toBe(code);
    expect(lead.attributionMethod).toBe('link');
  });

  it('still authenticates with the access cookie', async () => {
    const agent = request.agent(vercelLike);
    const login = await agent.post('/api/v1/auth/login').set('Host', h.HOST).send({ email: 'admin@jencorps.test', password: 'Admin@12345', portal: 'admin' });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/v1/auth/me').set('Host', h.HOST);
    expect(me.status).toBe(200);
  });
});
