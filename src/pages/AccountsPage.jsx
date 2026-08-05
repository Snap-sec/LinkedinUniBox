import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  Trash2, Clock, CheckCircle2, AlertCircle,
  RefreshCw, Globe, Check, Plus, Shield,
  Download, Play, Puzzle, Key, X
} from 'lucide-react';
import { API_BASE } from '../config';

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

  const [isCheckingCookies, setIsCheckingCookies] = useState(false);

  // Update Cookie Modal state
  const [cookieModalAccount, setCookieModalAccount] = useState(null);
  const [cookieInputText, setCookieInputText] = useState('');
  const [isUpdatingCookies, setIsUpdatingCookies] = useState(false);
  const [cookieUpdateError, setCookieUpdateError] = useState('');
  const [cookieUpdateSuccess, setCookieUpdateSuccess] = useState('');

  // Disconnect Confirmation Modal state
  const [disconnectModalAccount, setDisconnectModalAccount] = useState(null);
  const [shouldDeleteLeads, setShouldDeleteLeads] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handlePromptDisconnect = (acc) => {
    setDisconnectModalAccount(acc);
    setShouldDeleteLeads(false);
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectModalAccount) return;
    const accId = disconnectModalAccount.id || disconnectModalAccount._id;
    setIsDisconnecting(true);
    setDeletingId(accId);

    try {
      const res = await fetch(`${API_BASE}/accounts/${accId}?deleteLeads=${shouldDeleteLeads}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchAccounts();
        setDisconnectModalAccount(null);
      }
    } catch (e) {
      console.error('Disconnect failed:', e);
    } finally {
      setIsDisconnecting(false);
      setDeletingId(null);
    }
  };

  const handleOpenCookieModal = (acc) => {
    setCookieModalAccount(acc);
    setCookieInputText('');
    setCookieUpdateError('');
    setCookieUpdateSuccess('');
  };

  const handleSubmitCookieUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!cookieModalAccount) return;

    if (!cookieInputText || !cookieInputText.trim()) {
      setCookieUpdateError('Please paste the cookie JSON payload.');
      return;
    }

    setIsUpdatingCookies(true);
    setCookieUpdateError('');
    setCookieUpdateSuccess('');

    try {
      const accId = cookieModalAccount.id || cookieModalAccount._id;
      const res = await fetch(`${API_BASE}/accounts/${accId}/cookies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookieInputText.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        setCookieUpdateError(data.error || 'Failed to update cookies.');
      } else {
        setCookieUpdateSuccess(data.message || 'Cookies updated and session verified successfully!');
        await fetchAccounts();
        setTimeout(() => {
          setCookieModalAccount(null);
          setCookieUpdateSuccess('');
        }, 1200);
      }
    } catch (err) {
      setCookieUpdateError('Failed to update cookies: ' + err.message);
    } finally {
      setIsUpdatingCookies(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchSettings();
    const interval = setInterval(fetchAccounts, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAccounts = async () => {
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

  const handleCheckCookies = async () => {
    setIsCheckingCookies(true);
    try {
      const res = await fetch(`${API_BASE}/accounts/check-cookies`, { method: 'POST' });
      if (res.ok) await fetchAccounts();
    } catch (e) { console.error(e); }
    finally { setIsCheckingCookies(false); }
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

  const getStatus = (acc) => {
    if (!acc) return { label: 'Disconnected', color: 'red', icon: AlertCircle };
    if (acc.status === 'expired') return { label: 'Account Expired', color: 'red', icon: AlertCircle };
    if (acc.status === 'disconnected') return { label: 'Disconnected', color: 'red', icon: AlertCircle };
    if (!acc.lastSyncAt) return { label: 'Disconnected', color: 'red', icon: AlertCircle };
    const mins = (Date.now() - new Date(acc.lastSyncAt).getTime()) / 60000;
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

  const syncLabel = syncFrequency >= 60
    ? `${syncFrequency / 60} hour${syncFrequency / 60 > 1 ? 's' : ''}`
    : syncFrequency >= 1
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
                <option value={360}>6 hours</option>
                <option value={720}>12 hours</option>
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

        {/* ── Expired Accounts Alert Box ─────────────────────────────────────── */}
        {accounts.some(a => a.status === 'expired') && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12,
            padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 2px 6px rgba(220,38,38,0.06)'
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={20} color="#DC2626" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 2 }}>
                LinkedIn Account Cookies Expired
              </div>
              <div style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.4 }}>
                One or more accounts have expired session cookies. Use our Chrome Extension or re-connect the account to restore background sync.
              </div>
            </div>
            <button
              onClick={() => navigate('/accounts/add')}
              style={{
                padding: '7px 14px', background: '#DC2626', color: '#fff',
                borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none',
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              Re-connect Account
            </button>
          </div>
        )}

        {/* ── Accounts Table ────────────────────────────────────────────────── */}
        <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 11, color: T.textMuted, background: '#F3F4F6', padding: '2px 8px', borderRadius: 100 }}>
                Automatic 1-min cookie check active
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleCheckCookies}
                disabled={isCheckingCookies}
                className="ghost-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', background: T.surface,
                  border: `1px solid ${T.border}`, borderRadius: 7,
                  fontSize: 12, fontWeight: 500, color: T.textSecondary,
                  cursor: isCheckingCookies ? 'not-allowed' : 'pointer',
                  opacity: isCheckingCookies ? 0.6 : 1,
                  transition: 'background 0.15s ease',
                }}
              >
                <RefreshCw size={13} strokeWidth={2} style={{ animation: isCheckingCookies ? 'spin 0.8s linear infinite' : 'none' }} />
                {isCheckingCookies ? 'Checking cookies…' : 'Check cookies'}
              </button>

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
                  const status = getStatus(acc);
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
                        <div>
                          <ConnectionBadge status={status} />
                          {acc.lastCookieCheckAt && (
                            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
                              Checked {formatLastSync(acc.lastCookieCheckAt)}
                            </div>
                          )}
                        </div>
                      </TD>

                      {/* Last sync */}
                      <TD isLast={isLast}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted }}>
                          <Clock size={12} strokeWidth={2} />
                          <span style={{ fontSize: 12 }}>{formatLastSync(acc.lastSyncAt)}</span>
                        </div>
                      </TD>

                      {/* Actions */}
                      <TD right isLast={isLast}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            onClick={() => handleOpenCookieModal(acc)}
                            className="ghost-btn"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '5px 10px', background: T.surface,
                              border: `1px solid ${T.border}`, borderRadius: 6,
                              fontSize: 12, fontWeight: 500, color: '#0071e3',
                              cursor: 'pointer', transition: 'background 0.15s ease',
                            }}
                          >
                            <Key size={12} strokeWidth={2} />
                            Update Cookies
                          </button>

                          <button
                            onClick={() => handlePromptDisconnect(acc)}
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
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Update Cookies Modal ────────────────────────────────────────────── */}
        {cookieModalAccount && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
            onClick={() => setCookieModalAccount(null)}
          >
            <div
              style={{
                background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`,
                width: '100%', maxWidth: 540, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden', animation: 'fadeIn 0.15s ease'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px', borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={cookieModalAccount.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.border}` }} />
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>
                      Update Cookies — {cookieModalAccount.name}
                    </h3>
                    <span style={{ fontSize: 11, color: T.textMuted }}>Paste updated session cookies to refresh authentication</span>
                  </div>
                </div>
                <button
                  onClick={() => setCookieModalAccount(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.textMuted }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmitCookieUpdate} style={{ padding: '24px' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    Raw Cookies JSON Payload
                  </label>
                  <textarea
                    rows={8}
                    value={cookieInputText}
                    onChange={e => { setCookieInputText(e.target.value); setCookieUpdateError(''); }}
                    placeholder='Paste JSON cookies array exported from browser extension (e.g. EditThisCookie or Cookie-Editor)...&#10;&#10;[{"name":"li_at","value":"AQED..."},{"name":"JSESSIONID","value":"ajax:..."}]'
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${cookieUpdateError ? '#ef4444' : T.border}`,
                      fontSize: 12, fontFamily: 'monospace', color: T.text, background: '#FAFAFA',
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {cookieUpdateError && (
                  <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 8, fontSize: 12, color: '#DC2626', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={15} flexShrink={0} />
                    <span>{cookieUpdateError}</span>
                  </div>
                )}

                {cookieUpdateSuccess && (
                  <div style={{ padding: '10px 14px', background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 8, fontSize: 12, color: '#166534', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={15} flexShrink={0} />
                    <span>{cookieUpdateSuccess}</span>
                  </div>
                )}

                {/* Modal Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCookieModalAccount(null)}
                    style={{
                      padding: '8px 16px', background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 8, fontSize: 13, fontWeight: 500, color: T.textSecondary, cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingCookies || !cookieInputText.trim()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', background: '#0071e3', color: '#fff',
                      borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none',
                      cursor: isUpdatingCookies || !cookieInputText.trim() ? 'not-allowed' : 'pointer',
                      opacity: isUpdatingCookies || !cookieInputText.trim() ? 0.6 : 1
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: isUpdatingCookies ? 'spin 0.8s linear infinite' : 'none' }} />
                    {isUpdatingCookies ? 'Verifying & Updating…' : 'Update & Verify Cookies'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Disconnect Confirmation Modal ────────────────────────────────────── */}
        {disconnectModalAccount && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
            onClick={() => setDisconnectModalAccount(null)}
          >
            <div
              style={{
                background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`,
                width: '100%', maxWidth: 480, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden', animation: 'fadeIn 0.15s ease'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#FEF2F2',
                    border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Trash2 size={18} color="#DC2626" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>
                      Disconnect Account
                    </h3>
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      Confirm removal of this connected account
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDisconnectModalAccount(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.textMuted }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px' }}>
                {/* Account Preview Card */}
                <div style={{
                  padding: '12px 14px', background: '#F9FAFB', border: `1px solid ${T.border}`,
                  borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20
                }}>
                  <img
                    src={disconnectModalAccount.avatar}
                    alt=""
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.border}` }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{disconnectModalAccount.name}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{disconnectModalAccount.email || disconnectModalAccount.role || 'LinkedIn Account'}</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>
                  Data Retention Option:
                </div>

                {/* Option 1: Keep leads */}
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                    borderRadius: 10, border: `1px solid ${!shouldDeleteLeads ? '#3b82f6' : T.border}`,
                    background: !shouldDeleteLeads ? '#EFF6FF' : T.surface, cursor: 'pointer',
                    marginBottom: 10, transition: 'all 0.15s ease'
                  }}
                  onClick={() => setShouldDeleteLeads(false)}
                >
                  <input
                    type="radio"
                    name="deleteLeadsOpt"
                    checked={!shouldDeleteLeads}
                    onChange={() => setShouldDeleteLeads(false)}
                    style={{ marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: !shouldDeleteLeads ? '#1D4ED8' : T.text }}>
                      Keep associated leads & chat history
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                      Recommended. Disconnects account session while retaining all synced prospects and conversations in database.
                    </div>
                  </div>
                </div>

                {/* Option 2: Delete leads */}
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                    borderRadius: 10, border: `1px solid ${shouldDeleteLeads ? '#ef4444' : T.border}`,
                    background: shouldDeleteLeads ? '#FEF2F2' : T.surface, cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setShouldDeleteLeads(true)}
                >
                  <input
                    type="radio"
                    name="deleteLeadsOpt"
                    checked={shouldDeleteLeads}
                    onChange={() => setShouldDeleteLeads(true)}
                    style={{ marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: shouldDeleteLeads ? '#DC2626' : T.text }}>
                      Delete all associated leads & messages
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                      Permanently delete all synced prospects, chat messages, and records linked to this account.
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px', background: '#FAFAFA', borderTop: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10
              }}>
                <button
                  type="button"
                  onClick={() => setDisconnectModalAccount(null)}
                  style={{
                    padding: '8px 16px', background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 500, color: T.textSecondary, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDisconnect}
                  disabled={isDisconnecting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px', background: '#DC2626', color: '#fff',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none',
                    cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                    opacity: isDisconnecting ? 0.6 : 1
                  }}
                >
                  <Trash2 size={13} />
                  {isDisconnecting ? 'Disconnecting…' : 'Disconnect Account'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
