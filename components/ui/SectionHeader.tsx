import React from 'react';
import { cn } from '../../utils/cn';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className,
  ...props
}) => {
  return (
    <div
      className={cn('flex items-start justify-between gap-4', className)}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon ? <div className="opacity-60">{icon}</div> : null}
          <h3 className="text-lg font-black leading-tight tracking-tight md:text-xl">{title}</h3>
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs leading-relaxed opacity-60 md:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-shrink-0">{actions}</div> : null}
    </div>
  );
};

export default SectionHeader;


