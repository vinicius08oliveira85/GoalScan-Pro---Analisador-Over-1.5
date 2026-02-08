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
      className="card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6"
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
              className="btn btn-outline btn-sm flex-1"
              type="button"
              disabled={baseStatus === 'loading' || isSaveBaseDisabled}
            >
              {baseStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {baseStatus === 'loading' ? 'Salvando...' : 'Salvar Base'}
            </button>
          </div>
        </div>

        <button
          onClick={onReconcile}
          disabled={reconcileStatus === 'loading' || isReconcileDisabled}
          className="btn btn-secondary w-full btn-lg font-semibold"
          type="button"
        >
          {reconcileStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
          {reconcileStatus === 'loading' ? 'Reconciliando...' : 'Reconciliar com Apostas'}
        </button>
      </div>
    </motion.div>
  );
};

export default BankReconcileCard;
