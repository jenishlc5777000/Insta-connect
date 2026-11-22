/**
 * Admin delete operations with guard rails: records tied to real money (successful payments,
 * earned / paid commissions, payouts) cannot be deleted. Every delete is audit-logged.
 */
const ApiError = require('../utils/ApiError');
const { Lead, Payment, Commission, Influencer, User, RefreshToken, ReferralClick, Payout } = require('../models');
const InfluencerApplication = require('../models/InfluencerApplication');
const { so } = require('../utils/helpers');
const { withTransaction } = require('../utils/transaction');
const { recordAudit } = require('./auditService');
const { deleteFile } = require('./storageService');
const { revokeAllForUser } = require('./tokenService');

/** Why a lead can't be deleted, or null if it can */
async function leadBlocker(lead, session) {
  const paid = await Payment.exists({ leadId: lead._id, status: 'captured', refundStatus: { $ne: 'full' } }).session(session || null);
  if (paid) return 'has a successful payment. Refund it first (Payments → Refund), then delete.';
  const paidOut = await Commission.exists({ leadId: lead._id, $or: [{ payoutId: { $ne: null } }, { status: { $in: ['approved', 'paid'] } }] }).session(session || null);
  if (paidOut) return 'has a commission that was approved or paid out.';
  return null;
}

async function deleteLeads(ids, req) {
  const unique = [...new Set(ids.map(String))];
  const deleted = [];
  const blocked = [];
  for (const id of unique) {
    await withTransaction(async (session) => {
      const lead = await Lead.findById(id).session(session || null);
      if (!lead) {
        blocked.push({ id, name: null, reason: 'not found' });
        return;
      }
      const reason = await leadBlocker(lead, session);
      if (reason) {
        blocked.push({ id, name: lead.name, reason: `${lead.name} ${reason}` });
        return;
      }
      const payments = await Payment.deleteMany({ leadId: lead._id }, so(session));
      const commissions = await Commission.deleteMany({ leadId: lead._id }, so(session));
      await Lead.deleteOne({ _id: lead._id }, so(session));
      await recordAudit(
        {
          req,
          action: 'lead.delete',
          entityType: 'Lead',
          entityId: lead._id,
          previousValue: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            workshopId: lead.workshopId,
            influencerId: lead.influencerId,
            paymentStatus: lead.paymentStatus,
            removedPayments: payments.deletedCount,
            removedCommissions: commissions.deletedCount,
          },
        },
        session
      );
      deleted.push({ id, name: lead.name });
    });
  }
  return { deleted: deleted.length, deletedLeads: deleted, blocked };
}

async function deleteInfluencer(id, req) {
  const influencer = await Influencer.findById(id).populate('userId', 'name email');
  if (!influencer) throw ApiError.notFound('Influencer not found');

  const earned = await Commission.exists({ influencerId: influencer._id, $or: [{ status: { $in: ['pending', 'approved', 'paid'] } }, { payoutId: { $ne: null } }] });
  const payouts = await Payout.exists({ influencerId: influencer._id });
  if (earned || payouts) {
    throw ApiError.conflict(
      `${influencer.userId?.name || 'This influencer'} has earned commissions or payouts, so their record must be kept for your accounts. Deactivate the account instead (they can no longer log in or receive new referrals).`
    );
  }

  const userId = influencer.userId?._id;
  const summary = await withTransaction(async (session) => {
    const detached = await Lead.updateMany(
      { influencerId: influencer._id },
      { $set: { influencerId: null, attributionMethod: 'none' }, $unset: { referralCode: 1, referralSubdomain: 1 } },
      so(session)
    );
    await Payment.updateMany({ influencerId: influencer._id }, { influencerId: null }, so(session));
    const commissions = await Commission.deleteMany({ influencerId: influencer._id }, so(session)); // only rejected/reversed remain
    const clicks = await ReferralClick.deleteMany({ influencerId: influencer._id }, so(session));
    await InfluencerApplication.updateMany({ influencerId: influencer._id }, { $unset: { influencerId: 1 } }, so(session));
    await Influencer.deleteOne({ _id: influencer._id }, so(session));
    if (userId) await User.deleteOne({ _id: userId, role: 'influencer' }, so(session));
    await recordAudit(
      {
        req,
        action: 'influencer.delete',
        entityType: 'Influencer',
        entityId: influencer._id,
        previousValue: {
          influencerCode: influencer.influencerCode,
          subdomain: influencer.subdomain,
          name: influencer.userId?.name,
          email: influencer.userId?.email,
          leadsDetached: detached.modifiedCount,
          clicksRemoved: clicks.deletedCount,
          commissionsRemoved: commissions.deletedCount,
        },
      },
      session
    );
    return { leadsDetached: detached.modifiedCount, clicksRemoved: clicks.deletedCount };
  });

  if (userId) {
    await RefreshToken.deleteMany({ userId });
    await revokeAllForUser(userId).catch(() => {});
  }
  if (influencer.profileImage) await deleteFile(influencer.profileImage).catch(() => {});
  return { deleted: true, name: influencer.userId?.name, ...summary };
}

async function deleteApplication(id, req) {
  const app = await InfluencerApplication.findById(id);
  if (!app) throw ApiError.notFound('Application not found');
  await app.deleteOne();
  await recordAudit({
    req,
    action: 'application.delete',
    entityType: 'InfluencerApplication',
    entityId: app._id,
    previousValue: { name: app.name, email: app.email, instagramUsername: app.instagramUsername, status: app.status },
  });
  return { deleted: true, name: app.name };
}

module.exports = { deleteLeads, deleteInfluencer, deleteApplication };
