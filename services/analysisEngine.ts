import {
  MatchData,
  AnalysisResult,
  CompetitionComplementAverages,
  TableRowGeral,
  RecentMatch,
} from '../types';
import { stripImportExtrasFromRow } from '../utils/leagueStandingJson';
import { calculateEVPercent } from '../utils/evDecimal';
import {
  blendAttackRate,
  blendHistoricWithFormSnapshot,
  finishingLambdaFactor,
  normalizeGolsStatsSlice,
  resolveGlobalGolsSlice,
  volumeOffenseFactor,
  weightedRecentGoalsPerGame,
  xgFinishDelta,
} from './matchDataSignals';

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

/** Rho típico em futebol (Dixon–Coles): correlação negativa em placares baixos. */
const DIXON_COLES_RHO_DEFAULT = -0.13;

/**
 * Fator tau(i,j) de Dixon–Coles para placares baixos (i,j ∈ {0,1}).
 * @see Dixon & Coles (1997)
 */
function dixonColesTau(i: number, j: number, lambdaHome: number, lambdaAway: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (i === 1 && j === 0) return 1 + lambdaHome * rho;
  if (i === 0 && j === 1) return 1 + lambdaAway * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

function dixonColesJointScoreProbability(
  i: number,
  j: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  const base = poissonProbability(i, lambdaHome) * poissonProbability(j, lambdaAway);
  const tau = dixonColesTau(i, j, lambdaHome, lambdaAway, rho);
  return Math.max(0, base * tau);
}

/**
 * Probabilidade de Under 1.5 (≤1 gol): P(0-0)+P(1-0)+P(0-1) com tau DC.
 * O termo 1-1 (2 gols) usa o mesmo tau em {@link dixonColesJointScoreProbability} para coerência do modelo em placares baixos.
 */
function calculateDixonColesUnder15(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = DIXON_COLES_RHO_DEFAULT
): number {
  const lh = Math.max(0, lambdaHome);
  const la = Math.max(0, lambdaAway);
  const p00 = dixonColesJointScoreProbability(0, 0, lh, la, rho);
  const p10 = dixonColesJointScoreProbability(1, 0, lh, la, rho);
  const p01 = dixonColesJointScoreProbability(0, 1, lh, la, rho);
  // 1-1: tau(1,1)=1−ρ — usar dixonColesJointScoreProbability(1,1,...) em extensões (ex.: BTTS bivariado)
  return Math.max(0, Math.min(1, p00 + p10 + p01));
}

/**
 * Calcula probabilidades Over/Under para múltiplas linhas usando Poisson **univariado** em T = gols totais.
 * Pressuposto: T ~ Poisson(λ_total) com λ_total = λ_home + λ_away (somas independentes).
 * Válido para linhas sobre **total de gols**; não substitui Dixon–Coles na linha 1.5 final (placares baixos).
 *
 * @param lambdaTotal - Média total de gols esperados no jogo (lambdaHome + lambdaAway)
 * @returns Objeto com probabilidades Over/Under para linhas 0.5, 1.5, 2.5, 3.5, 4.5, 5.5
 */
function calculateOverUnderProbabilities(lambdaTotal: number): {
  [line: string]: { over: number; under: number };
} {
  const probabilities: { [line: string]: { over: number; under: number } } = {};
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

  for (const line of lines) {
    // Para Over X.5: P(totalGols > X) = 1 - P(totalGols <= X)
    // Para Under X.5: P(totalGols <= X)
    const k = Math.floor(line); // Número inteiro de gols para calcular acumulada
    
    // Calcular probabilidade de Under (totalGols <= k)
    const underProb = poissonCumulative(k, lambdaTotal);
    
    // Calcular probabilidade de Over (totalGols > k)
    const overProb = 1 - underProb;
    
    // Converter para porcentagem e garantir valores válidos
    probabilities[line.toString()] = {
      over: Math.max(0, Math.min(100, overProb * 100)),
      under: Math.max(0, Math.min(100, underProb * 100)),
    };
  }

  return probabilities;
}

/**
 * Probabilidades 1X2 (casa, empate, fora) via Poisson independente para cada time, truncada em maxGoals.
 */
function calculateMatchOddsFromPoisson(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number = 10
): { home: number; draw: number; away: number } {
  const lh = Math.max(0, lambdaHome);
  const la = Math.max(0, lambdaAway);
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let i = 0; i <= maxGoals; i++) {
    const pi = poissonProbability(i, lh);
    for (let j = 0; j <= maxGoals; j++) {
      const pj = poissonProbability(j, la);
      const p = pi * pj;
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
    }
  }
  const sum = pHome + pDraw + pAway;
  if (sum <= 0) {
    return { home: 33.33, draw: 33.34, away: 33.33 };
  }
  return {
    home: (pHome / sum) * 100,
    draw: (pDraw / sum) * 100,
    away: (pAway / sum) * 100,
  };
}

/**
 * Combina probabilidades Over/Under das estatísticas e da tabela usando pesos ponderados
 * @param statsOverUnder - Probabilidades Over/Under baseadas nas estatísticas (últimos 10 jogos)
 * @param tableOverUnder - Probabilidades Over/Under baseadas na tabela (temporada completa)
 * @param statsWeight - Peso para as probabilidades das estatísticas (0-1)
 * @param tableWeight - Peso para as probabilidades da tabela (0-1)
 * @returns Probabilidades Over/Under combinadas para todas as linhas
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
      // Combinar usando os mesmos pesos
      combined[lineKey] = {
        over: Math.max(0, Math.min(100, statsProb.over * statsWeight + tableProb.over * tableWeight)),
        under: Math.max(0, Math.min(100, statsProb.under * statsWeight + tableProb.under * tableWeight)),
      };
    } else if (statsProb) {
      // Se só temos estatísticas, usar 100% delas
      combined[lineKey] = { ...statsProb };
    } else if (tableProb) {
      // Se só temos tabela, usar 100% dela
      combined[lineKey] = { ...tableProb };
    } else {
      // Fallback: valores padrão
      combined[lineKey] = { over: 50, under: 50   };
    }
  }

  return combined;
}

/**
 * Combina estatísticas home, away e global com pesos adaptativos baseados no contexto
 * Home: 50% peso (mais relevante para time da casa jogando em casa)
 * Away: 50% peso (mais relevante para visitante jogando fora)
 * Global: 30% peso (validação e contexto geral)
 * 
 * @param home - Estatísticas quando joga em casa
 * @param away - Estatísticas quando joga fora
 * @param global - Estatísticas globais (todos os jogos)
 * @param context - Contexto da partida: 'home' para time da casa, 'away' para visitante
 * @returns Estatísticas combinadas com pesos adaptativos
 */
function getWeightedTeamStats(
  home: { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number } | undefined,
  away: { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number } | undefined,
  global: { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number } | undefined,
  context: 'home' | 'away'
): { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number } {
  const h = normalizeGolsStatsSlice(home);
  const a = normalizeGolsStatsSlice(away);
  const g = resolveGlobalGolsSlice(h, a, global);

  // Pesos adaptativos baseados no contexto
  // Para time da casa: home tem mais peso
  // Para visitante: away tem mais peso
  const homeWeight = context === 'home' ? 0.5 : 0.3;
  const awayWeight = context === 'away' ? 0.5 : 0.3;
  const globalWeight = 0.3;

  // Verificar se dados estão disponíveis (não são todos zero)
  const hasHome = h.avgScored > 0 || h.avgConceded > 0;
  const hasAway = a.avgScored > 0 || a.avgConceded > 0;
  const hasGlobal = g.avgScored > 0 || g.avgConceded > 0;

  // Ajustar pesos se algum dado não estiver disponível
  let adjustedHomeWeight = homeWeight;
  let adjustedAwayWeight = awayWeight;
  let adjustedGlobalWeight = globalWeight;

  if (!hasHome) {
    adjustedHomeWeight = 0;
    // Redistribuir peso
    const remainingWeight = adjustedAwayWeight + adjustedGlobalWeight;
    if (remainingWeight > 0) {
      adjustedAwayWeight = (adjustedAwayWeight / remainingWeight) * (homeWeight + awayWeight + globalWeight);
      adjustedGlobalWeight = (adjustedGlobalWeight / remainingWeight) * (homeWeight + awayWeight + globalWeight);
    }
  }
  if (!hasAway) {
    adjustedAwayWeight = 0;
    const remainingWeight = adjustedHomeWeight + adjustedGlobalWeight;
    if (remainingWeight > 0) {
      adjustedHomeWeight = (adjustedHomeWeight / remainingWeight) * (homeWeight + awayWeight + globalWeight);
      adjustedGlobalWeight = (adjustedGlobalWeight / remainingWeight) * (homeWeight + awayWeight + globalWeight);
    }
  }
  if (!hasGlobal) {
    adjustedGlobalWeight = 0;
    const remainingWeight = adjustedHomeWeight + adjustedAwayWeight;
    if (remainingWeight > 0) {
      adjustedHomeWeight = (adjustedHomeWeight / remainingWeight) * (homeWeight + awayWeight + globalWeight);
      adjustedAwayWeight = (adjustedAwayWeight / remainingWeight) * (homeWeight + awayWeight + globalWeight);
    }
  }

  const adjustedTotalWeight = adjustedHomeWeight + adjustedAwayWeight + adjustedGlobalWeight;

  // Calcular média ponderada
  return {
    avgScored: ((h.avgScored * adjustedHomeWeight + a.avgScored * adjustedAwayWeight + g.avgScored * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    avgConceded: ((h.avgConceded * adjustedHomeWeight + a.avgConceded * adjustedAwayWeight + g.avgConceded * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    avgTotal: ((h.avgTotal * adjustedHomeWeight + a.avgTotal * adjustedAwayWeight + g.avgTotal * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    cleanSheetPct: ((h.cleanSheetPct * adjustedHomeWeight + a.cleanSheetPct * adjustedAwayWeight + g.cleanSheetPct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    noGoalsPct: ((h.noGoalsPct * adjustedHomeWeight + a.noGoalsPct * adjustedAwayWeight + g.noGoalsPct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    over25Pct: ((h.over25Pct * adjustedHomeWeight + a.over25Pct * adjustedAwayWeight + g.over25Pct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    under25Pct: ((h.under25Pct * adjustedHomeWeight + a.under25Pct * adjustedAwayWeight + g.under25Pct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
  };
}

/**
 * Calcula força ofensiva e defensiva do oponente para ajustar lambda
 * 
 * @param opponentStats - Estatísticas do oponente
 * @param opponentTableData - Dados da tabela do oponente (opcional)
 * @returns Força ofensiva e defensiva normalizadas (0-1)
 */
function calculateOpponentStrength(
  opponentStats: { avgScored: number; avgConceded: number; cleanSheetPct: number; over25Pct: number },
  opponentTableData?: TableRowGeral,
  tableSlice: OpponentTableSlice = 'aggregate'
): { offensiveStrength: number; defensiveStrength: number } {
  // Calcular força ofensiva baseada em gols marcados e over 2.5%
  let offensiveStrength = 0;
  if (opponentStats.avgScored > 0) {
    // Normalizar: 0 gols = 0, 3+ gols = 1
    offensiveStrength = Math.min(1, opponentStats.avgScored / 3);
  }
  // Ajustar baseado em over 2.5% (times ofensivos têm mais over 2.5)
  if (opponentStats.over25Pct > 0) {
    const over25Bonus = Math.min(0.2, opponentStats.over25Pct / 100);
    offensiveStrength = Math.min(1, offensiveStrength + over25Bonus);
  }

  // Calcular força defensiva baseada em gols sofridos e clean sheets
  let defensiveStrength = 0;
  if (opponentStats.avgConceded > 0) {
    // Normalizar: 0 gols sofridos = 1 (defesa perfeita), 2+ gols = 0 (defesa fraca)
    defensiveStrength = Math.max(0, 1 - (opponentStats.avgConceded / 2));
  }
  // Ajustar baseado em clean sheet % (defesas boas têm mais clean sheets)
  if (opponentStats.cleanSheetPct > 0) {
    const cleanSheetBonus = Math.min(0.2, opponentStats.cleanSheetPct / 100);
    defensiveStrength = Math.min(1, defensiveStrength + cleanSheetBonus);
  }

  if (opponentTableData) {
    const agg = isAggregateStandingRow(opponentTableData);
    let mp = 0;
    let gf = 0;
    let ga = 0;
    if (agg || tableSlice === 'aggregate') {
      mp = parseStandingCell(opponentTableData.MP);
      gf = parseStandingCell(opponentTableData.GF);
      ga = parseStandingCell(opponentTableData.GA);
    } else if (tableSlice === 'awaySlice') {
      mp = parseStandingCell(opponentTableData['Away MP'] || opponentTableData.MP);
      gf = parseStandingCell(opponentTableData['Away GF'] || opponentTableData.GF);
      ga = parseStandingCell(opponentTableData['Away GA'] || opponentTableData.GA);
    } else {
      mp = parseStandingCell(opponentTableData['Home MP'] || opponentTableData.MP);
      gf = parseStandingCell(opponentTableData['Home GF'] || opponentTableData.GF);
      ga = parseStandingCell(opponentTableData['Home GA'] || opponentTableData.GA);
    }

    if (mp > 0) {
      const tableOffensive = Math.min(1, (gf / mp) / 3);
      const tableDefensive = Math.max(0, 1 - (ga / mp) / 2);
      offensiveStrength = offensiveStrength * 0.7 + tableOffensive * 0.3;
      defensiveStrength = defensiveStrength * 0.7 + tableDefensive * 0.3;
    }
  }

  return {
    offensiveStrength: Math.max(0, Math.min(1, offensiveStrength)),
    defensiveStrength: Math.max(0, Math.min(1, defensiveStrength)),
  };
}

/**
 * Calcula momentum (tendência recente) baseado nos últimos jogos
 * 
 * @param recentHistory - Últimos jogos do time (homeScore/awayScore são gols do time analisado)
 * @param avgScored - Média histórica de gols marcados
 * @param avgConceded - Média histórica de gols sofridos
 * @param isHomeTeam - Se true, homeScore são gols do time; se false, awayScore são gols do time
 * @returns Momentum ofensivo e defensivo (-1 a 1, onde positivo = melhorando)
 */
function calculateMomentum(
  recentHistory: Array<{ homeScore: number; awayScore: number }>,
  avgScored: number,
  avgConceded: number,
  isHomeTeam: boolean = true
): { offensiveMomentum: number; defensiveMomentum: number } {
  if (!recentHistory || recentHistory.length === 0) {
    return { offensiveMomentum: 0, defensiveMomentum: 0 };
  }

  // Analisar últimos 3-5 jogos (priorizar últimos 3, mas considerar até 5)
  const recentGames = recentHistory.slice(0, Math.min(5, recentHistory.length));
  const weight = recentGames.length <= 3 ? 1.0 : 0.8; // Mais peso se temos poucos jogos

  // Calcular médias recentes
  let recentScored = 0;
  let recentConceded = 0;
  
  for (const match of recentGames) {
    // Para time da casa: homeScore são seus gols, awayScore são gols sofridos
    // Para visitante: awayScore são seus gols, homeScore são gols sofridos
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

  // Calcular momentum (diferença entre recente e histórico)
  // Normalizar para -1 a 1
  const offensiveMomentum = avgScored > 0 
    ? Math.max(-1, Math.min(1, ((recentScored - avgScored) / avgScored) * weight))
    : 0;
  
  const defensiveMomentum = avgConceded > 0
    ? Math.max(-1, Math.min(1, ((avgConceded - recentConceded) / avgConceded) * weight)) // Invertido: menos gols sofridos = melhor
    : 0;

  return { offensiveMomentum, defensiveMomentum };
}

/**
 * Valida consistência entre dados home/away/global
 * Retorna score de consistência (0-1) e flag indicando se há divergência significativa
 * 
 * @param home - Estatísticas home
 * @param away - Estatísticas away
 * @param global - Estatísticas global
 * @returns Score de consistência e flag de divergência
 */
function validateStatsConsistency(
  home: { avgScored: number; avgConceded: number } | undefined,
  away: { avgScored: number; avgConceded: number } | undefined,
  global?: { avgScored: number; avgConceded: number } | undefined | null
): { consistencyScore: number; hasSignificantDivergence: boolean } {
  const h = normalizeGolsStatsSlice(home);
  const a = normalizeGolsStatsSlice(away);
  const gFull = resolveGlobalGolsSlice(h, a, global);
  // Calcular médias esperadas
  const expectedHomeAvg = (h.avgScored + a.avgScored) / 2;
  const expectedAwayAvg = (h.avgConceded + a.avgConceded) / 2;

  // Comparar com dados global (ou proxy casa/fora)
  const scoredDiff = Math.abs(gFull.avgScored - expectedHomeAvg);
  const concededDiff = Math.abs(gFull.avgConceded - expectedAwayAvg);

  // Normalizar diferenças (tolerância de 0.3 gols = boa consistência)
  const scoredConsistency = Math.max(0, 1 - (scoredDiff / 0.3));
  const concededConsistency = Math.max(0, 1 - (concededDiff / 0.3));

  const consistencyScore = (scoredConsistency + concededConsistency) / 2;
  const hasSignificantDivergence = scoredDiff > 0.5 || concededDiff > 0.5;

  return { consistencyScore, hasSignificantDivergence };
}

/**
 * Calcula probabilidade Over 1.5 baseada apenas nas estatísticas dos últimos 10 jogos.
 * Usa homeTeamStats e awayTeamStats para calcular médias de gols e ajustar baseado em
 * clean sheets, no goals, over 2.5% e forma recente.
 *
 * @param data - Dados da partida incluindo homeTeamStats e awayTeamStats
 * @returns Objeto com probabilidade Over 1.5 e overUnderProbabilities, ou null se dados insuficientes
 */
function calculateStatisticsProbability(data: MatchData): {
  probability: number;
  lambdaTotal: number;
  lambdaHome: number;
  lambdaAway: number;
  overUnderProbabilities: { [line: string]: { over: number; under: number } };
} | null {
  const hasHomeTeamStats = !!data.homeTeamStats;
  const hasAwayTeamStats = !!data.awayTeamStats;

  // Se não temos estatísticas, retornar null
  if (!hasHomeTeamStats || !hasAwayTeamStats) {
    return null;
  }

  // 1. Usar função weighted para combinar home/away/global com pesos adaptativos
  const homeWeightedStats = getWeightedTeamStats(
    data.homeTeamStats.gols.home,
    data.homeTeamStats.gols.away,
    data.homeTeamStats.gols.global,
    'home' // Time da casa jogando em casa
  );

  const awayWeightedStats = getWeightedTeamStats(
    data.awayTeamStats.gols.home,
    data.awayTeamStats.gols.away,
    data.awayTeamStats.gols.global,
    'away' // Time visitante jogando fora
  );

  // Extrair médias de gols combinadas (já ponderadas) e misturar com últimos 3–5 jogos (peso 1,5× na forma recente)
  let homeAvgScored = homeWeightedStats.avgScored || 0;
  let homeAvgConceded = homeWeightedStats.avgConceded || 0;
  let awayAvgScored = awayWeightedStats.avgScored || 0;
  let awayAvgConceded = awayWeightedStats.avgConceded || 0;

  if (homeAvgScored === 0 && homeAvgConceded === 0 && awayAvgScored === 0 && awayAvgConceded === 0) {
    return null;
  }

  const homeRecBlend = blendWeightedWithRecentFive(
    homeAvgScored,
    homeAvgConceded,
    data.homeHistory || [],
    true
  );
  homeAvgScored = homeRecBlend.scored;
  homeAvgConceded = homeRecBlend.conceded;
  const homeRecencyActive = homeRecBlend.active;

  const awayRecBlend = blendWeightedWithRecentFive(
    awayAvgScored,
    awayAvgConceded,
    data.awayHistory || [],
    false
  );
  awayAvgScored = awayRecBlend.scored;
  awayAvgConceded = awayRecBlend.conceded;
  const awayRecencyActive = awayRecBlend.active;

  const histHomeScored = homeWeightedStats.avgScored || 0;
  const histAwayScored = awayWeightedStats.avgScored || 0;

  const homeFormPull =
    data.homeXG != null && data.homeXG > 0
      ? data.homeXG
      : data.homeGoalsScoredAtHome != null && data.homeGoalsScoredAtHome > 0
        ? data.homeGoalsScoredAtHome
        : histHomeScored;
  const awayFormPull =
    data.awayXG != null && data.awayXG > 0
      ? data.awayXG
      : data.awayGoalsScoredAway != null && data.awayGoalsScoredAway > 0
        ? data.awayGoalsScoredAway
        : histAwayScored;

  homeAvgScored = blendHistoricWithFormSnapshot(histHomeScored, homeFormPull);
  awayAvgScored = blendHistoricWithFormSnapshot(histAwayScored, awayFormPull);
  homeAvgScored = blendAttackRate(homeAvgScored, data.homeXG > 0 ? data.homeXG : 0);
  awayAvgScored = blendAttackRate(awayAvgScored, data.awayXG > 0 ? data.awayXG : 0);

  // 2. Validar consistência entre home/away/global
  const homeConsistency = validateStatsConsistency(
    data.homeTeamStats.gols.home,
    data.homeTeamStats.gols.away,
    data.homeTeamStats.gols.global
  );
  const awayConsistency = validateStatsConsistency(
    data.awayTeamStats.gols.home,
    data.awayTeamStats.gols.away,
    data.awayTeamStats.gols.global
  );

  // Se há divergência significativa, ser mais conservador (reduzir lambda levemente)
  const consistencyAdjustment = (homeConsistency.consistencyScore + awayConsistency.consistencyScore) / 2;
  const divergencePenalty = consistencyAdjustment < 0.7 ? 0.05 : 0; // Penalidade de 5% se inconsistente

  // 3. Calcular lambda base usando médias combinadas
  // Time da casa: média entre gols marcados em casa e gols sofridos pelo visitante fora
  let lambdaHome = (homeAvgScored + awayAvgConceded) / 2;
  // Time visitante: média entre gols marcados fora e gols sofridos pelo time da casa em casa
  let lambdaAway = (awayAvgScored + homeAvgConceded) / 2;

  // Aplicar ajuste de consistência
  lambdaHome *= (1 - divergencePenalty);
  lambdaAway *= (1 - divergencePenalty);

  // Garantir valores mínimos para evitar divisão por zero
  lambdaHome = lambdaHome || 1.0;
  lambdaAway = lambdaAway || 1.0;

  if (data.homeXG > 0) {
    lambdaHome *= finishingLambdaFactor(xgFinishDelta(histHomeScored, data.homeXG));
  }
  lambdaHome *= volumeOffenseFactor({
    shotsOnTarget: data.homeShotsOnTarget,
    xa: data.homeXA,
    progressivePasses: data.homeProgressivePasses,
    keyPasses: data.homeKeyPasses,
  });

  if (data.awayXG > 0) {
    lambdaAway *= finishingLambdaFactor(xgFinishDelta(histAwayScored, data.awayXG));
  }
  lambdaAway *= volumeOffenseFactor({
    shotsOnTarget: data.awayShotsOnTarget,
    xa: data.awayXA,
    progressivePasses: data.awayProgressivePasses,
    keyPasses: data.awayKeyPasses,
  });

  // Ajuste por totais recentes só se o blend 1,5×/temporada não estiver ativo (evita dupla contagem)
  const clampSmall = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const hr = weightedRecentGoalsPerGame(data.homeHistory || [], 5);
  const ar = weightedRecentGoalsPerGame(data.awayHistory || [], 5);
  if (!homeRecencyActive && hr > 0 && homeWeightedStats.avgTotal > 0) {
    const ratio = hr / homeWeightedStats.avgTotal;
    lambdaHome *= 1 + clampSmall((ratio - 1) * 0.12, -0.06, 0.06);
  }
  if (!awayRecencyActive && ar > 0 && awayWeightedStats.avgTotal > 0) {
    const ratio = ar / awayWeightedStats.avgTotal;
    lambdaAway *= 1 + clampSmall((ratio - 1) * 0.12, -0.06, 0.06);
  }

  const homeOpens = data.homeTeamStats?.firstGoal?.home?.opensScorePct;
  if (homeOpens != null && homeOpens > 58) lambdaHome *= 1.02;
  const awayOpens = data.awayTeamStats?.firstGoal?.away?.opensScorePct;
  if (awayOpens != null && awayOpens > 58) lambdaAway *= 1.02;

  // 4. Calcular força do oponente para ajustar lambda (visitante como away na tabela; mandante como home)
  const homeOpponentStrength = calculateOpponentStrength(
    awayWeightedStats,
    data.awayTableData,
    'awaySlice'
  );
  const awayOpponentStrength = calculateOpponentStrength(
    homeWeightedStats,
    data.homeTableData,
    'homeSlice'
  );

  // Ajustar lambda baseado na força do oponente
  // Se oponente tem defesa forte, reduzir lambda ofensivo
  // Se oponente tem ataque forte, aumentar lambda defensivo esperado
  lambdaHome *= (1 - homeOpponentStrength.defensiveStrength * 0.1); // Até -10% se defesa muito forte
  lambdaHome *= (1 + homeOpponentStrength.offensiveStrength * 0.05); // Até +5% se ataque forte (mais gols esperados)
  
  lambdaAway *= (1 - awayOpponentStrength.defensiveStrength * 0.1);
  lambdaAway *= (1 + awayOpponentStrength.offensiveStrength * 0.05);

  // 5. Ajustar baseado em cleanSheetPct usando dados weighted
  const avgCleanSheet = (homeWeightedStats.cleanSheetPct + awayWeightedStats.cleanSheetPct) / 2;
  
  // Clean sheet alto (>40%) reduz lambda (até -8%)
  if (avgCleanSheet > 40) {
    const reduction = Math.min(0.08, (avgCleanSheet - 40) / 100);
    lambdaHome *= (1 - reduction * 0.5);
    lambdaAway *= (1 - reduction * 0.5);
  }

  // 6. Ajustar baseado em noGoalsPct usando dados weighted
  const avgNoGoals = (homeWeightedStats.noGoalsPct + awayWeightedStats.noGoalsPct) / 2;
  
  // No goals alto (>20%) reduz lambda (até -6%)
  if (avgNoGoals > 20) {
    const reduction = Math.min(0.06, (avgNoGoals - 20) / 100);
    lambdaHome *= (1 - reduction * 0.5);
    lambdaAway *= (1 - reduction * 0.5);
  }

  // 7. Ajustar baseado em over25Pct usando dados weighted
  const avgOver25 = (homeWeightedStats.over25Pct + awayWeightedStats.over25Pct) / 2;
  
  // Over 2.5% alto (>50%) aumenta lambda (até +5%)
  if (avgOver25 > 50) {
    const increase = Math.min(0.05, (avgOver25 - 50) / 100);
    lambdaHome *= (1 + increase * 0.5);
    lambdaAway *= (1 + increase * 0.5);
  }

  // 8. Calcular momentum (forma recente melhorada)
  const homeMomentum = calculateMomentum(
    data.homeHistory || [],
    homeAvgScored,
    homeAvgConceded,
    true // Time da casa
  );
  const awayMomentum = calculateMomentum(
    data.awayHistory || [],
    awayAvgScored,
    awayAvgConceded,
    false // Time visitante
  );

  // Aplicar momentum ao lambda
  // Momentum positivo aumenta lambda, negativo reduz
  const homeMomentumAdjustment = homeMomentum.offensiveMomentum * 0.1 - homeMomentum.defensiveMomentum * 0.05;
  const awayMomentumAdjustment = awayMomentum.offensiveMomentum * 0.1 - awayMomentum.defensiveMomentum * 0.05;
  
  lambdaHome *= (1 + homeMomentumAdjustment);
  lambdaAway *= (1 + awayMomentumAdjustment);

  // 9. Ajustar baseado em importância da partida e ausências
  if (data.matchImportance > 0) {
    // Partidas importantes tendem a ter mais gols (maior intensidade)
    const importanceBoost = Math.min(0.05, data.matchImportance / 20);
    lambdaHome *= (1 + importanceBoost);
    lambdaAway *= (1 + importanceBoost);
  }

  if (data.keyAbsences && data.keyAbsences !== 'none') {
    // Ausências reduzem capacidade ofensiva/defensiva
    const absencePenalty = data.keyAbsences === 'high' ? 0.1 : data.keyAbsences === 'medium' ? 0.05 : 0.02;
    lambdaHome *= (1 - absencePenalty);
    lambdaAway *= (1 - absencePenalty);
  }

  // 10. Considerar forma recente tradicional (compatibilidade)
  let recentFormAdjustment = 0;
  if (data.homeHistory && data.homeHistory.length > 0 && data.awayHistory && data.awayHistory.length > 0) {
    const recentHome = data.homeHistory.slice(0, 3);
    const recentAway = data.awayHistory.slice(0, 3);

    // Calcular média de gols nos últimos 3 jogos
    const homeRecentGoals = recentHome.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / recentHome.length;
    const awayRecentGoals = recentAway.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / recentAway.length;
    const recentAvg = (homeRecentGoals + awayRecentGoals) / 2;
    
    // Comparar com média histórica
    const historicalAvg = (homeAvgScored + homeAvgConceded + awayAvgScored + awayAvgConceded) / 2;
    
    if (recentAvg > historicalAvg) {
      // Forma recente melhor que média histórica
      recentFormAdjustment = Math.min(2, (recentAvg - historicalAvg) * 0.5);
    } else if (recentAvg < historicalAvg) {
      // Forma recente pior que média histórica
      recentFormAdjustment = Math.max(-2, (recentAvg - historicalAvg) * 0.5);
    }
  }

  const lambdaTotal = lambdaHome + lambdaAway;

  // 7. Calcular probabilidade Over 1.5 usando Poisson
  const over15Prob = 1 - poissonCumulative(1, lambdaTotal);
  let statsProb = Math.max(10, Math.min(98, over15Prob * 100));

  // Aplicar ajuste de forma recente
  statsProb = Math.max(10, Math.min(98, statsProb + recentFormAdjustment));

  // Calcular probabilidades Over/Under para múltiplas linhas
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaTotal);

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Prob. Estatísticas calculada (com dados Global):', {
      lambdaHome,
      lambdaAway,
      lambdaTotal,
      homeAvgScored: homeWeightedStats.avgScored,
      homeAvgConceded: homeWeightedStats.avgConceded,
      awayAvgScored: awayWeightedStats.avgScored,
      awayAvgConceded: awayWeightedStats.avgConceded,
      avgCleanSheet,
      avgNoGoals,
      avgOver25,
      homeConsistency: homeConsistency.consistencyScore,
      awayConsistency: awayConsistency.consistencyScore,
      homeMomentum: homeMomentum.offensiveMomentum,
      awayMomentum: awayMomentum.offensiveMomentum,
      homeOpponentStrength,
      awayOpponentStrength,
      recentFormAdjustment,
      statsProb,
    });
  }

  return {
    probability: statsProb,
    lambdaTotal,
    lambdaHome,
    lambdaAway,
    overUnderProbabilities,
  };
}

/**
 * Cria valores padrão para CompetitionComplementAverages quando não há dados disponíveis
 * Usa valores típicos de campeonatos de futebol
 */
function createDefaultComplementAvg(): CompetitionComplementAverages {
  return {
    pl: 0,
    poss: 50, // 50% de posse é típico
    age: 25, // 25 anos é idade média típica
    playingTimeMp: 0,
    playingTime90s: 10, // 10 partidas completas é típico
    performanceGls: 0,
    performanceAst: 0,
    performanceGA: 0,
    performanceGPK: 0,
    per90Gls: 1.0, // 1 gol por 90 minutos é típico
    per90Ast: 0,
    per90GA: 0,
    per90GPK: 0,
    per90GAPK: 0,
  };
}

function parseStandingCell(v: unknown): number {
  if (v == null) return 0;
  const t = String(v).trim().replace(/,/g, '').replace(/^\+/, '');
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Time decay / recência: últimos 5 jogos pesam 1,5× frente à média ponderada (≈ temporada em janela). */
const RECENCY_BLEND_WEIGHT = 1.5;
const RECENCY_BASE_WEIGHT = 1;
const MIN_GAMES_FOR_RECENCY_BLEND = 3;
const MAX_RECENCY_GAMES = 5;

type OpponentTableSlice = 'aggregate' | 'homeSlice' | 'awaySlice';

/** Gols marcados/sofridos por jogo nos últimos `maxGames` (índice 0 = mais recente). */
function recentAttackDefensePerGame(
  history: RecentMatch[],
  maxGames: number,
  perspectiveHomeTeam: boolean
): { scored: number; conceded: number; n: number } {
  if (!history?.length) return { scored: 0, conceded: 0, n: 0 };
  const slice = history.slice(0, Math.min(maxGames, history.length));
  const n = slice.length;
  let s = 0;
  let c = 0;
  for (const m of slice) {
    if (perspectiveHomeTeam) {
      s += m.homeScore ?? 0;
      c += m.awayScore ?? 0;
    } else {
      s += m.awayScore ?? 0;
      c += m.homeScore ?? 0;
    }
  }
  return { scored: n > 0 ? s / n : 0, conceded: n > 0 ? c / n : 0, n };
}

/** Mistura médias ponderadas (10 jogos) com taxa dos últimos 5 com peso 1,5×. */
function blendWeightedWithRecentFive(
  weightedScored: number,
  weightedConceded: number,
  history: RecentMatch[],
  perspectiveHome: boolean
): { scored: number; conceded: number; active: boolean } {
  const r = recentAttackDefensePerGame(history, MAX_RECENCY_GAMES, perspectiveHome);
  if (r.n < MIN_GAMES_FOR_RECENCY_BLEND) {
    return { scored: weightedScored, conceded: weightedConceded, active: false };
  }
  const wSum = RECENCY_BLEND_WEIGHT + RECENCY_BASE_WEIGHT;
  return {
    scored:
      (RECENCY_BLEND_WEIGHT * r.scored + RECENCY_BASE_WEIGHT * weightedScored) / wSum,
    conceded:
      (RECENCY_BLEND_WEIGHT * r.conceded + RECENCY_BASE_WEIGHT * weightedConceded) / wSum,
    active: true,
  };
}

function computeRecentFormConfidenceIndex(
  data: MatchData,
  homeW: ReturnType<typeof getWeightedTeamStats>,
  awayW: ReturnType<typeof getWeightedTeamStats>
): number {
  const hHist = data.homeHistory || [];
  const aHist = data.awayHistory || [];
  if (hHist.length < MIN_GAMES_FOR_RECENCY_BLEND || aHist.length < MIN_GAMES_FOR_RECENCY_BLEND) {
    return 28;
  }
  const hr = recentAttackDefensePerGame(hHist, MAX_RECENCY_GAMES, true);
  const ar = recentAttackDefensePerGame(aHist, MAX_RECENCY_GAMES, false);
  if (hr.n < MIN_GAMES_FOR_RECENCY_BLEND || ar.n < MIN_GAMES_FOR_RECENCY_BLEND) {
    return 28;
  }
  const offAlign =
    1 -
    Math.min(
      1,
      (Math.abs(hr.scored - homeW.avgScored) + Math.abs(ar.scored - awayW.avgScored)) / 4
    );
  const defAlign =
    1 -
    Math.min(
      1,
      (Math.abs(hr.conceded - homeW.avgConceded) + Math.abs(ar.conceded - awayW.avgConceded)) / 4
    );
  const sliceH = hHist.slice(0, Math.min(MAX_RECENCY_GAMES, hHist.length));
  const sliceA = aHist.slice(0, Math.min(MAX_RECENCY_GAMES, aHist.length));
  const totals: number[] = [];
  for (const m of sliceH) totals.push((m.homeScore ?? 0) + (m.awayScore ?? 0));
  for (const m of sliceA) totals.push((m.homeScore ?? 0) + (m.awayScore ?? 0));
  if (totals.length === 0) return 30;
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const varSum = totals.reduce((s, t) => s + (t - mean) ** 2, 0);
  const std = Math.sqrt(varSum / totals.length);
  const stability = 1 - Math.min(1, std / 2.5);
  const raw = 38 + 32 * ((offAlign + defAlign) / 2) + 30 * stability;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Classificação agregada da temporada (sem colunas Home MP / Away MP). */
function isAggregateStandingRow(row: TableRowGeral | null | undefined): boolean {
  if (!row) return false;
  const hasHome = row['Home MP'] != null && String(row['Home MP']).trim() !== '';
  const hasAway = row['Away MP'] != null && String(row['Away MP']).trim() !== '';
  const mp = parseStandingCell(row.MP);
  return !hasHome && !hasAway && mp > 0;
}

/**
 * Probabilidade da tabela quando só há totais da temporada (JSON agregado).
 * Vantagem de campo explícita; sem complemento/xG por time.
 */
function calculateAggregateStandingTableProbability(data: MatchData): {
  probability: number;
  lambdaTotal: number;
  lambdaHome: number;
  lambdaAway: number;
  overUnderProbabilities: { [line: string]: { over: number; under: number } };
} | null {
  const h = data.homeTableData!;
  const a = data.awayTableData!;
  const homeMp = parseStandingCell(h.MP);
  const awayMp = parseStandingCell(a.MP);
  const homeGf = parseStandingCell(h.GF);
  const homeGa = parseStandingCell(h.GA);
  const awayGf = parseStandingCell(a.GF);
  const awayGa = parseStandingCell(a.GA);
  if (homeMp <= 0 || awayMp <= 0) return null;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const safeDiv = (num: number, den: number, fallback: number) => (den > 0 ? num / den : fallback);

  const homeAttackPerMatch = homeGf / homeMp;
  const homeDefensePerMatch = homeGa / homeMp;
  const awayAttackPerMatch = awayGf / awayMp;
  const awayDefensePerMatch = awayGa / awayMp;

  const rawCompetitionAvg = typeof data.competitionAvg === 'number' ? data.competitionAvg : 0;
  const competitionAvgGoals =
    Number.isFinite(rawCompetitionAvg) && rawCompetitionAvg > 0 && rawCompetitionAvg <= 10
      ? rawCompetitionAvg
      : 0;

  const fallbackAvgGoals = clamp(
    (homeAttackPerMatch + homeDefensePerMatch + awayAttackPerMatch + awayDefensePerMatch) / 2,
    1.6,
    4.2
  );
  const leagueAvgTotalGoals = competitionAvgGoals > 0 ? competitionAvgGoals : fallbackAvgGoals;
  const leagueAvgTeamGoals = leagueAvgTotalGoals / 2;

  const minMp = Math.min(homeMp, awayMp);
  const tableReliability = clamp(minMp / 12, 0, 1);

  const homeAttackStrength = safeDiv(homeAttackPerMatch, leagueAvgTeamGoals, 1);
  const awayAttackStrength = safeDiv(awayAttackPerMatch, leagueAvgTeamGoals, 1);
  const homeDefenseStrength = safeDiv(homeDefensePerMatch, leagueAvgTeamGoals, 1);
  const awayDefenseStrength = safeDiv(awayDefensePerMatch, leagueAvgTeamGoals, 1);

  const shrinkToAvg = (strength: number) => 1 + (strength - 1) * tableReliability;
  const homeAttack = shrinkToAvg(homeAttackStrength);
  const awayAttack = shrinkToAvg(awayAttackStrength);
  const homeDefense = shrinkToAvg(homeDefenseStrength);
  const awayDefense = shrinkToAvg(awayDefenseStrength);

  let lambdaHome = leagueAvgTeamGoals * homeAttack * awayDefense;
  let lambdaAway = leagueAvgTeamGoals * awayAttack * homeDefense;

  const HOME_FIELD_ADV = 1.08;
  lambdaHome *= HOME_FIELD_ADV;
  lambdaAway *= 2 / (1 + HOME_FIELD_ADV);

  lambdaHome = clamp(lambdaHome, 0.15, 4.25);
  lambdaAway = clamp(lambdaAway, 0.15, 4.25);

  const homeRk = parseStandingCell(h.Rk);
  const awayRk = parseStandingCell(a.Rk);
  const totalTeams = 20;
  if (homeRk > 0 && homeRk <= 5) lambdaHome *= 1.05;
  else if (homeRk > 0 && homeRk <= 10) lambdaHome *= 1.02;
  if (awayRk > 0 && awayRk <= 5) lambdaAway *= 1.05;
  else if (awayRk > 0 && awayRk <= 10) lambdaAway *= 1.02;

  const homeGd = parseStandingCell(h.GD);
  const awayGd = parseStandingCell(a.GD);
  const homeGdPerGame = homeMp > 0 ? homeGd / homeMp : 0;
  const awayGdPerGame = awayMp > 0 ? awayGd / awayMp : 0;
  if (homeGdPerGame > 0.5) lambdaHome *= 1 + Math.min(0.03, homeGdPerGame * 0.02);
  if (awayGdPerGame > 0.5) lambdaAway *= 1 + Math.min(0.03, awayGdPerGame * 0.02);

  const homePtsPerGame = parseStandingCell(h['Pts/MP']);
  const awayPtsPerGame = parseStandingCell(a['Pts/MP']);
  const homeFormFactor =
    homePtsPerGame > 0 ? Math.min(1.03, 1 + (homePtsPerGame - 1.5) * 0.01) : 1;
  const awayFormFactor =
    awayPtsPerGame > 0 ? Math.min(1.03, 1 + (awayPtsPerGame - 1.5) * 0.01) : 1;
  lambdaHome *= homeFormFactor;
  lambdaAway *= awayFormFactor;

  if (homeRk > 0 && awayRk > 0) {
    lambdaHome *= 1 + ((awayRk - homeRk) / totalTeams) * 0.05;
    lambdaAway *= 1 + ((homeRk - awayRk) / totalTeams) * 0.05;
  }

  const lambdaTotal = lambdaHome + lambdaAway;
  const over15Prob = 1 - poissonCumulative(1, lambdaTotal);
  let tableProb = Math.max(10, Math.min(98, over15Prob * 100));

  let formAdjustment = 0;
  if (h['Last 5'] || a['Last 5']) {
    const parseRecentForm = (last5: string | undefined): number => {
      if (!last5 || last5.trim() === '') return 0;
      let offensiveTrend = 0;
      const compact = last5.trim().toUpperCase().replace(/\s+/g, '');
      const matches = compact.split('');
      for (const match of matches) {
        if (match === 'W') offensiveTrend += 1;
        else if (match === 'D') offensiveTrend += 0;
        else if (match === 'L') offensiveTrend -= 0.5;
      }
      return matches.length > 0 ? offensiveTrend / matches.length : 0;
    };
    const homeForm = parseRecentForm(h['Last 5']);
    const awayForm = parseRecentForm(a['Last 5']);
    formAdjustment = ((homeForm + awayForm) / 2) * 3;
  }

  const finalProb = Math.max(10, Math.min(98, tableProb + formAdjustment));
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaTotal);

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Tabela agregada (JSON): lambdas e prob.', {
      lambdaHome,
      lambdaAway,
      lambdaTotal,
      finalProb,
    });
  }

  return {
    probability: finalProb,
    lambdaTotal,
    lambdaHome,
    lambdaAway,
    overUnderProbabilities,
  };
}

/**
 * Calcula probabilidade Over 1.5 baseada nos dados da tabela do campeonato.
 * Fluxo atual: tabela geral (agregada JSON ou legado Home/Away). Se existirem dados **legados**
 * de complemento (parcial ou completo), lambdas podem ser ajustados — o app novo não importa mais complemento.
 *
 * @param data - Dados da partida (homeTableData, awayTableData; complemento opcional / legado)
 * @returns Probabilidade Over 1.5 e overUnderProbabilities, ou null se dados insuficientes
 */
function calculateTableProbability(data: MatchData): {
  probability: number;
  lambdaTotal: number;
  lambdaHome: number;
  lambdaAway: number;
  overUnderProbabilities: { [line: string]: { over: number; under: number } };
} | null {
  const hasHomeTableData = !!data.homeTableData;
  const hasAwayTableData = !!data.awayTableData;

  if (!hasHomeTableData || !hasAwayTableData) {
    return null;
  }

  if (
    isAggregateStandingRow(data.homeTableData) &&
    isAggregateStandingRow(data.awayTableData)
  ) {
    return calculateAggregateStandingTableProbability(data);
  }

  // Usar campos Home/Away da nova estrutura
  // Para time da casa: usar Home MP, Home GF, Home GA, etc.
  // Para time visitante: usar Away MP, Away GF, Away GA, etc.
  const homeMp = parseFloat(data.homeTableData['Home MP'] || data.homeTableData.MP || '0');
  const homeGf = parseFloat(data.homeTableData['Home GF'] || data.homeTableData.GF || '0');
  const homeGa = parseFloat(data.homeTableData['Home GA'] || data.homeTableData.GA || '0');
  const homeXg = parseFloat(data.homeTableData['Home xG'] || data.homeTableData.xG || '0');
  const homeXga = parseFloat(data.homeTableData['Home xGA'] || data.homeTableData.xGA || '0');
  const homeRk = parseFloat(data.homeTableData.Rk || '0');
  const homeGd = parseFloat(data.homeTableData['Home GD'] || data.homeTableData.GD || '0');
  const homeXgd = parseFloat(data.homeTableData['Home xGD'] || data.homeTableData.xGD || '0');
  const homePtsPerGame = parseFloat(data.homeTableData['Home Pts/MP'] || data.homeTableData['Pts/MP'] || '0');

  // Para time visitante: Away MP/GF e gols/xGA sofridos fora (Away GA / Away xGA da linha do visitante)
  const awayMp = parseFloat(data.awayTableData['Away MP'] || data.awayTableData.MP || '0');
  const awayGf = parseFloat(data.awayTableData['Away GF'] || data.awayTableData.GF || '0');
  const awayGa = parseFloat(data.awayTableData['Away GA'] || data.awayTableData.GA || '0');
  const awayXg = parseFloat(data.awayTableData['Away xG'] || data.awayTableData.xG || '0');
  const awayXga = parseFloat(data.awayTableData['Away xGA'] || data.awayTableData.xGA || '0');
  const awayRk = parseFloat(data.awayTableData.Rk || '0');
  const awayGd = parseFloat(data.awayTableData['Away GD'] || data.awayTableData.GD || '0');
  const awayXgd = parseFloat(data.awayTableData['Away xGD'] || data.awayTableData.xGD || '0');
  const awayPtsPerGame = parseFloat(data.awayTableData['Away Pts/MP'] || data.awayTableData['Pts/MP'] || '0');

  if (homeMp === 0 || awayMp === 0) {
    return null;
  }

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const safeDiv = (num: number, den: number, fallback: number) => (den > 0 ? num / den : fallback);

  // 1. Calcular médias de gols da tabela usando campos Home/Away
  // Time da casa: Home GF / Home MP (gols marcados em casa)
  const homeAvgScored = homeGf / homeMp;
  // Time da casa: Away GA do visitante / Away MP do visitante (gols sofridos pelo visitante fora)
  const awayGaForHome = parseFloat(data.awayTableData['Away GA'] || data.awayTableData.GA || '0');
  const awayMpForHome = parseFloat(data.awayTableData['Away MP'] || data.awayTableData.MP || '0');
  const homeAvgConceded = awayMpForHome > 0 ? awayGaForHome / awayMpForHome : (homeMp > 0 ? homeGa / homeMp : 0);
  
  // Time visitante: Away GF / Away MP (gols marcados fora)
  const awayAvgScored = awayGf / awayMp;
  // Time visitante: Home GA do time da casa / Home MP do time da casa (gols sofridos pelo time da casa em casa)
  const awayAvgConceded = homeMp > 0 ? homeGa / homeMp : 0;

  // 2. Verificar se dados xG estão disponíveis (formato completo)
  // Se não houver xG ou valores forem zero, usar apenas GF/GA (formato básico)
  const hasXgData = (homeXg > 0 || homeXga > 0 || awayXg > 0 || awayXga > 0);
  
  if (import.meta.env.DEV) {
    if (hasXgData) {
      console.log('[AnalysisEngine] ✅ Formato COMPLETO detectado - usando xG + GF/GA para análise');
    } else {
      console.log('[AnalysisEngine] ⚠️ Formato BÁSICO detectado - usando apenas GF/GA (sem xG)');
      console.log('[AnalysisEngine] A análise será baseada em gols reais (GF/GA) em vez de Expected Goals (xG)');
    }
  }
  
  // Misturar xG/xGA com GF/GA para reduzir ruído (xG costuma ser mais estável quando disponível)
  // Se formato for básico (sem xG), usar apenas GF/GA
  const blendAttack = (xgTotal: number, gfTotal: number, mp: number): number => {
    const gfPer = safeDiv(gfTotal, mp, 0);
    if (!hasXgData || xgTotal <= 0) {
      return gfPer; // Formato básico: usar apenas GF
    }
    const xgPer = safeDiv(xgTotal, mp, 0);
    
    // Peso dinâmico: xG vale mais no início (estabiliza rápido), Gols ganham peso com o tempo
    const xgWeight = mp < 10 ? 0.8 : (mp > 25 ? 0.6 : 0.7);
    if (xgPer > 0) return xgWeight * xgPer + (1 - xgWeight) * gfPer;
    return gfPer;
  };
  const blendDefense = (xgaTotal: number, gaTotal: number, mp: number): number => {
    const gaPer = safeDiv(gaTotal, mp, 0);
    if (!hasXgData || xgaTotal <= 0) {
      return gaPer; // Formato básico: usar apenas GA
    }
    const xgaPer = safeDiv(xgaTotal, mp, 0);
    
    // Peso dinâmico para defesa também
    const xgaWeight = mp < 10 ? 0.8 : (mp > 25 ? 0.6 : 0.7);
    if (xgaPer > 0) return xgaWeight * xgaPer + (1 - xgaWeight) * gaPer;
    return gaPer;
  };

  let homeAttackPerMatch = blendAttack(homeXg, homeGf, homeMp);
  let homeDefensePerMatch = blendDefense(homeXga, homeGa, homeMp);
  let awayAttackPerMatch = blendAttack(awayXg, awayGf, awayMp);
  let awayDefensePerMatch = blendDefense(awayXga, awayGa, awayMp);

  // 3. Lambda base calibrável: forças relativas vs média do campeonato (gols/jogo)
  const rawCompetitionAvg = typeof data.competitionAvg === 'number' ? data.competitionAvg : 0;
  const competitionAvgGoals = Number.isFinite(rawCompetitionAvg) && rawCompetitionAvg > 0 && rawCompetitionAvg <= 10
    ? rawCompetitionAvg
    : 0;

  // Fallback (se competitionAvg não estiver disponível): média entre os próprios times (clampada)
  const fallbackAvgGoals = clamp(
    (homeAvgScored + homeAvgConceded + awayAvgScored + awayAvgConceded) / 2,
    1.6,
    4.2
  );

  const leagueAvgTotalGoals = competitionAvgGoals > 0 ? competitionAvgGoals : fallbackAvgGoals;
  const leagueAvgTeamGoals = leagueAvgTotalGoals / 2;

  const minMp = Math.min(homeMp, awayMp);
  // Confiabilidade da tabela: quanto mais jogos, menos “extremos” (shrink para a média)
  const tableReliability = clamp(minMp / 12, 0, 1);

  const homeAttackStrength = safeDiv(homeAttackPerMatch, leagueAvgTeamGoals, 1);
  const awayAttackStrength = safeDiv(awayAttackPerMatch, leagueAvgTeamGoals, 1);
  const homeDefenseStrength = safeDiv(homeDefensePerMatch, leagueAvgTeamGoals, 1);
  const awayDefenseStrength = safeDiv(awayDefensePerMatch, leagueAvgTeamGoals, 1);

  const shrinkToAvg = (strength: number) => 1 + (strength - 1) * tableReliability;
  const homeAttack = shrinkToAvg(homeAttackStrength);
  const awayAttack = shrinkToAvg(awayAttackStrength);
  const homeDefense = shrinkToAvg(homeDefenseStrength);
  const awayDefense = shrinkToAvg(awayDefenseStrength);

  // Lambda por time (casa vs fora) usando ataque × defesa relativa
  let lambdaHome = leagueAvgTeamGoals * homeAttack * awayDefense;
  let lambdaAway = leagueAvgTeamGoals * awayAttack * homeDefense;

  // Limites suaves por time para evitar explosões no início de temporada / dados ruidosos
  lambdaHome = clamp(lambdaHome, 0.15, 4.25);
  lambdaAway = clamp(lambdaAway, 0.15, 4.25);

  // 3b. Legado — championship_complement: ajuste fino (posse, per 90, idade, minutos) se ainda houver dados salvos
  const hasHomeComplement = !!data.homeComplementData;
  const hasAwayComplement = !!data.awayComplementData;
  const hasCompetitionAvg = !!data.competitionComplementAvg;
  const hasFullComplement = hasHomeComplement && hasAwayComplement && hasCompetitionAvg;
  const hasPartialComplement = hasHomeComplement || hasAwayComplement;

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] calculateTableProbability — dados de complemento (legado, opcional):', {
      hasHomeComplement,
      hasAwayComplement,
      hasCompetitionAvg,
      hasFullComplement,
      hasPartialComplement,
      lambdaHomeAntes: lambdaHome,
      lambdaAwayAntes: lambdaAway,
    });
  }

  // Calcular média básica se não houver competitionComplementAvg mas houver dados parciais
  // GARANTIR que avg nunca seja null quando houver dados parciais
  let avg: CompetitionComplementAverages | null = data.competitionComplementAvg || null;
  
  if (hasPartialComplement) {
    // Se não houver média calculada, tentar calcular a partir dos dados disponíveis
    if (!avg) {
      const parseNum = (value: unknown): number => {
        if (value == null) return 0;
        const raw = String(value).trim();
        if (!raw) return 0;
        const normalized = raw.replace(/,/g, '');
        const n = Number.parseFloat(normalized);
        return Number.isFinite(n) ? n : 0;
      };

      const allRows: Array<Record<string, unknown>> = [];
      if (hasHomeComplement) allRows.push(data.homeComplementData as unknown as Record<string, unknown>);
      if (hasAwayComplement) allRows.push(data.awayComplementData as unknown as Record<string, unknown>);

      if (allRows.length > 0) {
        let possSum = 0;
        let possCount = 0;
        let per90GlsSum = 0;
        let per90GlsCount = 0;
        let ageSum = 0;
        let ageCount = 0;
        let playingTime90sSum = 0;
        let playingTime90sCount = 0;

        for (const row of allRows) {
          const poss = parseNum(row.Poss);
          if (poss > 0) {
            possSum += poss;
            possCount++;
          }
          const per90Gls = parseNum(row['Per 90 Minutes Gls']);
          if (per90Gls > 0) {
            per90GlsSum += per90Gls;
            per90GlsCount++;
          }
          const age = parseNum(row.Age);
          if (age > 0) {
            ageSum += age;
            ageCount++;
          }
          const playingTime90s = parseNum(row['Playing Time 90s']);
          if (playingTime90s > 0) {
            playingTime90sSum += playingTime90s;
            playingTime90sCount++;
          }
        }

        avg = {
          pl: 0, // Não usado no cálculo atual
          poss: possCount > 0 ? possSum / possCount : 50,
          age: ageCount > 0 ? ageSum / ageCount : 25,
          playingTimeMp: 0, // Não usado no cálculo atual
          playingTime90s: playingTime90sCount > 0 ? playingTime90sSum / playingTime90sCount : 10,
          performanceGls: 0, // Não usado no cálculo atual
          performanceAst: 0, // Não usado no cálculo atual
          performanceGA: 0, // Não usado no cálculo atual
          performanceGPK: 0, // Não usado no cálculo atual
          per90Gls: per90GlsCount > 0 ? per90GlsSum / per90GlsCount : 1.0,
          per90Ast: 0, // Não usado no cálculo atual
          per90GA: 0, // Não usado no cálculo atual
          per90GPK: 0, // Não usado no cálculo atual
          per90GAPK: 0, // Não usado no cálculo atual
        };

        if (import.meta.env.DEV) {
          console.log('[AnalysisEngine] ✅ Média legada de complemento inferida a partir de dados parciais:', avg);
        }
      }
    }
    
    // GARANTIR que avg nunca seja null - usar valores padrão se necessário
    const avgToUse = avg || createDefaultComplementAvg();
    
    if (!avg) {
      if (import.meta.env.DEV) {
        console.log(
          '[AnalysisEngine] Complemento legado: média da competição ausente — usando defaults para fatores opcionais'
        );
      }
    }

    // SEMPRE aplicar ajustes quando houver dados parciais (não depende mais de avg ser não-nulo)
    // Este código está dentro do if (hasPartialComplement) da linha 779
    const parseNum = (value: unknown): number => {
      if (value == null) return 0;
      const raw = String(value).trim();
      if (!raw) return 0;
      const normalized = raw.replace(/,/g, '');
      const n = Number.parseFloat(normalized);
      return Number.isFinite(n) ? n : 0;
    };

    // Usar dados parciais - se não houver um dos times, usar valores neutros
    const homeRow = hasHomeComplement 
      ? (data.homeComplementData as unknown as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    const awayRow = hasAwayComplement
      ? (data.awayComplementData as unknown as Record<string, unknown>)
      : ({} as Record<string, unknown>);

    // 1. Ajuste por Possession (posse de bola) - times com mais posse tendem a ter mais oportunidades
    const homePoss = hasHomeComplement ? parseNum(homeRow.Poss) : avgToUse.poss;
    const awayPoss = hasAwayComplement ? parseNum(awayRow.Poss) : avgToUse.poss;
    const homePossRatio = avgToUse.poss > 0 && homePoss > 0 ? homePoss / avgToUse.poss : 1;
    const awayPossRatio = avgToUse.poss > 0 && awayPoss > 0 ? awayPoss / avgToUse.poss : 1;
    
    // Posse maior aumenta probabilidade de gols (até ±5%)
    const homePossFactor = clamp(1 + (homePossRatio - 1) * 0.1, 0.95, 1.05);
    const awayPossFactor = clamp(1 + (awayPossRatio - 1) * 0.1, 0.95, 1.05);

    // 2. Ajuste por Performance metrics (Gls, Ast, G+A por 90)
    const homePer90Gls = hasHomeComplement ? parseNum(homeRow['Per 90 Minutes Gls']) : avgToUse.per90Gls;
    const homePer90GA = hasHomeComplement ? parseNum(homeRow['Per 90 Minutes G+A']) : avgToUse.per90Gls * 1.5;
    const awayPer90Gls = hasAwayComplement ? parseNum(awayRow['Per 90 Minutes Gls']) : avgToUse.per90Gls;
    const awayPer90GA = hasAwayComplement ? parseNum(awayRow['Per 90 Minutes G+A']) : avgToUse.per90Gls * 1.5;
    
    const homePer90Ratio = avgToUse.per90Gls > 0 && homePer90Gls > 0 ? homePer90Gls / avgToUse.per90Gls : 1;
    const awayPer90Ratio = avgToUse.per90Gls > 0 && awayPer90Gls > 0 ? awayPer90Gls / avgToUse.per90Gls : 1;
    
    // Performance por 90 aumenta ataque (até ±6%)
    const homePer90Factor = clamp(1 + (homePer90Ratio - 1) * 0.12, 0.94, 1.06);
    const awayPer90Factor = clamp(1 + (awayPer90Ratio - 1) * 0.12, 0.94, 1.06);

    // 3. Ajuste por Age (idade média) - times mais jovens podem ser mais ofensivos
    const homeAge = hasHomeComplement ? parseNum(homeRow.Age) : avgToUse.age;
    const awayAge = hasAwayComplement ? parseNum(awayRow.Age) : avgToUse.age;
    const avgAge = avgToUse.age;
    
    // Times mais jovens (até 2 anos abaixo da média) têm pequeno bônus ofensivo (até +2%)
    const homeAgeFactor = avgAge > 0 && homeAge > 0 && homeAge < avgAge
      ? clamp(1 + ((avgAge - homeAge) / avgAge) * 0.04, 1.0, 1.02)
      : 1;
    const awayAgeFactor = avgAge > 0 && awayAge > 0 && awayAge < avgAge
      ? clamp(1 + ((avgAge - awayAge) / avgAge) * 0.04, 1.0, 1.02)
      : 1;

    // 4. Ajuste por Playing Time (normalização por minutos jogados)
    // Times com mais minutos jogados podem ter mais consistência
    const home90s = hasHomeComplement ? parseNum(homeRow['Playing Time 90s']) : avgToUse.playingTime90s;
    const away90s = hasAwayComplement ? parseNum(awayRow['Playing Time 90s']) : avgToUse.playingTime90s;
    const avg90s = avgToUse.playingTime90s;
    
    // Mais minutos = mais consistência (até +1%)
    const home90sFactor = avg90s > 0 && home90s > 0 && home90s > avg90s
      ? clamp(1 + ((home90s - avg90s) / avg90s) * 0.02, 1.0, 1.01)
      : 1;
    const away90sFactor = avg90s > 0 && away90s > 0 && away90s > avg90s
      ? clamp(1 + ((away90s - avg90s) / avg90s) * 0.02, 1.0, 1.01)
      : 1;

    // Aplicar todos os fatores de complemento
    const homeComplementFactor = homePossFactor * homePer90Factor * homeAgeFactor * home90sFactor;
    const awayComplementFactor = awayPossFactor * awayPer90Factor * awayAgeFactor * away90sFactor;

    lambdaHome *= homeComplementFactor;
    lambdaAway *= awayComplementFactor;

    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] ✅ Ajuste legado (complemento) aplicado aos lambdas:', {
        hasFullComplement,
        hasPartialComplement,
        usandoValoresPadrao: !avg,
        homePossFactor,
        awayPossFactor,
        homePer90Factor,
        awayPer90Factor,
        homeAgeFactor,
        awayAgeFactor,
        home90sFactor,
        away90sFactor,
        homeComplementFactor,
        awayComplementFactor,
        lambdaHomeAntes: lambdaHome / homeComplementFactor,
        lambdaAwayAntes: lambdaAway / awayComplementFactor,
        lambdaHomeApos: lambdaHome,
        lambdaAwayApos: lambdaAway,
      });
    }
  } else if (import.meta.env.DEV) {
    console.log(
      '[AnalysisEngine] Sem dados de complemento (esperado no fluxo atual) — probabilidade só com tabela geral'
    );
  }

  // 4. Ajustar baseado em posição na tabela (times no topo são mais ofensivos)
  // Assumir que há 20 times (ajustar se necessário)
  const totalTeams = 20; // Pode ser ajustado dinamicamente se necessário
  const homePositionFactor = homeRk > 0 ? (totalTeams - homeRk + 1) / totalTeams : 0.5;
  const awayPositionFactor = awayRk > 0 ? (totalTeams - awayRk + 1) / totalTeams : 0.5;
  
  // Times no topo (posição baixa = melhor) tendem a marcar mais
  // Ajustar lambda: +5% para top 5, +2% para top 10, neutro para resto
  if (homeRk <= 5) lambdaHome *= 1.05;
  else if (homeRk <= 10) lambdaHome *= 1.02;
  
  if (awayRk <= 5) lambdaAway *= 1.05;
  else if (awayRk <= 10) lambdaAway *= 1.02;

  // 5. Ajustar baseado em Saldo de Gols (GD) - times com GD positivo são mais ofensivos
  // Usar Home GD para time da casa e Away GD para visitante
  const homeGdPerGame = homeMp > 0 ? homeGd / homeMp : 0;
  const awayGdPerGame = awayMp > 0 ? awayGd / awayMp : 0;
  
  // GD positivo aumenta probabilidade de gols (até +3% por GD/game > 0.5)
  if (homeGdPerGame > 0.5) lambdaHome *= (1 + Math.min(0.03, homeGdPerGame * 0.02));
  if (awayGdPerGame > 0.5) lambdaAway *= (1 + Math.min(0.03, awayGdPerGame * 0.02));

  // 6. Ajustar baseado em xGD (Expected Goal Difference) quando disponível
  // Usar Home xGD para time da casa e Away xGD para visitante
  if (homeXgd !== 0 && homeMp > 0) {
    const homeXgdPerGame = homeXgd / homeMp;
    if (homeXgdPerGame > 0.3) lambdaHome *= (1 + Math.min(0.025, homeXgdPerGame * 0.015));
  }
  if (awayXgd !== 0 && awayMp > 0) {
    const awayXgdPerGame = awayXgd / awayMp;
    if (awayXgdPerGame > 0.3) lambdaAway *= (1 + Math.min(0.025, awayXgdPerGame * 0.015));
  }

  // 7. Ajustar baseado em Pts/MP (pontos por jogo) - times em melhor forma
  // Máximo de pontos por jogo é ~3.0 (vitórias consecutivas)
  const homeFormFactor = homePtsPerGame > 0 ? Math.min(1.03, 1 + (homePtsPerGame - 1.5) * 0.01) : 1;
  const awayFormFactor = awayPtsPerGame > 0 ? Math.min(1.03, 1 + (awayPtsPerGame - 1.5) * 0.01) : 1;
  lambdaHome *= homeFormFactor;
  lambdaAway *= awayFormFactor;

  // 8. Ajustar baseado em força do oponente (posição do adversário)
  // Jogar contra time fraco (posição alta) aumenta probabilidade de gols
  const opponentStrengthFactor = (awayRk > 0 && homeRk > 0) 
    ? 1 + ((awayRk - homeRk) / totalTeams) * 0.05 // Até ±5% baseado na diferença de posição
    : 1;
  lambdaHome *= opponentStrengthFactor;
  // Inverso para o visitante
  const homeOpponentStrengthFactor = (homeRk > 0 && awayRk > 0)
    ? 1 + ((homeRk - awayRk) / totalTeams) * 0.05
    : 1;
  lambdaAway *= homeOpponentStrengthFactor;

  const lambdaTotal = lambdaHome + lambdaAway;

  // 9. Calcular probabilidade Over 1.5 usando Poisson
  const over15Prob = 1 - poissonCumulative(1, lambdaTotal);
  let tableProb = Math.max(10, Math.min(98, over15Prob * 100));

  // 10. Ajustar baseado em forma recente (Last 5) se disponível
  let formAdjustment = 0;
  if (data.homeTableData?.['Last 5'] || data.awayTableData?.['Last 5']) {
    const parseRecentForm = (last5: string | undefined): number => {
      if (!last5 || last5.trim() === '') return 0;

      // Converter "WWDLW" em tendência ofensiva
      let offensiveTrend = 0;
      const matches = last5.trim().toUpperCase().split('');

      for (const match of matches) {
        if (match === 'W') offensiveTrend += 1;
        else if (match === 'D') offensiveTrend += 0;
        else if (match === 'L') offensiveTrend -= 0.5;
      }

      return offensiveTrend / 5;
    };

    const homeForm = parseRecentForm(data.homeTableData?.['Last 5']);
    const awayForm = parseRecentForm(data.awayTableData?.['Last 5']);
    const avgForm = (homeForm + awayForm) / 2;

    // Ajustar probabilidade baseado em forma recente (até ±3%)
    formAdjustment = avgForm * 3;
  }

  const finalProb = Math.max(10, Math.min(98, tableProb + formAdjustment));

  // Calcular probabilidades Over/Under para múltiplas linhas
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaTotal);

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] ===== Prob. Tabela (geral + complemento legado opcional) =====');
    console.log('[AnalysisEngine] Fontes aplicadas:', {
      tabelaGeral: {
        aplicada: true,
        homeTableData: !!data.homeTableData,
        awayTableData: !!data.awayTableData,
        impacto: 'Base para lambda (Home/Away ou agregado)',
      },
      complementoLegado: {
        aplicada: hasPartialComplement,
        completo: hasFullComplement,
        parcial: hasPartialComplement && !hasFullComplement,
        homeComplementData: hasHomeComplement,
        awayComplementData: hasAwayComplement,
        competitionComplementAvg: hasCompetitionAvg,
        usandoValoresPadrao: hasPartialComplement && !avg,
        impacto: hasPartialComplement
          ? 'Ajuste fino (dados antigos); fluxo novo não importa complemento'
          : 'Não aplicável',
      },
    });
    console.log('[AnalysisEngine] Resultados:', {
      lambdaHome,
      lambdaAway,
      lambdaTotal,
      homeRk,
      awayRk,
      homeGdPerGame,
      awayGdPerGame,
      homePtsPerGame,
      awayPtsPerGame,
      tableProb,
      formAdjustment,
      finalProb,
    });
    
    if (!hasPartialComplement) {
      console.log('[AnalysisEngine] Complemento legado ausente — análise baseada na classificação/tabela geral.');
    } else if (!hasFullComplement) {
      console.log('[AnalysisEngine] Complemento legado parcial — alguns fatores usam médias/default:', {
        hasHomeComplement,
        hasAwayComplement,
        hasCompetitionAvg,
        mediaInferida: !!avg && !data.competitionComplementAvg,
        usandoValoresPadrao: !avg,
      });
    } else {
      console.log('[AnalysisEngine] Complemento legado completo — ajustes extras aplicados aos lambdas.');
    }
  }

  return {
    probability: finalProb,
    lambdaTotal,
    lambdaHome,
    lambdaAway,
    overUnderProbabilities,
  };
}

/**
 * Combina probabilidade estatística (últimos 10 jogos) com probabilidade da tabela (temporada completa).
 * Usa pesos adaptativos: 60-70% para estatísticas (dados mais recentes) e 30-40% para tabela.
 *
 * @param statsProb - Probabilidade calculada pelas estatísticas (0-100)
 * @param tableProb - Probabilidade calculada pela tabela (0-100) ou null
 * @param data - Dados da partida para avaliar disponibilidade de dados
 * @returns Objeto com probabilidade combinada e os pesos usados
 */
function combineStatisticsAndTable(
  statsProb: number,
  tableProb: number | null,
  data: MatchData
): { probability: number; statsWeight: number; tableWeight: number } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // Validação de inputs
  if (!Number.isFinite(statsProb) || statsProb < 0 || statsProb > 100) {
    throw new Error(`Probabilidade estatística inválida: ${statsProb}`);
  }

  // Se não há probabilidade da tabela, retornar apenas estatística
  if (tableProb === null || tableProb === undefined) {
    return {
      probability: statsProb,
      statsWeight: 1.0,
      tableWeight: 0.0,
    };
  }

  // Validação da probabilidade da tabela
  if (!Number.isFinite(tableProb) || tableProb < 0 || tableProb > 100) {
    return {
      probability: statsProb,
      statsWeight: 1.0,
      tableWeight: 0.0,
    };
  }

  // Avaliar disponibilidade e qualidade dos dados
  const hasTeamStats = !!(data.homeTeamStats && data.awayTeamStats);
  const hasTableData = !!(data.homeTableData && data.awayTableData);

  // 1) Peso base por confiabilidade da tabela (MP)
  const homeMp = hasTableData ? parseFloat(data.homeTableData!.MP || '0') : 0;
  const awayMp = hasTableData ? parseFloat(data.awayTableData!.MP || '0') : 0;
  const minMp = Math.min(homeMp || 0, awayMp || 0);

  // MP ~ 12+ costuma dar estabilidade razoável (clamp 0..1)
  const tableReliability = hasTableData ? clamp(minMp / 12, 0, 1) : 0;

  // Estatísticas são mais recentes, mas a tabela ganha peso conforme MP aumenta
  let tableWeight = 0.25 + 0.15 * tableReliability; // 0.25..0.40
  let statsWeight = 1 - tableWeight; // 0.60..0.75

  // 2) Disponibilidade
  if (hasTeamStats && !hasTableData) {
    statsWeight = 1.0;
    tableWeight = 0.0;
  } else if (!hasTeamStats && hasTableData) {
    statsWeight = 0.0;
    tableWeight = 1.0;
  } else if (!hasTeamStats && !hasTableData) {
    statsWeight = 1.0;
    tableWeight = 0.0;
  }

  // 3) Divergência: puxar levemente para a fonte mais conservadora (mais próxima de 50)
  const divergence = Math.abs(statsProb - tableProb);
  if (hasTeamStats && hasTableData && divergence > 20) {
    const statsDist = Math.abs(statsProb - 50);
    const tableDist = Math.abs(tableProb - 50);
    const shift = divergence > 30 ? 0.08 : 0.05;

    if (statsDist <= tableDist) {
      statsWeight = clamp(statsWeight + shift, 0.55, 0.85);
      tableWeight = 1 - statsWeight;
    } else {
      tableWeight = clamp(tableWeight + shift, 0.15, 0.45);
      statsWeight = 1 - tableWeight;
    }
  }

  // Calcular média ponderada
  const combined = statsProb * statsWeight + tableProb * tableWeight;

  // Suavizar limites usando sigmoid (10-98% mais realista)
  const finalProb = smoothClamp(combined, 10, 98);

  return {
    probability: finalProb,
    statsWeight,
    tableWeight,
  };
}

/**
 * Calcula pesos adaptativos baseados na qualidade e disponibilidade dos dados
 */
function calculateAdaptiveWeights(
  estimatedOver15Freq: number,
  _awayOver15Freq: number, // Mantido para compatibilidade, mas não usado
  competitionAvg: number,
  hasTeamStats: boolean
): { homeWeight: number; awayWeight: number; competitionWeight: number } {
  // Base: se temos dados dos times, dar mais peso a eles
  const hasEstimatedData = estimatedOver15Freq > 0;
  const hasCompetitionData = competitionAvg > 0;

  // Contar quantos dados temos
  const dataCount = (hasEstimatedData ? 1 : 0) + (hasCompetitionData ? 1 : 0);

  if (dataCount === 0) {
    // Sem dados, usar pesos padrão
    return { homeWeight: 0.25, awayWeight: 0.25, competitionWeight: 0.5 };
  }

  // Se temos dados estimados E estatísticas detalhadas, dar mais peso aos times
  if (hasTeamStats && hasEstimatedData) {
    return { homeWeight: 0.35, awayWeight: 0.35, competitionWeight: 0.3 };
  }

  // Se temos apenas dados estimados, ajustar pesos
  if (hasEstimatedData && !hasCompetitionData) {
    return { homeWeight: 0.4, awayWeight: 0.4, competitionWeight: 0.2 };
  }
  if (!hasEstimatedData && hasCompetitionData) {
    return { homeWeight: 0.25, awayWeight: 0.25, competitionWeight: 0.5 };
  }

  // Padrão: balanceado
  return { homeWeight: 0.3, awayWeight: 0.3, competitionWeight: 0.4 };
}

/**
 * Calcula score de completude das tabelas (0-1).
 * Normaliza dados de MatchData garantindo valores padrão seguros para campos opcionais.
 * Previne erros com dados antigos ou incompletos.
 */
function calculateTableCompletenessScore(data: MatchData): {
  score: number;
  availableTables: string[];
  missingTables: string[];
} {
  const availableTables: string[] = [];
  const missingTables: string[] = [];

  if (data.homeTableData && data.awayTableData) {
    availableTables.push('geral');
  } else {
    missingTables.push('geral');
  }

  const hasFullComplement =
    !!data.homeComplementData &&
    !!data.awayComplementData &&
    !!data.competitionComplementAvg;
  if (hasFullComplement) {
    availableTables.push('complement');
  }

  // Confiança do produto: depende só da tabela geral; complemento entra só como metadado legado.
  const score = availableTables.includes('geral') ? 1 : 0;

  return { score, availableTables, missingTables };
}

/**
 * Retorna resumo do impacto de cada tabela
 */
function getTableImpactSummary(data: MatchData): {
  geral: { available: boolean; impact: string };
} {
  const hasGeral = !!(data.homeTableData && data.awayTableData);

  return {
    geral: {
      available: hasGeral,
      impact: hasGeral
        ? 'Alto (classificação da liga — agregado ou legado casa/fora)'
        : 'Não disponível',
    },
  };
}

/**
 * Valida integridade dos dados das tabelas
 * Verifica se os dados básicos estão presentes e se há consistência entre tabelas
 */
function validateTableDataIntegrity(data: MatchData): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Verificar tabela geral
  if (data.homeTableData) {
    const mp = parseFloat(String(data.homeTableData.MP || '0'));
    const gf = parseFloat(String(data.homeTableData.GF || '0'));
    const ga = parseFloat(String(data.homeTableData.GA || '0'));
    if (mp === 0 || (gf === 0 && ga === 0)) {
      warnings.push('Tabela geral do time da casa tem dados incompletos (MP=0 ou sem gols)');
    }
  }
  if (data.awayTableData) {
    const mp = parseFloat(String(data.awayTableData.MP || '0'));
    const gf = parseFloat(String(data.awayTableData.GF || '0'));
    const ga = parseFloat(String(data.awayTableData.GA || '0'));
    if (mp === 0 || (gf === 0 && ga === 0)) {
      warnings.push('Tabela geral do time visitante tem dados incompletos (MP=0 ou sem gols)');
    }
  }

  // Verificar correspondência de Squads entre tabelas
  if (data.homeTableData && data.homeComplementData) {
    const geralSquad = String(data.homeTableData.Squad || '').trim();
    const complementSquad = String((data.homeComplementData as { Squad?: string })?.Squad || '').trim();
    if (geralSquad && complementSquad && geralSquad !== complementSquad) {
      warnings.push(`Divergência de Squad: tabela geral vs complemento legado (casa): "${geralSquad}" vs "${complementSquad}"`);
    }
  }

  if (data.awayTableData && data.awayComplementData) {
    const geralSquad = String(data.awayTableData.Squad || '').trim();
    const complementSquad = String((data.awayComplementData as { Squad?: string })?.Squad || '').trim();
    if (geralSquad && complementSquad && geralSquad !== complementSquad) {
      warnings.push(`Divergência de Squad: tabela geral vs complemento legado (visitante): "${geralSquad}" vs "${complementSquad}"`);
    }
  }

  if (data.homeComplementData && data.awayComplementData && !data.competitionComplementAvg) {
    warnings.push('Complemento legado: há linhas dos dois times mas falta competitionComplementAvg');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}

function normalizeMatchData(data: MatchData): MatchData {
  // competitionAvg deve representar média de gols por jogo (ex.: 2.6, 3.1).
  // Valores muito altos (>10) geralmente indicam dado antigo/corrompido (ex.: percentual) e devem ser ignorados.
  const normalizedCompetitionAvg =
    typeof data.competitionAvg === 'number' &&
    Number.isFinite(data.competitionAvg) &&
    data.competitionAvg > 0 &&
    data.competitionAvg <= 10
      ? data.competitionAvg
      : 0;

  const hasGeral = !!(data.homeTableData && data.awayTableData);
  const hasComplementFull =
    !!data.homeComplementData &&
    !!data.awayComplementData &&
    !!data.competitionComplementAvg;

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] normalizeMatchData — tabela geral e complemento (legado):', {
      geral: hasGeral,
      complementoCompleto: hasComplementFull,
    });
  }

  // Validar integridade dos dados das tabelas
  const integrityCheck = validateTableDataIntegrity(data);
  if (import.meta.env.DEV) {
    if (integrityCheck.issues.length > 0) {
      console.error('[AnalysisEngine] ⚠️ Problemas de integridade encontrados:', integrityCheck.issues);
    }
    if (integrityCheck.warnings.length > 0) {
      console.warn('[AnalysisEngine] ⚠️ Avisos de integridade:', integrityCheck.warnings);
    }
    if (integrityCheck.isValid && integrityCheck.warnings.length === 0) {
      console.log('[AnalysisEngine] ✅ Integridade dos dados das tabelas validada com sucesso');
    }
  }

  return {
    ...data,
    // Campos deprecated: usar valores padrão se não existirem
    homeOver15Freq: data.homeOver15Freq ?? 0,
    awayOver15Freq: data.awayOver15Freq ?? 0,
    // Garantir arrays vazios se não existirem
    homeHistory: data.homeHistory ?? [],
    awayHistory: data.awayHistory ?? [],
    // Garantir valores numéricos padrão
    competitionAvg: normalizedCompetitionAvg,
    h2hOver15Freq: data.h2hOver15Freq ?? 0,
    matchImportance: data.matchImportance ?? 0,
    keyAbsences: data.keyAbsences ?? 'none',
    // Preservar tabela geral e complemento legado; importExtras não entra no cálculo Poisson
    homeTableData: stripImportExtrasFromRow(data.homeTableData),
    awayTableData: stripImportExtrasFromRow(data.awayTableData),
    homeComplementData: data.homeComplementData,
    awayComplementData: data.awayComplementData,
    competitionComplementAvg: data.competitionComplementAvg,
  };
}

/**
 * Executa análise completa de uma partida para Over 1.5 goals usando algoritmo Poisson v4.0.
 * Combina estatísticas históricas (últimos 10 jogos) com dados da tabela (temporada completa)
 * para calcular probabilidade, EV, risco e recomendações de aposta.
 *
 * @param data - Dados da partida incluindo estatísticas dos times e competição
 * @returns Resultado da análise com probabilidades, métricas e recomendações
 * @throws Error se dados de entrada forem inválidos
 */
export function performAnalysis(data: MatchData): AnalysisResult {
  // Validar entrada
  if (!data || typeof data !== 'object') {
    throw new Error('Dados de entrada inválidos: data deve ser um objeto');
  }

  if (!data.homeTeam || !data.awayTeam) {
    throw new Error('Dados de entrada inválidos: homeTeam e awayTeam são obrigatórios');
  }

  // Log inicial: verificar dados recebidos ANTES de normalizar
  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] ===== INÍCIO DA ANÁLISE =====');
    console.log('[AnalysisEngine] Dados recebidos (ANTES de normalizar):', {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      tabelas: {
        geral: !!(data.homeTableData && data.awayTableData),
        complementoLegadoCompleto: !!(
          data.homeComplementData &&
          data.awayComplementData &&
          data.competitionComplementAvg
        ),
      },
    });
  }

  // Normalizar dados para garantir valores padrão seguros
  const normalizedData = normalizeMatchData(data);

  // Log após normalização: verificar se dados foram preservados
  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Dados normalizados (APÓS normalizar):', {
      tabelas: {
        geral: !!(normalizedData.homeTableData && normalizedData.awayTableData),
      },
    });
  }
  
  // Extrair campos deprecated com valores padrão (para compatibilidade com dados antigos)
  const homeOver15Freq = normalizedData.homeOver15Freq ?? 0;
  const awayOver15Freq = normalizedData.awayOver15Freq ?? 0;

  // Validação e observabilidade de dados
  const hasHomeTeamStats = !!normalizedData.homeTeamStats;
  const hasAwayTeamStats = !!normalizedData.awayTeamStats;
  const hasHomeTableData = !!normalizedData.homeTableData;
  const hasAwayTableData = !!normalizedData.awayTableData;
  const competitionAvg = normalizedData.competitionAvg || 0;
  const hasCompetitionAvg = competitionAvg > 0;

  // Validar completude dos dados essenciais
  const dataCompleteness = {
    hasHomeTeamStats,
    hasAwayTeamStats,
    hasHomeTableData,
    hasAwayTableData,
    hasCompetitionAvg,
  };

  const missingData: string[] = [];
  if (!hasHomeTeamStats) missingData.push('Estatísticas Globais do time da casa');
  if (!hasAwayTeamStats) missingData.push('Estatísticas Globais do time visitante');
  if (!hasCompetitionAvg) missingData.push('Média da competição');

  const missingTables: string[] = [];
  if (!hasHomeTableData || !hasAwayTableData) {
    missingTables.push('geral');
  }

  // Calcular resumo de impacto das tabelas
  const tableImpactSummary = getTableImpactSummary(normalizedData);
  const tableCompleteness = calculateTableCompletenessScore(normalizedData);

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] ===== RESUMO DE DADOS E TABELAS =====');
    console.log('[AnalysisEngine] Dados normalizados:', {
      homeOver15Freq,
      awayOver15Freq,
      dataCompleteness,
      missingData: missingData.length > 0 ? missingData : 'Nenhum',
      missingTables: missingTables.length > 0 ? missingTables : 'Nenhuma',
    });

    // Avisar se dados essenciais estão faltando
    if (missingData.length > 0) {
      console.warn('[AnalysisEngine] Dados essenciais faltando:', missingData);
      console.warn('[AnalysisEngine] A análise pode ser menos confiável sem esses dados.');
    }

    console.log('[AnalysisEngine] --- Tabela de classificação (liga) ---');
    console.log('[AnalysisEngine] Tabela GERAL:', {
      disponível: tableImpactSummary.geral.available,
      impacto: tableImpactSummary.geral.impact,
    });

    console.log('[AnalysisEngine] --- Completude das Tabelas ---');
    console.log('[AnalysisEngine] Score de completude:', `${(tableCompleteness.score * 100).toFixed(0)}%`);
    console.log('[AnalysisEngine] Tabelas disponíveis:', tableCompleteness.availableTables.join(', ') || 'Nenhuma');
    if (tableCompleteness.missingTables.length > 0) {
      console.warn('[AnalysisEngine] Tabelas faltando:', tableCompleteness.missingTables.join(', '));
    }

    if (tableCompleteness.score === 1.0) {
      console.log('[AnalysisEngine] ✅ Tabela geral disponível (casa + visitante) — base de liga ativa');
    } else {
      console.warn('[AnalysisEngine] ⚠️ Tabela geral ausente ou incompleta — precisão da parte “liga” reduzida');
    }

    if (missingTables.length > 0) {
      console.warn(
        `[AnalysisEngine] ⚠️ ATENÇÃO: ${missingTables.length} tabela(s) não disponível(is): ${missingTables.join(', ')}`
      );
      console.warn(
        '[AnalysisEngine] A análise usará o que estiver disponível (estatísticas manuais e/ou dados parciais da liga).'
      );
      console.warn(
        '[AnalysisEngine] Recomendação: importe o JSON de classificação em Campeonatos e sincronize a partida.'
      );
    } else {
      console.log('[AnalysisEngine] ✅ Dados de classificação da liga disponíveis para ambos os times.');
    }
  }

  // NOVO ALGORITMO: Baseado em estatísticas da tabela e dados disponíveis

  // 1. Obter média da competição (baseline importante)
  // 2. Calcular média total de gols (avgTotal de ambos times)
  // Usar estatísticas específicas: home para time da casa, away para visitante
  // Se não disponíveis, usar dados da tabela como fallback
  let homeAvgTotal = normalizedData.homeTeamStats?.gols?.home?.avgTotal || 0;
  let awayAvgTotal = normalizedData.awayTeamStats?.gols?.away?.avgTotal || 0;
  
  // Fallback: usar dados da tabela se Estatísticas Globais não estiverem disponíveis
  if (homeAvgTotal === 0 && normalizedData.homeTableData) {
    const mp = parseFloat(normalizedData.homeTableData.MP || '0');
    const gf = parseFloat(normalizedData.homeTableData.GF || '0');
    const ga = parseFloat(normalizedData.homeTableData.GA || '0');
    if (mp > 0) {
      const avgScored = gf / mp;
      const avgConceded = ga / mp;
      homeAvgTotal = avgScored + avgConceded;
      if (import.meta.env.DEV) {
        console.log('[AnalysisEngine] Usando dados da tabela como fallback para time da casa:', {
          avgScored,
          avgConceded,
          avgTotal: homeAvgTotal,
        });
      }
    }
  }
  
  if (awayAvgTotal === 0 && normalizedData.awayTableData) {
    const mp = parseFloat(normalizedData.awayTableData.MP || '0');
    const gf = parseFloat(normalizedData.awayTableData.GF || '0');
    const ga = parseFloat(normalizedData.awayTableData.GA || '0');
    if (mp > 0) {
      const avgScored = gf / mp;
      const avgConceded = ga / mp;
      awayAvgTotal = avgScored + avgConceded;
      if (import.meta.env.DEV) {
        console.log('[AnalysisEngine] Usando dados da tabela como fallback para time visitante:', {
          avgScored,
          avgConceded,
          avgTotal: awayAvgTotal,
        });
      }
    }
  }
  
  const avgTotal = (homeAvgTotal + awayAvgTotal) / 2;

  // 3. Calcular médias de cleanSheet e noGoals
  const homeCleanSheet = normalizedData.homeTeamStats?.gols?.home?.cleanSheetPct || 0;
  const awayCleanSheet = normalizedData.awayTeamStats?.gols?.away?.cleanSheetPct || 0;
  const avgCleanSheet = (homeCleanSheet + awayCleanSheet) / 2;

  const homeNoGoals = normalizedData.homeTeamStats?.gols?.home?.noGoalsPct || 0;
  const awayNoGoals = normalizedData.awayTeamStats?.gols?.away?.noGoalsPct || 0;
  const avgNoGoals = (homeNoGoals + awayNoGoals) / 2;

  // 4. Calcular média de Over 2.5% (confirma tendência ofensiva)
  const homeOver25 = normalizedData.homeTeamStats?.gols?.home?.over25Pct || 0;
  const awayOver25 = normalizedData.awayTeamStats?.gols?.away?.over25Pct || 0;
  const avgOver25 = (homeOver25 + awayOver25) / 2;

  // 5. Calcular Over 1.5% estimado baseado em médias de gols e estatísticas
  // Se avgTotal > 1.5, probabilidade base é alta
  // Usar dados da tabela quando disponíveis
  const hasTeamStats = !!(normalizedData.homeTeamStats && normalizedData.awayTeamStats);
  
  // MELHORIA: Calcular probabilidade base com pesos adaptativos para dados recentes
  // Estatísticas Globais (últimos 10 jogos) têm mais peso que dados históricos da tabela
  let estimatedOver15Freq = 50; // Baseline
  
  // Calcular probabilidade base usando dados mais recentes quando disponíveis
  if (avgTotal > 0) {
    // Ajustar baseado em recência dos dados
    // Se temos Estatísticas Globais (últimos 10 jogos), dar mais peso
    // Se só temos dados da tabela (temporada completa), dar menos peso
    const recencyWeight = hasTeamStats ? 1.0 : 0.85; // Estatísticas Globais = 100%, Tabela = 85%
    
    if (avgTotal >= 2.5) {
      estimatedOver15Freq = 90 + (avgTotal - 2.5) * 4; // 90-100%
    } else if (avgTotal >= 2.0) {
      estimatedOver15Freq = 75 + (avgTotal - 2.0) * 30; // 75-90%
    } else if (avgTotal >= 1.5) {
      estimatedOver15Freq = 60 + (avgTotal - 1.5) * 30; // 60-75%
    } else {
      estimatedOver15Freq = 30 + (avgTotal / 1.5) * 30; // 30-60%
    }
    
    // Aplicar peso de recência
    estimatedOver15Freq = estimatedOver15Freq * recencyWeight + 50 * (1 - recencyWeight);
  }

  // Ajustar baseado em cleanSheet e noGoals (com peso adaptativo)
  const cleanSheetWeight = hasTeamStats ? 0.3 : 0.2; // Menos peso se usando dados da tabela
  const noGoalsWeight = hasTeamStats ? 0.2 : 0.15;
  const over25Weight = hasTeamStats ? 0.2 : 0.15;
  
  estimatedOver15Freq -= avgCleanSheet * cleanSheetWeight; // Reduzir se muitas clean sheets
  estimatedOver15Freq -= avgNoGoals * noGoalsWeight; // Reduzir se muitos jogos sem gols
  estimatedOver15Freq += avgOver25 * over25Weight; // Aumentar se muitos Over 2.5

  // Limitar entre 10% e 98%
  estimatedOver15Freq = Math.max(10, Math.min(98, estimatedOver15Freq));

  // 6. Calcular pesos adaptativos
  const weights = calculateAdaptiveWeights(
    estimatedOver15Freq,
    estimatedOver15Freq, // Usar mesma estimativa para ambos (já calculada com dados de ambos)
    competitionAvg,
    hasTeamStats
  );

  // Aplicar fórmula ponderada adaptativa
  let prob =
    estimatedOver15Freq * weights.homeWeight +
    estimatedOver15Freq * weights.awayWeight +
    competitionAvg * weights.competitionWeight;

  // Ajustes suaves baseados em métricas (usando funções sigmoid em vez de if/else fixos)
  // Ajuste baseado em média total de gols
  if (avgTotal > 0) {
    const avgTotalAdjustment = smoothAdjustment(avgTotal, 2.0, 8);
    prob += avgTotalAdjustment;
  }

  // Ajuste baseado em clean sheet (defesas muito boas reduzem probabilidade)
  if (avgCleanSheet > 0) {
    const cleanSheetAdjustment = smoothAdjustment(avgCleanSheet, 40, -6);
    prob += cleanSheetAdjustment;
  }

  // Ajuste baseado em jogos sem marcar (ataques fracos reduzem probabilidade)
  if (avgNoGoals > 0) {
    const noGoalsAdjustment = smoothAdjustment(avgNoGoals, 20, -4);
    prob += noGoalsAdjustment;
  }

  // Ajuste baseado em Over 2.5% (confirma tendência ofensiva)
  if (avgOver25 > 0) {
    const over25Adjustment = smoothAdjustment(avgOver25, 50, 3);
    prob += over25Adjustment;
  }

  // Analisar forma recente (Last 5) da tabela
  let recentFormAdjustment = 0;
  if (normalizedData.homeTableData?.['Last 5'] || normalizedData.awayTableData?.['Last 5']) {
    const parseRecentForm = (last5: string | undefined): number => {
      if (!last5 || last5.trim() === '') return 0;
      
      // Converter "WWDLW" em tendência ofensiva
      // W (Win) = +1, D (Draw) = 0, L (Loss) = -1
      // Times que ganham mais tendem a marcar mais gols
      let offensiveTrend = 0;
      const matches = last5.trim().toUpperCase().split('');
      
      for (const match of matches) {
        if (match === 'W') offensiveTrend += 1;
        else if (match === 'D') offensiveTrend += 0;
        else if (match === 'L') offensiveTrend -= 0.5; // Derrotas podem indicar problemas ofensivos
      }
      
      // Normalizar para -1 a 1 (5 jogos)
      return offensiveTrend / 5;
    };
    
    const homeForm = parseRecentForm(normalizedData.homeTableData?.['Last 5']);
    const awayForm = parseRecentForm(normalizedData.awayTableData?.['Last 5']);
    const avgForm = (homeForm + awayForm) / 2;
    
    // Ajustar probabilidade baseado em forma recente
    // Forma positiva (+1) aumenta probabilidade em até 3%
    // Forma negativa (-1) reduz probabilidade em até 3%
    recentFormAdjustment = avgForm * 3;
    prob += recentFormAdjustment;
    
    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] Análise de forma recente:', {
        homeLast5: normalizedData.homeTableData?.['Last 5'],
        awayLast5: normalizedData.awayTableData?.['Last 5'],
        homeForm,
        awayForm,
        avgForm,
        adjustment: recentFormAdjustment,
      });
    }
  }

  // Considerar H2H se disponível - análise melhorada
  let h2hAdjustment = 0;
  if (normalizedData.h2hOver15Freq > 0) {
    const h2hWeight = 0.15; // Peso moderado para H2H
    prob = prob * (1 - h2hWeight) + normalizedData.h2hOver15Freq * h2hWeight;
  }
  
  // Análise detalhada de confrontos diretos se disponível
  if (normalizedData.h2hMatches && normalizedData.h2hMatches.length > 0) {
    const h2hMatches = normalizedData.h2hMatches;
    
    // Calcular média de gols nos confrontos diretos
    const h2hTotalGoals = h2hMatches.reduce((sum, m) => sum + m.totalGoals, 0);
    const h2hAvgGoals = h2hTotalGoals / h2hMatches.length;
    
    // Analisar padrões
    const over15Count = h2hMatches.filter((m) => m.totalGoals > 1.5).length;
    const over25Count = h2hMatches.filter((m) => m.totalGoals > 2.5).length;
    const h2hOver15Pct = (over15Count / h2hMatches.length) * 100;
    const h2hOver25Pct = (over25Count / h2hMatches.length) * 100;
    
    // Ajustar probabilidade baseado em padrões H2H
    if (h2hAvgGoals > 2.5) {
      // Confrontos históricos com muitos gols
      h2hAdjustment += 2;
    } else if (h2hAvgGoals < 1.5) {
      // Confrontos históricos com poucos gols
      h2hAdjustment -= 2;
    }
    
    // Se H2H mostra padrão consistente de Over 1.5, aumentar probabilidade
    if (h2hOver15Pct >= 80) {
      h2hAdjustment += 1.5;
    } else if (h2hOver15Pct <= 20) {
      h2hAdjustment -= 1.5;
    }
    
    // Se H2H mostra padrão de Over 2.5, também aumenta Over 1.5
    if (h2hOver25Pct >= 60) {
      h2hAdjustment += 1;
    }
    
    prob += h2hAdjustment;
    
    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] Análise H2H detalhada:', {
        matchesCount: h2hMatches.length,
        h2hAvgGoals,
        h2hOver15Pct,
        h2hOver25Pct,
        adjustment: h2hAdjustment,
      });
    }
  }

  // xG no formulário: só ajusta `prob` legada quando não há bloco completo de TeamStatistics (evita duplicar o blend no λ)
  const hasFullTeamStatsForXG = !!(
    normalizedData.homeTeamStats &&
    normalizedData.awayTeamStats
  );
  if (!hasFullTeamStatsForXG && normalizedData.homeXG > 0 && normalizedData.awayXG > 0) {
    const avgXG = (normalizedData.homeXG + normalizedData.awayXG) / 2;
    if (avgXG > 2.5) prob += 3;
    else if (avgXG < 1.5) prob -= 3;
  }

  // Se não temos dados suficientes (nem campos deprecated nem dados novos), usar apenas média da competição como baseline
  // Usar estimatedOver15Freq em vez de campos deprecated
  if (estimatedOver15Freq === 50 && competitionAvg > 0) {
    prob = competitionAvg;
  }

  // Suavizar limites usando sigmoid (10-98% mais realista)
  prob = smoothClamp(prob, 10, 98);

  // Calcular Poisson para visualização (usando médias de gols se disponíveis)
  // PRIORIDADE: Usar dados weighted (combinam home/away/global) se disponíveis
  let homeGoalsScored = 0;
  let homeGoalsConceded = 0;
  let awayGoalsScored = 0;
  let awayGoalsConceded = 0;
  
  // Usar dados weighted se temos estatísticas globais (alinhado ao blend gols+xG do ramo estatísticas)
  if (normalizedData.homeTeamStats && normalizedData.awayTeamStats) {
    const homeWeighted = getWeightedTeamStats(
      normalizedData.homeTeamStats.gols.home,
      normalizedData.homeTeamStats.gols.away,
      normalizedData.homeTeamStats.gols.global,
      'home'
    );
    const awayWeighted = getWeightedTeamStats(
      normalizedData.awayTeamStats.gols.home,
      normalizedData.awayTeamStats.gols.away,
      normalizedData.awayTeamStats.gols.global,
      'away'
    );

    const histHS = homeWeighted.avgScored;
    const histAS = awayWeighted.avgScored;
    const homePull =
      normalizedData.homeXG > 0
        ? normalizedData.homeXG
        : normalizedData.homeGoalsScoredAtHome != null && normalizedData.homeGoalsScoredAtHome > 0
          ? normalizedData.homeGoalsScoredAtHome
          : histHS;
    const awayPull =
      normalizedData.awayXG > 0
        ? normalizedData.awayXG
        : normalizedData.awayGoalsScoredAway != null && normalizedData.awayGoalsScoredAway > 0
          ? normalizedData.awayGoalsScoredAway
          : histAS;

    homeGoalsScored = blendAttackRate(
      blendHistoricWithFormSnapshot(histHS, homePull),
      normalizedData.homeXG > 0 ? normalizedData.homeXG : 0
    );
    awayGoalsScored = blendAttackRate(
      blendHistoricWithFormSnapshot(histAS, awayPull),
      normalizedData.awayXG > 0 ? normalizedData.awayXG : 0
    );
    homeGoalsConceded = homeWeighted.avgConceded;
    awayGoalsConceded = awayWeighted.avgConceded;

    if (normalizedData.homeXG > 0) {
      homeGoalsScored *= finishingLambdaFactor(xgFinishDelta(histHS, normalizedData.homeXG));
    }
    if (normalizedData.awayXG > 0) {
      awayGoalsScored *= finishingLambdaFactor(xgFinishDelta(histAS, normalizedData.awayXG));
    }
    homeGoalsScored *= volumeOffenseFactor({
      shotsOnTarget: normalizedData.homeShotsOnTarget,
      xa: normalizedData.homeXA,
      progressivePasses: normalizedData.homeProgressivePasses,
      keyPasses: normalizedData.homeKeyPasses,
    });
    awayGoalsScored *= volumeOffenseFactor({
      shotsOnTarget: normalizedData.awayShotsOnTarget,
      xa: normalizedData.awayXA,
      progressivePasses: normalizedData.awayProgressivePasses,
      keyPasses: normalizedData.awayKeyPasses,
    });
  }
  
  // Usar dados da tabela geral
  if (normalizedData.homeTableData) {
    const mp = parseFloat(normalizedData.homeTableData['Home MP'] || normalizedData.homeTableData.MP || '0');
    const gf = parseFloat(normalizedData.homeTableData['Home GF'] || normalizedData.homeTableData.GF || '0');
    const ga = parseFloat(normalizedData.homeTableData['Home GA'] || normalizedData.homeTableData.GA || '0');
    if (mp > 0) {
      homeGoalsScored = gf / mp;
      homeGoalsConceded = ga / mp;
    }
  }
  
  if (normalizedData.awayTableData) {
    const mp = parseFloat(normalizedData.awayTableData['Away MP'] || normalizedData.awayTableData.MP || '0');
    const gf = parseFloat(normalizedData.awayTableData['Away GF'] || normalizedData.awayTableData.GF || '0');
    const ga = parseFloat(normalizedData.awayTableData['Away GA'] || normalizedData.awayTableData.GA || '0');
    if (mp > 0) {
      awayGoalsScored = gf / mp;
      awayGoalsConceded = ga / mp;
    }
  }
  
  // Garantir valores mínimos para evitar divisão por zero
  homeGoalsScored = homeGoalsScored || 1.0;
  homeGoalsConceded = homeGoalsConceded || 1.0;
  awayGoalsScored = awayGoalsScored || 1.0;
  awayGoalsConceded = awayGoalsConceded || 1.0;
  
  // Usar xG e xGA da tabela para ajustes finos se disponíveis (formato completo)
  // Verificar se dados xG existem e têm valores válidos
  const hasHomeXg = normalizedData.homeTableData?.['Home xG'] || normalizedData.homeTableData?.xG;
  const hasAwayXga = normalizedData.awayTableData?.['Away xGA'] || normalizedData.awayTableData?.['Home xGA'] || normalizedData.awayTableData?.xGA;
  const homeXgValue = hasHomeXg ? parseFloat(String(hasHomeXg)) : 0;
  const awayXgaValue = hasAwayXga ? parseFloat(String(hasAwayXga)) : 0;
  
  if (homeXgValue > 0 && awayXgaValue > 0) {
    // Ajustar lambdaHome considerando xG (mais preciso que GF/MP)
    const adjustedHomeGoals = (homeGoalsScored + homeXgValue) / 2;
    const adjustedAwayConceded = (awayGoalsConceded + awayXgaValue) / 2;
    homeGoalsScored = adjustedHomeGoals;
    awayGoalsConceded = adjustedAwayConceded;
  }
  
  const hasAwayXg = normalizedData.awayTableData?.['Away xG'] || normalizedData.awayTableData?.xG;
  const hasHomeXga = normalizedData.homeTableData?.['Home xGA'] || normalizedData.homeTableData?.xGA;
  const awayXgValue = hasAwayXg ? parseFloat(String(hasAwayXg)) : 0;
  const homeXgaValue = hasHomeXga ? parseFloat(String(hasHomeXga)) : 0;
  
  if (awayXgValue > 0 && homeXgaValue > 0) {
    // Ajustar lambdaAway considerando xG (mais preciso que GF/MP)
    const adjustedAwayGoals = (awayGoalsScored + awayXgValue) / 2;
    const adjustedHomeConceded = (homeGoalsConceded + homeXgaValue) / 2;
    awayGoalsScored = adjustedAwayGoals;
    homeGoalsConceded = adjustedHomeConceded;
  }

  // Calcular lambda base usando dados weighted (já combinam home/away/global)
  let lambdaHome = (homeGoalsScored + awayGoalsConceded) / 2;
  let lambdaAway = (awayGoalsScored + homeGoalsConceded) / 2;
  
  // Aplicar melhorias profissionais ao lambda se temos dados completos
  if (normalizedData.homeTeamStats && normalizedData.awayTeamStats) {
    const homeWeighted = getWeightedTeamStats(
      normalizedData.homeTeamStats.gols.home,
      normalizedData.homeTeamStats.gols.away,
      normalizedData.homeTeamStats.gols.global,
      'home'
    );
    const awayWeighted = getWeightedTeamStats(
      normalizedData.awayTeamStats.gols.home,
      normalizedData.awayTeamStats.gols.away,
      normalizedData.awayTeamStats.gols.global,
      'away'
    );
    
    // 1. Ajustar baseado na força do oponente
    const homeOpponentStrength = calculateOpponentStrength(
      awayWeighted,
      normalizedData.awayTableData,
      'awaySlice'
    );
    const awayOpponentStrength = calculateOpponentStrength(
      homeWeighted,
      normalizedData.homeTableData,
      'homeSlice'
    );
    
    lambdaHome *= (1 - homeOpponentStrength.defensiveStrength * 0.08); // Até -8% se defesa muito forte
    lambdaHome *= (1 + homeOpponentStrength.offensiveStrength * 0.04); // Até +4% se ataque forte
    
    lambdaAway *= (1 - awayOpponentStrength.defensiveStrength * 0.08);
    lambdaAway *= (1 + awayOpponentStrength.offensiveStrength * 0.04);
    
    // 2. Ajustar baseado em momentum (forma recente)
    const homeMomentum = calculateMomentum(
      normalizedData.homeHistory || [],
      homeWeighted.avgScored,
      homeWeighted.avgConceded,
      true
    );
    const awayMomentum = calculateMomentum(
      normalizedData.awayHistory || [],
      awayWeighted.avgScored,
      awayWeighted.avgConceded,
      false
    );
    
    const homeMomentumAdjustment = homeMomentum.offensiveMomentum * 0.08 - homeMomentum.defensiveMomentum * 0.04;
    const awayMomentumAdjustment = awayMomentum.offensiveMomentum * 0.08 - awayMomentum.defensiveMomentum * 0.04;
    
    lambdaHome *= (1 + homeMomentumAdjustment);
    lambdaAway *= (1 + awayMomentumAdjustment);
    
    // 3. Ajustar baseado em clean sheet e no goals (usando dados weighted)
    const avgCleanSheet = (homeWeighted.cleanSheetPct + awayWeighted.cleanSheetPct) / 2;
    const avgNoGoals = (homeWeighted.noGoalsPct + awayWeighted.noGoalsPct) / 2;
    
    if (avgCleanSheet > 40) {
      const reduction = Math.min(0.06, (avgCleanSheet - 40) / 100);
      lambdaHome *= (1 - reduction * 0.5);
      lambdaAway *= (1 - reduction * 0.5);
    }
    
    if (avgNoGoals > 20) {
      const reduction = Math.min(0.05, (avgNoGoals - 20) / 100);
      lambdaHome *= (1 - reduction * 0.5);
      lambdaAway *= (1 - reduction * 0.5);
    }
    
    // 4. Ajustar baseado em over 2.5% (confirma tendência ofensiva)
    const avgOver25 = (homeWeighted.over25Pct + awayWeighted.over25Pct) / 2;
    if (avgOver25 > 50) {
      const increase = Math.min(0.04, (avgOver25 - 50) / 100);
      lambdaHome *= (1 + increase * 0.5);
      lambdaAway *= (1 + increase * 0.5);
    }
    
    // 5. Validar consistência e aplicar penalidade se necessário
    const homeConsistency = validateStatsConsistency(
      normalizedData.homeTeamStats.gols.home,
      normalizedData.homeTeamStats.gols.away,
      normalizedData.homeTeamStats.gols.global
    );
    const awayConsistency = validateStatsConsistency(
      normalizedData.awayTeamStats.gols.home,
      normalizedData.awayTeamStats.gols.away,
      normalizedData.awayTeamStats.gols.global
    );
    
    const consistencyAdjustment = (homeConsistency.consistencyScore + awayConsistency.consistencyScore) / 2;
    if (consistencyAdjustment < 0.7) {
      // Penalidade de 3% se dados inconsistentes
      lambdaHome *= 0.97;
      lambdaAway *= 0.97;
    }
  }

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] performAnalysis - Lambdas iniciais (base estatísticas):', {
      lambdaHome,
      lambdaAway,
      homeGoalsScored,
      awayGoalsConceded,
      awayGoalsScored,
      homeGoalsConceded,
    });
  }

  const lambdaTotal = lambdaHome + lambdaAway; // Média total de gols esperados no jogo (para Poisson combinado)

  const pHome: number[] = [];
  const pAway: number[] = [];
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHome));
    pAway.push(poissonProbability(i, lambdaAway));
  }

  let ev = 0;
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    ev = calculateEVPercent(prob, normalizedData.oddOver15);
  }

  // Métricas avançadas melhoradas
  const offensiveVolume = Math.min(100, Math.max(0, (avgTotal / 3) * 100));
  const defensiveLeaking = Math.min(
    100,
    Math.max(0, ((homeGoalsConceded + awayGoalsConceded) / 2) * 50)
  );
  const bttsCorrelation = Math.min(100, Math.max(0, 100 - avgCleanSheet));

  const finishingParts: number[] = [];
  if (normalizedData.homeGoalsScoredAvg > 0 && normalizedData.homeXG > 0) {
    finishingParts.push(xgFinishDelta(normalizedData.homeGoalsScoredAvg, normalizedData.homeXG));
  }
  if (normalizedData.awayGoalsScoredAvg > 0 && normalizedData.awayXG > 0) {
    finishingParts.push(xgFinishDelta(normalizedData.awayGoalsScoredAvg, normalizedData.awayXG));
  }
  const finishingSignal =
    finishingParts.length > 0
      ? Math.round((finishingParts.reduce((a, b) => a + b, 0) / finishingParts.length) * 1000) / 10
      : 0;

  // Calcular tendência de forma baseada em histórico recente se disponível
  let formTrend = 0;
  if (
    normalizedData.homeHistory &&
    normalizedData.awayHistory &&
    normalizedData.homeHistory.length > 0 &&
    normalizedData.awayHistory.length > 0
  ) {
    // Analisar últimos 3 jogos de cada time
    const recentHome = normalizedData.homeHistory.slice(0, 3);
    const recentAway = normalizedData.awayHistory.slice(0, 3);

    // Contar gols totais nos últimos jogos
    const homeRecentGoals =
      recentHome.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / recentHome.length;
    const awayRecentGoals =
      recentAway.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / recentAway.length;
    const recentAvg = (homeRecentGoals + awayRecentGoals) / 2;

    // Comparar com média histórica
    if (recentAvg > avgTotal) {
      formTrend = Math.min(10, (recentAvg - avgTotal) * 2); // Tendência positiva
    } else if (recentAvg < avgTotal) {
      formTrend = Math.max(-10, (recentAvg - avgTotal) * 2); // Tendência negativa
    }
  }

  // Score de confiança melhorado baseado na qualidade, completude e consistência dos dados
  let confidence = 30; // Base mais baixa

  // Pontos por dados fundamentais (usar estimatedOver15Freq em vez de campos deprecated)
  // Se temos dados estimados válidos (não é o baseline de 50), considerar como dados disponíveis
  if (estimatedOver15Freq > 50) confidence += 15;
  if (estimatedOver15Freq > 50) confidence += 15; // Mesmo valor para ambos (já calculado com dados de ambos)
  if (competitionAvg > 0) confidence += 10;

  // Pontos por estatísticas detalhadas
  if (hasTeamStats) {
    confidence += 20;
    if (homeAvgTotal > 0 && awayAvgTotal > 0) confidence += 5;
    if (avgCleanSheet > 0 || avgNoGoals > 0) confidence += 5;
  }

  // Pontos por dados adicionais
  if (normalizedData.h2hOver15Freq > 0) confidence += 5;
  if (normalizedData.homeXG > 0 && normalizedData.awayXG > 0) confidence += 5;

  // Bônus por tabela geral da liga (casa + visitante)
  if (tableCompleteness.score >= 1.0) {
    confidence += 15;
    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] ✅ Bônus de confiança: tabela de classificação completa (+15)');
    }
  } else {
    confidence = Math.max(confidence - 5, 20);
    if (import.meta.env.DEV) {
      console.warn('[AnalysisEngine] ⚠️ Penalidade de confiança: dados de liga ausentes (-5)');
      console.warn('[AnalysisEngine] Tabelas faltando:', tableCompleteness.missingTables);
    }
  }

  // Validação cruzada melhorada: comparar Estatísticas Globais (home/away/global) com dados da tabela
  let consistencyBonus = 0;
  let crossValidationScore = 0;
  
  if (hasHomeTeamStats && hasHomeTableData) {
    // Usar dados weighted (já combinam home/away/global)
    const homeWeighted = getWeightedTeamStats(
      normalizedData.homeTeamStats.gols.home,
      normalizedData.homeTeamStats.gols.away,
      normalizedData.homeTeamStats.gols.global,
      'home'
    );
    
    const mp = parseFloat(normalizedData.homeTableData.MP || '0');
    const gf = parseFloat(normalizedData.homeTableData.GF || '0');
    const ga = parseFloat(normalizedData.homeTableData.GA || '0');
    
    if (mp > 0 && homeWeighted.avgScored > 0) {
      const tableAvgScored = gf / mp;
      const tableAvgConceded = ga / mp;
      const scoredDiff = Math.abs(homeWeighted.avgScored - tableAvgScored);
      const concededDiff = Math.abs(homeWeighted.avgConceded - tableAvgConceded);
      
      // Se diferença < 0.3 gols, dados são consistentes
      if (scoredDiff < 0.3 && concededDiff < 0.3) {
        consistencyBonus += 3;
        crossValidationScore += 0.5;
      } else if (scoredDiff < 0.5 && concededDiff < 0.5) {
        // Consistência moderada
        consistencyBonus += 1;
        crossValidationScore += 0.25;
      }
      
      // Validar também dados Global separadamente
      const globalScoredDiff = Math.abs(normalizedData.homeTeamStats.gols.global.avgScored - tableAvgScored);
      const globalConcededDiff = Math.abs(normalizedData.homeTeamStats.gols.global.avgConceded - tableAvgConceded);
      
      if (globalScoredDiff < 0.3 && globalConcededDiff < 0.3) {
        crossValidationScore += 0.3; // Bônus adicional se Global também é consistente
      }
    }
  }
  
  if (hasAwayTeamStats && hasAwayTableData) {
    // Usar dados weighted (já combinam home/away/global)
    const awayWeighted = getWeightedTeamStats(
      normalizedData.awayTeamStats.gols.home,
      normalizedData.awayTeamStats.gols.away,
      normalizedData.awayTeamStats.gols.global,
      'away'
    );
    
    const mp = parseFloat(normalizedData.awayTableData.MP || '0');
    const gf = parseFloat(normalizedData.awayTableData.GF || '0');
    const ga = parseFloat(normalizedData.awayTableData.GA || '0');
    
    if (mp > 0 && awayWeighted.avgScored > 0) {
      const tableAvgScored = gf / mp;
      const tableAvgConceded = ga / mp;
      const scoredDiff = Math.abs(awayWeighted.avgScored - tableAvgScored);
      const concededDiff = Math.abs(awayWeighted.avgConceded - tableAvgConceded);
      
      if (scoredDiff < 0.3 && concededDiff < 0.3) {
        consistencyBonus += 3;
        crossValidationScore += 0.5;
      } else if (scoredDiff < 0.5 && concededDiff < 0.5) {
        consistencyBonus += 1;
        crossValidationScore += 0.25;
      }
      
      // Validar também dados Global separadamente
      const globalScoredDiff = Math.abs(normalizedData.awayTeamStats.gols.global.avgScored - tableAvgScored);
      const globalConcededDiff = Math.abs(normalizedData.awayTeamStats.gols.global.avgConceded - tableAvgConceded);
      
      if (globalScoredDiff < 0.3 && globalConcededDiff < 0.3) {
        crossValidationScore += 0.3;
      }
    }
  }
  
  confidence += consistencyBonus;
  
  // Aplicar bônus de validação cruzada (até +5 pontos se todos os dados são consistentes)
  if (crossValidationScore >= 1.0) {
    confidence += 5;
    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] ✅ Validação cruzada: todos os dados (home/away/global) consistentes com tabela');
    }
  } else if (crossValidationScore >= 0.5) {
    confidence += 2;
    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] ⚠️ Validação cruzada: consistência parcial entre dados');
    }
  }

  // Verificar qualidade dos dados (se são realistas)
  let qualityBonus = 0;
  if (homeAvgTotal > 0 && homeAvgTotal < 6 && awayAvgTotal > 0 && awayAvgTotal < 6) {
    // Médias entre 0 e 6 são realistas
    qualityBonus += 2;
  }
  if (competitionAvg > 0 && competitionAvg < 5) {
    // Média da competição entre 0 e 5 é realista
    qualityBonus += 2;
  }
  
  confidence += qualityBonus;

  // Penalidade por dados incompletos
  // Usar estimatedOver15Freq e hasTeamStats em vez de campos deprecated
  const dataCompletenessScore =
    (estimatedOver15Freq > 50 ? 1 : 0) + // Temos dados estimados válidos
    (competitionAvg > 0 ? 1 : 0) +
    (hasTeamStats ? 1 : 0);
  if (dataCompletenessScore < 2) {
    confidence = Math.max(confidence - 10, 20); // Penalizar se muito poucos dados
    if (import.meta.env.DEV) {
      console.warn('[AnalysisEngine] Confiança reduzida devido a dados incompletos:', {
        dataCompletenessScore,
        estimatedOver15Freq,
        hasCompetitionAvg: competitionAvg > 0,
        hasTeamStats,
      });
    }
  }

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Cálculo de confiança:', {
      base: 30,
      consistencyBonus,
      qualityBonus,
      finalConfidence: Math.min(100, Math.max(0, confidence)),
    });
  }

  confidence = Math.min(100, Math.max(0, confidence));

  // Calcular Prob. Estatísticas separadamente (baseada apenas em últimos 10 jogos)
  const statsResult = calculateStatisticsProbability(normalizedData);
  const statsProb = statsResult?.probability ?? prob; // Usar prob calculado anteriormente como fallback
  const statsOverUnderProbabilities = statsResult?.overUnderProbabilities;
  const statsLambdaTotal = statsResult?.lambdaTotal;
  const statsLambdaHome = statsResult?.lambdaHome;
  const statsLambdaAway = statsResult?.lambdaAway;

  // Calcular Prob. Tabela separadamente (baseada apenas em dados da tabela)
  const hasGeralTable = !!(normalizedData.homeTableData && normalizedData.awayTableData);
  const hasHomeComplement = !!normalizedData.homeComplementData;
  const hasAwayComplement = !!normalizedData.awayComplementData;
  const hasCompetitionComplementAvg = !!normalizedData.competitionComplementAvg;
  const hasFullComplement = hasHomeComplement && hasAwayComplement && hasCompetitionComplementAvg;
  const hasPartialComplement = hasHomeComplement || hasAwayComplement;

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] performAnalysis - Verificando disponibilidade de tabelas antes de calcular probabilidade:', {
      tabelaGeral: {
        disponivel: hasGeralTable,
        homeTableData: !!normalizedData.homeTableData,
        awayTableData: !!normalizedData.awayTableData,
      },
      complementoLegado: {
        parcial: hasPartialComplement && !hasFullComplement,
        completo: hasFullComplement,
        homeComplementData: hasHomeComplement,
        awayComplementData: hasAwayComplement,
        competitionComplementAvg: hasCompetitionComplementAvg,
      },
      estatisticas: {
        homeTeamStats: !!normalizedData.homeTeamStats,
        awayTeamStats: !!normalizedData.awayTeamStats,
      },
    });
  }

  // Validação: garantir que a tabela geral esteja disponível (obrigatória)
  if (!hasGeralTable) {
    if (import.meta.env.DEV) {
      console.warn('[AnalysisEngine] ⚠️ Tabela geral não disponível - análise pode ser imprecisa');
    }
  }

  const tableResult = calculateTableProbability(normalizedData);
  const tableProb = tableResult?.probability ?? null;
  const tableOverUnderProbabilities = tableResult?.overUnderProbabilities;
  const tableLambdaTotal = tableResult?.lambdaTotal;
  const tableLambdaHome = tableResult?.lambdaHome;
  const tableLambdaAway = tableResult?.lambdaAway;

  if (import.meta.env.DEV && tableResult) {
    console.log('[AnalysisEngine] performAnalysis - Resultado de calculateTableProbability:', {
      tableProb,
      tableLambdaTotal,
      tableLambdaHome,
      tableLambdaAway,
      tabelasUsadas: {
        geral: hasGeralTable,
        complementoLegadoParcial: hasPartialComplement,
        complementoLegadoCompleto: hasFullComplement,
      },
      baseLigaCompleta: hasGeralTable,
    });
  } else if (import.meta.env.DEV && !tableResult) {
    console.warn('[AnalysisEngine] ⚠️ calculateTableProbability retornou null - tabela geral pode estar incompleta');
  }

  // Obter pesos para combinar lambdas (mesmos pesos usados na combinação de probabilidades)
  const { probability: _, statsWeight, tableWeight } = combineStatisticsAndTable(
    statsProb,
    tableProb,
    normalizedData
  );

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] performAnalysis - Pesos para combinação:', {
      statsWeight: statsWeight.toFixed(3),
      tableWeight: tableWeight.toFixed(3),
      'fonteEstatisticas': !!normalizedData.homeTeamStats && !!normalizedData.awayTeamStats,
      'fonteTabelaGeral': hasGeralTable,
      'fonteTabelaComplemento': hasPartialComplement,
    });
  }

  // Calcular probabilidades Over/Under combinadas via λ (gols esperados) para manter consistência entre linhas
  const isPosFinite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const hasStatsSide = isPosFinite(statsLambdaHome) && isPosFinite(statsLambdaAway);
  const hasTableSide = isPosFinite(tableLambdaHome) && isPosFinite(tableLambdaAway);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // Fallback: usar λ calculado no performAnalysis (mantém compatibilidade com dados mínimos)
  let lambdaHomeCombined = lambdaHome;
  let lambdaAwayCombined = lambdaAway;
  let baseShrink = 0.18;

  if (hasStatsSide && hasTableSide) {
    lambdaHomeCombined = statsLambdaHome * statsWeight + tableLambdaHome * tableWeight;
    lambdaAwayCombined = statsLambdaAway * statsWeight + tableLambdaAway * tableWeight;
    baseShrink = 0.08;
  } else if (hasStatsSide) {
    lambdaHomeCombined = statsLambdaHome;
    lambdaAwayCombined = statsLambdaAway;
    baseShrink = 0.12;
  } else if (hasTableSide) {
    lambdaHomeCombined = tableLambdaHome;
    lambdaAwayCombined = tableLambdaAway;
    baseShrink = 0.12;
  } else {
    baseShrink = 0.18;
  }

  let lambdaCombined = lambdaHomeCombined + lambdaAwayCombined;

  // Shrinkage calibrado para a média do campeonato (estabiliza extremos)
  const hasStandardFor = false; // Não implementado no momento
  const minMp =
    hasHomeTableData && hasAwayTableData
      ? Math.min(
          parseFloat(normalizedData.homeTableData?.MP || '0') || 0,
          parseFloat(normalizedData.awayTableData?.MP || '0') || 0
        )
      : 0;
  const divergenceProb = tableProb != null ? Math.abs(statsProb - tableProb) : 0;

  const confidencePenalty = clamp((80 - confidence) / 250, 0, 0.18);
  const mpPenalty = minMp > 0 ? clamp((10 - minMp) / 40, 0, 0.1) : 0;
  const divergencePenalty =
    hasStatsSide && hasTableSide ? clamp((divergenceProb - 15) / 250, 0, 0.1) : 0;
  const standardBonus = hasStandardFor ? 0.01 : 0;

  const shrink = clamp(
    baseShrink + confidencePenalty + mpPenalty + divergencePenalty - standardBonus,
    0.05,
    0.28
  );

  let lambdaFinal = lambdaCombined;
  if (competitionAvg > 0 && Number.isFinite(competitionAvg)) {
    lambdaFinal = (1 - shrink) * lambdaCombined + shrink * competitionAvg;
  }

  // Garantir faixa realista (cap dinâmico por competição quando disponível)
  const maxLambdaFinal =
    competitionAvg > 0 && Number.isFinite(competitionAvg)
      ? clamp(competitionAvg * 2.2, 4.5, 6.5)
      : 6.5;
  lambdaFinal = clamp(lambdaFinal, 0.2, maxLambdaFinal);

  // Distribuição home/away preservando o ratio da combinação (mais consistente que usar o λ base)
  const ratioHomeRaw = lambdaCombined > 0 ? lambdaHomeCombined / lambdaCombined : 0.5;
  const ratioHome = Math.max(0, Math.min(1, ratioHomeRaw));
  const lambdaHomeFinal = lambdaFinal * ratioHome;
  const lambdaAwayFinal = Math.max(0, lambdaFinal - lambdaHomeFinal);

  const matchOdds = calculateMatchOddsFromPoisson(lambdaHomeFinal, lambdaAwayFinal);

  // Calcular BTTS (Ambas Marcam) via Poisson a partir do λ final combinado (home/away)
  const pHomeScores = 1 - Math.exp(-lambdaHomeFinal);
  const pAwayScores = 1 - Math.exp(-lambdaAwayFinal);
  const bttsProbability = Math.max(0, Math.min(100, pHomeScores * pAwayScores * 100));

  // Garantir que a distribuição exibida (Poisson por time) reflita a combinação final
  pHome.length = 0;
  pAway.length = 0;
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHomeFinal));
    pAway.push(poissonProbability(i, lambdaAwayFinal));
  }

  // Calcular probabilidades Over/Under combinadas via Poisson usando λ final
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaFinal);

  // Calcular Prob. Final (Over 1.5) usando Dixon-Coles para maior precisão nos placares baixos
  // Isso corrige a suposição de independência do Poisson padrão para 0-0, 1-0 e 0-1
  const under15ProbDC = calculateDixonColesUnder15(lambdaHomeFinal, lambdaAwayFinal);
  const finalProb = (1 - under15ProbDC) * 100;
  
  // Atualizar a linha 1.5 no objeto de probabilidades para refletir o cálculo mais preciso
  if (overUnderProbabilities['1.5']) {
    overUnderProbabilities['1.5'].over = finalProb;
    overUnderProbabilities['1.5'].under = under15ProbDC * 100;
  }

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Over/Under combinada via λ:', {
      statsWeight,
      tableWeight,
      statsLambdaTotal,
      statsLambdaHome,
      statsLambdaAway,
      tableLambdaTotal,
      tableLambdaHome,
      tableLambdaAway,
      lambdaHomeCombined,
      lambdaAwayCombined,
      lambdaCombined,
      competitionAvg,
      baseShrink,
      confidencePenalty,
      mpPenalty,
      divergencePenalty,
      standardBonus,
      shrink,
      lambdaFinal,
      lambdaHomeFinal,
      lambdaAwayFinal,
      bttsProbability,
    });
  }

  let riskLevel: AnalysisResult['riskLevel'] = 'Moderado';
  if (finalProb > 88) riskLevel = 'Baixo';
  else if (finalProb > 78) riskLevel = 'Moderado';
  else if (finalProb > 68) riskLevel = 'Alto';
  else riskLevel = 'Muito Alto';

  let finalEv = ev;
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    finalEv = calculateEVPercent(finalProb, normalizedData.oddOver15);
  }

  let recentFormConfidenceIndex: number | undefined;
  if (hasHomeTeamStats && hasAwayTeamStats && normalizedData.homeTeamStats && normalizedData.awayTeamStats) {
    const hw = getWeightedTeamStats(
      normalizedData.homeTeamStats.gols.home,
      normalizedData.homeTeamStats.gols.away,
      normalizedData.homeTeamStats.gols.global,
      'home'
    );
    const aw = getWeightedTeamStats(
      normalizedData.awayTeamStats.gols.home,
      normalizedData.awayTeamStats.gols.away,
      normalizedData.awayTeamStats.gols.global,
      'away'
    );
    recentFormConfidenceIndex = computeRecentFormConfidenceIndex(normalizedData, hw, aw);
  }

  const finalTableCompleteness = calculateTableCompletenessScore(normalizedData);
  const tablesUsedInAnalysis: string[] = [];

  const finalHasHomeTableData = !!normalizedData.homeTableData;
  const finalHasAwayTableData = !!normalizedData.awayTableData;
  const finalHasFullComplement =
    !!normalizedData.homeComplementData &&
    !!normalizedData.awayComplementData &&
    !!normalizedData.competitionComplementAvg;
  const finalHasPartialComplement =
    !!normalizedData.homeComplementData || !!normalizedData.awayComplementData;

  if (finalHasHomeTableData && finalHasAwayTableData) {
    tablesUsedInAnalysis.push('geral');
  }
  if (finalHasPartialComplement) {
    tablesUsedInAnalysis.push('complement_legado');
  }

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] ===== RESUMO FINAL DA ANÁLISE =====');
    console.log('[AnalysisEngine] Metadado de fontes:', finalTableCompleteness.availableTables.join(', ') || 'nenhuma');
    console.log('[AnalysisEngine] Ramo tabela (labels):', tablesUsedInAnalysis.join(', ') || 'nenhuma');
    console.log('[AnalysisEngine] Score completude (só exige tabela geral):', `${(finalTableCompleteness.score * 100).toFixed(0)}%`);
    console.log('[AnalysisEngine] Complemento legado:', {
      completo: finalHasFullComplement,
      parcial: finalHasPartialComplement && !finalHasFullComplement,
      ausente: !finalHasPartialComplement,
    });

    if (tableResult) {
      console.log('[AnalysisEngine] Lambdas vindos da tabela:', {
        tableLambdaHome,
        tableLambdaAway,
        tableLambdaTotal,
      });
    }
  }

  return {
    probabilityOver15: statsProb, // Probabilidade estatística pura (baseada em últimos 10 jogos)
    tableProbability: tableProb, // Probabilidade baseada apenas em dados da tabela
    combinedProbability: finalProb, // Probabilidade final combinada (estatísticas + tabela)
    bttsProbability,
    confidenceScore: confidence,
    recentFormConfidenceIndex,
    poissonHome: pHome,
    poissonAway: pAway,
    riskLevel,
    ev: finalEv,
    verdict:
      finalProb > 80
        ? 'ALTA CONFIANÇA EM GOLS'
        : finalProb > 70
          ? 'CENÁRIO FAVORÁVEL'
          : 'JOGO TRANCADO',
    recommendation:
      finalProb > 82
        ? 'Entrada recomendada pré-live ou Over 1.0 HT no minuto 15.'
        : 'Aguarde o Live. Só entre se houver 3 chutes a gol nos primeiros 10 minutos.',
    advancedMetrics: {
      offensiveVolume,
      defensiveLeaking,
      bttsCorrelation,
      formTrend,
      finishingSignal,
    },
    matchOdds,
    // Probabilidades Over/Under combinadas (final)
    overUnderProbabilities,
    // Probabilidades Over/Under baseadas apenas na tabela
    tableOverUnderProbabilities,
    // Probabilidades Over/Under baseadas apenas nas estatísticas
    statsOverUnderProbabilities,
  };
}
