import * as admin from '../services/adminService.js';
export async function users(_req, res) { res.json({ users: await admin.listUsers() }); }
export async function role(req, res) { res.json({ user: await admin.changeRole(req.params.id, req.body.role, req.user) }); }
