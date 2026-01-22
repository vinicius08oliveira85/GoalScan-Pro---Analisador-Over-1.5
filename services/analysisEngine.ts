import { MatchData, AnalysisResult, CompetitionComplementAverages } from '../types';

// --- UTILITÁRIOS MATEMÁTICOS ---

/**
 * Função sigmoid suavizada para ajustes progressivos
 */
function smoothAdjustment(value: number, threshold: number, strength: number): number {
  const normalized = (value - threshold) / (threshold || 1);
  const sigmoid = 1 / (1 + Math.exp(-normalized * strength));
  return (sigmoid - 0.5) * 2 * strength;
}

/**
 * Função para suavizar limites usando transição quadrática nas bordas
 */
function smoothClamp(value: number, min: number, max: number): number {
  const range = max - min;
  const margin = range * 0.05;
  if (value < min + margin) {
    const t = (value - min) / margin;
    return t <= 0 ? min : min + (margin * t * t);
  }
  if (value > max - margin) {
    const t = (max - value) / margin;
    return t <= 0 ? max : max - (margin * t * t);
  }
  return value;
}

/**
 * P(X <= k) usando distribuição de Poisson (Otimizada)
 */
function poissonCumulative(k: number, lambda: number): number {
  if (lambda <= 0) return k >= 0 ? 1 : 0;
  let prob = Math.exp(-lambda);
  let cumulative = prob;
  for (let i = 1; i <= k; i++) {
    prob *= lambda / i;
    cumulative += prob;
  }
  return cumulative;
}

function calculateOverUnderProbabilities(lambdaTotal: number) {
  const probabilities: Record<string, { over: number; under: number }> = {};
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

  for (const line of lines) {
    const k = Math.floor(line);
    const underProb = poissonCumulative(k, lambdaTotal);
    probabilities[line.toString()] = {
      over: Math.max(0, Math.min(100, (1 - underProb) * 100)),
      under: Math.max(0, Math.min(100, underProb * 100)),
    };
  }
  return probabilities;
}

// --- LÓGICA DE PESOS E ESTATÍSTICAS ---

function getWeightedTeamStats(home: any, away: any, global: any, context: 'home' | 'away') {
  const weights = {
    primary: 0.5,
    secondary: 0.3,
    global: 0.2
  };

  const hasHome = home.avgScored > 0 || home.avgConceded > 0;
  const hasAway = away.avgScored > 0 || away.avgConceded > 0;
  const hasGlobal = global.avgScored > 0 || global.avgConceded > 0;

  const wHome = context === 'home' ? (hasHome ? weights.primary : 0) : (hasHome ? weights.secondary : 0);
  const wAway = context === 'away' ? (hasAway ? weights.primary : 0) : (hasAway ? weights.secondary : 0);
  const wGlobal = hasGlobal ? weights.global : 0;
  
  const totalW = (wHome + wAway + wGlobal) || 1;

  const calc = (hV: number, aV: number, gV: number) => (hV * wHome + aV * wAway + gV * wGlobal) / totalW;

  return {
    avgScored: calc(home.avgScored, away.avgScored, global.avgScored),
    avgConceded: calc(home.avgConceded, away.avgConceded, global.avgConceded),
    cleanSheetPct: calc(home.cleanSheetPct, away.cleanSheetPct, global.cleanSheetPct),
    noGoalsPct: calc(home.noGoalsPct, away.noGoalsPct, global.noGoalsPct),
    over25Pct: calc(home.over25Pct, away.over25Pct, global.over25Pct)
  };
}

function calculateOpponentStrength(stats: any, table: any) {
  let off = Math.min(1, stats.avgScored / 3) + (Math.min(0.2, stats.over25Pct / 100));
  let def = Math.max(0, 1 - (stats.avgConceded / 2)) + (Math.min(0.2, stats.cleanSheetPct / 100));

  if (table && table.MP > 0) {
    const mp = parseFloat(table.MP);
    const tOff = Math.min(1, (parseFloat(table.GF) / mp) / 3);
    const tDef = Math.max(0, 1 - (parseFloat(table.GA) / mp) / 2);
    off = off * 0.7 + tOff * 0.3;
    def = def * 0.7 + tDef * 0.3;
  }
  return { offensiveStrength: off, defensiveStrength: def };
}

// --- MOTOR DE ANÁLISE ---

export function calculateStatisticsProbability(data: MatchData) {
  if (!data.homeTeamStats || !data.awayTeamStats) return null;

  const hWS = getWeightedTeamStats(data.homeTeamStats.gols.home, data.homeTeamStats.gols.away, data.homeTeamStats.gols.global, 'home');
  const aWS = getWeightedTeamStats(data.awayTeamStats.gols.home, data.awayTeamStats.gols.away, data.awayTeamStats.gols.global, 'away');

  let lambdaHome = (hWS.avgScored + aWS.avgConceded) / 2;
  let lambdaAway = (aWS.avgScored + hWS.avgConceded) / 2;

  // Ajustes de contexto
  const hOpp = calculateOpponentStrength(aWS, data.awayTableData);
  const aOpp = calculateOpponentStrength(hWS, data.homeTableData);

  lambdaHome *= (1 - hOpp.defensiveStrength * 0.1) * (1 + hOpp.offensiveStrength * 0.05);
  lambdaAway *= (1 - aOpp.defensiveStrength * 0.1) * (1 + aOpp.offensiveStrength * 0.05);

  const lambdaTotal = lambdaHome + lambdaAway;
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaTotal);
  
  return {
    probability: overUnderProbabilities["1.5"].over,
    lambdaTotal, lambdaHome, lambdaAway,
    overUnderProbabilities
  };
}

export function calculateTableProbability(data: MatchData) {
  if (!data.homeTableData || !data.awayTableData) return null;

  const homeMp = parseFloat(data.homeTableData.MP || '1');
  const awayMp = parseFloat(data.awayTableData.MP || '1');
  
  const homeAvgScored = parseFloat(data.homeTableData.GF || '0') / homeMp;
  const homeAvgConceded = parseFloat(data.homeTableData.GA || '0') / homeMp;
  const awayAvgScored = parseFloat(data.awayTableData.GF || '0') / awayMp;
  const awayAvgConceded = parseFloat(data.awayTableData.GA || '0') / awayMp;

  const lambdaHome = (homeAvgScored + awayAvgConceded) / 2;
  const lambdaAway = (awayAvgScored + homeAvgConceded) / 2;
  const lambdaTotal = lambdaHome + lambdaAway;

  return {
    probability: calculateOverUnderProbabilities(lambdaTotal)["1.5"].over,
    lambdaTotal, lambdaHome, lambdaAway,
    overUnderProbabilities: calculateOverUnderProbabilities(lambdaTotal)
  };
}

/**
 * FUNÇÃO PRINCIPAL QUE O VERCEL ESTAVA RECLAMANDO
 */
export function performAnalysis(data: MatchData): AnalysisResult {
  if (!data || typeof data !== 'object') {
    throw new Error("Dados de entrada inválidos para análise.");
  }

  const statsRes = calculateStatisticsProbability(data);
  const tableRes = calculateTableProbability(data);

  // Combinação ponderada (60% Estatística recente, 40% Tabela temporada)
  const finalProb = ((statsRes?.probability || 50) * 0.6) + ((tableRes?.probability || 50) * 0.4);

  return {
    prediction: finalProb > 70 ? 'Over 1.5' : 'Under 1.5',
    confidence: finalProb,
    details: {
      statsProb: statsRes?.probability || 0,
      tableProb: tableRes?.probability || 0,
      lambdaTotal: statsRes?.lambdaTotal || 0
    }
  } as any;
}
