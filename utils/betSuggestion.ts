/**
 * Utilitários para sugestão de valor de aposta
 */

// Menor valor permitido no input (passo 0.01). Não impomos “mínimo da casa”.
export const MIN_BET_AMOUNT = 0.01;

export interface BetSuggestion {
  conservative: number;      // 1% da banca (conservador)
  moderate: number;          // 2.5% da banca (moderado)
  aggressive: number;         // 5% da banca (agressivo)
  kelly: number;              // Kelly Criterion (otimizado)
  recommended: number;        // Recomendação baseada em EV e probabilidade
  method: 'conservative' | 'moderate' | 'aggressive' | 'kelly' | 'ev-based';
  explanation: string;
}

/**
 * Calcula o Edge (vantagem percentual) da aposta
 * Edge = Probabilidade - Probabilidade Implícita da Odd
 * @param probability Probabilidade de acerto (0-100)
 * @param odd Odd da aposta
 * @returns Edge em pontos percentuais (pp)
 */
export function calculateEdge(probability: number, odd: number): number {
  if (!Number.isFinite(probability) || !Number.isFinite(odd) || odd <= 1) {
    return 0;
  }
  const impliedProb = (1 / odd) * 100;
  return probability - impliedProb;
}

/**
 * Calcula o valor sugerido usando Kelly Criterion
 * Kelly% = (Probabilidade × Odd - 1) / (Odd - 1)
 * @param probability Probabilidade de acerto (0-100)
 * @param odd Odd da aposta
 * @param bank Banca total
 * @param confidence Score de confiança (0-100, opcional) - ajusta limite do Kelly
 * @returns Valor sugerido (0 se EV negativo)
 */
export function calculateKellyStake(probability: number, odd: number, bank: number, confidence?: number): number {
  // Validação de inputs
  if (!Number.isFinite(probability) || !Number.isFinite(odd) || !Number.isFinite(bank)) {
    return 0;
  }
  
  if (bank <= 0 || odd <= 1 || probability <= 0) {
    return 0;
  }
  
  const probDecimal = probability / 100;
  const kellyPercent = (probDecimal * odd - 1) / (odd - 1);
  
  // Kelly pode ser negativo se EV for negativo
  if (kellyPercent <= 0) return 0;
  
  // Limite dinâmico do Kelly baseado em confiança
  // Alta confiança (>80): até 30% da banca
  // Média confiança (50-80): até 25% da banca
  // Baixa confiança (<50): até 15% da banca
  let maxKellyPercent = 0.25; // Padrão conservador
  if (confidence !== undefined && Number.isFinite(confidence)) {
    if (confidence > 80) {
      maxKellyPercent = 0.30; // Mais agressivo com alta confiança
    } else if (confidence < 50) {
      maxKellyPercent = 0.15; // Mais conservador com baixa confiança
    }
  }
  
  const safeKellyPercent = Math.min(kellyPercent, maxKellyPercent);
  
  return bank * safeKellyPercent;
}

/**
 * Calcula o Expected Value (EV) da aposta
 * EV = (Probabilidade × Odd) - 1
 * @param probability Probabilidade de acerto (0-100)
 * @param odd Odd da aposta
 * @returns EV em percentual (positivo = bom, negativo = ruim)
 */
export function calculateEV(probability: number, odd: number): number {
  const probDecimal = probability / 100;
  return (probDecimal * odd - 1) * 100;
}

/**
 * Calcula sugestões de valor de aposta baseadas em diferentes estratégias
 * @param probability Probabilidade de acerto (0-100)
 * @param odd Odd da aposta
 * @param bank Banca total
 * @param confidence Score de confiança (0-100, opcional) - usado para ajustar recomendações
 * @returns Objeto com diferentes sugestões de valor
 */
export function suggestBetAmount(
  probability: number,
  odd: number,
  bank: number,
  confidence?: number
): BetSuggestion {
  // Validação robusta de inputs
  if (!Number.isFinite(bank) || !Number.isFinite(odd) || !Number.isFinite(probability)) {
    return {
      conservative: 0,
      moderate: 0,
      aggressive: 0,
      kelly: 0,
      recommended: 0,
      method: 'conservative',
      explanation: 'Banca, odd ou probabilidade inválidos'
    };
  }
  
  if (bank <= 0 || odd <= 1 || probability <= 0) {
    return {
      conservative: 0,
      moderate: 0,
      aggressive: 0,
      kelly: 0,
      recommended: 0,
      method: 'conservative',
      explanation: 'Banca, odd ou probabilidade inválidos'
    };
  }

  // Calcular EV e Edge
  const ev = calculateEV(probability, odd);
  const edge = calculateEdge(probability, odd);
  
  // Se EV for negativo, não recomendar aposta
  if (ev <= 0) {
    return {
      conservative: 0,
      moderate: 0,
      aggressive: 0,
      kelly: 0,
      recommended: 0,
      method: 'conservative',
      explanation: 'EV negativo - aposta não recomendada'
    };
  }

  // Estratégias baseadas em porcentagem da banca
  let conservative = bank * 0.01;      // 1% da banca
  let moderate = bank * 0.025;        // 2.5% da banca
  let aggressive = bank * 0.05;        // 5% da banca
  
  // Kelly Criterion com ajuste por confiança
  let kelly = calculateKellyStake(probability, odd, bank, confidence);
  
  // Ajustar estratégias baseadas em confiança (se disponível)
  if (confidence !== undefined && Number.isFinite(confidence)) {
    // Baixa confiança: reduzir todas as estratégias
    if (confidence < 50) {
      conservative *= 0.7;
      moderate *= 0.7;
      aggressive *= 0.7;
    }
    // Alta confiança: pode ser um pouco mais agressivo
    else if (confidence > 80) {
      conservative *= 1.1;
      moderate *= 1.1;
      aggressive *= 1.1;
    }
  }
  
  // Recomendação inteligente baseada em EV, Edge, probabilidade e confiança
  let recommended: number;
  let method: BetSuggestion['method'];
  let explanation: string;
  
  // Estratégia baseada em Edge (vantagem percentual)
  const hasHighEdge = edge > 10; // Edge > 10pp indica grande vantagem
  const hasMediumEdge = edge > 5; // Edge > 5pp indica boa vantagem
  
  if (ev > 15 && probability > 80 && hasHighEdge && (confidence === undefined || confidence > 70)) {
    // EV muito alto, probabilidade alta, Edge alto e boa confiança - pode ser mais agressivo
    recommended = Math.min(aggressive, kelly > 0 ? kelly * 0.85 : aggressive);
    method = 'aggressive';
    explanation = `EV muito alto (${ev.toFixed(1)}%), alta probabilidade (${probability.toFixed(1)}%), Edge alto (${edge.toFixed(1)}pp) e boa confiança - pode apostar mais`;
  } else if (ev > 10 && probability > 75 && (hasHighEdge || hasMediumEdge) && (confidence === undefined || confidence > 60)) {
    // EV alto, boa probabilidade, Edge bom - moderado
    recommended = Math.min(moderate, kelly > 0 ? kelly * 0.65 : moderate);
    method = 'moderate';
    explanation = `EV alto (${ev.toFixed(1)}%), boa probabilidade (${probability.toFixed(1)}%) e Edge ${edge.toFixed(1)}pp - aposta moderada recomendada`;
  } else if (ev > 5 && probability > 70) {
    // EV positivo mas moderado - conservador
    recommended = Math.min(conservative, kelly > 0 ? kelly * 0.45 : conservative);
    method = 'conservative';
    explanation = `EV positivo moderado (${ev.toFixed(1)}%) - aposta conservadora recomendada`;
  } else {
    // EV baixo mas positivo - muito conservador
    recommended = conservative * 0.5;
    method = 'conservative';
    explanation = `EV baixo (${ev.toFixed(1)}%) - aposta muito conservadora recomendada`;
  }
  
  // Ajustar recomendação baseada em confiança
  if (confidence !== undefined && Number.isFinite(confidence)) {
    if (confidence < 50) {
      // Baixa confiança: reduzir recomendação
      recommended *= 0.6;
      explanation += ` (confiança baixa: ${confidence.toFixed(0)}%)`;
    } else if (confidence > 80) {
      // Alta confiança: pode aumentar ligeiramente
      recommended = Math.min(recommended * 1.1, bank * 0.1); // Máximo 10% da banca
    }
  }
  
  // Garantir que o valor recomendado não seja maior que a banca
  recommended = Math.min(recommended, bank);
  
  // Arredondar valores para 2 casas decimais
  return {
    conservative: Math.round(conservative * 100) / 100,
    moderate: Math.round(moderate * 100) / 100,
    aggressive: Math.round(aggressive * 100) / 100,
    kelly: Math.round(kelly * 100) / 100,
    recommended: Math.round(recommended * 100) / 100,
    method,
    explanation
  };
}

/**
 * Formata valor de aposta com símbolo de moeda
 * @param amount Valor da aposta
 * @param currency Código ou símbolo da moeda
 * @returns String formatada
 */
export function formatBetAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

