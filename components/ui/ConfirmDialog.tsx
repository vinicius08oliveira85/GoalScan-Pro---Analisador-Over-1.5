import React from 'react';
import ModalShell from './ModalShell';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
}) => {
  const variantClasses = {
    danger: 'btn-error',
    warning: 'btn-warning',
    info: 'btn-info',
  };

  const iconColors = {
    danger: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      panelClassName="max-w-md"
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-6">
          <div className={`p-2 rounded-xl bg-base-300/50 flex-shrink-0`}>
            <AlertTriangle className={`w-6 h-6 ${iconColors[variant]}`} />
          </div>
          <p className="text-sm leading-relaxed pt-1">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`btn btn-sm ${variantClasses[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default ConfirmDialog;
