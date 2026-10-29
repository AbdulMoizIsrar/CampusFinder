import crypto from 'node:crypto';
import EmailVerification from '../models/EmailVerification.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { fail } from '../utils/error.js';
import { emailConfigured, sendVerificationEmail } from './mailService.js';
const ONE_MINUTE = 60_000;
const TEN_MINUTES = 10 * ONE_MINUTE;
const codeHash = (email, code) => crypto.createHmac('sha256', env.csrfSecret).update(`${email}:${code}`).digest('hex');
export async function sendRegistrationCode(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  if (env.campusEmailDomain && !email.endsWith(`@${env.campusEmailDomain}`)) fail(422, 'CAMPUS_EMAIL_REQUIRED', `Use your @${env.campusEmailDomain} campus email address`);
  if (!emailConfigured()) fail(503, 'MAIL_NOT_CONFIGURED', 'Set SMTP settings in .env to send email codes');
  if (await User.exists({ email })) fail(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  const existing = await EmailVerification.findOne({ email });
  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < ONE_MINUTE) {
    fail(429, 'CODE_COOLDOWN', 'Please wait 60 seconds before requesting another code');
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = await EmailVerification.findOneAndUpdate({ email },
    { $set: { codeHash: codeHash(email, code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + TEN_MINUTES) } },
    { new: true, upsert: true, setDefaultsOnInsert: true }).select('+codeHash');
  try { await sendVerificationEmail(email, code); }
  catch (error) {
    await EmailVerification.deleteOne({ _id: challenge._id, codeHash: challenge.codeHash }).catch(() => {});
    console.error('Verification email delivery failed:', error.message);
    fail(502, 'MAIL_SEND_FAILED', 'Could not send verification email. Check SMTP configuration and try again.');
  }
  return { message: 'Verification code sent. Check your inbox or spam folder.' };
}
export async function verifyRegistrationCode(rawEmail, code) {
  const email = rawEmail.trim().toLowerCase();
  const challenge = await EmailVerification.findOne({ email }).select('+codeHash');
  if (!challenge || challenge.expiresAt < new Date()) fail(422, 'CODE_EXPIRED', 'Verification code expired. Request a new one.');
  if (challenge.attempts >= 5) fail(429, 'CODE_LOCKED', 'Too many incorrect attempts. Request a new code.');
  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(codeHash(email, code), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    await EmailVerification.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    fail(422, 'INVALID_CODE', 'Incorrect verification code');
  }
  return challenge;
}
export async function consumeRegistrationCode(challenge) {
  await EmailVerification.deleteOne({ _id: challenge._id });
}
