import mongoose from 'mongoose';
import { env } from './env.js';
export async function connectDb() {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 12000 });
  console.log('MongoDB connected');
}
