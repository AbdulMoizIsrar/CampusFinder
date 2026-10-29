import User from '../models/User.js';
import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import { fail } from '../utils/error.js';
export async function listUsers() { return User.find({}, 'name email role createdAt').sort({ createdAt: -1 }).limit(300).lean(); }
export async function changeRole(id, role, actor) {
  if (!['user', 'moderator', 'admin'].includes(role)) fail(422, 'INVALID_ROLE', 'Invalid role');
  if (String(actor.id) === String(id) && role !== 'admin') fail(409, 'SELF_DEMOTION', 'You cannot remove your own admin access');
  const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true });
  if (!user) fail(404, 'NOT_FOUND', 'User not found');
  return user;
}
export async function itemStats() {
  const [total, statusRows, categoryRows, typeRows] = await Promise.all([
    Item.countDocuments(), Item.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Item.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Item.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
  ]);
  return { total, byStatus: statusRows.map(v => ({ label: v._id, count: v.count })), byCategory: categoryRows.map(v => ({ label: v._id, count: v.count })), byType: typeRows.map(v => ({ label: v._id, count: v.count })) };
}
export async function claimsPerDay(days = 7) {
  return Claim.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - days * 86400_000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).then(rows => rows.map(v => ({ date: v._id, count: v.count })));
}
export async function recentClaims(limit = 10) {
  return Claim.find().sort({ createdAt: -1 }).limit(Math.min(limit, 50)).populate('item', 'title category').populate('claimant', 'name email').lean();
}
