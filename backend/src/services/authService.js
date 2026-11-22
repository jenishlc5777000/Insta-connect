const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User, Influencer, Lead } = require('../models');
const { randomToken, sha256 } = require('../utils/helpers');
const tokenService = require('./tokenService');
const emailService = require('./emailService');

// Constant-time-ish defence against user enumeration on login
const bcrypt = require('bcryptjs');

let dummyHash;
const getDummyHash = () => {
  if (!dummyHash) dummyHash = bcrypt.hashSync('not-a-real-password', env.bcryptRounds);
  return dummyHash;
};

async function serializeSession(user) {
  const data = { user: user.toJSON() };
  if (user.role === 'influencer') {
    const inf = await Influencer.findOne({ userId: user._id }).lean();
    if (inf) {
      data.influencer = {
        _id: inf._id,
        influencerCode: inf.influencerCode,
        subdomain: inf.subdomain,
        profileImage: inf.profileImage,
        status: inf.status,
      };
    }
  }
  return data;
}

async function registerCustomer({ name, email, phone, password }) {
  const exists = await User.exists({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists');
  const user = new User({ name, email, phone, role: 'customer' });
  await user.setPassword(password);
  const verifyToken = randomToken(32);
  user.emailVerifyTokenHash = sha256(verifyToken);
  await user.save();
  await emailService.sendTemplate('verifyEmail', user.email, { name: user.name, url: `${env.frontendUrl}/verify-email?token=${verifyToken}` });
  return user;
}

async function login({ email, password, portal }, req) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user ? await user.comparePassword(password) : await bcrypt.compare(password, getDummyHash());
  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (user.status !== 'active') throw ApiError.forbidden('Your account is not active. Contact support.');

  // Each portal only accepts its own role (admins may also use the customer portal)
  if (portal === 'admin' && user.role !== 'admin') throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (portal === 'influencer' && user.role !== 'influencer') throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  if (user.role === 'influencer') {
    const inf = await Influencer.findOne({ userId: user._id }).lean();
    if (!inf || inf.status !== 'active') throw ApiError.forbidden('Your influencer account is inactive. Contact JenCorps.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, req);
  return { user, accessToken, refreshToken };
}

async function refresh(refreshToken, req) {
  const { userId, token } = await tokenService.rotateRefreshToken(refreshToken, req);
  const user = await User.findById(userId);
  if (!user || user.status !== 'active') throw ApiError.unauthorized('Account is not active');
  return { user, accessToken: tokenService.signAccessToken(user), refreshToken: token };
}

async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user || user.status !== 'active') return; // never reveal whether the account exists
  const token = randomToken(32);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  await emailService.sendTemplate('passwordReset', user.email, {
    name: user.name,
    url: `${env.frontendUrl}/reset-password?token=${token}`,
  });
}

async function resetPassword({ token, password }) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  await user.setPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.mustChangePassword = false;
  await user.save();
  await tokenService.revokeAllForUser(user._id);
  return user;
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  await user.setPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  await tokenService.revokeAllForUser(user._id);
  return user;
}

async function verifyEmail(token) {
  const user = await User.findOne({ emailVerifyTokenHash: sha256(token) }).select('+emailVerifyTokenHash');
  if (!user) throw ApiError.badRequest('This verification link is invalid or was already used');
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  await user.save();
  // Registrations made with this email before the account existed become visible to the owner
  await Lead.updateMany({ email: user.email, userId: { $exists: false } }, { userId: user._id });
  return user;
}

module.exports = { registerCustomer, login, refresh, forgotPassword, resetPassword, changePassword, verifyEmail, serializeSession };
