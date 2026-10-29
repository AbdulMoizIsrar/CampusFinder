import * as auth from '../services/authService.js';
import { sendRegistrationCode } from '../services/emailVerificationService.js';
export async function sendCode(req, res) { res.json(await sendRegistrationCode(req.body.email)); }
export async function register(req, res) {
  const user = await auth.register(req.body);
  const session = await auth.createSession(user);
  auth.setRefreshCookie(res, session.refresh);
  res.status(201).json({ user: session.user, accessToken: session.accessToken });
}
export async function login(req, res) {
  const session = await auth.login(req.body);
  auth.setRefreshCookie(res, session.refresh);
  res.json({ user: session.user, accessToken: session.accessToken });
}
export async function refresh(req, res) {
  try {
    const session = await auth.rotateRefresh(req.cookies.campus_refresh);
    auth.setRefreshCookie(res, session.refresh);
    res.json({ user: session.user, accessToken: session.accessToken });
  } catch (error) { auth.clearRefreshCookie(res); throw error; }
}
export async function logout(req, res) {
  await auth.logout(req.cookies.campus_refresh);
  auth.clearRefreshCookie(res);
  res.json({ message: 'Signed out' });
}
export async function me(req, res) { res.json({ user: req.user }); }
