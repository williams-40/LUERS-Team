import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ToastContainer } from '../components/ui/Toast';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  // A queue, not a stack of simultaneously-visible items — Toast now
  // renders as a single centered popup the user must click OK on ("so the
  // user knows well the action took place"), not an auto-fading corner
  // notification, so showing more than one at once would just mean a
  // backdrop with two dialogs stacked on top of each other. Each `show()`
  // still queues fine; ToastContainer only ever renders toasts[0].
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
