import React from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { animations } from '../../utils/animations';

interface BankCurrentCardProps {
  totalBank: number;
  pendingExposure: number;
  totalBets: number;
  updatedAt?: number;
  formatMoney: (value: number) => string;
}

const BankCurrentCard: React.FC<BankCurrentCardProps> = ({
  totalBank,
  pendingExposure,
  updatedAt,
  formatMoney,
}) => {
  const equity = totalBank + pendingExposure;

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      className="card bg-base-100 shadow-sm border border-base-300/50 p-6 md:p-8"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-base-content">Banca Atual</h2>
            <p className="text-sm text-base-content/70">Capital disponível para apostas</p>
          </div>
        </div>

        <p className="text-4xl md:text-5xl font-black tracking-tight text-primary tabular-nums">
          {formatMoney(totalBank)}
        </p>

        {pendingExposure > 0 && (
          <div className="text-sm text-base-content/80">
            <span className="font-semibold">Equity:</span> {formatMoney(equity)}
            <span className="opacity-50 mx-2">•</span>
            <span className="font-semibold">Pendente:</span> {formatMoney(pendingExposure)}
          </div>
        )}

        {updatedAt && (
          <p className="text-xs text-base-content/60 mt-4">
            Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default BankCurrentCard;
