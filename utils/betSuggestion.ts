import Decimal from 'decimal.js';
import { calculateEVPercent } from './evDecimal';
import { fractionalKellyBankFraction } from './bankCalculations';
import { roundMoney2 } from './bankMoney';

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
  return calculateEVPercent(probability, odd);
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

  const frac = fractionalKellyBankFraction(
    probability,
    odd,
    RISK_LEVELS.FRACTIONAL_KELLY,
    confidence / 100
  );
  return roundMoney2(new Decimal(bank).mul(frac));
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

  const b = new Decimal(bank);
  const baseStake = {
    conservative: roundMoney2(b.mul(RISK_LEVELS.CONSERVATIVE)),
    moderate: roundMoney2(b.mul(RISK_LEVELS.MODERATE)),
    aggressive: roundMoney2(b.mul(RISK_LEVELS.AGGRESSIVE)),
    kelly: calculateKellyStake(probability, odd, bank, confidence),
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
    recommended = roundMoney2(new Decimal(recommended).mul(confidence).div(100));
    explanation += ` Valor reduzido pela baixa confiança (${confidence}%).`;
  }

  const cap = roundMoney2(b.mul(RISK_LEVELS.MAX_BANK_EXPOSURE));

  return {
    conservative: baseStake.conservative,
    moderate: baseStake.moderate,
    aggressive: baseStake.aggressive,
    kelly: baseStake.kelly,
    recommended: roundMoney2(Decimal.min(new Decimal(recommended), new Decimal(cap))),
    method,
    explanation,
  };
}

function createEmptySuggestion(msg: string): BetSuggestion {
  return { 
    conservative: 0, moderate: 0, aggressive: 0, kelly: 0, recommended: 0, 
    method: 'conservative', explanation: msg 
  };
}