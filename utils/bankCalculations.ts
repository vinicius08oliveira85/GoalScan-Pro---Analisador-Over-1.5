import Decimal from 'decimal.js';

/** Fração Kelly completa: (p×b − q) / b, com b = odd−1, q = 1−p. Retorna 0 se inválido ou ≤ 0. */
export function kellyFraction(probabilityPercent: number, decimalOdd: number): number {
  if (
    !Number.isFinite(probabilityPercent) ||
    !Number.isFinite(decimalOdd) ||
    decimalOdd <= 1 ||
    probabilityPercent <= 0 ||
    probabilityPercent >= 100
  ) {
    return 0;
  }
  const p = new Decimal(probabilityPercent).div(100);
  const b = new Decimal(decimalOdd).minus(1);
  if (b.lte(0)) return 0;
  const q = new Decimal(1).minus(p);
  const num = p.mul(b).minus(q);
  if (num.lte(0)) return 0;
  return num.div(b).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber();
}

export const DEFAULT_FRACTIONAL_KELLY = 0.25;
export const DEFAULT_MAX_BANK_FRACTION = 0.1;

/**
 * Fração da banca após Kelly fracionário e teto (ex.: ¼ Kelly, máx. 10%).
 * confidenceMultiplier tipicamente confidenceScore/100.
 */
export function fractionalKellyBankFraction(
  probabilityPercent: number,
  decimalOdd: number,
  fractionalKelly: number = DEFAULT_FRACTIONAL_KELLY,
  confidenceMultiplier: number = 1
): number {
  const full = kellyFraction(probabilityPercent, decimalOdd);
  if (full <= 0) return 0;
  const conf = Math.max(0, Math.min(1, confidenceMultiplier));
  const frac = new Decimal(full).mul(fractionalKelly).mul(conf);
  const cap = new Decimal(DEFAULT_MAX_BANK_FRACTION);
  return Decimal.min(frac, cap).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toNumber();
}
