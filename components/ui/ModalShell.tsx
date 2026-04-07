import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { modalVariants, overlayVariants } from '../../utils/animations';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;

  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;

  containerClassName?: string;
  overlayClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  /**
   * `dialog`: cabeçalho fixo no painel; corpo com max-h limitado, scroll vertical e padding padrão.
   * `fill`: flex column + min-h-0 + overflow hidden no wrapper — filhos devem usar shrink-0 no header e flex-1 min-h-0 overflow-y-auto no corpo (ex.: modal de análise em App.tsx).
   */
  bodyLayout?: 'dialog' | 'fill';
}

const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  containerClassName,
  overlayClassName,
  panelClassName,
  headerClassName,
  bodyClassName,
  bodyLayout = 'dialog',
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 md:p-6',
            containerClassName
          )}
        >
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'pointer-events-auto fixed inset-0 bg-black/60 backdrop-blur-md',
              overlayClassName
            )}
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Painel: centralizado pelo flex do container (evita left+translate, que o Framer Motion sobrescreve) */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'pointer-events-auto relative z-[1] mx-auto flex min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/95 shadow-2xl backdrop-blur-xl',
              panelClassName
            )}
            role="dialog"
            aria-modal="true"
          >
            {(title || showCloseButton) && (
              <div
                className={cn(
                  'sticky top-0 z-[2] flex shrink-0 items-center gap-3 border-b border-base-300/50 bg-base-200/95 p-4 backdrop-blur-sm',
                  headerClassName
                )}
              >
                {title ? (
                  <h2 className="flex-1 min-w-0 text-base md:text-lg font-black leading-tight">
                    {title}
                  </h2>
                ) : (
                  <div className="flex-1" />
                )}

                {showCloseButton ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-xs btn-circle btn-ghost"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            )}

            <div
              className={cn(
                'min-h-0 min-w-0',
                bodyLayout === 'dialog' &&
                  'max-h-[min(70vh,92vh)] flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-2',
                bodyLayout === 'fill' &&
                  'flex min-h-0 flex-1 flex-col overflow-hidden',
                bodyClassName
              )}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ModalShell;


