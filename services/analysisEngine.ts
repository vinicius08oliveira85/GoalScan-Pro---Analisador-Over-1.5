
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
  // MODELO SIMPLIFICADO: Priorizar estatísticas globais dos últimos 10 jogos
  // Se não disponível, usar estatísticas específicas (home/away) ou fallback para médias gerais
  let homeGoalsScored: number;
  let homeGoalsConceded: number;
  let awayGoalsScored: number;
  let awayGoalsConceded: number;

  if (data.homeTeamStats?.gols?.global?.avgScored) {
    // Usar estatísticas globais (últimos 10 jogos)
    homeGoalsScored = data.homeTeamStats.gols.global.avgScored;
    homeGoalsConceded = data.homeTeamStats.gols.global.avgConceded;
  } else if (data.homeTeamStats?.gols?.home?.avgScored) {
    // Fallback para estatísticas em casa
    homeGoalsScored = data.homeTeamStats.gols.home.avgScored;
    homeGoalsConceded = data.homeTeamStats.gols.home.avgConceded;
  } else {
    // Fallback para modelo antigo
    homeGoalsScored = data.homeGoalsScoredAtHome ?? data.homeGoalsScoredAvg;
    homeGoalsConceded = data.homeGoalsConcededAtHome ?? data.homeGoalsConcededAvg;
  }

  if (data.awayTeamStats?.gols?.global?.avgScored) {
    // Usar estatísticas globais (últimos 10 jogos)
    awayGoalsScored = data.awayTeamStats.gols.global.avgScored;
    awayGoalsConceded = data.awayTeamStats.gols.global.avgConceded;
  } else if (data.awayTeamStats?.gols?.away?.avgScored) {
    // Fallback para estatísticas fora
    awayGoalsScored = data.awayTeamStats.gols.away.avgScored;
    awayGoalsConceded = data.awayTeamStats.gols.away.avgConceded;
  } else {
    // Fallback para modelo antigo
    awayGoalsScored = data.awayGoalsScoredAway ?? data.awayGoalsScoredAvg;
    awayGoalsConceded = data.awayGoalsConcededAway ?? data.awayGoalsConcededAvg;
  }
  
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

  // Usar percentuais de clean sheet das estatísticas globais (ou fallback)
  let avgCleanSheet: number;
  if (data.homeTeamStats?.gols?.global?.cleanSheetPct && data.awayTeamStats?.gols?.global?.cleanSheetPct) {
    avgCleanSheet = (data.homeTeamStats.gols.global.cleanSheetPct + data.awayTeamStats.gols.global.cleanSheetPct) / 2;
  } else if (data.homeTeamStats?.gols?.home?.cleanSheetPct && data.awayTeamStats?.gols?.away?.cleanSheetPct) {
    avgCleanSheet = (data.homeTeamStats.gols.home.cleanSheetPct + data.awayTeamStats.gols.away.cleanSheetPct) / 2;
  } else {
    avgCleanSheet = (data.homeCleanSheetFreq + data.awayCleanSheetFreq) / 2;
  }
  if (avgCleanSheet > 40) prob -= 6;

  // BTTS: Calcular a partir de clean sheet (se não sofreu, não teve BTTS)
  const avgBTTS = 100 - avgCleanSheet;
  if (avgBTTS > 65) prob += 4;

  // Usar sequências de percurso para ajustar probabilidade (se disponível)
  let percursoAdjustment = 0;
  if (data.homeTeamStats?.percurso?.global && data.awayTeamStats?.percurso?.global) {
    // Ajuste baseado em sequências globais
    if (data.homeTeamStats.percurso.global.winStreak >= 3) percursoAdjustment += 2;
    if (data.homeTeamStats.percurso.global.withoutLoss >= 5) percursoAdjustment += 1.5;
    if (data.homeTeamStats.percurso.global.withoutWin >= 3) percursoAdjustment -= 2;
    
    if (data.awayTeamStats.percurso.global.winStreak >= 3) percursoAdjustment += 1.5;
    if (data.awayTeamStats.percurso.global.withoutLoss >= 5) percursoAdjustment += 1;
    if (data.awayTeamStats.percurso.global.withoutWin >= 3) percursoAdjustment -= 1.5;
  } else if (data.homeTeamStats?.percurso?.home && data.awayTeamStats?.percurso?.away) {
    // Fallback para percurso específico (casa/fora)
    if (data.homeTeamStats.percurso.home.winStreak >= 3) percursoAdjustment += 2;
    if (data.homeTeamStats.percurso.home.withoutLoss >= 5) percursoAdjustment += 1.5;
    if (data.homeTeamStats.percurso.home.withoutWin >= 3) percursoAdjustment -= 2;
    
    if (data.awayTeamStats.percurso.away.winStreak >= 3) percursoAdjustment += 1.5;
    if (data.awayTeamStats.percurso.away.withoutLoss >= 5) percursoAdjustment += 1;
    if (data.awayTeamStats.percurso.away.withoutWin >= 3) percursoAdjustment -= 1.5;
  }
  
  // Manter cálculo de tendência do histórico antigo como fallback
  const homeTrend = calculateFormTrend(data.homeHistory);
  const awayTrend = calculateFormTrend(data.awayHistory);
  const totalTrend = homeTrend + awayTrend;
  prob += totalTrend + percursoAdjustment;

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
  
  // Usar Over 1.5% das estatísticas globais (ou Over 2.5% convertido, ou fallback)
  let homeOverFreq: number;
  let awayOverFreq: number;
  
  // Priorizar Over 1.5% direto das estatísticas globais (se disponível via homeOver15Freq/awayOver15Freq)
  // Ou converter Over 2.5% para Over 1.5%
  if (data.homeTeamStats?.gols?.global?.over25Pct !== undefined && data.awayTeamStats?.gols?.global?.over25Pct !== undefined) {
    // Converter Over 2.5 para Over 1.5 (aproximação: Over 1.5 é ~20-30% maior que Over 2.5)
    homeOverFreq = Math.min(100, data.homeTeamStats.gols.global.over25Pct * 1.25);
    awayOverFreq = Math.min(100, data.awayTeamStats.gols.global.over25Pct * 1.25);
  } else if (data.homeTeamStats?.gols?.home?.over25Pct !== undefined && data.awayTeamStats?.gols?.away?.over25Pct !== undefined) {
    // Fallback para Over 2.5% específico (casa/fora)
    homeOverFreq = Math.min(100, data.homeTeamStats.gols.home.over25Pct * 1.25);
    awayOverFreq = Math.min(100, data.awayTeamStats.gols.away.over25Pct * 1.25);
  } else {
    // Usar campos diretos de frequência Over 1.5
    homeOverFreq = data.homeOver15Freq;
    awayOverFreq = data.awayOver15Freq;
  }
  
  const historicalOver = (homeOverFreq + awayOverFreq + h2hWeight) / 3;
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
