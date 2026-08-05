import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  UserCheck, Users, MessageSquare, TrendingUp,
  ArrowUpRight, RefreshCw, ArrowRight, Inbox
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
  accent: '#111827',
  accentSoft: '#F3F4F6',
};

// ─── Stage Config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG = {
  'New Lead':        { bg: '#F0F7FF', color: '#1D5DB5', bar: '#3B82F6' },
  'Interested':      { bg: '#FAF5FF', color: '#6D28D9', bar: '#8B5CF6' },
  'Demo Scheduled':  { bg: '#EEF2FF', color: '#3730A3', bar: '#6366F1' },
  'Meeting Booked':  { bg: '#F0FDF4', color: '#166534', bar: '#22C55E' },
  'Proposal Sent':   { bg: '#FFFBEB', color: '#92400E', bar: '#F59E0B' },
  'Closed-Won':      { bg: '#F0FDF4', color: '#14532D', bar: '#16A34A' },
  'Not Interested':  { bg: '#F9FAFB', color: '#6B7280', bar: '#D1D5DB' },
};

function getStageStyle(stage) {
  if (!stage) return { bg: '#F9FAFB', color: '#374151', bar: '#9CA3AF' };
  if (STAGE_CONFIG[stage]) return STAGE_CONFIG[stage];

  // Stable hashing of the custom stage name to generate pleasant pastel colors
  let hash = 0;
  for (let i = 0; i < stage.length; i++) {
    hash = stage.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return {
    bg: `hsl(${h}, 60%, 94%)`,
    color: `hsl(${h}, 60%, 25%)`,
    bar: `hsl(${h}, 60%, 45%)`
  };
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
      ...style
    }} />
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, isLoading }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface,
        borderRadius: 12,
        padding: '20px 24px',
        border: `1px solid ${hovered ? T.borderHover : T.border}`,
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, lineHeight: 1.4 }}>
          {label}
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: T.accentSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.textSecondary, flexShrink: 0
        }}>
          <Icon size={16} strokeWidth={1.75} />
        </div>
      </div>
      {isLoading ? (
        <>
          <Skeleton width="60%" height={28} radius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="80%" height={12} radius={4} />
        </>
      ) : (
        <>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1, marginBottom: 6, letterSpacing: '-0.5px' }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
            {sub}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
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
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: T.textSecondary,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            padding: '4px 0',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.text}
          onMouseLeave={e => e.currentTarget.style.color = T.textSecondary}
        >
          {action} <ArrowRight size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ stage }) {
  const s = getStageStyle(stage);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.01em',
      background: s.bg,
      color: s.color,
    }}>
      {stage}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    fetchStats();

    // Auto-poll every 10 seconds to keep dashboard stats live/on the fly
    const interval = setInterval(() => {
      fetchStats(false, true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async (manual = false, quiet = false) => {
    if (manual) setIsRefreshing(true);
    else if (!quiet) setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatLastRefreshed = () => {
    if (!lastRefreshed) return null;
    return lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app" style={{ display: 'flex', background: T.bg, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .dash-tr:hover { background: #FAFAFA !important; }
        .ghost-btn:hover { background: #F3F4F6 !important; }
      `}</style>

      <Sidebar unreadCount={0} activePage="dashboard" />

      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Overview
            </h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
              Pipeline health, lead attribution and recent activity.
              {lastRefreshed && (
                <span style={{ marginLeft: 8, color: '#D1D5DB' }}>
                  · Last updated at {formatLastRefreshed()}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="ghost-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: T.textSecondary,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              opacity: isRefreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw
              size={13}
              strokeWidth={2}
              style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>

        {/* ── KPI Metrics ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          <MetricCard
            label="Total Prospects"
            value={stats?.totalLeads ?? 0}
            sub="Conversations synced via LinkedIn"
            icon={UserCheck}
            isLoading={isLoading}
          />
          <MetricCard
            label="Connected Accounts"
            value={stats?.totalAccounts ?? 0}
            sub="LinkedIn accounts generating leads"
            icon={Users}
            isLoading={isLoading}
          />
          <MetricCard
            label="Total Messages"
            value={stats?.totalMessages ?? 0}
            sub="Direct messages exchanged"
            icon={MessageSquare}
            isLoading={isLoading}
          />
          <MetricCard
            label="Pipeline Engagement"
            value={`${stats?.conversionRate ?? 0}%`}
            sub="Prospects advancing past New Lead"
            icon={TrendingUp}
            isLoading={isLoading}
          />
        </div>

        {/* ── 2-column section: Leaderboard & Pipeline Distribution ────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

          {/* Left: Account Leaderboard */}
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '24px 28px' }}>
            <SectionHeader
              title="Lead Source Leaderboard"
              sub="Accounts generating the most prospects"
            />

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Skeleton width={28} height={28} radius={100} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="55%" height={13} radius={4} style={{ marginBottom: 6 }} />
                      <Skeleton width="35%" height={10} radius={4} />
                    </div>
                    <Skeleton width={40} height={20} radius={4} />
                  </div>
                ))}
              </div>
            ) : (stats?.accountLeaderboard || []).length === 0 ? (
              <EmptyLeaderboard />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.accountLeaderboard.map((acc, i) => (
                  <LeaderboardRow key={acc.accountName} acc={acc} rank={i} />
                ))}
              </div>
            )}
          </div>

          {/* Right: Pipeline Breakdown */}
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '24px 28px' }}>
            <SectionHeader
              title="Pipeline Distribution"
              sub="Where your leads are right now"
            />

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Skeleton width="40%" height={12} radius={4} />
                      <Skeleton width="15%" height={12} radius={4} />
                    </div>
                    <Skeleton width="100%" height={4} radius={2} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(stats?.pipelineStages || []).map(st => (
                  <PipelineRow key={st.stage} st={st} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Two Analytics Graphs: Buyer Intent & Last Follow-up ─────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
          
          {/* Graph 1: Buyer Intent */}
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '24px 28px' }}>
            <SectionHeader
              title="Buyer Intent Breakdown"
              sub="AI-detected buying intent across prospects"
            />

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Skeleton width="30%" height={12} radius={4} />
                      <Skeleton width="15%" height={12} radius={4} />
                    </div>
                    <Skeleton width="100%" height={4} radius={2} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(stats?.buyerIntentStats || []).map(item => {
                  let barColor = '#9CA3AF'; // default Unknown
                  if (item.label === 'High') barColor = '#10B981';
                  else if (item.label === 'Medium') barColor = '#3B82F6';
                  else if (item.label === 'Low') barColor = '#F59E0B';

                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                            background: barColor, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                            {item.label} Intent
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{item.count} leads</span>
                          <span style={{ fontSize: 11, color: '#D1D5DB', minWidth: 30, textAlign: 'right' }}>{item.percentage}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.percentage}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease', opacity: 0.85 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Graph 2: Last Follow-up */}
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '24px 28px' }}>
            <SectionHeader
              title="Last Follow-up Distribution"
              sub="Days elapsed since the last message touch"
            />

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Skeleton width="30%" height={12} radius={4} />
                      <Skeleton width="15%" height={12} radius={4} />
                    </div>
                    <Skeleton width="100%" height={4} radius={2} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(stats?.lastFollowupStats || []).map(item => {
                  const barColor = '#6366F1'; // Slate blue

                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                            background: barColor, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                            {item.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{item.count}</span>
                          <span style={{ fontSize: 11, color: '#D1D5DB', minWidth: 30, textAlign: 'right' }}>{item.percentage}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.percentage}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease', opacity: 0.85 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeaderboardRow({ acc, rank }) {
  const [hovered, setHovered] = useState(false);
  const isTop = rank === 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 8,
        background: hovered ? '#F9FAFB' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{
        minWidth: 22, height: 22, borderRadius: '50%',
        background: isTop ? '#111827' : '#F3F4F6',
        color: isTop ? '#fff' : '#9CA3AF',
        fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {rank + 1}
      </span>

      <img
        src={acc.avatar}
        alt={acc.accountName}
        style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ECECEC', flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {acc.accountName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ flex: 1, height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${acc.percentage}%`, background: isTop ? '#111827' : '#9CA3AF', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{acc.percentage}%</span>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{acc.leadCount}</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>leads</div>
      </div>
    </div>
  );
}

function PipelineRow({ st }) {
  const s = getStageStyle(st.stage);
  const color = st.color || s.bar;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: color, flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{st.stage}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{st.count}</span>
          <span style={{ fontSize: 11, color: '#D1D5DB', minWidth: 30, textAlign: 'right' }}>{st.percentage}%</span>
        </div>
      </div>
      <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${st.percentage}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease', opacity: 0.85 }} />
      </div>
    </div>
  );
}

function EmptyLeaderboard() {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <Users size={28} style={{ color: '#E5E7EB', marginBottom: 10 }} />
      <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>No data yet</div>
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>Connect an account and sync to see attribution.</div>
    </div>
  );
}

function EmptyRecentLeads() {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <Inbox size={28} style={{ color: '#E5E7EB', marginBottom: 10 }} />
      <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>No prospects yet</div>
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>Sync your LinkedIn inbox to populate recent activity.</div>
    </div>
  );
}
