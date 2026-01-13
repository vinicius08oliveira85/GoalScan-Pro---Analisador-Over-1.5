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
  totalBets,
  updatedAt,
  formatMoney,
}) => {
  const equity = totalBank + pendingExposure;

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      className="custom-card p-6 md:p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-primary/20 backdrop-blur-sm relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
      <div className="relative space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
            <Wallet className="w-6 h-6 md:w-8 md:h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black">Banca Atual</h2>
            <p className="text-xs md:text-sm opacity-60">Capital disponível para apostas</p>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-4xl md:text-5xl font-black tracking-tight tabular-nums">
            R$ {formatMoney(totalBank)}
          </span>
        </div>

        {(pendingExposure > 0 || totalBets > 0) && (
          <div className="text-xs md:text-sm opacity-70">
            <span className="font-semibold">Equity:</span>{' '}
            <span className="tabular-nums">R$ {formatMoney(equity)}</span>
            {pendingExposure > 0 && (
              <>
                <span className="opacity-50"> • </span>
                <span className="opacity-70">Pendentes:</span>{' '}
                <span className="tabular-nums">R$ {formatMoney(pendingExposure)}</span>
              </>
            )}
          </div>
        )}

        {updatedAt && (
          <p className="text-xs opacity-50">
            Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default BankCurrentCard;


