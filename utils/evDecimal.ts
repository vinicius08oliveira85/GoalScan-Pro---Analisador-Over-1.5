import Decimal from 'decimal.js';

/**
 * EV em % com precisão decimal: (p × odd − 1) × 100.
 * Única fonte de verdade para exibição e motor de análise.
 */
export function calculateEVPercent(probability: number, odd: number): number {
  if (
    !Number.isFinite(probability) ||
    !Number.isFinite(odd) ||
    odd <= 1 ||
    probability < 0 ||
    probability > 100
  ) {
    return 0;
  }
  const p = new Decimal(probability).div(100);
  const o = new Decimal(odd);
  return p.mul(o).minus(1).mul(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}
