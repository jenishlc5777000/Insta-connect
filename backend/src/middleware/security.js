const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');
const { isAllowedOrigin } = require('../utils/hostname');
const env = require('../config/env');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests: cookies are SameSite=Lax, and every
 * state-changing request that carries an Origin/Referer must come from a platform origin.
 * (Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE.)
 */
function csrfOriginCheck(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin || (req.headers.referer ? safeOrigin(req.headers.referer) : null);
  if (!origin) return next();
  if (isAllowedOrigin(origin)) return next();
  return next(ApiError.forbidden('Cross-site request blocked'));
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid://';
  }
}

/**
 * NoSQL-injection + XSS hardening: drops keys starting with "$" or containing ".",
 * and strips HTML tags from every string input. React escapes output, this is defence in depth.
 */
const TAGS = /<\/?[a-z][^>]*>/gi;
function clean(value, depth = 0) {
  if (depth > 10) return undefined;
  if (typeof value === 'string') return value.replace(TAGS, '').replace(/\u0000/g, '');
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Buffer)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      // Passwords are hashed, never rendered: keep them byte-for-byte
      out[k] = typeof v === 'string' && /password/i.test(k) ? v : clean(v, depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body = clean(req.body);
  if (req.query) {
    const cleaned = clean(req.query);
    // Query params must be scalar strings; arrays/objects are collapsed to their first string
    for (const key of Object.keys(cleaned)) {
      if (Array.isArray(cleaned[key])) cleaned[key] = String(cleaned[key][0] ?? '');
      else if (cleaned[key] && typeof cleaned[key] === 'object') delete cleaned[key];
    }
    Object.defineProperty(req, 'query', { value: cleaned, writable: true, configurable: true, enumerable: true });
  }
  if (req.params) req.params = clean(req.params);
  next();
}

const limiterOptions = (windowMs, limit, message) => ({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, _res, next) => next(new ApiError(429, message, undefined, 'RATE_LIMITED')),
});

const apiLimiter = rateLimit(limiterOptions(15 * 60 * 1000, 600, 'Too many requests, please slow down'));
const loginLimiter = rateLimit({
  ...limiterOptions(15 * 60 * 1000, 10, 'Too many login attempts. Try again in 15 minutes.'),
  skipSuccessfulRequests: true,
});
const sensitiveLimiter = rateLimit(limiterOptions(60 * 60 * 1000, 10, 'Too many attempts. Try again later.'));
const registrationLimiter = rateLimit(limiterOptions(60 * 60 * 1000, 30, 'Too many registrations from this network'));
const trackingLimiter = rateLimit(limiterOptions(60 * 1000, 60, 'Too many requests'));

module.exports = {
  csrfOriginCheck,
  sanitizeInput,
  apiLimiter,
  loginLimiter,
  sensitiveLimiter,
  registrationLimiter,
  trackingLimiter,
};
