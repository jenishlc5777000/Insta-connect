const { z } = require('zod');
const {
  WORKSHOP_STATUS,
  WORKSHOP_MODES,
  REGISTRATION_STATUS,
  ATTENDANCE_STATUS,
  RESOURCE_TYPES,
  USER_STATUS,
  INFLUENCER_STATUS,
} = require('../config/constants');
const { SUBDOMAIN_PATTERN } = require('../utils/hostname');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{8,18}$/, 'Enter a valid phone number')
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid phone number');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
const name = z.string().trim().min(2, 'Name is too short').max(120);
const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
const rate = z.number().min(0).max(100);
const paise = z.number().int().min(0);
const url = z.string().trim().url().max(500);

/* ---------------------------------- Auth ---------------------------------- */
const auth = {
  register: z.object({ name, email, phone: phone.optional(), password }),
  login: z.object({
    email,
    password: z.string().min(1, 'Password is required').max(128),
    portal: z.enum(['admin', 'influencer', 'customer']).optional(),
  }),
  forgot: z.object({ email }),
  reset: z.object({ token: z.string().min(20).max(200), password }),
  verifyEmail: z.object({ token: z.string().min(20).max(200) }),
  changePassword: z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }),
};

/* ------------------------------- Influencers ------------------------------ */
const subdomain = z.string().trim().toLowerCase().regex(SUBDOMAIN_PATTERN, 'Use 3-32 lowercase letters, numbers or hyphens');
const instagram = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, 'Invalid Instagram username'))
  .optional();

const influencer = {
  create: z.object({
    name,
    email,
    phone: phone.optional(),
    subdomain,
    commissionRate: rate.nullable().optional(),
    instagramUsername: instagram,
    bio: optionalText(500),
    password: password.optional(),
    sendWelcomeEmail: z.boolean().optional().default(true),
  }),
  update: z.object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    subdomain: subdomain.optional(),
    commissionRate: rate.nullable().optional(),
    instagramUsername: instagram,
    bio: optionalText(500),
    status: z.enum(INFLUENCER_STATUS).optional(),
    // Re-price this influencer's pending commissions with the new rate
    applyToPendingCommissions: z.boolean().optional(),
  }),
  status: z.object({ status: z.enum(INFLUENCER_STATUS) }),
  selfUpdate: z.object({
    name: name.optional(),
    phone: phone.optional(),
    instagramUsername: instagram,
    bio: optionalText(500),
  }),
  payoutDetails: z
    .object({
      method: z.enum(['bank', 'upi']),
      accountHolderName: z.string().trim().min(2).max(120),
      bankName: optionalText(120),
      ifsc: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code')
        .optional(),
      accountNumber: z.string().trim().regex(/^[0-9]{6,18}$/, 'Invalid account number').optional(),
      upiId: z.string().trim().regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID').optional(),
      pan: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN')
        .optional(),
    })
    .superRefine((v, ctx) => {
      if (v.method === 'bank') {
        if (!v.accountNumber) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'Account number is required' });
        if (!v.ifsc) ctx.addIssue({ code: 'custom', path: ['ifsc'], message: 'IFSC is required' });
      }
      if (v.method === 'upi' && !v.upiId) ctx.addIssue({ code: 'custom', path: ['upiId'], message: 'UPI ID is required' });
    }),
};

/* -------------------------------- Workshops ------------------------------- */
const dateInput = z.coerce.date({ invalid_type_error: 'Invalid date' });
// '' is a deliberate "clear this field" value on update
const clearableText = (max) => z.string().trim().max(max).optional();
const clearableUrl = url.or(z.literal('')).optional();
const workshopBase = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and hyphens')
    .max(80)
    .optional(),
  tagline: clearableText(240),
  description: clearableText(5000),
  startDate: dateInput,
  endDate: dateInput,
  mode: z.enum(WORKSHOP_MODES),
  location: clearableText(300),
  meetingLink: clearableUrl,
  price: paise,
  discountPrice: paise.nullable().optional(),
  commissionRate: rate.nullable().optional(),
  registrationDeadline: dateInput.nullable().optional(),
  capacity: z.number().int().min(0).optional(),
  status: z.enum(WORKSHOP_STATUS).optional(),
  featured: z.boolean().optional(),
  bannerImage: clearableUrl,
  learnings: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  benefits: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  curriculum: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: optionalText(1000),
        duration: optionalText(60),
      })
    )
    .max(50)
    .optional(),
  trainer: z
    .object({
      name: optionalText(120),
      title: optionalText(160),
      bio: optionalText(2000),
      photo: clearableUrl,
    })
    .optional(),
  faqs: z
    .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(2000) }))
    .max(50)
    .optional(),
});
const workshop = {
  create: workshopBase.refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'End must be after start' }),
  update: workshopBase.partial(),
};

/* ---------------------------------- Leads --------------------------------- */
const utm = z
  .object({
    source: optionalText(120),
    medium: optionalText(120),
    campaign: optionalText(120),
    content: optionalText(120),
  })
  .optional();

const lead = {
  register: z
    .object({
      name,
      email,
      phone,
      city: optionalText(80),
      workshopId: objectId.optional(),
      workshopSlug: z.string().trim().toLowerCase().max(80).optional(),
      mode: z.enum(WORKSHOP_MODES).optional(),
      referralSource: optionalText(80),
      // Informational only: always validated against the database server-side
      referralCode: optionalText(40),
      utm,
      consent: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and privacy policy' }) }),
    })
    .refine((v) => v.workshopId || v.workshopSlug, { path: ['workshopId'], message: 'Select a workshop' }),
  adminUpdate: z.object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    city: optionalText(80),
    mode: z.enum(WORKSHOP_MODES).optional(),
    registrationStatus: z.enum(REGISTRATION_STATUS).optional(),
    attendanceStatus: z.enum(ATTENDANCE_STATUS).optional(),
    notes: optionalText(2000),
  }),
  attribution: z.object({
    influencerId: objectId.nullable(),
    reason: z.string().trim().min(5, 'Please give a reason (min 5 characters)').max(1000),
  }),
  attendance: z.object({ attendanceStatus: z.enum(ATTENDANCE_STATUS) }),
  bulkAttendance: z.object({
    leadIds: z.array(objectId).min(1).max(500),
    attendanceStatus: z.enum(ATTENDANCE_STATUS),
  }),
  bulkDelete: z.object({ leadIds: z.array(objectId).min(1).max(500) }),
};

/* -------------------------------- Referrals ------------------------------- */
const referral = {
  track: z.object({
    path: z.string().max(500).optional(),
    workshopSlug: z.string().trim().toLowerCase().max(80).optional(),
    ref: z.string().trim().max(40).optional(),
    referrer: z.string().max(500).optional(),
    utm,
  }),
};

/* -------------------------------- Payments -------------------------------- */
const payment = {
  order: z.object({ leadId: objectId, accessToken: z.string().max(200).optional() }),
  verify: z.object({
    razorpay_order_id: z.string().min(1).max(100),
    razorpay_payment_id: z.string().min(1).max(100),
    razorpay_signature: z.string().min(1).max(200),
  }),
  mockComplete: z.object({ orderId: z.string().min(1).max(100), outcome: z.enum(['success', 'failure']).default('success') }),
  refund: z.object({ amount: z.number().int().min(100).optional(), reason: z.string().trim().min(3).max(500) }),
};

/* ------------------------------ Commissions ------------------------------- */
const commission = {
  reject: z.object({ reason: z.string().trim().min(3).max(500) }),
  bulk: z.object({
    ids: z.array(objectId).min(1).max(500),
    action: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional(),
  }),
};

const payout = {
  create: z.object({
    influencerId: objectId,
    commissionIds: z.array(objectId).min(1).max(1000),
    paymentMethod: z.enum(['bank_transfer', 'upi', 'cheque', 'cash', 'other']),
    transactionId: optionalText(120),
    notes: optionalText(1000),
    markPaid: z.boolean().default(false),
  }),
  markPaid: z.object({ transactionId: z.string().trim().min(2).max(120), notes: optionalText(1000) }),
  fail: z.object({ notes: z.string().trim().min(3).max(1000) }),
};

/* ---------------------------- Settings / Admin ---------------------------- */
const settings = z.object({
  siteName: z.string().trim().min(2).max(80).optional(),
  supportEmail: email.optional(),
  supportPhone: optionalText(30),
  socialLinks: z
    .object({
      instagram: url.or(z.literal('')).optional(),
      youtube: url.or(z.literal('')).optional(),
      linkedin: url.or(z.literal('')).optional(),
      facebook: url.or(z.literal('')).optional(),
      x: url.or(z.literal('')).optional(),
      whatsapp: url.or(z.literal('')).optional(),
    })
    .optional(),
  defaultCommissionRate: rate.optional(),
  attributionWindowDays: z.number().int().min(1).max(365).optional(),
  attributionModel: z.enum(['first', 'last']).optional(),
  taxRatePercent: z.number().min(0).max(50).optional(),
  excludeTaxFromCommission: z.boolean().optional(),
  deductGatewayFees: z.boolean().optional(),
  gatewayFeePercent: z.number().min(0).max(10).optional(),
  autoApproveCommissions: z.boolean().optional(),
  minimumPayoutAmount: paise.optional(),
  featuredWorkshopId: objectId.nullable().optional(),
  reservedSubdomains: z.array(z.string().trim().toLowerCase().max(63)).max(200).optional(),
});

const resource = {
  create: z.object({
    title: z.string().trim().min(2).max(160),
    type: z.enum(RESOURCE_TYPES),
    workshopId: objectId.optional().or(z.literal('').transform(() => undefined)),
    textContent: optionalText(10000),
  }),
};

const user = { status: z.object({ status: z.enum(USER_STATUS) }) };

const application = {
  apply: z.object({
    name,
    email,
    phone,
    instagramUsername: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase())
      .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/, 'Enter a valid Instagram username')),
    followers: z.coerce.number({ invalid_type_error: 'Enter your follower count' }).int().min(0).max(1e9),
    avgViews: z.object(
      {
        instagram: z.coerce.number({ invalid_type_error: 'Select your average Reel views' }).int().min(0).max(1e10),
        youtube: z.coerce.number().int().min(0).max(1e10).nullable().optional(),
        facebook: z.coerce.number().int().min(0).max(1e10).nullable().optional(),
      },
      { required_error: 'Select your average video views' }
    ),
    youtubeChannel: url.optional().or(z.literal('').transform(() => undefined)),
    facebookPage: url.optional().or(z.literal('').transform(() => undefined)),
    niche: optionalText(80),
    city: optionalText(80),
    preferredSubdomain: subdomain.optional().or(z.literal('').transform(() => undefined)),
    message: optionalText(1000),
    password,
    consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the partner terms' }) }),
  }),
  approve: z.object({
    subdomain: subdomain.optional(),
    commissionRate: rate.nullable().optional(),
    sendWelcomeEmail: z.boolean().optional().default(true),
  }),
  reject: z.object({ reason: z.string().trim().max(500).optional().default(''), notify: z.boolean().optional().default(true) }),
};

module.exports = { application, auth, influencer, workshop, lead, referral, payment, commission, payout, settings, resource, user, objectId };
