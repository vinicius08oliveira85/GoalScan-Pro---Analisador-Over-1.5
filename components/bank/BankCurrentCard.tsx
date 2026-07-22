import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { animations } from '../../utils/animations';
import { getCurrencySymbol } from '../../utils/currency';
import { cn } from '../../utils/cn';

interface BankCurrentCardProps {
  totalBank: number;
  pendingExposure: number;
  totalBets: number;
  updatedAt?: number;
  currencyCode: string;
  formatMoney: (value: number) => string;
}

const BankCurrentCard: React.FC<BankCurrentCardProps> = ({
  totalBank,
  pendingExposure,
  totalBets,
  updatedAt,
  currencyCode,
  formatMoney,
}) => {
  void totalBets;
  const equity = totalBank + pendingExposure;
  const symbol = getCurrencySymbol(currencyCode);

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      className={cn(
        'relative overflow-hidden rounded-3xl border border-base-300/50',
        'bg-gradient-to-br from-secondary/20 via-base-100/30 to-primary/10',
        'shadow-2xl shadow-primary/20 ring-1 ring-base-300/30 backdrop-blur-2xl'
      )}
    >
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-1/2 left-1/3 h-32 w-32 rounded-full bg-accent/8 blur-3xl" aria-hidden />

      <div className="relative p-5 sm:p-6 md:p-8 lg:p-10">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 shadow-inner shadow-primary/10 sm:h-14 sm:w-14">
              <Wallet className="h-6 w-6 text-primary sm:h-7 sm:w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-base-content">
                Saldo Total
              </h2>
              <p className="text-[11px] sm:text-xs text-base-content/50">
                Capital disponível para apostas
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-base-300/40 bg-base-100/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-base-content/70 shadow-md backdrop-blur-md sm:px-3 sm:text-[10px]">
            <span className="text-xs tabular-nums text-primary sm:text-sm">{symbol}</span>
            {currencyCode}
          </span>
        </div>

        <div className="flex items-baseline gap-3">
          <p className="break-words text-3xl font-black leading-none tracking-tight text-primary tabular-nums xs:text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem]">
            {formatMoney(totalBank)}
          </p>
          {pendingExposure > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-base-content/50 bg-base-300/30 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3 text-warning" />
              <span className="tabular-nums">{formatMoney(equity)}</span>
            </span>
          )}
        </div>

        {pendingExposure > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-base-content/70">
            <span className="flex items-center gap-1">
              <span className="font-semibold">Equity:</span>
              <span className="tabular-nums font-bold text-base-content">{formatMoney(equity)}</span>
            </span>
            <span className="hidden sm:inline text-base-content/30">|</span>
            <span className="flex items-center gap-1">
              <span className="font-semibold">Pendente:</span>
              <span className="tabular-nums font-bold text-warning">{formatMoney(pendingExposure)}</span>
            </span>
          </div>
        )}

        {updatedAt && (
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-base-content/40">
            Ultima atualizacao: {new Date(updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default BankCurrentCard;
