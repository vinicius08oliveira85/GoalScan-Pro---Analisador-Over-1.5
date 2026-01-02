import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines,
}) => {
  const baseClasses = 'animate-pulse bg-base-300 rounded-lg relative overflow-hidden';

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  // Shimmer effect
  const shimmer = (
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-base-100/20 to-transparent animate-shimmer" />
  );

  if (lines && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${variantClasses.text}`}
            style={{
              width: index === lines - 1 ? '60%' : '100%',
              height: height || '1rem',
            }}
          >
            {shimmer}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} style={style}>
      {shimmer}
    </div>
  );
};

// Skeleton presets para componentes comuns
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`custom-card p-4 md:p-6 space-y-4 ${className}`}>
    <Skeleton variant="rectangular" height={24} width="60%" />
    <Skeleton variant="rectangular" height={16} width="100%" />
    <Skeleton variant="rectangular" height={16} width="80%" />
    <div className="flex gap-2 mt-4">
      <Skeleton variant="rectangular" height={32} width={100} />
      <Skeleton variant="rectangular" height={32} width={100} />
    </div>
  </div>
);

export const SkeletonMetricCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-base-200 to-base-300/50 backdrop-blur-xl border border-base-300/50 ${className}`}
  >
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" height={12} width="40%" />
        <Skeleton variant="circular" width={24} height={24} />
      </div>
      <Skeleton variant="text" height={24} width="60%" />
      <Skeleton variant="rectangular" height={4} width="100%" />
    </div>
  </div>
);

export const SkeletonMatchCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`custom-card p-4 md:p-6 space-y-4 ${className}`}>
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <Skeleton variant="text" height={14} width="30%" />
        <Skeleton variant="text" height={18} width="80%" />
      </div>
      <Skeleton variant="circular" width={32} height={32} />
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Skeleton variant="rectangular" height={60} />
      <Skeleton variant="rectangular" height={60} />
      <Skeleton variant="rectangular" height={60} />
    </div>
    <Skeleton variant="rectangular" height={8} width="100%" />
  </div>
);

export default Skeleton;
