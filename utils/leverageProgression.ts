import { LeverageProgressionRow } from '../types';

/**
 * Calcula a progressão de alavancagem onde o retorno de cada dia vira o investimento do próximo
 * @param initialInvestment Investimento inicial (dia 1)
 * @param odd Odd da aposta
 * @param days Número de dias para calcular
 * @returns Array com a progressão dia a dia
 */
export function calculateLeverageProgression(
  initialInvestment: number,
  odd: number,
  days: number
): LeverageProgressionRow[] {
  if (initialInvestment <= 0 || odd <= 1.0 || days < 1) {
    return [];
  }

  const progression: LeverageProgressionRow[] = [];
  let currentInvestment = initialInvestment;

  for (let day = 1; day <= days; day++) {
    const returnAmount = Number((currentInvestment * odd).toFixed(2));
    progression.push({
      day,
      investment: Number(currentInvestment.toFixed(2)),
      return: returnAmount,
    });
    // Próximo investimento = retorno atual
    currentInvestment = returnAmount;
  }

  return progression;
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

