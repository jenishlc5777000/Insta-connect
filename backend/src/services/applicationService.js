const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User, Influencer } = require('../models');
const InfluencerApplication = require('../models/InfluencerApplication');
const { hashIp, parseListQuery, buildMeta, escapeRegex, slugify } = require('../utils/helpers');
const { SUBDOMAIN_PATTERN } = require('../utils/hostname');
const { getSettings, reservedSubdomains } = require('./settingsService');
const influencerService = require('./influencerService');
const emailService = require('./emailService');
const { recordAudit } = require('./auditService');

async function subdomainAvailable(subdomain) {
  const sub = String(subdomain || '').toLowerCase();
  if (!SUBDOMAIN_PATTERN.test(sub)) return { available: false, reason: 'Use 3–32 lowercase letters, numbers or hyphens' };
  const settings = await getSettings();
  if (reservedSubdomains(settings).has(sub)) return { available: false, reason: 'This name is reserved' };
  const [taken, requested] = await Promise.all([
    Influencer.exists({ subdomain: sub }),
    InfluencerApplication.exists({ preferredSubdomain: sub, status: 'pending' }),
  ]);
  if (taken || requested) return { available: false, reason: 'Already taken' };
  return { available: true };
}

async function apply(data, req) {
  if (await User.exists({ email: data.email })) {
    throw ApiError.conflict('An account with this email already exists. Log in, or contact us if you are already a partner.', [{ field: 'email' }]);
  }
  if (await Influencer.exists({ instagramUsername: new RegExp(`^${escapeRegex(data.instagramUsername)}$`, 'i') })) {
    throw ApiError.conflict('This Instagram account is already a JenCorps partner', [{ field: 'instagramUsername' }]);
  }
  if (data.preferredSubdomain) {
    const check = await subdomainAvailable(data.preferredSubdomain);
    if (!check.available) throw ApiError.badRequest(`Subdomain "${data.preferredSubdomain}": ${check.reason}`, [{ field: 'preferredSubdomain' }]);
  }
  let application;
  try {
    application = await InfluencerApplication.create({ ...data, ipHash: hashIp(req.ip) });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('We already have a pending application from you. We will get back to you soon!');
    throw err;
  }
  await emailService.sendTemplate('applicationReceived', application.email, { name: application.name });
  return { _id: application._id, status: application.status };
}

async function list(query) {
  const { page, limit, skip, sort } = parseListQuery(query, { allowedSort: ['createdAt', 'followers', 'name'] });
  const filter = {};
  if (query.status) filter.status = String(query.status);
  if (query.search) {
    const rx = new RegExp(escapeRegex(String(query.search).slice(0, 100)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { instagramUsername: rx }, { city: rx }, { niche: rx }];
  }
  const [items, total, pending] = await Promise.all([
    InfluencerApplication.find(filter).populate('reviewedBy', 'name').sort(sort).skip(skip).limit(limit).lean(),
    InfluencerApplication.countDocuments(filter),
    InfluencerApplication.countDocuments({ status: 'pending' }),
  ]);
  return { items, meta: { ...buildMeta(total, page, limit), pending } };
}

/** Suggests a free subdomain: preferred -> instagram handle -> first name (+ number) */
async function suggestSubdomain(app) {
  const candidates = [app.preferredSubdomain, slugify(app.instagramUsername).replace(/[^a-z0-9-]/g, ''), slugify(app.name.split(' ')[0])].filter(Boolean);
  for (const c of candidates) {
    const base = c.slice(0, 30);
    if ((await subdomainAvailable(base)).available) return base;
  }
  const base = (candidates[candidates.length - 1] || 'partner').slice(0, 26);
  for (let i = 2; i < 100; i += 1) if ((await subdomainAvailable(`${base}${i}`)).available) return `${base}${i}`;
  return undefined;
}

async function approve(id, { subdomain, commissionRate, sendWelcomeEmail = true }, req) {
  const app = await InfluencerApplication.findById(id);
  if (!app) throw ApiError.notFound('Application not found');
  if (app.status !== 'pending') throw ApiError.badRequest(`This application was already ${app.status}`);

  // Release the subdomain hold of this application before creating the influencer
  const chosen = subdomain || app.preferredSubdomain || (await suggestSubdomain(app));
  app.preferredSubdomain = undefined;
  await app.save();

  let result;
  try {
    result = await influencerService.create(
      {
        name: app.name,
        email: app.email,
        phone: app.phone,
        subdomain: chosen,
        commissionRate: commissionRate ?? null,
        instagramUsername: app.instagramUsername,
        sendWelcomeEmail,
      },
      req
    );
  } catch (err) {
    app.preferredSubdomain = chosen && SUBDOMAIN_PATTERN.test(chosen) ? chosen : undefined;
    await app.save().catch(() => {});
    throw err;
  }

  await Influencer.updateOne(
    { _id: result.influencer._id },
    {
      audience: {
        followers: app.followers,
        niche: app.niche,
        avgViews: app.avgViews,
        youtubeChannel: app.youtubeChannel,
        facebookPage: app.facebookPage,
      },
    }
  );
  result.influencer.audience = { followers: app.followers, niche: app.niche, avgViews: app.avgViews, youtubeChannel: app.youtubeChannel, facebookPage: app.facebookPage };

  app.status = 'approved';
  app.reviewedBy = req.user._id;
  app.reviewedAt = new Date();
  app.influencerId = result.influencer._id;
  await app.save();
  await recordAudit({ req, action: 'application.approve', entityType: 'InfluencerApplication', entityId: app._id, newValue: { influencerId: result.influencer._id, subdomain: chosen } });
  return { application: app, ...result };
}

async function reject(id, { reason, notify = true }, req) {
  const app = await InfluencerApplication.findById(id);
  if (!app) throw ApiError.notFound('Application not found');
  if (app.status !== 'pending') throw ApiError.badRequest(`This application was already ${app.status}`);
  app.status = 'rejected';
  app.rejectionReason = reason;
  app.reviewedBy = req.user._id;
  app.reviewedAt = new Date();
  await app.save();
  await recordAudit({ req, action: 'application.reject', entityType: 'InfluencerApplication', entityId: app._id, newValue: { status: 'rejected' }, reason });
  if (notify) await emailService.sendTemplate('applicationRejected', app.email, { name: app.name, reason });
  return app;
}

module.exports = { apply, list, approve, reject, subdomainAvailable, suggestSubdomain, frontendUrl: env.frontendUrl };
