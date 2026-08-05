import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Send, Paperclip, Smile, Clock, FileText, StickyNote, MessageSquare,
  PanelRightClose, PanelRightOpen, Sparkles, AlertCircle, Brain,
  Check, ArrowRight, Target, Zap, ShieldAlert, RefreshCw, Key,
  Copy, CornerDownLeft, Maximize2, X, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

const formatFullMsgDate = (ts) => {
  if (!ts) return '';
  if (ts === 'Just now') return 'Just now';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);

  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return `${day} ${month} - ${timeStr}`;
};

const MessageRow = memo(function MessageRow({ msg, prospectAvatar, accountAvatar, accountName }) {
  const sent = msg.sender === 'me';
  const internal = msg.sender === 'internal_note' || msg.isInternal;

  return (
    <div className={`msg-row ${internal ? 'internal' : sent ? 'sent' : 'received'}`}>
      {!sent && !internal && (
        <img className="msg-av" src={msg.senderAvatar || prospectAvatar} alt={msg.senderName} loading="lazy" decoding="async" />
      )}
      {sent && (
        <img className="msg-av" src={accountAvatar} alt={accountName} loading="lazy" decoding="async" />
      )}

      <div className="msg-bubble">
        {internal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>
            <StickyNote size={12} /> Internal Note
          </div>
        )}
        <div className="msg-meta">
          {!sent && <span className="msg-sender">{msg.senderName}</span>}
          <span>{formatFullMsgDate(msg.timestamp)}</span>
        </div>
        <div className="msg-text">{msg.content}</div>
      </div>
    </div>
  );
});

export default memo(function ChatWindow({
  conversation, onSendMessage, onAddInternalNote,
  onUpdateLeadStage, onOpenTemplatePicker,
  isDrawerOpen, onToggleDrawer, onToggleStar,
  onOpenFullPage, onCloseDrawer
}) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [mode, setMode] = useState('message');
  const [syncCrm, setSyncCrm] = useState(true);
  const [activeTab, setActiveTab] = useState('conversation');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState(null);
  const [usedMsgIdx, setUsedMsgIdx] = useState(null);
  const messagesEndRef = useRef(null);

  // AI Generation State
  const [aiData, setAiData] = useState(conversation?.aiAnalysis || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    setAiData(conversation?.aiAnalysis || null);
    setAiError(null);
  }, [conversation?.id, conversation?.aiAnalysis]);

  useEffect(() => {
    if (activeTab === 'conversation') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.id, conversation?.messages?.length, activeTab]);

  if (!conversation) {
    return (
      <div className="chat-panel empty-state">
        <MessageSquare size={32} />
        <h3>Select a conversation</h3>
        <p>Choose from your inbox on the left</p>
      </div>
    );
  }

  const { prospect, messages, accountName, accountAvatar } = conversation;
  const prospectFirstName = prospect?.name ? prospect.name.split(' ')[0] : 'prospect';

  const send = () => {
    if (!text.trim()) return;
    mode === 'note' ? onAddInternalNote(conversation.id, text) : onSendMessage(conversation.id, text, syncCrm);
    setText('');
  };

  const handleCopySuggestion = (suggestionText, idx) => {
    navigator.clipboard.writeText(suggestionText);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  const handleUseSuggestion = (suggestionText, idx) => {
    setText(suggestionText);
    setUsedMsgIdx(idx);
    setTimeout(() => setUsedMsgIdx(null), 1500);
    setActiveTab('conversation');
  };

  const handleGenerateAiAnalysis = async () => {
    setIsGenerating(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/conversations/${conversation.id}/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI analysis');
      }
      if (data.aiAnalysis) {
        setAiData(data.aiAnalysis);
      }
    } catch (err) {
      console.error('AI Analysis generation error:', err);
      setAiError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasValidAnalysis = Boolean(
    aiData &&
    (
      (aiData.painPointAnalysis && (aiData.painPointAnalysis.primaryChallenge || aiData.painPointAnalysis.operationalBottleneck || aiData.painPointAnalysis.decisionRequirement)) ||
      (aiData.conversationAnalysis && (aiData.conversationAnalysis.buyingIntentScore !== undefined || aiData.conversationAnalysis.strategicAssessment)) ||
      (aiData.nextMessages && aiData.nextMessages.length > 0)
    )
  );

  const displaySuggestedMessages = aiData?.nextMessages || [];

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <img className="prospect-avatar-lg" src={prospect.avatar} alt={prospect.name} loading="lazy" />
          <div className="prospect-info">
            <div className="prospect-name">
              {prospect.name}
              <span style={{ fontSize: 11, fontWeight: 400, color: '#a3a3a3', marginLeft: 6 }}>
                {prospect.connectionDegree}
              </span>
            </div>
            <div className="prospect-sub">{prospect.headline}</div>
          </div>
        </div>

        <div className="chat-header-right" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="icon-btn"
            title="Open Full Page Chat"
            onClick={() => {
              if (onOpenFullPage) onOpenFullPage();
              else navigate(`/chats/${conversation.id}`);
            }}
          >
            <Maximize2 size={16} />
          </button>

          {onToggleDrawer && (
            <button className="icon-btn" title="Toggle Info Panel" onClick={onToggleDrawer}>
              {isDrawerOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          )}

          {onCloseDrawer && (
            <button className="icon-btn" title="Close Drawer" onClick={onCloseDrawer}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Top Tab Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid #E5E7EB',
        background: '#FFFFFF',
        gap: '24px',
        flexShrink: 0
      }}>
        <button
          onClick={() => setActiveTab('conversation')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '11px 2px',
            fontSize: '13px',
            fontWeight: activeTab === 'conversation' ? 600 : 500,
            color: activeTab === 'conversation' ? '#0A66C2' : '#6B7280',
            border: 'none',
            borderBottom: activeTab === 'conversation' ? '2px solid #0A66C2' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
            marginBottom: '-1px'
          }}
        >
          <MessageSquare size={14} color={activeTab === 'conversation' ? '#0A66C2' : '#9CA3AF'} />
          Conversation
        </button>

        <button
          onClick={() => setActiveTab('ai_suggestion')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '11px 2px',
            fontSize: '13px',
            fontWeight: activeTab === 'ai_suggestion' ? 600 : 500,
            color: activeTab === 'ai_suggestion' ? '#0A66C2' : '#6B7280',
            border: 'none',
            borderBottom: activeTab === 'ai_suggestion' ? '2px solid #0A66C2' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
            marginBottom: '-1px'
          }}
        >
          <Sparkles size={14} color={activeTab === 'ai_suggestion' ? '#0A66C2' : '#9CA3AF'} />
          AI Suggestion
        </button>
      </div>

      {activeTab === 'conversation' ? (
        <>
          {/* Messages */}
          <div className="messages-area">
            <div className="date-sep">{prospect.connectedDate || 'Today'}</div>

            {messages.map(msg => (
              <MessageRow
                key={msg.id}
                msg={msg}
                prospectAvatar={prospect.avatar}
                accountAvatar={accountAvatar}
                accountName={accountName}
              />
            ))}
            <div ref={messagesEndRef} style={{ height: 1 }} />
          </div>

          {/* Composer */}
          <div className="composer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="composer-modes">
                <button className={`mode-btn ${mode === 'message' ? 'active' : ''}`} onClick={() => setMode('message')}>
                  Reply
                </button>
                <button className={`mode-btn note ${mode === 'note' ? 'active' : ''}`} onClick={() => setMode('note')}>
                  Note
                </button>
              </div>
              <button className="tmpl-btn" onClick={onOpenTemplatePicker}>
                <FileText size={12} /> Templates
              </button>
            </div>

            <div className={`composer-box ${mode === 'note' ? 'note-mode' : ''}`}>
              <textarea
                className="composer-textarea"
                placeholder={mode === 'note' ? 'Write an internal note…' : `Reply to ${prospectFirstName}…`}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}
              />
              <div className={`composer-footer ${mode === 'note' ? 'note-mode' : ''}`}>
                <div className="composer-tools">
                  <button className="tool-btn" title="Attach"><Paperclip size={14} /></button>
                  <button className="tool-btn" title="Emoji"><Smile size={14} /></button>
                  {mode === 'message' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#737373', cursor: 'pointer', marginLeft: 4 }}>
                      <input type="checkbox" checked={syncCrm} onChange={e => setSyncCrm(e.target.checked)} />
                      Sync to CRM
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="tool-btn" title="Schedule"><Clock size={14} /></button>
                  <button className={`send-btn ${mode === 'note' ? 'note' : ''}`} onClick={send}>
                    <Send size={13} />
                    {mode === 'note' ? 'Save Note' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── AI SUGGESTION TAB CONTENT ─────────────────────────────────────── */
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Error Banner if missing API key or fetch failed */}
          {aiError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#991B1B' }}>
                <AlertCircle size={16} />
                <span>{aiError}</span>
              </div>
              {aiError.includes('API key') && (
                <button
                  onClick={() => navigate('/settings')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: '#991B1B',
                    color: '#FFF',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Key size={12} /> Add Key in Settings
                </button>
              )}
            </div>
          )}

          {/* INITIAL STATE: Not generated yet */}
          {!hasValidAnalysis && !isGenerating ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justify: 'center',
              padding: '60px 24px',
              textAlign: 'center',
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #ECECEC',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                color: '#0A66C2',
                marginBottom: 16
              }}>
                <Sparkles size={26} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>
                Generate AI Prospect Analysis
              </h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '8px 0 24px 0', maxWidth: 440, lineHeight: 1.5 }}>
                DeepSeek AI will analyze the full conversation history with <strong>{prospect.name}</strong> to extract pain points, rate buying intent, and craft 5 contextual message suggestions.
              </p>
              <button
                onClick={handleGenerateAiAnalysis}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  borderRadius: 8,
                  background: '#0A66C2',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(10,102,194,0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Sparkles size={15} /> Generate AI Analysis
              </button>
            </div>
          ) : isGenerating ? (
            /* LOADING STATE */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justify: 'center',
              padding: '60px 24px',
              textAlign: 'center',
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #ECECEC'
            }}>
              <RefreshCw size={28} color="#0A66C2" style={{ animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>
                Generating AI Analysis...
              </h3>
              <p style={{ fontSize: 12.5, color: '#6B7280', margin: '6px 0 0 0' }}>
                Evaluating prospect pain points and crafting response options via DeepSeek AI.
              </p>
            </div>
          ) : (
            /* LOADED STATE: Display Live AI Analysis */
            <>
              {/* Sub-header with Regenerate Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                paddingBottom: 2
              }}>
                <div style={{ fontSize: 12.5, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="#0A66C2" />
                  <span>AI Prospect Insights for <strong>{prospect.name}</strong></span>
                </div>

                <button
                  onClick={handleGenerateAiAnalysis}
                  disabled={isGenerating}
                  className="btn-regenerate"
                >
                  <RefreshCw size={13} style={{ animation: isGenerating ? 'spin 0.8s linear infinite' : 'none' }} />
                  Regenerate Analysis
                </button>
              </div>

              {/* 1. TOP CARD: PAIN POINT ANALYSIS */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: '24px 28px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '-0.2px' }}>
                      Pain Point Discovery
                    </h3>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0 0' }}>
                      Extracted challenges and decision factors from conversation context.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  <div style={{ padding: '4px 0 4px 16px', borderLeft: '3px solid #DC2626' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      <Target size={13} /> Primary Challenge
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      {aiData.painPointAnalysis?.primaryChallenge || 'Not specified'}
                    </div>
                  </div>

                  <div style={{ padding: '4px 0 4px 16px', borderLeft: '3px solid #D97706' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      <Zap size={13} /> Operational Bottleneck
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      {aiData.painPointAnalysis?.operationalBottleneck || 'Not specified'}
                    </div>
                  </div>

                  <div style={{ padding: '4px 0 4px 16px', borderLeft: '3px solid #2563EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      <AlertCircle size={13} /> Decision Requirement
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      {aiData.painPointAnalysis?.decisionRequirement || 'Not specified'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. CARD 2: CONVERSATION ANALYSIS */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: '24px 28px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', flexShrink: 0 }}>
                      <Brain size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '-0.2px' }}>
                        Strategic Diagnostic
                      </h3>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0 0' }}>
                        AI assessment of buying signals and responsiveness.
                      </p>
                    </div>
                  </div>

                  {/* Intent Progress Track */}
                  {(() => {
                    const score = aiData.conversationAnalysis?.buyingIntentScore ?? 0;
                    const label = aiData.conversationAnalysis?.buyingIntentLabel || 'Neutral';
                    let intentColor = '#9CA3AF'; // Unknown
                    if (label === 'High') intentColor = '#10B981';
                    else if (label === 'Medium') intentColor = '#3B82F6';
                    else if (label === 'Low') intentColor = '#F59E0B';

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F9FAFB', border: '1px solid #ECECEC', borderRadius: 8, padding: '6px 12px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#4B5563' }}>Intent:</span>
                        <div style={{ width: 100, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${score}%`, height: '100%', background: intentColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: intentColor }}>{score}% ({label})</span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px 0' }}>Strategic Assessment</h4>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                      {aiData.conversationAnalysis?.strategicAssessment || 'No strategic assessment available.'}
                    </p>
                  </div>

                  {aiData.conversationAnalysis?.recommendedAction && (
                    <div style={{ background: '#F5F7FF', borderRadius: 8, padding: '16px 18px', border: '1px solid #E0E7FF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        <Zap size={14} /> Recommended Action
                      </div>
                      <div style={{ fontSize: 13, color: '#312E81', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <ArrowRight size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{aiData.conversationAnalysis.recommendedAction}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. CARD 3: NEXT MESSAGES */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: '24px 28px'
              }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A66C2', flexShrink: 0 }}>
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '-0.2px' }}>
                        Contextual Responses
                      </h3>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0 0' }}>
                        AI-crafted follow-ups optimized for conversion. Click to insert into composer.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {displaySuggestedMessages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      style={{
                        padding: '16px 20px',
                        borderRadius: 8,
                        border: '1px solid #E5E7EB',
                        background: '#FFFFFF',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#CBD5E1';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#E5E7EB';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', fontFamily: 'monospace' }}>
                            {(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#F3F4F6',
                            color: '#4B5563'
                          }}>
                            {msg.type}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {/* Copy to Clipboard */}
                          <button
                            onClick={() => handleCopySuggestion(msg.text, idx)}
                            title="Copy to clipboard"
                            className="icon-action-btn"
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              margin: 0,
                              borderRadius: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: copiedMsgIdx === idx ? '#F0FDF4' : '#FFFFFF',
                              color: copiedMsgIdx === idx ? '#166534' : '#4B5563',
                              border: copiedMsgIdx === idx ? '1px solid #86EFAC' : '1px solid #E5E7EB',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease'
                            }}
                          >
                            {copiedMsgIdx === idx ? <Check size={13} /> : <Copy size={13} />}
                          </button>

                          {/* Use Suggestion */}
                          <button
                            onClick={() => handleUseSuggestion(msg.text, idx)}
                            title="Insert into composer"
                            className="icon-action-btn"
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              margin: 0,
                              borderRadius: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: usedMsgIdx === idx ? '#F0FDF4' : '#F3F4F6',
                              color: usedMsgIdx === idx ? '#166534' : '#374151',
                              border: usedMsgIdx === idx ? '1px solid #86EFAC' : '1px solid #E5E7EB',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease'
                            }}
                          >
                            {usedMsgIdx === idx ? <Check size={13} /> : <CornerDownLeft size={13} />}
                          </button>
                        </div>
                      </div>

                      <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
});
