// One-time job for photos uploaded before photo similarity was added.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb } from '../src/config/db.js';
import Item from '../src/models/Item.js';
import { imageHashFromBuffer } from '../src/middleware/itemImage.js';
import mongoose from 'mongoose';
const uploadDir = fileURLToPath(new URL('../public/uploads/items/', import.meta.url));
try {
  await connectDb();
  const missing = await Item.find({ imageUrl: mongoose.trusted({ $regex: '^/uploads/items/' }), imageHash: null }).select('+imageHash');
  let count = 0;
  for (const item of missing) {
    const filename = path.basename(item.imageUrl);
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) continue;
    try {
      item.imageHash = await imageHashFromBuffer(await fs.readFile(path.join(uploadDir, filename)));
      await item.save(); count++;
    } catch (error) { console.warn('Skipped', filename, error.message); }
  }
  console.log(`Created photo fingerprints for ${count} existing report(s).`);
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
