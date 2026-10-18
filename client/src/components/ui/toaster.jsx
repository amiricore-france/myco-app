import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from './toast';
import { subscribeToasts, dismissToast, removeToast } from '../../lib/toast-store';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  default: Info,
};

const COLORS = {
  success: 'text-primary-600',
  error: 'text-danger-600',
  warning: 'text-warning-600',
  info: 'text-info-600',
  default: 'text-neutral-500',
};

export function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts(action => {
      if (action.type === 'add') {
        setToasts(prev => [...prev, action.toast]);
        // Ferme automatiquement
        setTimeout(() => dismissToast(action.toast.id), action.toast.duration);
      } else if (action.type === 'dismiss') {
        setToasts(prev => prev.map(t => t.id === action.id ? { ...t, open: false } : t));
        setTimeout(() => removeToast(action.id), 300);
      } else if (action.type === 'remove') {
        setToasts(prev => prev.filter(t => t.id !== action.id));
      }
    });
    return unsubscribe;
  }, []);

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(t => {
        const Icon = ICONS[t.variant] || ICONS.default;
        return (
          <Toast
            key={t.id}
            open={t.open}
            onOpenChange={open => { if (!open) dismissToast(t.id); }}
            variant={t.variant}
          >
            <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${COLORS[t.variant]}`} />
            <div className="flex-1">
              {t.title && <ToastTitle>{t.title}</ToastTitle>}
              {t.description && (
                <ToastDescription className={t.title ? 'mt-0.5' : ''}>
                  {t.description}
                </ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
