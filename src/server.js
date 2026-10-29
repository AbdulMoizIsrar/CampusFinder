import http from 'node:http';
import mongoose from 'mongoose';
import { validateEnv, env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { setupSockets } from './realtime/socket.js';
async function main() {
  validateEnv();
  await connectDb();
  const app = await createApp();
  const server = http.createServer(app);
  const socket = setupSockets(server);
  server.listen(env.port, () => console.log(`CampusFinder running at http://localhost:${env.port}  | Swagger /api-docs`));
  async function shutdown() {
    console.log('Shutting down CampusFinder...');
    socket.close();
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
main().catch(err => { console.error(err); process.exit(1); });
