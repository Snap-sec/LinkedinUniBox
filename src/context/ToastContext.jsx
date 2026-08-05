import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Floating Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: 380
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 16px',
              borderRadius: 10,
              background: '#111827',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.4,
              animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              border: t.type === 'error' ? '1px solid #7F1D1D' : t.type === 'info' ? '1px solid #1E3A8A' : '1px solid #1F2937'
            }}
          >
            {t.type === 'success' && <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0 }} />}
            {t.type === 'error' && <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />}
            {t.type === 'info' && <Info size={16} color="#3B82F6" style={{ flexShrink: 0 }} />}

            <span style={{ flex: 1 }}>{t.message}</span>

            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback no-op if context is missing
    return {
      toast: {
        success: (msg) => console.log('[Toast Success]:', msg),
        error: (msg) => console.log('[Toast Error]:', msg),
        info: (msg) => console.log('[Toast Info]:', msg)
      }
    };
  }
  return context;
}
