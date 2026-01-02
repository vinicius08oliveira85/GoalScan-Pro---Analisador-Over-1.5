import type { AnalysisResult } from '../types';

/**
 * Retorna a probabilidade "principal" do app.
 * Regra: usar Prob. Final (combinada) quando existir; senão Prob. Estatística.
 */
export function getPrimaryProbability(result: AnalysisResult): number {
  return result.combinedProbability ?? result.probabilityOver15;
}
