
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
  const homeAttack = (data.homeGoalsScoredAvg * 0.4) + (data.homeXG * 0.6);
  const awayDefense = (data.awayGoalsConcededAvg * 0.5) + (data.awayXG * 0.5);
  const awayAttack = (data.awayGoalsScoredAvg * 0.4) + (data.awayXG * 0.6);
  const homeDefense = (data.homeGoalsConcededAvg * 0.5) + (data.homeXG * 0.5);

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

  const historicalOver = (data.homeOver15Freq + data.awayOver15Freq + data.h2hOver15Freq) / 3;
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
