const crypto = require('crypto');
const mongoose = require('mongoose');
const env = require('../config/env');

/** Wraps async route handlers so rejected promises reach the error middleware */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Consistent JSON success envelope */
function ok(res, data = null, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

const created = (res, data, meta) => ok(res, data, meta, 201);

/** Parse page/limit/sort from a query object against an allow-list */
function parseListQuery(query, { allowedSort = ['createdAt'], defaultSort = '-createdAt', maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 20));
  let sortParam = typeof query.sort === 'string' && query.sort ? query.sort : defaultSort;
  const field = sortParam.replace(/^-/, '');
  if (!allowedSort.includes(field)) sortParam = defaultSort;
  const dir = sortParam.startsWith('-') ? -1 : 1;
  return { page, limit, skip: (page - 1) * limit, sort: { [sortParam.replace(/^-/, '')]: dir, _id: dir } };
}

const buildMeta = (total, page, limit) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[a-f0-9]{24}$/i.test(id);

/** Normalises phone numbers to compare duplicates (Indian numbers reduced to 10 digits) */
function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const hmacSha256 = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** AES-256-GCM for sensitive payout data at rest */
const encKey = crypto.createHash('sha256').update(env.encryptionKey).digest();
function encrypt(plain) {
  if (plain === undefined || plain === null || plain === '') return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}
function decrypt(payload) {
  if (!payload) return undefined;
  try {
    const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}

const hashIp = (ip) => (ip ? sha256(`${ip}:${env.cookieSecret}`).slice(0, 32) : undefined);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function generatePassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[bytes[i] % chars.length];
  // guarantee complexity
  return `${out}A9!`;
}

const formatINR = (paise) =>
  `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Mongoose option helper so null sessions are omitted */
const so = (session) => (session ? { session } : {});

module.exports = {
  asyncHandler,
  ok,
  created,
  parseListQuery,
  buildMeta,
  escapeRegex,
  isObjectId,
  normalizePhone,
  sha256,
  randomToken,
  hmacSha256,
  safeEqual,
  encrypt,
  decrypt,
  hashIp,
  escapeHtml,
  slugify,
  generatePassword,
  formatINR,
  so,
};
