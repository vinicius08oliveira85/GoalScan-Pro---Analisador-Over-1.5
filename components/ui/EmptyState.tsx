import React from 'react';
import { cn } from '../../utils/cn';
import GlassCard from './GlassCard';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actions,
  className,
  ...props
}) => {
  return (
    <GlassCard
      variant="default"
      padding="lg"
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-base-content/15 text-center min-h-[280px]',
        className
      )}
      {...props}
    >
      {/* Gradient background orbs */}
      <div className="orb-primary -top-20 -right-20 h-60 w-60" />
      <div className="orb-secondary -bottom-20 -left-20 h-52 w-52" />

      <div className="relative z-10 flex flex-col items-center gap-5 px-2">
        {icon ? (
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-base-300/40 bg-base-300/30 shadow-xl shadow-primary/10 backdrop-blur-xl sm:h-24 sm:w-24">
              <div className="text-primary/70">{icon}</div>
            </div>
          </div>
        ) : null}

        <div className="max-w-md space-y-2">
          <h3 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight leading-tight">
            {title}
          </h3>
          {description ? (
            <p className="text-xs sm:text-sm leading-relaxed text-base-content/50">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-center w-full sm:w-auto pt-1">
            {actions}
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
};

export default EmptyState;


