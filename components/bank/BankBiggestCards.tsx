import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { animations } from '../../utils/animations';

interface BankBiggestCardsProps {
  biggestWin: number;
  biggestLoss: number;
}

const BankBiggestCards: React.FC<BankBiggestCardsProps> = ({ biggestWin, biggestLoss }) => {
  if (!(biggestWin > 0) && !(biggestLoss > 0)) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {biggestWin > 0 && (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={9}
          className="custom-card p-4 md:p-6 bg-success/10 border border-success/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <h3 className="text-lg font-black text-success">Maior Ganho</h3>
          </div>
          <p className="text-3xl font-black text-success">R$ {biggestWin.toFixed(2)}</p>
        </motion.div>
      )}

      {biggestLoss > 0 && (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={10}
          className="custom-card p-4 md:p-6 bg-error/10 border border-error/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-5 h-5 text-error" />
            <h3 className="text-lg font-black text-error">Maior Perda</h3>
          </div>
          <p className="text-3xl font-black text-error">R$ {biggestLoss.toFixed(2)}</p>
        </motion.div>
      )}
    </div>
  );
};

export default BankBiggestCards;


