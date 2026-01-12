import type { AnalysisResult, SavedAnalysis, SelectedBet } from '../types';
import { calculateSelectedBetsProbability } from './betRange';

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
  const selected = calculateSelectedBetsProbability(
    match.selectedBets,
    match.result.overUnderProbabilities
  );
  if (selected != null) return selected;

  // Fallback para probabilidade padrão
  return getPrimaryProbability(match.result);
}

/**
 * Gera label descritivo para probabilidade selecionada
 * @param selectedBets - Array de apostas selecionadas
 * @returns Label formatado (ex: "Over 0.5 + Under 4.5") ou null se não houver apostas
 */
export function getSelectedProbabilityLabel(selectedBets?: SelectedBet[]): string | null {
  if (!selectedBets || selectedBets.length === 0) {
    return null;
  }

  if (selectedBets.length === 1) {
    const bet = selectedBets[0];
    return `${bet.type === 'over' ? 'Over' : 'Under'} ${bet.line}`;
  }

  if (selectedBets.length === 2) {
    const bet1 = selectedBets[0];
    const bet2 = selectedBets[1];
    return `${bet1.type === 'over' ? 'Over' : 'Under'} ${bet1.line} + ${bet2.type === 'over' ? 'Over' : 'Under'} ${bet2.line}`;
  }

  return null;
}