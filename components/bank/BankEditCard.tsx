import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Save, AlertCircle, Check, Loader2 } from 'lucide-react';
import { animations } from '../../utils/animations';
import type { SaveStatus, ValidationState } from './types';

interface BankEditCardProps {
  inputRef: React.RefObject<HTMLInputElement>;
  inputValue: string;
  totalBank: number;
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
  totalBank,
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
      className="custom-card p-4 md:p-6"
    >
      <div className="mb-4">
        <h3 className="text-lg md:text-xl font-black mb-1">Configurações</h3>
        <p className="text-xs md:text-sm opacity-70 leading-relaxed">Edite banca e multiplicador de retorno</p>
      </div>

      <div className="space-y-4">
        {/* Valor Total da Banca */}
        <div className="form-control">
          <label className="label" htmlFor="bank-amount-input">
            <span className="label-text font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor Total da Banca (R$)
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/60 pointer-events-none text-lg font-medium z-10">
              R$
            </div>
            <input
              ref={inputRef}
              id="bank-amount-input"
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={onInputChange}
              onBlur={onInputBlur}
              className={`
                input input-bordered w-full min-h-[56px] text-xl md:text-2xl font-semibold tabular-nums pl-12 pr-12 transition-all focus:ring-2
                ${validationState === 'valid' ? 'border-success focus:ring-success' : ''}
                ${validationState === 'invalid' ? 'border-error focus:ring-error' : ''}
                ${validationState === 'idle' ? 'focus:ring-primary' : ''}
              `}
              placeholder="0,00"
              aria-label="Valor total da banca"
              aria-invalid={validationState === 'invalid'}
            />
            {validationState === 'valid' && totalBank > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-success">
                <Check className="w-5 h-5" />
              </div>
            )}
            {validationState === 'invalid' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-error">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
          </div>
          <label className="label">
            <span className="label-text-alt opacity-70 text-xs leading-relaxed">
              {validationMessage || 'Digite o valor total disponível na sua banca'}
            </span>
          </label>
        </div>

        {/* Multiplicador de Retorno */}
        <div className="form-control">
          <label className="label" htmlFor="leverage-input">
            <span className="label-text font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Multiplicador de Retorno
            </span>
          </label>
          <div className="relative">
            <input
              id="leverage-input"
              type="text"
              inputMode="decimal"
              value={leverageInput}
              onChange={onLeverageChange}
              onBlur={onLeverageBlur}
              className="input input-bordered w-full"
              placeholder="1,00"
              aria-label="Multiplicador de retorno"
            />
          </div>
          <label className="label">
            <span className="label-text-alt opacity-70 text-xs leading-relaxed">
              Multiplica o retorno potencial das apostas (0,10 a 10,00)
              {leverage > 2.0 && <span className="text-warning ml-2">⚠️ Alto risco</span>}
            </span>
          </label>
          {leverage !== 1.0 && (
            <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs font-semibold text-primary">
                Ex.: aposta de R$ 100 com odd 2.0 → retorno de R$ {(100 * 2.0 * leverage).toFixed(2)} (em vez de R$
                200)
              </p>
            </div>
          )}
        </div>

        {/* Salvar */}
        <button
          onClick={onSave}
          disabled={saveStatus === 'loading' || isSaveDisabled}
          className={`
            btn w-full flex items-center justify-center gap-2 min-h-[56px] text-base md:text-lg font-semibold
            ${isSaveDisabled ? 'btn-disabled' : 'btn-primary'}
          `}
          type="button"
        >
          {saveStatus === 'loading' && (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          )}
          {saveStatus === 'success' && (
            <>
              <Check className="w-5 h-5" />
              Salvo com sucesso!
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle className="w-5 h-5" />
              Erro ao salvar
            </>
          )}
          {saveStatus === 'idle' && (
            <>
              <Save className="w-5 h-5" />
              Salvar Configurações
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default BankEditCard;


