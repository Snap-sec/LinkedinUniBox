# 🚀 OneInbox — Feature Roadmap & Ideas

> Features that would turn OneInbox from a unified inbox into the **only LinkedIn sales tool your team ever needs**.

---

## 🔥 Tier 1 — High-Impact, Build Next

### 1. Reply Directly from OneInbox
**What:** Compose and send LinkedIn messages without ever leaving the dashboard.  
**Why:** Right now the tool is read-only. Letting SDRs reply inline (with the correct account session) turns OneInbox from a monitoring tool into a **full operating system** for LinkedIn sales.  
**How:** POST to LinkedIn's Voyager messaging API using stored session cookies. Add a composer UI below the conversation thread.

### 2. AI Auto-Reply Suggestions
**What:** When a prospect replies, use AI (DeepSeek/GPT) to generate 2-3 context-aware reply options based on the conversation history, prospect's headline/company, and your playbook tone.  
**Why:** SDRs spend 60% of their time crafting replies. Pre-generated suggestions cut response time from minutes to seconds.  
**How:** Feed the full conversation + prospect metadata to an LLM, return ranked reply drafts. One-click to send.

### 3. Sequences & Automated Follow-Ups
**What:** Define multi-step outreach sequences (e.g., Day 0: Connection request → Day 2: Intro message → Day 5: Follow-up → Day 10: Breakup message). Auto-send unless the prospect replies.  
**Why:** This is the #1 feature every sales team pays $200+/seat/month for on tools like Expandi, Dripify, and LinkedHelper.  
**How:** Create a `Sequence` model with steps, delays, and stop-conditions. A cron job checks which leads need the next touchpoint and fires messages via Voyager API.

### 4. Smart Reply Detection & "Needs Reply" Prioritization
**What:** Automatically detect when a prospect's last message is a question or requires a response (vs. a "thanks!" that doesn't). Surface these at the top of the inbox with a 🔴 badge.  
**Why:** In a 500+ lead inbox, the highest-revenue conversations get buried. Smart priority floats money to the top.  
**How:** Lightweight NLP classification on the last prospect message. Flag `needsReply: true` with confidence score.

### 5. LinkedIn Connection Request Automation
**What:** Send connection requests with custom notes from directly within OneInbox. Import a CSV of LinkedIn profile URLs, or use Sales Navigator search results.  
**Why:** Top-of-funnel automation. Before you can message anyone, you need to connect.  
**How:** POST to LinkedIn's connection request API. Add a "Prospect" pipeline stage before "New Lead." Rate-limit to 20-30/day per account to avoid LinkedIn jail.

---

## ⚡ Tier 2 — Competitive Edge Features

### 6. Unified Team Inbox with Assignments
**What:** Multiple team members can view the same leads. Assign conversations to specific SDRs. Add internal notes visible only to the team.  
**Why:** Right now each SDR operates in isolation. A shared inbox with assignments prevents double-outreach and enables managers to coach reps in real-time.  
**How:** Add `assignedTo` field on Conversation, user authentication with roles (admin/member), and an internal notes thread per lead.

### 7. LinkedIn Profile Enrichment Panel
**What:** When viewing a prospect, show a rich side-panel with: full work history, mutual connections, recent posts they've liked/commented on, company funding stage, tech stack, and employee count.  
**Why:** Context is everything in sales. Knowing the prospect posted about "scaling security" yesterday gives you the perfect opening.  
**How:** Scrape LinkedIn profile data via Voyager API on demand. Cache results. Optionally integrate with Clearbit, Apollo, or Hunter.io for email/phone enrichment.

### 8. Email Finder & Multi-Channel Outreach
**What:** Auto-find verified work emails for LinkedIn prospects. Allow SDRs to send a follow-up email if LinkedIn goes cold.  
**Why:** LinkedIn response rates average 15-25%. Adding email follow-up bumps total response rates to 40%+.  
**How:** Integrate Hunter.io, Snov.io, or Apollo API. Add email templates and a simple SMTP sender. Track opens/clicks.

### 9. CRM Integration (HubSpot, Pipedrive, Salesforce)
**What:** Two-way sync between OneInbox lead stages and your CRM's deal pipeline. When a lead moves to "Demo Scheduled" in OneInbox, it auto-creates a deal in HubSpot.  
**Why:** Sales teams already live in CRMs. If OneInbox doesn't sync, reps end up doing double data entry and abandon the tool.  
**How:** OAuth integration with CRM APIs. Map OneInbox stages → CRM deal stages. Webhook-based real-time sync.

### 10. Prospect Company News Alerts
**What:** Monitor prospects' companies for trigger events: funding rounds, new hires, product launches, acquisitions, leadership changes.  
**Why:** Trigger-based outreach has 3x higher response rates than cold outreach. "Congrats on the Series B!" opens doors.  
**How:** Use Google News API, Crunchbase, or LinkedIn company page scraping. Surface alerts as a notification feed in the dashboard.

---

## 🧠 Tier 3 — AI-Powered Intelligence

### 11. Buyer Intent Scoring with Conversation Signals
**What:** Expand the current AI analysis to score leads on a 0-100 scale based on: message sentiment, response speed, questions asked, objections raised, and engagement frequency.  
**Why:** "High intent" labels are useful but coarse. A numeric score lets you sort 500 leads and call the top 10 right now.  
**How:** Multi-signal scoring model. Weight factors like: asked about pricing (+30), mentioned timeline (+25), ghosted for 7 days (-20), responded within 1 hour (+15).

### 12. Conversation Playbook Templates
**What:** Pre-built message templates organized by scenario: cold outreach, follow-up, objection handling, meeting booking, breakup messages. One-click insert into the composer.  
**Why:** New SDRs ramp up 3x faster when they have proven scripts. Templates also ensure brand consistency across the team.  
**How:** Template CRUD with variable interpolation (`{{firstName}}`, `{{company}}`, `{{painPoint}}`). Track template performance (response rates per template).

### 13. AI Persona Analysis ("Who Am I Talking To?")
**What:** When a new prospect enters the inbox, auto-generate a brief psychological/sales profile: likely communication style (direct vs. analytical), probable pain points based on role/industry, recommended approach (technical deep-dive vs. ROI story).  
**Why:** An SDR selling to a CISO needs a completely different pitch than one selling to a VP of Sales. This gives you the cheat code.  
**How:** Feed prospect headline + company + industry into an LLM with a sales psychology prompt. Cache the result.

### 14. Auto-Tag & Auto-Stage Based on Message Content
**What:** Automatically move leads between stages based on conversation content. If a prospect says "let's schedule a call," auto-move to "Demo Scheduled." If they say "not interested," move to "Not Interested."  
**Why:** Manual stage management is the first thing reps stop doing. Automation keeps the pipeline accurate without effort.  
**How:** Keyword/intent detection on incoming messages. Configurable rules engine (if message contains X → move to stage Y).

### 15. Weekly Sales Intelligence Digest
**What:** Every Monday morning, email each SDR a summary: "You have 12 hot leads waiting for replies, 3 new connections from last week's outreach, your avg response time was 4.2 hours (team avg: 6.1 hours), and 2 prospects mentioned pricing."  
**Why:** Keeps reps accountable and highlights opportunities they might have missed. Managers get team-level visibility.  
**How:** Cron job that aggregates weekly stats per account/user. Send via email (Resend, SendGrid) or Slack webhook.

---

## 📊 Tier 4 — Analytics & Operations

### 16. Response Rate & Conversion Analytics
**What:** Dashboard showing: messages sent, response rate by template, average response time, conversion rate per stage, best-performing accounts, best day/time to message.  
**Why:** You can't improve what you don't measure. This turns OneInbox into a data-driven sales machine.  
**How:** Aggregate message and stage-change timestamps. Chart.js visualizations. Filterable by account, date range, stage.

### 17. A/B Testing for Outreach Messages
**What:** Create two versions of a message. Automatically split-send to different prospects. After N sends, show which version got higher response rates.  
**Why:** "Does the short message or the long one work better?" Stop guessing, start testing.  
**How:** Template variants with random assignment. Track response rates per variant. Statistical significance indicator.

### 18. LinkedIn Profile Viewer ("Who Viewed My Profile")
**What:** Show SDRs who has been viewing their LinkedIn profile — these are warm leads who are already curious.  
**Why:** Profile viewers have 5x higher response rates than cold prospects. It's the warmest lead signal LinkedIn gives you.  
**How:** Scrape LinkedIn's "Who Viewed Your Profile" page via Voyager API. Surface as a notification feed with one-click "Send Connection Request."

### 19. Slack / Teams Integration
**What:** Get real-time notifications in Slack when a hot lead replies, when a prospect goes cold (no reply in 48h), or when a new lead enters the pipeline.  
**Why:** SDRs live in Slack. Meeting them where they are reduces response time from hours to minutes.  
**How:** Slack Incoming Webhooks. Configurable notification rules (only notify for High Intent leads, only during business hours, etc.).

### 20. LinkedIn Post Engagement Tracker
**What:** Monitor when your prospects like, comment on, or share LinkedIn posts. Show this activity in their lead profile.  
**Why:** "I saw you commented on [topic] yesterday — I've been thinking about the same thing" is a killer conversation starter.  
**How:** LinkedIn activity feed scraping via Voyager API. Store engagement events per prospect. Surface in the prospect drawer.

---

## 🛡️ Tier 5 — Safety & Scale

### 21. Smart Rate Limiting & Anti-Detection
**What:** Built-in daily action limits per account (messages, connection requests, profile views). Randomized delays between actions. Weekend pause. Warm-up mode for new accounts.  
**Why:** LinkedIn bans accounts that automate aggressively. Smart throttling keeps accounts safe while maximizing output.  
**How:** Per-account daily counters with configurable limits. Jitter/randomization on action timing. Dashboard showing daily usage vs. safe limits.

### 22. Proxy Rotation per Account
**What:** Route each LinkedIn account's API requests through a dedicated residential proxy to avoid IP-based detection.  
**Why:** Running 5 accounts from one server IP is a red flag. Dedicated proxies per account mimic natural usage.  
**How:** Integrate with proxy providers (SmartProxy, Bright Data). Configure per-account proxy in the Account settings.

### 23. Account Warm-Up Mode
**What:** For newly added accounts, start with low activity (5 messages/day) and gradually increase over 2 weeks to full capacity (50-100/day).  
**Why:** LinkedIn's algorithms flag accounts that suddenly go from 0 to 100 messages/day. Gradual ramp-up looks natural.  
**How:** Progressive daily limit that increments automatically. Visual warm-up progress bar on the account card.

### 24. Data Export & Backup
**What:** One-click export of all leads, conversations, and analytics to CSV/Excel. Scheduled weekly backups to Google Drive or S3.  
**Why:** Sales data is business-critical. Teams need to export for reporting, migrate to CRMs, or back up against data loss.  
**How:** CSV generation endpoint. Optional S3/GDrive integration for scheduled backups.

---

## 💎 Wild Card — "Wow Factor" Features

### 25. LinkedIn Voice Message Support
**What:** Record and send voice messages to prospects directly from OneInbox.  
**Why:** LinkedIn voice messages have 2-3x higher response rates than text. Almost no one uses them, so they stand out massively.  
**How:** Browser audio recording API → upload to LinkedIn's media endpoint → attach to message via Voyager API.

### 26. Video Prospecting Integration
**What:** Record a 30-second personalized video (Loom-style) and embed it in a LinkedIn message.  
**Why:** Personalized video has the highest engagement rate of any outreach format. It's impossible to ignore.  
**How:** In-browser recording or Loom/Vidyard integration. Generate a thumbnail + link. Send via LinkedIn message.

### 27. "Ghost Detector" — Re-Engagement Campaigns
**What:** Automatically identify prospects who haven't replied in 7/14/30 days. Trigger a re-engagement sequence with a different angle.  
**Why:** 40% of deals are won on the 5th+ follow-up. Most reps give up after 2. This automates persistence.  
**How:** Query leads where `lastResponseAt < now() - 7 days` and `leadStage != 'Not Interested'`. Auto-enqueue into a re-engagement sequence.

### 28. Competitor Mention Alerts
**What:** When a prospect mentions a competitor's name in conversation, flag it and suggest counter-positioning talking points.  
**Why:** Knowing you're in a competitive deal early lets you preemptively address objections.  
**How:** Keyword detection on incoming messages against a configurable competitor list. AI-generated counter-positioning suggestions.

---

## Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Reply from OneInbox | 🔴 Critical | Medium | **P0** |
| AI Auto-Reply Suggestions | 🔴 Critical | Medium | **P0** |
| Sequences & Follow-Ups | 🔴 Critical | High | **P1** |
| Connection Request Automation | 🟠 High | Medium | **P1** |
| Smart Reply Detection | 🟠 High | Low | **P1** |
| Team Inbox & Assignments | 🟠 High | High | **P2** |
| Profile Enrichment Panel | 🟡 Medium | Medium | **P2** |
| CRM Integration | 🟡 Medium | High | **P2** |
| Response Rate Analytics | 🟡 Medium | Medium | **P2** |
| Auto-Tag & Auto-Stage | 🟡 Medium | Low | **P2** |
| Playbook Templates | 🟡 Medium | Low | **P2** |
| Slack Integration | 🟢 Nice-to-have | Low | **P3** |
| Data Export | 🟢 Nice-to-have | Low | **P3** |
| Rate Limiting & Safety | 🔴 Critical | Medium | **P1** |

---

*Built for the SDRs who are tired of switching between 5 tabs, 3 tools, and 2 spreadsheets to close a deal on LinkedIn.*
