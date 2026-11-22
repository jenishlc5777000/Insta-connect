const h = require('./helpers');
const { parseSubdomain } = require('../src/utils/hostname');

beforeAll(h.connect);
afterAll(h.disconnect);

describe('Subdomain resolution', () => {
  it.each([
    ['arun.jencorps.test', 'arun'],
    ['ARUN.jencorps.test:443', 'arun'],
    ['jencorps.test', null],
    ['a.b.jencorps.test', null],
    ['arun.jencorps.test.evil.com', null],
    ['evil-jencorps.test', null],
    ['-bad.jencorps.test', null],
    ['', null],
  ])('%s -> %s', (host, expected) => {
    expect(parseSubdomain(host, 'jencorps.test')).toBe(expected);
  });
});

describe('Referral attribution', () => {
  let admin;
  let arun;
  let priya;
  let workshop;

  beforeEach(async () => {
    await h.reset();
    ({ agent: admin } = await h.createAdmin());
    arun = (await h.createInfluencer(admin, { name: 'Arun Kumar', subdomain: 'arun' })).influencer;
    priya = (await h.createInfluencer(admin, { name: 'Priya', subdomain: 'priya' })).influencer;
    workshop = await h.createWorkshop(admin);
  });

  it('identifies the influencer from the subdomain, records a click and sets a signed cookie', async () => {
    const visitor = h.agent('arun.jencorps.test');
    const res = await visitor.post('/api/v1/referrals/track').send({ path: '/', utm: { source: 'instagram', campaign: 'reel1' } });
    expect(res.status).toBe(200);
    expect(res.body.data.hostInfluencer.influencerCode).toBe(arun.influencerCode);
    expect(res.body.data.attribution.influencer.name).toBe('Arun Kumar');
    expect(res.headers['set-cookie'].join(';')).toMatch(/jc_ref=s%3A/); // signed
    const clicks = await h.models.ReferralClick.find({ influencerId: arun._id });
    expect(clicks).toHaveLength(1);
    expect(clicks[0].utmSource).toBe('instagram');
  });

  it('deduplicates repeated clicks in the same session', async () => {
    const visitor = h.agent('arun.jencorps.test');
    await visitor.post('/api/v1/referrals/track').send({ path: '/' });
    await visitor.post('/api/v1/referrals/track').send({ path: '/' });
    expect(await h.models.ReferralClick.countDocuments({ influencerId: arun._id })).toBe(1);
  });

  it('keeps attribution while the visitor navigates (including to the main domain) before registering', async () => {
    const visitor = h.agent('arun.jencorps.test');
    await visitor.post('/api/v1/referrals/track').send({ path: '/', utm: { source: 'instagram' } });
    await visitor.post('/api/v1/referrals/track').send({ path: '/workshops' });
    await visitor.get(`/api/v1/workshops/${workshop.slug}`);

    // Registration submitted from the main domain - the first-party cookie carries attribution
    const mainSite = { post: (url) => visitor.raw.post(url).set('Host', h.HOST) };
    const res = await mainSite.post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    expect(res.status).toBe(201);
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(String(lead.influencerId)).toBe(String(arun._id));
    expect(lead.referralCode).toBe(arun.influencerCode);
    expect(lead.referralSubdomain).toBe('arun');
    expect(lead.attributionMethod).toBe('subdomain');
    expect(lead.utmSource).toBe('instagram');
    expect(lead.campaignId).toBe(workshop.campaignCode);
  });

  it('uses first-touch attribution by default', async () => {
    const visitor = h.agent('arun.jencorps.test');
    await visitor.post('/api/v1/referrals/track').send({ path: '/' });
    const onPriya = { post: (url) => visitor.raw.post(url).set('Host', 'priya.jencorps.test') };
    await onPriya.post('/api/v1/referrals/track').send({ path: '/' });
    const res = await onPriya.post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(String(lead.influencerId)).toBe(String(arun._id));
    // both visits still count as traffic
    expect(await h.models.ReferralClick.countDocuments({ influencerId: priya._id })).toBe(1);
  });

  it('switches to last-touch when configured', async () => {
    await admin.patch('/api/v1/admin/settings').send({ attributionModel: 'last' });
    const visitor = h.agent('arun.jencorps.test');
    await visitor.post('/api/v1/referrals/track').send({});
    const onPriya = { post: (url) => visitor.raw.post(url).set('Host', 'priya.jencorps.test') };
    await onPriya.post('/api/v1/referrals/track').send({});
    const res = await onPriya.post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(String(lead.influencerId)).toBe(String(priya._id));
  });

  it('attributes registrations made directly on a subdomain without a prior track call', async () => {
    const res = await h.agent('priya.jencorps.test').post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(String(lead.influencerId)).toBe(String(priya._id));
  });

  it('never trusts influencer ids submitted by the frontend', async () => {
    const res = await h
      .agent()
      .post('/api/v1/leads/register')
      .send({ ...h.leadBody(workshop._id), influencerId: String(arun._id), referralCode: 'INF-9999' });
    expect(res.status).toBe(201);
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(lead.influencerId).toBeNull();
    expect(lead.attributionMethod).toBe('none');
  });

  it('accepts a referral code only after validating it against the database', async () => {
    const res = await h.agent().post('/api/v1/leads/register').send({ ...h.leadBody(workshop._id), referralCode: arun.influencerCode });
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(String(lead.influencerId)).toBe(String(arun._id));
    expect(lead.attributionMethod).toBe('code');
  });

  it('ignores tampered referral cookies', async () => {
    const forged = `jc_ref=${encodeURIComponent(`j:${JSON.stringify({ i: String(priya._id), t: Date.now() })}`)}`;
    const res = await h.agent().post('/api/v1/leads/register').set('Cookie', forged).send(h.leadBody(workshop._id));
    const lead = await h.models.Lead.findById(res.body.data.lead._id);
    expect(lead.influencerId).toBeNull();
  });

  it('does not attribute to unknown, reserved or inactive subdomains', async () => {
    const unknown = await h.agent('nobody.jencorps.test').post('/api/v1/referrals/track').send({});
    expect(unknown.body.data.attribution).toBeNull();
    const reserved = await h.agent('www.jencorps.test').post('/api/v1/referrals/track').send({});
    expect(reserved.body.data.hostInfluencer).toBeNull();

    await admin.patch(`/api/v1/influencers/${arun._id}/status`).send({ status: 'inactive' });
    const inactive = await h.agent('arun.jencorps.test').post('/api/v1/referrals/track').send({});
    expect(inactive.body.data.attribution).toBeNull();
  });

  it('expires attribution outside the configured window', async () => {
    const visitor = h.agent('arun.jencorps.test');
    await visitor.post('/api/v1/referrals/track').send({});
    const realNow = Date.now;
    Date.now = () => realNow() + 31 * 864e5;
    try {
      const res = await visitor.raw.post('/api/v1/leads/register').set('Host', h.HOST).send(h.leadBody(workshop._id));
      const lead = await h.models.Lead.findById(res.body.data.lead._id);
      expect(lead.influencerId).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  it('lets admins re-attribute a lead with an audit log', async () => {
    const res = await h.agent('arun.jencorps.test').post('/api/v1/leads/register').send(h.leadBody(workshop._id));
    const leadId = res.body.data.lead._id;
    const noReason = await admin.patch(`/api/v1/leads/${leadId}/attribution`).send({ influencerId: String(priya._id) });
    expect(noReason.status).toBe(400);
    const ok = await admin.patch(`/api/v1/leads/${leadId}/attribution`).send({ influencerId: String(priya._id), reason: 'Customer confirmed Priya referred them' });
    expect(ok.status).toBe(200);
    const lead = await h.models.Lead.findById(leadId);
    expect(String(lead.influencerId)).toBe(String(priya._id));
    expect(lead.attributionMethod).toBe('manual');
    const log = await h.models.AuditLog.findOne({ entityId: leadId, action: 'lead.reassign_attribution' });
    expect(String(log.previousValue.influencerId)).toBe(String(arun._id));
    expect(log.reason).toMatch(/Priya/);
  });
});
