import React, { useState, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import {
  Search, ExternalLink, MessageSquare,
  ChevronDown, Calendar, Filter, X,
  ChevronLeft, ChevronRight, UserCheck, Inbox, ArrowLeft,
  ArrowUp, ArrowDown, Sparkles, Maximize2
} from 'lucide-react';
import { API_BASE } from '../config';

const LEAD_STAGES = [
  'New Lead', 'Interested', 'Demo Scheduled',
  'Meeting Booked', 'Proposal Sent', 'Closed-Won', 'Not Interested'
];

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#ECECEC',
  borderHover: '#D4D4D4',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
};

// ─── Stage Config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG = {
  'New Lead':       { bg: '#F0F7FF', color: '#1D5DB5' },
  'Interested':     { bg: '#FAF5FF', color: '#6D28D9' },
  'Demo Scheduled': { bg: '#EEF2FF', color: '#3730A3' },
  'Meeting Booked': { bg: '#F0FDF4', color: '#166534' },
  'Proposal Sent':  { bg: '#FFFBEB', color: '#92400E' },
  'Closed-Won':     { bg: '#F0FDF4', color: '#14532D' },
  'Not Interested': { bg: '#F9FAFB', color: '#6B7280' },
};

function getStageStyle(stage) {
  if (!stage) return { bg: '#F9FAFB', color: '#374151' };
  if (STAGE_CONFIG[stage]) return STAGE_CONFIG[stage];

  // Stable hashing of the custom stage name to generate pleasant pastel colors
  let hash = 0;
  for (let i = 0; i < stage.length; i++) {
    hash = stage.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return {
    bg: `hsl(${h}, 60%, 94%)`,
    color: `hsl(${h}, 60%, 25%)`
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 14, radius = 5 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
    }} />
  );
}

// ─── FilterSelect ─────────────────────────────────────────────────────────────
const FilterSelect = memo(function FilterSelect({ label, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: T.textMuted, userSelect: 'none' }}>{label}</span>
      <select
        value={value}
        onChange={onChange}
        style={{
          padding: '5px 10px', borderRadius: 6, border: `1px solid ${T.border}`,
          fontSize: 12, color: T.text, background: T.surface, cursor: 'pointer',
          outline: 'none', fontFamily: 'inherit',
        }}
      >
        {children}
      </select>
    </div>
  );
});

// ─── Table header cell with sorting ──────────────────────────────────────────
const TH = memo(function TH({ children, sortKey, sortBy, sortOrder, onSort, right = false }) {
  const isActive = sortBy === sortKey;
  return (
    <th
      onClick={() => sortKey && onSort(sortKey)}
      style={{
        padding: '11px 20px', textAlign: right ? 'right' : 'left',
        fontSize: 11, fontWeight: 600, color: isActive ? T.text : T.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        background: 'rgba(250, 250, 250, 0.95)',
        backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 10,
        borderBottom: `1px solid ${T.border}`,
        whiteSpace: 'nowrap', cursor: sortKey ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {sortKey && (
          <span style={{ display: 'inline-flex', color: isActive ? T.text : T.textMuted, opacity: isActive ? 1 : 0.4 }}>
            {isActive && sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          </span>
        )}
      </div>
    </th>
  );
});

// ─── Table data cell ──────────────────────────────────────────────────────────
const TD = memo(function TD({ children, right = false, isLast = false }) {
  return (
    <td style={{
      padding: '11px 20px', textAlign: right ? 'right' : 'left',
      borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
      fontSize: 13, color: T.textSecondary, verticalAlign: 'middle',
    }}>
      {children}
    </td>
  );
});

// ─── Memoized Table Row ───────────────────────────────────────────────────────
const LeadTableRow = memo(function LeadTableRow({
  lead, isLast, availableStages, updatingId, onStateChange, onNavigateChat, onOpenDrawer, formatDate, formatRelativeDate
}) {
  const s = getStageStyle(lead.state);

  return (
    <tr className="leads-tr" style={{ background: T.surface, transition: 'background 0.12s ease' }}>
      {/* Prospect */}
      <TD isLast={isLast}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => onOpenDrawer(lead.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            title="Click to view conversation in drawer"
          >
            <img
              src={lead.avatar}
              alt={lead.name}
              loading="lazy"
              decoding="async"
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.border}`, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap' }} className="lead-name-link">
              {lead.name}
            </span>
          </div>
          {lead.profileUrl && lead.profileUrl !== '#' && (
            <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <ExternalLink size={11} strokeWidth={2} />
            </a>
          )}
        </div>
      </TD>

      {/* Source */}
      <TD isLast={isLast}>
        <span style={{ fontSize: 12, color: T.textSecondary, whiteSpace: 'nowrap' }}>{lead.source}</span>
      </TD>

      {/* Stage */}
      <TD isLast={isLast}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <select
            value={lead.state}
            disabled={updatingId === lead.id}
            onChange={e => onStateChange(lead.id, e.target.value)}
            className="stage-select"
            style={{
              padding: '3px 22px 3px 8px', borderRadius: 100,
              fontSize: 11, fontWeight: 500,
              background: s.bg, color: s.color, border: 'none',
              cursor: 'pointer', appearance: 'none', outline: 'none',
              fontFamily: 'inherit',
              opacity: updatingId === lead.id ? 0.5 : 1,
            }}
          >
            {availableStages.map(st => (
              <option key={st} value={st} style={{ background: '#FFFFFF', color: '#111827' }}>
                {st}
              </option>
            ))}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: s.color }} />
        </div>
      </TD>

      {/* Buyer Intent */}
      <TD isLast={isLast}>
        {lead.buyingIntentScore !== null && lead.buyingIntentScore !== undefined ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 100,
            fontSize: 11.5,
            fontWeight: 600,
            background: lead.buyingIntentScore >= 70 ? '#F0FDF4' : lead.buyingIntentScore >= 40 ? '#FFFBEB' : '#F9FAFB',
            color: lead.buyingIntentScore >= 70 ? '#166534' : lead.buyingIntentScore >= 40 ? '#92400E' : '#4B5563',
            border: `1px solid ${lead.buyingIntentScore >= 70 ? '#BBF7D0' : lead.buyingIntentScore >= 40 ? '#FDE68A' : '#E5E7EB'}`,
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: lead.buyingIntentScore >= 70 ? '#22C55E' : lead.buyingIntentScore >= 40 ? '#F59E0B' : '#9CA3AF'
            }} />
            {lead.buyingIntentScore}%
          </div>
        ) : (
          <span style={{ fontSize: 12, color: T.textMuted }}>—</span>
        )}
      </TD>

      {/* Message count */}
      <TD isLast={isLast}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted }}>
          <MessageSquare size={12} strokeWidth={2} />
          <span style={{ fontSize: 12 }}>{lead.messageCount || 1}</span>
        </div>
      </TD>

      {/* Last Followup */}
      <TD isLast={isLast}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted }}>
          <Calendar size={12} strokeWidth={2} />
          <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatRelativeDate(lead.lastFollowupAt)}</span>
        </div>
      </TD>

      {/* Last Response */}
      <TD isLast={isLast}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted }}>
          <Calendar size={12} strokeWidth={2} />
          <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatRelativeDate(lead.lastResponseAt)}</span>
        </div>
      </TD>

      {/* Date */}
      <TD isLast={isLast}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted }}>
          <Calendar size={12} strokeWidth={2} />
          <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(lead.createdAt)}</span>
        </div>
      </TD>

      {/* Action */}
      <TD right isLast={isLast}>
        <button
          onClick={() => onOpenDrawer(lead.id)}
          className="ghost-btn"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', background: T.surface,
            border: `1px solid ${T.border}`, borderRadius: 6,
            fontSize: 12, fontWeight: 500, color: T.textSecondary,
            cursor: 'pointer', transition: 'background 0.15s ease',
          }}
        >
          <Inbox size={12} strokeWidth={2} /> Chat
        </button>
      </TD>
    </tr>
  );
});

// ─── Memoized Chat Slide-over Drawer ─────────────────────────────────────────
const LeadChatDrawer = memo(function LeadChatDrawer({ leadId, onClose, onStateChange, navigate, onOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [drawerConv, setDrawerConv] = useState(null);
  const [loadingDrawerConv, setLoadingDrawerConv] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setDrawerConv(null);
      onClose();
    }, 250);
    return () => clearTimeout(timer);
  }, [onClose]);

  useEffect(() => {
    if (leadId) {
      if (onOpen) onOpen();
      setShouldRender(true);
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      fetchDrawerConversation(leadId);
      return () => cancelAnimationFrame(timer);
    } else {
      setIsOpen(false);
      const timer = setTimeout(() => setShouldRender(false), 250);
      return () => clearTimeout(timer);
    }
  }, [leadId, onOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    if (shouldRender) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, handleClose]);

  const fetchDrawerConversation = async (id) => {
    setLoadingDrawerConv(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDrawerConv(data);
      }
    } catch (e) {
      console.error('Failed to fetch drawer conversation:', e);
    } finally {
      setLoadingDrawerConv(false);
    }
  };

  const handleDrawerSendMessage = async (text, attachments, aiDraftUsed) => {
    if (!leadId) return;
    try {
      const res = await fetch(`${API_BASE}/conversations/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, attachments, aiDraftUsed })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setDrawerConv(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), newMsg]
        } : prev);
      }
    } catch (e) {
      console.error('Failed to send message in drawer:', e);
    }
  };

  const handleDrawerAddNote = async (text) => {
    if (!leadId) return;
    try {
      const res = await fetch(`${API_BASE}/conversations/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, isInternal: true })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setDrawerConv(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), newMsg]
        } : prev);
      }
    } catch (e) {
      console.error('Failed to save note in drawer:', e);
    }
  };

  const handleDrawerUpdateStage = async (id, stage) => {
    if (onStateChange) await onStateChange(id, stage);
    setDrawerConv(prev => prev ? { ...prev, leadStage: stage } : prev);
  };

  const handleDrawerToggleStar = async (id) => {
    if (!drawerConv) return;
    const newStar = !drawerConv.isStarred;
    setDrawerConv(prev => prev ? { ...prev, isStarred: newStar } : prev);
    try {
      await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: newStar })
      });
    } catch (e) {
      console.error('Failed to update star in drawer:', e);
    }
  };

  if (!shouldRender && !leadId) return null;

  return createPortal(
    <div
      className={`chat-drawer-overlay ${isOpen ? 'open' : ''}`}
      onClick={handleClose}
    >
      <div
        className="chat-drawer-content"
        onClick={e => e.stopPropagation()}
      >
        {loadingDrawerConv || !drawerConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
            Loading conversation history...
          </div>
        ) : (
          <ChatWindow
            conversation={drawerConv}
            onSendMessage={handleDrawerSendMessage}
            onAddInternalNote={handleDrawerAddNote}
            onUpdateLeadStage={handleDrawerUpdateStage}
            onToggleStar={handleDrawerToggleStar}
            onOpenFullPage={() => navigate(`/chats/${leadId}`)}
            onCloseDrawer={handleClose}
          />
        )}
      </div>
    </div>,
    document.body
  );
});

export default function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listId = searchParams.get('listId') || '';
  const listName = searchParams.get('listName') || '';

  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('leads_filter_search') || '';
    } catch {
      return '';
    }
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSources, setSelectedSources] = useState(() => {
    try {
      const saved = localStorage.getItem('leads_filter_sources');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedStages, setSelectedStages] = useState(() => {
    try {
      const saved = localStorage.getItem('leads_filter_stages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedLists, setSelectedLists] = useState(() => {
    if (listId) return [listId];
    try {
      const saved = localStorage.getItem('leads_filter_lists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedMsgCounts, setSelectedMsgCounts] = useState(() => {
    try {
      const saved = localStorage.getItem('leads_filter_msg_counts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedLastFollowup, setSelectedLastFollowup] = useState(() => {
    try {
      const saved = localStorage.getItem('leads_filter_last_followup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedLastResponse, setSelectedLastResponse] = useState(() => {
    try {
      const saved = localStorage.getItem('leads_filter_last_response');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedBuyerIntent, setSelectedBuyerIntent] = useState(() => {
    try {
      const saved = localStorage.getItem('leads_filter_buyer_intent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_search', searchQuery);
    } catch (e) {
      console.warn('Failed to save search to localStorage', e);
    }
  }, [searchQuery]);

  // Drawer states
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState(null);

  // Derived: filter drawer can only be open when chat drawer is closed
  const filterDrawerVisible = isFilterDrawerOpen && !drawerLeadId;

  const handleCloseDrawer = useCallback(() => setDrawerLeadId(null), []);
  const handleOpenDrawer = useCallback((id) => {
    setIsFilterDrawerOpen(false);
    setDrawerLeadId(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_sources', JSON.stringify(selectedSources));
    } catch (e) {
      console.warn('Failed to save sources to localStorage', e);
    }
  }, [selectedSources]);

  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_stages', JSON.stringify(selectedStages));
    } catch (e) {
      console.warn('Failed to save stages to localStorage', e);
    }
  }, [selectedStages]);

  useEffect(() => {
    if (!listId) {
      try {
        localStorage.setItem('leads_filter_lists', JSON.stringify(selectedLists));
      } catch (e) {
        console.warn('Failed to save lists to localStorage', e);
      }
    }
  }, [selectedLists, listId]);

  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_msg_counts', JSON.stringify(selectedMsgCounts));
    } catch (e) {
      console.warn('Failed to save message counts to localStorage', e);
    }
  }, [selectedMsgCounts]);

  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_last_followup', JSON.stringify(selectedLastFollowup));
    } catch (e) {
      console.warn('Failed to save last followup to localStorage', e);
    }
  }, [selectedLastFollowup]);

  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_last_response', JSON.stringify(selectedLastResponse));
    } catch (e) {
      console.warn('Failed to save last response to localStorage', e);
    }
  }, [selectedLastResponse]);

  useEffect(() => {
    try {
      localStorage.setItem('leads_filter_buyer_intent', JSON.stringify(selectedBuyerIntent));
    } catch (e) {
      console.warn('Failed to save buyer intent to localStorage', e);
    }
  }, [selectedBuyerIntent]);

  // Sorting state
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [availableSources, setAvailableSources] = useState([]);
  const [availableLists, setAvailableLists] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);

  const [availableStages, setAvailableStages] = useState(LEAD_STAGES);

  useEffect(() => {
    fetchStages();
    fetchLists();
  }, []);

  useEffect(() => {
    if (listId) setSelectedLists([listId]);
  }, [listId]);

  const fetchStages = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/stages`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAvailableStages(data.map(s => s.name));
      }
    } catch (e) {
      console.error('Failed to fetch stages in LeadsPage', e);
    }
  };

  const fetchLists = async () => {
    try {
      const res = await fetch(`${API_BASE}/lists`);
      const data = await res.json();
      if (Array.isArray(data)) setAvailableLists(data);
    } catch (e) {
      console.error('Failed to fetch lists in LeadsPage', e);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => { fetchLeads(); }, [page, limit, debouncedSearch, selectedSources, selectedStages, selectedMsgCounts, selectedLastFollowup, selectedLastResponse, selectedBuyerIntent, selectedLists, sortBy, sortOrder]);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit, search: debouncedSearch,
        sortBy, sortOrder
      });
      if (selectedStages.length > 0) {
        params.append('stage', selectedStages.join(','));
      } else {
        params.append('stage', 'all');
      }
      if (selectedSources.length > 0) {
        params.append('source', selectedSources.join(','));
      } else {
        params.append('source', 'all');
      }
      if (selectedMsgCounts.length > 0) {
        params.append('msgCount', selectedMsgCounts.join(','));
      } else {
        params.append('msgCount', 'all');
      }
      if (selectedLastFollowup.length > 0) {
        params.append('lastFollowup', selectedLastFollowup.join(','));
      } else {
        params.append('lastFollowup', 'all');
      }
      if (selectedLastResponse.length > 0) {
        params.append('lastResponse', selectedLastResponse.join(','));
      } else {
        params.append('lastResponse', 'all');
      }
      if (selectedBuyerIntent.length > 0) {
        params.append('buyerIntent', selectedBuyerIntent.join(','));
      } else {
        params.append('buyerIntent', 'all');
      }
      const activeListId = selectedLists.length > 0 ? selectedLists.join(',') : (listId || 'all');
      if (activeListId !== 'all') {
        params.append('listId', activeListId);
      }
      const res = await fetch(`${API_BASE}/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.availableSources) setAvailableSources(data.availableSources);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleStateChange = async (leadId, newState) => {
    setUpdatingId(leadId);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/state`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });
      if (res.ok) setLeads(p => p.map(l => l.id === leadId ? { ...l, state: newState } : l));
    } catch (e) { console.error(e); }
    finally { setUpdatingId(null); }
  };

  const isAnyFilterActive =
    selectedSources.length > 0 ||
    selectedStages.length > 0 ||
    selectedMsgCounts.length > 0 ||
    selectedLastFollowup.length > 0 ||
    selectedLastResponse.length > 0 ||
    selectedBuyerIntent.length > 0 ||
    (selectedLists.length > 0 && !listId) ||
    searchQuery !== '';

  const resetFilters = () => {
    setSelectedSources([]);
    setSelectedStages([]);
    setSelectedMsgCounts([]);
    setSelectedLastFollowup([]);
    setSelectedLastResponse([]);
    setSelectedBuyerIntent([]);
    if (!listId) setSelectedLists([]);
    setSearchQuery('');
    setPage(1);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatRelativeDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return '—';
    const diffMs = Date.now() - dt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const activeListName = listName || (selectedLists.length === 1 ? (availableLists.find(l => l.id === selectedLists[0])?._id || '') : '');

  return (
    <div style={{ display: 'flex', background: T.bg, height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <Sidebar unreadCount={0} activePage={listId ? 'lists' : 'leads'} />

      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
        
        {/* ── Top Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            {listId && (
              <button
                onClick={() => navigate('/lists')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: T.textMuted, border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}
              >
                <ArrowLeft size={13} /> Back to Lead Lists
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.5px' }}>
                {activeListName ? activeListName : 'Leads Pipeline'}
              </h1>
              {activeListName && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: '#EFF6FF', color: '#1D4ED8' }}>
                  List View
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '4px 0 0 0' }}>
              {activeListName ? `Filtered leads belonging to ${activeListName}` : 'All prospects synced across your connected LinkedIn accounts.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: '6px 14px', borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, fontSize: 13, fontWeight: 600, color: T.text }}>
              {total} <span style={{ fontWeight: 400, color: T.textMuted }}>Total Leads</span>
            </div>
          </div>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
        <div style={{
          background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
          padding: '14px 20px', marginBottom: isAnyFilterActive ? 12 : 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <Search size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by lead name or company..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', border: 'none', outline: 'none',
                fontSize: 13, color: T.text, background: 'transparent',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => {
                setDrawerLeadId(null);
                setIsFilterDrawerOpen(true);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, background: isAnyFilterActive ? '#EFF6FF' : T.surface,
                border: `1px solid ${isAnyFilterActive ? '#BFDBFE' : T.border}`,
                fontSize: 13, fontWeight: 500, color: isAnyFilterActive ? '#1E40AF' : T.textSecondary,
                cursor: 'pointer', transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              <Filter size={14} style={{ color: isAnyFilterActive ? '#1D4ED8' : T.textSecondary }} />
              Filters
              {isAnyFilterActive && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: '#1D4ED8', color: '#fff', borderRadius: '50%',
                  width: 18, height: 18, fontSize: 10, fontWeight: 600
                }}>
                  {(selectedStages.length + selectedSources.length + selectedMsgCounts.length + selectedLastFollowup.length + selectedLastResponse.length + selectedBuyerIntent.length + (listId ? 0 : (selectedLists.length > 0 && selectedLists[0] !== 'all' ? selectedLists.length : 0)))}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Active Filters Chips ───────────────────────────────────────────── */}
        {isAnyFilterActive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>Active Filters:</span>
            {selectedStages.map(st => (
              <span key={st} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 100, background: '#EFF6FF',
                border: '1px solid #DBEAFE', color: '#1E40AF', fontSize: 11, fontWeight: 500
              }}>
                Stage: {st}
                <button
                  onClick={() => setSelectedStages(prev => prev.filter(s => s !== st))}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#1E40AF', display: 'flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {selectedSources.map(src => (
              <span key={src} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 100, background: '#F3F4F6',
                border: '1px solid #E5E7EB', color: '#374151', fontSize: 11, fontWeight: 500
              }}>
                Source: {src}
                <button
                  onClick={() => setSelectedSources(prev => prev.filter(s => s !== src))}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#374151', display: 'flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {selectedMsgCounts.map(mc => (
              <span key={mc} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 100, background: '#F5F3FF',
                border: '1px solid #EDE9FE', color: '#5B21B6', fontSize: 11, fontWeight: 500
              }}>
                Msgs: {mc === '1' ? '1 message' : mc === '2-5' ? '2 - 5' : mc === '6-10' ? '6 - 10' : mc === '10+' ? '10+' : mc}
                <button
                  onClick={() => setSelectedMsgCounts(prev => prev.filter(s => s !== mc))}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#5B21B6', display: 'flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {selectedLastFollowup.map(lf => {
              const label = lf === '1' ? '1 day' : lf === '2-3' ? '2-3 days' : lf === '4-6' ? '4-6 days' : lf === '7+' ? '7+ days' : lf === 'none' ? 'No followup' : lf;
              return (
                <span key={lf} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 100, background: '#FEF3C7',
                  border: '1px solid #FDE68A', color: '#92400E', fontSize: 11, fontWeight: 500
                }}>
                  Followup: {label}
                  <button
                    onClick={() => setSelectedLastFollowup(prev => prev.filter(s => s !== lf))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#92400E', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {selectedLastResponse.map(lr => {
              const label = lr === '1' ? '1 day' : lr === '2-3' ? '2-3 days' : lr === '4-6' ? '4-6 days' : lr === '7+' ? '7+ days' : lr === 'none' ? 'No response' : lr;
              return (
                <span key={lr} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 100, background: '#E0F2FE',
                  border: '1px solid #BAE6FD', color: '#075985', fontSize: 11, fontWeight: 500
                }}>
                  Response: {label}
                  <button
                    onClick={() => setSelectedLastResponse(prev => prev.filter(s => s !== lr))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#075985', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {selectedBuyerIntent.map(bi => {
              const label = bi === 'high' ? 'High' : bi === 'medium' ? 'Medium' : bi === 'low' ? 'Low' : bi === 'unknown' ? 'Unknown/Neutral' : bi;
              return (
                <span key={bi} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 100, background: '#D1FAE5',
                  border: '1px solid #A7F3D0', color: '#065F46', fontSize: 11, fontWeight: 500
                }}>
                  Intent: {label}
                  <button
                    onClick={() => setSelectedBuyerIntent(prev => prev.filter(s => s !== bi))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#065F46', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {!listId && selectedLists.map(lstId => {
              const lstObj = availableLists.find(l => l.id === lstId);
              if (!lstObj) return null;
              return (
                <span key={lstId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 100, background: '#FAF5FF',
                  border: '1px solid #F3E8FF', color: '#6B21A8', fontSize: 11, fontWeight: 500
                }}>
                  List: {lstObj.name}
                  <button
                    onClick={() => setSelectedLists(prev => prev.filter(l => l !== lstId))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#6B21A8', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            <button
              onClick={resetFilters}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, color: '#DC2626', padding: '3px 8px'
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Table Container ────────────────────────────────────────────────── */}
        <div style={{
          background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden'
        }}>
          {isLoading ? (
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Skeleton width={28} height={28} radius={100} />
                  <Skeleton width="22%" height={13} />
                  <Skeleton width="16%" height={13} />
                  <Skeleton width="14%" height={22} radius={100} />
                  <Skeleton width="12%" height={13} />
                  <Skeleton width="10%" height={13} />
                  <Skeleton width="8%" height={28} radius={6} />
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <UserCheck size={32} style={{ color: '#E5E7EB', marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 4 }}>No leads found</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginBottom: isAnyFilterActive ? 16 : 0 }}>
                {isAnyFilterActive ? 'Try adjusting your filters.' : 'Sync your LinkedIn inbox to see prospects here.'}
              </div>
              {isAnyFilterActive && (
                <button onClick={resetFilters} style={{ padding: '6px 14px', background: T.text, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH sortKey="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Prospect</TH>
                  <TH sortKey="source" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Source</TH>
                  <TH sortKey="state" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Stage</TH>
                  <TH sortKey="buyingIntentScore" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Buyer Intent</TH>
                  <TH sortKey="messageCount" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Messages</TH>
                  <TH sortKey="lastFollowupAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Last Followup</TH>
                  <TH sortKey="lastResponseAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Last Response</TH>
                  <TH sortKey="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>Added</TH>
                  <TH right>Action</TH>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <LeadTableRow
                    key={lead.id}
                    lead={lead}
                    isLast={idx === leads.length - 1}
                    availableStages={availableStages}
                    updatingId={updatingId}
                    onStateChange={handleStateChange}
                    onNavigateChat={() => navigate(`/chats/${lead.id}`)}
                    onOpenDrawer={handleOpenDrawer}
                    formatDate={formatDate}
                    formatRelativeDate={formatRelativeDate}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* ── Pagination Footer ────────────────────────────────────────── */}
          {!isLoading && total > 0 && (
            <div style={{
              padding: '12px 20px', background: '#FAFAFA',
              borderTop: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                Showing <strong style={{ color: T.text }}>{(page - 1) * limit + 1}</strong>–<strong style={{ color: T.text }}>{Math.min(page * limit, total)}</strong> of <strong style={{ color: T.text }}>{total}</strong> leads
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
                  Rows:
                  <select
                    value={limit}
                    onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                    style={{
                      padding: '3px 6px', borderRadius: 6, border: `1px solid ${T.border}`,
                      fontSize: 12, color: T.text, background: T.surface, cursor: 'pointer', outline: 'none'
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    style={{
                      padding: '5px 8px', borderRadius: 6, background: T.surface,
                      border: `1px solid ${T.border}`, cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: page <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span style={{ fontSize: 12, color: T.textSecondary, padding: '0 8px' }}>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    style={{
                      padding: '5px 8px', borderRadius: 6, background: T.surface,
                      border: `1px solid ${T.border}`, cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: page >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center'
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Drawer Backdrop Overlay ───────────────────────────────────────── */}
        {!drawerLeadId && (
          <div
            onClick={() => setIsFilterDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.2)',
              zIndex: 1000,
              opacity: filterDrawerVisible ? 1 : 0,
              visibility: filterDrawerVisible ? 'visible' : 'hidden',
              transition: 'opacity 0.22s ease-out, visibility 0.22s ease-out',
              willChange: 'opacity'
            }}
          />
        )}

        {/* ── Filter Drawer ─────────────────────────────────────────────────── */}
        {!drawerLeadId && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 360,
              background: '#FFFFFF',
              boxShadow: filterDrawerVisible ? '-8px 0 32px rgba(15, 23, 42, 0.08)' : 'none',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              transform: filterDrawerVisible ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          >

          {/* Drawer Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px', borderBottom: `1px solid ${T.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} style={{ color: T.text }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Filter Leads</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {isAnyFilterActive && (
                <button
                  onClick={resetFilters}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#DC2626', padding: 0 }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textSecondary, display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Drawer Body / Filter List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {/* 1. PIPELINE STAGES FILTER */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pipeline Stage
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {availableStages.map(stage => {
                  const isChecked = selectedStages.includes(stage);
                  return (
                    <label key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedStages(prev => prev.filter(s => s !== stage));
                          } else {
                            setSelectedStages(prev => [...prev, stage]);
                          }
                          setPage(1);
                        }}
                        style={{
                          width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                          cursor: 'pointer', accentColor: '#1D4ED8'
                        }}
                      />
                      <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{stage}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. LEAD SOURCES FILTER */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lead Source
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {availableSources.length === 0 ? (
                  <span style={{ fontSize: 13, color: T.textMuted }}>No sources found yet</span>
                ) : (
                  availableSources.map(source => {
                    const isChecked = selectedSources.includes(source);
                    return (
                      <label key={source} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedSources(prev => prev.filter(s => s !== source));
                            } else {
                              setSelectedSources(prev => [...prev, source]);
                            }
                            setPage(1);
                          }}
                          style={{
                            width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                            cursor: 'pointer', accentColor: '#1D4ED8'
                          }}
                        />
                        <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{source}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. MESSAGE COUNT FILTER */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Message Count
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { key: '1', label: '1 message' },
                  { key: '2-5', label: '2 - 5 messages' },
                  { key: '6-10', label: '6 - 10 messages' },
                  { key: '10+', label: '10+ messages' }
                ].map(opt => {
                  const isChecked = selectedMsgCounts.includes(opt.key);
                  return (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedMsgCounts(prev => prev.filter(s => s !== opt.key));
                          } else {
                            setSelectedMsgCounts(prev => [...prev, opt.key]);
                          }
                          setPage(1);
                        }}
                        style={{
                          width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                          cursor: 'pointer', accentColor: '#1D4ED8'
                        }}
                      />
                      <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3b. LAST FOLLOWUP FILTER */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last Followup
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { key: '1', label: '1 day ago' },
                  { key: '2-3', label: '2 - 3 days ago' },
                  { key: '4-6', label: '4 - 6 days ago' },
                  { key: '7+', label: '7+ days ago' },
                  { key: 'none', label: 'No followup yet' }
                ].map(opt => {
                  const isChecked = selectedLastFollowup.includes(opt.key);
                  return (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedLastFollowup(prev => prev.filter(s => s !== opt.key));
                          } else {
                            setSelectedLastFollowup(prev => [...prev, opt.key]);
                          }
                          setPage(1);
                        }}
                        style={{
                          width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                          cursor: 'pointer', accentColor: '#1D4ED8'
                        }}
                      />
                      <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3c. LAST RESPONSE FILTER */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last Response
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { key: '1', label: '1 day ago' },
                  { key: '2-3', label: '2 - 3 days ago' },
                  { key: '4-6', label: '4 - 6 days ago' },
                  { key: '7+', label: '7+ days ago' },
                  { key: 'none', label: 'No response yet' }
                ].map(opt => {
                  const isChecked = selectedLastResponse.includes(opt.key);
                  return (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedLastResponse(prev => prev.filter(s => s !== opt.key));
                          } else {
                            setSelectedLastResponse(prev => [...prev, opt.key]);
                          }
                          setPage(1);
                        }}
                        style={{
                          width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                          cursor: 'pointer', accentColor: '#1D4ED8'
                        }}
                      />
                      <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3d. BUYER INTENT FILTER */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Buyer Intent
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { key: 'high', label: 'High (≥ 70%)' },
                  { key: 'medium', label: 'Medium (40-69%)' },
                  { key: 'low', label: 'Low (< 40%)' },
                  { key: 'unknown', label: 'Unknown/Neutral' }
                ].map(opt => {
                  const isChecked = selectedBuyerIntent.includes(opt.key);
                  return (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedBuyerIntent(prev => prev.filter(s => s !== opt.key));
                          } else {
                            setSelectedBuyerIntent(prev => [...prev, opt.key]);
                          }
                          setPage(1);
                        }}
                        style={{
                          width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                          cursor: 'pointer', accentColor: '#1D4ED8'
                        }}
                      />
                      <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. LEAD LIST FILTER */}
            {!listId && availableLists.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lead List
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {availableLists.map(list => {
                    const isChecked = selectedLists.includes(list.id);
                    return (
                      <label key={list.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedLists(prev => prev.filter(l => l !== list.id));
                            } else {
                              setSelectedLists(prev => [...prev, list.id]);
                            }
                            setPage(1);
                          }}
                          style={{
                            width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`,
                            cursor: 'pointer', accentColor: '#1D4ED8'
                          }}
                        />
                        <span style={{ fontSize: 13.5, color: T.textSecondary, fontWeight: isChecked ? 500 : 400 }}>{list.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div style={{
            padding: '20px 24px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#FAFAFA'
          }}>
            <button
              onClick={() => setIsFilterDrawerOpen(false)}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, background: '#1D4ED8',
                color: '#FFFFFF', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                textAlign: 'center', boxShadow: '0 1px 2px rgba(29, 78, 216, 0.05)', fontFamily: 'inherit'
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
        )}

      {/* ── Chat Slide-over Drawer ────────────────────────────────────────── */}
      <LeadChatDrawer
        leadId={drawerLeadId}
        onClose={handleCloseDrawer}
        onOpen={() => setIsFilterDrawerOpen(false)}
        onStateChange={handleStateChange}
        navigate={navigate}
      />

      </main>
    </div>
  );
}
