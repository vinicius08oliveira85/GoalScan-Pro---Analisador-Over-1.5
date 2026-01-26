import React from 'react';
import { AlertTriangle, X, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  matchTitle: string;
  betAmount: number;
  odd: number;
  currency?: string;
}

const BetConfirmationModal: React.FC<BetConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  matchTitle,
  betAmount,
  odd,
  currency = 'R$'
}) => {
  if (!isOpen) return null;

  const potentialReturn = betAmount * odd;
  const profit = potentialReturn - betAmount;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-base-300"
          >
            {/* Header */}
            <div className="bg-base-200/50 p-4 border-b border-base-300 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Confirmar Aposta
              </h3>
              <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-sm text-base-content/60 mb-1">Partida</p>
                <p className="font-bold text-lg">{matchTitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-base-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-base-content/60 mb-1">Valor da Aposta</p>
                  <p className="font-bold text-error flex items-center justify-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {currency} {betAmount.toFixed(2)}
                  </p>
                </div>
                <div className="bg-base-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-base-content/60 mb-1">Odd</p>
                  <p className="font-bold text-primary">{odd.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-base-content/70">Retorno Potencial</span>
                  <span className="font-bold text-success">{currency} {potentialReturn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-base-content/60">Lucro Líquido</span>
                  <span className="font-bold text-success/80">+{currency} {profit.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-xs text-center text-base-content/50 bg-base-200/50 p-2 rounded-lg">
                <p>O valor de <strong>{currency} {betAmount.toFixed(2)}</strong> será debitado da sua banca imediatamente.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-base-200/50 border-t border-base-300 flex gap-3">
              <button onClick={onClose} className="btn btn-ghost flex-1">
                Cancelar
              </button>
              <button onClick={onConfirm} className="btn btn-primary flex-1">
                Confirmar Aposta
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BetConfirmationModal;