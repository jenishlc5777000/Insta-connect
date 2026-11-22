module.exports = {
  ROLES: ['admin', 'influencer', 'customer'],
  USER_STATUS: ['active', 'inactive', 'suspended'],
  INFLUENCER_STATUS: ['active', 'inactive'],
  WORKSHOP_STATUS: ['draft', 'published', 'completed', 'cancelled'],
  WORKSHOP_MODES: ['online', 'offline', 'hybrid'],
  REGISTRATION_STATUS: ['registered', 'confirmed', 'cancelled'],
  LEAD_PAYMENT_STATUS: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'not_required'],
  ATTENDANCE_STATUS: ['pending', 'attended', 'absent'],
  ATTRIBUTION_METHODS: ['subdomain', 'link', 'code', 'manual', 'none'],
  PAYMENT_STATUS: ['created', 'authorized', 'captured', 'failed'],
  REFUND_STATUS: ['none', 'pending', 'partial', 'full'],
  COMMISSION_STATUS: ['pending', 'approved', 'paid', 'rejected', 'reversed'],
  PAYOUT_STATUS: ['pending', 'paid', 'failed'],
  RESOURCE_TYPES: ['poster', 'story', 'reel', 'caption', 'hashtags', 'script', 'other'],

  COOKIES: {
    ACCESS: 'jc_at',
    REFRESH: 'jc_rt',
    REFERRAL: 'jc_ref',
    SESSION: 'jc_sid',
  },

  DEFAULT_RESERVED_SUBDOMAINS: [
    'www', 'api', 'admin', 'app', 'mail', 'smtp', 'ftp', 'static', 'cdn', 'assets',
    'dashboard', 'influencer', 'influencers', 'staging', 'dev', 'test', 'blog', 'help',
    'support', 'status', 'docs', 'login', 'register', 'pay', 'payments', 'webhook',
  ],
};
