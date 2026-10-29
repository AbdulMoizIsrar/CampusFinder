import mongoose from 'mongoose';
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['match:suggested', 'claim:new', 'claim:decided', 'item:returned', 'system'], required: true },
  message: { type: String, required: true, maxlength: 300 },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  read: { type: Boolean, default: false }
}, { timestamps: true });
notificationSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model('Notification', notificationSchema);
