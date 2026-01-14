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
            'fixed inset-0 z-[10000] flex items-start justify-center px-4 pt-[10vh]',
            containerClassName
          )}
        >
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn('fixed inset-0 bg-black/60 backdrop-blur-md', overlayClassName)}
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Panel */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'relative w-full max-w-2xl bg-base-200/95 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-2xl overflow-hidden',
              panelClassName
            )}
            role="dialog"
            aria-modal="true"
          >
            {(title || showCloseButton) && (
              <div
                className={cn(
                  'flex items-center gap-3 p-4 border-b border-base-300/50',
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

            <div className={cn('max-h-[70vh] overflow-y-auto custom-scrollbar p-2', bodyClassName)}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ModalShell;


