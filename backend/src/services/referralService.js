const env = require('../config/env');
const { COOKIES } = require('../config/constants');
const { Influencer, ReferralClick, Workshop } = require('../models');
const { parseSubdomain } = require('../utils/hostname');
const { randomToken, hashIp, isObjectId } = require('../utils/helpers');
const { getSettings, reservedSubdomains } = require('./settingsService');

const CLICK_DEDUPE_MS = 30 * 60 * 1000;

/** Subdomain of the request host, validated against BASE_DOMAIN and the reserved list */
async function getRequestSubdomain(req) {
  const sub = parseSubdomain(req.hostname);
  if (!sub) return null;
  const settings = await getSettings();
  return reservedSubdomains(settings).has(sub) ? null : sub;
}

async function findActiveInfluencer(filter) {
  const inf = await Influencer.findOne({ ...filter, status: 'active' }).populate('userId', 'name status');
  if (!inf || !inf.userId || inf.userId.status !== 'active') return null;
  return inf;
}

const findBySubdomain = (subdomain) => findActiveInfluencer({ subdomain: String(subdomain).toLowerCase() });
const findByCode = (code) =>
  /^[A-Za-z0-9-]{3,40}$/.test(String(code || '')) ? findActiveInfluencer({ influencerCode: String(code).toUpperCase() }) : null;

function publicInfluencer(inf) {
  if (!inf) return null;
  return {
    influencerCode: inf.influencerCode,
    subdomain: inf.subdomain,
    name: inf.userId?.name,
    profileImage: inf.profileImage,
    instagramUsername: inf.instagramUsername,
  };
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    signed: true,
    path: '/',
    domain: env.cookieDomain, // ".jencorps.com" in production so attribution survives sub <-> main domain
    maxAge: maxAgeMs,
  };
}

function ensureSessionId(req, res) {
  let sid = req.signedCookies?.[COOKIES.SESSION];
  if (typeof sid !== 'string' || !/^[a-f0-9]{32}$/.test(sid)) {
    sid = randomToken(16);
    res.cookie(COOKIES.SESSION, sid, cookieOptions(365 * 864e5));
  }
  return sid;
}

/**
 * Reads the signed attribution cookie and re-validates it against the database.
 * Returns null when absent, tampered, outside the attribution window, or the influencer is inactive.
 */
async function readAttributionCookie(req, settings) {
  const raw = req.signedCookies?.[COOKIES.REFERRAL];
  if (!raw || typeof raw !== 'object' || !isObjectId(String(raw.i || ''))) return null;
  const windowMs = settings.attributionWindowDays * 864e5;
  if (!raw.t || Date.now() - Number(raw.t) > windowMs) return null;
  const influencer = await findActiveInfluencer({ _id: raw.i });
  if (!influencer) return null;
  return {
    influencer,
    method: raw.m === 'link' ? 'link' : 'subdomain',
    clickId: isObjectId(String(raw.k || '')) ? raw.k : undefined,
    firstSeenAt: new Date(Number(raw.t)),
    utm: raw.u && typeof raw.u === 'object' ? raw.u : {},
  };
}

function writeAttributionCookie(res, { influencer, method, clickId, utm }, settings) {
  res.cookie(
    COOKIES.REFERRAL,
    { i: String(influencer._id), m: method, k: clickId ? String(clickId) : undefined, t: Date.now(), u: utm || {} },
    cookieOptions(settings.attributionWindowDays * 864e5)
  );
}

function cleanUtm(utm = {}) {
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : undefined);
  return { source: pick(utm.source), medium: pick(utm.medium), campaign: pick(utm.campaign), content: pick(utm.content) };
}

/**
 * Called by the SPA on page load. Identifies the influencer from the validated host (or a ?ref= code),
 * records a click (deduplicated per session) and sets the first-party attribution cookie.
 */
async function trackVisit(req, res, input = {}) {
  const settings = await getSettings();
  const sessionId = ensureSessionId(req, res);
  const utm = cleanUtm(input.utm);

  let target = null;
  let method = null;
  const hostSub = await getRequestSubdomain(req);
  if (hostSub) {
    target = await findBySubdomain(hostSub);
    method = 'subdomain';
  }
  if (!target && input.ref) {
    target = await findByCode(input.ref);
    method = 'link';
  }

  let attribution = await readAttributionCookie(req, settings);

  if (target) {
    const workshop = input.workshopSlug ? await Workshop.findOne({ slug: input.workshopSlug }).select('_id').lean() : null;

    const recent = await ReferralClick.findOne({
      sessionId,
      influencerId: target._id,
      workshopId: workshop?._id || null,
      createdAt: { $gt: new Date(Date.now() - CLICK_DEDUPE_MS) },
    })
      .select('_id')
      .lean();

    let clickId = recent?._id;
    if (!recent) {
      const click = await ReferralClick.create({
        influencerId: target._id,
        workshopId: workshop?._id || null,
        referralCode: target.influencerCode,
        subdomain: target.subdomain,
        sessionId,
        landingPath: input.path?.slice(0, 500),
        referrer: input.referrer?.slice(0, 500),
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
        utmContent: utm.content,
        ipHash: hashIp(req.ip),
        userAgent: req.headers['user-agent']?.slice(0, 400),
      });
      clickId = click._id;
    }

    const isDifferent = !attribution || String(attribution.influencer._id) !== String(target._id);
    const shouldWrite = !attribution || (settings.attributionModel === 'last' && isDifferent);
    if (shouldWrite) {
      writeAttributionCookie(res, { influencer: target, method, clickId, utm }, settings);
      attribution = { influencer: target, method, clickId, firstSeenAt: new Date(), utm };
    }
  }

  return {
    hostInfluencer: publicInfluencer(hostSub ? target : null),
    attribution: attribution
      ? {
          influencer: publicInfluencer(attribution.influencer),
          method: attribution.method,
          since: attribution.firstSeenAt,
          expiresInDays: settings.attributionWindowDays,
        }
      : null,
  };
}

/**
 * Resolves the influencer to credit for a registration. Never trusts client-supplied ids:
 * every candidate is re-validated in the database.
 *   1. signed attribution cookie (first-touch by default)
 *   2. the influencer subdomain the request was made on
 *   3. a referral code typed/pre-filled in the form, validated against active influencers
 */
async function resolveAttributionForRegistration(req, { referralCode } = {}) {
  const settings = await getSettings();
  const fromCookie = await readAttributionCookie(req, settings);

  let fromHost = null;
  const hostSub = await getRequestSubdomain(req);
  if (hostSub) fromHost = await findBySubdomain(hostSub);

  if (settings.attributionModel === 'last' && fromHost) {
    return { influencer: fromHost, method: 'subdomain', utm: fromCookie?.utm || {} };
  }
  if (fromCookie) return fromCookie;
  if (fromHost) return { influencer: fromHost, method: 'subdomain', utm: {} };
  if (referralCode) {
    const byCode = await findByCode(referralCode);
    if (byCode) return { influencer: byCode, method: 'code', utm: {} };
  }
  return null;
}

module.exports = {
  trackVisit,
  resolveAttributionForRegistration,
  getRequestSubdomain,
  findBySubdomain,
  findByCode,
  publicInfluencer,
};
