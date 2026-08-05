import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Globe, Trash2 } from 'lucide-react';

export default function AccountSelectorModal({ isOpen, onClose, selectedAccountId, onSelectAccount, onDeleteAccount, accounts = [] }) {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState(null);

  if (!isOpen) return null;

  const displayAccounts = accounts.filter(a => a.id !== 'acc_all');

  const handleDelete = async (accId, accName) => {
    if (window.confirm(`Are you sure you want to remove account "${accName}"? This will delete all its synced messages.`)) {
      setDeletingId(accId);
      if (onDeleteAccount) {
        await onDeleteAccount(accId);
      }
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">LinkedIn Accounts ({displayAccounts.length})</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Globe size={13} style={{ color: '#16a34a' }} />
            Connected Accounts Sync Status: <strong>Active</strong>
          </div>

          {displayAccounts.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#737373', fontSize: 13 }}>
              No connected LinkedIn accounts yet.
            </div>
          ) : (
            displayAccounts.map(acc => (
              <div key={acc.id} className="acct-row">
                <div className="acct-row-left">
                  <img src={acc.avatar} alt={acc.name} />
                  <div>
                    <div className="acct-row-name">{acc.name}</div>
                    <div className="acct-row-sub">{acc.role}</div>
                  </div>
                </div>
                <div className="acct-row-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`score-chip ${acc.healthScore > 80 ? 'good' : 'warn'}`}>
                    {acc.healthScore || 98}%
                  </span>
                  <span style={{ fontSize: 11, color: '#737373' }}>{acc.dailyUsage || '0/100'}</span>
                  <button
                    className={`action-btn ${selectedAccountId === acc.id ? 'primary' : ''}`}
                    onClick={() => { onSelectAccount(acc.id); onClose(); }}
                  >
                    {selectedAccountId === acc.id ? 'Active' : 'Select'}
                  </button>
                  <button
                    className="icon-btn"
                    title="Remove Account"
                    disabled={deletingId === acc.id}
                    onClick={(e) => { e.stopPropagation(); handleDelete(acc.id, acc.name); }}
                    style={{ color: '#ef4444', padding: 6, borderRadius: 6, background: '#fef2f2', border: '1px solid #fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: 12, color: '#737373' }}>Connect a new sales rep account</span>
          <button className="action-btn primary" onClick={() => { onClose(); navigate('/accounts/add'); }}>
            <Plus size={13} /> Add Account
          </button>
        </div>
      </div>
    </div>
  );
}
