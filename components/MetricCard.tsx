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
  tooltip?: string; // Descrição explicativa para o tooltip
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
  change,
  tooltip,
}) => {
  const colorClasses = {
    primary: {
      accentBorder: 'border-l-primary/60',
      text: 'text-primary',
      iconBg: 'bg-primary/10',
      iconBorder: 'border-primary/20',
      progress: 'progress-primary',
    },
    secondary: {
      accentBorder: 'border-l-secondary/60',
      text: 'text-secondary',
      iconBg: 'bg-secondary/10',
      iconBorder: 'border-secondary/20',
      progress: 'progress-secondary',
    },
    success: {
      accentBorder: 'border-l-success/60',
      text: 'text-success',
      iconBg: 'bg-success/10',
      iconBorder: 'border-success/20',
      progress: 'progress-success',
    },
    error: {
      accentBorder: 'border-l-error/60',
      text: 'text-error',
      iconBg: 'bg-error/10',
      iconBorder: 'border-error/20',
      progress: 'progress-error',
    },
    warning: {
      accentBorder: 'border-l-warning/60',
      text: 'text-warning',
      iconBg: 'bg-warning/10',
      iconBorder: 'border-warning/20',
      progress: 'progress-warning',
    },
    accent: {
      accentBorder: 'border-l-accent/60',
      text: 'text-accent',
      iconBg: 'bg-accent/10',
      iconBorder: 'border-accent/20',
      progress: 'progress-accent',
    },
  };

  const colors = colorClasses[color];

  // Mapeamento de cores CSS para sparklines
  const sparklineColors = {
    primary: 'hsl(var(--p))',
    secondary: 'hsl(var(--s))',
    success: 'hsl(var(--su))',
    error: 'hsl(var(--er))',
    warning: 'hsl(var(--wa))',
    accent: 'hsl(var(--a))',
  };

  const cardContent = (
    <div
      className={`surface surface-hover border-l-4 ${colors.accentBorder} p-4 ${tooltip ? 'cursor-help' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="kpi-label">{title}</p>
        <div className={`p-2 rounded-lg ${colors.iconBg} border ${colors.iconBorder}`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {progress !== undefined ? (
            <>
              <progress
                className={`progress ${colors.progress} w-full h-2`}
                value={progress}
                max="100"
              ></progress>
              <p className="mt-2 text-sm font-black font-mono text-base-content">
                {typeof value === 'number' ? `${value.toFixed(0)}%` : value}
              </p>
            </>
          ) : (
            <div className="space-y-1">
              <p className="kpi-value">{typeof value === 'number' ? value.toFixed(1) : value}</p>
              {(trend && trendValue) || change !== undefined ? (
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    change !== undefined
                      ? change > 0
                        ? 'text-success'
                        : change < 0
                          ? 'text-error'
                          : 'text-base-content/60'
                      : trend === 'up'
                        ? 'text-success'
                        : trend === 'down'
                          ? 'text-error'
                          : 'text-base-content/60'
                  }`}
                >
                  {change !== undefined ? (
                    <>
                      {change > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : change < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      <span>
                        {change > 0 ? '+' : ''}
                        {change.toFixed(1)}%
                      </span>
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
          <div className="w-16 h-8 opacity-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData.map((val, idx) => ({ value: val, index: idx }))}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColors[color]}
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
  );

  // Se há tooltip, envolver com tooltip do DaisyUI
  if (tooltip) {
    return (
      <div className="tooltip tooltip-top w-full" data-tip={tooltip}>
        {cardContent}
      </div>
    );
  }

  return cardContent;
};

export default MetricCard;
