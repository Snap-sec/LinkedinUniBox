import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  eventUrn: { type: String, required: true, unique: true },
  sender: { type: String, enum: ['me', 'prospect', 'internal_note'], required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String },
  content: { type: String, required: true },
  channel: { type: String, default: 'LinkedIn DM' },
  timestamp: { type: Date, required: true, index: true },
  isInternal: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.model('Message', messageSchema);
