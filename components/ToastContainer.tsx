import React from 'react';
import { AnimatePresence } from 'framer-motion';
import Toast, { Toast as ToastType } from './Toast';

interface ToastContainerProps {
  toasts: ToastType[];
  onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-4 z-[9999] pointer-events-none"
      aria-live="polite"
      aria-label="Notificações"
    >
      <div className="pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onClose={onClose} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ToastContainer;
