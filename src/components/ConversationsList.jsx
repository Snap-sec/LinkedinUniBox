import React, { memo } from 'react';
import { Search, Edit } from 'lucide-react';

const ConvItem = memo(function ConvItem({ conv, isSelected, onSelect }) {
  return (
    <div
      className={`conv-item ${conv.isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}`}
      style={{ opacity: conv.isArchived ? 0.65 : 1 }}
      onClick={() => onSelect(conv.id)}
    >
      {conv.isUnread ? <div className="unread-dot" /> : <div style={{ width: 7 }} />}

      <div className="conv-avatar-wrap">
        <img className="conv-avatar" src={conv.prospect.avatar} alt={conv.prospect.name} loading="lazy" decoding="async" />
        <div className="conv-account-dot">
          <img src={conv.accountAvatar} alt={conv.accountName} loading="lazy" decoding="async" />
        </div>
      </div>

      <div className="conv-body">
        <div className="conv-row1">
          <span className="conv-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {conv.prospect.name}
            {conv.isArchived && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#F3F4F6', color: '#6B7280', fontWeight: 600 }}>
                Archived
              </span>
            )}
          </span>
          <span className="conv-time">{conv.timeAgo || conv.timestamp}</span>
        </div>
        <div className="conv-company">{conv.accountName || 'LinkedIn Account'}</div>
        <div className="conv-preview">{conv.lastMessage}</div>
      </div>
    </div>
  );
});

export default memo(function ConversationsList({
  conversations = [],
  selectedConvId,
  onSelectConversation,
  selectedAccountId,
  onSelectAccount,
  activeFilter,
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  accounts = []
}) {
  return (
    <div className="list-panel">
      <div className="list-header">
        <div className="list-title-row">
          <span className="list-title">Inbox</span>
          <div className="list-actions">
            <button className="icon-btn" title="Compose"><Edit size={16} /></button>
          </div>
        </div>

        {/* Account tabs */}
        <div className="account-tabs">
          {accounts.map(acc => (
            <button
              key={acc.id}
              className={`acct-tab ${selectedAccountId === acc.id ? 'active' : ''}`}
              onClick={() => onSelectAccount(acc.id)}
            >
              {acc.id !== 'acc_all' && <img src={acc.avatar} alt={acc.name} loading="lazy" />}
              {acc.id === 'acc_all' ? 'All' : acc.name.split(' ')[0]}
              {acc.unreadCount > 0 && acc.id !== 'acc_all' && (
                <span style={{ fontSize: 10, fontWeight: 700 }}>·{acc.unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div className="filter-pills">
        {['all', 'unread', 'starred', 'reply'].map(f => (
          <button
            key={f}
            className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : f === 'starred' ? 'Starred' : 'Needs Reply'}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="list-search">
        <Search size={13} color="#a3a3a3" />
        <input
          placeholder="Search conversations…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {/* Optimized List */}
      <div className="conv-list">
        {conversations.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#a3a3a3', fontSize: 12 }}>
            No conversations match your search/filter.
          </div>
        ) : (
          conversations.map(conv => (
            <ConvItem
              key={conv.id}
              conv={conv}
              isSelected={selectedConvId === conv.id}
              onSelect={onSelectConversation}
            />
          ))
        )}
      </div>
    </div>
  );
});
