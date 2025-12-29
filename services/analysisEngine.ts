
import { MatchData, AnalysisResult } from '../types';

function poissonProbability(k: number, lambda: number): number {
  const exp = Math.exp(-lambda);
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * exp) / factorial;
}

/**
 * Combina probabilidade estatística com probabilidade da IA usando média ponderada.
 * O peso da IA é baseado na confiança da IA.
 * 
 * @param statisticalProb - Probabilidade calculada pelas estatísticas (0-100)
 * @param aiProb - Probabilidade calculada pela IA (0-100) ou null
 * @param aiConfidence - Confiança da IA (0-100) ou null
 * @returns Probabilidade combinada (0-100)
 */
export function combineProbabilities(
  statisticalProb: number,
  aiProb: number | null,
  aiConfidence: number | null
): number {
  // Se não há probabilidade da IA, retornar apenas estatística
  if (aiProb === null || aiProb === undefined) {
    return statisticalProb;
  }
  
  // Se não há confiança da IA, usar média simples
  if (aiConfidence === null || aiConfidence === undefined || aiConfidence <= 0) {
    return (statisticalProb + aiProb) / 2;
  }
  
  // Normalizar confiança para 0-1
  const aiWeight = Math.min(Math.max(aiConfidence / 100, 0), 1);
  const statisticalWeight = 1 - aiWeight;
  
  // Calcular média ponderada
  const combined = (aiProb * aiWeight) + (statisticalProb * statisticalWeight);
  
  // Limitar entre 15% e 95%
  return Math.min(Math.max(combined, 15), 95);
}

export function performAnalysis(data: MatchData, aiProbability?: number | null, aiConfidence?: number | null): AnalysisResult {
  // NOVO ALGORITMO SIMPLIFICADO: Baseado apenas em estatísticas globais disponíveis
  
  // 1. Obter Over 1.5% de cada time (dado mais importante)
  const homeOver15Freq = data.homeOver15Freq || 0;
  const awayOver15Freq = data.awayOver15Freq || 0;
  
  // 2. Obter média da competição (baseline importante)
  const competitionAvg = data.competitionAvg || 0;
  
  // 3. Calcular média total de gols (avgTotal de ambos times)
  const homeAvgTotal = data.homeTeamStats?.gols?.global?.avgTotal || 0;
  const awayAvgTotal = data.awayTeamStats?.gols?.global?.avgTotal || 0;
  const avgTotal = (homeAvgTotal + awayAvgTotal) / 2;
  
  // 4. Calcular médias de cleanSheet e noGoals
  const homeCleanSheet = data.homeTeamStats?.gols?.global?.cleanSheetPct || 0;
  const awayCleanSheet = data.awayTeamStats?.gols?.global?.cleanSheetPct || 0;
  const avgCleanSheet = (homeCleanSheet + awayCleanSheet) / 2;
  
  const homeNoGoals = data.homeTeamStats?.gols?.global?.noGoalsPct || 0;
  const awayNoGoals = data.awayTeamStats?.gols?.global?.noGoalsPct || 0;
  const avgNoGoals = (homeNoGoals + awayNoGoals) / 2;
  
  // 5. Calcular média de Over 2.5% (confirma tendência ofensiva)
  const homeOver25 = data.homeTeamStats?.gols?.global?.over25Pct || 0;
  const awayOver25 = data.awayTeamStats?.gols?.global?.over25Pct || 0;
  const avgOver25 = (homeOver25 + awayOver25) / 2;
  
  // 6. Aplicar fórmula ponderada baseada nos dados disponíveis
  // Peso: Over 1.5% (50%), Competição (30%), Ajuste por Média Total (20%)
  // Base: média ponderada de Over 1.5% dos times e competição
  let prob = (homeOver15Freq * 0.25) + (awayOver15Freq * 0.25) + (competitionAvg * 0.50);
  
  // Ajuste baseado em média total de gols (converte média de gols em probabilidade aproximada)
  // Se média total é alta, aumenta probabilidade; se baixa, diminui
  if (avgTotal > 2.5) {
    prob += 8; // Média alta indica mais gols
  } else if (avgTotal > 2.0) {
    prob += 4;
  } else if (avgTotal < 1.8) {
    prob -= 5; // Média baixa indica menos gols
  } else if (avgTotal < 1.5) {
    prob -= 8;
  }
  
  // Ajuste baseado em clean sheet (defesas muito boas reduzem probabilidade)
  if (avgCleanSheet > 50) {
    prob -= 8;
  } else if (avgCleanSheet > 40) {
    prob -= 4;
  }
  
  // Ajuste baseado em jogos sem marcar (ataques fracos reduzem probabilidade)
  if (avgNoGoals > 30) {
    prob -= 5;
  } else if (avgNoGoals > 20) {
    prob -= 2;
  }
  
  // Ajuste baseado em Over 2.5% (confirma tendência ofensiva)
  if (avgOver25 > 60) {
    prob += 3;
  } else if (avgOver25 > 50) {
    prob += 1;
  }
  
  // Se não temos dados suficientes, usar apenas média da competição como baseline
  if (homeOver15Freq === 0 && awayOver15Freq === 0 && competitionAvg > 0) {
    prob = competitionAvg;
  }
  
  // Limitar entre 15% e 95% (mais realista)
  prob = Math.min(Math.max(prob, 15), 95);
  
  // Calcular Poisson para visualização (usando médias de gols se disponíveis)
  const homeGoalsScored = data.homeTeamStats?.gols?.global?.avgScored || 1.0;
  const homeGoalsConceded = data.homeTeamStats?.gols?.global?.avgConceded || 1.0;
  const awayGoalsScored = data.awayTeamStats?.gols?.global?.avgScored || 1.0;
  const awayGoalsConceded = data.awayTeamStats?.gols?.global?.avgConceded || 1.0;
  
  const lambdaHome = (homeGoalsScored + awayGoalsConceded) / 2;
  const lambdaAway = (awayGoalsScored + homeGoalsConceded) / 2;
  
  const pHome: number[] = [];
  const pAway: number[] = [];
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHome));
    pAway.push(poissonProbability(i, lambdaAway));
  }
  
  // Cálculo de EV: (Probabilidade * Odd) - 100
  let ev = 0;
  if (data.oddOver15 && data.oddOver15 > 1) {
    ev = ((prob / 100) * data.oddOver15 - 1) * 100;
  }
  
  // Métricas avançadas simplificadas
  const offensiveVolume = Math.min(100, (avgTotal / 3) * 100);
  const defensiveLeaking = Math.min(100, ((homeGoalsConceded + awayGoalsConceded) / 2) * 50);
  const bttsCorrelation = 100 - avgCleanSheet;
  const formTrend = 0; // Não temos mais histórico para calcular tendência
  
  // Score de confiança baseado na qualidade dos dados disponíveis
  let confidence = 50; // Base
  if (homeOver15Freq > 0 && awayOver15Freq > 0) confidence += 20;
  if (competitionAvg > 0) confidence += 15;
  if (avgTotal > 0) confidence += 15;
  confidence = Math.min(100, confidence);
  
  // Calcular probabilidade combinada se IA disponível
  const combinedProb = combineProbabilities(prob, aiProbability ?? null, aiConfidence ?? null);
  
  // Usar probabilidade combinada para cálculos de risco e recomendações
  const finalProb = combinedProb;
  
  let riskLevel: AnalysisResult['riskLevel'] = 'Moderado';
  if (finalProb > 88) riskLevel = 'Baixo';
  else if (finalProb > 78) riskLevel = 'Moderado';
  else if (finalProb > 68) riskLevel = 'Alto';
  else riskLevel = 'Muito Alto';

  // Recalcular EV com probabilidade combinada se odd disponível
  let finalEv = ev;
  if (data.oddOver15 && data.oddOver15 > 1) {
    finalEv = ((finalProb / 100) * data.oddOver15 - 1) * 100;
  }

  return {
    probabilityOver15: prob, // Probabilidade estatística pura
    aiProbability: aiProbability ?? null, // Probabilidade da IA
    combinedProbability: combinedProb, // Probabilidade final combinada
    confidenceScore: confidence,
    poissonHome: pHome,
    poissonAway: pAway,
    riskLevel,
    ev: finalEv,
    verdict: finalProb > 80 ? "ALTA CONFIANÇA EM GOLS" : finalProb > 70 ? "CENÁRIO FAVORÁVEL" : "JOGO TRANCADO",
    recommendation: finalProb > 82 
      ? "Entrada recomendada pré-live ou Over 1.0 HT no minuto 15." 
      : "Aguarde o Live. Só entre se houver 3 chutes a gol nos primeiros 10 minutos.",
    advancedMetrics: {
      offensiveVolume,
      defensiveLeaking,
      bttsCorrelation,
      formTrend
    }
  };
}
