import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { RESPONSE_TEMPLATES } from '../data/mockData';

export default function TemplatePickerModal({ isOpen, onClose, onSelectTemplate }) {
  const [q, setQ] = useState('');
  if (!isOpen) return null;

  const filtered = RESPONSE_TEMPLATES.filter(t =>
    t.title.toLowerCase().includes(q.toLowerCase()) ||
    t.content.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Templates</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-search">
            <Search size={13} color="#a3a3a3" />
            <input placeholder="Search templates…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          </div>

          {filtered.map(t => (
            <div key={t.id} className="tmpl-card" onClick={() => { onSelectTemplate(t); onClose(); }}>
              <div className="tmpl-card-top">
                <span className="tmpl-card-title">{t.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="tmpl-badge">{t.category}</span>
                  <code style={{ fontSize: 10.5, color: '#737373', background: '#f2f2f2', padding: '1px 5px', borderRadius: 4 }}>{t.shortcut}</code>
                </div>
              </div>
              <div className="tmpl-preview">{t.content.slice(0, 120)}…</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
