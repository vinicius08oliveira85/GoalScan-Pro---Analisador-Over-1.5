import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Save, AlertCircle, Check, Coins } from 'lucide-react';
import { animations } from '../../utils/animations';
import { getCurrencySymbol } from '../../utils/currency';
import type { SaveStatus, ValidationState } from './types';
import { cn } from '../../utils/cn';

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
  /** Moeda atual (somente exibição no card de configuração). */
  currencyCode: string;
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
  currencyCode,
}) => {
  void totalBank;
  const symbol = getCurrencySymbol(currencyCode);

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      custom={1}
      className="rounded-3xl border border-white/10 bg-base-100/30 p-3.5 shadow-xl shadow-black/5 ring-1 ring-white/5 backdrop-blur-xl dark:border-white/10 dark:bg-base-100/20 xs:p-4 md:p-6 lg:p-8"
    >
      <div className="mb-4 sm:mb-5 md:mb-6">
        <h3 className="mb-0.5 text-base font-black tracking-tight text-base-content sm:text-lg md:text-xl">
          Configurações da Banca
        </h3>
        <p className="text-xs leading-snug text-base-content/65 sm:text-sm">Ajuste o valor total e o multiplicador de retorno.</p>
      </div>

      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_minmax(0,11rem)] lg:items-end lg:gap-6">
          <div className="form-control min-w-0">
            <label className="label pb-1 pt-0" htmlFor="bank-amount-input">
              <span className="label-text flex items-center gap-2 font-bold text-base-content/90">
                <DollarSign className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                Editar saldo
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
                className={cn(
                  'input input-bordered input-lg w-full rounded-2xl border-white/15 bg-base-200/50 pr-11 text-lg font-semibold tabular-nums backdrop-blur-sm transition-all sm:pr-12 sm:text-xl',
                  'focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50',
                  validationState === 'valid' && 'input-success border-success/30',
                  validationState === 'invalid' && 'input-error border-error/30'
                )}
                placeholder="0,00"
              />
              {validationState === 'valid' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-success">
                  <Check className="h-5 w-5" aria-hidden />
                </div>
              )}
              {validationState === 'invalid' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-error">
                  <AlertCircle className="h-5 w-5" aria-hidden />
                </div>
              )}
            </div>
            <label className="label pb-0 pt-1">
              <span className="label-text-alt text-xs text-base-content/60">{validationMessage}</span>
            </label>
          </div>

          <div className="form-control min-w-0">
            <label className="label pb-1 pt-0" htmlFor="bank-currency-display">
              <span className="label-text flex items-center gap-2 font-bold text-base-content/90">
                <Coins className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                Moeda
              </span>
            </label>
            <div
              id="bank-currency-display"
              className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-base-200/50 px-3 py-2.5 text-center backdrop-blur-sm sm:min-h-[3.5rem] sm:px-4 sm:py-3"
              role="status"
              aria-label={`Moeda da banca: ${currencyCode}`}
            >
              <span className="text-base font-black tabular-nums text-primary sm:text-lg">{symbol}</span>
              <span className="text-xs font-bold uppercase tracking-wide text-base-content/70 sm:text-sm">{currencyCode}</span>
            </div>
            <span className="sr-only">Montantes, estatísticas e histórico usam a moeda {currencyCode}.</span>
          </div>
        </div>

        <div className="form-control">
          <label className="label pb-1 pt-0" htmlFor="leverage-input">
            <span className="label-text flex items-center gap-2 font-bold text-base-content/90">
              <TrendingUp className="h-4 w-4 shrink-0 text-accent" aria-hidden />
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
            className="input input-bordered w-full rounded-2xl border-white/15 bg-base-200/50 backdrop-blur-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="1,00"
          />
          <label className="label pb-0 pt-1">
            <span className="label-text-alt text-xs text-base-content/60">
              Multiplica o retorno potencial (alavancagem). Use com cautela.
              {leverage > 2.0 && <span className="ml-2 font-bold text-warning">Alto risco!</span>}
            </span>
          </label>
        </div>

        {saveStatus === 'loading' && (
          <div
            className="space-y-3 rounded-2xl border border-base-content/10 bg-base-200/40 p-4 backdrop-blur-sm"
            aria-busy="true"
            aria-label="Salvando configurações da banca"
          >
            <div className="flex items-center gap-3 text-xs font-semibold text-base-content/75">
              <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-3 w-32 rounded-lg" />
                <div className="skeleton h-2 w-full max-w-xs rounded-md" />
              </div>
            </div>
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-3 w-4/5 rounded-md" />
          </div>
        )}

        <motion.button
          type="button"
          onClick={onSave}
          disabled={isSaveDisabled || saveStatus === 'loading'}
          whileHover={!isSaveDisabled && saveStatus !== 'loading' ? { scale: 1.02 } : undefined}
          whileTap={!isSaveDisabled && saveStatus !== 'loading' ? { scale: 0.98 } : undefined}
          className={cn(
            'btn btn-primary btn-lg h-auto min-h-[3rem] w-full gap-2 rounded-2xl font-black shadow-xl shadow-primary/25 transition-shadow sm:min-h-[3.25rem]',
            'hover:shadow-2xl hover:shadow-primary/30 disabled:shadow-none'
          )}
        >
          {saveStatus === 'loading' ? (
            <span className="loading loading-spinner loading-md" aria-hidden />
          ) : (
            <Save className="h-5 w-5 shrink-0" aria-hidden />
          )}
          {saveStatus === 'loading' ? 'Salvando...' : 'Salvar Configurações'}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default BankEditCard;
