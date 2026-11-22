const mongoose = require('mongoose');
const { PAYOUT_STATUS, RESOURCE_TYPES } = require('../config/constants');

const { ObjectId, Mixed } = mongoose.Schema.Types;

const User = require('./User');
const RefreshToken = require('./RefreshToken');
const Influencer = require('./Influencer');
const Workshop = require('./Workshop');
const Lead = require('./Lead');
const ReferralClick = require('./ReferralClick');
const Payment = require('./Payment');
const Commission = require('./Commission');
const InfluencerApplication = require('./InfluencerApplication');

/* ---------------------------------- Payout --------------------------------- */
const payoutSchema = new mongoose.Schema(
  {
    influencerId: { type: ObjectId, ref: 'Influencer', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    commissionIds: [{ type: ObjectId, ref: 'Commission' }],
    paymentMethod: { type: String, enum: ['bank_transfer', 'upi', 'cheque', 'cash', 'other'], required: true },
    transactionId: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: PAYOUT_STATUS, default: 'pending', index: true },
    paidAt: Date,
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);
const Payout = mongoose.models.Payout || mongoose.model('Payout', payoutSchema);

/* --------------------------------- AuditLog -------------------------------- */
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: ObjectId, required: true },
    previousValue: Mixed,
    newValue: Mixed,
    reason: { type: String, maxlength: 1000 },
    ipHash: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { versionKey: false } }
);
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

/* ---------------------------------- Setting -------------------------------- */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    siteName: { type: String, default: 'JenCorps' },
    supportEmail: { type: String, default: 'support@jencorps.com' },
    supportPhone: { type: String, default: '' },
    socialLinks: {
      instagram: { type: String, default: '' },
      youtube: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      facebook: { type: String, default: '' },
      x: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
    },
    defaultCommissionRate: { type: Number, min: 0, max: 100, default: 50 },
    attributionWindowDays: { type: Number, min: 1, max: 365, default: 30 },
    attributionModel: { type: String, enum: ['first', 'last'], default: 'first' },
    taxRatePercent: { type: Number, min: 0, max: 50, default: 18 },
    excludeTaxFromCommission: { type: Boolean, default: false },
    deductGatewayFees: { type: Boolean, default: false },
    gatewayFeePercent: { type: Number, min: 0, max: 10, default: 2 },
    autoApproveCommissions: { type: Boolean, default: false },
    minimumPayoutAmount: { type: Number, min: 0, default: 0 }, // paise
    featuredWorkshopId: { type: ObjectId, ref: 'Workshop', default: null },
    reservedSubdomains: [String],
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

/* ------------------------------- WebhookEvent ------------------------------ */
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: String,
    status: { type: String, enum: ['processing', 'processed', 'ignored'], default: 'processing' },
    processedAt: Date,
  },
  { timestamps: true }
);
const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);

/* --------------------------------- Resource -------------------------------- */
const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: RESOURCE_TYPES, required: true },
    workshopId: { type: ObjectId, ref: 'Workshop', default: null, index: true },
    fileUrl: String,
    filePublicId: String,
    mimeType: String,
    textContent: { type: String, trim: true, maxlength: 10000 },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);
const Resource = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);

/* ---------------------------------- Counter -------------------------------- */
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

module.exports = {
  User,
  RefreshToken,
  Influencer,
  Workshop,
  Lead,
  ReferralClick,
  Payment,
  Commission,
  Payout,
  AuditLog,
  Setting,
  WebhookEvent,
  Resource,
  Counter,
  InfluencerApplication,
};
