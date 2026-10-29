import mongoose from 'mongoose';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { env } from '../config/env.js';
import { fail } from '../utils/error.js';
import { verifyRegistrationCode, consumeRegistrationCode } from './emailVerificationService.js';
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({ httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'strict', path: '/api/v1/auth' });
export function clearRefreshCookie(res) { res.clearCookie('campus_refresh', cookieOptions()); }
export function setRefreshCookie(res, raw) { res.cookie('campus_refresh', raw, { ...cookieOptions(), maxAge: env.refreshDays * 86400_000 }); }
export function signAccess(user) { return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtAccessExpires, algorithm: 'HS256' }); }
async function issueRefresh(user) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.refreshDays * 86400_000);
  await RefreshToken.create({ user: user._id, tokenHash: tokenHash(raw), expiresAt });
  return raw;
}
export async function register(input) {
  const email = input.email.toLowerCase();
  if (env.campusEmailDomain && !email.endsWith(`@${env.campusEmailDomain}`)) {
    fail(422, 'CAMPUS_EMAIL_REQUIRED', `Use your @${env.campusEmailDomain} campus email address`);
  }
  if (await User.exists({ email })) fail(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  const challenge = await verifyRegistrationCode(email, input.verificationCode);
  const user = await User.create({ name: input.name, email, passwordHash: await bcrypt.hash(input.password, 12) });
  await consumeRegistrationCode(challenge);
  return user;
}
export async function login(input) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  const refresh = await issueRefresh(user);
  return { user: user.toJSON(), accessToken: signAccess(user), refresh };
}
export async function createSession(user) {
  const refresh = await issueRefresh(user);
  return { user: user.toJSON(), accessToken: signAccess(user), refresh };
}
export async function rotateRefresh(raw) {
  if (!raw || typeof raw !== 'string') fail(401, 'NO_SESSION', 'Please sign in again');
  const tokenDoc = await RefreshToken.findOneAndUpdate(
    { tokenHash: tokenHash(raw), revoked: false, expiresAt: mongoose.trusted({ $gt: new Date() }) },
    { $set: { revoked: true, revokedAt: new Date() } }, { new: true }
  );
  if (!tokenDoc) fail(401, 'SESSION_EXPIRED', 'Session expired. Sign in again');
  const user = await User.findById(tokenDoc.user);
  if (!user) fail(401, 'UNAUTHENTICATED', 'Account no longer exists');
  return createSession(user);
}
export async function logout(raw) {
  if (raw && typeof raw === 'string') await RefreshToken.updateOne({ tokenHash: tokenHash(raw) }, { revoked: true, revokedAt: new Date() });
}
