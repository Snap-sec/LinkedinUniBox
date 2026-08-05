import axios from 'axios';
import Account from '../models/Account.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

/**
 * Extract headers and cookie values from the input cookies array
 */
function prepareLinkedinHeaders(cookies) {
  let cookieHeaderStr = '';
  let jsessionId = '';
  let liAt = '';

  if (Array.isArray(cookies)) {
    console.log(`[Cookie Parser] Processing JSON array with ${cookies.length} cookie items.`);
    cookies.forEach(c => {
      cookieHeaderStr += `${c.name}=${c.value}; `;
      if (c.name === 'JSESSIONID') jsessionId = c.value.replace(/"/g, '');
      if (c.name === 'li_at') liAt = c.value;
    });
  } else if (typeof cookies === 'string') {
    console.log(`[Cookie Parser] Processing raw cookie header string (length: ${cookies.length}).`);
    cookieHeaderStr = cookies;
    const match = cookies.match(/JSESSIONID="?([^";]+)"?/);
    if (match) jsessionId = match[1];
    const liMatch = cookies.match(/li_at=([^";]+)/);
    if (liMatch) liAt = liMatch[1];
  }

  const csrfToken = jsessionId || 'ajax:6846527549201247517';

  console.log(`[Cookie Tokens Found]:`);
  console.log(`  - li_at present: ${Boolean(liAt)} (${liAt ? liAt.substring(0, 12) + '...' : 'NONE'})`);
  console.log(`  - JSESSIONID present: ${Boolean(jsessionId)} (${jsessionId || 'NONE'})`);
  console.log(`  - csrf-token: ${csrfToken}`);

  const headers = {
    'accept': 'application/graphql, application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'csrf-token': csrfToken,
    'priority': 'u=1, i',
    'referer': 'https://www.linkedin.com/preload/?_bprMode=vanilla',
    'sec-ch-prefers-color-scheme': 'light',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'x-li-lang': 'en_US',
    'x-li-page-instance': 'urn:li:page:d_messaging_index;A1qKs71fRc2w+CExhssX8Q==',
    'x-li-track': '{"clientVersion":"1.13.45607","mpVersion":"1.13.45607","osName":"web","timezoneOffset":5.5,"timezone":"Asia/Calcutta","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":3840,"displayHeight":1080}',
    'x-restli-protocol-version': '2.0.0',
    'Cookie': cookieHeaderStr.trim()
  };

  return { headers, liAt, jsessionId };
}

/**
 * Fetch deeper messages for a specific conversation URN using Voyager GraphQL endpoint (messengerMessages)
 */
async function fetchMessagesForConversationUrn(convUrn, headers) {
  if (!convUrn) return [];
  try {
    // Explicitly encode parentheses ( and ) for LinkedIn GraphQL variables parameter syntax
    const encodedUrn = encodeURIComponent(convUrn)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/'/g, '%27');

    const graphqlUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodedUrn})`;
    
    console.log(`  [GraphQL 2nd Request - Deep Messages] GET ${graphqlUrl.substring(0, 140)}...`);
    const res = await axios.get(graphqlUrl, {
      headers: {
        ...headers,
        'accept': 'application/graphql'
      },
      timeout: 10000
    });

    const elements = res.data?.data?.messengerMessagesBySyncToken?.elements || [];
    console.log(`  [GraphQL 2nd Request Success] Retrieved ${elements.length} deep messages for thread URN "${convUrn}".`);
    return elements;
  } catch (err) {
    console.warn(`  [GraphQL 2nd Request Warning] Could not fetch deeper messages for URN "${convUrn}": ${err.message}`);
    return [];
  }
}

/**
 * Fetch messages from LinkedIn Voyager API for an account and store in MongoDB
 */
export async function syncLinkedinMessagesForAccount(accountDoc, rawCookies) {
  console.log(`\n==================================================`);
  console.log(`[LinkedIn Sync Started] Account: "${accountDoc.name}"`);

  const { headers } = prepareLinkedinHeaders(rawCookies);

  let syncedMessages = [];
  let syncedConversationsCount = 0;

  // 1. Profile / Mailbox URN Discovery via Voyager /me
  let mailboxUrn = null;
  try {
    console.log(`[LinkedIn Profile Discovery] GET https://www.linkedin.com/voyager/api/me`);
    const meRes = await axios.get('https://www.linkedin.com/voyager/api/me', { headers, timeout: 8000 });
    if (meRes.data) {
      const miniProfile = meRes.data.miniProfile || meRes.data;
      const entityUrn = miniProfile.entityUrn || miniProfile.objectUrn || meRes.data.plainId;
      if (entityUrn) {
        const profileId = String(entityUrn).replace('urn:li:fs_miniProfile:', '').replace('urn:li:fs_profile:', '').replace('urn:li:member:', '');
        mailboxUrn = profileId.startsWith('urn:li:') ? profileId : `urn:li:fsd_profile:${profileId}`;
        console.log(`[LinkedIn Profile Found] Mailbox URN: "${mailboxUrn}", Name: "${miniProfile.firstName || ''} ${miniProfile.lastName || ''}".`);
        
        if (miniProfile.firstName && (!accountDoc.name || accountDoc.name === 'www' || accountDoc.name === 'undefined')) {
          accountDoc.name = `${miniProfile.firstName} ${miniProfile.lastName || ''}`.trim();
        }
      }
    }
  } catch (meErr) {
    console.warn(`[LinkedIn Profile Discovery Warning] Profile check failed: ${meErr.message}`);
  }

  // 2. Candidate Endpoints Loop
  const candidateEndpoints = [];

  if (mailboxUrn) {
    const encodedMailbox = encodeURIComponent(mailboxUrn);
    candidateEndpoints.push({
      name: 'Voyager GraphQL (encoded mailboxUrn)',
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(mailboxUrn:${encodedMailbox},query:(predicateUnions:List((conversationCategoryPredicate:(category:PRIMARY_INBOX)))),count:20)`
    });
    candidateEndpoints.push({
      name: 'Voyager GraphQL (raw mailboxUrn)',
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(mailboxUrn:${mailboxUrn},query:(predicateUnions:List((conversationCategoryPredicate:(category:PRIMARY_INBOX)))),count:20)`
    });
    candidateEndpoints.push({
      name: 'Voyager REST (with mailboxUrn)',
      url: `https://www.linkedin.com/voyager/api/messaging/conversations?mailboxUrn=${encodedMailbox}&count=20`
    });
  }

  candidateEndpoints.push({
    name: 'Voyager REST (syncedTimeline)',
    url: 'https://www.linkedin.com/voyager/api/messaging/conversations?q=syncedTimeline&count=20'
  });
  candidateEndpoints.push({
    name: 'Voyager REST (standard)',
    url: 'https://www.linkedin.com/voyager/api/messaging/conversations?count=20'
  });
  candidateEndpoints.push({
    name: 'Voyager GraphQL (default query)',
    url: 'https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(query:(predicateUnions:List((conversationCategoryPredicate:(category:PRIMARY_INBOX)))),count:20)'
  });

  let response = null;
  let successfulEndpointName = '';
  let successfulEndpointUrl = '';

  for (const ep of candidateEndpoints) {
    try {
      console.log(`[LinkedIn API Request] Trying ${ep.name}: GET ${ep.url}`);
      const res = await axios.get(ep.url, { headers, timeout: 10000 });
      
      // Check if GraphQL returned payload error
      if (res.data?.errors && Array.isArray(res.data.errors) && res.data.errors.length > 0) {
        console.warn(`[LinkedIn API Warning] ${ep.name} returned schema error: "${res.data.errors[0]?.message || 'GraphQL error'}"`);
        continue;
      }

      if (res.data) {
        response = res;
        successfulEndpointName = ep.name;
        successfulEndpointUrl = ep.url;
        console.log(`[LinkedIn API Success] Successfully received data via ${ep.name} (Status: ${res.status})`);
        break;
      }
    } catch (err) {
      console.warn(`[LinkedIn API Warning] ${ep.name} failed: ${err.message}`);
    }
  }

  const data = response?.data;
  if (!data) {
    console.warn(`[LinkedIn Sync Result] No response data received from any LinkedIn API endpoint for ${accountDoc.name}.`);
  } else {
    console.log(`[LinkedIn Response Keys]:`, Object.keys(data));
    if (data.data) console.log(`[LinkedIn Data Keys]:`, Object.keys(data.data));

    // Build lookup map for included objects (REST schema)
    const includedMap = new Map();
    if (Array.isArray(data.included)) {
      data.included.forEach(item => {
        if (item.entityUrn) includedMap.set(item.entityUrn, item);
        if (item.objectUrn) includedMap.set(item.objectUrn, item);
        if (item.$type) includedMap.set(`${item.$type}_${item.entityUrn || Math.random()}`, item);
      });
    }

    // Helper to extract elements from payloads
    const extractElements = (payload) => {
      if (payload?.data?.messengerConversationsByCategoryQuery?.elements) {
        return payload.data.messengerConversationsByCategoryQuery.elements;
      }
      if (payload?.data?.messengerConversationsByMailbox?.elements) {
        return payload.data.messengerConversationsByMailbox.elements;
      }
      if (payload?.data?.messengerConversationsByMailbox?.edges) {
        return payload.data.messengerConversationsByMailbox.edges.map(e => e.node || e);
      }
      if (payload?.data?.messengerConversations?.elements) {
        return payload.data.messengerConversations.elements;
      }
      if (payload?.data?.messengerConversations?.edges) {
        return payload.data.messengerConversations.edges.map(e => e.node || e);
      }
      if (Array.isArray(payload?.elements) && payload.elements.length > 0) {
        return payload.elements;
      }
      if (Array.isArray(payload?.included)) {
        return payload.included.filter(item => 
          (item.$type && item.$type.includes('Conversation')) || 
          (item.entityUrn && item.entityUrn.includes('conversation'))
        );
      }
      if (Array.isArray(payload?.elements)) {
        return payload.elements;
      }
      return [];
    };

    // Helper to extract nextCursor from payloads
    const extractNextCursor = (payload) => {
      if (payload?.data?.messengerConversationsByCategoryQuery?.metadata?.nextCursor) {
        return payload.data.messengerConversationsByCategoryQuery.metadata.nextCursor;
      }
      if (payload?.data?.messengerConversationsByMailbox?.metadata?.nextCursor) {
        return payload.data.messengerConversationsByMailbox.metadata.nextCursor;
      }
      if (payload?.data?.messengerConversations?.metadata?.nextCursor) {
        return payload.data.messengerConversations.metadata.nextCursor;
      }
      if (payload?.metadata?.nextCursor) {
        return payload.metadata.nextCursor;
      }
      return null;
    };

    let rawList = extractElements(data);
    console.log(`[LinkedIn Parser] Page 1: Extracted ${rawList.length} thread objects.`);

    // 2. Fetch subsequent pages if there's a nextCursor, up to 100 inboxes (5 pages of 20)
    let currentCursor = extractNextCursor(data);
    let pageNum = 2;
    const maxInboxes = 100;

    while (currentCursor && rawList.length < maxInboxes && successfulEndpointUrl) {
      console.log(`[LinkedIn Sync Pagination] Page ${pageNum}: Found nextCursor: "${currentCursor}". Fetched so far: ${rawList.length}. Fetching more...`);
      try {
        let nextPageUrl = successfulEndpointUrl;
        if (successfulEndpointUrl.includes('variables=')) {
          const varStart = nextPageUrl.indexOf('variables=');
          const lastParenIndex = nextPageUrl.lastIndexOf(')');
          if (varStart !== -1 && lastParenIndex > varStart) {
            const beforeParen = nextPageUrl.slice(0, lastParenIndex);
            const afterParen = nextPageUrl.slice(lastParenIndex);
            
            if (beforeParen.includes('nextCursor:')) {
              // Replace existing nextCursor value in variables
              const nextCursorRegex = /,?nextCursor:[^,)]+/;
              const cleanBeforeParen = beforeParen.replace(nextCursorRegex, '');
              nextPageUrl = `${cleanBeforeParen},nextCursor:${currentCursor}${afterParen}`;
            } else {
              nextPageUrl = `${beforeParen},nextCursor:${currentCursor}${afterParen}`;
            }
          }
        } else {
          // REST API pagination
          const cleanUrl = nextPageUrl.split(/[&?]nextCursor=/)[0].split(/[&?]start=/)[0];
          nextPageUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}nextCursor=${encodeURIComponent(currentCursor)}&start=${rawList.length}`;
        }
        
        console.log(`[LinkedIn Sync Pagination Request] GET ${nextPageUrl}`);
        const nextPageRes = await axios.get(nextPageUrl, { headers, timeout: 10000 });
        if (nextPageRes.data) {
          const nextPageList = extractElements(nextPageRes.data);
          console.log(`[LinkedIn Sync Pagination Success] Page ${pageNum} fetched ${nextPageList.length} conversations.`);
          if (nextPageList.length === 0) {
            console.log(`[LinkedIn Sync Pagination] Page ${pageNum} returned 0 conversations. Ending pagination loop.`);
            break;
          }
          rawList = rawList.concat(nextPageList);

          // Merge nextPage includedMap if it's REST
          if (Array.isArray(nextPageRes.data.included)) {
            nextPageRes.data.included.forEach(item => {
              if (item.entityUrn) includedMap.set(item.entityUrn, item);
              if (item.objectUrn) includedMap.set(item.objectUrn, item);
              if (item.$type) includedMap.set(`${item.$type}_${item.entityUrn || Math.random()}`, item);
            });
          }

          // Extract nextCursor for next iteration
          const prevCursor = currentCursor;
          currentCursor = extractNextCursor(nextPageRes.data);
          if (currentCursor === prevCursor) {
            console.log(`[LinkedIn Sync Pagination] Cursor did not change. Breaking pagination loop to prevent infinite loop.`);
            break;
          }
          pageNum++;
        } else {
          break;
        }
      } catch (pageErr) {
        console.warn(`[LinkedIn Sync Pagination Warning] Page ${pageNum} fetch failed: ${pageErr.message}`);
        break; // Stop fetching on error
      }
    }

    console.log(`[LinkedIn Parser] Total Extracted ${rawList.length} thread objects.`);

    for (let i = 0; i < rawList.length; i++) {
      const convElem = rawList[i];
      
      // Robust Timestamp Parsing
      const rawTs = convElem.lastActivityAt || convElem.lastModifiedAt || convElem.createdAt || convElem.lastActivityTimestamp || convElem.updatedAt;
      let convDate = rawTs ? new Date(typeof rawTs === 'number' && rawTs < 1e11 ? rawTs * 1000 : rawTs) : new Date();
      if (isNaN(convDate.getTime())) convDate = new Date();

      const threadUrn = convElem.backendUrn || convElem.entityUrn || convElem.urn || `urn:li:fs_conversation:${Date.now()}_${i}`;

      console.log(`  Thread #${i + 1}: URN="${threadUrn}", ActivityDate="${convDate.toISOString()}"`);

      // Extract prospect details from GraphQL/REST participants
      const participants = convElem.conversationParticipants || convElem.participants || convElem.members || [];
      
      // Find prospect participant (participant that is not distance 'SELF' or not account owner)
      const prospectData = participants.find(p => {
        const pObj = typeof p === 'string' ? includedMap.get(p) || {} : p;
        const member = pObj.participantType?.member || pObj.miniProfile || pObj.person || pObj.messagingMember?.miniProfile || pObj;
        const distance = member.distance;
        const firstName = member.firstName?.text || member.firstName || '';
        return distance !== 'SELF' && firstName && !accountDoc.name.toLowerCase().includes(firstName.toLowerCase());
      }) || participants[0] || {};

      const resolvedPObj = typeof prospectData === 'string' ? includedMap.get(prospectData) || {} : prospectData;
      const member = resolvedPObj.participantType?.member || resolvedPObj.miniProfile || resolvedPObj.person || resolvedPObj.messagingMember?.miniProfile || resolvedPObj || {};
      
      const firstName = member.firstName?.text || member.firstName || 'LinkedIn';
      const lastName = member.lastName?.text || member.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const headline = member.headline?.text || member.headline || member.occupation || 'LinkedIn Professional';
      
      let avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
      if (member.profilePicture) {
        const rootUrl = member.profilePicture.rootUrl || member.profilePicture['com.linkedin.common.VectorImage']?.rootUrl || '';
        const segment = member.profilePicture.artifacts?.[0]?.fileIdentifyingUrlPathSegment || '';
        if (rootUrl && segment) {
          avatarUrl = rootUrl + segment;
        } else if (member.profilePicture.displayImage) {
          avatarUrl = member.profilePicture.displayImage;
        }
      }

      const profileUrl = member.profileUrl || (member.publicIdentifier ? `https://www.linkedin.com/in/${member.publicIdentifier}` : 'https://linkedin.com');

      const prospect = {
        name: fullName,
        headline,
        company: headline.includes('at ') ? headline.split('at ')[1] : headline.includes('@') ? headline.split('@')[1] : 'Enterprise',
        avatar: avatarUrl,
        profileUrl
      };

      console.log(`  -> Checking / Upserting Conversation in MongoDB for prospect: "${fullName}"`);

      // Check if we already have this conversation and it's up to date
      const existingConv = await Conversation.findOne({ threadUrn });
      const isUpToDate = existingConv && 
                         existingConv.lastMessageAt && 
                         Math.abs(new Date(existingConv.lastMessageAt).getTime() - convDate.getTime()) < 2000;

      // Upsert Conversation in MongoDB
      const conversationDoc = await Conversation.findOneAndUpdate(
        { threadUrn },
        {
          accountId: accountDoc._id,
          accountName: accountDoc.name,
          threadUrn,
          prospect,
          lastMessageAt: convDate,
          isUnread: Boolean(convElem.unreadCount > 0 || convElem.readState === 'UNREAD' || convElem.read === false),
          needsReply: existingConv ? existingConv.needsReply : true
        },
        { upsert: true, returnDocument: 'after', new: true }
      );

      syncedConversationsCount++;

      if (isUpToDate) {
        console.log(`  -> Thread "${threadUrn}" (${fullName}) is already up to date. Skipping message fetch.`);
        continue;
      }

      // Extract events / messages from conversation payload
      let events = convElem.messages?.elements || convElem.events?.elements || convElem.events || [];
      if (!Array.isArray(events) || events.length === 0) {
        if (Array.isArray(data.included)) {
          events = data.included.filter(item => {
            const isEvt = (item.$type && item.$type.includes('Event')) || (item.entityUrn && item.entityUrn.includes('fs_event'));
            return isEvt;
          });
        }
      }

      // Fetch thread messages via Voyager GraphQL endpoint (messengerMessages.5846eeb71c981f11e0134cb6626cc314)
      const graphQlUrn = convElem.entityUrn || convElem.backendUrn || convElem.urn;
      if (graphQlUrn) {
        const fetchedGraphqlMessages = await fetchMessagesForConversationUrn(graphQlUrn, headers);
        if (fetchedGraphqlMessages.length > 0) {
          const existingUrns = new Set(events.map(e => e.backendUrn || e.entityUrn || e.urn));
          for (const gMsg of fetchedGraphqlMessages) {
            const gUrn = gMsg.backendUrn || gMsg.entityUrn || gMsg.urn;
            if (!gUrn || !existingUrns.has(gUrn)) {
              events.push(gMsg);
            }
          }
        }
        // Small rate limit protection: 200ms delay between deep fetches
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`  -> Total ${events.length} message events for thread "${threadUrn}".`);

      for (const evt of events) {
        const evtRawTs = evt.deliveredAt || evt.createdAt || evt.timestamp;
        let evtDate = evtRawTs ? new Date(typeof evtRawTs === 'number' && evtRawTs < 1e11 ? evtRawTs * 1000 : evtRawTs) : new Date();
        if (isNaN(evtDate.getTime())) evtDate = new Date();

        const eventUrn = evt.backendUrn || evt.entityUrn || evt.urn || `urn:li:fs_event:${Date.now()}_${Math.random()}`;
        const messageBody = evt.body?.text || 
                            evt.eventContent?.attributedBody?.text || 
                            evt.eventContent?.messageEvent?.attributedBody?.text || 
                            evt.eventContent?.messageEvent?.customMessage || 
                            evt.messageText || 
                            evt.text || 
                            '';

        if (!messageBody || !messageBody.trim()) continue;

        const actorMember = evt.actor?.participantType?.member || evt.sender?.participantType?.member || evt.from?.messagingMember?.miniProfile || {};
        const distance = actorMember.distance || evt.actor?.distance || evt.sender?.distance;
        const senderFirstName = actorMember.firstName?.text || actorMember.firstName || '';
        const ownerFirstName = accountDoc.name.trim().split(' ')[0].toLowerCase();

        let isMe = false;
        if (distance === 'SELF') {
          isMe = true;
        } else if (distance && distance !== 'SELF') {
          isMe = false;
        } else if (senderFirstName) {
          isMe = senderFirstName.toLowerCase() === ownerFirstName;
        }

        const messageDoc = await Message.findOneAndUpdate(
          { eventUrn },
          {
            conversationId: conversationDoc._id,
            accountId: accountDoc._id,
            eventUrn,
            sender: isMe ? 'me' : 'prospect',
            senderName: isMe ? accountDoc.name : prospect.name,
            senderAvatar: isMe ? accountDoc.avatar : prospect.avatar,
            content: messageBody,
            channel: 'LinkedIn DM',
            timestamp: evtDate
          },
          { upsert: true, returnDocument: 'after', new: true }
        );

        syncedMessages.push(messageDoc);
      }

      // Compute and save lastFollowupAt & lastResponseAt for conversationDoc
      const allMsgs = await Message.find({ conversationId: conversationDoc._id }).sort({ timestamp: -1 }).lean();
      const lastFollowup = allMsgs.find(m => m.sender === 'me');
      const lastResponse = allMsgs.find(m => m.sender === 'prospect');

      if (lastFollowup || lastResponse) {
        if (lastFollowup) conversationDoc.lastFollowupAt = lastFollowup.timestamp;
        if (lastResponse) conversationDoc.lastResponseAt = lastResponse.timestamp;
        await conversationDoc.save();
      }
    }
  }

  // Update Account sync metadata
  accountDoc.lastSyncAt = new Date();
  accountDoc.syncedMessageCount = syncedMessages.length;
  await accountDoc.save();

  console.log(`[LinkedIn Sync Completed] Total Conversations Saved: ${syncedConversationsCount}, Total Messages Synced: ${syncedMessages.length}`);
  console.log(`==================================================\n`);

  return {
    account: accountDoc,
    conversationsCount: syncedConversationsCount,
    messagesSynced: syncedMessages.length,
    successfulEndpoint: successfulEndpointName || 'Fallback',
    timeRange: 'LinkedIn Inbox Sync'
  };
}

/**
 * Check if account cookies are valid by calling https://www.linkedin.com/mysettings-api/settingsApiMiniProfile
 * Updates account status to 'expired' if cookies are invalid or expired
 */
export async function checkLinkedinCookiesForAccount(accountDoc) {
  if (!accountDoc || !accountDoc.cookies || (Array.isArray(accountDoc.cookies) && accountDoc.cookies.length === 0)) {
    console.warn(`[Cookie Health Check Warning] Account "${accountDoc?.name}" has missing/empty cookies. Marking status as EXPIRED.`);
    accountDoc.status = 'expired';
    accountDoc.lastCookieCheckAt = new Date();
    await accountDoc.save();
    return false;
  }

  const { headers } = prepareLinkedinHeaders(accountDoc.cookies);

  try {
    console.log(`[Cookie Health Check] Checking cookie status for "${accountDoc.name}" via GET https://www.linkedin.com/mysettings-api/settingsApiMiniProfile...`);
    const res = await axios.get('https://www.linkedin.com/mysettings-api/settingsApiMiniProfile', {
      headers: {
        ...headers,
        'accept': 'application/json, text/plain, */*'
      },
      timeout: 10000
    });

    if (res.status === 200 && res.data) {
      console.log(`[Cookie Health Check Success] Account "${accountDoc.name}" returned 200 OK. Cookies are VALID.`);
      if (accountDoc.status === 'expired' || accountDoc.status === 'disconnected') {
        accountDoc.status = 'active';
      }
      accountDoc.lastCookieCheckAt = new Date();
      await accountDoc.save();
      return true;
    } else {
      console.warn(`[Cookie Health Check Failed] Account "${accountDoc.name}" returned status ${res.status}. Marking status as EXPIRED.`);
      accountDoc.status = 'expired';
      accountDoc.lastCookieCheckAt = new Date();
      await accountDoc.save();
      return false;
    }
  } catch (err) {
    const statusCode = err.response?.status || 'Error';
    console.warn(`[Cookie Health Check Failed] Account "${accountDoc.name}" check failed (${statusCode}: ${err.message}). Marking status as EXPIRED.`);
    accountDoc.status = 'expired';
    accountDoc.lastCookieCheckAt = new Date();
    await accountDoc.save();
    return false;
  }
}

/**
 * Helper to fetch LinkedIn user profile info (name, role/headline, avatar) using settingsApiMiniProfile API
 */
export async function fetchLinkedinProfileInfo(cookies) {
  if (!cookies || (Array.isArray(cookies) && cookies.length === 0)) {
    return null;
  }

  const { headers } = prepareLinkedinHeaders(cookies);

  try {
    const res = await axios.get('https://www.linkedin.com/mysettings-api/settingsApiMiniProfile', {
      headers: {
        ...headers,
        'accept': 'application/json, text/plain, */*'
      },
      timeout: 10000
    });

    if (res.status === 200 && res.data && res.data.data) {
      const data = res.data.data;
      const firstName = data.firstName || '';
      const lastName = data.lastName || '';
      const name = `${firstName} ${lastName}`.trim() || 'LinkedIn Member';
      const role = data.headline?.trim() || 'SDR';
      let avatar = null;

      if (data.picture && data.picture.rootUrl && Array.isArray(data.picture.artifacts) && data.picture.artifacts.length > 0) {
        const artifact = data.picture.artifacts.find(a => a.width === 200) || data.picture.artifacts[0];
        if (artifact && artifact.fileIdentifyingUrlPathSegment) {
          avatar = `${data.picture.rootUrl}${artifact.fileIdentifyingUrlPathSegment}`;
        }
      }

      return {
        name,
        role,
        avatar,
        url: data.url,
        raw: data
      };
    }
  } catch (err) {
    console.warn(`[LinkedIn Profile Info Fetch Failed]: ${err.message}`);
  }
  return null;
}



