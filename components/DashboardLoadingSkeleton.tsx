
import React from 'react';
import { motion } from 'framer-motion';
import { animations } from '../utils/animations';

const skeletonHeroCard =
  'rounded-3xl border border-base-300/50 bg-base-100/30 p-5 shadow-lg shadow-black/5 ring-1 ring-base-300/30 backdrop-blur-md dark:bg-base-100/20 md:p-6';

const SkeletonStatCard: React.FC = () => (
  <div className={`${skeletonHeroCard} space-y-3`}>
    <div className="flex items-start justify-between">
      <div className="skeleton h-14 w-14 shrink-0 rounded-2xl" />
      <div className="skeleton h-4 w-4 shrink-0 rounded-full" />
    </div>
    <div className="skeleton h-3 w-28 rounded-md" />
    <div className="skeleton h-9 w-32 max-w-full rounded-lg" />
    <div className="skeleton h-3 w-40 rounded-md" />
  </div>
);

const SkeletonChart: React.FC<{ hasSubtitle?: boolean }> = ({ hasSubtitle }) => (
  <div className="rounded-3xl border border-base-300/50 bg-base-100/25 p-4 shadow-2xl shadow-black/10 ring-1 ring-base-300/30 backdrop-blur-md dark:bg-base-100/25 md:p-6">
    <div className="mb-4 space-y-2">
      <div className="skeleton h-5 w-40 rounded-lg" />
      {hasSubtitle && <div className="skeleton h-3 w-56 max-w-full rounded-md" />}
    </div>
    <div className="skeleton h-[280px] w-full rounded-2xl sm:h-[320px] md:h-[350px]" />
  </div>
);

const SkeletonBankHeroGrid: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5" aria-hidden>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={`sk-hero-${i}`} className={skeletonHeroCard}>
        <div className="flex items-start gap-3">
          <div className="skeleton h-14 w-14 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3 w-24 rounded-md" />
            <div className="skeleton h-8 w-full max-w-[10rem] rounded-lg" />
          </div>
        </div>
        {i === 0 && <div className="skeleton mt-4 h-[100px] w-full rounded-xl" />}
      </div>
    ))}
  </div>
);

const SkeletonRecentRows: React.FC = () => (
  <div className="rounded-3xl border border-base-300/50 bg-base-100/25 p-4 shadow-xl ring-1 ring-base-300/30 backdrop-blur-md dark:bg-base-100/25 md:p-6">
    <div className="mb-4 md:mb-6 space-y-2">
      <div className="skeleton h-6 w-44 rounded-lg" />
      <div className="skeleton h-3 w-full max-w-md rounded-md" />
    </div>
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[4.5rem] items-stretch gap-0 overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/40"
        >
          <div className="skeleton w-1.5 shrink-0 rounded-full" />
          <div className="flex flex-1 items-center gap-3 py-3 pl-3 pr-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-4 w-full max-w-xs rounded-md" />
              <div className="skeleton h-3 w-36 rounded-md" />
            </div>
            <div className="skeleton h-6 w-16 shrink-0 rounded-full" />
            <div className="skeleton h-5 w-5 shrink-0 rounded-full" />
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
        <SkeletonBankHeroGrid />
      </motion.div>

      <motion.div
        variants={animations.staggerChildren}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 md:gap-6"
      >
        {Array.from({ length: statCardCount }).map((_, index) => (
          <motion.div key={`sk-stat-${index}`} variants={animations.fadeInUp}>
            <SkeletonStatCard />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
        <motion.div variants={animations.fadeInUp} initial="initial" animate="animate" custom={statCardCount + 1}>
          <SkeletonChart hasSubtitle />
        </motion.div>
        <motion.div variants={animations.fadeInUp} initial="initial" animate="animate" custom={statCardCount + 2}>
          <SkeletonChart />
        </motion.div>
      </div>

      <motion.div variants={animations.fadeInUp} initial="initial" animate="animate" custom={statCardCount + 3}>
        <SkeletonRecentRows />
      </motion.div>
    </div>
  );
};

export default DashboardLoadingSkeleton;
