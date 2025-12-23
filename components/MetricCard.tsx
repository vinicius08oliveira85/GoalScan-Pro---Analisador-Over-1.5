import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'accent';
  progress?: number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  progress,
  trend,
  trendValue 
}) => {
  const colorClasses = {
    primary: {
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      text: 'text-primary',
      iconBg: 'bg-primary/10',
      iconBorder: 'border-primary/20',
      progress: 'progress-primary'
    },
    secondary: {
      bg: 'bg-secondary/10',
      border: 'border-secondary/20',
      text: 'text-secondary',
      iconBg: 'bg-secondary/10',
      iconBorder: 'border-secondary/20',
      progress: 'progress-secondary'
    },
    success: {
      bg: 'bg-success/10',
      border: 'border-success/20',
      text: 'text-success',
      iconBg: 'bg-success/10',
      iconBorder: 'border-success/20',
      progress: 'progress-success'
    },
    error: {
      bg: 'bg-error/10',
      border: 'border-error/20',
      text: 'text-error',
      iconBg: 'bg-error/10',
      iconBorder: 'border-error/20',
      progress: 'progress-error'
    },
    warning: {
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      text: 'text-warning',
      iconBg: 'bg-warning/10',
      iconBorder: 'border-warning/20',
      progress: 'progress-warning'
    },
    accent: {
      bg: 'bg-accent/10',
      border: 'border-accent/20',
      text: 'text-accent',
      iconBg: 'bg-accent/10',
      iconBorder: 'border-accent/20',
      progress: 'progress-accent'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className={`group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${colors.bg} backdrop-blur-xl border ${colors.border} hover:${colors.border.replace('/20', '/40')} transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-base-200/30 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase opacity-60">{title}</p>
          <div className={`p-1.5 rounded-lg ${colors.iconBg} border ${colors.iconBorder} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
            <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
          </div>
        </div>
        
        {progress !== undefined ? (
          <>
            <progress className={`progress ${colors.progress} w-full h-2 mb-1`} value={progress} max="100"></progress>
            <p className={`text-xs font-bold ${colors.text}`}>{typeof value === 'number' ? value.toFixed(0) : value}%</p>
          </>
        ) : (
          <div className="space-y-1">
            <p className={`text-sm font-black ${colors.text}`}>{value}</p>
            {trend && trendValue && (
              <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-muted-foreground'}`}>
                <span>{trendValue}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-700" />
    </div>
  );
};

export default MetricCard;

