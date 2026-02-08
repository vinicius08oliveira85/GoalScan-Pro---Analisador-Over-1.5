
import { SavedAnalysis } from '../types';
import { getDisplayProbability } from './probability';

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
 * Calcula o Valor Esperado (EV) de uma aposta.
 * @param probability - A probabilidade estimada do evento (0-100).
 * @param odd - A odd decimal oferecida pela casa de apostas.
 * @returns O EV como uma porcentagem. Retorna 0 se os inputs forem inválidos.
 */
export function calculateEV(probability: number, odd: number): number {
  if (!probability || !odd || odd <= 1 || probability < 0 || probability > 100) {
    return 0;
  }
  // Fórmula do EV: (Probabilidade de Ganhar * Lucro por Aposta) - (Probabilidade de Perder * Valor da Aposta)
  // Simplificado: ((probability / 100) * odd - 1) * 100
  const ev = (probability / 100) * odd - 1;
  return ev * 100;
}

/**
 * Calcula o Valor Esperado (EV) para uma partida salva, considerando as apostas selecionadas.
 * Se nenhuma aposta específica foi selecionada, usa o EV padrão da análise (Over 1.5).
 * @param match - O objeto da partida salva.
 * @returns O EV calculado para a aposta selecionada ou o EV padrão.
 */
export function getDisplayEV(match: SavedAnalysis): number {
    const displayProb = getDisplayProbability(match);
    
    // Prioriza a odd da aposta registrada pelo usuário.
    // Essa é a odd REAL da aposta que ele fez.
    const displayOdd = match.betInfo?.odd || match.data.oddOver15;

    // Se a odd for válida, calcula o EV dinamicamente
    if (displayOdd && displayOdd > 1) {
        return calculateEV(displayProb, displayOdd);
    }

    // Como fallback, retorna o EV pré-calculado da análise (baseado no Over 1.5)
    return match.result.ev;
}


/**
 * Calcula a Vantagem (Edge) em pontos percentuais (pp).
 * Edge = Probabilidade Estimada (%) - Probabilidade Implícita Justa (%)
 * 
 * Considera margem da casa de apostas (assumida como 5-7% típica).
 * A margem reduz a odd oferecida, então a probabilidade implícita "justa" (sem margem)
 * é calculada como: fairImplied = implied * (1 - houseMargin)
 * 
 * Exemplo:
 * - Odd oferecida: 2.0 (prob implícita = 50%)
 * - Margem: 6%
 * - Prob implícita justa: 50% * 0.94 = 47%
 * - Se prob estimada = 55%, Edge = 55% - 47% = 8pp
 */
export function getEdgePp(probability: number, odd: number, houseMargin: number = 0.06): number | null {
  // Valida se a probabilidade estimada é um número válido e está entre 0 e 100
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    return null;
  }

  const implied = getImpliedProbabilityFromOdd(odd);
  
  if (implied === null) return null;

  // Ajustar probabilidade implícita considerando margem da casa
  // A margem da casa reduz a odd oferecida, então a probabilidade implícita "justa" (sem margem) é menor
  // Ex: Se odd = 2.0, prob implícita = 50%, mas com margem de 6%, prob justa seria ~47%
  // Fórmula: fairImplied = implied * (1 - houseMargin)
  const fairImplied = implied * (1 - houseMargin);
  
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

  // Ajustar probabilidade implícita considerando margem da casa (mesma lógica de getEdgePp)
  const fairImplied = implied * (1 - houseMargin);
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
