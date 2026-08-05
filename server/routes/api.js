import express from 'express';
import Account from '../models/Account.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Settings, { defaultStages } from '../models/Settings.js';
import LeadList from '../models/LeadList.js';
import { syncLinkedinMessagesForAccount, checkLinkedinCookiesForAccount, fetchLinkedinProfileInfo } from '../services/linkedinService.js';
import { updateSyncFrequency, runBackgroundSync } from '../services/cronService.js';

const router = express.Router();

/**
 * POST /api/accounts/extension-connect
 * Endpoint specifically built for the Chrome Extension to automatically capture and submit LinkedIn session cookies
 */
router.post('/accounts/extension-connect', async (req, res) => {
  try {
    const { cookies, name, email, role } = req.body;
    console.log(`\n==================================================`);
    console.log(`[Extension API Endpoint] Received automated cookie sync request from Chrome Extension.`);
    
    if (!cookies || (!Array.isArray(cookies) && typeof cookies !== 'string')) {
      return res.status(400).json({ error: 'No cookies payload provided by extension.' });
    }

    let parsedCookies = cookies;
    if (typeof cookies === 'string') {
      try {
        parsedCookies = JSON.parse(cookies);
      } catch (e) {
        return res.status(400).json({ error: 'Cookies string could not be parsed.' });
      }
    }

    const liAtCookie = Array.isArray(parsedCookies) ? parsedCookies.find(c => c.name === 'li_at') : null;
    const jsessionCookie = Array.isArray(parsedCookies) ? parsedCookies.find(c => c.name === 'JSESSIONID') : null;

    if (!liAtCookie || !liAtCookie.value) {
      return res.status(400).json({ error: 'LinkedIn authentication cookie (li_at) not found in browser session.' });
    }

    // Auto-resolve live profile info (Name, Designation/Role, Avatar)
    const profileInfo = await fetchLinkedinProfileInfo(parsedCookies);

    const validPassedName = (name && typeof name === 'string' && name.trim() && name.trim() !== 'LinkedIn Member') ? name.trim() : null;
    const accountName = validPassedName || profileInfo?.name || 'LinkedIn Member';
    const accountRole = profileInfo?.role || (role && role !== 'SDR' ? role : null) || 'SDR';
    const accountEmail = email || '';
    const avatar = profileInfo?.avatar;

    console.log(`[Extension API Endpoint] Resolved Profile Info:`);
    console.log(`  - Name: "${accountName}"`);
    console.log(`  - Role/Designation: "${accountRole}"`);
    console.log(`  - Avatar: ${avatar || 'Default'}`);

    const updateData = {
      name: accountName,
      role: accountRole,
      email: accountEmail,
      cookies: parsedCookies,
      liAtToken: liAtCookie.value,
      jsessionId: jsessionCookie?.value || '',
      status: 'active'
    };

    if (avatar) {
      updateData.avatar = avatar;
    }

    // Save or update Account in MongoDB (match by liAtToken or name)
    let account = await Account.findOne({ liAtToken: liAtCookie.value });
    if (!account) {
      account = await Account.findOne({ name: accountName });
    }

    if (account) {
      Object.assign(account, updateData);
      await account.save();
    } else {
      account = await Account.create(updateData);
    }

    // Trigger immediate LinkedIn inbox sync
    const syncResult = await syncLinkedinMessagesForAccount(account, parsedCookies);

    return res.json({
      success: true,
      message: 'Extension connected account successfully and synced LinkedIn messages!',
      account: {
        id: account._id,
        name: account.name,
        role: account.role,
        avatar: account.avatar,
        email: account.email,
        status: account.status,
        syncedMessages: syncResult.messagesSynced
      }
    });

  } catch (error) {
    console.error('[API Error /accounts/extension-connect]:', error);
    return res.status(500).json({ error: 'Failed to process extension cookies.', details: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (email.trim().toLowerCase() === 'imran@snapsec.co' && password === 'HackMeNot@1121') {
    return res.json({
      success: true,
      token: 'session_token_imran_snapsec',
      user: {
        email: 'imran@snapsec.co',
        name: 'Imran Parray',
        role: 'Administrator',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'
      }
    });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
});

/**
 * GET /api/accounts
 * Fetch all connected accounts from MongoDB
 */
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 }).lean();
    
    // Always include the "All Accounts" aggregate option
    const allOption = {
      id: 'acc_all',
      _id: 'acc_all',
      name: 'All Accounts',
      role: 'Combined Stream',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      status: 'active',
      unreadCount: 0,
      dailyUsage: '0/500',
      healthScore: 100,
      proxyLocation: 'US-East (Residential)'
    };

    const formattedAccounts = accounts.map(acc => ({
      id: acc._id.toString(),
      _id: acc._id.toString(),
      name: acc.name,
      role: acc.role || 'Account Executive',
      email: acc.email || '',
      avatar: acc.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      status: acc.status || 'active',
      unreadCount: 0,
      dailyUsage: `${acc.syncedMessageCount || 0}/100`,
      healthScore: acc.status === 'expired' ? 0 : 98,
      proxyLocation: 'US-East',
      lastSyncAt: acc.lastSyncAt,
      lastCookieCheckAt: acc.lastCookieCheckAt
    }));

    return res.json([allOption, ...formattedAccounts]);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch accounts.' });
  }
});

/**
 * POST /api/accounts/check-cookies
 * Trigger an immediate cookie validity check for all connected LinkedIn accounts
 */
router.post('/accounts/check-cookies', async (req, res) => {
  try {
    const accounts = await Account.find();
    const results = [];
    for (const acc of accounts) {
      const isValid = await checkLinkedinCookiesForAccount(acc);
      results.push({ id: acc._id, name: acc.name, status: acc.status, isValid });
    }
    return res.json({ message: 'Cookie health check completed.', accounts: results });
  } catch (error) {
    console.error('[API Error /accounts/check-cookies]:', error);
    return res.status(500).json({ error: 'Failed to execute cookie health check.', details: error.message });
  }
});

/**
 * PATCH /api/accounts/:id/cookies
 * Update cookies for an existing account and re-verify session status
 */
router.patch('/accounts/:id/cookies', async (req, res) => {
  try {
    const { id } = req.params;
    const { cookies } = req.body;

    if (!cookies) {
      return res.status(400).json({ error: 'Cookies payload is required.' });
    }

    let parsedCookies = cookies;
    if (typeof cookies === 'string') {
      try {
        parsedCookies = JSON.parse(cookies);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON cookies format. Please provide valid JSON array.' });
      }
    }

    if (!Array.isArray(parsedCookies) || parsedCookies.length === 0) {
      return res.status(400).json({ error: 'Cookies must be a non-empty array of cookie objects.' });
    }

    const liAtCookie = parsedCookies.find(c => c.name === 'li_at');
    const jsessionCookie = parsedCookies.find(c => c.name === 'JSESSIONID');

    if (!liAtCookie || !liAtCookie.value) {
      return res.status(400).json({ error: 'li_at cookie token is missing in the provided cookies array.' });
    }

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    account.cookies = parsedCookies;
    account.liAtToken = liAtCookie.value;
    if (jsessionCookie?.value) {
      account.jsessionId = jsessionCookie.value;
    }
    await account.save();

    // Re-verify cookie health immediately against LinkedIn mysettings-api
    const isValid = await checkLinkedinCookiesForAccount(account);

    // If valid, trigger background sync
    if (isValid) {
      syncLinkedinMessagesForAccount(account, parsedCookies).catch(e => console.error('[Update Cookies Sync Error]:', e));
    }

    return res.json({
      success: true,
      message: isValid
        ? 'Cookies updated and session verified successfully! (200 OK)'
        : 'Cookies updated, but session verification failed (Cookies expired or invalid).',
      isValid,
      account
    });
  } catch (error) {
    console.error('[API Error PATCH /accounts/:id/cookies]:', error);
    return res.status(500).json({ error: 'Failed to update cookies.', details: error.message });
  }
});



/**
 * POST /api/accounts/add
 * Takes account details and linkedin cookies JSON, creates account, & syncs last 1 day messages to MongoDB
 */
router.post('/accounts/add', async (req, res) => {
  try {
    const { name, role, email, cookies } = req.body;
    console.log(`\n==================================================`);
    console.log(`[API POST /api/accounts/add] Received account creation request:`);
    console.log(`  - Account Name: "${name}"`);
    console.log(`  - Role: "${role}"`);
    console.log(`  - Email: "${email}"`);
    console.log(`  - Raw Cookies Type: ${typeof cookies} (Length: ${typeof cookies === 'string' ? cookies.length : Array.isArray(cookies) ? cookies.length : 0})`);

    let parsedCookies = cookies;
    if (typeof cookies === 'string') {
      try {
        parsedCookies = JSON.parse(cookies);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON cookies format.' });
      }
    }

    const liAtCookie = Array.isArray(parsedCookies) ? parsedCookies.find(c => c.name === 'li_at') : null;
    const jsessionCookie = Array.isArray(parsedCookies) ? parsedCookies.find(c => c.name === 'JSESSIONID') : null;

    if (!liAtCookie || !liAtCookie.value) {
      return res.status(400).json({ error: 'li_at cookie token is missing in the provided cookies array.' });
    }

    // Auto-resolve live profile info (Name, Designation/Role, Avatar) from settingsApiMiniProfile
    const profileInfo = await fetchLinkedinProfileInfo(parsedCookies);

    const accountName = profileInfo?.name || name || 'LinkedIn Member';
    const accountRole = profileInfo?.role || role || 'SDR';
    const accountEmail = email || '';
    const avatar = profileInfo?.avatar;

    const updateFields = {
      name: accountName,
      role: accountRole,
      email: accountEmail,
      cookies: parsedCookies,
      liAtToken: liAtCookie.value,
      jsessionId: jsessionCookie?.value || '',
      status: 'active'
    };

    if (avatar) {
      updateFields.avatar = avatar;
    }

    // 1. Save or update Account document in MongoDB
    const account = await Account.findOneAndUpdate(
      { name: accountName },
      updateFields,
      { upsert: true, returnDocument: 'after', new: true }
    );

    // 2. Fetch messages from last 1 day (24h) and save into MongoDB
    const syncResult = await syncLinkedinMessagesForAccount(account, parsedCookies);

    return res.status(201).json({
      message: 'Account successfully connected and 24-hour LinkedIn inbox messages synced to MongoDB.',
      account,
      syncSummary: syncResult
    });

  } catch (error) {
    console.error('[API Error /accounts/add]:', error);
    return res.status(500).json({ error: 'Failed to process cookies or sync messages to DB.', details: error.message });
  }
});

/**
 * POST /api/accounts/extension-connect
 * Endpoint specifically built for the Chrome Extension to automatically capture and submit LinkedIn session cookies
 */
router.post('/accounts/extension-connect', async (req, res) => {
  try {
    const { cookies, name, email, role } = req.body;
    console.log(`\n==================================================`);
    console.log(`[Extension API Endpoint] Received automated cookie sync request from Chrome Extension.`);
    
    if (!cookies || (!Array.isArray(cookies) && typeof cookies !== 'string')) {
      return res.status(400).json({ error: 'No cookies payload provided by extension.' });
    }

    let parsedCookies = cookies;
    if (typeof cookies === 'string') {
      try {
        parsedCookies = JSON.parse(cookies);
      } catch (e) {
        return res.status(400).json({ error: 'Cookies string could not be parsed.' });
      }
    }

    const liAtCookie = Array.isArray(parsedCookies) ? parsedCookies.find(c => c.name === 'li_at') : null;
    const jsessionCookie = Array.isArray(parsedCookies) ? parsedCookies.find(c => c.name === 'JSESSIONID') : null;

    if (!liAtCookie || !liAtCookie.value) {
      return res.status(400).json({ error: 'LinkedIn authentication cookie (li_at) not found in browser session.' });
    }

    const accountName = name || 'Sales Member (Extension Connected)';
    const accountRole = role || 'Account Executive';
    const accountEmail = email || '';

    // Save or update Account in MongoDB
    const account = await Account.findOneAndUpdate(
      { name: accountName },
      {
        name: accountName,
        role: accountRole,
        email: accountEmail,
        cookies: parsedCookies,
        liAtToken: liAtCookie.value,
        jsessionId: jsessionCookie?.value || '',
        status: 'active'
      },
      { upsert: true, returnDocument: 'after', new: true }
    );

    // Trigger immediate LinkedIn inbox sync
    const syncResult = await syncLinkedinMessagesForAccount(account, parsedCookies);

    return res.json({
      success: true,
      message: 'Extension connected account successfully and synced LinkedIn messages!',
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        status: account.status,
        syncedMessages: syncResult.messagesSynced
      }
    });

  } catch (error) {
    console.error('[API Error /accounts/extension-connect]:', error);
    return res.status(500).json({ error: 'Failed to process extension cookies.', details: error.message });
  }
});

/**
 * DELETE /api/accounts/:id
 * Disconnect connected account and optionally delete all associated conversations/messages from MongoDB
 */
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const shouldDeleteLeads = req.query.deleteLeads === 'true' || req.body?.deleteLeads === true;
    console.log(`[API DELETE /api/accounts/${id}] Disconnecting account (deleteLeads: ${shouldDeleteLeads})...`);

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    await Account.findByIdAndDelete(id);

    let deletedConvsCount = 0;
    let deletedMsgsCount = 0;

    if (shouldDeleteLeads) {
      const deletedConvs = await Conversation.deleteMany({ accountId: id });
      const deletedMsgs = await Message.deleteMany({ accountId: id });
      deletedConvsCount = deletedConvs.deletedCount;
      deletedMsgsCount = deletedMsgs.deletedCount;
      console.log(`[API DELETE /api/accounts/${id}] Deleted account "${account.name}". Removed ${deletedConvsCount} conversations and ${deletedMsgsCount} messages.`);
    } else {
      console.log(`[API DELETE /api/accounts/${id}] Disconnected account "${account.name}". Kept associated leads & conversations in DB.`);
    }

    return res.json({
      message: `Account "${account.name}" disconnected successfully.`,
      id,
      deleteLeads: shouldDeleteLeads,
      deletedConversations: deletedConvsCount,
      deletedMessages: deletedMsgsCount
    });
  } catch (error) {
    console.error('[API Error /accounts/delete]:', error);
    return res.status(500).json({ error: 'Failed to delete account.', details: error.message });
  }
});

/**
 * POST /api/sync/trigger
 * Manually trigger background sync for all connected accounts on demand
 */
router.post('/sync/trigger', async (req, res) => {
  try {
    console.log('[API POST /api/sync/trigger] Manual sync requested by user.');
    await runBackgroundSync(true);
    return res.json({ message: 'Manual sync triggered successfully.' });
  } catch (error) {
    console.error('[API Error /sync/trigger]:', error);
    return res.status(500).json({ error: 'Failed to execute manual sync.', details: error.message });
  }
});

/**
 * GET /api/conversations
 * Fetch all synced conversations & messages from MongoDB
 */
router.get('/conversations', async (req, res) => {
  try {
    const { accountId, filter, search } = req.query;

    const query = {};

    // 1. Account filter
    if (accountId && accountId !== 'acc_all') {
      query.accountId = accountId;
    }

    // 2. Status filter (unread, starred, needs reply)
    if (filter === 'unread') {
      query.isUnread = true;
    } else if (filter === 'starred') {
      query.isStarred = true;
    } else if (filter === 'reply') {
      query.needsReply = true;
    }

    // 3. Search query across prospect name, company, headline & message content
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      const matchingMessages = await Message.find({ content: searchRegex }).select('conversationId').lean();
      const matchingConvIds = matchingMessages.map(m => m.conversationId);

      query.$or = [
        { 'prospect.name': searchRegex },
        { 'prospect.company': searchRegex },
        { 'prospect.headline': searchRegex },
        { _id: { $in: matchingConvIds } }
      ];
    }

    const conversations = await Conversation.find(query).sort({ isArchived: 1, lastMessageAt: -1 }).lean();

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const messages = await Message.find({ conversationId: conv._id }).sort({ timestamp: 1 }).lean();
        const account = await Account.findById(conv.accountId).lean();

        return {
          id: conv._id.toString(),
          _id: conv._id.toString(),
          accountId: conv.accountId ? conv.accountId.toString() : 'acc_1',
          accountName: conv.accountName || account?.name || 'LinkedIn Account',
          accountAvatar: account?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          accountBadge: account?.role || 'Sales Rep',
          prospect: conv.prospect,
          leadStage: conv.leadStage || 'Interested',
          isUnread: Boolean(conv.isUnread),
          isStarred: Boolean(conv.isStarred),
          isArchived: Boolean(conv.isArchived),
          needsReply: Boolean(conv.needsReply),
          lastMessage: messages.length > 0 ? messages[messages.length - 1].content : 'No messages yet',
          timestamp: new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeAgo: formatTimeAgo(conv.lastMessageAt),
          tags: conv.tags || ['Inbound'],
          type: 'LinkedIn DM',
          aiAnalysis: conv.aiAnalysis || null,
          messages: messages.map(m => ({
            id: m._id.toString(),
            sender: m.sender,
            senderName: m.senderName,
            senderAvatar: m.senderAvatar,
            content: m.content,
            channel: m.channel || 'LinkedIn DM',
            timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
            isInternal: Boolean(m.isInternal)
          }))
        };
      })
    );

    return res.json({ count: result.length, conversations: result });
  } catch (error) {
    console.error('[API Error /conversations]:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations from DB.' });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation lead stage, starred status, or unread state in MongoDB
 */
router.patch('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const conversation = await Conversation.findByIdAndUpdate(id, updates, { new: true });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.json({ conversation });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update conversation.' });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Store a new outbound message or internal note in MongoDB
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, senderName, isInternal } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      accountId: conversation.accountId,
      eventUrn: `urn:li:fs_event:msg_${Date.now()}_${Math.random()}`,
      sender: isInternal ? 'internal_note' : 'me',
      senderName: isInternal ? 'Internal Note' : (senderName || 'Me'),
      content,
      channel: 'LinkedIn DM',
      timestamp: new Date(),
      isInternal: Boolean(isInternal)
    });

    conversation.lastMessageAt = new Date();
    if (!isInternal) {
      conversation.needsReply = false;
      conversation.lastFollowupAt = new Date();
    }
    await conversation.save();

    return res.status(201).json({ message });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save message.' });
  }
});

/**
 * POST /api/conversations/:id/ai-analysis
 * Trigger DeepSeek AI analysis for a conversation
 */
router.post('/conversations/:id/ai-analysis', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await Message.find({ conversationId: conversation._id }).sort({ timestamp: 1 }).lean();
    const settings = await Settings.findOne({ key: 'global' });

    const apiKey = settings?.deepseekApiKey?.trim();
    if (!apiKey) {
      return res.status(400).json({
        error: 'DeepSeek API key is missing. Please add your API key in Settings -> AI Config tab.'
      });
    }

    // Build conversation history text
    const conversationHistoryStr = messages.map(m => {
      const sender = m.sender === 'me' ? (conversation.accountName || 'Account Executive') : conversation.prospect.name;
      return `${sender}: "${m.content}"`;
    }).join('\n');

    // Get prompt template
    let systemPrompt = settings.aiPrompts?.[0]?.promptText || '';
    if (!systemPrompt) {
      const { defaultPrompts } = await import('../models/Settings.js');
      systemPrompt = defaultPrompts[0].promptText;
    }

    // Interpolate variables
    const finalPrompt = systemPrompt
      .replace(/\{\{accountName\}\}/g, conversation.accountName || 'Account Executive')
      .replace(/\{\{prospectName\}\}/g, conversation.prospect.name || 'Prospect')
      .replace(/\{\{prospectHeadline\}\}/g, conversation.prospect.headline || 'B2B Professional')
      .replace(/\{\{conversationHistory\}\}/g, conversationHistoryStr);

    console.log(`[DeepSeek AI] Requesting analysis for conversation with ${conversation.prospect.name}...`);

    // Call DeepSeek API
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
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[DeepSeek API Error]:', response.status, errText);
      return res.status(502).json({ error: `DeepSeek API returned status ${response.status}: ${errText}` });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parse JSON
    let parsedAnalysis;
    try {
      const cleanedJson = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsedAnalysis = JSON.parse(cleanedJson);
    } catch (e) {
      console.error('[DeepSeek JSON Parse Error]:', e.message, 'Raw response:', rawContent);
      return res.status(500).json({ error: 'Failed to parse AI analysis response from DeepSeek.' });
    }

    // Robust sanitization for nextMessages if returned as string
    if (typeof parsedAnalysis.nextMessages === 'string') {
      try {
        const cleanedStr = parsedAnalysis.nextMessages.trim();
        if (cleanedStr.startsWith('[') && cleanedStr.endsWith(']')) {
          // Replace unquoted JS object keys and single-quoted strings
          const jsonValidStr = cleanedStr
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
            .replace(/'/g, '"');
          parsedAnalysis.nextMessages = JSON.parse(jsonValidStr);
        }
      } catch (err) {
        console.warn('[DeepSeek nextMessages sanitize warning]:', err.message);
        parsedAnalysis.nextMessages = [];
      }
    }

    if (!Array.isArray(parsedAnalysis.nextMessages)) {
      parsedAnalysis.nextMessages = [];
    }

    // Save to conversation document
    conversation.aiAnalysis = {
      ...parsedAnalysis,
      generatedAt: new Date()
    };
    await conversation.save();

    console.log(`[DeepSeek AI] Analysis generated and saved for conversation ${id}`);
    return res.json({
      success: true,
      aiAnalysis: conversation.aiAnalysis
    });

  } catch (error) {
    console.error('[API Error /conversations/:id/ai-analysis]:', error);
    return res.status(500).json({ error: 'Failed to generate AI analysis.', details: error.message });
  }
});

/**
 * GET /api/leads
 * Fetch leads with server-side pagination, search, and multi-field filtering
 */
router.get('/leads', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const { search, source, stage, msgCount, listId, lastFollowup, lastResponse, buyerIntent, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let match = {};

    // 1. Stage filter (supports multi-select comma separated)
    if (stage && stage !== 'all') {
      const stages = stage.split(',').filter(Boolean);
      if (stages.length > 0) {
        match.leadStage = { $in: stages };
      }
    }

    // 2. Source filter (supports multi-select comma separated)
    if (source && source !== 'all') {
      const cleanSources = source.split(',').map(s => s.replace(' (LinkedIn)', '')).filter(Boolean);
      if (cleanSources.length > 0) {
        match.accountName = { $in: cleanSources };
      }
    }

    // 3. Search query filter
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      match.$or = [
        { 'prospect.name': searchRegex },
        { 'prospect.company': searchRegex },
        { 'prospect.headline': searchRegex },
        { accountName: searchRegex }
      ];
    }

    // 4. List filter (supports multi-select comma separated)
    if (listId && listId !== 'all') {
      const lists = listId.split(',').filter(Boolean);
      if (lists.length > 0) {
        match.lists = { $in: lists };
      }
    }

    const allConvs = await Conversation.find(match);

    const mappedLeads = await Promise.all(allConvs.map(async (c) => {
      const msgs = await Message.find({ conversationId: c._id }).sort({ timestamp: -1 }).lean();
      const count = msgs.length;
      const lastFollowup = c.lastFollowupAt || msgs.find(m => m.sender === 'me')?.timestamp || null;
      const lastResponse = c.lastResponseAt || msgs.find(m => m.sender === 'prospect')?.timestamp || null;

      const buyingIntentScore = c.aiAnalysis?.conversationAnalysis?.buyingIntentScore ?? null;
      const buyingIntentLabel = c.aiAnalysis?.conversationAnalysis?.buyingIntentLabel ?? null;

      return {
        id: c._id,
        conversationId: c._id,
        name: c.prospect?.name || 'Unknown Prospect',
        avatar: c.prospect?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        company: c.prospect?.company || 'LinkedIn Member',
        headline: c.prospect?.headline || '',
        profileUrl: c.prospect?.profileUrl || '#',
        source: c.accountName ? `${c.accountName} (LinkedIn)` : 'LinkedIn DM',
        state: c.leadStage || 'New Lead',
        messageCount: count > 0 ? count : 1,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        lastFollowupAt: lastFollowup,
        lastResponseAt: lastResponse,
        buyingIntentScore,
        buyingIntentLabel,
        isArchived: Boolean(c.isArchived),
        aiAnalysis: c.aiAnalysis || null
      };
    }));

    // 5. Message Count Filter
    let filteredLeads = mappedLeads;
    if (msgCount && msgCount !== 'all') {
      const ranges = msgCount.split(',').filter(Boolean);
      if (ranges.length > 0) {
        filteredLeads = mappedLeads.filter(l => {
          const cnt = l.messageCount || 1;
          return ranges.some(range => {
            if (range === '1') return cnt === 1;
            if (range === '2-5') return cnt >= 2 && cnt <= 5;
            if (range === '6-10') return cnt >= 6 && cnt <= 10;
            if (range === '10+') return cnt >= 10;
            if (range === '5+') return cnt >= 5;
            return false;
          });
        });
      }
    }

    // 5b. Last Followup Filter
    if (lastFollowup && lastFollowup !== 'all') {
      const ranges = lastFollowup.split(',').filter(Boolean);
      if (ranges.length > 0) {
        filteredLeads = filteredLeads.filter(l => {
          if (!l.lastFollowupAt) return ranges.includes('none');
          const diffDays = (Date.now() - new Date(l.lastFollowupAt).getTime()) / (1000 * 60 * 60 * 24);
          return ranges.some(range => {
            if (range === '1') return diffDays <= 1;
            if (range === '2-3') return diffDays > 1 && diffDays <= 3;
            if (range === '4-6') return diffDays > 3 && diffDays <= 6;
            if (range === '7+') return diffDays > 6;
            return false;
          });
        });
      }
    }

    // 5c. Last Response Filter
    if (lastResponse && lastResponse !== 'all') {
      const ranges = lastResponse.split(',').filter(Boolean);
      if (ranges.length > 0) {
        filteredLeads = filteredLeads.filter(l => {
          if (!l.lastResponseAt) return ranges.includes('none');
          const diffDays = (Date.now() - new Date(l.lastResponseAt).getTime()) / (1000 * 60 * 60 * 24);
          return ranges.some(range => {
            if (range === '1') return diffDays <= 1;
            if (range === '2-3') return diffDays > 1 && diffDays <= 3;
            if (range === '4-6') return diffDays > 3 && diffDays <= 6;
            if (range === '7+') return diffDays > 6;
            return false;
          });
        });
      }
    }

    // 5d. Buyer Intent Filter
    if (buyerIntent && buyerIntent !== 'all') {
      const intents = buyerIntent.split(',').filter(Boolean);
      if (intents.length > 0) {
        filteredLeads = filteredLeads.filter(l => {
          const score = l.buyingIntentScore;
          return intents.some(intent => {
            if (intent === 'high') return score >= 70;
            if (intent === 'medium') return score >= 40 && score < 70;
            if (intent === 'low') return score > 0 && score < 40;
            if (intent === 'unknown') return score === null || score === undefined || score === 0;
            return false;
          });
        });
      }
    }

    // 6. Server-side sorting across all fields (archived leads always at the end)
    const isAsc = sortOrder === 'asc';
    filteredLeads.sort((a, b) => {
      if (Boolean(a.isArchived) !== Boolean(b.isArchived)) {
        return a.isArchived ? 1 : -1;
      }
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (['createdAt', 'lastFollowupAt', 'lastResponseAt', 'lastMessageAt'].includes(sortBy)) {
        valA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
        valB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
      } else if (['messageCount', 'buyingIntentScore'].includes(sortBy)) {
        valA = a[sortBy] ?? -1;
        valB = b[sortBy] ?? -1;
      } else if (typeof valA === 'string') {
        valA = (valA || '').toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    const total = filteredLeads.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const currentPage = Math.min(page, totalPages);

    // Slice for current page
    const startIndex = (currentPage - 1) * limit;
    const paginatedLeads = filteredLeads.slice(startIndex, startIndex + limit);

    // Fetch all distinct account sources for dropdown option list
    const distinctAccountNames = await Conversation.distinct('accountName');
    const availableSources = distinctAccountNames.filter(Boolean).map(name => `${name} (LinkedIn)`);

    return res.json({
      leads: paginatedLeads,
      total,
      page: currentPage,
      limit,
      totalPages,
      availableSources
    });
  } catch (error) {
    console.error('[API Error /leads]:', error);
    return res.status(500).json({ error: 'Failed to fetch leads.' });
  }
});

/**
 * PATCH /api/leads/:id/state
 * Update lead state/stage directly
 */
router.patch('/leads/:id/state', async (req, res) => {
  try {
    const { id } = req.params;
    const { state } = req.body;

    const conv = await Conversation.findByIdAndUpdate(
      id,
      { leadStage: state },
      { returnDocument: 'after' }
    );

    if (!conv) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    return res.json({ message: 'Lead state updated successfully.', lead: conv });
  } catch (error) {
    console.error('[API Error PATCH /leads/state]:', error);
    return res.status(500).json({ error: 'Failed to update lead state.' });
  }
});

/**
 * GET /api/settings
 * Fetch global application settings (sync frequency, etc.)
 */
router.get('/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global', syncFrequencyMinutes: 0.5 });
    }
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

/**
 * POST /api/settings
 * Update global application settings
 */
router.post('/settings', async (req, res) => {
  try {
    const { syncFrequencyMinutes } = req.body;
    const freq = parseFloat(syncFrequencyMinutes) || 0.5;

    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { syncFrequencyMinutes: freq },
      { upsert: true, returnDocument: 'after', new: true }
    );

    // Dynamically update cron timer
    updateSyncFrequency(freq);

    return res.json({ message: 'Settings updated successfully.', settings });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

/**
 * GET /api/settings/stages
 * Fetch pipeline stages
 */
router.get('/settings/stages', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings || !settings.pipelineStages || settings.pipelineStages.length === 0) {
      settings = await Settings.findOneAndUpdate(
        { key: 'global' },
        { $setOnInsert: { key: 'global', syncFrequencyMinutes: 0.5, pipelineStages: defaultStages } },
        { upsert: true, returnDocument: 'after', new: true }
      );
    }
    const stages = (settings.pipelineStages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    return res.json(stages);
  } catch (error) {
    console.error('[API Error GET /settings/stages]:', error);
    return res.status(500).json({ error: 'Failed to fetch pipeline stages.' });
  }
});

/**
 * POST /api/settings/stages
 * Add a new custom pipeline stage
 */
router.post('/settings/stages', async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Stage name is required.' });
    }

    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global', syncFrequencyMinutes: 0.5, pipelineStages: defaultStages });
    }

    const newStage = {
      id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      color: color || '#3b82f6',
      description: description ? description.trim() : '',
      order: (settings.pipelineStages?.length || 0) + 1
    };

    settings.pipelineStages.push(newStage);
    await settings.save();

    return res.status(201).json({ message: 'Pipeline stage created successfully.', stage: newStage, stages: settings.pipelineStages });
  } catch (error) {
    console.error('[API Error POST /settings/stages]:', error);
    return res.status(500).json({ error: 'Failed to create stage.' });
  }
});

/**
 * PUT /api/settings/stages
 * Update or reorder pipeline stages
 */
router.put('/settings/stages', async (req, res) => {
  try {
    const { stages } = req.body;
    if (!Array.isArray(stages)) {
      return res.status(400).json({ error: 'Stages array is required.' });
    }

    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { pipelineStages: stages },
      { upsert: true, returnDocument: 'after', new: true }
    );

    return res.json({ message: 'Pipeline stages updated successfully.', stages: settings.pipelineStages });
  } catch (error) {
    console.error('[API Error PUT /settings/stages]:', error);
    return res.status(500).json({ error: 'Failed to update pipeline stages.' });
  }
});

/**
 * DELETE /api/settings/stages/:id
 * Delete a custom pipeline stage
 */
router.delete('/settings/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found.' });
    }

    settings.pipelineStages = settings.pipelineStages.filter(s => s.id !== id && s._id?.toString() !== id);
    await settings.save();

    return res.json({ message: 'Pipeline stage deleted successfully.', stages: settings.pipelineStages });
  } catch (error) {
    console.error('[API Error DELETE /settings/stages]:', error);
    return res.status(500).json({ error: 'Failed to delete pipeline stage.' });
  }
});

/**
 * GET /api/settings/ai
 * Fetch AI Config (DeepSeek API Key & AI Prompts)
 */
router.get('/settings/ai', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global', syncFrequencyMinutes: 0.5 });
    }
    const { defaultPrompts } = await import('../models/Settings.js');
    if (!settings.aiPrompts || settings.aiPrompts.length !== 1 || settings.aiPrompts[0].id !== 'p_prospect_analysis') {
      settings.aiPrompts = defaultPrompts;
      await settings.save();
    }
    return res.json({
      deepseekApiKey: settings.deepseekApiKey || '',
      aiPrompts: settings.aiPrompts || []
    });
  } catch (error) {
    console.error('[API Error GET /settings/ai]:', error);
    return res.status(500).json({ error: 'Failed to fetch AI configuration.' });
  }
});

/**
 * POST /api/settings/ai/key
 * Update DeepSeek API key
 */
router.post('/settings/ai/key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    let settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: { deepseekApiKey: apiKey ? apiKey.trim() : '' } },
      { new: true, upsert: true }
    );
    return res.json({ message: 'DeepSeek API key updated successfully.', deepseekApiKey: settings.deepseekApiKey });
  } catch (error) {
    console.error('[API Error POST /settings/ai/key]:', error);
    return res.status(500).json({ error: 'Failed to update API key.' });
  }
});

/**
 * PUT /api/settings/ai/prompts/:id
 * Update an AI prompt template by ID
 */
router.put('/settings/ai/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, promptText } = req.body;

    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found.' });
    }

    const promptIdx = settings.aiPrompts.findIndex(p => p.id === id || p._id?.toString() === id);
    if (promptIdx !== -1) {
      if (title !== undefined) settings.aiPrompts[promptIdx].title = title.trim();
      if (description !== undefined) settings.aiPrompts[promptIdx].description = description.trim();
      if (promptText !== undefined) settings.aiPrompts[promptIdx].promptText = promptText.trim();
    } else {
      settings.aiPrompts.push({ id, title, description, promptText });
    }

    await settings.save();
    return res.json({ message: 'AI prompt updated successfully.', aiPrompts: settings.aiPrompts });
  } catch (error) {
    console.error('[API Error PUT /settings/ai/prompts/:id]:', error);
    return res.status(500).json({ error: 'Failed to update AI prompt.' });
  }
});

/**
 * GET /api/dashboard/stats
 * Analytics, pipeline distribution, and top accounts leaderboard
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const totalLeads = await Conversation.countDocuments();
    const totalAccounts = await Account.countDocuments();
    const totalMessages = await Message.countDocuments();

    // 1. Who is bringing most leads (Account Leaderboard)
    const accountBreakdownRaw = await Conversation.aggregate([
      { $group: { _id: '$accountName', leadCount: { $sum: 1 } } },
      { $sort: { leadCount: -1 } }
    ]);

    const accountLeaderboard = await Promise.all(accountBreakdownRaw.map(async (item) => {
      const accName = item._id || 'Unknown Account';
      const accDoc = await Account.findOne({ name: accName });

      const convs = await Conversation.find({ accountName: accName }).select('_id');
      const convIds = convs.map(c => c._id);
      const msgCount = await Message.countDocuments({ conversationId: { $in: convIds } });

      return {
        accountName: accName,
        avatar: accDoc?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        role: accDoc?.role || 'Sales Lead',
        leadCount: item.leadCount,
        messageCount: msgCount,
        percentage: totalLeads > 0 ? Math.round((item.leadCount / totalLeads) * 100) : 0
      };
    }));

    // 2. Where are leads in pipeline (Stage Breakdown)
    const stageCountsRaw = await Conversation.aggregate([
      { $group: { _id: '$leadStage', count: { $sum: 1 } } }
    ]);

    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global', syncFrequencyMinutes: 0.5, pipelineStages: defaultStages });
    }
    const sortedStages = [...(settings.pipelineStages || defaultStages)].sort((a, b) => (a.order || 0) - (b.order || 0));
    const ALL_STAGES = sortedStages.map(s => s.name);
    const stageColorMap = {};
    sortedStages.forEach(s => {
      stageColorMap[s.name] = s.color;
    });

    const stageMap = {};
    stageCountsRaw.forEach(s => {
      stageMap[s._id || 'New Lead'] = s.count;
    });

    const pipelineStages = ALL_STAGES.map(stage => {
      const count = stageMap[stage] || 0;
      return {
        stage,
        count,
        color: stageColorMap[stage] || '#3b82f6',
        percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
      };
    });

    // Pipeline Conversion Rate (% of leads advancing past the initial stage)
    const entryStageName = ALL_STAGES[0] || 'New Lead';
    const convertedCount = pipelineStages
      .filter(s => s.stage !== entryStageName)
      .reduce((sum, s) => sum + s.count, 0);

    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // 3. Recent Prospects
    const recentConvs = await Conversation.find().sort({ createdAt: -1 }).limit(5);
    const recentLeads = recentConvs.map(c => ({
      id: c._id,
      name: c.prospect?.name || 'Unknown Prospect',
      avatar: c.prospect?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      source: c.accountName ? `${c.accountName} (LinkedIn)` : 'LinkedIn DM',
      state: c.leadStage || 'New Lead',
      createdAt: c.createdAt
    }));

    // 4. Buyer Intent & Last Followup calculations
    const allConversations = await Conversation.find().lean();
    const intentCounts = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
    const followupCounts = {
      '1 day': 0,
      '2 days': 0,
      '3 days': 0,
      '4 days': 0,
      '5 days': 0,
      '6 days': 0,
      'More than 6 days': 0
    };

    const now = Date.now();
    await Promise.all(allConversations.map(async (c) => {
      // Intent
      const label = c.aiAnalysis?.conversationAnalysis?.buyingIntentLabel || '';
      if (label.toLowerCase().includes('high')) {
        intentCounts.High++;
      } else if (label.toLowerCase().includes('medium')) {
        intentCounts.Medium++;
      } else if (label.toLowerCase().includes('low')) {
        intentCounts.Low++;
      } else {
        intentCounts.Unknown++;
      }

      // Followup: Live calculate last follow up based on last message sent by me
      let lastDate = null;
      const lastMeMsg = await Message.findOne({ conversationId: c._id, sender: 'me' })
        .sort({ timestamp: -1 })
        .select('timestamp')
        .lean();
      
      if (lastMeMsg) {
        lastDate = lastMeMsg.timestamp;
      } else if (c.lastFollowupAt) {
        lastDate = c.lastFollowupAt;
      }

      if (!lastDate) {
        followupCounts['More than 6 days']++;
        return;
      }
      const diffMs = now - new Date(lastDate).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        followupCounts['1 day']++;
      } else if (diffDays === 2) {
        followupCounts['2 days']++;
      } else if (diffDays === 3) {
        followupCounts['3 days']++;
      } else if (diffDays === 4) {
        followupCounts['4 days']++;
      } else if (diffDays === 5) {
        followupCounts['5 days']++;
      } else if (diffDays === 6) {
        followupCounts['6 days']++;
      } else {
        followupCounts['More than 6 days']++;
      }
    }));

    const buyerIntentStats = [
      { label: 'High', count: intentCounts.High, percentage: totalLeads > 0 ? Math.round((intentCounts.High / totalLeads) * 100) : 0 },
      { label: 'Medium', count: intentCounts.Medium, percentage: totalLeads > 0 ? Math.round((intentCounts.Medium / totalLeads) * 100) : 0 },
      { label: 'Low', count: intentCounts.Low, percentage: totalLeads > 0 ? Math.round((intentCounts.Low / totalLeads) * 100) : 0 },
      { label: 'Unknown/Neutral', count: intentCounts.Unknown, percentage: totalLeads > 0 ? Math.round((intentCounts.Unknown / totalLeads) * 100) : 0 }
    ];

    const lastFollowupStats = [
      { label: '1 day', count: followupCounts['1 day'], percentage: totalLeads > 0 ? Math.round((followupCounts['1 day'] / totalLeads) * 100) : 0 },
      { label: '2 days', count: followupCounts['2 days'], percentage: totalLeads > 0 ? Math.round((followupCounts['2 days'] / totalLeads) * 100) : 0 },
      { label: '3 days', count: followupCounts['3 days'], percentage: totalLeads > 0 ? Math.round((followupCounts['3 days'] / totalLeads) * 100) : 0 },
      { label: '4 days', count: followupCounts['4 days'], percentage: totalLeads > 0 ? Math.round((followupCounts['4 days'] / totalLeads) * 100) : 0 },
      { label: '5 days', count: followupCounts['5 days'], percentage: totalLeads > 0 ? Math.round((followupCounts['5 days'] / totalLeads) * 100) : 0 },
      { label: '6 days', count: followupCounts['6 days'], percentage: totalLeads > 0 ? Math.round((followupCounts['6 days'] / totalLeads) * 100) : 0 },
      { label: '7+ days', count: followupCounts['More than 6 days'], percentage: totalLeads > 0 ? Math.round((followupCounts['More than 6 days'] / totalLeads) * 100) : 0 }
    ];

    return res.json({
      totalLeads,
      totalAccounts,
      totalMessages,
      conversionRate,
      accountLeaderboard,
      pipelineStages,
      recentLeads,
      buyerIntentStats,
      lastFollowupStats
    });
  } catch (error) {
    console.error('[API Error /dashboard/stats]:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
});

function formatTimeAgo(dateInput) {
  if (!dateInput) return 'Just now';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lead Lists CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/lists
 * Fetch all lead lists with lead count
 */
router.get('/lists', async (req, res) => {
  try {
    const lists = await LeadList.find().sort({ createdAt: -1 }).lean();

    const listsWithCount = await Promise.all(
      lists.map(async (list) => {
        const count = await Conversation.countDocuments({ lists: list._id });
        return {
          id: list._id.toString(),
          _id: list._id.toString(),
          name: list.name,
          description: list.description || '',
          color: list.color || '#3B82F6',
          leadCount: count,
          createdAt: list.createdAt,
          updatedAt: list.updatedAt,
        };
      })
    );

    return res.json(listsWithCount);
  } catch (error) {
    console.error('[API Error GET /lists]:', error);
    return res.status(500).json({ error: 'Failed to fetch lead lists.' });
  }
});

/**
 * POST /api/lists
 * Create a new lead list
 */
router.post('/lists', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'List name is required.' });
    }

    const list = await LeadList.create({
      name: name.trim(),
      description: (description || '').trim(),
      color: color || '#3B82F6',
    });

    return res.status(201).json({
      id: list._id.toString(),
      _id: list._id.toString(),
      name: list.name,
      description: list.description,
      color: list.color,
      leadCount: 0,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    });
  } catch (error) {
    console.error('[API Error POST /lists]:', error);
    return res.status(500).json({ error: 'Failed to create list.' });
  }
});

/**
 * PUT /api/lists/:id
 * Update a lead list name, description or color
 */
router.put('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;

    const list = await LeadList.findByIdAndUpdate(
      id,
      { name: name?.trim(), description: (description || '').trim(), color },
      { new: true }
    );

    if (!list) return res.status(404).json({ error: 'List not found.' });

    const count = await Conversation.countDocuments({ lists: list._id });
    return res.json({
      id: list._id.toString(),
      _id: list._id.toString(),
      name: list.name,
      description: list.description,
      color: list.color,
      leadCount: count,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    });
  } catch (error) {
    console.error('[API Error PUT /lists/:id]:', error);
    return res.status(500).json({ error: 'Failed to update list.' });
  }
});

/**
 * DELETE /api/lists/:id
 * Delete a lead list and remove its reference from all conversations
 */
router.delete('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const list = await LeadList.findByIdAndDelete(id);
    if (!list) return res.status(404).json({ error: 'List not found.' });

    // Remove list reference from all conversations
    await Conversation.updateMany(
      { lists: id },
      { $pull: { lists: id } }
    );

    return res.json({ message: 'List deleted successfully.' });
  } catch (error) {
    console.error('[API Error DELETE /lists/:id]:', error);
    return res.status(500).json({ error: 'Failed to delete list.' });
  }
});

/**
 * POST /api/lists/:id/leads/:leadId
 * Add a lead (conversation) to a list
 */
router.post('/lists/:id/leads/:leadId', async (req, res) => {
  try {
    const { id, leadId } = req.params;

    const list = await LeadList.findById(id);
    if (!list) return res.status(404).json({ error: 'List not found.' });

    await Conversation.findByIdAndUpdate(
      leadId,
      { $addToSet: { lists: id } }
    );

    return res.json({ message: 'Lead added to list.' });
  } catch (error) {
    console.error('[API Error POST /lists/:id/leads/:leadId]:', error);
    return res.status(500).json({ error: 'Failed to add lead to list.' });
  }
});

/**
 * DELETE /api/lists/:id/leads/:leadId
 * Remove a lead (conversation) from a list
 */
router.delete('/lists/:id/leads/:leadId', async (req, res) => {
  try {
    const { id, leadId } = req.params;

    await Conversation.findByIdAndUpdate(
      leadId,
      { $pull: { lists: id } }
    );

    return res.json({ message: 'Lead removed from list.' });
  } catch (error) {
    console.error('[API Error DELETE /lists/:id/leads/:leadId]:', error);
    return res.status(500).json({ error: 'Failed to remove lead from list.' });
  }
});

/**
 * GET /api/leads/:leadId/lists
 * Get all lists a specific lead belongs to
 */
router.get('/leads/:leadId/lists', async (req, res) => {
  try {
    const { leadId } = req.params;
    const conv = await Conversation.findById(leadId).populate('lists').lean();
    if (!conv) return res.status(404).json({ error: 'Lead not found.' });

    const lists = (conv.lists || []).map(l => ({
      id: l._id.toString(),
      _id: l._id.toString(),
      name: l.name,
      color: l.color || '#3B82F6',
    }));

    return res.json(lists);
  } catch (error) {
    console.error('[API Error GET /leads/:leadId/lists]:', error);
    return res.status(500).json({ error: 'Failed to fetch lead lists.' });
  }
});

export default router;
