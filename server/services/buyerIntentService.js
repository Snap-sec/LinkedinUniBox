import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Settings from '../models/Settings.js';

let isBuyerIntentRunning = false;

/**
 * Evaluates the Buyer Intent Score for a single conversation using DeepSeek API
 * Output is strictly constrained to 0-100 with minimum max_tokens (max_tokens: 5).
 */
export async function evaluateBuyerIntentForLead(conversation, apiKey) {
  try {
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ timestamp: 1 })
      .lean();

    const accountName = conversation.accountName || 'Snapsec Member';
    const prospectName = conversation.prospect?.name || 'Customer';
    const prospectHeadline = conversation.prospect?.headline || 'B2B Professional';
    const prospectCompany = conversation.prospect?.company || 'N/A';
    const leadStage = conversation.leadStage || 'New Lead';

    const conversationThread = messages.length > 0
      ? messages.map(m => {
          const senderLabel = m.sender === 'me'
            ? `Snapsec Member (${accountName})`
            : `Customer (${prospectName})`;
          return `${senderLabel}: "${m.content}"`;
        }).join('\n')
      : 'No messages exchanged yet.';

    const template = `You are an expert B2B sales intelligence AI evaluating lead buying intent from 0 to 100 based on LinkedIn conversation history and profile context.

--- PROSPECT DETAILS ---
Customer Name: {{customerName}}
Headline: {{customerHeadline}}
Company: {{customerCompany}}
Current Pipeline Stage: {{leadStage}}
Snapsec AE Account: {{snapsecMemberName}}

--- CONVERSATION HISTORY ---
{{conversationThread}}

--- EVALUATION & SCORING GUIDELINES ---
Evaluate buying intent strictly on a 0 to 100 scale using these exact criteria:
- HIGH INTENT (70-100): Customer explicitly agrees to a meeting/demo, requests pricing or proposals, shares calendar availability, or demonstrates strong purchase readiness.
- MEDIUM INTENT (40-69): Customer actively engages in dialogue, asks product/technical questions, discusses current operational pain points/challenges, or shows curious interest.
- LOW INTENT (0-39): Customer gives minimal one-word replies, demonstrates complete lack of response/ghosting, expresses disinterest, or rejects sales outreach.

STRICT RULE: Output ONLY a single integer score between 0 and 100 (e.g., 85). Do NOT include any markdown, words, punctuation, JSON, or explanation.`;

    const finalPrompt = template
      .replace(/\{\{snapsecMemberName\}\}/g, accountName)
      .replace(/\{\{customerName\}\}/g, prospectName)
      .replace(/\{\{customerHeadline\}\}/g, prospectHeadline)
      .replace(/\{\{customerCompany\}\}/g, prospectCompany)
      .replace(/\{\{leadStage\}\}/g, leadStage)
      .replace(/\{\{conversationThread\}\}/g, conversationThread);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        temperature: 0.1,
        max_tokens: 5
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    // Clean and extract integer from response
    const cleanNumberStr = rawContent.replace(/[^0-9]/g, '');
    let score = parseInt(cleanNumberStr, 10);

    if (isNaN(score)) {
      console.warn(`[Buyer Intent AI] Invalid response score for ${conversation.prospect.name}: "${rawContent}". Defaulting to 50.`);
      score = 50;
    } else {
      score = Math.max(0, Math.min(100, score));
    }

    // Save score and timestamp on lead
    conversation.buyerIntentScore = score;
    conversation.buyerIntentEvaluatedAt = new Date();
    
    // Also sync to aiAnalysis object if exists or initialize it
    if (!conversation.aiAnalysis) conversation.aiAnalysis = {};
    if (typeof conversation.aiAnalysis === 'object') {
      if (!conversation.aiAnalysis.conversationAnalysis) {
        conversation.aiAnalysis.conversationAnalysis = {};
      }
      conversation.aiAnalysis.conversationAnalysis.buyingIntentScore = score;
      if (score >= 70) conversation.aiAnalysis.conversationAnalysis.buyingIntentLabel = 'High Receptivity';
      else if (score >= 40) conversation.aiAnalysis.conversationAnalysis.buyingIntentLabel = 'Moderate Interest';
      else conversation.aiAnalysis.conversationAnalysis.buyingIntentLabel = 'Low Engagement';
      conversation.markModified('aiAnalysis');
    }

    await conversation.save();
    return score;
  } catch (err) {
    console.error(`[Buyer Intent AI Error] Failed for conversation ${conversation._id} (${conversation.prospect?.name}):`, err.message);
    throw err;
  }
}

/**
 * Runs the Buyer Intent evaluation for all leads with empty score or evaluated > 12 hours ago.
 */
export async function runBuyerIntentEvaluationCron(isManual = false, forceAll = false) {
  if (isBuyerIntentRunning) {
    console.log('[Buyer Intent Cron] Previous evaluation cycle is still running. Skipping iteration.');
    return { status: 'already_running', isRunning: true };
  }

  isBuyerIntentRunning = true;
  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const settings = await Settings.findOne({ key: 'global' });
    const apiKey = settings?.deepseekApiKey?.trim();

    if (!apiKey) {
      console.warn('[Buyer Intent Cron] Skipped run: DeepSeek API Key is missing in Settings.');
      return { status: 'missing_api_key', error: 'DeepSeek API Key missing' };
    }

    // 12 hours cutoff time
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Find leads to evaluate (if forceAll is true, select all conversations)
    const query = forceAll
      ? {}
      : {
          $or: [
            { buyerIntentEvaluatedAt: null },
            { buyerIntentEvaluatedAt: { $lt: twelveHoursAgo } }
          ]
        };

    const leadsToEvaluate = await Conversation.find(query);

    console.log(`[Buyer Intent Cron] Found ${leadsToEvaluate.length} lead(s) for evaluation (forceAll: ${forceAll}).`);

    for (const lead of leadsToEvaluate) {
      try {
        await evaluateBuyerIntentForLead(lead, apiKey);
        succeeded++;
      } catch (e) {
        failed++;
      }
      processed++;
    }

    // Update last run timestamp in Settings
    await Settings.findOneAndUpdate(
      { key: 'global' },
      { lastBuyerIntentRunAt: new Date() },
      { upsert: true }
    );

    const durationMs = Date.now() - startTime;
    console.log(`[Buyer Intent Cron] Finished evaluation cycle: ${succeeded}/${processed} successful in ${(durationMs / 1000).toFixed(1)}s.`);

    return {
      status: 'completed',
      processed,
      succeeded,
      failed,
      durationMs
    };
  } catch (err) {
    console.error('[Buyer Intent Cron Error]:', err.message);
    return { status: 'error', error: err.message };
  } finally {
    isBuyerIntentRunning = false;
  }
}

/**
 * Get stats about buyer intent evaluations
 */
export async function getBuyerIntentStats() {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const settings = await Settings.findOne({ key: 'global' });

  const totalLeads = await Conversation.countDocuments();
  const evaluatedLeads = await Conversation.countDocuments({ buyerIntentEvaluatedAt: { $ne: null } });
  const pendingLeads = await Conversation.countDocuments({
    $or: [
      { buyerIntentEvaluatedAt: null },
      { buyerIntentEvaluatedAt: { $lt: twelveHoursAgo } }
    ]
  });

  const highIntent = await Conversation.countDocuments({ buyerIntentScore: { $gte: 70 } });
  const mediumIntent = await Conversation.countDocuments({ buyerIntentScore: { $gte: 40, $lt: 70 } });
  const lowIntent = await Conversation.countDocuments({ buyerIntentScore: { $lt: 40, $ne: null } });

  return {
    totalLeads,
    evaluatedLeads,
    pendingLeads,
    highIntent,
    mediumIntent,
    lowIntent,
    lastRunAt: settings?.lastBuyerIntentRunAt || null,
    hasApiKey: Boolean(settings?.deepseekApiKey?.trim()),
    isRunning: isBuyerIntentRunning
  };
}
