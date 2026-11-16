import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';
import type { Notification } from '@/contexts/NotificationContext';

interface ToastProps {
  notification: Notification;
}

const TOAST_CONFIG = {
  success: {
    classes: 'border-green-200 bg-green-50 text-green-900',
    message: 'text-green-700',
    bar: 'bg-green-500',
    icon: CheckCircle,
  },
  error: {
    classes: 'border-red-200 bg-red-50 text-red-900',
    message: 'text-red-700',
    bar: 'bg-red-500',
    icon: AlertCircle,
  },
  warning: {
    classes: 'border-amber-200 bg-amber-50 text-amber-900',
    message: 'text-amber-700',
    bar: 'bg-amber-500',
    icon: AlertTriangle,
  },
  info: {
    classes: 'border-blue-200 bg-blue-50 text-blue-900',
    message: 'text-blue-700',
    bar: 'bg-blue-500',
    icon: Info,
  },
} as const;

const Toast: React.FC<ToastProps> = ({ notification }) => {
  const { removeNotification } = useNotification();
  const config = TOAST_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg ${config.classes}`}
      role={notification.type === 'error' ? 'alert' : 'status'}
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{notification.title}</p>
        {notification.message && (
          <p className={`mt-1 break-words text-sm ${config.message}`}>{notification.message}</p>
        )}
        {notification.action && (
          <button
            type="button"
            onClick={() => {
              notification.action?.onClick();
              removeNotification(notification.id);
            }}
            className={`mt-2 text-sm font-semibold underline underline-offset-2 ${config.message}`}
          >
            {notification.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => removeNotification(notification.id)}
        className="shrink-0 rounded p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
      {notification.duration && notification.duration > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/5" aria-hidden="true">
          <div
            className={`${config.bar} h-full origin-left`}
            style={{ animation: `notification-timeout ${notification.duration}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
};

export default Toast;
