import * as notes from '../services/notificationService.js';
export async function list(req, res) { res.json(await notes.notificationsFor(req.user.id, req.query.unread === 'true')); }
export async function read(req, res) { res.json({ notification: await notes.markRead(req.params.id, req.user.id) }); }
