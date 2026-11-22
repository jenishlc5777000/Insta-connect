const mongoose = require('mongoose');
const { WORKSHOP_STATUS, WORKSHOP_MODES } = require('../config/constants');

const workshopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    campaignCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    tagline: { type: String, trim: true, maxlength: 240 },
    description: { type: String, trim: true, maxlength: 5000 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    mode: { type: String, enum: WORKSHOP_MODES, required: true },
    location: { type: String, trim: true, maxlength: 300 },
    meetingLink: { type: String, trim: true, maxlength: 500, select: false },
    // Money is stored in paise (integer) everywhere
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    discountPrice: { type: Number, min: 0, default: null },
    currency: { type: String, default: 'INR' },
    commissionRate: { type: Number, min: 0, max: 100, default: null },
    registrationDeadline: Date,
    capacity: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    status: { type: String, enum: WORKSHOP_STATUS, default: 'draft', index: true },
    featured: { type: Boolean, default: false },
    bannerImage: String,
    learnings: [{ type: String, trim: true, maxlength: 300 }],
    benefits: [{ type: String, trim: true, maxlength: 300 }],
    curriculum: [
      {
        _id: false,
        title: { type: String, trim: true, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 1000 },
        duration: { type: String, trim: true, maxlength: 60 },
      },
    ],
    trainer: {
      name: { type: String, trim: true, maxlength: 120 },
      title: { type: String, trim: true, maxlength: 160 },
      bio: { type: String, trim: true, maxlength: 2000 },
      photo: String,
    },
    faqs: [
      {
        _id: false,
        question: { type: String, trim: true, maxlength: 300 },
        answer: { type: String, trim: true, maxlength: 2000 },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } }
);

workshopSchema.index({ status: 1, startDate: 1 });

workshopSchema.virtual('effectivePrice').get(function effectivePrice() {
  return this.discountPrice !== null && this.discountPrice !== undefined && this.discountPrice < this.price
    ? this.discountPrice
    : this.price;
});

workshopSchema.pre('validate', function validateDates(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  if (this.discountPrice !== null && this.discountPrice !== undefined && this.discountPrice > this.price) {
    this.invalidate('discountPrice', 'Discount price cannot exceed ticket price');
  }
  next();
});

module.exports = mongoose.model('Workshop', workshopSchema);
