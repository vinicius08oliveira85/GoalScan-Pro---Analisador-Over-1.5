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
      className="neumorphic-inset rounded-lg text-center p-12 md:p-16 flex flex-col items-center justify-center"
    >
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 neumorphic">
        <Wallet className="w-12 h-12 text-primary opacity-70" />
      </div>
      <h3 className="text-2xl md:text-3xl font-black text-base-content mb-3">Configure sua Banca</h3>
      <p className="text-base text-base-content/70 max-w-md">
        Adicione o valor inicial da sua banca para começar a acompanhar seus resultados e evolução.
      </p>
    </motion.div>
  );
};

export default BankEmptyState;
