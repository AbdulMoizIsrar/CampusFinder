import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' }
}, { timestamps: true, toJSON: { transform: (_doc, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } } });
export default mongoose.model('User', userSchema);
