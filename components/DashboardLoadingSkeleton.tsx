
import React from 'react';
import { motion } from 'framer-motion';
import { animations } from '../utils/animations';
import Skeleton from './Skeleton';
import SectionHeader from './ui/SectionHeader';

const SkeletonStatCard: React.FC = () => (
  <div className="custom-card p-4 md:p-6">
    <div className="flex items-start justify-between mb-3">
      <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl" />
      <Skeleton variant="circular" width={16} height={16} />
    </div>
    <div>
      <Skeleton variant="text" width="70%" height={14} className="mb-1.5" />
      <Skeleton variant="text" width="50%" height={28} className="mb-1.5" />
      <Skeleton variant="text" width="80%" height={12} />
    </div>
  </div>
);

const SkeletonChart: React.FC<{ hasSubtitle?: boolean }> = ({ hasSubtitle }) => (
  <div className="custom-card p-4 md:p-6">
    <SectionHeader
      title={<Skeleton variant="text" width="40%" height={20} />}
      subtitle={
        hasSubtitle ? <Skeleton variant="text" width="60%" height={14} /> : undefined
      }
      className="mb-4"
    />
    <Skeleton variant="rectangular" width="100%" height={350} />
  </div>
);

const SkeletonRecentMatchesTable: React.FC = () => (
  <div className="custom-card p-4 md:p-6">
    <div className="mb-4">
      <Skeleton variant="text" width="30%" height={24} className="mb-1" />
      <Skeleton variant="text" width="50%" height={14} />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <div className="flex-1">
            <Skeleton variant="text" width="70%" height={16} className="mb-1" />
            <Skeleton variant="text" width="40%" height={12} />
          </div>
          <div className="w-1/4 flex justify-end">
            <Skeleton variant="text" width="50%" height={16} />
          </div>
          <div className="w-1/4 flex justify-end">
            <Skeleton variant="text" width="50%" height={16} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DashboardLoadingSkeleton: React.FC = () => {
  const statCardCount = 7;

  return (
    <div className="space-y-6 md:space-y-8 pb-16 md:pb-8">
      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 md:gap-6">
        {Array.from({ length: statCardCount }).map((_, index) => (
          <motion.div
            key={`sk-stat-${index}`}
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={index}
          >
            <SkeletonStatCard />
          </motion.div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={statCardCount}
        >
          <SkeletonChart hasSubtitle />
        </motion.div>
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={statCardCount + 1}
        >
          <SkeletonChart />
        </motion.div>
      </div>

      {/* Tabela de Partidas Recentes */}
      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        custom={statCardCount + 2}
      >
        <SkeletonRecentMatchesTable />
      </motion.div>
    </div>
  );
};

export default DashboardLoadingSkeleton;
