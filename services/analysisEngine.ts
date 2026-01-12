import { MatchData, AnalysisResult } from '../types';

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
      combined[lineKey] = { over: 50, under: 50 };
    }
  }

  return combined;
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

  // 1. Extrair médias de gols específicas (home para time da casa, away para visitante)
  const homeAvgScored = data.homeTeamStats.gols.home.avgScored || 0;
  const homeAvgConceded = data.homeTeamStats.gols.home.avgConceded || 0;
  const awayAvgScored = data.awayTeamStats.gols.away.avgScored || 0;
  const awayAvgConceded = data.awayTeamStats.gols.away.avgConceded || 0;

  if (homeAvgScored === 0 && homeAvgConceded === 0 && awayAvgScored === 0 && awayAvgConceded === 0) {
    return null;
  }

  // 2. Calcular lambda para Poisson usando médias específicas
  // Time da casa: média entre gols marcados em casa e gols sofridos pelo visitante fora
  let lambdaHome = (homeAvgScored + awayAvgConceded) / 2;
  // Time visitante: média entre gols marcados fora e gols sofridos pelo time da casa em casa
  let lambdaAway = (awayAvgScored + homeAvgConceded) / 2;

  // Garantir valores mínimos para evitar divisão por zero
  lambdaHome = lambdaHome || 1.0;
  lambdaAway = lambdaAway || 1.0;

  // 3. Ajustar baseado em cleanSheetPct (defesas muito boas reduzem probabilidade)
  const homeCleanSheet = data.homeTeamStats.gols.home.cleanSheetPct || 0;
  const awayCleanSheet = data.awayTeamStats.gols.away.cleanSheetPct || 0;
  const avgCleanSheet = (homeCleanSheet + awayCleanSheet) / 2;
  
  // Clean sheet alto (>40%) reduz lambda (até -8%)
  if (avgCleanSheet > 40) {
    const reduction = Math.min(0.08, (avgCleanSheet - 40) / 100);
    lambdaHome *= (1 - reduction * 0.5);
    lambdaAway *= (1 - reduction * 0.5);
  }

  // 4. Ajustar baseado em noGoalsPct (ataques fracos reduzem probabilidade)
  const homeNoGoals = data.homeTeamStats.gols.home.noGoalsPct || 0;
  const awayNoGoals = data.awayTeamStats.gols.away.noGoalsPct || 0;
  const avgNoGoals = (homeNoGoals + awayNoGoals) / 2;
  
  // No goals alto (>20%) reduz lambda (até -6%)
  if (avgNoGoals > 20) {
    const reduction = Math.min(0.06, (avgNoGoals - 20) / 100);
    lambdaHome *= (1 - reduction * 0.5);
    lambdaAway *= (1 - reduction * 0.5);
  }

  // 5. Ajustar baseado em over25Pct (confirma tendência ofensiva)
  const homeOver25 = data.homeTeamStats.gols.home.over25Pct || 0;
  const awayOver25 = data.awayTeamStats.gols.away.over25Pct || 0;
  const avgOver25 = (homeOver25 + awayOver25) / 2;
  
  // Over 2.5% alto (>50%) aumenta lambda (até +5%)
  if (avgOver25 > 50) {
    const increase = Math.min(0.05, (avgOver25 - 50) / 100);
    lambdaHome *= (1 + increase * 0.5);
    lambdaAway *= (1 + increase * 0.5);
  }

  // 6. Considerar forma recente (últimos 3 jogos do histórico)
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
    console.log('[AnalysisEngine] Prob. Estatísticas calculada:', {
      lambdaHome,
      lambdaAway,
      lambdaTotal,
      homeAvgScored,
      homeAvgConceded,
      awayAvgScored,
      awayAvgConceded,
      avgCleanSheet,
      avgNoGoals,
      avgOver25,
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
 * Calcula probabilidade Over 1.5 baseada apenas nos dados da tabela do campeonato.
 * Usa fatores avançados: GF/GA, xG/xGA, posição na tabela, GD, xGD, Pts/MP e força do oponente.
 *
 * @param data - Dados da partida incluindo homeTableData e awayTableData
 * @returns Objeto com probabilidade Over 1.5 e overUnderProbabilities, ou null se dados insuficientes
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

  const homeMp = parseFloat(data.homeTableData.MP || '0');
  const homeGf = parseFloat(data.homeTableData.GF || '0');
  const homeGa = parseFloat(data.homeTableData.GA || '0');
  const homeXg = parseFloat(data.homeTableData.xG || '0');
  const homeXga = parseFloat(data.homeTableData.xGA || '0');
  const homeRk = parseFloat(data.homeTableData.Rk || '0');
  const homeGd = parseFloat(data.homeTableData.GD || '0');
  const homeXgd = parseFloat(data.homeTableData.xGD || '0');
  const homePtsPerGame = parseFloat(data.homeTableData['Pts/MP'] || '0');

  const awayMp = parseFloat(data.awayTableData.MP || '0');
  const awayGf = parseFloat(data.awayTableData.GF || '0');
  const awayGa = parseFloat(data.awayTableData.GA || '0');
  const awayXg = parseFloat(data.awayTableData.xG || '0');
  const awayXga = parseFloat(data.awayTableData.xGA || '0');
  const awayRk = parseFloat(data.awayTableData.Rk || '0');
  const awayGd = parseFloat(data.awayTableData.GD || '0');
  const awayXgd = parseFloat(data.awayTableData.xGD || '0');
  const awayPtsPerGame = parseFloat(data.awayTableData['Pts/MP'] || '0');

  if (homeMp === 0 || awayMp === 0) {
    return null;
  }

  // 1. Calcular médias de gols da tabela
  const homeAvgScored = homeGf / homeMp;
  const homeAvgConceded = homeGa / homeMp;
  const awayAvgScored = awayGf / awayMp;
  const awayAvgConceded = awayGa / awayMp;

  // 2. Usar xG se disponível (mais preciso), caso contrário usar GF/MP
  const homeExpectedScored = homeXg > 0 ? homeXg / homeMp : homeAvgScored;
  const homeExpectedConceded = homeXga > 0 ? homeXga / homeMp : homeAvgConceded;
  const awayExpectedScored = awayXg > 0 ? awayXg / awayMp : awayAvgScored;
  const awayExpectedConceded = awayXga > 0 ? awayXga / awayMp : awayAvgConceded;

  // 3. Lambda base para Poisson: média de gols esperados
  let lambdaHome = (homeExpectedScored + awayExpectedConceded) / 2;
  let lambdaAway = (awayExpectedScored + homeExpectedConceded) / 2;

  // 3b. Complemento (standard_for): ajustar ataque + ritmo (impacto médio, clampado)
  const hasStandardFor =
    !!data.homeStandardForData &&
    !!data.awayStandardForData &&
    !!data.competitionStandardForAvg;

  if (hasStandardFor) {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const parseNum = (value: unknown): number => {
      if (value == null) return 0;
      const raw = String(value).trim();
      if (!raw) return 0;
      const normalized = raw.replace(/,/g, '');
      const n = Number.parseFloat(normalized);
      return Number.isFinite(n) ? n : 0;
    };

    const avg = data.competitionStandardForAvg!;

    const getQuality90 = (row: Record<string, unknown>): number => {
      const npx = parseNum(row['Per 90 Minutes npxG+xAG']);
      const xg = parseNum(row['Per 90 Minutes xG+xAG']);
      return npx > 0 ? npx : xg;
    };

    const getPaceRaw = (row: Record<string, unknown>): number => {
      const poss = parseNum(row.Poss);
      const mp = parseNum(row['Playing Time MP']);
      const prgP = parseNum(row['Progression PrgP']);
      const prgC = parseNum(row['Progression PrgC']);

      const possRatio = avg.poss > 0 && poss > 0 ? poss / avg.poss : 1;
      const prgPPerMatch = mp > 0 ? prgP / mp : 0;
      const prgCPerMatch = mp > 0 ? prgC / mp : 0;
      const prgPRatio = avg.prgPPerMatch > 0 && prgPPerMatch > 0 ? prgPPerMatch / avg.prgPPerMatch : 1;
      const prgCRatio = avg.prgCPerMatch > 0 && prgCPerMatch > 0 ? prgCPerMatch / avg.prgCPerMatch : 1;

      // Ritmo: mistura de posse e progressões (normalizado vs média do campeonato)
      return 0.4 * possRatio + 0.3 * prgPRatio + 0.3 * prgCRatio;
    };

    const homeRow = data.homeStandardForData as unknown as Record<string, unknown>;
    const awayRow = data.awayStandardForData as unknown as Record<string, unknown>;

    // Ataque (qualidade ofensiva por 90)
    const homeQ = getQuality90(homeRow);
    const awayQ = getQuality90(awayRow);
    const homeAttackRatio = avg.npxGxAG90 > 0 && homeQ > 0 ? homeQ / avg.npxGxAG90 : 1;
    const awayAttackRatio = avg.npxGxAG90 > 0 && awayQ > 0 ? awayQ / avg.npxGxAG90 : 1;

    // Impacto médio: até ±10% no λ por ataque
    const homeAttackDelta = clamp((homeAttackRatio - 1) * 0.2, -0.1, 0.1);
    const awayAttackDelta = clamp((awayAttackRatio - 1) * 0.2, -0.1, 0.1);
    const homeAttackFactor = 1 + homeAttackDelta;
    const awayAttackFactor = 1 + awayAttackDelta;

    // Ritmo (pace): médio e compartilhado pelo jogo, clampado em ±10%
    const homePaceRaw = getPaceRaw(homeRow);
    const awayPaceRaw = getPaceRaw(awayRow);
    const matchPaceRaw = (homePaceRaw + awayPaceRaw) / 2;
    const paceDelta = clamp((matchPaceRaw - 1) * 0.2, -0.1, 0.1);
    const paceFactor = 1 + paceDelta;

    lambdaHome *= homeAttackFactor * paceFactor;
    lambdaAway *= awayAttackFactor * paceFactor;

    if (import.meta.env.DEV) {
      console.log('[AnalysisEngine] Ajuste standard_for aplicado:', {
        homeAttackFactor,
        awayAttackFactor,
        paceFactor,
        homeAttackRatio,
        awayAttackRatio,
        matchPaceRaw,
      });
    }
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
  const homeGdPerGame = homeGd / homeMp;
  const awayGdPerGame = awayGd / awayMp;
  
  // GD positivo aumenta probabilidade de gols (até +3% por GD/game > 0.5)
  if (homeGdPerGame > 0.5) lambdaHome *= (1 + Math.min(0.03, homeGdPerGame * 0.02));
  if (awayGdPerGame > 0.5) lambdaAway *= (1 + Math.min(0.03, awayGdPerGame * 0.02));

  // 6. Ajustar baseado em xGD (Expected Goal Difference) quando disponível
  if (homeXgd !== 0) {
    const homeXgdPerGame = homeXgd / homeMp;
    if (homeXgdPerGame > 0.3) lambdaHome *= (1 + Math.min(0.025, homeXgdPerGame * 0.015));
  }
  if (awayXgd !== 0) {
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
    console.log('[AnalysisEngine] Prob. Tabela calculada (avançada):', {
      lambdaHome,
      lambdaAway,
      lambdaTotal,
      homeRk,
      awayRk,
      homeGdPerGame,
      awayGdPerGame,
      homePtsPerGame,
      awayPtsPerGame,
      hasStandardFor,
      tableProb,
      formAdjustment,
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

  // Calcular pesos baseados na disponibilidade dos dados
  // Estatísticas (últimos 10 jogos) têm mais peso por serem mais recentes
  let statsWeight = 0.65; // 65% padrão para estatísticas
  let tableWeight = 0.35; // 35% padrão para tabela

  // Ajustar pesos se temos ambos os tipos de dados
  if (hasTeamStats && hasTableData) {
    // Se temos ambos, dar mais peso às estatísticas (mais recentes)
    statsWeight = 0.7;
    tableWeight = 0.3;
  } else if (hasTeamStats && !hasTableData) {
    // Se só temos estatísticas, usar 100%
    statsWeight = 1.0;
    tableWeight = 0.0;
  } else if (!hasTeamStats && hasTableData) {
    // Se só temos tabela, usar 100%
    statsWeight = 0.0;
    tableWeight = 1.0;
  }

  // Detectar divergência extrema (valores muito diferentes podem indicar problema)
  const divergence = Math.abs(statsProb - tableProb);
  const maxDivergence = 25; // Se diferença > 25%, ajustar pesos

  // Se divergência muito alta, dar mais peso à fonte mais confiável
  if (divergence > maxDivergence) {
    // Se temos estatísticas detalhadas, confiar mais nelas
    if (hasTeamStats) {
      statsWeight = 0.75;
      tableWeight = 0.25;
    } else {
      // Se não temos estatísticas, confiar mais na tabela
      statsWeight = 0.25;
      tableWeight = 0.75;
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
 * Combina probabilidade estatística com probabilidade da IA usando Bayesian averaging melhorado.
 * O peso da IA é baseado na confiança da IA, consistência entre valores e histórico de precisão.
 *
 * MELHORIA: Usa abordagem Bayesian para combinar fontes com diferentes níveis de confiança.
 * Considera variância implícita de cada fonte e ajusta pesos dinamicamente.
 *
 * @deprecated Esta função será removida. Use combineStatisticsAndTable em vez disso.
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
  // Validação de inputs
  if (!Number.isFinite(statisticalProb) || statisticalProb < 0 || statisticalProb > 100) {
    throw new Error(`Probabilidade estatística inválida: ${statisticalProb}`);
  }

  // Se não há probabilidade da IA, retornar apenas estatística
  if (aiProb === null || aiProb === undefined) {
    return statisticalProb;
  }

  // Validação da probabilidade da IA
  if (!Number.isFinite(aiProb) || aiProb < 0 || aiProb > 100) {
    // Se a IA retornou valor inválido, usar apenas estatística
    return statisticalProb;
  }

  // Detectar divergência extrema (valores muito diferentes podem indicar problema)
  const divergence = Math.abs(statisticalProb - aiProb);
  const maxDivergence = 30; // Se diferença > 30%, reduzir peso da IA

  // Se não há confiança da IA, usar média simples com ajuste por divergência
  if (aiConfidence === null || aiConfidence === undefined || aiConfidence <= 0) {
    // Se divergência muito alta, dar mais peso à estatística
    if (divergence > maxDivergence) {
      const statWeight = 0.7; // 70% estatística, 30% IA
      return statisticalProb * statWeight + aiProb * (1 - statWeight);
    }
    return (statisticalProb + aiProb) / 2;
  }

  // Validação da confiança
  if (!Number.isFinite(aiConfidence) || aiConfidence < 0 || aiConfidence > 100) {
    return (statisticalProb + aiProb) / 2;
  }

  // MELHORIA: Bayesian Averaging com variância implícita
  // Assumir que estatísticas têm confiança base de 75% (mais estável)
  // IA tem confiança variável baseada em aiConfidence
  const statBaseConfidence = 75;
  const aiNormalizedConfidence = Math.min(Math.max(aiConfidence / 100, 0), 1);
  
  // Calcular "precisão" (inverso da variância) para cada fonte
  // Maior confiança = menor variância = maior precisão
  const statPrecision = statBaseConfidence / 100; // 0.75
  const aiPrecision = aiNormalizedConfidence * 0.9; // Máximo 0.9 para IA (sempre um pouco menos precisa que estatística pura)
  
  // Ajustar precisão da IA baseado em divergência
  // Se valores muito diferentes, reduzir precisão da IA (aumentar variância)
  let adjustedAiPrecision = aiPrecision;
  if (divergence > maxDivergence) {
    const divergencePenalty = Math.min(divergence / maxDivergence, 1);
    adjustedAiPrecision = aiPrecision * (1 - divergencePenalty * 0.4); // Reduzir até 40% da precisão
  }
  
  // Calcular pesos usando Bayesian averaging
  // Peso = precisão / (precisão_total)
  const totalPrecision = statPrecision + adjustedAiPrecision;
  const statWeight = statPrecision / totalPrecision;
  const aiWeight = adjustedAiPrecision / totalPrecision;
  
  // Calcular média ponderada Bayesian
  const combined = statisticalProb * statWeight + aiProb * aiWeight;
  
  // Suavizar limites usando sigmoid em vez de clamp rígido (10-98% mais realista)
  return smoothClamp(combined, 10, 98);
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
 * Normaliza dados de MatchData garantindo valores padrão seguros para campos opcionais
 * Previne erros com dados antigos ou incompletos
 */
function normalizeMatchData(data: MatchData): MatchData {
  return {
    ...data,
    // Campos deprecated: usar valores padrão se não existirem
    homeOver15Freq: data.homeOver15Freq ?? 0,
    awayOver15Freq: data.awayOver15Freq ?? 0,
    // Garantir arrays vazios se não existirem
    homeHistory: data.homeHistory ?? [],
    awayHistory: data.awayHistory ?? [],
    // Garantir valores numéricos padrão
    competitionAvg: data.competitionAvg ?? 0,
    h2hOver15Freq: data.h2hOver15Freq ?? 0,
    matchImportance: data.matchImportance ?? 0,
    keyAbsences: data.keyAbsences ?? 'none',
  };
}

/**
 * Executa análise completa de uma partida para Over 1.5 goals usando algoritmo Poisson v3.8.
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

  // Normalizar dados para garantir valores padrão seguros
  const normalizedData = normalizeMatchData(data);
  
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

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Dados normalizados:', {
      homeOver15Freq,
      awayOver15Freq,
      dataCompleteness,
      missingData: missingData.length > 0 ? missingData : 'Nenhum',
    });

    // Avisar se dados essenciais estão faltando
    if (missingData.length > 0) {
      console.warn('[AnalysisEngine] Dados essenciais faltando:', missingData);
      console.warn('[AnalysisEngine] A análise pode ser menos confiável sem esses dados.');
    }

    // Informar sobre dados da tabela (usados na combinação com estatísticas)
    if (hasHomeTableData || hasAwayTableData) {
      console.log('[AnalysisEngine] Dados da tabela disponíveis (serão combinados com estatísticas):', {
        hasHomeTableData,
        hasAwayTableData,
      });
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

  // Considerar xG se disponível (Expected Goals)
  if (normalizedData.homeXG > 0 && normalizedData.awayXG > 0) {
    const avgXG = (normalizedData.homeXG + normalizedData.awayXG) / 2;
    // xG > 2.5 indica alta probabilidade de gols
    if (avgXG > 2.5) {
      prob += 3;
    } else if (avgXG < 1.5) {
      prob -= 3;
    }
  }

  // Se não temos dados suficientes (nem campos deprecated nem dados novos), usar apenas média da competição como baseline
  // Usar estimatedOver15Freq em vez de campos deprecated
  if (estimatedOver15Freq === 50 && competitionAvg > 0) {
    prob = competitionAvg;
  }

  // Suavizar limites usando sigmoid (10-98% mais realista)
  prob = smoothClamp(prob, 10, 98);

  // Calcular Poisson para visualização (usando médias de gols se disponíveis)
  // Usar estatísticas específicas: home para time da casa, away para visitante
  // Se não disponíveis, usar dados da tabela como fallback
  let homeGoalsScored = normalizedData.homeTeamStats?.gols?.home?.avgScored || 0;
  let homeGoalsConceded = normalizedData.homeTeamStats?.gols?.home?.avgConceded || 0;
  let awayGoalsScored = normalizedData.awayTeamStats?.gols?.away?.avgScored || 0;
  let awayGoalsConceded = normalizedData.awayTeamStats?.gols?.away?.avgConceded || 0;
  
  // Fallback: usar dados da tabela se Estatísticas Globais não estiverem disponíveis
  if (homeGoalsScored === 0 && normalizedData.homeTableData) {
    const mp = parseFloat(normalizedData.homeTableData.MP || '0');
    const gf = parseFloat(normalizedData.homeTableData.GF || '0');
    const ga = parseFloat(normalizedData.homeTableData.GA || '0');
    if (mp > 0) {
      homeGoalsScored = gf / mp;
      homeGoalsConceded = ga / mp;
    }
  }
  
  if (awayGoalsScored === 0 && normalizedData.awayTableData) {
    const mp = parseFloat(normalizedData.awayTableData.MP || '0');
    const gf = parseFloat(normalizedData.awayTableData.GF || '0');
    const ga = parseFloat(normalizedData.awayTableData.GA || '0');
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
  
  // Usar xG e xGA da tabela para ajustes finos se disponíveis
  if (normalizedData.homeTableData?.xG && normalizedData.awayTableData?.xGA) {
    const homeXG = parseFloat(normalizedData.homeTableData.xG || '0');
    const awayXGA = parseFloat(normalizedData.awayTableData.xGA || '0');
    if (homeXG > 0 && awayXGA > 0) {
      // Ajustar lambdaHome considerando xG (mais preciso que GF/MP)
      const adjustedHomeGoals = (homeGoalsScored + homeXG) / 2;
      const adjustedAwayConceded = (awayGoalsConceded + awayXGA) / 2;
      homeGoalsScored = adjustedHomeGoals;
      awayGoalsConceded = adjustedAwayConceded;
    }
  }
  
  if (normalizedData.awayTableData?.xG && normalizedData.homeTableData?.xGA) {
    const awayXG = parseFloat(normalizedData.awayTableData.xG || '0');
    const homeXGA = parseFloat(normalizedData.homeTableData.xGA || '0');
    if (awayXG > 0 && homeXGA > 0) {
      // Ajustar lambdaAway considerando xG
      const adjustedAwayGoals = (awayGoalsScored + awayXG) / 2;
      const adjustedHomeConceded = (homeGoalsConceded + homeXGA) / 2;
      awayGoalsScored = adjustedAwayGoals;
      homeGoalsConceded = adjustedHomeConceded;
    }
  }

  const lambdaHome = (homeGoalsScored + awayGoalsConceded) / 2;
  const lambdaAway = (awayGoalsScored + homeGoalsConceded) / 2;
  const lambdaTotal = lambdaHome + lambdaAway; // Média total de gols esperados no jogo (para Poisson combinado)

  const pHome: number[] = [];
  const pAway: number[] = [];
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHome));
    pAway.push(poissonProbability(i, lambdaAway));
  }

  // Cálculo de EV: (Probabilidade * Odd) - 100
  let ev = 0;
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    ev = ((prob / 100) * normalizedData.oddOver15 - 1) * 100;
  }

  // Métricas avançadas melhoradas
  const offensiveVolume = Math.min(100, Math.max(0, (avgTotal / 3) * 100));
  const defensiveLeaking = Math.min(
    100,
    Math.max(0, ((homeGoalsConceded + awayGoalsConceded) / 2) * 50)
  );
  const bttsCorrelation = Math.min(100, Math.max(0, 100 - avgCleanSheet));

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

  // Verificar consistência entre Estatísticas Globais e dados da tabela
  let consistencyBonus = 0;
  if (hasHomeTeamStats && hasHomeTableData) {
    const statsAvgScored = normalizedData.homeTeamStats?.gols?.home?.avgScored || 0;
    const statsAvgConceded = normalizedData.homeTeamStats?.gols?.home?.avgConceded || 0;
    const mp = parseFloat(normalizedData.homeTableData.MP || '0');
    const gf = parseFloat(normalizedData.homeTableData.GF || '0');
    const ga = parseFloat(normalizedData.homeTableData.GA || '0');
    
    if (mp > 0 && statsAvgScored > 0) {
      const tableAvgScored = gf / mp;
      const tableAvgConceded = ga / mp;
      const scoredDiff = Math.abs(statsAvgScored - tableAvgScored);
      const concededDiff = Math.abs(statsAvgConceded - tableAvgConceded);
      
      // Se diferença < 0.3 gols, dados são consistentes
      if (scoredDiff < 0.3 && concededDiff < 0.3) {
        consistencyBonus += 3;
      }
    }
  }
  
  if (hasAwayTeamStats && hasAwayTableData) {
    const statsAvgScored = normalizedData.awayTeamStats?.gols?.away?.avgScored || 0;
    const statsAvgConceded = normalizedData.awayTeamStats?.gols?.away?.avgConceded || 0;
    const mp = parseFloat(normalizedData.awayTableData.MP || '0');
    const gf = parseFloat(normalizedData.awayTableData.GF || '0');
    const ga = parseFloat(normalizedData.awayTableData.GA || '0');
    
    if (mp > 0 && statsAvgScored > 0) {
      const tableAvgScored = gf / mp;
      const tableAvgConceded = ga / mp;
      const scoredDiff = Math.abs(statsAvgScored - tableAvgScored);
      const concededDiff = Math.abs(statsAvgConceded - tableAvgConceded);
      
      if (scoredDiff < 0.3 && concededDiff < 0.3) {
        consistencyBonus += 3;
      }
    }
  }
  
  confidence += consistencyBonus;

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

  // Calcular Prob. Tabela separadamente (baseada apenas em dados da tabela)
  const tableResult = calculateTableProbability(normalizedData);
  const tableProb = tableResult?.probability ?? null;
  const tableOverUnderProbabilities = tableResult?.overUnderProbabilities;
  const tableLambdaTotal = tableResult?.lambdaTotal;

  // Obter pesos para combinar lambdas (mesmos pesos usados na combinação de probabilidades)
  const { probability: _, statsWeight, tableWeight } = combineStatisticsAndTable(
    statsProb,
    tableProb,
    normalizedData
  );

  // Calcular probabilidades Over/Under combinadas via λ (gols esperados) para manter consistência entre linhas
  const hasStatsLambda = typeof statsLambdaTotal === 'number' && Number.isFinite(statsLambdaTotal) && statsLambdaTotal > 0;
  const hasTableLambda = typeof tableLambdaTotal === 'number' && Number.isFinite(tableLambdaTotal) && tableLambdaTotal > 0;

  // Fallback: usar λ calculado no performAnalysis (já considera home/away stats e tabela quando disponíveis)
  let lambdaCombined = lambdaTotal;
  let shrink = 0;

  if (hasStatsLambda && hasTableLambda) {
    // Combinar lambdas com os mesmos pesos adaptativos
    lambdaCombined = statsLambdaTotal * statsWeight + tableLambdaTotal * tableWeight;
    shrink = 0.1;
  } else if (hasStatsLambda) {
    lambdaCombined = statsLambdaTotal;
    shrink = 0.15;
  } else if (hasTableLambda) {
    lambdaCombined = tableLambdaTotal;
    shrink = 0.15;
  } else {
    shrink = 0.2;
  }

  // Shrinkage leve para a média do campeonato (estabiliza extremos, especialmente linhas altas)
  let lambdaFinal = lambdaCombined;
  if (competitionAvg > 0 && Number.isFinite(competitionAvg)) {
    lambdaFinal = (1 - shrink) * lambdaCombined + shrink * competitionAvg;
  }

  // Garantir faixa realista
  lambdaFinal = Math.max(0.2, Math.min(7, lambdaFinal));

  // Calcular BTTS (Ambas Marcam) via Poisson a partir do λ final combinado.
  // Como o λ final é total, estimamos a divisão home/away preservando o ratio do λ base (lambdaHome/lambdaTotal).
  const safeTotal = Number.isFinite(lambdaTotal) && lambdaTotal > 0 ? lambdaTotal : lambdaHome + lambdaAway;
  const ratioHomeRaw = safeTotal > 0 ? lambdaHome / safeTotal : 0.5;
  const ratioHome = Math.max(0, Math.min(1, ratioHomeRaw));
  const lambdaHomeFinal = lambdaFinal * ratioHome;
  const lambdaAwayFinal = Math.max(0, lambdaFinal - lambdaHomeFinal);
  const pHomeScores = 1 - Math.exp(-lambdaHomeFinal);
  const pAwayScores = 1 - Math.exp(-lambdaAwayFinal);
  const bttsProbability = Math.max(0, Math.min(100, pHomeScores * pAwayScores * 100));

  // Calcular probabilidades Over/Under combinadas via Poisson usando λ final
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaFinal);

  // Calcular Prob. Final (Over 1.5) diretamente do λ final para garantir 100% consistência
  // com a linha 1.5 Over da tabela combinada
  const over15ProbFromLambda = 1 - poissonCumulative(1, lambdaFinal);
  const finalProb = Math.max(10, Math.min(98, over15ProbFromLambda * 100));

  if (import.meta.env.DEV) {
    console.log('[AnalysisEngine] Over/Under combinada via λ:', {
      statsWeight,
      tableWeight,
      statsLambdaTotal,
      tableLambdaTotal,
      lambdaCombined,
      competitionAvg,
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

  // Recalcular EV com probabilidade combinada se odd disponível
  let finalEv = ev;
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    finalEv = ((finalProb / 100) * normalizedData.oddOver15 - 1) * 100;
  }

  return {
    probabilityOver15: statsProb, // Probabilidade estatística pura (baseada em últimos 10 jogos)
    tableProbability: tableProb, // Probabilidade baseada apenas em dados da tabela
    combinedProbability: finalProb, // Probabilidade final combinada (estatísticas + tabela)
    bttsProbability,
    confidenceScore: confidence,
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
    },
    // Probabilidades Over/Under combinadas (final)
    overUnderProbabilities,
    // Probabilidades Over/Under baseadas apenas na tabela
    tableOverUnderProbabilities,
    // Probabilidades Over/Under baseadas apenas nas estatísticas
    statsOverUnderProbabilities,
  };
}
