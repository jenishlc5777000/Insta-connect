const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { Lead, Workshop, User, Payment, Commission, Influencer } = require('../models');
const { normalizePhone, randomToken, sha256, hashIp, so, safeEqual } = require('../utils/helpers');
const { resolveAttributionForRegistration } = require('./referralService');
const emailService = require('./emailService');
const { withTransaction } = require('../utils/transaction');
const { recordAudit } = require('./auditService');
const { resolveCommissionRate, calculateCommission, createForPayment } = require('./commissionService');
const { getSettings } = require('./settingsService');

const SEAT_HOLDING = { $in: ['paid', 'not_required', 'partially_refunded'] };

async function seatsTaken(workshopId) {
  return Lead.countDocuments({ workshopId, paymentStatus: SEAT_HOLDING, registrationStatus: { $ne: 'cancelled' } });
}

/** Throws when the workshop cannot accept registrations right now */
async function assertOpenForRegistration(workshop) {
  if (!workshop || workshop.status !== 'published') throw ApiError.notFound('This workshop is not open for registration');
  const now = new Date();
  if (workshop.registrationDeadline && workshop.registrationDeadline < now) {
    throw ApiError.badRequest('Registration for this workshop has closed');
  }
  if (workshop.endDate < now) throw ApiError.badRequest('This workshop has already ended');
  if (workshop.capacity > 0 && (await seatsTaken(workshop._id)) >= workshop.capacity) {
    throw ApiError.conflict('This workshop is sold out');
  }
}

const statusUrl = (lead, token) => `${env.frontendUrl}/registration/${lead._id}?token=${token}`;

async function register(req, data) {
  const workshop = data.workshopId
    ? await Workshop.findById(data.workshopId)
    : await Workshop.findOne({ slug: data.workshopSlug });
  await assertOpenForRegistration(workshop);

  const email = data.email.toLowerCase();
  const phoneNormalized = normalizePhone(data.phone);

  const duplicate = await Lead.findOne({ workshopId: workshop._id, $or: [{ email }, { phoneNormalized }] }).select('email').lean();
  if (duplicate) {
    throw ApiError.conflict(
      duplicate.email === email
        ? 'This email is already registered for this workshop'
        : 'This phone number is already registered for this workshop',
      [{ field: duplicate.email === email ? 'email' : 'phone' }]
    );
  }

  const attribution = await resolveAttributionForRegistration(req, { referralCode: data.referralCode });
  const utm = { ...(attribution?.utm || {}), ...Object.fromEntries(Object.entries(data.utm || {}).filter(([, v]) => v)) };

  // Link to an account: the logged-in customer, or a verified account with the same email
  let userId;
  if (req.user && req.user.role === 'customer' && req.user.email === email) userId = req.user._id;
  else {
    const owner = await User.findOne({ email, role: 'customer', emailVerified: true }).select('_id').lean();
    userId = owner?._id;
  }

  const requiresPayment = workshop.effectivePrice > 0;
  const accessToken = randomToken(24);

  const lead = await Lead.create({
    name: data.name,
    email,
    phone: data.phone,
    phoneNormalized,
    city: data.city,
    workshopId: workshop._id,
    mode: data.mode || (workshop.mode === 'hybrid' ? undefined : workshop.mode),
    referralSource: data.referralSource,
    userId,
    influencerId: attribution?.influencer?._id || null,
    referralCode: attribution?.influencer?.influencerCode,
    referralSubdomain: attribution?.influencer?.subdomain,
    campaignId: workshop.campaignCode,
    clickId: attribution?.clickId,
    attributionMethod: attribution ? attribution.method : 'none',
    attributedAt: attribution ? new Date() : undefined,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    utmContent: utm.content,
    registrationStatus: requiresPayment ? 'registered' : 'confirmed',
    paymentStatus: requiresPayment ? 'pending' : 'not_required',
    consentAt: new Date(),
    accessTokenHashes: [sha256(accessToken)],
    ipHash: hashIp(req.ip),
  });

  await emailService.sendTemplate('registrationReceived', email, {
    name: lead.name,
    workshop,
    requiresPayment,
    payUrl: statusUrl(lead, accessToken),
  });

  return {
    lead: publicLead(lead, workshop),
    accessToken,
    requiresPayment,
    amount: workshop.effectivePrice,
    currency: workshop.currency,
  };
}

function publicLead(lead, workshop) {
  return {
    _id: lead._id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    mode: lead.mode,
    registrationStatus: lead.registrationStatus,
    paymentStatus: lead.paymentStatus,
    attendanceStatus: lead.attendanceStatus,
    createdAt: lead.createdAt,
    workshop: workshop
      ? {
          _id: workshop._id,
          title: workshop.title,
          slug: workshop.slug,
          startDate: workshop.startDate,
          endDate: workshop.endDate,
          mode: workshop.mode,
          location: workshop.location,
          price: workshop.price,
          discountPrice: workshop.discountPrice,
          effectivePrice: workshop.effectivePrice,
          bannerImage: workshop.bannerImage,
        }
      : undefined,
  };
}

/** Authorises access to a single lead by its anonymous access token or the owning customer account */
async function getLeadForOwner(leadId, { accessToken, user }) {
  const lead = await Lead.findById(leadId).select('+accessTokenHashes');
  if (!lead) throw ApiError.notFound('Registration not found');
  const hashed = accessToken ? sha256(accessToken) : null;
  const tokenOk = Boolean(hashed && (lead.accessTokenHashes || []).some((h) => safeEqual(hashed, h)));
  const userOk = user && (user.role === 'admin' || (lead.userId && String(lead.userId) === String(user._id)));
  if (!tokenOk && !userOk) throw ApiError.notFound('Registration not found');
  return lead;
}

async function getRegistrationStatus(leadId, auth) {
  const lead = await getLeadForOwner(leadId, auth);
  const paid = ['paid', 'not_required', 'partially_refunded'].includes(lead.paymentStatus);
  const workshop = await Workshop.findById(lead.workshopId).select(paid ? '+meetingLink' : '');
  const result = publicLead(lead, workshop);
  if (paid && workshop?.meetingLink && lead.registrationStatus !== 'cancelled') result.workshop.meetingLink = workshop.meetingLink;
  return result;
}

/**
 * Admin re-attribution. Moves the lead, its payments and any unpaid commission to the new influencer.
 * Every change is audit-logged.
 */
async function reassignAttribution(leadId, { influencerId, reason }, req) {
  return withTransaction(async (session) => {
    const lead = await Lead.findById(leadId).session(session || null);
    if (!lead) throw ApiError.notFound('Lead not found');

    let newInfluencer = null;
    if (influencerId) {
      newInfluencer = await Influencer.findById(influencerId).session(session || null);
      if (!newInfluencer) throw ApiError.badRequest('Influencer not found');
    }
    if (String(lead.influencerId || '') === String(influencerId || '')) {
      throw ApiError.badRequest('Lead is already attributed to this influencer');
    }

    const paidCommission = await Commission.findOne({ leadId: lead._id, status: 'paid' }).session(session || null);
    if (paidCommission) {
      throw ApiError.conflict('Commission for this lead was already paid out. Reverse it before re-attributing.');
    }

    const previous = {
      influencerId: lead.influencerId,
      referralCode: lead.referralCode,
      referralSubdomain: lead.referralSubdomain,
      attributionMethod: lead.attributionMethod,
    };

    lead.influencerId = newInfluencer?._id || null;
    lead.referralCode = newInfluencer?.influencerCode;
    lead.referralSubdomain = newInfluencer?.subdomain;
    lead.attributionMethod = newInfluencer ? 'manual' : 'none';
    lead.attributedAt = new Date();
    await lead.save(so(session));

    await Payment.updateMany({ leadId: lead._id }, { influencerId: lead.influencerId }, so(session));

    // Move or remove open commissions
    const settings = await getSettings();
    const workshop = await Workshop.findById(lead.workshopId).session(session || null).lean();
    const commissions = await Commission.find({ leadId: lead._id, status: { $in: ['pending', 'approved'] } }).session(session || null);
    for (const c of commissions) {
      if (!newInfluencer) {
        c.status = 'reversed';
        c.reversedAt = new Date();
        c.reversalReason = `Attribution removed: ${reason}`;
        c.history.push({ status: 'reversed', by: req.user._id, note: c.reversalReason });
      } else {
        const payment = await Payment.findById(c.paymentId).session(session || null).lean();
        const rate = resolveCommissionRate({ influencer: newInfluencer, workshop, settings });
        const calc = calculateCommission({
          amount: payment.amount,
          refundedAmount: payment.refundedAmount,
          gatewayFee: payment.gatewayFee,
          rate,
          settings,
        });
        Object.assign(c, calc, { influencerId: newInfluencer._id, status: 'pending', approvedAt: undefined });
        c.history.push({ status: 'pending', by: req.user._id, note: `Re-attributed: ${reason}` });
      }
      await c.save(so(session));
    }

    // Payments captured with no previous influencer now earn commission for the new one
    if (newInfluencer) {
      const captured = await Payment.find({ leadId: lead._id, status: 'captured' }).session(session || null);
      for (const p of captured) {
        if (p.refundStatus !== 'full') await createForPayment(p, session);
      }
    }

    await recordAudit(
      {
        req,
        action: 'lead.reassign_attribution',
        entityType: 'Lead',
        entityId: lead._id,
        previousValue: previous,
        newValue: {
          influencerId: lead.influencerId,
          referralCode: lead.referralCode,
          referralSubdomain: lead.referralSubdomain,
          attributionMethod: lead.attributionMethod,
        },
        reason,
      },
      session
    );
    return lead;
  });
}

module.exports = { register, getRegistrationStatus, getLeadForOwner, reassignAttribution, assertOpenForRegistration, publicLead, seatsTaken };
