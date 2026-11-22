const env = require('../config/env');

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** Allowed format for an influencer subdomain assigned by an admin */
const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

/**
 * Extracts the single-label subdomain from a hostname, validated against BASE_DOMAIN.
 * "arun.jencorps.com" -> "arun"; "jencorps.com" / "evil.com" / "a.b.jencorps.com" -> null
 */
function parseSubdomain(hostname, baseDomain = env.baseDomain) {
  if (!hostname || typeof hostname !== 'string') return null;
  const host = hostname.trim().toLowerCase().split(':')[0].replace(/\.$/, '');
  const base = baseDomain.toLowerCase();
  if (host === base) return null;
  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return null;
  const sub = host.slice(0, -suffix.length);
  if (!LABEL.test(sub)) return null; // rejects nested labels such as a.b
  return sub;
}

/** Whether an Origin/host belongs to this platform (base domain, any subdomain or configured origins) */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (env.corsOrigins.includes(origin) || origin === env.frontendUrl) return true;
  if (env.isProd && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return host === env.baseDomain || parseSubdomain(host) !== null;
}

module.exports = { parseSubdomain, isAllowedOrigin, SUBDOMAIN_PATTERN };
