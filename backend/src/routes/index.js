const express = require('express');
const v = require('../validators');
const validate = require('../middleware/validate');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { loginLimiter, sensitiveLimiter, registrationLimiter, trackingLimiter } = require('../middleware/security');
const { imageUpload, resourceUpload } = require('../middleware/upload');

const auth = require('../controllers/authController');
const influencers = require('../controllers/influencerController');
const leads = require('../controllers/leadController');
const payments = require('../controllers/paymentController');
const commissions = require('../controllers/commissionController');
const misc = require('../controllers/miscControllers');
const applicationService = require('../services/applicationService');
const deleteService = require('../services/deleteService');
const { asyncHandler, ok, created, isObjectId } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

const admin = [authenticate, authorize('admin')];
const influencer = [authenticate, authorize('influencer')];

/* ---------------------------------- /auth --------------------------------- */
const authRouter = express.Router();
authRouter.post('/register', registrationLimiter, validate(v.auth.register), auth.register);
authRouter.post('/login', loginLimiter, validate(v.auth.login), auth.login);
authRouter.post('/refresh', auth.refresh);
authRouter.post('/logout', auth.logout);
authRouter.get('/me', authenticate, auth.me);
authRouter.post('/forgot-password', sensitiveLimiter, validate(v.auth.forgot), auth.forgotPassword);
authRouter.post('/reset-password', sensitiveLimiter, validate(v.auth.reset), auth.resetPassword);
authRouter.post('/verify-email', sensitiveLimiter, validate(v.auth.verifyEmail), auth.verifyEmail);
authRouter.post('/change-password', authenticate, sensitiveLimiter, validate(v.auth.changePassword), auth.changePassword);

/* ---------------------------------- /users -------------------------------- */
const usersRouter = express.Router();
usersRouter.get('/me/registrations', authenticate, authorize('customer', 'admin'), leads.mine);
usersRouter.get('/', ...admin, misc.admin.users);
usersRouter.patch('/:id/status', ...admin, validate(v.user.status), misc.admin.setUserStatus);

/* ------------------------------- /influencers ----------------------------- */
const infRouter = express.Router();
// self-service (must precede /:id)
infRouter.get('/me', ...influencer, influencers.me);
infRouter.patch('/me', ...influencer, validate(v.influencer.selfUpdate), influencers.updateMe);
infRouter.post('/me/avatar', ...influencer, imageUpload, influencers.uploadAvatar);
infRouter.put('/me/payout-details', ...influencer, validate(v.influencer.payoutDetails), influencers.updatePayoutDetails);
infRouter.get('/me/summary', ...influencer, influencers.mySummary);
infRouter.get('/me/leads', ...influencer, influencers.myLeads);
infRouter.get('/me/leads/:leadId', ...influencer, influencers.myLead);
infRouter.get('/me/earnings', ...influencer, influencers.myEarnings);
infRouter.get('/me/payouts', ...influencer, influencers.myPayouts);
infRouter.get('/me/referral-links', ...influencer, influencers.myReferralLinks);
infRouter.get('/me/workshops', ...influencer, influencers.myWorkshops);
infRouter.get('/me/resources', ...influencer, influencers.myResources);
// admin
infRouter.get('/', ...admin, influencers.list);
infRouter.post('/', ...admin, validate(v.influencer.create), influencers.create);
infRouter.get('/:id', ...admin, influencers.get);
infRouter.patch('/:id', ...admin, validate(v.influencer.update), influencers.update);
infRouter.patch('/:id/status', ...admin, validate(v.influencer.status), influencers.setStatus);
infRouter.post('/:id/reset-password', ...admin, influencers.resetPassword);
infRouter.delete('/:id/avatar', ...admin, influencers.removeAvatar);
infRouter.delete('/:id', ...admin, asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Influencer not found');
  ok(res, await deleteService.deleteInfluencer(req.params.id, req));
}));
infRouter.get('/:id/performance', ...admin, influencers.performance);
infRouter.get('/:id/leads', ...admin, influencers.leads);
infRouter.get('/:id/earnings', ...admin, influencers.earnings);

/* -------------------------------- /workshops ------------------------------ */
const wsRouter = express.Router();
wsRouter.get('/', optionalAuth, misc.workshops.list);
wsRouter.get('/featured', misc.workshops.featured);
wsRouter.get('/id/:id', ...admin, misc.workshops.getById);
wsRouter.post('/upload-image', ...admin, imageUpload, misc.workshops.uploadImage);
wsRouter.get('/:slug', optionalAuth, misc.workshops.getBySlug);
wsRouter.post('/', ...admin, validate(v.workshop.create), misc.workshops.create);
wsRouter.patch('/:id', ...admin, validate(v.workshop.update), misc.workshops.update);
wsRouter.delete('/:id', ...admin, misc.workshops.remove);

/* ---------------------------------- /leads -------------------------------- */
const leadRouter = express.Router();
leadRouter.post('/register', registrationLimiter, optionalAuth, validate(v.lead.register), leads.register);
leadRouter.get('/status/:id', optionalAuth, leads.status);
leadRouter.get('/export', ...admin, leads.export);
leadRouter.post('/attendance/bulk', ...admin, validate(v.lead.bulkAttendance), leads.bulkAttendance);
leadRouter.post('/delete', ...admin, validate(v.lead.bulkDelete), asyncHandler(async (req, res) => ok(res, await deleteService.deleteLeads(req.body.leadIds, req))));
leadRouter.get('/', ...admin, leads.list);
leadRouter.get('/:id', ...admin, leads.get);
leadRouter.patch('/:id', ...admin, validate(v.lead.adminUpdate), leads.update);
leadRouter.patch('/:id/attribution', ...admin, validate(v.lead.attribution), leads.reassignAttribution);
leadRouter.patch('/:id/attendance', ...admin, validate(v.lead.attendance), leads.setAttendance);
leadRouter.delete('/:id', ...admin, asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Lead not found');
  const result = await deleteService.deleteLeads([req.params.id], req);
  if (result.blocked.length) throw ApiError.conflict(result.blocked[0].reason === 'not found' ? 'Lead not found' : `Cannot delete: ${result.blocked[0].reason}`);
  ok(res, result);
}));

/* -------------------------------- /referrals ------------------------------ */
const refRouter = express.Router();
refRouter.post('/track', trackingLimiter, validate(v.referral.track), misc.referrals.track);

/* -------------------------------- /payments ------------------------------- */
// NOTE: POST /payments/webhook is mounted in app.js with a raw body parser
const payRouter = express.Router();
payRouter.get('/config', payments.config);
payRouter.post('/order', registrationLimiter, optionalAuth, validate(v.payment.order), payments.createOrder);
payRouter.post('/verify', validate(v.payment.verify), payments.verify);
payRouter.post('/mock/complete', validate(v.payment.mockComplete), payments.mockComplete);
payRouter.get('/', ...admin, payments.list);
payRouter.get('/:id', ...admin, payments.get);
payRouter.post('/:id/refund', ...admin, validate(v.payment.refund), payments.refund);

/* ------------------------------- /commissions ----------------------------- */
const comRouter = express.Router();
comRouter.get('/', ...admin, commissions.list);
comRouter.get('/summary', ...admin, commissions.summary);
comRouter.post('/bulk', ...admin, validate(v.commission.bulk), commissions.bulk);
comRouter.patch('/:id/approve', ...admin, commissions.approve);
comRouter.patch('/:id/reject', ...admin, validate(v.commission.reject), commissions.reject);

/* --------------------------------- /payouts ------------------------------- */
const payoutRouter = express.Router();
payoutRouter.get('/', ...admin, misc.payouts.list);
payoutRouter.get('/eligible', ...admin, misc.payouts.eligible);
payoutRouter.post('/', ...admin, validate(v.payout.create), misc.payouts.create);
payoutRouter.patch('/:id/mark-paid', ...admin, validate(v.payout.markPaid), misc.payouts.markPaid);
payoutRouter.patch('/:id/fail', ...admin, validate(v.payout.fail), misc.payouts.markFailed);

/* -------------------------------- /analytics ------------------------------ */
const analyticsRouter = express.Router();
analyticsRouter.get('/admin/overview', ...admin, misc.analytics.adminOverview);
analyticsRouter.get('/admin/timeseries', ...admin, misc.analytics.timeseries);
analyticsRouter.get('/influencer/overview', ...influencer, misc.analytics.influencerOverview);

/* --------------------------------- /reports ------------------------------- */
const reportRouter = express.Router();
reportRouter.get('/', ...admin, misc.reports.types);
reportRouter.get('/:type', ...admin, misc.reports.get);

/* ---------------------------------- /admin -------------------------------- */
const adminRouter = express.Router();
adminRouter.get('/settings', ...admin, misc.admin.getSettings);
adminRouter.patch('/settings', ...admin, validate(v.settings), misc.admin.updateSettings);
adminRouter.get('/audit-logs', ...admin, misc.admin.auditLogs);
adminRouter.get('/resources', ...admin, misc.resources.list);
adminRouter.post('/resources', ...admin, resourceUpload, validate(v.resource.create), misc.resources.create);
adminRouter.delete('/resources/:id', ...admin, misc.resources.remove);

/* --------------------------------- /public -------------------------------- */
const publicRouter = express.Router();
publicRouter.get('/settings', misc.admin.publicSettings);

/* ------------------------- /influencer-applications ---------------------- */
const appRouter = express.Router();
const appId = (req) => {
  if (!isObjectId(req.params.id)) throw ApiError.notFound('Application not found');
  return req.params.id;
};
// Self signup: creates the influencer account and logs them straight in
appRouter.post('/', registrationLimiter, validate(v.application.apply), asyncHandler(async (req, res) => {
  const result = await applicationService.apply(req.body, req);
  const user = await require('../models').User.findById(result.userId);
  const tokenService = require('../services/tokenService');
  tokenService.setAuthCookies(res, tokenService.signAccessToken(user), await tokenService.issueRefreshToken(user, req));
  user.lastLoginAt = new Date();
  await user.save();
  created(res, { ...(await require('../services/authService').serializeSession(user)), referralUrl: result.influencer.referralUrl });
}));
appRouter.get('/subdomain-available', trackingLimiter, asyncHandler(async (req, res) => ok(res, await applicationService.subdomainAvailable(req.query.subdomain))));
appRouter.get('/', ...admin, asyncHandler(async (req, res) => {
  const { items, meta } = await applicationService.list(req.query);
  ok(res, items, meta);
}));
appRouter.get('/:id/suggest-subdomain', ...admin, asyncHandler(async (req, res) => {
  const app = await require('../models').InfluencerApplication.findById(appId(req));
  if (!app) throw ApiError.notFound('Application not found');
  ok(res, { subdomain: await applicationService.suggestSubdomain(app) });
}));
appRouter.post('/:id/approve', ...admin, validate(v.application.approve), asyncHandler(async (req, res) => ok(res, await applicationService.approve(appId(req), req.body, req))));
appRouter.post('/:id/reject', ...admin, validate(v.application.reject), asyncHandler(async (req, res) => ok(res, await applicationService.reject(appId(req), req.body, req))));
appRouter.delete('/:id', ...admin, asyncHandler(async (req, res) => ok(res, await deleteService.deleteApplication(appId(req), req))));

const api = express.Router();
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/influencers', infRouter);
api.use('/influencer-applications', appRouter);
api.use('/workshops', wsRouter);
api.use('/leads', leadRouter);
api.use('/referrals', refRouter);
api.use('/payments', payRouter);
api.use('/commissions', comRouter);
api.use('/payouts', payoutRouter);
api.use('/analytics', analyticsRouter);
api.use('/reports', reportRouter);
api.use('/admin', adminRouter);
api.use('/public', publicRouter);
api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));

module.exports = api;
