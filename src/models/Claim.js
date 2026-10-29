import mongoose from 'mongoose';
const claimSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  proofText: { type: String, required: true, maxlength: 1500 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true });
claimSchema.index({ item: 1, claimant: 1 }, { unique: true });
export default mongoose.model('Claim', claimSchema);
