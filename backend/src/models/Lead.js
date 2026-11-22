const mongoose = require('mongoose');
const {
  REGISTRATION_STATUS,
  LEAD_PAYMENT_STATUS,
  ATTENDANCE_STATUS,
  ATTRIBUTION_METHODS,
  WORKSHOP_MODES,
} = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    phoneNormalized: { type: String, required: true },
    city: { type: String, trim: true, maxlength: 80 },
    workshopId: { type: ObjectId, ref: 'Workshop', required: true },
    mode: { type: String, enum: WORKSHOP_MODES },
    referralSource: { type: String, trim: true, maxlength: 80 },
    userId: { type: ObjectId, ref: 'User', index: true },

    // Attribution (always resolved server-side)
    influencerId: { type: ObjectId, ref: 'Influencer', default: null },
    referralCode: { type: String, uppercase: true, trim: true },
    referralSubdomain: { type: String, lowercase: true, trim: true },
    campaignId: { type: String, trim: true },
    clickId: { type: ObjectId, ref: 'ReferralClick' },
    attributionMethod: { type: String, enum: ATTRIBUTION_METHODS, default: 'none' },
    attributedAt: Date,
    utmSource: { type: String, trim: true, maxlength: 120 },
    utmMedium: { type: String, trim: true, maxlength: 120 },
    utmCampaign: { type: String, trim: true, maxlength: 120 },
    utmContent: { type: String, trim: true, maxlength: 120 },

    registrationStatus: { type: String, enum: REGISTRATION_STATUS, default: 'registered' },
    paymentStatus: { type: String, enum: LEAD_PAYMENT_STATUS, default: 'pending' },
    attendanceStatus: { type: String, enum: ATTENDANCE_STATUS, default: 'pending' },
    consentAt: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 2000 },

    // Lets an anonymous registrant pay / view their registration without an account
    accessTokenHashes: { type: [String], select: false, default: undefined },
    ipHash: { type: String, select: false },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// Duplicate prevention: one registration per email and per phone within a workshop campaign
leadSchema.index({ workshopId: 1, email: 1 }, { unique: true });
leadSchema.index({ workshopId: 1, phoneNormalized: 1 }, { unique: true });
leadSchema.index({ influencerId: 1, createdAt: -1 });
leadSchema.index({ workshopId: 1, paymentStatus: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
