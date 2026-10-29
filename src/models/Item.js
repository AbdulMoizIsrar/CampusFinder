import mongoose from 'mongoose';
import { validColor } from '../../public/js/colorPalette.js';
export const CATEGORIES = ['Electronics', 'Documents', 'Keys', 'Bags', 'Clothing', 'Accessories', 'Other'];
export const STATUSES = ['open', 'claim_pending', 'claimed', 'returned'];
const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 2000 },
  category: { type: String, enum: CATEGORIES, required: true },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  date: { type: Date, required: true },
  type: { type: String, enum: ['lost', 'found'], required: true },
  brand: { type: String, trim: true, maxlength: 80, default: '' },
  reporterName: { type: String, trim: true, maxlength: 80, default: '' },
  registrationNumber: { type: String, default: '', select: false },
  whatsapp: { type: String, default: '', select: false },
  shareWhatsappOnMatch: { type: Boolean, default: false, select: false },
  color: { type: String, trim: true, lowercase: true, maxlength: 40, default: '', validate: { validator: validColor, message: 'Invalid color' } },
  imageHash: { type: String, default: null, select: false },
  imageUrl: { type: String, default: null },
  status: { type: String, enum: STATUSES, default: 'open' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  approvedClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null },
  returnedAt: { type: Date, default: null }
}, { timestamps: true });
itemSchema.index({ category: 1, type: 1, status: 1, createdAt: -1 });
itemSchema.index({ title: 'text', description: 'text', location: 'text' });
export default mongoose.model('Item', itemSchema);
