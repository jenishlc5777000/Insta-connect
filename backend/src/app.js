const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const morgan = require('morgan');
const env = require('./config/env');
const { isAllowedOrigin } = require('./utils/hostname');
const { csrfOriginCheck, sanitizeInput, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const paymentController = require('./controllers/paymentController');
const apiRoutes = require('./routes');

/**
 * Cookie parsing that always runs. cookie-parser skips itself when req.cookies already exists,
 * which is the case on Vercel (its Node runtime pre-populates req.cookies). That would leave
 * req.secret unset (signed cookies throw) and req.signedCookies empty (referral credit lost).
 */
function parseCookies(req, _res, next) {
  const raw = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  req.secret = env.cookieSecret;
  const signed = cookieParser.signedCookies(raw, [env.cookieSecret]); // removes signed entries from raw
  Object.defineProperty(req, 'signedCookies', { value: cookieParser.JSONCookies(signed), writable: true, configurable: true, enumerable: true });
  Object.defineProperty(req, 'cookies', { value: cookieParser.JSONCookies(raw), writable: true, configurable: true, enumerable: true });
  next();
}

function createApp() {
  const app = express();

  // Behind Nginx / a load balancer: needed for req.ip, req.hostname (X-Forwarded-Host) and secure cookies
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploaded images are embedded by the SPA
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );
  app.use(compression());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Razorpay webhook needs the exact raw bytes for signature verification
  app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.webhook);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(parseCookies);
  app.use(sanitizeInput);

  // Locally stored uploads (when Cloudinary is not configured)
  app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', fallthrough: false, dotfiles: 'deny' }));

  app.use('/api/v1', apiLimiter, csrfOriginCheck, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
