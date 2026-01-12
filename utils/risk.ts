import type { AnalysisResult } from '../types';

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Converte uma probabilidade (0-100) em nível de risco.
 * Mantém os mesmos thresholds usados no motor de análise.
 */
export function getRiskLevelFromProbability(probability: number): AnalysisResult['riskLevel'] {
  const p = clampPercent(probability);

  if (p > 88) return 'Baixo';
  if (p > 78) return 'Moderado';
  if (p > 68) return 'Alto';
  return 'Muito Alto';
}


