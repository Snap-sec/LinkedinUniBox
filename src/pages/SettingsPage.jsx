import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Plus, Trash2, Edit3, ArrowUp, ArrowDown, Check,
  Layers, AlertCircle, Sparkles, Key, Eye, EyeOff, Save, X, Bot, FileText
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://localhost:5000/api';

// ─── Design tokens matching DashboardPage ──────────────────────────────────────
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
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#16A34A', // Green
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#64748B', // Slate
];

// ─── Section Header matching DashboardPage ─────────────────────────────────────
function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.2px' }}>
          {title}
        </h2>
        {sub && (
          <p style={{ fontSize: 12, color: T.textMuted, margin: '3px 0 0 0', lineHeight: 1.5 }}>
            {sub}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: T.accent, color: '#FFFFFF', border: 'none',
            borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {action}
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('stages'); // 'stages' | 'ai'
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New Stage Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3B82F6');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [creatingStage, setCreatingStage] = useState(false);

  // Edit Stage State
  const [editingStageId, setEditingStageId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [editDesc, setEditDesc] = useState('');

  // AI Config State
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [aiPrompts, setAiPrompts] = useState([]);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const [notification, setNotification] = useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    fetchStages();
    fetchAiConfig();
  }, []);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings/stages`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStages(data);
      }
    } catch (e) {
      console.error('Failed to fetch stages', e);
      notify('Failed to load pipeline stages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/ai`);
      const data = await res.json();
      if (data) {
        setDeepseekApiKey(data.deepseekApiKey || '');
        if (Array.isArray(data.aiPrompts)) {
          setAiPrompts(data.aiPrompts);
        }
      }
    } catch (e) {
      console.error('Failed to fetch AI settings', e);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    setSavingKey(true);
    try {
      const res = await fetch(`${API_BASE}/settings/ai/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: deepseekApiKey })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('DeepSeek API Key saved successfully!');
      } else {
        toast.error(data.error || 'Failed to save API key');
      }
    } catch (e) {
      toast.error('Network error saving API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleSavePrompt = async (e) => {
    e.preventDefault();
    if (!editingPrompt) return;

    setSavingPrompt(true);
    try {
      const res = await fetch(`${API_BASE}/settings/ai/prompts/${editingPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingPrompt.title,
          description: editingPrompt.description,
          promptText: editingPrompt.promptText
        })
      });
      const data = await res.json();
      if (res.ok && data.aiPrompts) {
        setAiPrompts(data.aiPrompts);
        setEditingPrompt(null);
        toast.success(`Updated prompt "${editingPrompt.title}"`);
      } else {
        toast.error(data.error || 'Failed to save prompt');
      }
    } catch (e) {
      toast.error('Failed to save prompt modifications');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleCreateStage = async (e) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    setCreatingStage(true);
    try {
      const res = await fetch(`${API_BASE}/settings/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStageName.trim(),
          color: newStageColor,
          description: newStageDesc.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.stages) {
        setStages(data.stages);
        setNewStageName('');
        setNewStageDesc('');
        setNewStageColor('#3B82F6');
        setShowAddForm(false);
        toast.success(`Created pipeline stage "${newStageName}"`);
      } else {
        toast.error(data.error || 'Could not create stage');
      }
    } catch (e) {
      toast.error('Network error creating stage');
    } finally {
      setCreatingStage(false);
    }
  };

  const handleDeleteStage = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete stage "${name}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/settings/stages/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.stages) {
        setStages(data.stages);
        toast.success(`Deleted stage "${name}"`);
      } else {
        toast.error(data.error || 'Failed to delete stage');
      }
    } catch (e) {
      toast.error('Failed to delete stage');
    }
  };

  const startEditStage = (stage) => {
    setEditingStageId(stage.id || stage._id);
    setEditName(stage.name);
    setEditColor(stage.color || '#3B82F6');
    setEditDesc(stage.description || '');
  };

  const saveEditStage = async (id) => {
    if (!editName.trim()) return;

    const updated = stages.map(s => {
      if (s.id === id || s._id === id) {
        return { ...s, name: editName.trim(), color: editColor, description: editDesc.trim() };
      }
      return s;
    });

    try {
      const res = await fetch(`${API_BASE}/settings/stages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: updated })
      });
      const data = await res.json();
      if (res.ok && data.stages) {
        setStages(data.stages);
        setEditingStageId(null);
        toast.success('Stage updated successfully');
      }
    } catch (e) {
      toast.error('Failed to save changes');
    }
  };

  const moveStage = async (index, direction) => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= stages.length) return;

    const copy = [...stages];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;

    const reordered = copy.map((s, idx) => ({ ...s, order: idx + 1 }));
    setStages(reordered);

    try {
      await fetch(`${API_BASE}/settings/stages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: reordered })
      });
      toast.success('Pipeline order saved');
    } catch (e) {
      toast.error('Failed to reorder stages');
    }
  };

  return (
    <div style={{ display: 'flex', background: T.bg, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <Sidebar unreadCount={0} activePage="settings" />

      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        
        {/* ── Top Page Header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.5px' }}>
              System Settings
            </h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
              Manage pipeline stages, AI configurations, and integration prompts.
            </p>
          </div>

          {notification && (
            <div style={{
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: notification.type === 'error' ? '#FEF2F2' : '#F0FDF4',
              color: notification.type === 'error' ? '#991B1B' : '#166534',
              border: `1px solid ${notification.type === 'error' ? '#FCA5A5' : '#86EFAC'}`
            }}>
              {notification.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
              {notification.msg}
            </div>
          )}
        </div>

        {/* ── Navigation Tabs ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 32
        }}>
          <button
            onClick={() => setActiveTab('stages')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 4px',
              fontSize: 13,
              fontWeight: activeTab === 'stages' ? 600 : 500,
              color: activeTab === 'stages' ? T.text : T.textSecondary,
              border: 'none',
              borderBottom: activeTab === 'stages' ? `2px solid ${T.text}` : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: '-1px',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={15} color={activeTab === 'stages' ? T.text : T.textMuted} />
            Pipeline Stages
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 4px',
              fontSize: 13,
              fontWeight: activeTab === 'ai' ? 600 : 500,
              color: activeTab === 'ai' ? '#6366F1' : T.textSecondary,
              border: 'none',
              borderBottom: activeTab === 'ai' ? '2px solid #6366F1' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: '-1px',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={15} color={activeTab === 'ai' ? '#6366F1' : T.textMuted} />
            AI Config
          </button>
        </div>

        {/* ── TAB 1: PIPELINE STAGES ──────────────────────────────────────── */}
        {activeTab === 'stages' && (
          <div>
            <SectionHeader
              title="Custom Pipeline Stages"
              sub="Define deal progression stages used across the Leads Pipeline and Prospect drawer."
              action={
                <>
                  <Plus size={15} strokeWidth={2} />
                  New Stage
                </>
              }
              onAction={() => setShowAddForm(!showAddForm)}
            />

            {/* Inline Add Stage Card */}
            {showAddForm && (
              <form
                onSubmit={handleCreateStage}
                style={{
                  background: T.surface,
                  borderRadius: 12,
                  border: `1px solid ${T.borderHover}`,
                  padding: 24,
                  marginBottom: 24,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: '0 0 16px 0' }}>
                  Add New Pipeline Stage
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                      Stage Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Contract Review, Proposal Sent"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        fontSize: 13,
                        color: T.text,
                        outline: 'none',
                        background: T.surface,
                        fontFamily: 'inherit'
                      }}
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                      Badge Color
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={newStageColor}
                        onChange={(e) => setNewStageColor(e.target.value)}
                        style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PRESET_COLORS.map(c => (
                          <div
                            key={c}
                            onClick={() => setNewStageColor(c)}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: c,
                              cursor: 'pointer',
                              border: newStageColor === c ? `2px solid ${T.text}` : '1px solid transparent'
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
                    placeholder="e.g. Commercial proposal sent to decision maker"
                    value={newStageDesc}
                    onChange={(e) => setNewStageDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      outline: 'none',
                      background: T.surface,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      fontSize: 13,
                      fontWeight: 500,
                      color: T.textSecondary,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creatingStage || !newStageName.trim()}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: T.accent,
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      opacity: creatingStage ? 0.7 : 1
                    }}
                  >
                    {creatingStage ? 'Saving...' : 'Add Stage'}
                  </button>
                </div>
              </form>
            )}

            {/* Stages Card Container */}
            <div style={{
              background: T.surface,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              overflow: 'hidden'
            }}>
              {stages.length === 0 && !loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                  No stages defined. Click "New Stage" above to create one.
                </div>
              ) : (
                stages.map((stage, idx) => {
                  const isEditing = editingStageId === (stage.id || stage._id);
                  const stageId = stage.id || stage._id;

                  return (
                    <div
                      key={stageId}
                      style={{
                        padding: '16px 24px',
                        borderBottom: idx === stages.length - 1 ? 'none' : `1px solid ${T.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        background: isEditing ? T.accentSoft : T.surface,
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {isEditing ? (
                        <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', background: 'none' }}
                          />
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{
                              padding: '7px 12px',
                              border: `1px solid ${T.border}`,
                              borderRadius: 8,
                              fontSize: 13,
                              color: T.text,
                              width: 220,
                              outline: 'none',
                              background: T.surface,
                              fontFamily: 'inherit'
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Description"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '7px 12px',
                              border: `1px solid ${T.border}`,
                              borderRadius: 8,
                              fontSize: 13,
                              color: T.text,
                              outline: 'none',
                              background: T.surface,
                              fontFamily: 'inherit'
                            }}
                          />
                          <button
                            onClick={() => saveEditStage(stageId)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: 8,
                              background: '#166534',
                              color: '#fff',
                              border: 'none',
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Check size={14} /> Save
                          </button>
                          <button
                            onClick={() => setEditingStageId(null)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 8,
                              background: T.surface,
                              border: `1px solid ${T.border}`,
                              fontSize: 13,
                              color: T.textSecondary,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: stage.color || '#3B82F6',
                              flexShrink: 0
                            }} />

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                                  {stage.name}
                                </span>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  padding: '2px 8px',
                                  borderRadius: 100,
                                  background: `${stage.color || '#3B82F6'}15`,
                                  color: stage.color || '#3B82F6'
                                }}>
                                  Order #{idx + 1}
                                </span>
                              </div>
                              {stage.description && (
                                <p style={{ fontSize: 12, color: T.textMuted, margin: '3px 0 0 0' }}>
                                  {stage.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => moveStage(idx, 'up')}
                              disabled={idx === 0}
                              title="Move Up"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: T.surface,
                                border: `1px solid ${T.border}`,
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                color: T.textSecondary,
                                opacity: idx === 0 ? 0.3 : 1
                              }}
                            >
                              <ArrowUp size={13} strokeWidth={2} />
                            </button>

                            <button
                              onClick={() => moveStage(idx, 'down')}
                              disabled={idx === stages.length - 1}
                              title="Move Down"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: T.surface,
                                border: `1px solid ${T.border}`,
                                cursor: idx === stages.length - 1 ? 'not-allowed' : 'pointer',
                                color: T.textSecondary,
                                opacity: idx === stages.length - 1 ? 0.3 : 1
                              }}
                            >
                              <ArrowDown size={13} strokeWidth={2} />
                            </button>

                            <button
                              onClick={() => startEditStage(stage)}
                              title="Edit Stage"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: T.surface,
                                border: `1px solid ${T.border}`,
                                cursor: 'pointer',
                                color: T.textSecondary
                              }}
                            >
                              <Edit3 size={13} strokeWidth={2} />
                            </button>

                            <button
                              onClick={() => handleDeleteStage(stageId, stage.name)}
                              title="Delete Stage"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: T.surface,
                                border: `1px solid ${T.border}`,
                                cursor: 'pointer',
                                color: '#EF4444'
                              }}
                            >
                              <Trash2 size={13} strokeWidth={2} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: AI CONFIG ────────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div>
            {/* Top Card: DeepSeek API Key */}
            <div style={{
              background: T.surface,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              padding: '24px 28px',
              marginBottom: 32,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                  <Key size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>
                    DeepSeek API Key
                  </h3>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: '2px 0 0 0' }}>
                    Provide your DeepSeek API key to enable AI-powered message suggestions and automated lead insights.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveApiKey} style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', gap: 12, maxWidth: 640 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={deepseekApiKey}
                      onChange={(e) => setDeepseekApiKey(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 38px 10px 14px',
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        fontSize: 13,
                        color: T.text,
                        outline: 'none',
                        background: '#FAFAFA',
                        fontFamily: 'monospace',
                        letterSpacing: showApiKey ? 'normal' : '1px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: T.textMuted,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={showApiKey ? 'Hide Key' : 'Show Key'}
                    >
                      {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={savingKey}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#6366F1',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: savingKey ? 0.7 : 1,
                      transition: 'opacity 0.15s ease'
                    }}
                  >
                    <Save size={14} />
                    {savingKey ? 'Saving...' : 'Save Key'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: T.textMuted }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: deepseekApiKey ? '#10B981' : '#9CA3AF' }} />
                  {deepseekApiKey ? 'API Key Configured & Ready' : 'No API Key set'}
                </div>
              </form>
            </div>

            {/* Bottom Table: AI Prompts & Modifiers */}
            <div>
              <SectionHeader
                title="AI Prompt Templates"
                sub="Customize system prompts used by DeepSeek to generate targeted sales responses."
              />

              <div style={{
                background: T.surface,
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA', borderBottom: `1px solid ${T.border}` }}>
                      <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: T.textSecondary, width: '28%' }}>
                        Prompt Title
                      </th>
                      <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: T.textSecondary }}>
                        Description
                      </th>
                      <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: T.textSecondary, width: '120px', textAlign: 'right' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiPrompts.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                          No AI prompt templates found.
                        </td>
                      </tr>
                    ) : (
                      aiPrompts.map((prompt, idx) => (
                        <tr
                          key={prompt.id || idx}
                          style={{
                            borderBottom: idx === aiPrompts.length - 1 ? 'none' : `1px solid ${T.border}`,
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Bot size={15} color="#6366F1" />
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>
                                {prompt.title}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                            <p style={{ fontSize: 12.5, color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>
                              {prompt.description || 'No description provided.'}
                            </p>
                          </td>
                          <td style={{ padding: '16px 20px', verticalAlign: 'top', textAlign: 'right' }}>
                            <button
                              onClick={() => setEditingPrompt({ ...prompt })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 6,
                                background: '#EEF2FF',
                                color: '#4F46E5',
                                border: '1px solid #C7D2FE',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Edit3 size={13} />
                              Modify
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Prompt Modal / Overlay ─────────────────────────────────────── */}
        {editingPrompt && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 600,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: `1px solid ${T.border}`,
                background: '#FAFAFA'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="#6366F1" />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: 0 }}>
                    Modify AI Prompt Template
                  </h3>
                </div>
                <button
                  onClick={() => setEditingPrompt(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePrompt} style={{ padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>
                    Prompt Title *
                  </label>
                  <input
                    type="text"
                    value={editingPrompt.title}
                    onChange={e => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    required
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingPrompt.description}
                    onChange={e => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>
                    System Prompt Template *
                  </label>
                  <textarea
                    rows={5}
                    value={editingPrompt.promptText}
                    onChange={e => setEditingPrompt({ ...editingPrompt, promptText: e.target.value })}
                    placeholder="Enter the AI instruction prompt..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      outline: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical'
                    }}
                    required
                  />
                  <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4, display: 'block' }}>
                    Tip: Use double brackets like <code>{`{{prospectName}}`}</code> to inject dynamic variables into the prompt.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditingPrompt(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      fontSize: 13,
                      fontWeight: 500,
                      color: T.textSecondary,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingPrompt}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 18px',
                      borderRadius: 8,
                      background: '#6366F1',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: savingPrompt ? 0.7 : 1
                    }}
                  >
                    <Check size={14} />
                    {savingPrompt ? 'Saving...' : 'Save Modifications'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
