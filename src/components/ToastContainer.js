'use client';

import { memo } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useShift } from '@/context/ShiftContext';

const TOAST_CONFIG = {
  success: { icon: CheckCircle, className: 'toast-success' },
  error:   { icon: AlertCircle, className: 'toast-error' },
  warning: { icon: AlertTriangle, className: 'toast-warning' },
  info:    { icon: Info, className: 'toast-info' },
};

/**
 * Toast bildirimleri — alert() yerine profesyonel bildirim sistemi.
 * Sorun 5.4 çözümü.
 */
function ToastContainer() {
  const { toasts, removeToast } = useShift();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="alert" aria-live="polite">
      {toasts.map(toast => {
        const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
        const Icon = config.icon;
        return (
          <div key={toast.id} className={`toast ${config.className}`}>
            <Icon size={16} className="toast-icon" />
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Bildirimi kapat"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ToastContainer);
