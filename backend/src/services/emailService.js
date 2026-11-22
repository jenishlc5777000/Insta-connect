const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');
const { escapeHtml: e, formatINR } = require('../utils/helpers');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = env.smtp.host
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

/** Emails never break the request flow: failures are logged. */
async function sendMail({ to, subject, html, text }) {
  try {
    const info = await getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });
    if (!env.smtp.host && !env.isTest) {
      logger.info(`[email:console] To: ${to} | ${subject}\n${text}\n`);
    }
    return info;
  } catch (err) {
    logger.error(`Email to ${to} failed: ${err.message}`);
    return null;
  }
}

const layout = (title, body) => `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0B1F3A">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#0B1F3A,#2F6BFF);padding:24px 32px;color:#fff;font-size:20px;font-weight:bold">JenCorps</td></tr>
<tr><td style="padding:32px"><h2 style="margin:0 0 16px;font-size:20px">${e(title)}</h2>${body}</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px">You received this email from JenCorps. If this wasn't you, please ignore it.</td></tr>
</table></td></tr></table></body></html>`;

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${e(href)}" style="background:#2F6BFF;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">${e(label)}</a></p>`;

const templates = {
  passwordReset: ({ name, url }) => ({
    subject: 'Reset your JenCorps password',
    text: `Hi ${name},\n\nReset your password using this link (valid for 1 hour):\n${url}\n\nIf you didn't request this, ignore this email.`,
    html: layout('Reset your password', `<p>Hi ${e(name)},</p><p>Use the button below to choose a new password. This link is valid for 1 hour.</p>${button(url, 'Reset password')}<p style="color:#64748b;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`),
  }),
  verifyEmail: ({ name, url }) => ({
    subject: 'Verify your JenCorps email',
    text: `Hi ${name},\n\nVerify your email address: ${url}`,
    html: layout('Verify your email', `<p>Hi ${e(name)},</p><p>Please confirm your email address to access your registrations.</p>${button(url, 'Verify email')}`),
  }),
  influencerWelcome: ({ name, email, tempPassword, loginUrl, referralUrl }) => ({
    subject: 'Welcome to the JenCorps Influencer Hub',
    text: `Hi ${name},\n\nYour influencer account is ready.\nLogin: ${loginUrl}\nEmail: ${email}\n${tempPassword ? `Temporary password: ${tempPassword}\n(You'll be asked to change it on first login.)\n` : ''}Your referral link: ${referralUrl}`,
    html: layout('Welcome to the Influencer Hub', `<p>Hi ${e(name)},</p><p>Your JenCorps influencer account is ready.</p>
<p><b>Email:</b> ${e(email)}<br/>${tempPassword ? `<b>Temporary password:</b> <code>${e(tempPassword)}</code><br/><span style="color:#64748b;font-size:13px">You'll be asked to change it on first login.</span>` : ''}</p>
<p><b>Your referral link:</b> <a href="${e(referralUrl)}">${e(referralUrl)}</a></p>${button(loginUrl, 'Open my dashboard')}`),
  }),
  passwordChangedByAdmin: ({ name, tempPassword, loginUrl }) => ({
    subject: 'Your JenCorps password was reset',
    text: `Hi ${name},\n\nAn administrator reset your password.\nTemporary password: ${tempPassword}\nLogin: ${loginUrl}`,
    html: layout('Your password was reset', `<p>Hi ${e(name)},</p><p>An administrator reset your password. Your temporary password is:</p><p><code style="font-size:16px">${e(tempPassword)}</code></p>${button(loginUrl, 'Log in')}`),
  }),
  applicationReceived: ({ name }) => ({
    subject: 'We received your JenCorps influencer application',
    text: `Hi ${name},\n\nThanks for applying to become a JenCorps influencer partner! Our team reviews every application and will get back to you within 2–3 working days.`,
    html: layout('Application received 🎉', `<p>Hi ${e(name)},</p><p>Thanks for applying to become a <b>JenCorps influencer partner</b>. Our team reviews every application personally and will get back to you within 2–3 working days.</p><p>Once approved you'll get your own referral link, a dashboard to track registrations, and commission on every paid registration.</p>`),
  }),
  applicationRejected: ({ name, reason }) => ({
    subject: 'Your JenCorps influencer application',
    text: `Hi ${name},\n\nThank you for your interest in partnering with JenCorps. We're unable to approve your application at this time.${reason ? `\n\nNote from our team: ${reason}` : ''}\n\nYou're welcome to apply again in the future.`,
    html: layout('About your application', `<p>Hi ${e(name)},</p><p>Thank you for your interest in partnering with JenCorps. We're unable to approve your application at this time.</p>${reason ? `<p style="background:#f8fafc;border-radius:10px;padding:12px"><b>Note from our team:</b> ${e(reason)}</p>` : ''}<p>You're welcome to apply again in the future.</p>`),
  }),
  registrationReceived: ({ name, workshop, payUrl, requiresPayment }) => ({
    subject: `Registration received: ${workshop.title}`,
    text: `Hi ${name},\n\nWe received your registration for ${workshop.title} on ${new Date(workshop.startDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.\n${requiresPayment ? `Complete your payment to confirm your seat: ${payUrl}` : 'Your seat is confirmed.'}`,
    html: layout('Registration received', `<p>Hi ${e(name)},</p><p>Thanks for registering for <b>${e(workshop.title)}</b>.</p>
<p><b>When:</b> ${e(new Date(workshop.startDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' }))}<br/><b>Mode:</b> ${e(workshop.mode)}${workshop.location ? `<br/><b>Location:</b> ${e(workshop.location)}` : ''}</p>
${requiresPayment ? `<p>Complete your payment to confirm your seat.</p>${button(payUrl, 'Complete payment')}` : '<p>Your seat is confirmed. See you there!</p>'}`),
  }),
  paymentConfirmed: ({ name, workshop, amount, paymentId, statusUrl }) => ({
    subject: `Payment confirmed: ${workshop.title}`,
    text: `Hi ${name},\n\nYour payment of ${formatINR(amount)} for ${workshop.title} is confirmed (ref ${paymentId}).\nView your registration: ${statusUrl}`,
    html: layout('Payment confirmed 🎉', `<p>Hi ${e(name)},</p><p>Your payment of <b>${e(formatINR(amount))}</b> for <b>${e(workshop.title)}</b> is confirmed.</p><p style="color:#64748b">Payment reference: ${e(paymentId)}</p>${button(statusUrl, 'View registration')}`),
  }),
};

async function sendTemplate(name, to, data) {
  const t = templates[name](data);
  return sendMail({ to, ...t });
}

module.exports = { sendMail, sendTemplate, templates };
