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
        'relative flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-base-content/15 text-center shadow-inner shadow-primary/5',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8 opacity-70" />

      {icon ? (
        <div className="relative mb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-base-300/35 shadow-lg shadow-primary/10 backdrop-blur-md md:h-28 md:w-28 dark:border-white/10">
            <div className="text-primary/80">{icon}</div>
          </div>
        </div>
      ) : null}

      <div className="relative max-w-xl">
        <h3 className="text-xl md:text-2xl font-black tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed opacity-60 md:text-base">
            {description}
          </p>
        ) : null}

        {actions ? <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">{actions}</div> : null}
      </div>
    </GlassCard>
  );
};

export default EmptyState;


