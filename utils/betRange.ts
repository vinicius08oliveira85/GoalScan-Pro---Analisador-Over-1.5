import type { SelectedBet } from '../types';

export type OverUnderProbabilities = Record<string, { over: number; under: number }>;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function parseLine(line: string): number | null {
  const n = Number.parseFloat(line);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcula a probabilidade efetiva das apostas selecionadas.
 *
 * Regras:
 * - 1 aposta: retorna a probabilidade da linha/tipo (prioriza o mapa `overUnder` se disponível)
 * - 2 apostas (Over + Under): retorna a probabilidade do RANGE (gols entre as linhas)
 *   Fórmula: P(range) = Under(underLine) - Under(overLine)
 *
 * Observação: a combinação correta para Over+Under não é produto (independência),
 * é um intervalo na mesma distribuição de gols (Poisson).
 */
export function calculateSelectedBetsProbability(
  selectedBets: SelectedBet[] | undefined,
  overUnder?: OverUnderProbabilities
): number | null {
  if (!selectedBets || selectedBets.length === 0) return null;

  if (selectedBets.length === 1) {
    const bet = selectedBets[0];
    const fromMap = overUnder?.[bet.line]?.[bet.type];
    if (typeof fromMap === 'number' && Number.isFinite(fromMap)) return clampPercent(fromMap);
    return clampPercent(bet.probability);
  }

  if (selectedBets.length !== 2) return null;

  const overBet = selectedBets.find((b) => b.type === 'over');
  const underBet = selectedBets.find((b) => b.type === 'under');
  if (!overBet || !underBet) return null;

  const overLine = parseLine(overBet.line);
  const underLine = parseLine(underBet.line);
  if (overLine == null || underLine == null) return null;

  // Range válido exige: Over menor que Under (ex.: Over 0.5 + Under 4.5)
  if (overLine >= underLine) return 0;

  const underUpper = overUnder?.[underBet.line]?.under;
  const underLower = overUnder?.[overBet.line]?.under;

  // Caminho preferido: usar a cumulativa Under do próprio mapa (mesma base de λ)
  if (typeof underUpper === 'number' && typeof underLower === 'number') {
    return clampPercent(underUpper - underLower);
  }

  // Fallback: derivar a partir das probabilidades das apostas (assumindo mesma fonte)
  const overProb = overUnder?.[overBet.line]?.over ?? overBet.probability;
  const underProb = overUnder?.[underBet.line]?.under ?? underBet.probability;
  if (!Number.isFinite(overProb) || !Number.isFinite(underProb)) return null;

  // P(range) = Under(upper) - Under(lower) = Under(upper) - (1 - Over(lower))
  return clampPercent(underProb + overProb - 100);
}


