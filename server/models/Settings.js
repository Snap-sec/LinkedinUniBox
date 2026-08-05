import mongoose from 'mongoose';

const pipelineStageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  color: { type: String, default: '#3b82f6' },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 }
});

export const defaultStages = [
  { id: 'stage_new', name: 'New Lead', color: '#3b82f6', description: 'Initial contact made or imported prospect', order: 1 },
  { id: 'stage_interested', name: 'Interested', color: '#8b5cf6', description: 'Prospect expressed intent or positive response', order: 2 },
  { id: 'stage_demo', name: 'Demo Scheduled', color: '#ec4899', description: 'Product walk-through scheduled', order: 3 },
  { id: 'stage_meeting', name: 'Meeting Booked', color: '#10b981', description: 'Confirmed meeting in calendar', order: 4 },
  { id: 'stage_negotiation', name: 'In Negotiation', color: '#f59e0b', description: 'Proposal and commercial terms discussion', order: 5 },
  { id: 'stage_closed_won', name: 'Closed Won', color: '#22c55e', description: 'Deal signed successfully', order: 6 },
  { id: 'stage_closed_lost', name: 'Closed Lost', color: '#ef4444', description: 'Deal lost or un-responsive', order: 7 }
];

const aiPromptSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  promptText: { type: String, default: '' }
});

export const defaultPrompts = [
  {
    id: 'p_prospect_analysis',
    title: 'Prospect Analysis',
    description: 'Analyzes prospect pain points, intent level, and generates 5 contextual follow-up messages in JSON format.',
    promptText: `You are an expert enterprise B2B sales strategist, executive intelligence analyst, and copywriter.

Your task is to analyze a LinkedIn conversation thread between an Account Executive (seller) and a Prospect (buyer), along with the prospect's profile context. Based on this conversation history, you must evaluate the prospect's pain points, analyze buying intent, and craft 5 highly targeted, contextual next message suggestions.

CRITICAL REQUIREMENT:
Output ONLY valid, strictly parsable JSON. Do not include markdown code block formatting (e.g., do not wrap in \`\`\`json ... \`\`\`), preamble, conversational text, or postscripts. The output must begin with { and end with }.

---

### INPUT FORMAT PROMPT METADATA:
- Account Executive Name: {{accountName}}
- Prospect Name: {{prospectName}}
- Prospect Headline: {{prospectHeadline}}
- Conversation History:
{{conversationHistory}}

---

### REQUIRED JSON OUTPUT SCHEMA:
{
  "painPointAnalysis": {
    "primaryChallenge": "Concise summary of the core technical or business pain point mentioned or implied by the prospect.",
    "operationalBottleneck": "Specific operational inefficiency, manual effort, or workflow barrier identified.",
    "decisionRequirement": "Key criteria, security requirement, or friction point needed to earn a decision."
  },
  "conversationAnalysis": {
    "buyingIntentScore": 88,
    "buyingIntentLabel": "High Receptivity",
    "strategicAssessment": "Detailed strategic breakdown evaluating prospect sentiment, current deal stage, and receptivity to previous messages.",
    "recommendedAction": "Actionable next step for the sales representative (e.g., Pitch a 15-minute discovery demo focusing on automated audit reporting)."
  },
  "nextMessages": [
    {
      "id": 1,
      "type": "Direct Meeting Pitch",
      "badgeBg": "#EFF6FF",
      "badgeColor": "#1D4ED8",
      "text": "Contextual 2-3 sentence message pitching a 15-minute call addressing their specific pain point."
    },
    {
      "id": 2,
      "type": "Value & ROI Highlight",
      "badgeBg": "#F0FDF4",
      "badgeColor": "#15803D",
      "text": "Message highlighting quantified ROI or time saved based on their bottleneck."
    },
    {
      "id": 3,
      "type": "Case Study Proof Point",
      "badgeBg": "#FAF5FF",
      "badgeColor": "#7E22CE",
      "text": "Message referencing a relevant industry proof point or case study result."
    },
    {
      "id": 4,
      "type": "Discovery Question",
      "badgeBg": "#FFFBEB",
      "badgeColor": "#B45309",
      "text": "Thought-provoking discovery question to uncover deeper workflow challenges."
    },
    {
      "id": 5,
      "type": "Soft Follow-up",
      "badgeBg": "#F3F4F6",
      "badgeColor": "#374151",
      "text": "Low-pressure follow-up checking in on priorities."
    }
  ]
}`
  }
];

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  syncFrequencyMinutes: { type: Number, default: 0.5 },
  pipelineStages: { type: [pipelineStageSchema], default: defaultStages },
  deepseekApiKey: { type: String, default: '' },
  aiPrompts: { type: [aiPromptSchema], default: defaultPrompts },
  lastSyncRunAt: { type: Date },
  lastBuyerIntentRunAt: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model('Settings', settingsSchema);
