import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Save, AlertCircle, Check } from 'lucide-react';
import { animations } from '../utils/animations';

interface LeverageOddsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (odds: number[]) => void;
  defaultOdd: number;
  days: number;
  currentOdds?: number[];
}

const LeverageOddsEditor: React.FC<LeverageOddsEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultOdd,
  days,
  currentOdds,
}) => {
  const [odds, setOdds] = useState<number[]>([]);
  const [errors, setErrors] = useState<{ [day: number]: string }>({});

  // Inicializar odds quando modal abre ou props mudam
  useEffect(() => {
    if (isOpen) {
      if (currentOdds && currentOdds.length === days) {
        setOdds([...currentOdds]);
      } else {
        // Preencher com odd padrão
        setOdds(new Array(days).fill(defaultOdd));
      }
      setErrors({});
    }
  }, [isOpen, defaultOdd, days, currentOdds]);

  const handleOddChange = (day: number, value: string) => {
    const numValue = Number(value);
    const newOdds = [...odds];
    const newErrors = { ...errors };

    if (value === '' || isNaN(numValue)) {
      newOdds[day - 1] = defaultOdd;
      delete newErrors[day];
    } else if (numValue < 1.01) {
      newErrors[day] = 'Odd deve ser no mínimo 1.01';
      newOdds[day - 1] = numValue;
    } else if (numValue > 50) {
      newErrors[day] = 'Odd deve ser no máximo 50';
      newOdds[day - 1] = numValue;
    } else {
      newOdds[day - 1] = numValue;
      delete newErrors[day];
    }

    setOdds(newOdds);
    setErrors(newErrors);
  };

  const handleReset = () => {
    setOdds(new Array(days).fill(defaultOdd));
    setErrors({});
  };

  const handleSave = () => {
    // Validar todas as odds antes de salvar
    const hasErrors = Object.keys(errors).length > 0;
    const hasInvalidOdds = odds.some((odd) => odd < 1.01 || odd > 50);

    if (hasErrors || hasInvalidOdds) {
      return;
    }

    onSave(odds);
    onClose();
  };

  const hasChanges = () => {
    if (!currentOdds || currentOdds.length !== odds.length) return true;
    return odds.some((odd, index) => odd !== currentOdds[index]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="custom-card p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-black">Editar Odds por Dia</h3>
              <p className="text-sm opacity-60">Configure a odd individual para cada dia</p>
            </div>
            <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-3">
              {Array.from({ length: days }, (_, i) => {
                const day = i + 1;
                const odd = odds[i] ?? defaultOdd;
                const error = errors[day];
                const isEdited = currentOdds ? odd !== currentOdds[i] : odd !== defaultOdd;

                return (
                  <div key={day} className="form-control">
                    <label className="label py-1">
                      <span className="label-text font-bold">
                        Dia {day}
                        {isEdited && (
                          <span className="ml-2 text-xs text-primary">(editado)</span>
                        )}
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="1.01"
                        max="50"
                        value={odd}
                        onChange={(e) => handleOddChange(day, e.target.value)}
                        className={`input input-bordered w-full ${
                          error ? 'input-error' : isEdited ? 'border-primary' : ''
                        }`}
                        placeholder={defaultOdd.toFixed(2)}
                      />
                      {!error && isEdited && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                      {error && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-error">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    {error && (
                      <label className="label py-1">
                        <span className="label-text-alt text-error text-xs">{error}</span>
                      </label>
                    )}
                    {!error && (
                      <label className="label py-1">
                        <span className="label-text-alt opacity-60 text-xs">
                          Padrão: {defaultOdd.toFixed(2)}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-base-300">
            <button onClick={handleReset} className="btn btn-outline btn-sm gap-2">
              <RotateCcw className="w-4 h-4" />
              Resetar Todas
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost btn-sm">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={Object.keys(errors).length > 0 || !hasChanges()}
                className="btn btn-primary btn-sm gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LeverageOddsEditor;

