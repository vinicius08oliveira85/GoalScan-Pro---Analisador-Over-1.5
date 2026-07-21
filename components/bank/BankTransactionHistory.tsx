import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Receipt, Wallet, History } from 'lucide-react';
import type { BankTransaction } from '../../types';
import { fetchBankHistory } from '../../services/bankService';
import { getCurrencySymbol } from '../../utils/currency';
import { formatMoneyPtBr } from '../../utils/bankNumbers';
import { formatDateInBrasilia } from '../../utils/dateFormatter';
import SectionHeader from '../ui/SectionHeader';
import { cn } from '../../utils/cn';

const listContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 360, damping: 28 },
  },
};

function getSignedMovement(tx: BankTransaction): number {
  if (tx.signed_delta != null && Number.isFinite(tx.signed_delta)) {
    return tx.signed_delta;
  }
  if (tx.type === 'DEBIT') return -Math.abs(tx.amount);
  return Math.abs(tx.amount);
}

function getBalanceAfterDisplay(tx: BankTransaction): number {
  if (tx.new_bank_balance != null && Number.isFinite(tx.new_bank_balance)) {
    return tx.new_bank_balance;
  }
  return tx.balance_after ?? 0;
}

function getTransactionLabel(tx: BankTransaction): string {
  const tt = tx.transaction_type;
  if (tt === 'bet_debit') return 'Aposta registrada';
  if (tt === 'bet_credit') return 'Crédito na banca';
  if (tt === 'bet_profit') return 'Lucro recebido';
  if (tt === 'bet_adjustment') return 'Ajuste de banca';
  if (tx.type === 'DEBIT') return 'Saída (débito)';
  if (tx.type === 'CREDIT') return 'Entrada (crédito)';
  if (tx.type === 'PROFIT') return 'Lucro recebido';
  return 'Movimentação';
}

type TxVisual = 'profit' | 'debit' | 'credit';

function getTxVisual(tx: BankTransaction): TxVisual {
  const tt = tx.transaction_type;
  if (tx.type === 'PROFIT' || tt === 'bet_profit') return 'profit';
  if (tx.type === 'DEBIT' || tt === 'bet_debit') return 'debit';
  if (
    tx.type === 'CREDIT' ||
    tt === 'bet_credit' ||
    tt === 'bet_adjustment'
  ) {
    return 'credit';
  }
  const signed = getSignedMovement(tx);
  if (signed < 0) return 'debit';
  if (signed > 0) return 'profit';
  return 'credit';
}

function formatTxDateParts(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  return {
    dateLine: formatDateInBrasilia(d, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    timeLine: formatDateInBrasilia(d, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

const HistorySkeletonRow: React.FC = () => (
  <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-base-300/50 bg-base-200/30 px-3 py-3 sm:gap-4 sm:px-4">
    <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="skeleton h-3.5 w-40 max-w-[70%] rounded-lg" />
      <div className="skeleton h-2.5 w-28 rounded-md" />
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="skeleton h-4 w-20 rounded-md" />
      <div className="skeleton h-3 w-16 rounded-md" />
    </div>
  </div>
);

export interface BankTransactionHistoryProps {
  currencyCode: string;
}

const BankTransactionHistory: React.FC<BankTransactionHistoryProps> = ({ currencyCode }) => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const symbol = getCurrencySymbol(currencyCode);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchBankHistory(80)
      .then((rows) => {
        if (!cancelled) setTransactions(rows);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="min-w-0">
      <SectionHeader
        className="mb-3 md:mb-5"
        title="Histórico de Transações"
        subtitle="Movimentações registradas na sua banca"
        icon={<Receipt className="h-5 w-5 md:h-6 md:w-6" aria-hidden />}
      />

      <div className="max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden rounded-2xl border border-base-300/50 bg-base-100/35 shadow-xl shadow-primary/10 ring-1 ring-base-300/30 backdrop-blur-xl [-webkit-overflow-scrolling:touch] sm:rounded-3xl">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2.5 p-3 sm:gap-3 sm:p-4 md:p-5"
              aria-busy="true"
              aria-label="Carregando histórico"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <HistorySkeletonRow key={i} />
              ))}
            </motion.div>
          ) : transactions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-base-200/25 via-transparent to-primary/5 px-6 py-16 text-center md:py-20"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-base-300/50 bg-base-100/40 shadow-inner shadow-primary/10 backdrop-blur-md">
                <History className="h-12 w-12 text-primary/35" strokeWidth={1.15} aria-hidden />
              </div>
              <p className="max-w-sm text-base font-black leading-snug text-base-content/80 md:text-lg">
                Sua jornada financeira começa aqui
              </p>
              <p className="max-w-xs text-xs text-base-content/50 md:text-sm">
                Quando houver movimentações na banca, elas aparecerão nesta linha do tempo.
              </p>
            </motion.div>
          ) : (
            <motion.ul
              key="list"
              className="flex flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-4"
              variants={listContainer}
              initial="hidden"
              animate="show"
            >
              {transactions.map((tx) => {
                const signed = getSignedMovement(tx);
                const isOutflow = signed < 0;
                const isNeutral = signed === 0;
                const balanceAfter = getBalanceAfterDisplay(tx);
                const visual = getTxVisual(tx);
                const { dateLine, timeLine } = formatTxDateParts(tx.created_at);

                const iconWrap = cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-md',
                  visual === 'profit' &&
                    'border-success/40 bg-success/15 text-success shadow-success/25',
                  visual === 'debit' &&
                    'border-error/35 bg-error/12 text-error shadow-error/20',
                  visual === 'credit' &&
                    'border-info/35 bg-info/12 text-info shadow-info/15'
                );

                return (
                  <motion.li
                    key={tx.id}
                    layout
                    variants={listItem}
                    className="flex min-h-[4.25rem] items-stretch gap-3 rounded-2xl border border-base-300/50 bg-base-200/35 px-3 py-3 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/20 hover:bg-primary/5 sm:gap-4 sm:px-4 sm:py-3.5"
                  >
                    <div className={iconWrap} aria-hidden>
                      {visual === 'profit' && <ArrowUpCircle className="h-5 w-5 sm:h-5 sm:w-5" />}
                      {visual === 'debit' && <ArrowDownCircle className="h-5 w-5 sm:h-5 sm:w-5" />}
                      {visual === 'credit' && <Wallet className="h-5 w-5 sm:h-5 sm:w-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black leading-tight text-base-content sm:text-[0.95rem]">
                        {getTransactionLabel(tx)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-base-content/50 opacity-50">
                        {dateLine}
                        <span className="mx-1.5 opacity-40">·</span>
                        {timeLine}
                      </p>
                      {tx.description ? (
                        <p className="mt-1 line-clamp-2 text-[10px] opacity-45 sm:text-[11px]">{tx.description}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end justify-center text-right">
                      <span
                        className={cn(
                          'font-mono text-sm font-black tabular-nums sm:text-base',
                          isNeutral && 'text-base-content/70',
                          !isNeutral && isOutflow && 'text-error',
                          !isNeutral && !isOutflow && 'text-success'
                        )}
                      >
                        {isNeutral ? '' : isOutflow ? '−' : '+'}
                        {symbol}&nbsp;{formatMoneyPtBr(Math.abs(signed))}
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-base-content/50 opacity-50">
                        Saldo
                      </span>
                      <span className="font-mono text-xs font-black tabular-nums text-base-content sm:text-sm">
                        {symbol}&nbsp;{formatMoneyPtBr(balanceAfter)}
                      </span>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default BankTransactionHistory;
