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
 * Calcula o valor sugerido usando Kelly Criterion
 * Kelly% = (Probabilidade × Odd - 1) / (Odd - 1)
 * @param probability Probabilidade de acerto (0-100)
 * @param odd Odd da aposta
 * @param bank Banca total
 * @returns Valor sugerido (0 se EV negativo)
 */
export function calculateKellyStake(probability: number, odd: number, bank: number): number {
  const probDecimal = probability / 100;
  const kellyPercent = (probDecimal * odd - 1) / (odd - 1);
  
  // Kelly pode ser negativo se EV for negativo
  if (kellyPercent <= 0) return 0;
  
  // Limitar Kelly a no máximo 25% da banca (muito conservador)
  const maxKellyPercent = 0.25;
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
 * @returns Objeto com diferentes sugestões de valor
 */
export function suggestBetAmount(
  probability: number,
  odd: number,
  bank: number
): BetSuggestion {
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

  // Calcular EV
  const ev = calculateEV(probability, odd);
  
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
  
  // Kelly Criterion
  let kelly = calculateKellyStake(probability, odd, bank);
  
  // Recomendação inteligente baseada em EV e probabilidade
  let recommended: number;
  let method: BetSuggestion['method'];
  let explanation: string;
  
  if (ev > 15 && probability > 80) {
    // EV muito alto e probabilidade alta - pode ser mais agressivo
    recommended = Math.min(aggressive, kelly > 0 ? kelly * 0.8 : aggressive); // 80% do Kelly ou agressivo
    method = 'aggressive';
    explanation = 'EV muito alto e alta probabilidade - pode apostar mais';
  } else if (ev > 10 && probability > 75) {
    // EV alto e boa probabilidade - moderado
    recommended = Math.min(moderate, kelly > 0 ? kelly * 0.6 : moderate); // 60% do Kelly ou moderado
    method = 'moderate';
    explanation = 'EV alto e boa probabilidade - aposta moderada recomendada';
  } else if (ev > 5 && probability > 70) {
    // EV positivo mas moderado - conservador
    recommended = Math.min(conservative, kelly > 0 ? kelly * 0.4 : conservative); // 40% do Kelly ou conservador
    method = 'conservative';
    explanation = 'EV positivo moderado - aposta conservadora recomendada';
  } else {
    // EV baixo mas positivo - muito conservador
    recommended = conservative * 0.5; // Metade do conservador
    method = 'conservative';
    explanation = 'EV baixo - aposta muito conservadora recomendada';
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

