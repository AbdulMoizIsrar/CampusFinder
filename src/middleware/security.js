import crypto from 'node:crypto';
import xss from 'xss';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/error.js';

// Signed double-submit cookie. Only cookie-backed refresh/logout needs CSRF
// protection; other modifying API calls require an explicit Bearer header.
const sign = nonce => crypto.createHmac('sha256', env.csrfSecret).update(nonce).digest('hex');
const cookieBase = () => ({ sameSite: 'strict', secure: env.nodeEnv === 'production', path: '/', httpOnly: false });
export function issueCsrf(_req, res) {
  const nonce = crypto.randomBytes(24).toString('hex');
  const token = `${nonce}.${sign(nonce)}`;
  res.cookie('campus_csrf', token, { ...cookieBase(), maxAge: 7 * 86400_000 });
  res.json({ csrfToken: token });
}
export function requireCsrf(req, _res, next) {
  if (!env.csrfEnabled) return next();
  const cookie = req.cookies?.campus_csrf || '';
  const header = req.get('X-CSRF-Token') || '';
  const [nonce, signature, extra] = cookie.split('.');
  if (!nonce || !signature || extra || !/^[a-f0-9]{48}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature))
    return next(new AppError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token'));
  const expected = sign(nonce);
  const validSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const sameHeader = Buffer.byteLength(header) === Buffer.byteLength(cookie) && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(cookie));
  if (!validSignature || !sameHeader) return next(new AppError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token'));
  next();
}
export const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes' } } });
export const claimLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many claims. Try again later' } } });
export const generalLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false });
export const maybeLimit = limiter => (req, res, next) => env.rateLimitEnabled ? limiter(req, res, next) : next();
export function sanitizeText(text) {
  if (!env.sanitizeEnabled) return text;

  return xss(String(text), {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: [
      'script',
      'style',
      'textarea',
      'xmp'
    ]
  }).trim();
}