
import React from 'react';
import { motion } from 'framer-motion';
import { animations } from '../utils/animations';

const SkeletonStatCard: React.FC = () => (
  <div className="custom-card space-y-3 p-4 shadow-inner md:p-6">
    <div className="flex items-start justify-between">
      <div className="skeleton h-12 w-12 rounded-xl shrink-0" />
      <div className="skeleton h-4 w-4 rounded-full shrink-0" />
    </div>
    <div className="skeleton h-3 w-32" />
    <div className="skeleton h-8 w-24" />
    <div className="skeleton h-3 w-40" />
  </div>
);

const SkeletonChart: React.FC<{ hasSubtitle?: boolean }> = ({ hasSubtitle }) => (
  <div className="custom-card p-4 shadow-inner md:p-6">
    <div className="mb-4 space-y-2">
      <div className="skeleton h-5 w-40" />
      {hasSubtitle && <div className="skeleton h-3 w-56" />}
    </div>
    <div className="skeleton h-[350px] w-full rounded-xl" />
  </div>
);

const SkeletonBankHero: React.FC = () => (
  <div className="custom-card p-5 shadow-lg shadow-primary/10 ring-1 ring-white/10 backdrop-blur-md dark:ring-white/10 md:p-8">
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-3">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-14 w-full max-w-xs" />
        <div className="skeleton h-3 w-48" />
      </div>
      <div className="skeleton h-[120px] w-full rounded-xl lg:max-w-[280px]" />
    </div>
  </div>
);

const SkeletonRecentCollapses: React.FC = () => (
  <div className="custom-card p-4 shadow-inner md:p-6">
    <div className="mb-4 md:mb-6 space-y-2">
      <div className="skeleton h-6 w-44" />
      <div className="skeleton h-3 w-64" />
    </div>
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-white/10 p-4 shadow-sm backdrop-blur-sm dark:border-white/10">
          <div className="skeleton h-4 w-full max-w-md" />
          <div className="skeleton h-3 w-36" />
          <div className="flex gap-2 pt-2">
            <div className="skeleton h-6 w-16 rounded-md" />
            <div className="skeleton h-6 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DashboardLoadingSkeleton: React.FC = () => {
  const statCardCount = 6;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8" aria-busy="true" aria-label="Carregando painel inicial">
      <motion.div variants={animations.fadeInUp} initial="initial" animate="animate" custom={0}>
        <SkeletonBankHero />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 md:gap-6">
        {Array.from({ length: statCardCount }).map((_, index) => (
          <motion.div
            key={`sk-stat-${index}`}
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={index + 1}
          >
            <SkeletonStatCard />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={statCardCount + 1}
        >
          <SkeletonChart hasSubtitle />
        </motion.div>
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={statCardCount + 2}
        >
          <SkeletonChart />
        </motion.div>
      </div>

      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        custom={statCardCount + 3}
      >
        <SkeletonRecentCollapses />
      </motion.div>
    </div>
  );
};

export default DashboardLoadingSkeleton;
