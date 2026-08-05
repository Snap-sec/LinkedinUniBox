import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Link2, UserCheck, LayoutDashboard, LogOut, Settings, List } from 'lucide-react';
import LinkedinIcon from './LinkedinIcon';

export default function Sidebar({ unreadCount, activePage = 'chats' }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
        <LinkedinIcon size={18} color="#fff" />
      </div>

      {/* 1. Dashboard (Top Item) */}
      <button 
        className={`nav-btn ${activePage === 'dashboard' ? 'active' : ''}`} 
        title="Dashboard & Analytics"
        onClick={() => navigate('/dashboard')}
      >
        <LayoutDashboard size={18} />
      </button>

      {/* 2. Chats Inbox */}
      <button
        className={`nav-btn ${activePage === 'chats' ? 'active' : ''}`}
        title="Inbox"
        onClick={() => navigate('/chats')}
      >
        <MessageSquare size={18} />
        {unreadCount > 0 && <span className="badge" />}
      </button>

      {/* 3. Leads Pipeline */}
      <button
        className={`nav-btn ${activePage === 'leads' ? 'active' : ''}`}
        title="Leads Pipeline"
        onClick={() => navigate('/leads')}
      >
        <UserCheck size={18} />
      </button>

      {/* 4. Lead Lists */}
      <button
        className={`nav-btn ${activePage === 'lists' ? 'active' : ''}`}
        title="Lead Lists"
        onClick={() => navigate('/lists')}
      >
        <List size={18} />
      </button>

      {/* 5. Connected Accounts */}
      <button
        className={`nav-btn ${activePage === 'accounts' ? 'active' : ''}`}
        title="Connected Accounts"
        onClick={() => navigate('/accounts')}
      >
        <Link2 size={18} />
      </button>

      <div className="sidebar-bottom">
        <button
          className={`nav-btn ${activePage === 'settings' ? 'active' : ''}`}
          title="Settings"
          onClick={() => navigate('/settings')}
        >
          <Settings size={18} />
        </button>

        <button className="nav-btn" title="Sign Out" onClick={handleLogout}>
          <LogOut size={17} />
        </button>
        <img
          className="user-avatar"
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
          alt="Profile"
        />
      </div>
    </aside>
  );
}
