import mongoose from 'mongoose';
const refreshSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('RefreshToken', refreshSchema);
