import React, { useState } from 'react';
import { 
  Search, 
  RotateCw, 
  ChevronDown, 
  ShieldCheck, 
  HelpCircle, 
  Bell, 
  CheckCircle2, 
  AlertTriangle,
  Users
} from 'lucide-react';
import LinkedinIcon from './LinkedinIcon';

export default function Navbar({ 
  selectedAccountId, 
  onSelectAccount, 
  onOpenAccountModal, 
  onOpenShortcutsModal,
  searchQuery,
  onSearchChange,
  accounts = []
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const currentAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0] || { name: 'All Accounts', badgeText: 'Combined' };

  const handleSyncClick = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  return (
    <header className="top-navbar">
      {/* Brand & Logo */}
      <div className="navbar-brand-section">
        <div className="brand-logo">
          <div className="brand-icon-box">
            <LinkedinIcon size={18} color="#ffffff" />
          </div>
          <span>UnifyIn</span>
          <span className="brand-badge">Multi-Account</span>
        </div>
      </div>

      {/* Middle Global Search & Account Quick Switcher */}
      <div className="navbar-middle-section">
        {/* Account Selector Pill Dropdown */}
        <div style={{ position: 'relative' }}>
          <button 
            className="account-selector-btn"
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            title="Switch targeted LinkedIn account view"
          >
            {selectedAccountId === 'acc_all' ? (
              <div className="account-avatar-stack">
                {accounts.slice(1, 4).map((acc) => (
                  <img key={acc.id} src={acc.avatar} alt={acc.name} />
                ))}
              </div>
            ) : (
              <img 
                src={currentAccount.avatar} 
                alt={currentAccount.name} 
                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} 
              />
            )}
            <span>{currentAccount.name}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 2 }}>
              ({selectedAccountId === 'acc_all' ? `${Math.max(0, accounts.length - 1)} Accounts` : (currentAccount.role || 'Active')})
            </span>
            <ChevronDown size={14} style={{ color: '#64748b', marginLeft: 4 }} />
          </button>

          {showAccountDropdown && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: 280,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              zIndex: 50,
              padding: '6px'
            }}>
              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Select LinkedIn Inbox View
              </div>

              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => {
                    onSelectAccount(acc.id);
                    setShowAccountDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedAccountId === acc.id ? '#eff6ff' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img 
                      src={acc.avatar} 
                      alt={acc.name} 
                      style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: selectedAccountId === acc.id ? 600 : 500, color: '#0f172a' }}>
                        {acc.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {acc.role}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {acc.unreadCount > 0 && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: '9999px'
                      }}>
                        {acc.unreadCount}
                      </span>
                    )}
                    {acc.status === 'warning' ? (
                      <AlertTriangle size={14} style={{ color: '#d97706' }} />
                    ) : (
                      <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                    )}
                  </div>
                </div>
              ))}

              <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 6, paddingLeft: 6, paddingRight: 6 }}>
                <button 
                  onClick={() => {
                    setShowAccountDropdown(false);
                    onOpenAccountModal();
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#2563eb',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <ShieldCheck size={14} /> Manage Connected Accounts & Proxies
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Search Bar */}
        <div className="global-search-bar">
          <Search size={14} style={{ color: '#64748b' }} />
          <input 
            type="text"
            placeholder="Search prospects, companies, messages, or tags across all accounts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <span className="search-shortcut-badge">⌘K</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="navbar-right-section">
        {/* Sync Now Action */}
        <button 
          className="btn btn-secondary btn-sm"
          onClick={handleSyncClick}
          title="Force real-time proxy sync across all accounts"
        >
          <RotateCw size={13} className={isSyncing ? 'spin-animation' : ''} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>

        {/* Account Health Quick Trigger */}
        <button 
          className="btn-icon" 
          onClick={onOpenAccountModal}
          title="LinkedIn Accounts Health & Safety limits"
        >
          <Users size={16} />
        </button>

        {/* Shortcuts Trigger */}
        <button 
          className="btn-icon"
          onClick={onOpenShortcutsModal}
          title="Keyboard shortcuts guide"
        >
          <HelpCircle size={16} />
        </button>

        {/* Notifications */}
        <button className="btn-icon" title="System alerts">
          <Bell size={16} />
        </button>

        {/* User Account Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeft: '1px solid #e2e8f0' }}>
          <img 
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" 
            alt="Workspace Admin" 
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} 
          />
        </div>
      </div>
    </header>
  );
}
