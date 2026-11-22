const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { COOKIES } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');
const { User, Influencer } = require('../models');

function readAccessToken(req) {
  const cookieToken = req.cookies?.[COOKIES.ACCESS];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function loadUserFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'], audience: 'jencorps', issuer: 'jencorps-api' });
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid session',
      err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    );
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') throw ApiError.unauthorized('Account is not active');
  // Tokens issued before a password change are no longer valid
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw ApiError.unauthorized('Session expired', 'TOKEN_EXPIRED');
  }
  return user;
}

async function attachInfluencer(req) {
  if (req.user.role !== 'influencer') return;
  const influencer = await Influencer.findOne({ userId: req.user._id });
  if (!influencer) throw ApiError.forbidden('Influencer profile not found');
  if (influencer.status !== 'active') throw ApiError.forbidden('Your influencer account is inactive');
  req.influencer = influencer;
}

const authenticate = asyncHandler(async (req, _res, next) => {
  const token = readAccessToken(req);
  if (!token) throw ApiError.unauthorized();
  req.user = await loadUserFromToken(token);
  await attachInfluencer(req);
  next();
});

/** Attaches req.user when a valid session exists; never fails */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readAccessToken(req);
  if (token) {
    try {
      req.user = await loadUserFromToken(token);
      await attachInfluencer(req);
    } catch {
      req.user = undefined;
      req.influencer = undefined;
    }
  }
  next();
});

const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };

module.exports = { authenticate, optionalAuth, authorize };
