const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User, Influencer, Counter, Lead, ReferralClick, Commission, Payment, Workshop } = require('../models');
const { resolveCommissionRate, calculateCommission } = require('./commissionService');
const { generatePassword, encrypt, decrypt, so, escapeRegex, parseListQuery, buildMeta } = require('../utils/helpers');
const { withTransaction } = require('../utils/transaction');
const { recordAudit } = require('./auditService');
const emailService = require('./emailService');
const { revokeAllForUser } = require('./tokenService');
const { getSettings, reservedSubdomains } = require('./settingsService');

/** "https://jencorps.com" + "arun" -> "https://arun.jencorps.com" (keeps the dev port) */
function referralUrlFor(subdomain) {
  const url = new URL(env.frontendUrl);
  url.hostname = `${subdomain}.${url.hostname}`;
  return url.origin;
}

async function nextInfluencerCode(session) {
  const counter = await Counter.findOneAndUpdate({ _id: 'influencerCode' }, { $inc: { seq: 1 } }, { new: true, upsert: true, ...so(session) });
  return `INF-${1000 + counter.seq}`;
}

async function assertSubdomainAvailable(subdomain, excludeId) {
  const settings = await getSettings();
  if (reservedSubdomains(settings).has(subdomain)) throw ApiError.badRequest(`"${subdomain}" is a reserved subdomain`, [{ field: 'subdomain' }]);
  const taken = await Influencer.exists({ subdomain, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (taken) throw ApiError.conflict('This subdomain is already assigned', [{ field: 'subdomain' }]);
}

function maskPayout(p = {}) {
  return {
    method: p.method,
    accountHolderName: p.accountHolderName,
    bankName: p.bankName,
    ifsc: p.ifsc,
    accountNumber: p.accountNumberLast4 ? `XXXX${p.accountNumberLast4}` : undefined,
    upiId: p.upiMasked,
    pan: p.panLast4 ? `XXXXXX${p.panLast4}` : undefined,
    updatedAt: p.updatedAt,
    isComplete: Boolean(p.method && p.accountHolderName && (p.accountNumberLast4 || p.upiMasked)),
  };
}

/** Admin-only: decrypted payout details for making a transfer */
function fullPayout(p = {}) {
  return { ...maskPayout(p), accountNumber: decrypt(p.accountNumberEnc), upiId: decrypt(p.upiIdEnc) };
}

function serialize(inf, { revealPayout = false } = {}) {
  const obj = inf.toObject ? inf.toObject() : inf;
  const user = obj.userId && typeof obj.userId === 'object' ? obj.userId : null;
  return {
    _id: obj._id,
    influencerCode: obj.influencerCode,
    subdomain: obj.subdomain,
    referralUrl: referralUrlFor(obj.subdomain),
    commissionRate: obj.commissionRate,
    instagramUsername: obj.instagramUsername,
    profileImage: obj.profileImage,
    bio: obj.bio,
    audience: obj.audience,
    status: obj.status,
    createdAt: obj.createdAt,
    user: user
      ? { _id: user._id, name: user.name, email: user.email, phone: user.phone, status: user.status, lastLoginAt: user.lastLoginAt }
      : undefined,
    payoutDetails: revealPayout ? fullPayout(obj.payoutDetails) : maskPayout(obj.payoutDetails),
  };
}

async function create(data, req) {
  await assertSubdomainAvailable(data.subdomain);
  if (await User.exists({ email: data.email })) throw ApiError.conflict('A user with this email already exists', [{ field: 'email' }]);

  const tempPassword = data.password || generatePassword();
  const result = await withTransaction(async (session) => {
    const user = new User({ name: data.name, email: data.email, phone: data.phone, role: 'influencer', emailVerified: true, mustChangePassword: true });
    await user.setPassword(tempPassword);
    await user.save(so(session));
    const influencerCode = await nextInfluencerCode(session);
    const [influencer] = await Influencer.create(
      [
        {
          userId: user._id,
          influencerCode,
          subdomain: data.subdomain,
          commissionRate: data.commissionRate ?? null,
          instagramUsername: data.instagramUsername,
          bio: data.bio,
        },
      ],
      so(session)
    );
    await recordAudit({ req, action: 'influencer.create', entityType: 'Influencer', entityId: influencer._id, newValue: { influencerCode, subdomain: data.subdomain, email: data.email, commissionRate: influencer.commissionRate } }, session);
    return { user, influencer };
  });

  if (data.sendWelcomeEmail !== false) {
    await emailService.sendTemplate('influencerWelcome', result.user.email, {
      name: result.user.name,
      email: result.user.email,
      tempPassword,
      loginUrl: `${env.frontendUrl}/influencer/login`,
      referralUrl: referralUrlFor(result.influencer.subdomain),
    });
  }
  result.influencer.userId = result.user;
  return { influencer: serialize(result.influencer), tempPassword: data.password ? undefined : tempPassword };
}

async function update(id, data, req) {
  const influencer = await Influencer.findById(id).populate('userId');
  if (!influencer) throw ApiError.notFound('Influencer not found');
  const user = influencer.userId;
  const before = serialize(influencer);

  if (data.subdomain && data.subdomain !== influencer.subdomain) await assertSubdomainAvailable(data.subdomain, influencer._id);
  if (data.email && data.email !== user.email && (await User.exists({ email: data.email, _id: { $ne: user._id } }))) {
    throw ApiError.conflict('A user with this email already exists', [{ field: 'email' }]);
  }

  let pendingRecalculated = 0;
  await withTransaction(async (session) => {
    for (const k of ['name', 'email', 'phone']) if (data[k] !== undefined) user[k] = data[k];
    for (const k of ['subdomain', 'commissionRate', 'instagramUsername', 'bio', 'status']) if (data[k] !== undefined) influencer[k] = data[k];
    await user.save(so(session));
    await influencer.save(so(session));
    if (data.commissionRate !== undefined && data.applyToPendingCommissions) {
      pendingRecalculated = await recalcPendingCommissions(influencer, req, session);
    }
    await recordAudit(
      {
        req,
        action: 'influencer.update',
        entityType: 'Influencer',
        entityId: influencer._id,
        previousValue: pick(before),
        newValue: { ...pick(serialize(influencer)), ...(pendingRecalculated ? { pendingCommissionsRecalculated: pendingRecalculated } : {}) },
      },
      session
    );
  });
  if (data.status === 'inactive') await revokeAllForUser(user._id);
  return { ...serialize(influencer), pendingRecalculated };
}

/**
 * Re-prices this influencer's PENDING commissions after a rate change.
 * Approved / paid / rejected / reversed commissions are never touched.
 */
async function recalcPendingCommissions(influencer, req, session) {
  const settings = await getSettings();
  const list = await Commission.find({ influencerId: influencer._id, status: 'pending' }).session(session || null);
  let updated = 0;
  for (const c of list) {
    const [payment, workshop] = await Promise.all([
      Payment.findById(c.paymentId).session(session || null).lean(),
      Workshop.findById(c.workshopId).session(session || null).lean(),
    ]);
    if (!payment) continue;
    const rate = resolveCommissionRate({ influencer, workshop, settings });
    if (rate === c.commissionRate) continue;
    const previous = c.commissionAmount;
    const calc = calculateCommission({ amount: payment.amount, refundedAmount: payment.refundedAmount, gatewayFee: payment.gatewayFee, rate, settings });
    Object.assign(c, calc);
    c.history.push({ status: 'pending', by: req.user._id, note: `Rate changed to ${rate}% (${previous} -> ${calc.commissionAmount} paise)` });
    await c.save(so(session));
    updated += 1;
  }
  return updated;
}

const pick = (s) => ({
  subdomain: s.subdomain,
  commissionRate: s.commissionRate,
  status: s.status,
  instagramUsername: s.instagramUsername,
  name: s.user?.name,
  email: s.user?.email,
  phone: s.user?.phone,
});

async function resetPassword(id, req) {
  const influencer = await Influencer.findById(id).populate('userId');
  if (!influencer) throw ApiError.notFound('Influencer not found');
  const user = await User.findById(influencer.userId._id);
  const tempPassword = generatePassword();
  await user.setPassword(tempPassword);
  user.mustChangePassword = true;
  await user.save();
  await revokeAllForUser(user._id);
  await recordAudit({ req, action: 'influencer.reset_password', entityType: 'Influencer', entityId: influencer._id });
  await emailService.sendTemplate('passwordChangedByAdmin', user.email, { name: user.name, tempPassword, loginUrl: `${env.frontendUrl}/influencer/login` });
  return { tempPassword };
}

async function list(query) {
  const { page, limit, skip, sort } = parseListQuery(query, { allowedSort: ['createdAt', 'influencerCode', 'subdomain', 'status'] });
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search.slice(0, 100)), 'i');
    const users = await User.find({ role: 'influencer', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id').lean();
    filter.$or = [{ influencerCode: rx }, { subdomain: rx }, { instagramUsername: rx }, { userId: { $in: users.map((u) => u._id) } }];
  }
  const [items, total] = await Promise.all([
    Influencer.find(filter).populate('userId', 'name email phone status lastLoginAt').sort(sort).skip(skip).limit(limit),
    Influencer.countDocuments(filter),
  ]);
  const stats = await statsFor(items.map((i) => i._id));
  return {
    items: items.map((i) => ({ ...serialize(i), stats: stats.get(String(i._id)) || emptyStats() })),
    meta: buildMeta(total, page, limit),
  };
}

const emptyStats = () => ({ clicks: 0, leads: 0, paid: 0, revenue: 0, commission: 0, commissionPending: 0, commissionPaid: 0 });

/** Batched per-influencer stats for a page of influencers */
async function statsFor(ids) {
  const objIds = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
  const match = { influencerId: { $in: objIds } };
  const [clicks, leads, revenue, commissions] = await Promise.all([
    ReferralClick.aggregate([{ $match: match }, { $group: { _id: '$influencerId', n: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$influencerId',
          n: { $sum: 1 },
          paid: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded']] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...match, status: 'captured' } },
      { $group: { _id: '$influencerId', gross: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } },
    ]),
    Commission.aggregate([{ $match: match }, { $group: { _id: { i: '$influencerId', s: '$status' }, amount: { $sum: '$commissionAmount' } } }]),
  ]);
  const map = new Map(ids.map((id) => [String(id), emptyStats()]));
  clicks.forEach((c) => (map.get(String(c._id)).clicks = c.n));
  leads.forEach((l) => Object.assign(map.get(String(l._id)), { leads: l.n, paid: l.paid }));
  revenue.forEach((r) => (map.get(String(r._id)).revenue = r.gross - r.refunded));
  commissions.forEach((c) => {
    const s = map.get(String(c._id.i));
    if (['pending', 'approved', 'paid'].includes(c._id.s)) s.commission += c.amount;
    if (['pending', 'approved'].includes(c._id.s)) s.commissionPending += c.amount;
    if (c._id.s === 'paid') s.commissionPaid += c.amount;
  });
  return map;
}

async function getById(id, { revealPayout = false } = {}) {
  const sel = revealPayout ? '+payoutDetails.accountNumberEnc +payoutDetails.upiIdEnc' : '';
  const influencer = await Influencer.findById(id).select(sel).populate('userId', 'name email phone status lastLoginAt');
  if (!influencer) throw ApiError.notFound('Influencer not found');
  const stats = await statsFor([influencer._id]);
  return { ...serialize(influencer, { revealPayout }), stats: stats.get(String(influencer._id)) };
}

async function updateSelf(influencer, user, data) {
  for (const k of ['name', 'phone']) if (data[k] !== undefined) user[k] = data[k];
  for (const k of ['instagramUsername', 'bio']) if (data[k] !== undefined) influencer[k] = data[k];
  await user.save();
  await influencer.save();
  influencer.userId = user;
  return serialize(influencer);
}

async function updatePayoutDetails(influencer, data) {
  const p = {
    method: data.method,
    accountHolderName: data.accountHolderName,
    bankName: data.method === 'bank' ? data.bankName : undefined,
    ifsc: data.method === 'bank' ? data.ifsc : undefined,
    accountNumberEnc: data.method === 'bank' ? encrypt(data.accountNumber) : undefined,
    accountNumberLast4: data.method === 'bank' ? data.accountNumber.slice(-4) : undefined,
    upiIdEnc: data.method === 'upi' ? encrypt(data.upiId) : undefined,
    upiMasked: data.method === 'upi' ? data.upiId.replace(/^(.{2}).*(@.*)$/, '$1****$2') : undefined,
    panLast4: data.pan ? data.pan.slice(-4) : influencer.payoutDetails?.panLast4,
    updatedAt: new Date(),
  };
  await Influencer.updateOne({ _id: influencer._id }, { $set: { payoutDetails: p } });
  return maskPayout(p);
}

module.exports = { create, update, resetPassword, list, getById, updateSelf, updatePayoutDetails, serialize, referralUrlFor, statsFor, maskPayout };
