import mongoose from 'mongoose';
import { env, validateEnv } from '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
async function run() {
  console.log('CampusFinder environment doctor');
  console.log('Node:', process.version);
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or later required');
  validateEnv(); console.log('✓ JWT and CSRF secrets configured');
  console.log('✓ Port:', env.port);
  console.log('✓ Security flags:', env.helmetEnabled, env.csrfEnabled, env.rateLimitEnabled, env.sanitizeEnabled);
  await connectDb(); console.log('✓ MongoDB ping:', (await mongoose.connection.db.admin().ping()).ok);
  console.log('✓ Doctor check passed');
}
run().catch(error => { console.error('✗', error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
