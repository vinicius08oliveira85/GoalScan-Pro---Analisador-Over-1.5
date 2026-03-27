import React from 'react';
import { motion } from 'framer-motion';
import { animations } from '../../utils/animations';
import type { BankStatCard, StatColor } from './types';
import type { BankStats } from '../../utils/dashboardStats';
import { DollarSign, Percent, CheckCircle, XCircle, Clock, Target } from 'lucide-react';

const colorMap: Record<StatColor, { text: string; bg: string; border: string }> = {
  success: { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  error: { text: 'text-error', bg: 'bg-error/10', border: 'border-error/20' },
  warning: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  primary: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
};

interface BankStatsGridProps {
  bankStats: BankStats;
  startCustomIndex?: number;
}

const BankStatsGrid: React.FC<BankStatsGridProps> = ({ bankStats, startCustomIndex = 3 }) => {
  const cards: BankStatCard[] = [
    {
      title: 'Lucro Total',
      value: `R$ ${bankStats.totalProfit.toFixed(2)}`,
      icon: DollarSign,
      color: bankStats.totalProfit > 0 ? 'success' : bankStats.totalProfit < 0 ? 'error' : 'primary',
      subtitle: bankStats.totalProfit > 0 ? 'Ganhos acumulados' : bankStats.totalProfit < 0 ? 'Prejuízo acumulado' : 'Sem movimentação',
    },
    {
      title: 'ROI',
      value: `${bankStats.roi > 0 ? '+' : ''}${bankStats.roi.toFixed(1)}%`,
      icon: Percent,
      color: bankStats.roi > 0 ? 'success' : 'error',
      subtitle: 'Return on Investment',
    },
    {
      title: 'Apostas Ganhas',
      value: bankStats.wonBets,
      icon: CheckCircle,
      color: 'success',
      subtitle: `${bankStats.totalBets > 0 ? ((bankStats.wonBets / bankStats.totalBets) * 100).toFixed(1) : 0}% de acerto`,
    },
    {
      title: 'Apostas Perdidas',
      value: bankStats.lostBets,
      icon: XCircle,
      color: 'error',
      subtitle: `${bankStats.totalBets > 0 ? ((bankStats.lostBets / bankStats.totalBets) * 100).toFixed(1) : 0}% de perda`,
    },
    {
      title: 'Pendentes',
      value: bankStats.pendingBets,
      icon: Clock,
      color: 'warning',
      subtitle: 'Aguardando resultado',
    },
    {
      title: 'Total de Apostas',
      value: bankStats.totalBets,
      icon: Target,
      color: 'primary',
      subtitle: 'Apostas registradas',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const styles = colorMap[card.color];
        return (
          <motion.div
            key={card.title}
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={index + startCustomIndex}
            className="card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-3 rounded-xl ${styles.bg} border ${styles.border}`}>
                <Icon className={`w-6 h-6 ${styles.text}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-base-content/70 uppercase tracking-wide mb-1">
                {card.title}
              </p>
              <p className={`text-3xl font-black ${styles.text}`}>{card.value}</p>
              <p className="text-xs text-base-content/60 mt-1">{card.subtitle}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default BankStatsGrid;
