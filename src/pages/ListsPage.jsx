import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  Plus, Trash2, Edit3, Check, X, Users, ChevronRight, List, AlertCircle
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://localhost:5000/api';

const T = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#ECECEC',
  borderHover: '#D4D4D4',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#111827',
  accentSoft: '#F3F4F6',
};

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B',
  '#16A34A', '#EF4444', '#06B6D4', '#6366F1', '#64748B',
];

export default function ListsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => { fetchLists(); }, []);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lists`);
      if (res.ok) {
        const data = await res.json();
        setLists(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch lists:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), color: newColor })
      });
      if (res.ok) {
        const created = await res.json();
        setLists(prev => [created, ...prev]);
        setNewName(''); setNewDesc(''); setNewColor('#3B82F6');
        setShowCreateForm(false);
        toast.success(`List "${created.name}" created`);
      }
    } catch (e) {
      toast.error('Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete list "${name}"? Leads won't be deleted, only removed from this list.`)) return;
    try {
      const res = await fetch(`${API_BASE}/lists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLists(prev => prev.filter(l => l.id !== id));
        toast.success(`Deleted list "${name}"`);
      }
    } catch (e) {
      toast.error('Failed to delete list');
    }
  };

  const startEdit = (list) => {
    setEditingId(list.id);
    setEditName(list.name);
    setEditDesc(list.description || '');
    setEditColor(list.color || '#3B82F6');
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/lists/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim(), color: editColor })
      });
      if (res.ok) {
        const updated = await res.json();
        setLists(prev => prev.map(l => l.id === editingId ? updated : l));
        setEditingId(null);
        toast.success(`List "${updated.name}" updated`);
      }
    } catch (e) {
      toast.error('Failed to update list');
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', background: T.bg, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <Sidebar unreadCount={0} activePage="lists" />

      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.5px' }}>
              Lead Lists
            </h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
              Organize your prospects into custom lists for targeted outreach and tracking.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {notification && (
              <div style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
                background: notification.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                color: notification.type === 'error' ? '#991B1B' : '#166534',
                border: `1px solid ${notification.type === 'error' ? '#FCA5A5' : '#86EFAC'}`
              }}>
                {notification.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
                {notification.msg}
              </div>
            )}

            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: T.accent, color: '#FFFFFF', border: 'none',
                borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={15} strokeWidth={2} />
              New List
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreate}
            style={{
              background: T.surface, borderRadius: 12,
              border: `1px solid ${T.borderHover}`, padding: 24,
              marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: '0 0 16px 0' }}>
              Create New List
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                  List Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CISO Prospects, Warm Leads Q3"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: `1px solid ${T.border}`, borderRadius: 8,
                    fontSize: 13, color: T.text, outline: 'none',
                    background: T.surface, fontFamily: 'inherit'
                  }}
                  autoFocus required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                  Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color" value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <div
                        key={c} onClick={() => setNewColor(c)}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', background: c,
                          cursor: 'pointer',
                          border: newColor === c ? `2px solid ${T.text}` : '1px solid transparent'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Chief information security officers in enterprise companies"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  fontSize: 13, color: T.text, outline: 'none',
                  background: T.surface, fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button" onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '8px 14px', borderRadius: 8, background: T.surface,
                  border: `1px solid ${T.border}`, fontSize: 13, fontWeight: 500,
                  color: T.textSecondary, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={creating || !newName.trim()}
                style={{
                  padding: '8px 16px', borderRadius: 8, background: T.accent,
                  color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', opacity: creating ? 0.7 : 1
                }}
              >
                {creating ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </form>
        )}

        {/* Lists Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
                padding: 24, height: 140,
                animation: 'shimmer 1.4s ease infinite',
                backgroundImage: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)',
                backgroundSize: '200% 100%',
              }} />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div style={{
            background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
            padding: '64px 32px', textAlign: 'center'
          }}>
            <List size={36} style={{ color: '#E5E7EB', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              No lists yet
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
              Create your first list to start organizing leads into groups.
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: T.accent, color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Create a List
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {lists.map(list => {
              const isEditing = editingId === list.id;

              return (
                <div
                  key={list.id}
                  style={{
                    background: T.surface, borderRadius: 12,
                    border: `1px solid ${T.border}`,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    cursor: isEditing ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!isEditing) { e.currentTarget.style.borderColor = T.borderHover; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                  onClick={() => { if (!isEditing) navigate(`/leads?listId=${list.id}&listName=${encodeURIComponent(list.name)}`); }}
                >
                  {/* Color bar */}
                  <div style={{ height: 4, background: list.color || '#3B82F6' }} />

                  <div style={{ padding: 20 }}>
                    {isEditing ? (
                      <div onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <input
                            type="color" value={editColor}
                            onChange={e => setEditColor(e.target.value)}
                            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', background: 'none' }}
                          />
                          <input
                            type="text" value={editName}
                            onChange={e => setEditName(e.target.value)}
                            style={{
                              flex: 1, padding: '7px 12px',
                              border: `1px solid ${T.border}`, borderRadius: 8,
                              fontSize: 13, color: T.text, outline: 'none',
                              background: T.surface, fontFamily: 'inherit'
                            }}
                          />
                        </div>
                        <input
                          type="text" value={editDesc} placeholder="Description"
                          onChange={e => setEditDesc(e.target.value)}
                          style={{
                            width: '100%', padding: '7px 12px', marginBottom: 10,
                            border: `1px solid ${T.border}`, borderRadius: 8,
                            fontSize: 13, color: T.text, outline: 'none',
                            background: T.surface, fontFamily: 'inherit'
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, background: T.surface,
                              border: `1px solid ${T.border}`, fontSize: 12, color: T.textSecondary, cursor: 'pointer'
                            }}
                          >Cancel</button>
                          <button
                            onClick={saveEdit}
                            style={{
                              padding: '5px 12px', borderRadius: 6, background: '#166534',
                              color: '#fff', border: 'none', fontSize: 12, fontWeight: 500,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4
                            }}
                          ><Check size={12} /> Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                              {list.name}
                            </div>
                            {list.description && (
                              <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>
                                {list.description}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => startEdit(list)}
                              title="Edit"
                              style={{
                                padding: '5px 6px', borderRadius: 6, background: T.surface,
                                border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textSecondary
                              }}
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(list.id, list.name)}
                              title="Delete"
                              style={{
                                padding: '5px 6px', borderRadius: 6, background: T.surface,
                                border: `1px solid ${T.border}`, cursor: 'pointer', color: '#EF4444'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          paddingTop: 12, borderTop: `1px solid ${T.border}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textSecondary, fontSize: 12 }}>
                            <Users size={13} strokeWidth={2} />
                            <span style={{ fontWeight: 500 }}>{list.leadCount}</span>
                            <span style={{ color: T.textMuted }}>lead{list.leadCount !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.textMuted, fontSize: 12 }}>
                            <span>{formatDate(list.createdAt)}</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style>{`
          @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        `}</style>
      </main>
    </div>
  );
}
