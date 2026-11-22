/**
 * DEVELOPMENT / TESTING ONLY. Wipes and seeds the database with sample data.
 *   npm run seed            (refuses to run when NODE_ENV=production)
 */
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const models = require('../src/models');
const { normalizePhone, randomToken, sha256 } = require('../src/utils/helpers');
const { DEFAULT_RESERVED_SUBDOMAINS } = require('../src/config/constants');
const { createForPayment } = require('../src/services/commissionService');
const sample = require('./sampleContent');

if (env.isProd) {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const { User, Influencer, Workshop, Lead, ReferralClick, Payment, Commission, Payout, Setting, Counter, Resource, AuditLog, RefreshToken, WebhookEvent } = models;

const days = (n) => new Date(Date.now() + n * 864e5);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

(async () => {
  await connectDB(env.mongoUri);
  await Promise.all(
    [User, Influencer, Workshop, Lead, ReferralClick, Payment, Commission, Payout, Setting, Counter, Resource, AuditLog, RefreshToken, WebhookEvent].map((m) => m.deleteMany({}))
  );

  await Setting.create({ key: 'global', reservedSubdomains: DEFAULT_RESERVED_SUBDOMAINS, socialLinks: { instagram: 'https://instagram.com/jencorps' } });

  const admin = new User({ name: 'Dev Admin', email: 'admin@jencorps.test', role: 'admin', emailVerified: true });
  await admin.setPassword('Admin@12345');
  await admin.save();

  const workshop = await Workshop.create({
    ...sample.workshop,
    startDate: days(21),
    endDate: new Date(days(21).getTime() + 6 * 3600e3),
    mode: 'hybrid',
    location: 'JenCorps Studio, Bengaluru',
    meetingLink: 'https://zoom.us/j/0000000000',
    price: 299900,
    discountPrice: 200000,
    registrationDeadline: days(20),
    capacity: 200,
    status: 'published',
    featured: true,
    createdBy: admin._id,
  });

  const infData = [
    { name: 'Arun Kumar', email: 'arun@jencorps.test', subdomain: 'arun', instagramUsername: 'arun.creates' },
    { name: 'Priya Sharma', email: 'priya@jencorps.test', subdomain: 'priya', instagramUsername: 'priya.ai', commissionRate: 40 },
  ];
  const influencers = [];
  for (const [i, d] of infData.entries()) {
    const u = new User({ name: d.name, email: d.email, role: 'influencer', emailVerified: true });
    await u.setPassword('Influencer@123');
    await u.save();
    influencers.push(
      await Influencer.create({ userId: u._id, influencerCode: `INF-${1001 + i}`, subdomain: d.subdomain, instagramUsername: d.instagramUsername, commissionRate: d.commissionRate ?? null })
    );
  }
  await Counter.create({ _id: 'influencerCode', seq: infData.length });

  const cities = ['Bengaluru', 'Chennai', 'Kochi', 'Hyderabad', 'Mumbai', 'Pune'];
  const sources = ['instagram', 'instagram', 'whatsapp', 'youtube'];
  let n = 0;
  for (const inf of influencers) {
    for (let d = 0; d < 20; d += 1) {
      const clicks = Math.floor(Math.random() * 8);
      for (let c = 0; c < clicks; c += 1) {
        await ReferralClick.create({ influencerId: inf._id, workshopId: workshop._id, referralCode: inf.influencerCode, subdomain: inf.subdomain, sessionId: randomToken(16), utmSource: pick(sources), createdAt: days(-d) });
      }
    }
    for (let k = 0; k < 12; k += 1) {
      n += 1;
      const phone = `98${String(10000000 + n).padStart(8, '0')}`;
      const paid = k % 3 !== 0;
      const lead = await Lead.create({
        name: `Sample Lead ${n}`,
        email: `lead${n}@example.com`,
        phone,
        phoneNormalized: normalizePhone(phone),
        city: pick(cities),
        workshopId: workshop._id,
        mode: pick(['online', 'offline']),
        influencerId: inf._id,
        referralCode: inf.influencerCode,
        referralSubdomain: inf.subdomain,
        campaignId: workshop.campaignCode,
        attributionMethod: 'subdomain',
        utmSource: pick(sources),
        registrationStatus: paid ? 'confirmed' : 'registered',
        paymentStatus: paid ? 'paid' : 'pending',
        consentAt: new Date(),
        accessTokenHashes: [sha256(randomToken())],
        createdAt: days(-Math.floor(Math.random() * 18)),
      });
      if (paid) {
        const payment = await Payment.create({
          leadId: lead._id, workshopId: workshop._id, influencerId: inf._id, amount: 200000, gateway: 'mock',
          gatewayOrderId: `mock_order_seed_${n}`, gatewayPaymentId: `mock_pay_seed_${n}`, status: 'captured',
          capturedAt: lead.createdAt, method: 'upi', verifiedVia: 'mock', gatewayFee: 4000,
        });
        await createForPayment(payment, null);
      }
    }
  }

  await Resource.create(sample.resources.map((r) => ({ ...r, workshopId: workshop._id, createdBy: admin._id })));

  console.log('\nSeed complete (development data):');
  console.log('  Admin:       admin@jencorps.test / Admin@12345     -> /admin/login');
  console.log('  Influencers: arun@jencorps.test, priya@jencorps.test / Influencer@123 -> /influencer/login');
  console.log(`  Referral:    http://arun.localhost:5173  http://priya.localhost:5173`);
  await disconnectDB();
})().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
