export const chartColors = {
  cash: 'var(--color-primary)',
  equity: 'var(--color-secondary)',
  won: 'var(--color-success)',
  lost: 'var(--color-error)',
  pending: 'var(--color-warning)',
  text: 'var(--color-base-content)',
} as const;

export const chartGridProps = {
  strokeDasharray: '3 3',
  stroke: 'currentColor',
  opacity: 0.2,
} as const;

export const chartAxisTickLine = {
  stroke: 'currentColor',
  opacity: 0.3,
} as const;

export function getChartAxisTick(isMobile: boolean) {
  return {
    fill: 'currentColor',
    opacity: 0.7,
    fontSize: isMobile ? 10 : 12,
  } as const;
}

export const chartTooltipClassName = 'glass-effect rounded-xl p-4 shadow-xl';
export const chartTooltipCompactClassName = 'glass-effect rounded-lg p-3 shadow-xl';


