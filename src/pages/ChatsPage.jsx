import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ConversationsList from '../components/ConversationsList';
import ChatWindow from '../components/ChatWindow';
import ProspectDrawer from '../components/ProspectDrawer';
import AccountSelectorModal from '../components/AccountSelectorModal';
import TemplatePickerModal from '../components/TemplatePickerModal';
import { Plus, Inbox } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://localhost:5000/api';

export default function ChatsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([
    { id: 'acc_all', _id: 'acc_all', name: 'All Accounts', role: 'Combined Stream', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' }
  ]);
  const [convs, setConvs] = useState([]);
  const [selectedId, setSelectedId] = useState(id || null);
  const selectedIdRef = useRef(selectedId);

  // Sync ref with selectedId state
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Handle browser back/forward or manual URL edits updating state
  useEffect(() => {
    if (id && id !== selectedId) {
      setSelectedId(id);
    }
  }, [id]);

  const [accountId, setAccountId] = useState('acc_all');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showAcctModal, setShowAcctModal] = useState(false);
  const [showTmplModal, setShowTmplModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch connected accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // 2. Debounce search query input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Fetch conversations when accountId, filter, or debouncedSearch changes + automatic 10s polling
  useEffect(() => {
    fetchConversations(accountId, filter, debouncedSearch, false, true);
    const pollInterval = setInterval(() => {
      fetchConversations(accountId, filter, debouncedSearch, true, false);
    }, 10000);
    return () => clearInterval(pollInterval);
  }, [accountId, filter, debouncedSearch]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setAccounts(data);
        }
      }
    } catch (err) {
      console.warn('API Error fetching accounts:', err);
    }
  };

  const fetchConversations = async (accId = accountId, flt = filter, src = debouncedSearch, isSilent = false, isUserFilterChange = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (accId && accId !== 'acc_all') params.append('accountId', accId);
      if (flt && flt !== 'all') params.append('filter', flt);
      if (src && src.trim()) params.append('search', src.trim());

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/conversations${queryString}`);
      if (res.ok) {
        const data = await res.json();
        const loadedConvs = data.conversations || [];
        setConvs(loadedConvs);

        const activeSelectedId = selectedIdRef.current;

        if (loadedConvs.length > 0) {
          if (id) {
            setSelectedId(id);
          } else if (isUserFilterChange || !activeSelectedId) {
            setSelectedId(loadedConvs[0].id);
            navigate(`/chats/${loadedConvs[0].id}`, { replace: true });
          } else {
            const existsInNewList = loadedConvs.some(c => c.id === activeSelectedId);
            if (!existsInNewList && flt === 'all') {
              setSelectedId(loadedConvs[0].id);
              navigate(`/chats/${loadedConvs[0].id}`, { replace: true });
            }
          }
        }
      }
    } catch (err) {
      console.warn('API Error fetching conversations:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const active = convs.find(c => c.id === selectedId) || convs[0];
  const unread = convs.filter(c => c.isUnread).length;

  const select = id => {
    setSelectedId(id);
    navigate(`/chats/${id}`);
    setConvs(prev => prev.map(c => c.id === id ? { ...c, isUnread: false } : c));
    // Patch backend isUnread
    fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isUnread: false })
    }).catch(() => {});
  };

  const sendMessage = async (id, text) => {
    const acct = accounts.find(a => a.id === active?.accountId) || accounts[0];
    const newMsg = {
      id: `m_${Date.now()}`,
      sender: 'me',
      senderName: acct.name,
      senderAvatar: acct.avatar,
      timestamp: 'Just now',
      channel: 'LinkedIn DM',
      content: text
    };

    setConvs(prev => prev.map(c => c.id === id
      ? { ...c, lastMessage: text, timeAgo: 'Just now', needsReply: false, messages: [...c.messages, newMsg] }
      : c
    ));

    toast.success('Message sent');

    try {
      await fetch(`${API_BASE}/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, senderName: acct.name })
      });
    } catch (err) {
      console.error('Failed to post message to backend:', err);
      toast.error('Failed to deliver message');
    }
  };

  const addNote = async (id, text) => {
    const note = {
      id: `n_${Date.now()}`,
      sender: 'internal_note',
      senderName: 'Internal Note',
      timestamp: 'Just now',
      content: text,
      isInternal: true
    };

    setConvs(prev => prev.map(c => c.id === id
      ? { ...c, messages: [...c.messages, note] }
      : c
    ));

    toast.success('Internal note added');

    try {
      await fetch(`${API_BASE}/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, isInternal: true })
      });
    } catch (err) {
      console.error('Failed to save note:', err);
      toast.error('Failed to save note');
    }
  };

  const setStage = async (id, stage) => {
    setConvs(prev => prev.map(c => c.id === id ? { ...c, leadStage: stage } : c));
    toast.success(`Pipeline stage updated to "${stage}"`);

    try {
      await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadStage: stage })
      });
    } catch (err) {
      console.error('Failed to update stage:', err);
      toast.error('Failed to update pipeline stage');
    }
  };

  const toggleStar = async (id) => {
    const conv = convs.find(c => c.id === id);
    const newStar = !conv?.isStarred;

    setConvs(prev => prev.map(c => c.id === id ? { ...c, isStarred: newStar } : c));
    toast.success(newStar ? 'Conversation starred' : 'Conversation unstarred');

    try {
      await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: newStar })
      });
    } catch (err) {
      console.error('Failed to update star:', err);
      toast.error('Failed to update star');
    }
  };

  const toggleArchive = async (id) => {
    const targetConv = convs.find(c => c.id === id);
    if (!targetConv) return;
    const newArchived = !targetConv.isArchived;

    setConvs(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, isArchived: newArchived } : c);
      return [...updated].sort((a, b) => Boolean(a.isArchived) - Boolean(b.isArchived));
    });

    toast.success(newArchived ? 'Lead archived — moved to bottom of list' : 'Lead unarchived — restored to top');

    try {
      await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newArchived })
      });
    } catch (err) {
      console.error('Failed to update archived status:', err);
      toast.error('Failed to update archived status');
    }
  };

  const deleteAccount = async (accId) => {
    try {
      const res = await fetch(`${API_BASE}/accounts/${accId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (accountId === accId) {
          setAccountId('acc_all');
        }
        toast.success('Account disconnected successfully');
        await fetchAccounts();
        await fetchConversations(accountId === accId ? 'acc_all' : accountId, filter, debouncedSearch);
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
      toast.error('Failed to disconnect account');
    }
  };

  return (
    <div className="app">
      <Sidebar unreadCount={unread} activePage="chats" />

      <ConversationsList
        conversations={convs}
        selectedConvId={selectedId}
        onSelectConversation={select}
        selectedAccountId={accountId}
        onSelectAccount={setAccountId}
        activeFilter={filter}
        onFilterChange={setFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        accounts={accounts}
      />

      {convs.length > 0 && active ? (
        <>
          <ChatWindow
            conversation={active}
            onSendMessage={sendMessage}
            onAddInternalNote={addNote}
            onUpdateLeadStage={setStage}
            onOpenTemplatePicker={() => setShowTmplModal(true)}
            isDrawerOpen={drawerOpen}
            onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
            onToggleStar={toggleStar}
          />

          {drawerOpen && (
            <ProspectDrawer
              conversation={active}
              onClose={() => setDrawerOpen(false)}
              onUpdateLeadStage={setStage}
              onToggleArchive={toggleArchive}
            />
          )}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Inbox size={22} color="#737373" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#171717', marginBottom: 6 }}>No LinkedIn Messages Found</h3>
          <p style={{ fontSize: 13, color: '#737373', maxWidth: 360, textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>
            {searchQuery || filter !== 'all'
              ? 'No conversations match the current filter or search criteria.'
              : 'Connect a LinkedIn account using browser cookies to automatically fetch and sync all messages from the last 24 hours into MongoDB.'}
          </p>
          {(!searchQuery && filter === 'all') && (
            <button
              onClick={() => navigate('/accounts/add')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', background: '#0071e3', color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer'
              }}
            >
              <Plus size={15} /> Connect LinkedIn Account
            </button>
          )}
        </div>
      )}

      {showAcctModal && (
        <AccountSelectorModal
          accounts={accounts}
          selectedAccountId={accountId}
          onSelectAccount={setAccountId}
          onClose={() => setShowAcctModal(false)}
          onDeleteAccount={deleteAccount}
        />
      )}

      {showTmplModal && (
        <TemplatePickerModal
          onSelectTemplate={(text) => {
            if (active) sendMessage(active.id, text);
            setShowTmplModal(false);
          }}
          onClose={() => setShowTmplModal(false)}
        />
      )}
    </div>
  );
}
