import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, default: 'Account Executive' },
  email: { type: String },
  cookies: { type: Array, required: true },
  liAtToken: { type: String, required: true },
  jsessionId: { type: String },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' },
  status: { type: String, enum: ['active', 'warning', 'disconnected', 'expired'], default: 'active' },
  lastSyncAt: { type: Date, default: Date.now },
  lastCookieCheckAt: { type: Date },
  syncedMessageCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

export default mongoose.model('Account', accountSchema);
