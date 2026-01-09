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
 * 
 * MELHORIA: Considera margem da casa de apostas (assumida como 5-7% típica)
 */
export function getEdgePp(probability: number, odd: number, houseMargin: number = 0.06): number | null {
  // Valida se a probabilidade estimada é um número válido e está entre 0 e 100
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    return null;
  }

  const implied = getImpliedProbabilityFromOdd(odd);
  
  if (implied === null) return null;

  // MELHORIA: Ajustar probabilidade implícita considerando margem da casa
  // A margem da casa reduz a probabilidade implícita "justa"
  // Ex: Se odd = 2.0, prob implícita = 50%, mas com margem de 6%, prob justa seria ~53%
  const fairImplied = implied / (1 - houseMargin);
  
  // Calcular edge usando probabilidade justa (sem margem)
  const edge = probability - fairImplied;

  // Retorna a diferença (Edge positiva significa aposta com valor)
  return edge;
}

/**
 * Calcula intervalo de confiança do Edge baseado na incerteza da probabilidade estimada.
 * 
 * @param probability - Probabilidade estimada (0-100)
 * @param confidenceScore - Score de confiança dos dados (0-100)
 * @param odd - Odd da casa de apostas
 * @returns Intervalo de confiança [edgeMin, edgeMax] em pp
 */
export function getEdgeConfidenceInterval(
  probability: number,
  confidenceScore: number,
  odd: number,
  houseMargin: number = 0.06
): { edgeMin: number; edgeMax: number; edgeCenter: number } | null {
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    return null;
  }

  const implied = getImpliedProbabilityFromOdd(odd);
  if (implied === null) return null;

  const fairImplied = implied / (1 - houseMargin);
  const edgeCenter = probability - fairImplied;

  // Calcular incerteza baseada em confiança dos dados
  // Menor confiança = maior incerteza = intervalo maior
  const uncertainty = (100 - confidenceScore) / 100; // 0 (alta confiança) a 1 (baixa confiança)
  const maxUncertainty = uncertainty * 5; // Até 5pp de incerteza para confiança 0%

  // Intervalo de confiança: ±maxUncertainty
  const edgeMin = edgeCenter - maxUncertainty;
  const edgeMax = edgeCenter + maxUncertainty;

  return {
    edgeMin: Math.max(-100, Math.min(100, edgeMin)),
    edgeMax: Math.max(-100, Math.min(100, edgeMax)),
    edgeCenter,
  };
}