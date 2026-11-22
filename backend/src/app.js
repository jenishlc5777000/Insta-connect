const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const { isAllowedOrigin } = require('./utils/hostname');
const { csrfOriginCheck, sanitizeInput, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const paymentController = require('./controllers/paymentController');
const apiRoutes = require('./routes');

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
  app.use(cookieParser(env.cookieSecret));
  app.use(sanitizeInput);

  // Locally stored uploads (when Cloudinary is not configured)
  app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', fallthrough: false, dotfiles: 'deny' }));

  app.use('/api/v1', apiLimiter, csrfOriginCheck, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
