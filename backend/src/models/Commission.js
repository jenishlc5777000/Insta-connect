const mongoose = require('mongoose');
const { COMMISSION_STATUS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const commissionSchema = new mongoose.Schema(
  {
    influencerId: { type: ObjectId, ref: 'Influencer', required: true },
    leadId: { type: ObjectId, ref: 'Lead', required: true },
    workshopId: { type: ObjectId, ref: 'Workshop', required: true },
    // One commission per payment - prevents duplicates even under concurrent webhooks
    paymentId: { type: ObjectId, ref: 'Payment', required: true, unique: true },
    grossAmount: { type: Number, required: true, min: 0 },
    deductions: {
      tax: { type: Number, default: 0 },
      gatewayFee: { type: Number, default: 0 },
      refunds: { type: Number, default: 0 },
    },
    eligibleNetRevenue: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    // Amount to recover when a commission that was already paid out is refunded
    clawbackAmount: { type: Number, default: 0 },
    status: { type: String, enum: COMMISSION_STATUS, default: 'pending' },
    approvedAt: Date,
    approvedBy: { type: ObjectId, ref: 'User' },
    paidAt: Date,
    payoutId: { type: ObjectId, ref: 'Payout', default: null },
    rejectionReason: String,
    reversedAt: Date,
    reversalReason: String,
    history: [
      {
        _id: false,
        status: String,
        note: String,
        by: { type: ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

commissionSchema.index({ influencerId: 1, status: 1, createdAt: -1 });
commissionSchema.index({ workshopId: 1, status: 1 });
commissionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Commission', commissionSchema);
