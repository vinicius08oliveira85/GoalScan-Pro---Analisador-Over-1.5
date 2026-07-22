export const chartColors = {
  cash: 'oklch(35% 0 0)',
  equity: 'oklch(35% 0 0)',
  won: 'oklch(51.975% 0.176 142.495)',
  lost: 'oklch(62.795% 0.257 29.233)',
  pending: 'oklch(96.798% 0.211 109.769)',
  text: 'oklch(87.609% 0 0)',
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


