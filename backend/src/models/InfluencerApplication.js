const mongoose = require('mongoose');
const { SUBDOMAIN_PATTERN } = require('../utils/hostname');

const { ObjectId } = mongoose.Schema.Types;

/** Public "join as an Instagram influencer" applications, reviewed by admins */
const applicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    instagramUsername: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    followers: { type: Number, required: true, min: 0 },
    // Lower bound of the average-views range the creator selected, per channel
    avgViews: {
      instagram: { type: Number, min: 0, default: null }, // required for new applications by the validator
      youtube: { type: Number, min: 0, default: null },
      facebook: { type: Number, min: 0, default: null },
    },
    youtubeChannel: { type: String, trim: true, maxlength: 300 },
    facebookPage: { type: String, trim: true, maxlength: 300 },
    niche: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 80 },
    preferredSubdomain: { type: String, lowercase: true, trim: true, match: SUBDOMAIN_PATTERN },
    message: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    influencerId: { type: ObjectId, ref: 'Influencer' },
    ipHash: { type: String, select: false },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// Only one open application per email / Instagram handle
applicationSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
applicationSchema.index({ instagramUsername: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
applicationSchema.index({ createdAt: -1 });

module.exports = mongoose.models.InfluencerApplication || mongoose.model('InfluencerApplication', applicationSchema);
