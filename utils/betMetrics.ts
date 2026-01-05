/**
 * Calcula a probabilidade implícita de uma odd decimal.
 * Ex: Odd 2.0 -> 50%
 */
export function getImpliedProbabilityFromOdd(odd: number): number | null {
  // Odds menores ou iguais a 1 são matematicamente impossíveis no mercado decimal
  if (!Number.isFinite(odd) || odd <= 1) return null;
  
  return 100 / odd;
}

/**
 * Calcula a Vantagem (Edge) em pontos percentuais (pp).
 * Edge = Probabilidade Estimada (%) - Probabilidade Implícita pela Odd (%)
 */
export function getEdgePp(probability: number, odd: number): number | null {
  // Valida se a probabilidade estimada é um número válido e está entre 0 e 100
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    return null;
  }

  const implied = getImpliedProbabilityFromOdd(odd);
  
  if (implied === null) return null;

  // Retorna a diferença bruta (Edge positiva significa aposta com valor)
  return probability - implied;
}