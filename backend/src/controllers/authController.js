const { COOKIES } = require('../config/constants');
const { asyncHandler, ok, created } = require('../utils/helpers');
const authService = require('../services/authService');
const tokenService = require('../services/tokenService');

exports.register = asyncHandler(async (req, res) => {
  const user = await authService.registerCustomer(req.body);
  created(res, { user, message: 'Account created. Check your email to verify your address.' });
});

exports.login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body, req);
  tokenService.setAuthCookies(res, accessToken, refreshToken);
  ok(res, await authService.serializeSession(user));
});

exports.refresh = asyncHandler(async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await authService.refresh(req.cookies?.[COOKIES.REFRESH], req);
    tokenService.setAuthCookies(res, accessToken, refreshToken);
    ok(res, await authService.serializeSession(user));
  } catch (err) {
    tokenService.clearAuthCookies(res);
    throw err;
  }
});

exports.logout = asyncHandler(async (req, res) => {
  await tokenService.revokeRefreshToken(req.cookies?.[COOKIES.REFRESH]);
  tokenService.clearAuthCookies(res);
  ok(res, { message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  ok(res, await authService.serializeSession(req.user));
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  ok(res, { message: 'If an account exists for this email, a reset link has been sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  tokenService.clearAuthCookies(res);
  ok(res, { message: 'Password updated. You can now log in.' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await authService.changePassword(req.user._id, req.body);
  // Re-issue a session for this device after all sessions were revoked
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, req);
  tokenService.setAuthCookies(res, accessToken, refreshToken);
  ok(res, await authService.serializeSession(user));
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  ok(res, { message: 'Email verified' });
});
