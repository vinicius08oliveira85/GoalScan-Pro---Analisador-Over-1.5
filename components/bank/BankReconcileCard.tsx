import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Save, AlertCircle, Check, RotateCcw } from 'lucide-react';
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
      className="custom-card p-4 shadow-md shadow-primary/5 backdrop-blur-sm md:p-6"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-base-content mb-1">Reconciliar Banca</h3>
          <p className="text-sm text-base-content/70">Sincronize o saldo da banca com os resultados das apostas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-base-200 border border-base-300/70">
            <p className="text-xs font-bold text-base-content/70 uppercase">Resultado Líquido</p>
            <p className={`text-lg font-black tabular-nums ${netCashDelta > 0 ? 'text-success' : netCashDelta < 0 ? 'text-error' : 'text-base-content'}`}>
              {netCashDelta >= 0 ? '+' : ''}R$ {netCashDelta.toFixed(2)}
            </p>
            {pendingExposure > 0 && (
              <p className="text-xs text-base-content/60 mt-1">Pendentes: R$ {pendingExposure.toFixed(2)}</p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-base-200 border border-base-300/70">
            <p className="text-xs font-bold text-base-content/70 uppercase">Base Sugerida</p>
            <p className="text-lg font-black text-base-content tabular-nums">R$ {suggestedBase.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="form-control">
            <label className="label" htmlFor="bank-base-input">
              <span className="label-text font-bold text-base-content/90">Banca Base Manual</span>
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
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onUseSuggestedBase} className="btn btn-outline btn-sm flex-1" type="button">Usar Sugerida</button>
            <button
              onClick={onSaveBase}
              className="btn btn-outline btn-sm flex-1 gap-1"
              type="button"
              disabled={baseStatus === 'loading' || isSaveBaseDisabled}
            >
              {baseStatus === 'loading' ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {baseStatus === 'loading' ? 'Salvando...' : 'Salvar Base'}
            </button>
          </div>
        </div>

        {(baseStatus === 'loading' || reconcileStatus === 'loading') && (
          <div
            className="rounded-xl border border-base-content/12 bg-base-200/30 p-4 space-y-2"
            aria-busy="true"
            aria-label={reconcileStatus === 'loading' ? 'Reconciliando' : 'Salvando base'}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-base-content/75">
              <span className="loading loading-spinner loading-sm text-secondary" />
              {reconcileStatus === 'loading' ? 'Sincronizando com as apostas…' : 'Salvando banca base…'}
            </div>
            <div className="skeleton h-2 w-full" />
            <div className="skeleton h-2 w-11/12" />
            <div className="skeleton h-2 w-2/3" />
          </div>
        )}

        <button
          onClick={onReconcile}
          disabled={reconcileStatus === 'loading' || isReconcileDisabled}
          className="btn btn-secondary w-full btn-lg font-semibold gap-2"
          type="button"
        >
          {reconcileStatus === 'loading' ? (
            <span className="loading loading-spinner loading-md" />
          ) : (
            <RotateCcw className="w-5 h-5" />
          )}
          {reconcileStatus === 'loading' ? 'Reconciliando...' : 'Reconciliar com Apostas'}
        </button>
      </div>
    </motion.div>
  );
};

export default BankReconcileCard;
