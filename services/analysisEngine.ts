
import { MatchData, AnalysisResult, RecentMatch } from '../types';

function poissonProbability(k: number, lambda: number): number {
  const exp = Math.exp(-lambda);
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * exp) / factorial;
}

function calculateFormTrend(history: RecentMatch[]): number {
  if (history.length === 0) return 0;
  let overCount = 0;
  history.forEach(m => {
    if ((m.homeScore + m.awayScore) >= 2) overCount++;
  });
  const ratio = overCount / history.length;
  return (ratio - 0.5) * 10;
}

export function performAnalysis(data: MatchData): AnalysisResult {
  // FASE 1: Usar desempenho casa/fora se disponível, senão usar médias gerais
  const homeGoalsScored = data.homeGoalsScoredAtHome ?? data.homeGoalsScoredAvg;
  const homeGoalsConceded = data.homeGoalsConcededAtHome ?? data.homeGoalsConcededAvg;
  const awayGoalsScored = data.awayGoalsScoredAway ?? data.awayGoalsScoredAvg;
  const awayGoalsConceded = data.awayGoalsConcededAway ?? data.awayGoalsConcededAvg;
  
  // FASE 1: Incorporar xA na estimativa de ataque (complementa xG)
  const homeXGWithXA = data.homeXG + (data.homeXA ?? 0) * 0.3; // xA contribui 30% do peso do xG
  const awayXGWithXA = data.awayXG + (data.awayXA ?? 0) * 0.3;
  
  // FASE 1: Ajustar ataque baseado em passes progressivos/chave
  let homeAttackBoost = 0;
  let awayAttackBoost = 0;
  if (data.homeProgressivePasses && data.homeKeyPasses) {
    homeAttackBoost = (data.homeProgressivePasses / 100) * 0.1 + (data.homeKeyPasses / 10) * 0.15;
  }
  if (data.awayProgressivePasses && data.awayKeyPasses) {
    awayAttackBoost = (data.awayProgressivePasses / 100) * 0.1 + (data.awayKeyPasses / 10) * 0.15;
  }
  
  const homeAttack = (homeGoalsScored * 0.4) + (homeXGWithXA * 0.6) + homeAttackBoost;
  const awayDefense = (awayGoalsConceded * 0.5) + (homeXGWithXA * 0.5); // Defesa do visitante = gols sofridos + xG do mandante
  const awayAttack = (awayGoalsScored * 0.4) + (awayXGWithXA * 0.6) + awayAttackBoost;
  const homeDefense = (homeGoalsConceded * 0.5) + (awayXGWithXA * 0.5); // Defesa do mandante = gols sofridos + xG do visitante

  const lambdaHome = (homeAttack + awayDefense) / 2;
  const lambdaAway = (awayAttack + homeDefense) / 2;

  const pHome: number[] = [];
  const pAway: number[] = [];
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHome));
    pAway.push(poissonProbability(i, lambdaAway));
  }

  const pUnder15 = (pHome[0] * pAway[0]) + (pHome[1] * pAway[0]) + (pHome[0] * pAway[1]);
  let prob = (1 - pUnder15) * 100;

  const totalShotsOnTarget = data.homeShotsOnTarget + data.awayShotsOnTarget;
  if (totalShotsOnTarget > 10) prob += 5;
  if (totalShotsOnTarget < 6) prob -= 5;

  const avgBTTS = (data.homeBTTSFreq + data.awayBTTSFreq) / 2;
  if (avgBTTS > 65) prob += 4;

  const avgCleanSheet = (data.homeCleanSheetFreq + data.awayCleanSheetFreq) / 2;
  if (avgCleanSheet > 40) prob -= 6;

  const homeTrend = calculateFormTrend(data.homeHistory);
  const awayTrend = calculateFormTrend(data.awayHistory);
  const totalTrend = homeTrend + awayTrend;
  prob += totalTrend;

  // FASE 1: Usar H2H detalhado se disponível
  let h2hWeight = data.h2hOver15Freq;
  if (data.h2hAvgGoals !== undefined) {
    // Ajustar baseado na média de gols H2H
    const h2hGoalBasedProb = Math.min(95, Math.max(5, (data.h2hAvgGoals - 0.5) * 50));
    h2hWeight = (h2hWeight * 0.6) + (h2hGoalBasedProb * 0.4);
  }
  if (data.h2hMatches && data.h2hMatches.length > 0) {
    // Calcular tendência dos últimos H2H
    const recentH2HOver = data.h2hMatches.filter(m => m.totalGoals >= 2).length / data.h2hMatches.length;
    const h2hTrendProb = recentH2HOver * 100;
    h2hWeight = (h2hWeight * 0.5) + (h2hTrendProb * 0.5);
  }
  
  const historicalOver = (data.homeOver15Freq + data.awayOver15Freq + h2hWeight) / 3;
  prob = (prob * 0.65) + (historicalOver * 0.35);

  prob = Math.min(Math.max(prob, 2), 98);

  // Cálculo de EV: (Probabilidade * Odd) - 100
  let ev = 0;
  if (data.oddOver15 && data.oddOver15 > 1) {
    ev = ((prob / 100) * data.oddOver15 - 1) * 100;
  }

  const offensiveVolume = (totalShotsOnTarget / 12) * 100;
  const defensiveLeaking = ((data.homeGoalsConcededAvg + data.awayGoalsConcededAvg) / 3) * 100;

  const confidence = Math.min(100, 40 + (totalShotsOnTarget * 3) + (historicalOver / 4) + (data.homeHistory.length * 2));

  let riskLevel: AnalysisResult['riskLevel'] = 'Moderado';
  if (prob > 88) riskLevel = 'Baixo';
  else if (prob > 78) riskLevel = 'Moderado';
  else if (prob > 68) riskLevel = 'Alto';
  else riskLevel = 'Muito Alto';

  return {
    probabilityOver15: prob,
    confidenceScore: confidence,
    poissonHome: pHome,
    poissonAway: pAway,
    riskLevel,
    ev,
    verdict: prob > 80 ? "ALTA CONFIANÇA EM GOLS" : prob > 70 ? "CENÁRIO FAVORÁVEL" : "JOGO TRANCADO",
    recommendation: prob > 82 
      ? "Entrada recomendada pré-live ou Over 1.0 HT no minuto 15." 
      : "Aguarde o Live. Só entre se houver 3 chutes a gol nos primeiros 10 minutos.",
    advancedMetrics: {
      offensiveVolume,
      defensiveLeaking,
      bttsCorrelation: avgBTTS,
      formTrend: totalTrend
    }
  };
}
