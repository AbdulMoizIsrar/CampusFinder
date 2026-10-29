import Notification from '../models/Notification.js';
import { emitTo } from '../realtime/socket.js';
import { fail } from '../utils/error.js';
export async function notify(userId, type, message, itemId) {
  const notification = await Notification.create({ user: userId, type, message, itemId });
  emitTo(`user:${userId}`, type, notification);
  emitTo(`user:${userId}`, 'notification:new', notification);
  return notification;
}
export async function notificationsFor(userId, unreadOnly = false) {
  const filter = { user: userId, ...(unreadOnly ? { read: false } : {}) };
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
    Notification.countDocuments({ user: userId, read: false })
  ]);
  return { items, unreadCount };
}
export async function markRead(id, userId) {
  const doc = await Notification.findOneAndUpdate({ _id: id, user: userId }, { read: true }, { new: true });
  if (!doc) fail(404, 'NOT_FOUND', 'Notification not found');
  return doc;
}
