const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const referralClickSchema = new mongoose.Schema(
  {
    influencerId: { type: ObjectId, ref: 'Influencer', required: true },
    workshopId: { type: ObjectId, ref: 'Workshop', default: null },
    referralCode: { type: String, uppercase: true },
    subdomain: String,
    sessionId: { type: String, required: true },
    landingPath: { type: String, maxlength: 500 },
    referrer: { type: String, maxlength: 500 },
    utmSource: { type: String, maxlength: 120 },
    utmMedium: { type: String, maxlength: 120 },
    utmCampaign: { type: String, maxlength: 120 },
    utmContent: { type: String, maxlength: 120 },
    ipHash: String,
    userAgent: { type: String, maxlength: 400 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { versionKey: false } }
);

referralClickSchema.index({ influencerId: 1, createdAt: -1 });
referralClickSchema.index({ sessionId: 1, influencerId: 1, createdAt: -1 });
referralClickSchema.index({ workshopId: 1, createdAt: -1 });

module.exports = mongoose.model('ReferralClick', referralClickSchema);
