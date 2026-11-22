const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { COOKIES } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { RefreshToken } = require('../models');
const { randomToken, sha256, hashIp } = require('../utils/helpers');

function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtlSeconds,
    algorithm: 'HS256',
    audience: 'jencorps',
    issuer: 'jencorps-api',
  });
}

/** Refresh tokens are opaque random strings; only their hash is stored (signed with the refresh secret). */
const hashRefresh = (token) => sha256(`${token}:${env.jwtRefreshSecret}`);

async function issueRefreshToken(user, req, family = randomToken(12)) {
  const token = randomToken(48);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashRefresh(token),
    family,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 864e5),
    userAgent: req?.headers?.['user-agent']?.slice(0, 300),
    ipHash: hashIp(req?.ip),
  });
  return token;
}

/**
 * Rotates a refresh token. Re-use of an already-rotated token revokes the whole family
 * (token theft detection).
 */
async function rotateRefreshToken(token, req) {
  if (!token) throw ApiError.unauthorized('No refresh token', 'NO_REFRESH');
  const record = await RefreshToken.findOne({ tokenHash: hashRefresh(token) });
  if (!record) throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');
  if (record.revokedAt) {
    await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Session revoked', 'REFRESH_REUSED');
  }
  if (record.expiresAt < new Date()) throw ApiError.unauthorized('Session expired', 'REFRESH_EXPIRED');

  const newToken = randomToken(48);
  // Atomic claim: only one concurrent refresh can rotate this token
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { revokedAt: new Date(), replacedByHash: hashRefresh(newToken) }
  );
  if (!claimed) throw ApiError.unauthorized('Session revoked', 'REFRESH_REUSED');

  await RefreshToken.create({
    userId: record.userId,
    tokenHash: hashRefresh(newToken),
    family: record.family,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 864e5),
    userAgent: req?.headers?.['user-agent']?.slice(0, 300),
    ipHash: hashIp(req?.ip),
  });
  return { userId: record.userId, token: newToken };
}

async function revokeRefreshToken(token) {
  if (!token) return;
  await RefreshToken.updateOne({ tokenHash: hashRefresh(token), revokedAt: null }, { revokedAt: new Date() });
}

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

const baseCookie = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
});

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(COOKIES.ACCESS, accessToken, { ...baseCookie(), path: '/', maxAge: env.accessTokenTtlSeconds * 1000 });
  res.cookie(COOKIES.REFRESH, refreshToken, {
    ...baseCookie(),
    path: '/api/v1/auth',
    maxAge: env.refreshTokenTtlDays * 864e5,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIES.ACCESS, { ...baseCookie(), path: '/' });
  res.clearCookie(COOKIES.REFRESH, { ...baseCookie(), path: '/api/v1/auth' });
}

module.exports = {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  setAuthCookies,
  clearAuthCookies,
};
