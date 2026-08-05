import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  Trash2, Clock, CheckCircle2, AlertCircle,
  RefreshCw, Globe, Check, Plus, Shield,
  Download, Play, Puzzle
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

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

// ─── Table header cell ────────────────────────────────────────────────────────
const TH = ({ children, right = false }) => (
  <th style={{
    padding: '10px 24px', textAlign: right ? 'right' : 'left',
    fontSize: 11, fontWeight: 600, color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    background: '#FAFAFA', borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
);

const TD = ({ children, right = false, isLast = false }) => (
  <td style={{
    padding: '12px 24px', textAlign: right ? 'right' : 'left',
    borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
    verticalAlign: 'middle',
  }}>
    {children}
  </td>
);

// ─── Connection Status Badge ───────────────────────────────────────────────────
function ConnectionBadge({ status }) {
  const palette = {
    green:  { bg: '#F0FDF4', color: '#166534' },
    orange: { bg: '#FFFBEB', color: '#92400E' },
    red:    { bg: '#FFF1F2', color: '#9F1239' },
  };
  const p = palette[status.color] || palette.red;
  const Icon = status.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 100,
      fontSize: 11, fontWeight: 500,
      background: p.bg, color: p.color,
    }}>
      <Icon size={11} strokeWidth={2} />
      {status.label}
    </span>
  );
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [syncFrequency, setSyncFrequency] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchAccounts();
    fetchSettings();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts((data || []).filter(a => a.id !== 'acc_all'));
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const d = await res.json();
        if (d?.syncFrequencyMinutes !== undefined) setSyncFrequency(d.syncFrequencyMinutes);
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveSettings = async (val) => {
    setIsSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncFrequencyMinutes: parseFloat(val) }),
      });
      if (res.ok) {
        setSyncFrequency(parseFloat(val));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) { console.error(e); }
    finally { setIsSavingSettings(false); }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync/trigger`, { method: 'POST' });
      if (res.ok) await fetchAccounts();
    } catch (e) { console.error(e); }
    finally { setIsSyncing(false); }
  };

  const handleDeleteAccount = async (id, name) => {
    if (!window.confirm(`Remove "${name}"? All synced data will be permanently deleted.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchAccounts();
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  const getStatus = (lastSyncAt) => {
    if (!lastSyncAt) return { label: 'Disconnected', color: 'red', icon: AlertCircle };
    const mins = (Date.now() - new Date(lastSyncAt).getTime()) / 60000;
    const threshold = Math.max(3, syncFrequency * 3);
    if (mins <= threshold) return { label: 'Connected', color: 'green', icon: CheckCircle2 };
    if (mins <= threshold * 2) return { label: 'Syncing', color: 'orange', icon: RefreshCw };
    return { label: 'Disconnected', color: 'red', icon: AlertCircle };
  };

  const formatLastSync = (d) => {
    if (!d) return 'Never';
    const dt = new Date(d);
    if (isNaN(dt)) return 'Never';
    const mins = Math.floor((Date.now() - dt) / 60000);
    const hrs = Math.floor(mins / 60);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return dt.toLocaleDateString();
  };

  const syncLabel = syncFrequency >= 1
    ? `${syncFrequency} min${syncFrequency > 1 ? 's' : ''}`
    : `${syncFrequency * 60}s`;

  return (
    <div className="app" style={{ display: 'flex', background: T.bg, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .acc-tr:hover { background: #FAFAFA !important; }
        .ghost-btn:hover { background: #F3F4F6 !important; }
        .video-card-wrap:hover .play-btn-circle { transform: scale(1.08); background: #ffffff !important; }
      `}</style>
      <Sidebar unreadCount={0} activePage="accounts" />

      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', maxWidth: 960, margin: '0 auto', width: '100%' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.5px' }}>
              Connected Accounts
            </h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
              Manage LinkedIn sessions, sync frequency, and account health.
            </p>
          </div>

          <button
            onClick={() => navigate('/accounts/add')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: T.text, color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none',
              cursor: 'pointer', transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={15} strokeWidth={2} /> Connect Account
          </button>
        </div>

        {/* ── Chrome Extension Download & Guide Card ────────────────────────── */}
        <div style={{
          background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
          padding: '24px', marginBottom: 24,
          display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Puzzle size={18} color="#0071e3" strokeWidth={2} />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>
                LinkedIn Cookie Collector Extension
              </h2>
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#0071e3', background: '#F0F7FF',
                padding: '2px 8px', borderRadius: 100, border: '1px solid #BAE6FD'
              }}>
                Chrome Extension
              </span>
            </div>
            <p style={{ fontSize: 13, color: T.textSecondary, margin: '0 0 16px 0', lineHeight: 1.5, maxWidth: 500 }}>
              Install our Chrome extension on your team's browsers to automatically sync LinkedIn account cookies with one click into OneInbox.
            </p>

            <a
              href="/linkedin-extension.zip"
              download="linkedin-extension.zip"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', background: '#0071e3', color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                transition: 'background 0.15s ease', boxShadow: '0 2px 6px rgba(0,113,227,0.2)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#005bb5'}
              onMouseLeave={e => e.currentTarget.style.background = '#0071e3'}
            >
              <Download size={15} strokeWidth={2.2} />
              Download Extension (.zip)
            </a>
          </div>

          {/* Video Thumbnail */}
          <div style={{ flexShrink: 0, width: 240 }} className="video-card-wrap">
            <a
              href="https://www.youtube.com/watch?v=HIBwMWksrTg"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', position: 'relative', borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${T.border}`, textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <img
                src="https://img.youtube.com/vi/HIBwMWksrTg/hqdefault.jpg"
                alt="Extension Installation Video Guide"
                style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, transition: 'background 0.2s ease'
              }}>
                <div
                  className="play-btn-circle"
                  style={{
                    width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.95)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 2,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'transform 0.2s ease, background 0.2s ease'
                  }}
                >
                  <Play size={16} color="#0071e3" fill="#0071e3" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  How to Install (Video)
                </span>
              </div>
            </a>
          </div>
        </div>

        {/* ── Settings Card ─────────────────────────────────────────────────── */}
        <div style={{
          background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Shield size={16} color={T.textSecondary} strokeWidth={1.75} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>Sync Settings</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, color: T.textSecondary, whiteSpace: 'nowrap' }}>
                Sync every
              </label>
              <select
                value={syncFrequency}
                onChange={e => handleSaveSettings(e.target.value)}
                disabled={isSavingSettings}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.border}`,
                  fontSize: 13, color: T.text, background: T.surface, cursor: 'pointer',
                  outline: 'none', fontFamily: 'inherit',
                }}
              >
                <option value={0.5}>30 seconds</option>
                <option value={1}>1 minute</option>
                <option value={2}>2 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>

              {saveSuccess && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                  <Check size={13} strokeWidth={2.5} /> Saved
                </span>
              )}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Background cron active — polling every {syncLabel}
            </div>
          </div>
        </div>

        {/* ── Accounts Table ────────────────────────────────────────────────── */}
        <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="ghost-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', background: T.surface,
                border: `1px solid ${T.border}`, borderRadius: 7,
                fontSize: 12, fontWeight: 500, color: T.textSecondary,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                opacity: isSyncing ? 0.6 : 1,
                transition: 'background 0.15s ease',
              }}
            >
              <RefreshCw size={13} strokeWidth={2} style={{ animation: isSyncing ? 'spin 0.8s linear infinite' : 'none' }} />
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Skeleton width={32} height={32} radius={100} />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="30%" height={13} radius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width="20%" height={10} radius={4} />
                  </div>
                  <Skeleton width={80} height={22} radius={100} />
                  <Skeleton width={100} height={13} radius={4} />
                  <Skeleton width={90} height={28} radius={6} />
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <Globe size={32} style={{ color: '#E5E7EB', marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 4 }}>No accounts connected</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
                Connect a LinkedIn account using your browser cookies to start syncing.
              </div>
              <button
                onClick={() => navigate('/accounts/add')}
                style={{ padding: '7px 16px', background: T.text, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
              >
                Connect account
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Account</TH>
                  <TH>Status</TH>
                  <TH>Last Sync</TH>
                  <TH right>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, idx) => {
                  const status = getStatus(acc.lastSyncAt);
                  const isLast = idx === accounts.length - 1;
                  const accId = acc.id || acc._id;
                  return (
                    <tr key={accId} className="acc-tr" style={{ background: T.surface, transition: 'background 0.12s ease' }}>
                      {/* Account */}
                      <TD isLast={isLast}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img
                            src={acc.avatar}
                            alt={acc.name}
                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.border}`, flexShrink: 0 }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{acc.name}</div>
                            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                              {acc.email || acc.role || 'LinkedIn Account'}
                            </div>
                          </div>
                        </div>
                      </TD>

                      {/* Status */}
                      <TD isLast={isLast}>
                        <ConnectionBadge status={status} />
                      </TD>

                      {/* Last sync */}
                      <TD isLast={isLast}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted }}>
                          <Clock size={12} strokeWidth={2} />
                          <span style={{ fontSize: 12 }}>{formatLastSync(acc.lastSyncAt)}</span>
                        </div>
                      </TD>

                      {/* Remove */}
                      <TD right isLast={isLast}>
                        <button
                          onClick={() => handleDeleteAccount(accId, acc.name)}
                          disabled={deletingId === accId}
                          className="ghost-btn"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', background: T.surface,
                            border: `1px solid ${T.border}`, borderRadius: 6,
                            fontSize: 12, fontWeight: 500, color: '#DC2626',
                            cursor: deletingId === accId ? 'not-allowed' : 'pointer',
                            opacity: deletingId === accId ? 0.5 : 1,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <Trash2 size={12} strokeWidth={2} />
                          {deletingId === accId ? 'Removing…' : 'Remove'}
                        </button>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}
