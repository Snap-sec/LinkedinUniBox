import React from 'react';
import { X } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  const shortcuts = [
    ['⌘K', 'Focus search'],
    ['J / K', 'Navigate conversations'],
    ['⌘ Enter', 'Send message'],
    ['S', 'Star / unstar'],
    ['N', 'Toggle note mode'],
    ['T', 'Open templates'],
  ];
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Keyboard Shortcuts</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {shortcuts.map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f2f2f2' }}>
              <span style={{ fontSize: 12.5, color: '#525252' }}>{desc}</span>
              <kbd style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, background: '#f2f2f2', border: '1px solid #d4d4d4', padding: '2px 7px', borderRadius: 5 }}>{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
