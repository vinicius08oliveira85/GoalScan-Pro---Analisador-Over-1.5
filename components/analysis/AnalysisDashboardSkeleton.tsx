import React from 'react';

const AnalysisDashboardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando painel de análise">
      <div className="custom-card space-y-4 p-6 shadow-inner">
        <div className="skeleton h-7 w-3/5 max-w-sm mx-auto" />
        <div className="skeleton h-24 w-full max-w-md mx-auto rounded-xl" />
        <div className="flex justify-center gap-2">
          <div className="skeleton h-8 w-28 rounded-full" />
          <div className="skeleton h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
        </div>
      </div>
      <div className="custom-card p-6 shadow-inner">
        <div className="skeleton h-5 w-36 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboardSkeleton;
