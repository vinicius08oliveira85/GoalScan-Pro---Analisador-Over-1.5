import React from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { animations } from '../../utils/animations';

interface BankEmptyStateProps {
  show: boolean;
}

const BankEmptyState: React.FC<BankEmptyStateProps> = ({ show }) => {
  if (!show) return null;

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      className="custom-card p-12 md:p-16 flex flex-col items-center justify-center text-center border-dashed border-2"
    >
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-6">
        <Wallet className="w-12 h-12 md:w-16 md:h-16 text-primary opacity-70" />
      </div>
      <h3 className="text-2xl md:text-3xl font-black mb-3">Configure sua Banca</h3>
      <p className="text-sm md:text-base opacity-70 max-w-md">
        Configure o valor inicial da sua banca para começar a acompanhar seus resultados.
      </p>
    </motion.div>
  );
};

export default BankEmptyState;


