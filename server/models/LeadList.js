import mongoose from 'mongoose';

const leadListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#3B82F6' },
}, {
  timestamps: true
});

export default mongoose.model('LeadList', leadListSchema);
