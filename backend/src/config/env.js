const path = require('path');
const dotenv = require('dotenv');

// backend/.env takes precedence, then the repo-root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required environment variable: ${name}`);
  return devFallback;
}

const list = (v) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const jwtAccessSecret = required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');

const razorpay = {
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
};
const razorpayConfigured = Boolean(razorpay.keyId && razorpay.keySecret);

const env = {
  nodeEnv,
  isProd,
  isTest,
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/jencorps'),

  jwtAccessSecret,
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlDays: 7,
  cookieSecret: process.env.COOKIE_SECRET || jwtAccessSecret,
  encryptionKey: required('DATA_ENCRYPTION_KEY', 'dev-data-encryption-key'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || (isTest ? 4 : 12)),

  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  baseDomain: (process.env.BASE_DOMAIN || 'localhost').toLowerCase(),
  corsOrigins: list(process.env.CORS_ORIGINS),
  trustProxy: process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY),
  publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),

  razorpay,
  razorpayConfigured,
  // Mock gateway: only outside production, and only when Razorpay is not configured (or explicitly forced)
  paymentMock:
    !isProd &&
    process.env.PAYMENT_MOCK !== 'false' &&
    (process.env.PAYMENT_MOCK === 'true' || !razorpayConfigured),

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'JenCorps <no-reply@jencorps.com>',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  uploadDir: path.resolve(__dirname, '../../uploads'),
  // Serverless hosts (Vercel) have a read-only, non-persistent file system
  isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
};

// Referral links: "subdomain" (arun.jencorps.com) needs a wildcard custom domain.
// "query" (jencorps.com/?ref=INF-1001) works anywhere, e.g. on *.vercel.app.
env.referralLinkMode =
  process.env.REFERRAL_LINK_MODE || (env.baseDomain.endsWith('.vercel.app') ? 'query' : 'subdomain');

// Allow this deployment's own Vercel URLs (production + preview) as origins
for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
  if (v) env.corsOrigins.push(`https://${v}`);
}

env.cookieDomain =
  isProd && env.baseDomain !== 'localhost' ? `.${env.baseDomain}` : undefined;

module.exports = env;
