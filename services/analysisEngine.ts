import { AnalysisResult } from "../types";

export const calculateEV = (prob: number, odd: number): number => {
  return (prob / 100) * odd - 1;
};

export const getRecommendation = (ev: number) => {
  if (ev > 0.1) return { label: "VALOR ALTO", color: "text-success" };
  if (ev > 0) return { label: "VALOR POSITIVO", color: "text-warning" };
  return { label: "SEM VALOR", color: "text-error" };
};

// Integra a resposta da IA com cálculos de mercado
export const finalizeAnalysis = (aiResult: AnalysisResult, currentOdd: number): AnalysisResult => {
  const ev = calculateEV(aiResult.probabilities.over15, currentOdd);
  return {
    ...aiResult,
    expectedValue: Number(ev.toFixed(2))
  };
};