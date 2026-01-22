import { MatchData, AnalysisResult, CompetitionComplementAverages } from '../types';

/**
 * Função sigmoid suavizada para ajustes progressivos
 * Retorna valor entre -1 e 1 baseado na entrada normalizada
 */
function smoothAdjustment(value: number, threshold: number, strength: number): number {
  // Normalizar valor em relação ao threshold
  const normalized = (value - threshold) / threshold;
  // Aplicar sigmoid: 1 / (1 + e^(-x * strength))
  const sigmoid = 1 / (1 + Math.exp(-normalized * strength));
  // Mapear de [0,1] para [-strength, strength]
  return (sigmoid - 0.5) * 2 * strength;
}

/**
 * Função para suavizar limites usando sigmoid em vez de clamp rígido
 * Retorna valor entre min e max com transição suave
 */
function smoothClamp(value: number, min: number, max: number): number {
  if (value <= min) return min;
  if (value >= max) return max;

  // Aplicar sigmoid suave nas bordas (últimos 5% de cada extremo)
  const range = max - min;
  const edgeSize = range * 0.05;

  if (value < min + edgeSize) {
    // Transição suave no limite inferior
    const t = (value - min) / edgeSize;
    const sigmoid = 1 / (1 + Math.exp(-(t - 0.5) * 10));
    return min + sigmoid * edgeSize;
  } else if (value > max - edgeSize) {
    // Transição suave no limite superior
    const t = (value - (max - edgeSize)) / edgeSize;
    const sigmoid = 1 / (1 + Math.exp(-(t - 0.5) * 10));
    return max - edgeSize + sigmoid * edgeSize;
  }

  return value;
}

function poissonProbability(k: number, lambda: number): number {
  const exp = Math.exp(-lambda);
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * exp) / factorial;
}

/**
 * Calcula probabilidade acumulada de Poisson (P(X <= k))
 */
function poissonCumulative(k: number, lambda: number): number {
  let cumulative = 0;
  for (let i = 0; i <= k; i++) {
    cumulative += poissonProbability(i, lambda);
  }
  return cumulative;
}

/**
 * Calcula probabilidades Over/Under para múltiplas linhas usando distribuição Poisson
 * @param lambdaTotal - Média total de gols esperados no jogo (lambdaHome + lambdaAway)
 * @returns Objeto com probabilidades Over/Under para linhas 0.5, 1.5, 2.5, 3.5, 4.5, 5.5
 */
function calculateOverUnderProbabilities(lambdaTotal: number): {
  [line: string]: { over: number; under: number };
} {
  const probabilities: { [line: string]: { over: number; under: number } } = {};
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

  for (const line of lines) {
    const k = Math.floor(line);
    const underProb = poissonCumulative(k, lambdaTotal);
    const overProb = 1 - underProb;
    
    probabilities[line.toString()] = {
      over: Math.max(0, Math.min(100, overProb * 100)),
      under: Math.max(0, Math.min(100, underProb * 100)),
    };
  }
  return probabilities;
}

/**
 * Combina probabilidades Over/Under das estatísticas e da tabela usando pesos ponderados
 */
function combineOverUnderProbabilities(
  statsOverUnder: { [line: string]: { over: number; under: number } } | undefined,
  tableOverUnder: { [line: string]: { over: number; under: number } } | undefined,
  statsWeight: number,
  tableWeight: number
): { [line: string]: { over: number; under: number } } {
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
  const combined: { [line: string]: { over: number; under: number } } = {};

  for (const line of lines) {
    const lineKey = line.toString();
    const statsProb = statsOverUnder?.[lineKey];
    const tableProb = tableOverUnder?.[lineKey];

    if (statsProb && tableProb) {
      combined[lineKey] = {
        over: Math.max(0, Math.min(100, statsProb.over * statsWeight + tableProb.over * tableWeight)),
        under: Math.max(0, Math.min(100, statsProb.under * statsWeight + tableProb.under * tableWeight)),
      };
    } else if (statsProb) {
      combined[lineKey] = { ...statsProb };
    } else if (tableProb) {
      combined[lineKey] = { ...tableProb };
    } else {
      combined[lineKey] = { over: 50, under: 50 };
    }
  }
  return combined;
}

/**
 * Combina estatísticas home, away e global com pesos adaptativos
 */
function getWeightedTeamStats(
  home: any,
  away: any,
  global: any,
  context: 'home' | 'away'
) {
  const homeWeight = context === 'home' ? 0.5 : 0.3;
  const awayWeight = context === 'away' ? 0.5 : 0.3;
  const globalWeight = 0.3;

  const hasHome = home.avgScored > 0 || home.avgConceded > 0;
  const hasAway = away.avgScored > 0 || away.avgConceded > 0;
  const hasGlobal = global.avgScored > 0 || global.avgConceded > 0;

  let adjustedHomeWeight = hasHome ? homeWeight : 0;
  let adjustedAwayWeight = hasAway ? awayWeight : 0;
  let adjustedGlobalWeight = hasGlobal ? globalWeight : 0;

  const totalWeight = (adjustedHomeWeight + adjustedAwayWeight + adjustedGlobalWeight) || 1;

  return {
    avgScored: (home.avgScored * adjustedHomeWeight + away.avgScored * adjustedAwayWeight + global.avgScored * adjustedGlobalWeight) / totalWeight,
    avgConceded: (home.avgConceded * adjustedHomeWeight + away.avgConceded * adjustedAwayWeight + global.avgConceded * adjustedGlobalWeight) / totalWeight,
    avgTotal: (home.avgTotal * adjustedHomeWeight + away.avgTotal * adjustedAwayWeight + global.avgTotal * adjustedGlobalWeight) / totalWeight,
    cleanSheetPct: (home.cleanSheetPct * adjustedHomeWeight + away.cleanSheetPct * adjustedAwayWeight + global.cleanSheetPct * adjustedGlobalWeight) / totalWeight,
    noGoalsPct: (home.noGoalsPct * adjustedHomeWeight + away.noGoalsPct * adjustedAwayWeight + global.noGoalsPct * adjustedGlobalWeight) / totalWeight,
    over25Pct: (home.over25Pct * adjustedHomeWeight + away.over25Pct * adjustedAwayWeight + global.over25Pct * adjustedGlobalWeight) / totalWeight,
    under25Pct: (home.under25Pct * adjustedHomeWeight + away.under25Pct * adjustedAwayWeight + global.under25Pct * adjustedGlobalWeight) / totalWeight,
  };
}

/**
 * Calcula força ofensiva e defensiva do oponente
 */
function calculateOpponentStrength(opponentStats: any, opponentTableData?: any) {
  let offensiveStrength = opponentStats.avgScored > 0 ? Math.min(1, opponentStats.avgScored / 3) : 0;
  if (opponentStats.over25Pct > 0) {
    offensiveStrength = Math.min(1, offensiveStrength + Math.min(0.2, opponentStats.over25Pct / 100));
  }

  let defensiveStrength = opponentStats.avgConceded > 0 ? Math.max(0, 1 - (opponentStats.avgConceded / 2)) : 0;
  if (opponentStats.cleanSheetPct > 0) {
    defensiveStrength = Math.min(1, defensiveStrength + Math.min(0.2, opponentStats.cleanSheetPct / 100));
  }

  if (opponentTableData && opponentTableData.MP > 0) {
    const mp = parseFloat(opponentTableData.MP);
    const tableOffensive = Math.min(1, (parseFloat(opponentTableData.GF) / mp) / 3);
    const tableDefensive = Math.max(0, 1 - (parseFloat(opponentTableData.GA) / mp) / 2);
    offensiveStrength = offensiveStrength * 0.7 + tableOffensive * 0.3;
    defensiveStrength = defensiveStrength * 0.7 + tableDefensive * 0.3;
  }

  return { offensiveStrength, defensiveStrength };
}

/**
 * Calcula momentum (tendência recente)
 */
function calculateMomentum(recentHistory: any[], avgScored: number, avgConceded: number, isHomeTeam: boolean = true) {
  if (!recentHistory || recentHistory.length === 0) return { offensiveMomentum: 0, defensiveMomentum: 0 };
  const recentGames = recentHistory.slice(0, 5);
  const weight = recentGames.length <= 3 ? 1.0 : 0.8;
  let recentScored = 0;
  let recentConceded = 0;
  for (const match of recentGames) {
    if (isHomeTeam) {
      recentScored += match.homeScore;
      recentConceded += match.awayScore;
    } else {
      recentScored += match.awayScore;
      recentConceded += match.homeScore;
    }
  }
  recentScored /= recentGames.length;
  recentConceded /= recentGames.length;
  return {
    offensiveMomentum: avgScored > 0 ? Math.max(-1, Math.min(1, ((recentScored - avgScored) / avgScored) * weight)) : 0,
    defensiveMomentum: avgConceded > 0 ? Math.max(-1, Math.min(1, ((avgConceded - recentConceded) / avgConceded) * weight)) : 0
  };
}

/**
 * Valida consistência entre dados
 */
function validateStatsConsistency(home: any, away: any, global: any) {
  const scoredDiff = Math.abs(global.avgScored - (home.avgScored + away.avgScored) / 2);
  const concededDiff = Math.abs(global.avgConceded - (home.avgConceded + away.avgConceded) / 2);
  return {
    consistencyScore: (Math.max(0, 1 - (scoredDiff / 0.3)) + Math.max(0, 1 - (concededDiff / 0.3))) / 2,
    hasSignificantDivergence: scoredDiff > 0.5 || concededDiff > 0.5
  };
}

export function calculateStatisticsProbability(data: MatchData) {
  if (!data.homeTeamStats || !data.awayTeamStats) return null;
  const hWS = getWeightedTeamStats(data.homeTeamStats.gols.home, data.homeTeamStats.gols.away, data.homeTeamStats.gols.global, 'home');
  const aWS = getWeightedTeamStats(data.awayTeamStats.gols.home, data.awayTeamStats.gols.away, data.awayTeamStats.gols.global, 'away');
  let lambdaHome = (hWS.avgScored + aWS.avgConceded) / 2 || 1.0;
  let lambdaAway = (aWS.avgScored + hWS.avgConceded) / 2 || 1.0;
  const hOpp = calculateOpponentStrength(aWS, data.awayTableData);
  const aOpp = calculateOpponentStrength(hWS, data.homeTableData);
  lambdaHome *= (1 - hOpp.defensiveStrength * 0.1);
  lambdaAway *= (1 - aOpp.defensiveStrength * 0.1);
  const lambdaTotal = lambdaHome + lambdaAway;
  const over15Prob = 1 - poissonCumulative(1, lambdaTotal);
  return {
    probability: Math.max(10, Math.min(98, over15Prob * 100)),
    lambdaTotal,
    lambdaHome,
    lambdaAway,
    overUnderProbabilities: calculateOverUnderProbabilities(lambdaTotal),
  };
}

export function calculateTableProbability(data: MatchData) {
  if (!data.homeTableData || !data.awayTableData) return null;
  const hMp = parseFloat(data.homeTableData.MP || '1');
  const aMp = parseFloat(data.awayTableData.MP || '1');
  const lHome = (parseFloat(data.homeTableData.GF || '0') / hMp + parseFloat(data.awayTableData.GA || '0') / aMp) / 2;
  const lAway = (parseFloat(data.awayTableData.GF || '0') / aMp + parseFloat(data.homeTableData.GA || '0') / hMp) / 2;
  const lTotal = lHome + lAway;
  return {
    probability: (1 - poissonCumulative(1, lTotal)) * 100,
    lambdaTotal: lTotal,
    lambdaHome: lHome,
    lambdaAway: lAway,
    overUnderProbabilities: calculateOverUnderProbabilities(lTotal),
  };
}

export function performAnalysis(data: MatchData): AnalysisResult {
  const statsRes = calculateStatisticsProbability(data);
  const tableRes = calculateTableProbability(data);
  const finalProb = ((statsRes?.probability || 50) * 0.5) + ((tableRes?.probability || 50) * 0.5);

  return {
    probabilityOver15: statsRes?.probability || 0,
    tableProbability: tableRes?.probability || 0,
    combinedProbability: finalProb,
    confidenceScore: finalProb,
    poissonHome: statsRes?.lambdaHome || 0,
    poissonAway: statsRes?.lambdaAway || 0,
    verdict: finalProb > 75 ? 'ALTA CONFIANÇA' : 'MÉDIA CONFIANÇA',
    overUnderProbabilities: statsRes?.overUnderProbabilities || {},
    advancedMetrics: {
      formTrend: finalProb > 50 ? 'up' : 'down'
    }
  } as any;
}
