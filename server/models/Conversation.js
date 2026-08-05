import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  accountName: { type: String },
  threadUrn: { type: String, required: true, unique: true },
  prospect: {
    name: { type: String, required: true },
    headline: { type: String },
    company: { type: String },
    avatar: { type: String },
    profileUrl: { type: String },
    connectionDegree: { type: String, default: '1st' }
  },
  leadStage: {
    type: String,
    enum: ['Interested', 'Demo Scheduled', 'Meeting Booked', 'Proposal Sent', 'Executive Network', 'Closed-Won', 'Not Interested', 'New Lead'],
    default: 'New Lead'
  },
  isUnread: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false, index: true },
  needsReply: { type: Boolean, default: false },
  lastMessageAt: { type: Date, required: true, index: true },
  lastFollowupAt: { type: Date, index: true },
  lastResponseAt: { type: Date, index: true },
  tags: [{ type: String }],
  lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LeadList' }],
  aiAnalysis: { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  timestamps: true
});

export default mongoose.model('Conversation', conversationSchema);
