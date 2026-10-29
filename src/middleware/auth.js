import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { fail } from '../utils/error.js';
export async function getUserFromToken(token) {
  if (!token) fail(401, 'UNAUTHENTICATED', 'Sign in to continue');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }); }
  catch { fail(401, 'TOKEN_INVALID', 'Your session has expired. Sign in again'); }
  const user = await User.findById(payload.sub);
  if (!user) fail(401, 'UNAUTHENTICATED', 'Account no longer exists');
  return user;
}
export async function requireAuth(req, _res, next) {
  try {
    const match = /^Bearer (.+)$/i.exec(req.headers.authorization || '');
    req.user = await getUserFromToken(match?.[1]);
    next();
  } catch (err) { next(err); }
}
export function requireRoles(...roles) {
  return (req, _res, next) => req.user && roles.includes(req.user.role) ? next() : next(new ErrorWith403());
}
class ErrorWith403 extends Error {
  constructor() { super('You do not have permission for this action'); this.status = 403; this.code = 'FORBIDDEN'; }
}
export function canManageItem(user, item) {
  return String(item.reporter?._id || item.reporter) === String(user.id) || ['moderator', 'admin'].includes(user.role);
}
export function requireItemOwner(user, item) {
  if (!canManageItem(user, item)) fail(403, 'FORBIDDEN', 'Only the reporter or a moderator can manage this item');
}
