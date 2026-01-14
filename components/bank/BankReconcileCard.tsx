import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Save, AlertCircle, Check, Loader2, RotateCcw } from 'lucide-react';
import { animations } from '../../utils/animations';
import type { SaveStatus } from './types';

interface BankReconcileCardProps {
  netCashDelta: number;
  pendingExposure: number;
  suggestedBase: number;

  bankBaseInput: string;
  onBaseChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBaseBlur: () => void;
  onUseSuggestedBase: () => void;

  onSaveBase: () => void;
  baseStatus: SaveStatus;
  isSaveBaseDisabled: boolean;

  onReconcile: () => void;
  reconcileStatus: SaveStatus;
  isReconcileDisabled: boolean;
}

const BankReconcileCard: React.FC<BankReconcileCardProps> = ({
  netCashDelta,
  pendingExposure,
  suggestedBase,
  bankBaseInput,
  onBaseChange,
  onBaseBlur,
  onUseSuggestedBase,
  onSaveBase,
  baseStatus,
  isSaveBaseDisabled,
  onReconcile,
  reconcileStatus,
  isReconcileDisabled,
}) => {
  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      custom={2}
      className="custom-card p-4 md:p-6"
    >
      <div className="pt-1 space-y-4">
        <div>
          <h4 className="text-base md:text-lg font-black mb-1">Reconciliar com Apostas</h4>
          <p className="text-xs md:text-sm opacity-70 leading-relaxed">
            Recalcula ganho/perda e sincroniza a banca com as apostas registradas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-base-200/40 border border-base-300/40">
            <p className="text-xs font-bold opacity-70 uppercase leading-tight">Impacto líquido (apostas)</p>
            <p
              className={`text-lg font-black tabular-nums ${
                netCashDelta > 0 ? 'text-success' : netCashDelta < 0 ? 'text-error' : ''
              }`}
            >
              {netCashDelta > 0 ? '+' : ''}
              R$ {netCashDelta.toFixed(2)}
            </p>
            {pendingExposure > 0 && (
              <p className="text-xs opacity-60 mt-1">Pendentes (travado): R$ {pendingExposure.toFixed(2)}</p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-base-200/40 border border-base-300/40">
            <p className="text-[10px] font-bold opacity-60 uppercase">Base sugerida</p>
            <p className="text-lg font-black tabular-nums">R$ {suggestedBase.toFixed(2)}</p>
            <p className="text-xs opacity-60 mt-1">Usada caso não exista uma base salva.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div className="form-control">
            <label className="label" htmlFor="bank-base-input">
              <span className="label-text font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Banca Base (R$)
              </span>
            </label>
            <input
              id="bank-base-input"
              type="text"
              inputMode="decimal"
              value={bankBaseInput}
              onChange={onBaseChange}
              onBlur={onBaseBlur}
              className="input input-bordered w-full"
              placeholder="0,00"
              aria-label="Banca base para reconciliação"
            />
            <label className="label">
              <span className="label-text-alt opacity-60 text-xs">Salva localmente (neste dispositivo).</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={onUseSuggestedBase} className="btn btn-outline btn-sm flex-1" type="button">
              Usar sugerida
            </button>
            <button
              onClick={onSaveBase}
              className="btn btn-outline btn-sm flex-1"
              type="button"
              disabled={baseStatus === 'loading' || isSaveBaseDisabled}
            >
              {baseStatus === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : baseStatus === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  Salvo
                </>
              ) : baseStatus === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Erro
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Base
                </>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={onReconcile}
          disabled={reconcileStatus === 'loading' || isReconcileDisabled}
          className="btn btn-secondary w-full flex items-center justify-center gap-2 min-h-[52px] text-base font-semibold"
          type="button"
        >
          {reconcileStatus === 'loading' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Reconciliando...
            </>
          ) : reconcileStatus === 'success' ? (
            <>
              <Check className="w-5 h-5" />
              Banca reconciliada!
            </>
          ) : reconcileStatus === 'error' ? (
            <>
              <AlertCircle className="w-5 h-5" />
              Erro ao reconciliar
            </>
          ) : (
            <>
              <RotateCcw className="w-5 h-5" />
              Reconciliar com Apostas
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default BankReconcileCard;


