const mongoose = require('mongoose');
const { INFLUENCER_STATUS } = require('../config/constants');
const { SUBDOMAIN_PATTERN } = require('../utils/hostname');

const payoutDetailsSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['bank', 'upi'], default: 'upi' },
    accountHolderName: { type: String, trim: true, maxlength: 120 },
    bankName: { type: String, trim: true, maxlength: 120 },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 11 },
    // Encrypted at rest (AES-256-GCM); only last digits are kept in clear for display
    accountNumberEnc: { type: String, select: false },
    accountNumberLast4: String,
    upiIdEnc: { type: String, select: false },
    upiMasked: String,
    panLast4: String,
    updatedAt: Date,
  },
  { _id: false }
);

const influencerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    influencerCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [SUBDOMAIN_PATTERN, 'Subdomain must be 3-32 lowercase letters, numbers or hyphens'],
    },
    // null => inherit the workshop / platform default rate
    commissionRate: { type: Number, min: 0, max: 100, default: null },
    instagramUsername: { type: String, trim: true, maxlength: 60 },
    profileImage: String,
    bio: { type: String, trim: true, maxlength: 500 },
    audience: {
      followers: Number,
      niche: String,
      avgViews: { instagram: Number, youtube: Number, facebook: Number },
      youtubeChannel: String,
      facebookPage: String,
    },
    status: { type: String, enum: INFLUENCER_STATUS, default: 'active', index: true },
    payoutDetails: { type: payoutDetailsSchema, default: () => ({}) },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Influencer', influencerSchema);
