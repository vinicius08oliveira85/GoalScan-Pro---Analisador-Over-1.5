import React from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { animations } from '../../utils/animations';
import { getCurrencySymbol } from '../../utils/currency';
import { cn } from '../../utils/cn';

interface BankCurrentCardProps {
  totalBank: number;
  pendingExposure: number;
  totalBets: number;
  updatedAt?: number;
  /** ISO da moeda (ex.: BRL) — exibição; não altera cálculos. */
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
        'relative overflow-hidden rounded-3xl border border-white/10',
        'bg-gradient-to-br from-secondary/20 via-base-100/35 to-primary/10',
        'shadow-2xl shadow-primary/15 ring-1 ring-white/10 backdrop-blur-2xl dark:from-secondary/15 dark:via-base-100/20 dark:to-primary/15'
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-secondary/20 blur-3xl" aria-hidden />

      <div className="relative p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 shadow-inner shadow-primary/10 sm:h-14 sm:w-14 md:h-16 md:w-16">
              <Wallet className="h-6 w-6 text-primary sm:h-7 sm:w-7 md:h-8 md:w-8" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black tracking-tight text-base-content xs:text-lg sm:text-xl lg:text-2xl">
                Saldo Total
              </h2>
              <p className="text-[11px] leading-snug text-base-content/65 sm:text-xs md:text-sm">
                Capital disponível para apostas
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full border border-white/20 bg-base-100/50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-base-content/80 shadow-md backdrop-blur-md dark:bg-base-200/40 sm:px-3 sm:text-[10px] sm:shadow-lg">
            <span className="text-xs tabular-nums text-primary sm:text-sm">{symbol}</span>
            {currencyCode}
          </span>
        </div>

        <p className="break-words text-3xl font-black leading-none tracking-tight text-primary tabular-nums xs:text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem]">
          {formatMoney(totalBank)}
        </p>

        {pendingExposure > 0 && (
          <div className="mt-4 text-sm text-base-content/80 md:text-base">
            <span className="font-semibold">Equity:</span> {formatMoney(equity)}
            <span className="mx-2 opacity-50">•</span>
            <span className="font-semibold">Pendente:</span> {formatMoney(pendingExposure)}
          </div>
        )}

        {updatedAt && (
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50 md:text-xs">
            Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default BankCurrentCard;
