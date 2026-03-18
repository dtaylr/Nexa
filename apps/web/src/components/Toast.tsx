import { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export const useToast = () => useContext(ToastContext);

const COLORS: Record<ToastType, { bg: string; border: string }> = {
  success: { bg: '#1b5e20', border: '#4caf50' },
  error:   { bg: '#b71c1c', border: '#ef5350' },
  warning: { bg: '#e65100', border: '#ff9800' },
  info:    { bg: '#0d47a1', border: '#42a5f5' },
};

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let counter = 0;

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + ++counter;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 9999,
          maxWidth: 360,
          width: 'calc(100vw - 3rem)',
        }}
      >
        {toasts.map(t => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem 1.125rem',
                borderRadius: 10,
                background: c.bg,
                borderLeft: `4px solid ${c.border}`,
                color: '#fff',
                fontSize: '0.9rem',
                lineHeight: 1.4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                animation: 'toastSlideIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, flexShrink: 0 }}>
                {ICONS[t.type]}
              </span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(1rem) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
