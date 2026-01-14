import React from 'react';
import { cn } from '../../utils/cn';

export type GlassCardVariant = 'default' | 'muted' | 'glass';
export type GlassCardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant;
  padding?: GlassCardPadding;
  interactive?: boolean;
}

const variantClasses: Record<GlassCardVariant, string> = {
  default: 'surface surface-hover',
  muted: 'surface-muted',
  glass: 'glass-effect',
};

const paddingClasses: Record<GlassCardPadding, string> = {
  none: '',
  sm: 'p-3 md:p-4',
  md: 'p-4 md:p-6',
  lg: 'p-6 md:p-8',
};

const interactiveClasses =
  'cursor-pointer hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.99]';

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = 'default', padding = 'md', interactive = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          paddingClasses[padding],
          interactive && interactiveClasses,
          className
        )}
        {...props}
      />
    );
  }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;


