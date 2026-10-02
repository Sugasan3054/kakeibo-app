import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, options?: {
    type?: 'success' | 'error' | 'info';
    action?: { label: string; onClick: () => void };
    duration?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((
    message: string,
    options?: {
      type?: 'success' | 'error' | 'info';
      action?: { label: string; onClick: () => void };
      duration?: number;
    }
  ) => {
    const id = crypto.randomUUID();
    const toast: ToastItem = {
      id,
      message,
      type: options?.type || 'success',
      action: options?.action,
      duration: options?.duration || 3000,
    };

    setToasts((prev) => [...prev, toast]);

    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, toast.duration);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.container} role="status" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
            role="alert"
          >
            <span className={styles.icon} aria-hidden="true">
              {toast.type === 'success' && <Icon name="check" variant="fill" size={18} />}
              {toast.type === 'error' && <Icon name="attention" variant="fill" size={18} />}
              {toast.type === 'info' && <Icon name="attention" variant="line" size={18} />}
            </span>
            <span className={styles.message}>{toast.message}</span>
            {toast.action && (
              <button
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              className={styles.close}
              onClick={() => removeToast(toast.id)}
              aria-label="閉じる"
            >
              <Icon name="close" variant="line" size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
