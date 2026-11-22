const mongoose = require('mongoose');
const { PAYMENT_STATUS, REFUND_STATUS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    reason: String,
    initiatedBy: { type: ObjectId, ref: 'User' },
    processedAt: Date,
  },
  { _id: false, timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    leadId: { type: ObjectId, ref: 'Lead', required: true, index: true },
    workshopId: { type: ObjectId, ref: 'Workshop', required: true, index: true },
    influencerId: { type: ObjectId, ref: 'Influencer', default: null, index: true },
    amount: { type: Number, required: true, min: 0 }, // paise
    currency: { type: String, default: 'INR' },
    gateway: { type: String, enum: ['razorpay', 'mock'], required: true },
    gatewayOrderId: { type: String, required: true, unique: true },
    gatewayPaymentId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: PAYMENT_STATUS, default: 'created', index: true },
    method: String,
    gatewayFee: { type: Number, default: 0 },
    gatewayTax: { type: Number, default: 0 },
    failureReason: String,
    capturedAt: Date,
    refundStatus: { type: String, enum: REFUND_STATUS, default: 'none' },
    refundedAmount: { type: Number, default: 0 },
    refunds: [refundSchema],
    verifiedVia: { type: String, enum: ['checkout', 'webhook', 'mock'] },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
