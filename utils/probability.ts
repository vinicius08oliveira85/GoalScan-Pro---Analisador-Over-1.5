import type { AnalysisResult, SavedAnalysis, SelectedBet } from '../types';

/**
 * Retorna a probabilidade "principal" do app.
 * Regra: usar Prob. Final (combinada) quando existir; senão Prob. Estatística.
 */
export function getPrimaryProbability(result: AnalysisResult): number {
  return result.combinedProbability ?? result.probabilityOver15;
}

/**
 * Calcula a probabilidade exibida baseada em apostas selecionadas salvas.
 * Se houver selectedBets salvos, usa a probabilidade da aposta ou combinada.
 * Caso contrário, usa a probabilidade padrão.
 */
export function getDisplayProbability(match: SavedAnalysis): number {
  if (match.selectedBets && match.selectedBets.length > 0) {
    if (match.selectedBets.length === 1) {
      // Se há 1 aposta selecionada, usar sua probabilidade
      return match.selectedBets[0].probability;
    } else if (match.selectedBets.length === 2) {
      // Se há 2 apostas selecionadas, calcular probabilidade combinada
      return (match.selectedBets[0].probability / 100) * (match.selectedBets[1].probability / 100) * 100;
    }
  }
  // Fallback para probabilidade padrão
  return getPrimaryProbability(match.result);
}
