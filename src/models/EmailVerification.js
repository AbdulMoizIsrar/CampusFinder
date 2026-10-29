import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('EmailVerification', schema);
