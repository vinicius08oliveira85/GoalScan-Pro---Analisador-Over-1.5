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
 * Combina probabilidade estatística com probabilidade da IA usando média ponderada adaptativa.
 * O peso da IA é baseado na confiança da IA e na consistência entre os valores.
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

  // Normalizar confiança para 0-1
  let aiWeight = Math.min(Math.max(aiConfidence / 100, 0), 1);

  // Ajustar peso baseado na divergência
  // Se valores muito diferentes, reduzir peso da IA
  if (divergence > maxDivergence) {
    // Reduzir peso da IA proporcionalmente à divergência
    const divergencePenalty = Math.min(divergence / maxDivergence, 1);
    aiWeight = aiWeight * (1 - divergencePenalty * 0.5); // Reduzir até 50% do peso
  }

  const statisticalWeight = 1 - aiWeight;

  // Calcular média ponderada
  const combined = aiProb * aiWeight + statisticalProb * statisticalWeight;

  // Suavizar limites usando sigmoid em vez de clamp rígido (10-98% mais realista)
  return smoothClamp(combined, 10, 98);
}

/**
 * Calcula pesos adaptativos baseados na qualidade e disponibilidade dos dados
 */
function calculateAdaptiveWeights(
  homeOver15Freq: number,
  awayOver15Freq: number,
  competitionAvg: number,
  hasTeamStats: boolean
): { homeWeight: number; awayWeight: number; competitionWeight: number } {
  // Base: se temos dados dos times, dar mais peso a eles
  const hasHomeData = homeOver15Freq > 0;
  const hasAwayData = awayOver15Freq > 0;
  const hasCompetitionData = competitionAvg > 0;

  // Contar quantos dados temos
  const dataCount = (hasHomeData ? 1 : 0) + (hasAwayData ? 1 : 0) + (hasCompetitionData ? 1 : 0);

  if (dataCount === 0) {
    // Sem dados, usar pesos padrão
    return { homeWeight: 0.25, awayWeight: 0.25, competitionWeight: 0.5 };
  }

  // Se temos dados dos times E estatísticas detalhadas, dar mais peso aos times
  if (hasTeamStats && hasHomeData && hasAwayData) {
    return { homeWeight: 0.35, awayWeight: 0.35, competitionWeight: 0.3 };
  }

  // Se temos apenas um time, ajustar pesos
  if (hasHomeData && !hasAwayData) {
    return { homeWeight: 0.4, awayWeight: 0, competitionWeight: 0.6 };
  }
  if (!hasHomeData && hasAwayData) {
    return { homeWeight: 0, awayWeight: 0.4, competitionWeight: 0.6 };
  }

  // Padrão: balanceado
  return { homeWeight: 0.3, awayWeight: 0.3, competitionWeight: 0.4 };
}

/**
 * Executa análise completa de uma partida para Over 1.5 goals usando algoritmo Poisson v3.8.
 * Combina estatísticas históricas, métricas avançadas e opcionalmente IA para calcular probabilidade,
 * EV, risco e recomendações de aposta.
 *
 * @param data - Dados da partida incluindo estatísticas dos times e competição
 * @param aiProbability - Probabilidade calculada pela IA (0-100), opcional
 * @param aiConfidence - Confiança da IA (0-100), opcional
 * @returns Resultado da análise com probabilidades, métricas e recomendações
 * @throws Error se dados de entrada forem inválidos
 */
export function performAnalysis(
  data: MatchData,
  aiProbability?: number | null,
  aiConfidence?: number | null
): AnalysisResult {
  // Validar entrada
  if (!data || typeof data !== 'object') {
    throw new Error('Dados de entrada inválidos: data deve ser um objeto');
  }

  if (!data.homeTeam || !data.awayTeam) {
    throw new Error('Dados de entrada inválidos: homeTeam e awayTeam são obrigatórios');
  }

  // NOVO ALGORITMO SIMPLIFICADO: Baseado em estatísticas específicas (home para time da casa, away para visitante)

  // 1. Obter Over 1.5% de cada time (dado mais importante)
  const homeOver15Freq = data.homeOver15Freq || 0;
  const awayOver15Freq = data.awayOver15Freq || 0;

  // 2. Obter média da competição (baseline importante)
  const competitionAvg = data.competitionAvg || 0;

  // 3. Calcular média total de gols (avgTotal de ambos times)
  // Usar estatísticas específicas: home para time da casa, away para visitante
  const homeAvgTotal = data.homeTeamStats?.gols?.home?.avgTotal || 0;
  const awayAvgTotal = data.awayTeamStats?.gols?.away?.avgTotal || 0;
  const avgTotal = (homeAvgTotal + awayAvgTotal) / 2;

  // 4. Calcular médias de cleanSheet e noGoals
  const homeCleanSheet = data.homeTeamStats?.gols?.home?.cleanSheetPct || 0;
  const awayCleanSheet = data.awayTeamStats?.gols?.away?.cleanSheetPct || 0;
  const avgCleanSheet = (homeCleanSheet + awayCleanSheet) / 2;

  const homeNoGoals = data.homeTeamStats?.gols?.home?.noGoalsPct || 0;
  const awayNoGoals = data.awayTeamStats?.gols?.away?.noGoalsPct || 0;
  const avgNoGoals = (homeNoGoals + awayNoGoals) / 2;

  // 5. Calcular média de Over 2.5% (confirma tendência ofensiva)
  const homeOver25 = data.homeTeamStats?.gols?.home?.over25Pct || 0;
  const awayOver25 = data.awayTeamStats?.gols?.away?.over25Pct || 0;
  const avgOver25 = (homeOver25 + awayOver25) / 2;

  // 6. Calcular pesos adaptativos baseados na qualidade dos dados
  const hasTeamStats = !!(data.homeTeamStats && data.awayTeamStats);
  const weights = calculateAdaptiveWeights(
    homeOver15Freq,
    awayOver15Freq,
    competitionAvg,
    hasTeamStats
  );

  // Aplicar fórmula ponderada adaptativa
  let prob =
    homeOver15Freq * weights.homeWeight +
    awayOver15Freq * weights.awayWeight +
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

  // Considerar H2H se disponível
  if (data.h2hOver15Freq > 0) {
    const h2hWeight = 0.15; // Peso moderado para H2H
    prob = prob * (1 - h2hWeight) + data.h2hOver15Freq * h2hWeight;
  }

  // Considerar xG se disponível (Expected Goals)
  if (data.homeXG > 0 && data.awayXG > 0) {
    const avgXG = (data.homeXG + data.awayXG) / 2;
    // xG > 2.5 indica alta probabilidade de gols
    if (avgXG > 2.5) {
      prob += 3;
    } else if (avgXG < 1.5) {
      prob -= 3;
    }
  }

  // Se não temos dados suficientes, usar apenas média da competição como baseline
  if (homeOver15Freq === 0 && awayOver15Freq === 0 && competitionAvg > 0) {
    prob = competitionAvg;
  }

  // Suavizar limites usando sigmoid (10-98% mais realista)
  prob = smoothClamp(prob, 10, 98);

  // Calcular Poisson para visualização (usando médias de gols se disponíveis)
  // Usar estatísticas específicas: home para time da casa, away para visitante
  const homeGoalsScored = data.homeTeamStats?.gols?.home?.avgScored || 1.0;
  const homeGoalsConceded = data.homeTeamStats?.gols?.home?.avgConceded || 1.0;
  const awayGoalsScored = data.awayTeamStats?.gols?.away?.avgScored || 1.0;
  const awayGoalsConceded = data.awayTeamStats?.gols?.away?.avgConceded || 1.0;

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
    data.homeHistory &&
    data.awayHistory &&
    data.homeHistory.length > 0 &&
    data.awayHistory.length > 0
  ) {
    // Analisar últimos 3 jogos de cada time
    const recentHome = data.homeHistory.slice(0, 3);
    const recentAway = data.awayHistory.slice(0, 3);

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

  // Score de confiança melhorado baseado na qualidade e completude dos dados
  let confidence = 30; // Base mais baixa

  // Pontos por dados fundamentais
  if (homeOver15Freq > 0) confidence += 15;
  if (awayOver15Freq > 0) confidence += 15;
  if (competitionAvg > 0) confidence += 10;

  // Pontos por estatísticas detalhadas
  if (hasTeamStats) {
    confidence += 20;
    if (homeAvgTotal > 0 && awayAvgTotal > 0) confidence += 5;
    if (avgCleanSheet > 0 || avgNoGoals > 0) confidence += 5;
  }

  // Pontos por dados adicionais
  if (data.h2hOver15Freq > 0) confidence += 5;
  if (data.homeXG > 0 && data.awayXG > 0) confidence += 5;

  // Penalidade por dados incompletos
  const dataCompleteness =
    (homeOver15Freq > 0 ? 1 : 0) +
    (awayOver15Freq > 0 ? 1 : 0) +
    (competitionAvg > 0 ? 1 : 0) +
    (hasTeamStats ? 1 : 0);
  if (dataCompleteness < 2) {
    confidence = Math.max(confidence - 10, 20); // Penalizar se muito poucos dados
  }

  confidence = Math.min(100, Math.max(0, confidence));

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
  };
}
