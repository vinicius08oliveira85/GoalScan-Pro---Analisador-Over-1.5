import { MatchData, CompetitionComplementAverages } from '../types';
import { logger } from '../utils/logger';

/**
 * Função sigmoid suavizada para ajustes progressivos
 * Retorna valor entre -1 e 1 baseado na entrada normalizada
 */
export function smoothAdjustment(value: number, threshold: number, strength: number): number {
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
export function smoothClamp(value: number, min: number, max: number): number {
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

export function poissonProbability(k: number, lambda: number): number {
  const exp = Math.exp(-lambda);
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * exp) / factorial;
}

/**
 * Calcula probabilidade acumulada de Poisson (P(X <= k))
 */
export function poissonCumulative(k: number, lambda: number): number {
  let cumulative = 0;
  for (let i = 0; i <= k; i++) {
    cumulative += poissonProbability(i, lambda);
  }
  return cumulative;
}

/**
 * Calcula a probabilidade de Under 1.5 (0 ou 1 gol) usando o ajuste de Dixon-Coles.
 * Corrige a interdependência entre gols em placares baixos (0-0, 1-0, 0-1).
 * @param lambdaHome Média de gols esperados para o time da casa
 * @param lambdaAway Média de gols esperados para o time visitante
 * @param rho Fator de correlação (padrão -0.13 para futebol, ajusta a subestimação de empates 0-0)
 */
export function calculateDixonColesUnder15(lambdaHome: number, lambdaAway: number, rho: number = -0.1): number {
  // P(0,0) com correção: aumenta probabilidade de 0-0 (comum em jogos travados)
  const p00 = poissonProbability(0, lambdaHome) * poissonProbability(0, lambdaAway) * (1 - lambdaHome * lambdaAway * rho);
  
  // P(1,0) com correção
  const p10 = poissonProbability(1, lambdaHome) * poissonProbability(0, lambdaAway) * (1 + lambdaHome * rho);
  
  // P(0,1) com correção
  const p01 = poissonProbability(0, lambdaHome) * poissonProbability(1, lambdaAway) * (1 + lambdaAway * rho);
  
  return Math.max(0, Math.min(1, p00 + p10 + p01));
}

/**
 * Calcula probabilidades Over/Under para múltiplas linhas usando distribuição Poisson
 * @param lambdaTotal - Média total de gols esperados no jogo (lambdaHome + lambdaAway)
 * @returns Objeto com probabilidades Over/Under para linhas 0.5, 1.5, 2.5, 3.5, 4.5, 5.5
 */
export function calculateOverUnderProbabilities(lambdaTotal: number): {
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
export function combineOverUnderProbabilities(
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
export function getWeightedTeamStats(
  home: { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number },
  away: { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number },
  global: { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number },
  context: 'home' | 'away'
): { avgScored: number; avgConceded: number; avgTotal: number; cleanSheetPct: number; noGoalsPct: number; over25Pct: number; under25Pct: number } {
  // Pesos adaptativos baseados no contexto
  // Para time da casa: home tem mais peso
  // Para visitante: away tem mais peso
  const homeWeight = context === 'home' ? 0.5 : 0.3;
  const awayWeight = context === 'away' ? 0.5 : 0.3;
  const globalWeight = 0.3;
  const totalWeight = homeWeight + awayWeight + globalWeight;

  // Verificar se dados estão disponíveis (não são todos zero)
  const hasHome = home.avgScored > 0 || home.avgConceded > 0;
  const hasAway = away.avgScored > 0 || away.avgConceded > 0;
  const hasGlobal = global.avgScored > 0 || global.avgConceded > 0;

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
    avgScored: ((home.avgScored * adjustedHomeWeight + away.avgScored * adjustedAwayWeight + global.avgScored * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    avgConceded: ((home.avgConceded * adjustedHomeWeight + away.avgConceded * adjustedAwayWeight + global.avgConceded * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    avgTotal: ((home.avgTotal * adjustedHomeWeight + away.avgTotal * adjustedAwayWeight + global.avgTotal * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    cleanSheetPct: ((home.cleanSheetPct * adjustedHomeWeight + away.cleanSheetPct * adjustedAwayWeight + global.cleanSheetPct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    noGoalsPct: ((home.noGoalsPct * adjustedHomeWeight + away.noGoalsPct * adjustedAwayWeight + global.noGoalsPct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    over25Pct: ((home.over25Pct * adjustedHomeWeight + away.over25Pct * adjustedAwayWeight + global.over25Pct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
    under25Pct: ((home.under25Pct * adjustedHomeWeight + away.under25Pct * adjustedAwayWeight + global.under25Pct * adjustedGlobalWeight) / (adjustedTotalWeight || 1)),
  };
}

/**
 * Calcula força ofensiva e defensiva do oponente para ajustar lambda
 * 
 * @param opponentStats - Estatísticas do oponente
 * @param opponentTableData - Dados da tabela do oponente (opcional)
 * @returns Força ofensiva e defensiva normalizadas (0-1)
 */
export function calculateOpponentStrength(
  opponentStats: { avgScored: number; avgConceded: number; cleanSheetPct: number; over25Pct: number },
  opponentTableData?: { GF?: string; GA?: string; MP?: string; xG?: string; xGA?: string }
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

  // Se temos dados da tabela, usar para validar/ajustar
  if (opponentTableData) {
    const mp = parseFloat(opponentTableData.MP || '0');
    const gf = parseFloat(opponentTableData.GF || '0');
    const ga = parseFloat(opponentTableData.GA || '0');
    
    if (mp > 0) {
      const tableOffensive = Math.min(1, (gf / mp) / 3);
      const tableDefensive = Math.max(0, 1 - (ga / mp) / 2);
      
      // Combinar com peso 70% para estatísticas (mais recentes) e 30% para tabela
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
export function calculateMomentum(
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
export function validateStatsConsistency(
  home: { avgScored: number; avgConceded: number },
  away: { avgScored: number; avgConceded: number },
  global: { avgScored: number; avgConceded: number }
): { consistencyScore: number; hasSignificantDivergence: boolean } {
  // Calcular médias esperadas
  const expectedHomeAvg = (home.avgScored + away.avgScored) / 2;
  const expectedAwayAvg = (home.avgConceded + away.avgConceded) / 2;

  // Comparar com dados global
  const scoredDiff = Math.abs(global.avgScored - expectedHomeAvg);
  const concededDiff = Math.abs(global.avgConceded - expectedAwayAvg);

  // Normalizar diferenças (tolerância de 0.3 gols = boa consistência)
  const scoredConsistency = Math.max(0, 1 - (scoredDiff / 0.3));
  const concededConsistency = Math.max(0, 1 - (concededDiff / 0.3));

  const consistencyScore = (scoredConsistency + concededConsistency) / 2;
  const hasSignificantDivergence = scoredDiff > 0.5 || concededDiff > 0.5;

  return { consistencyScore, hasSignificantDivergence };
}

/**
 * Cria valores padrão para CompetitionComplementAverages quando não há dados disponíveis
 * Usa valores típicos de campeonatos de futebol
 */
export function createDefaultComplementAvg(): CompetitionComplementAverages {
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

/**
 * Calcula pesos adaptativos baseados na qualidade e disponibilidade dos dados
 */
export function calculateAdaptiveWeights(
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
/**
 * Calcula score de completude das tabelas (0-1)
 */
export function calculateTableCompletenessScore(data: MatchData): {
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

  if (
    data.homeComplementData &&
    data.awayComplementData &&
    data.competitionComplementAvg
  ) {
    availableTables.push('complement');
  } else {
    missingTables.push('complement');
  }

  if (
    data.homeComplementData &&
    data.awayComplementData &&
    data.competitionComplementAvg
  ) {
    availableTables.push('complement');
  } else {
    missingTables.push('complement');
  }

  const score = availableTables.length / 2; // 0.0 a 1.0 (geral e complement)

  return { score, availableTables, missingTables };
}

/**
 * Retorna resumo do impacto de cada tabela
 */
export function getTableImpactSummary(data: MatchData): {
  geral: { available: boolean; impact: string };
  homeAway: { available: boolean; impact: string };
  standardFor: { available: boolean; impact: string };
} {
  const hasGeral = !!(data.homeTableData && data.awayTableData);
  const hasComplement =
    !!data.homeComplementData &&
    !!data.awayComplementData &&
    !!data.competitionComplementAvg;

  return {
    geral: {
      available: hasGeral,
      impact: hasGeral ? 'Alto (base para cálculo de lambda)' : 'Não disponível',
    },
    homeAway: {
      available: false,
      impact: 'Não disponível',
    },
    standardFor: {
      available: hasComplement,
      impact: hasComplement ? 'Médio-Alto (ajuste de posse, performance e idade)' : 'Não disponível',
    },
  };
}

/**
 * Valida integridade dos dados das tabelas
 * Verifica se os dados básicos estão presentes e se há consistência entre tabelas
 */
export function validateTableDataIntegrity(data: MatchData): {
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
      warnings.push(`Divergência de Squad na tabela geral vs complemento (casa): "${geralSquad}" vs "${complementSquad}"`);
    }
  }

  if (data.awayTableData && data.awayComplementData) {
    const geralSquad = String(data.awayTableData.Squad || '').trim();
    const complementSquad = String((data.awayComplementData as { Squad?: string })?.Squad || '').trim();
    if (geralSquad && complementSquad && geralSquad !== complementSquad) {
      warnings.push(`Divergência de Squad na tabela geral vs complemento (visitante): "${geralSquad}" vs "${complementSquad}"`);
    }
  }

  // Verificar se tabela complemento tem competitionAvg quando necessário
  if (data.homeComplementData && data.awayComplementData && !data.competitionComplementAvg) {
    warnings.push('Tabela complemento presente mas competitionComplementAvg ausente');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}

export function normalizeMatchData(data: MatchData): MatchData {
  // competitionAvg deve representar média de gols por jogo (ex.: 2.6, 3.1).
  // Valores muito altos (>10) geralmente indicam dado antigo/corrompido (ex.: percentual) e devem ser ignorados.
  const normalizedCompetitionAvg =
    typeof data.competitionAvg === 'number' &&
    Number.isFinite(data.competitionAvg) &&
    data.competitionAvg > 0 &&
    data.competitionAvg <= 10
      ? data.competitionAvg
      : 0;

  // Verificar se todas as 2 tabelas estão presentes antes de normalizar
  const hasAllTables =
    !!data.homeTableData &&
    !!data.awayTableData &&
    !!data.homeComplementData &&
    !!data.awayComplementData &&
    !!data.competitionComplementAvg;

  logger.log('[AnalysisEngine] normalizeMatchData - Verificando dados das 2 tabelas:', {
    geral: !!(data.homeTableData && data.awayTableData),
    complement: !!(data.homeComplementData && data.awayComplementData && data.competitionComplementAvg),
    todasPresentes: hasAllTables,
  });

  // Validar integridade dos dados das tabelas
  const integrityCheck = validateTableDataIntegrity(data);
  if (integrityCheck.issues.length > 0) {
    logger.error('[AnalysisEngine] ⚠️ Problemas de integridade encontrados:', integrityCheck.issues);
  }
  if (integrityCheck.warnings.length > 0) {
    logger.warn('[AnalysisEngine] ⚠️ Avisos de integridade:', integrityCheck.warnings);
  }
  if (integrityCheck.isValid && integrityCheck.warnings.length === 0) {
    logger.log('[AnalysisEngine] ✅ Integridade dos dados das tabelas validada com sucesso');
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
    // PRESERVAR TODOS OS DADOS DAS 2 TABELAS (spread operator já faz isso, mas garantindo explicitamente)
    homeTableData: data.homeTableData,
    awayTableData: data.awayTableData,
    homeComplementData: data.homeComplementData,
    awayComplementData: data.awayComplementData,
    competitionComplementAvg: data.competitionComplementAvg,
  };
}
