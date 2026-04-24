import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Receipt } from 'lucide-react';
import type { BankTransaction } from '../../types';
import { fetchBankHistory } from '../../services/bankService';
import { getCurrencySymbol } from '../../utils/currency';
import { formatMoneyPtBr } from '../../utils/bankNumbers';
import { formatDateInBrasilia } from '../../utils/dateFormatter';
import SectionHeader from '../ui/SectionHeader';

const listContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 28 },
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
        className="mb-3 md:mb-4"
        title="Histórico de Transações"
        subtitle="Movimentações registradas na sua banca"
        icon={<Receipt className="h-5 w-5 md:h-6 md:w-6" aria-hidden />}
      />

      <div className="max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-base-100/50 shadow-lg shadow-primary/5 backdrop-blur-md [-webkit-overflow-scrolling:touch] dark:border-white/10 dark:bg-base-200/40">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16">
            <span className="loading loading-spinner loading-md text-primary" aria-hidden />
            <p className="text-sm font-semibold opacity-60">Carregando histórico…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-base-300/30 shadow-inner dark:border-white/10">
              <Receipt className="h-10 w-10 text-primary/50" strokeWidth={1.25} aria-hidden />
            </div>
            <p className="max-w-xs text-sm font-black opacity-60 md:text-base">Nenhuma movimentação registrada</p>
          </div>
        ) : (
          <motion.ul
            className="divide-y divide-white/10 dark:divide-white/5"
            variants={listContainer}
            initial="hidden"
            animate="show"
          >
            {transactions.map((tx) => {
              const signed = getSignedMovement(tx);
              const isOutflow = signed < 0;
              const balanceAfter = getBalanceAfterDisplay(tx);
              const formattedDate = formatDateInBrasilia(new Date(tx.created_at), {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <motion.li
                  key={tx.id}
                  variants={listItem}
                  className="flex min-h-[4.5rem] items-stretch gap-3 px-3 py-3.5 sm:gap-4 sm:px-4 sm:py-4"
                >
                  <div
                    className={`flex shrink-0 items-center justify-center rounded-xl border p-2 ${
                      isOutflow
                        ? 'border-error/25 bg-error/10 text-error'
                        : 'border-success/25 bg-success/10 text-success'
                    }`}
                  >
                    {isOutflow ? (
                      <ArrowDownCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                    ) : (
                      <ArrowUpCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black leading-tight text-base-content sm:text-base">
                      {getTransactionLabel(tx)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-60 sm:text-xs">
                      {formattedDate}
                    </p>
                    {tx.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] opacity-50 sm:text-xs">{tx.description}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end justify-center text-right">
                    <span
                      className={`font-black tabular-nums text-sm sm:text-base ${
                        isOutflow ? 'text-error' : 'text-success'
                      }`}
                    >
                      {isOutflow ? '−' : '+'}
                      {symbol}&nbsp;{formatMoneyPtBr(Math.abs(signed))}
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-50 sm:text-[11px]">
                      Saldo
                    </span>
                    <span className="text-xs font-black tabular-nums text-base-content sm:text-sm">
                      {symbol}&nbsp;{formatMoneyPtBr(balanceAfter)}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </section>
  );
};

export default BankTransactionHistory;
