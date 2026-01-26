import { useState, useCallback } from 'react';
import { ToastMessage } from '../components/ToastContainer';

interface UseToastReturn {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type'], action?: ToastMessage['action']) => string;
  removeToast: (id: string) => void;
  success: (message: string, action?: ToastMessage['action']) => string;
  error: (message: string, action?: ToastMessage['action']) => string;
  info: (message: string, action?: ToastMessage['action']) => string;
  warning: (message: string, action?: ToastMessage['action']) => string;
}

export const useToast = (autoCloseTime: number = 5000): UseToastReturn => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastMessage['type'] = 'info', action?: ToastMessage['action']) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast: ToastMessage = { id, message, type, action };
      setToasts((prevToasts) => [...prevToasts, newToast]);

      if (!action) { // Auto-close apenas se não houver ação (para não sumir antes do usuário clicar)
        setTimeout(() => {
          removeToast(id);
        }, autoCloseTime);
      }
      return id;
    },
    [removeToast, autoCloseTime]
  );

  const success = useCallback(
    (message: string, action?: ToastMessage['action']) => addToast(message, 'success', action),
    [addToast]
  );

  const error = useCallback(
    (message: string, action?: ToastMessage['action']) => addToast(message, 'error', action),
    [addToast]
  );

  const info = useCallback(
    (message: string, action?: ToastMessage['action']) => addToast(message, 'info', action),
    [addToast]
  );

  const warning = useCallback(
    (message: string, action?: ToastMessage['action']) => addToast(message, 'warning', action),
    [addToast]
  );

  return { toasts, addToast, removeToast, success, error, info, warning };
};
