import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const colors = {
    success: 'bg-success/20 text-success border-success/30',
    error: 'bg-error/20 text-error border-error/30',
    warning: 'bg-warning/20 text-warning border-warning/30',
    info: 'bg-info/20 text-info border-info/30'
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`custom-card p-4 mb-3 border ${colors[toast.type]} animate-in shadow-lg flex items-start gap-3 min-w-[300px] max-w-md`}
      role="alert"
      aria-live="assertive"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold break-words">{toast.message}</p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="btn btn-xs btn-circle btn-ghost flex-shrink-0"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ToastComponent;

