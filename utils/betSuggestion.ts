/**
 * Configurações de Gestão de Risco
 */
const RISK_LEVELS = {
  CONSERVATIVE: 0.01, // 1%
  MODERATE: 0.025,    // 2.5%
  AGGRESSIVE: 0.05,    // 5%
  FRACTIONAL_KELLY: 0.25, // Usamos apenas 25% do valor sugerido pelo Kelly para segurança
  MAX_BANK_EXPOSURE: 0.10 // Nunca sugerir mais de 10% da banca em uma única bet
};

export const MIN_BET_AMOUNT = 1; // Valor mínimo de aposta em R$

export interface BetSuggestion {
  conservative: number;
  moderate: number;
  aggressive: number;
  kelly: number;
  recommended: number;
  method: 'conservative' | 'moderate' | 'aggressive' | 'kelly' | 'ev-based';
  explanation: string;
}

/**
 * Calcula a vantagem (edge) em pontos percentuais
 */
function calculateEdge(probability: number, odd: number): number {
  return probability - (100 / odd);
}

/**
 * Calcula o Valor Esperado (EV) em porcentagem
 */
export function calculateEV(probability: number, odd: number): number {
  const p = probability / 100;
  const ev = (p * (odd - 1) - (1 - p)) * 100;
  return ev;
}

export function calculateKellyStake(
  probability: number,
  odd: number,
  bank: number,
  confidence: number = 100
): number {
  if (![probability, odd, bank].every(Number.isFinite) || bank <= 0 || odd <= 1 || probability <= 0) {
    return 0;
  }

  const p = probability / 100;
  const q = 1 - p;
  const b = odd - 1;
  
  // Fórmula: (bp - q) / b
  const kellyPercent = (b * p - q) / b;

  if (kellyPercent <= 0) return 0;

  // Aplicar Kelly Fracionário (Segurança) e ajuste de confiança
  const confidenceMultiplier = confidence / 100;
  const safeKelly = kellyPercent * RISK_LEVELS.FRACTIONAL_KELLY * confidenceMultiplier;

  // Limite absoluto de exposição por aposta
  return bank * Math.min(safeKelly, RISK_LEVELS.MAX_BANK_EXPOSURE);
}

export function suggestBetAmount(
  probability: number,
  odd: number,
  bank: number,
  confidence: number = 100
): BetSuggestion {
  // Validação Inicial Única
  const invalid = ![probability, odd, bank].every(v => Number.isFinite(v) && v > 0) || odd <= 1;
  if (invalid) {
    return createEmptySuggestion('Dados inválidos para cálculo');
  }

  const ev = calculateEV(probability, odd);
  const edge = calculateEdge(probability, odd);

  if (ev <= 0) {
    return createEmptySuggestion(`EV negativo (${ev.toFixed(2)}%): aposta matematicamente desvantajosa`);
  }

  // Cálculos de Base
  const baseStake = {
    conservative: bank * RISK_LEVELS.CONSERVATIVE,
    moderate: bank * RISK_LEVELS.MODERATE,
    aggressive: bank * RISK_LEVELS.AGGRESSIVE,
    kelly: calculateKellyStake(probability, odd, bank, confidence)
  };

  // Lógica de Recomendação (Weighted Decision)
  let recommended: number;
  let method: BetSuggestion['method'];
  let explanation: string;

  if (ev > 15 && edge > 10 && confidence > 70) {
    recommended = Math.min(baseStake.aggressive, baseStake.kelly || baseStake.aggressive);
    method = 'aggressive';
    explanation = `Alta vantagem detectada (Edge ${edge.toFixed(1)}pp).`;
  } else if (ev > 5 && edge > 2) {
    recommended = Math.min(baseStake.moderate, baseStake.kelly || baseStake.moderate);
    method = 'moderate';
    explanation = `Vantagem moderada com EV de ${ev.toFixed(1)}%.`;
  } else {
    recommended = baseStake.conservative;
    method = 'conservative';
    explanation = `Vantagem pequena. Recomendado cautela.`;
  }

  // Ajuste final por confiança (Baixa confiança reduz stake)
  if (confidence < 50) {
    recommended *= (confidence / 100);
    explanation += ` Valor reduzido pela baixa confiança (${confidence}%).`;
  }

  return {
    conservative: round2(baseStake.conservative),
    moderate: round2(baseStake.moderate),
    aggressive: round2(baseStake.aggressive),
    kelly: round2(baseStake.kelly),
    recommended: round2(Math.min(recommended, bank * RISK_LEVELS.MAX_BANK_EXPOSURE)),
    method,
    explanation
  };
}

// Helpers para limpar o código
function round2(num: number) { return Math.round(num * 100) / 100; }

function createEmptySuggestion(msg: string): BetSuggestion {
  return { 
    conservative: 0, moderate: 0, aggressive: 0, kelly: 0, recommended: 0, 
    method: 'conservative', explanation: msg 
  };
}