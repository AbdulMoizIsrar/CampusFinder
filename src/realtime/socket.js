import { Server } from 'socket.io';
import { getUserFromToken } from '../middleware/auth.js';
import { CATEGORIES } from '../models/Item.js';
import Notification from '../models/Notification.js';
import { env } from '../config/env.js';
let io;
export function emitTo(room, event, payload) { io?.to(room).emit(event, payload); }
export function setupSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
    transports: ['websocket', 'polling']
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.data.user = await getUserFromToken(token);
      next();
    } catch { next(new Error('Unauthenticated socket')); }
  });
  io.on('connection', socket => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (['moderator', 'admin'].includes(user.role)) socket.join('moderators');
    socket.on('category:subscribe', (payload, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const category = payload?.category;
      if (!CATEGORIES.includes(category)) return ack({ ok: false, error: 'Unknown category' });
      const room = `category:${category}`;
      if (payload.subscribe === false) socket.leave(room);
      else socket.join(room);
      ack({ ok: true, category, subscribed: payload.subscribe !== false });
    });
    socket.on('notification:read', async (payload, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      try {
        if (typeof payload?.id !== 'string' || !/^[a-f\d]{24}$/i.test(payload.id)) return ack({ ok: false, error: 'Invalid ID' });
        const doc = await Notification.findOneAndUpdate({ _id: payload.id, user: user.id }, { read: true }, { new: true });
        ack(doc ? { ok: true, notification: doc } : { ok: false, error: 'Not found' });
      } catch { ack({ ok: false, error: 'Unable to update notification' }); }
    });
  });
  return io;
}
