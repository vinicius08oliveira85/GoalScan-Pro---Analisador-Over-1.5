import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'accent';
  progress?: number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  sparklineData?: number[];
  change?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  progress,
  trend,
  trendValue,
  sparklineData,
  change
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
        
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {progress !== undefined ? (
              <>
                <progress className={`progress ${colors.progress} w-full h-2 mb-1`} value={progress} max="100"></progress>
                <p className={`text-xs font-bold ${colors.text}`}>{typeof value === 'number' ? value.toFixed(0) : value}%</p>
              </>
            ) : (
              <div className="space-y-1">
                <p className={`text-lg sm:text-xl font-black bg-gradient-to-r ${colors.text} bg-clip-text text-transparent`}>
                  {typeof value === 'number' ? value.toFixed(1) : value}
                </p>
                {(trend && trendValue) || change !== undefined ? (
                  <div className={`flex items-center gap-1 text-xs ${change !== undefined ? (change > 0 ? 'text-success' : change < 0 ? 'text-error' : 'opacity-60') : (trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'opacity-60')}`}>
                    {change !== undefined ? (
                      <>
                        {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                        <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                      </>
                    ) : (
                      <>
                        {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        <span>{trendValue}</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          
          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="w-16 h-8 opacity-50 group-hover:opacity-100 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData.map((val, idx) => ({ value: val, index: idx }))}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={colors.text.replace('text-', 'hsl(var(--'))}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-700" />
    </div>
  );
};

export default MetricCard;

