import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Save, AlertCircle, Check, Loader2 } from 'lucide-react';
import { animations } from '../../utils/animations';
import type { SaveStatus, ValidationState } from './types';

interface BankEditCardProps {
  inputRef: React.RefObject<HTMLInputElement>;
  inputValue: string;
  validationState: ValidationState;
  validationMessage: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputBlur: () => void;
  leverageInput: string;
  leverage: number;
  onLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLeverageBlur: () => void;
  saveStatus: SaveStatus;
  onSave: () => void;
  isSaveDisabled: boolean;
}

const BankEditCard: React.FC<BankEditCardProps> = ({
  inputRef,
  inputValue,
  validationState,
  validationMessage,
  onInputChange,
  onInputBlur,
  leverageInput,
  leverage,
  onLeverageChange,
  onLeverageBlur,
  saveStatus,
  onSave,
  isSaveDisabled,
}) => {
  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      custom={1}
      className="card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6"
    >
      <div className="mb-4">
        <h3 className="text-lg md:text-xl font-black text-base-content mb-1">Configurações da Banca</h3>
        <p className="text-sm text-base-content/70">Ajuste o valor total e o multiplicador de retorno.</p>
      </div>

      <div className="space-y-4">
        <div className="form-control">
          <label className="label" htmlFor="bank-amount-input">
            <span className="label-text font-bold flex items-center gap-2 text-base-content/90">
              <DollarSign className="w-4 h-4" />
              Valor Total da Banca
            </span>
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="bank-amount-input"
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={onInputChange}
              onBlur={onInputBlur}
              className={`input input-bordered w-full input-lg text-xl font-semibold tabular-nums pr-12 transition-all focus:ring-2 ${
                validationState === 'valid' ? 'input-success' : validationState === 'invalid' ? 'input-error' : ''
              }`}
              placeholder="0,00"
            />
            {validationState === 'valid' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-success"><Check className="w-5 h-5" /></div>
            )}
            {validationState === 'invalid' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-error"><AlertCircle className="w-5 h-5" /></div>
            )}
          </div>
          <label className="label">
            <span className="label-text-alt text-xs text-base-content/70">{validationMessage}</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="leverage-input">
            <span className="label-text font-bold flex items-center gap-2 text-base-content/90">
              <TrendingUp className="w-4 h-4" />
              Multiplicador de Retorno
            </span>
          </label>
          <input
            id="leverage-input"
            type="text"
            inputMode="decimal"
            value={leverageInput}
            onChange={onLeverageChange}
            onBlur={onLeverageBlur}
            className="input input-bordered w-full"
            placeholder="1,00"
          />
           <label className="label">
            <span className="label-text-alt text-xs text-base-content/70">
              Multiplica o retorno potencial (alavancagem). Use com cautela.
              {leverage > 2.0 && <span className="text-warning font-bold ml-2">Alto risco!</span>}
            </span>
          </label>
        </div>

        <button
          onClick={onSave}
          disabled={isSaveDisabled || saveStatus === 'loading'}
          className="btn btn-primary w-full btn-lg font-semibold"
          type="button"
        >
          {saveStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saveStatus === 'loading' ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </motion.div>
  );
};

export default BankEditCard;
