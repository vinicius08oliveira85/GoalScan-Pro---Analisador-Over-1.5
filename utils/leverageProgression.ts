import { LeverageProgressionRow } from '../types';
import { decimalMoney, roundMoney2 } from './bankMoney';

function computeDay(
  day: number,
  currentInvestment: number,
  dayOdd: number
): { row: LeverageProgressionRow; nextInvestment: number } {
  const inv = decimalMoney(currentInvestment);
  const validOdd = dayOdd > 1.0 && dayOdd <= 50;
  const returnAmount = validOdd ? roundMoney2(inv.times(dayOdd)) : roundMoney2(inv);
  return {
    row: { day, investment: currentInvestment, return: returnAmount, odd: dayOdd },
    nextInvestment: returnAmount,
  };
}

function calculateProgression(
  initialInvestment: number,
  getOdd: (day: number) => number,
  days: number
): LeverageProgressionRow[] {
  if (initialInvestment <= 0 || days < 1) return [];

  const progression: LeverageProgressionRow[] = [];
  let currentInvestment = roundMoney2(initialInvestment);

  for (let day = 1; day <= days; day++) {
    const { row, nextInvestment } = computeDay(day, currentInvestment, getOdd(day));
    progression.push(row);
    currentInvestment = nextInvestment;
  }

  return progression;
}

export function calculateLeverageProgression(
  initialInvestment: number,
  odd: number,
  days: number
): LeverageProgressionRow[] {
  if (odd <= 1.0) return [];
  return calculateProgression(initialInvestment, () => odd, days);
}

export function calculateLeverageProgressionWithVariableOdds(
  initialInvestment: number,
  odds: number[],
  days: number
): LeverageProgressionRow[] {
  if (odds.length === 0) return [];
  return calculateProgression(initialInvestment, (day) => odds[day - 1] || odds[0] || 1.0, days);
}

/**
 * Formata valor monetário em BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Valida parâmetros de alavancagem progressiva
 */
export function validateLeverageParams(
  initialInvestment: number,
  odd: number,
  days: number
): { valid: boolean; error?: string } {
  if (initialInvestment <= 0) {
    return { valid: false, error: 'Investimento inicial deve ser maior que zero' };
  }

  if (odd <= 1.0) {
    return { valid: false, error: 'Odd deve ser maior que 1.0' };
  }

  if (odd > 50) {
    return { valid: false, error: 'Odd muito alta (máximo: 50)' };
  }

  if (days < 1 || days > 30) {
    return { valid: false, error: 'Número de dias deve estar entre 1 e 30' };
  }

  if (initialInvestment > 1000000) {
    return { valid: false, error: 'Investimento inicial muito alto (máximo: R$ 1.000.000)' };
  }

  return { valid: true };
}

