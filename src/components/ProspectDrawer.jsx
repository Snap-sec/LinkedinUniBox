import React, { useState, useEffect } from 'react';
import { MessageSquare, List, Plus, X, Archive } from 'lucide-react';
import LinkedinIcon from './LinkedinIcon';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';

export default function ProspectDrawer({ conversation, onClose, onUpdateLeadStage, onToggleArchive }) {
  const { toast } = useToast();
  const [stages, setStages] = useState([
    'New Lead', 'Interested', 'Demo Scheduled',
    'Meeting Booked', 'Proposal Sent', 'Executive Network', 'Closed-Won', 'Not Interested'
  ]);

  // Lead Lists state
  const [allLists, setAllLists] = useState([]);
  const [leadLists, setLeadLists] = useState([]);
  const [showListPicker, setShowListPicker] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/settings/stages`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStages(data.map(s => s.name));
        }
      })
      .catch(err => console.error('Failed to fetch stages in ProspectDrawer', err));

    // Fetch all available lists
    fetch(`${API_BASE}/lists`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAllLists(data);
      })
      .catch(err => console.error('Failed to fetch lists', err));
  }, []);

  // Fetch lists this lead belongs to whenever conversation changes
  useEffect(() => {
    if (!conversation?.id) return;
    fetch(`${API_BASE}/leads/${conversation.id}/lists`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setLeadLists(data);
      })
      .catch(err => console.error('Failed to fetch lead lists', err));
  }, [conversation?.id]);

  if (!conversation) return null;
  const { prospect, accountId, accountName, accountAvatar, accountBadge } = conversation;

  const profileUrl = prospect?.profileUrl || prospect?.linkedinUrl || (prospect?.name ? `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(prospect.name)}` : 'https://www.linkedin.com');
  const inboxUrl = conversation?.threadUrn && conversation.threadUrn.includes('urn:li:')
    ? `https://www.linkedin.com/messaging/thread/${conversation.threadUrn}/`
    : 'https://www.linkedin.com/messaging/';

  const addToList = async (listId) => {
    try {
      await fetch(`${API_BASE}/lists/${listId}/leads/${conversation.id}`, { method: 'POST' });
      const list = allLists.find(l => l.id === listId);
      if (list && !leadLists.some(l => l.id === listId)) {
        setLeadLists(prev => [...prev, { id: list.id, _id: list.id, name: list.name, color: list.color }]);
      }
      setShowListPicker(false);
      toast.success(list ? `Added lead to list "${list.name}"` : 'Added lead to list');
    } catch (e) {
      console.error('Failed to add lead to list', e);
      toast.error('Failed to add lead to list');
    }
  };

  const removeFromList = async (listId) => {
    try {
      await fetch(`${API_BASE}/lists/${listId}/leads/${conversation.id}`, { method: 'DELETE' });
      setLeadLists(prev => prev.filter(l => l.id !== listId));
      toast.success('Removed lead from list');
    } catch (e) {
      console.error('Failed to remove lead from list', e);
      toast.error('Failed to remove lead from list');
    }
  };

  const availableToAdd = allLists.filter(l => !leadLists.some(ll => ll.id === l.id));

  return (
    <aside className="detail-drawer">
      {/* Profile */}
      <div className="drawer-sec">
        <div className="profile-card">
          <img className="profile-av" src={prospect.avatar} alt={prospect.name} />
          <div className="profile-name">{prospect.name}</div>
          <div className="profile-title">{prospect.headline}</div>
          <div className="profile-btns" style={{ display: 'flex', gap: 6, marginTop: 10, width: '100%' }}>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pill-btn"
              title="View LinkedIn Profile"
              style={{ height: 32, padding: 0 }}
            >
              <LinkedinIcon size={14} color="#0a66c2" />
            </a>
            <a
              href={inboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pill-btn"
              title="Open LinkedIn Inbox"
              style={{ height: 32, padding: 0 }}
            >
              <MessageSquare size={14} color="#525252" />
            </a>
            <button
              onClick={() => onToggleArchive && onToggleArchive(conversation.id)}
              className="pill-btn"
              title={conversation.isArchived ? 'Unarchive Lead (Move back to top)' : 'Archive Lead (Move to bottom of list)'}
              style={{
                height: 32, padding: 0,
                background: conversation.isArchived ? '#e5e5e5' : 'var(--gray-100)',
              }}
            >
              <Archive size={14} color={conversation.isArchived ? '#c2410c' : '#525252'} />
            </button>
          </div>
        </div>
      </div>

      {/* Sending As Account */}
      <div className="drawer-sec">
        <div className="drawer-label">Sending As</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F3F4F6' }}>
          <img src={accountAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'} alt={accountName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {accountName || 'LinkedIn Account'}
          </div>
        </div>
      </div>

      {/* Stage */}
      <div className="drawer-sec">
        <div className="drawer-label">Pipeline Stage</div>
        <select
          className="stage-select-drawer"
          value={conversation.leadStage}
          onChange={e => onUpdateLeadStage(conversation.id, e.target.value)}
        >
          {stages.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Lists */}
      <div className="drawer-sec">
        <div className="drawer-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Lists</span>
          <button
            onClick={() => setShowListPicker(!showListPicker)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 500, padding: 0,
            }}
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {/* Current lists */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {leadLists.length === 0 && !showListPicker && (
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Not in any list</span>
          )}
          {leadLists.map(list => (
            <span
              key={list.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 100,
                fontSize: 11, fontWeight: 500,
                background: `${list.color || '#3B82F6'}15`,
                color: list.color || '#3B82F6',
              }}
            >
              <List size={10} />
              {list.name}
              <button
                onClick={() => removeFromList(list.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: list.color || '#3B82F6', padding: 0,
                  display: 'flex', alignItems: 'center', lineHeight: 1, opacity: 0.6,
                }}
                title={`Remove from ${list.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        {/* List picker dropdown */}
        {showListPicker && (
          <div style={{
            marginTop: 8, background: '#fff', border: '1px solid #ECECEC',
            borderRadius: 8, maxHeight: 160, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}>
            {availableToAdd.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                {allLists.length === 0 ? 'No lists created yet' : 'Already in all lists'}
              </div>
            ) : (
              availableToAdd.map(list => (
                <button
                  key={list.id}
                  onClick={() => addToList(list.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#111827', textAlign: 'left',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: list.color || '#3B82F6', flexShrink: 0
                  }} />
                  {list.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
