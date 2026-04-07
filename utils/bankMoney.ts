import Decimal from 'decimal.js';

/** Arredonda valor monetário para 2 casas (meio para cima). */
export function roundMoney2(value: Decimal | number | string): number {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (!d.isFinite()) return 0;
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function decimalMoney(value: number | string): Decimal {
  const d = new Decimal(value);
  return d.isFinite() ? d : new Decimal(0);
}

export function addMoney(a: number, b: number): number {
  return roundMoney2(decimalMoney(a).plus(b));
}

export function subtractMoney(a: number, b: number): number {
  return roundMoney2(decimalMoney(a).minus(b));
}

/** Saldo após aplicar delta (ex.: ajuste de aposta). Nunca negativo. */
export function applyBankDelta(currentBank: number, delta: number): number {
  const next = decimalMoney(currentBank).plus(delta);
  const clamped = Decimal.max(next, 0);
  return roundMoney2(clamped);
}

/** true se stake excede banca disponível (comparação em centavos). */
export function isInsufficientBankForBet(betAmount: number, totalBank: number): boolean {
  if (!(betAmount > 0) || !(totalBank >= 0)) return false;
  return decimalMoney(betAmount).gt(totalBank);
}

export function sumMoneyValues(values: number[]): number {
  let acc = new Decimal(0);
  for (const v of values) {
    if (Number.isFinite(v)) acc = acc.plus(v);
  }
  return roundMoney2(acc);
}
