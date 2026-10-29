import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { AppError } from '../utils/error.js';

const dir = fileURLToPath(new URL('../../public/uploads/items/', import.meta.url));
const limitMB = process.env.VERCEL ? 3 : 5; // Vercel's request payload limit is 4.5 MB.
const extensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export const itemImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: limitMB * 1024 * 1024, files: 1, fields: 12 },
  fileFilter: (_req, file, done) => {
    if (!extensions.has(file.mimetype)) {
      return done(new AppError(422, 'INVALID_IMAGE', 'Use JPG, PNG or WebP images only'));
    }
    done(null, true);
  }
}).single('image');

// Difference hash: 9×8 greyscale thumbnail => 64-bit hexadecimal fingerprint.
export async function imageHashFromBuffer(buffer) {
  if (!buffer) return null;
  let data, info;
  try {
    ({ data, info } = await sharp(buffer).rotate().flatten({ background: '#fff' })
      .resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true }));
  } catch { throw new AppError(422, 'INVALID_IMAGE', 'Unable to process this image'); }
  if (info.channels !== 1) throw new AppError(422, 'INVALID_IMAGE', 'Could not process image');
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    bits = (bits << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
  }
  const hash = bits.toString(16).padStart(16, '0');
  return hash === '0000000000000000' || hash === 'ffffffffffffffff' ? null : hash;
}

export async function saveItemImage(file) {
  if (!file) return null;
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || detected.mime !== file.mimetype || !extensions.has(detected.mime)) {
    throw new AppError(422, 'INVALID_IMAGE', 'This file is not a valid JPG, PNG or WebP image');
  }
  const name = `${randomUUID()}.${extensions.get(detected.mime)}`;
  if (process.env.VERCEL) {
    // Vercel Functions have a read-only source filesystem, so persist images in Blob.
    const { put } = await import('@vercel/blob');
    const blob = await put(`items/${name}`, file.buffer, {
      access: 'public', contentType: detected.mime
    });
    return blob.url;
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), file.buffer, { flag: 'wx' });
  return `/uploads/items/${name}`;
}

export async function deleteItemImage(url) {
  if (process.env.VERCEL && /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url || '')) {
    const { del } = await import('@vercel/blob');
    await del(url);
    return;
  }
  if (!/^\/uploads\/items\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(url || '')) return;
  try {
    await fs.unlink(path.join(dir, path.basename(url)));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Could not remove item photo:', error);
  }
}
