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
        'relative overflow-hidden border-dashed border-2 text-center flex flex-col items-center justify-center',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-60" />

      {icon ? (
        <div className="relative mb-6">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border border-base-300/50 bg-base-300/30 flex items-center justify-center shadow-lg">
            <div className="text-primary/80">{icon}</div>
          </div>
        </div>
      ) : null}

      <div className="relative max-w-xl">
        <h3 className="text-xl md:text-2xl font-black tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm md:text-base text-base-content/70 leading-relaxed">
            {description}
          </p>
        ) : null}

        {actions ? <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">{actions}</div> : null}
      </div>
    </GlassCard>
  );
};

export default EmptyState;


