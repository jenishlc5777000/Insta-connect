const { Setting } = require('../models');
const { DEFAULT_RESERVED_SUBDOMAINS } = require('../config/constants');

let cache = null;
let cachedAt = 0;
const TTL_MS = 15 * 1000;

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  let doc = await Setting.findOne({ key: 'global' }).lean();
  if (!doc) {
    try {
      doc = (await Setting.create({ key: 'global', reservedSubdomains: DEFAULT_RESERVED_SUBDOMAINS })).toObject();
    } catch (err) {
      if (err.code !== 11000) throw err;
      doc = await Setting.findOne({ key: 'global' }).lean();
    }
  }
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

async function updateSettings(patch, adminId) {
  const doc = await Setting.findOneAndUpdate(
    { key: 'global' },
    { $set: { ...flatten(patch), updatedBy: adminId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && k === 'socialLinks') {
      Object.assign(out, flatten(v, `${prefix}${k}.`));
    } else if (v !== undefined) {
      out[`${prefix}${k}`] = v;
    }
  }
  return out;
}

function clearSettingsCache() {
  cache = null;
}

function reservedSubdomains(settings) {
  const list = settings?.reservedSubdomains?.length ? settings.reservedSubdomains : DEFAULT_RESERVED_SUBDOMAINS;
  return new Set(list.map((s) => s.toLowerCase()));
}

function publicSettings(s) {
  return {
    siteName: s.siteName,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    socialLinks: s.socialLinks,
    defaultCommissionRate: s.defaultCommissionRate,
  };
}

module.exports = { getSettings, updateSettings, clearSettingsCache, reservedSubdomains, publicSettings };
