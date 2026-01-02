import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { toastVariants } from '../utils/animations';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
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
    info: Info,
  };

  const colors = {
    success: {
      bg: 'bg-success/10',
      text: 'text-success',
      border: 'border-success/30',
      iconBg: 'bg-success/20',
    },
    error: {
      bg: 'bg-error/10',
      text: 'text-error',
      border: 'border-error/30',
      iconBg: 'bg-error/20',
    },
    warning: {
      bg: 'bg-warning/10',
      text: 'text-warning',
      border: 'border-warning/30',
      iconBg: 'bg-warning/20',
    },
    info: {
      bg: 'bg-info/10',
      text: 'text-info',
      border: 'border-info/30',
      iconBg: 'bg-info/20',
    },
  };

  const Icon = icons[toast.type];
  const colorScheme = colors[toast.type];

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={toastVariants.transition}
      className={`relative overflow-hidden rounded-2xl p-4 mb-3 border-2 ${colorScheme.border} ${colorScheme.bg} backdrop-blur-xl shadow-xl flex items-start gap-3 min-w-[300px] max-w-md`}
      role="alert"
      aria-live="assertive"
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-base-200/20 backdrop-blur-md" />

      {/* Animated gradient orb */}
      <div
        className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${colorScheme.iconBg} opacity-30 blur-2xl`}
      />

      {/* Content */}
      <div className="relative z-10 flex items-start gap-3 w-full">
        <div
          className={`p-2 rounded-lg ${colorScheme.iconBg} border ${colorScheme.border} flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${colorScheme.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${colorScheme.text} break-words`}>{toast.message}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {toast.action && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toast.action.onClick}
              className={`btn btn-xs ${colorScheme.text} border ${colorScheme.border} hover:${colorScheme.bg.replace('/10', '/20')} transition-colors`}
            >
              {toast.action.label}
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onClose(toast.id)}
            className="btn btn-xs btn-circle btn-ghost"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full hover:translate-x-full transition-all duration-700 pointer-events-none" />
    </motion.div>
  );
};

export default ToastComponent;
