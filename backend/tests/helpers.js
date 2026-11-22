const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const { connectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const models = require('../src/models');
const { clearSettingsCache } = require('../src/services/settingsService');

const app = createApp();
const HOST = 'jencorps.test';

async function connect() {
  const uri = process.env.TEST_MONGO_URI;
  const dbName = `t_${crypto.randomBytes(6).toString('hex')}`;
  await connectDB(uri, { dbName });
}

async function reset() {
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
  clearSettingsCache();
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

/** A supertest agent that keeps cookies and sends a given Host header */
function agent(host = HOST) {
  const a = request.agent(app);
  const wrap = (method) => (url) => a[method](url).set('Host', host);
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), delete: wrap('delete'), raw: a };
}

async function createAdmin(email = 'admin@jencorps.test', password = 'Admin@12345') {
  const u = new models.User({ name: 'Admin', email, role: 'admin', emailVerified: true });
  await u.setPassword(password);
  await u.save();
  const a = agent();
  const res = await a.post('/api/v1/auth/login').send({ email, password, portal: 'admin' });
  if (res.status !== 200) throw new Error(`admin login failed ${res.status} ${JSON.stringify(res.body)}`);
  return { user: u, agent: a };
}

async function createInfluencer(adminAgent, overrides = {}) {
  const n = crypto.randomBytes(3).toString('hex');
  const body = {
    name: overrides.name || `Influencer ${n}`,
    email: overrides.email || `inf${n}@example.com`,
    subdomain: overrides.subdomain || `inf${n}`,
    password: 'Influencer@123',
    sendWelcomeEmail: false,
    ...overrides,
  };
  const res = await adminAgent.post('/api/v1/influencers').send(body);
  if (res.status !== 201) throw new Error(`create influencer failed ${res.status} ${JSON.stringify(res.body)}`);
  const a = agent();
  const login = await a.post('/api/v1/auth/login').send({ email: body.email, password: 'Influencer@123', portal: 'influencer' });
  if (login.status !== 200) throw new Error(`influencer login failed ${JSON.stringify(login.body)}`);
  return { influencer: res.body.data.influencer, agent: a, email: body.email };
}

async function createWorkshop(adminAgent, overrides = {}) {
  const start = new Date(Date.now() + 10 * 864e5);
  const res = await adminAgent.post('/api/v1/workshops').send({
    title: `AI Workshop ${crypto.randomBytes(2).toString('hex')}`,
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 4 * 3600e3).toISOString(),
    mode: 'online',
    price: 200000,
    status: 'published',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`create workshop failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

let phoneSeq = 0;
const leadBody = (workshopId, extra = {}) => {
  phoneSeq += 1;
  return {
    name: 'Test Lead',
    email: `lead${Date.now()}${phoneSeq}@example.com`,
    phone: `9${String(800000000 + phoneSeq + Math.floor(Math.random() * 1e8)).slice(0, 9)}`,
    city: 'Kochi',
    workshopId,
    consent: true,
    ...extra,
  };
};

const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('hex');

module.exports = { app, connect, reset, disconnect, agent, createAdmin, createInfluencer, createWorkshop, leadBody, sign, models, HOST };
