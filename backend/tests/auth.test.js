const h = require('./helpers');
const emailService = require('../src/services/emailService');

beforeAll(h.connect);
afterAll(h.disconnect);
beforeEach(h.reset);
afterEach(() => jest.restoreAllMocks());

describe('User registration', () => {
  it('registers a customer and hashes the password', async () => {
    const res = await h.agent().post('/api/v1/auth/register').send({ name: 'Asha', email: 'Asha@Example.com', password: 'Secret123' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('asha@example.com');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const user = await h.models.User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    expect(user.role).toBe('customer');
    expect(user.passwordHash).not.toContain('Secret123');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const a = h.agent();
    await a.post('/api/v1/auth/register').send({ name: 'Asha', email: 'a@example.com', password: 'Secret123' });
    const dup = await a.post('/api/v1/auth/register').send({ name: 'Asha', email: 'a@example.com', password: 'Secret123' });
    expect(dup.status).toBe(409);
    const weak = await a.post('/api/v1/auth/register').send({ name: 'Bob', email: 'b@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cannot self-register as admin (role is ignored)', async () => {
    await h.agent().post('/api/v1/auth/register').send({ name: 'Mallory', email: 'm@example.com', password: 'Secret123', role: 'admin' });
    const u = await h.models.User.findOne({ email: 'm@example.com' });
    expect(u.role).toBe('customer');
  });
});

describe('Login and authentication', () => {
  beforeEach(async () => {
    await h.agent().post('/api/v1/auth/register').send({ name: 'Asha', email: 'asha@example.com', password: 'Secret123' });
  });

  it('logs in with HTTP-only cookies and returns the session', async () => {
    const a = h.agent();
    const res = await a.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'Secret123' });
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/jc_at=.*HttpOnly/i);
    expect(cookies).toMatch(/jc_rt=.*HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    const me = await a.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('asha@example.com');
  });

  it('rejects wrong passwords and unknown users with the same message', async () => {
    const a = h.agent();
    const wrong = await a.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'nope12345' });
    const unknown = await a.post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'nope12345' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('enforces the portal role', async () => {
    const res = await h.agent().post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'Secret123', portal: 'admin' });
    expect(res.status).toBe(401);
  });

  it('requires authentication for /me', async () => {
    const res = await h.agent().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const a = h.agent();
    const login = await a.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'Secret123' });
    const oldRt = login.headers['set-cookie'].find((c) => c.startsWith('jc_rt=')).split(';')[0];

    const r1 = await a.post('/api/v1/auth/refresh');
    expect(r1.status).toBe(200);

    // replay the old (rotated) refresh token from another client
    const attacker = await require('supertest')(h.app).post('/api/v1/auth/refresh').set('Host', h.HOST).set('Cookie', oldRt);
    expect(attacker.status).toBe(401);
    expect(attacker.body.error.code).toBe('REFRESH_REUSED');

    // the whole family is now revoked
    const r2 = await a.post('/api/v1/auth/refresh');
    expect(r2.status).toBe(401);
  });

  it('logout clears the session', async () => {
    const a = h.agent();
    await a.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'Secret123' });
    await a.post('/api/v1/auth/logout');
    const r = await a.post('/api/v1/auth/refresh');
    expect(r.status).toBe(401);
  });

  it('resets a password via an emailed token', async () => {
    const spy = jest.spyOn(emailService, 'sendTemplate');
    const a = h.agent();
    const res = await a.post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' });
    expect(res.status).toBe(200);
    const url = spy.mock.calls.find((c) => c[0] === 'passwordReset')[2].url;
    const token = new URL(url).searchParams.get('token');

    const reset = await a.post('/api/v1/auth/reset-password').send({ token, password: 'NewSecret456' });
    expect(reset.status).toBe(200);
    const again = await a.post('/api/v1/auth/reset-password').send({ token, password: 'Other123456' });
    expect(again.status).toBe(400);

    const login = await a.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'NewSecret456' });
    expect(login.status).toBe(200);
  });

  it('does not reveal whether an email exists on forgot-password', async () => {
    const res = await h.agent().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
  });
});

describe('Security middleware', () => {
  it('blocks cross-site state-changing requests', async () => {
    const res = await h.agent().post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
  });

  it('allows platform subdomain origins', async () => {
    const res = await h.agent().post('/api/v1/auth/login').set('Origin', 'http://arun.jencorps.test').send({ email: 'a@b.co', password: 'xxxxxxx1' });
    expect(res.status).toBe(401);
  });

  it('strips NoSQL operators from input', async () => {
    const res = await h.agent().post('/api/v1/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});
