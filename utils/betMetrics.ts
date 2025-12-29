export function getImpliedProbabilityFromOdd(odd: number): number | null {
  if (!Number.isFinite(odd) || odd <= 1) return null;
  return 100 / odd;
}

/**
 * Edge (vantagem) em "pontos percentuais" (pp).
 * Edge = probabilidade - probabilidade implícita da odd.
 */
export function getEdgePp(probability: number, odd: number): number | null {
  if (!Number.isFinite(probability)) return null;
  const implied = getImpliedProbabilityFromOdd(odd);
  if (implied == null) return null;
  return probability - implied;
}


