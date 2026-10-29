
import express from 'express';
import { validateEnv } from './src/config/env.js';
import { connectDb } from './src/config/db.js';
import { createApp } from './src/app.js';

if (
  !process.env.MONGO_URI ||
  /^mongodb:\/\/(127\.0\.0\.1|localhost)/i.test(process.env.MONGO_URI)
) {
  throw new Error(
    'Set MONGO_URI to your MongoDB Atlas connection string in Vercel settings.'
  );
}

validateEnv();

await connectDb();

const app = express();
const campusFinderApp = await createApp();

app.use(campusFinderApp);

export default app;
