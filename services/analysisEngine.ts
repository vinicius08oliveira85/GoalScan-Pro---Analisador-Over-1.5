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
 * Combina probabilidade estatística com probabilidade da IA usando Bayesian averaging melhorado.
 * O peso da IA é baseado na confiança da IA, consistência entre valores e histórico de precisão.
 *
 * MELHORIA: Usa abordagem Bayesian para combinar fontes com diferentes níveis de confiança.
 * Considera variância implícita de cada fonte e ajusta pesos dinamicamente.
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

    // Informar sobre dados da tabela (usados apenas pela IA, não pela análise estatística)
    if (hasHomeTableData || hasAwayTableData) {
      console.log('[AnalysisEngine] Dados da tabela disponíveis (usados pela IA, não pela análise estatística):', {
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
  const lambdaTotal = lambdaHome + lambdaAway; // Média total de gols esperados no jogo

  const pHome: number[] = [];
  const pAway: number[] = [];
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHome));
    pAway.push(poissonProbability(i, lambdaAway));
  }

  // Calcular probabilidades Over/Under para múltiplas linhas usando Poisson
  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaTotal);

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

  // Calcular Prob. Tabela separadamente (baseada apenas em dados da tabela)
  let tableProb: number | null = null;
  if (hasHomeTableData && hasAwayTableData) {
    // Calcular usando apenas dados da tabela (GF/MP, GA/MP, xG, xGA)
    const homeMp = parseFloat(normalizedData.homeTableData.MP || '0');
    const homeGf = parseFloat(normalizedData.homeTableData.GF || '0');
    const homeGa = parseFloat(normalizedData.homeTableData.GA || '0');
    const homeXg = parseFloat(normalizedData.homeTableData.xG || '0');
    const homeXga = parseFloat(normalizedData.homeTableData.xGA || '0');
    
    const awayMp = parseFloat(normalizedData.awayTableData.MP || '0');
    const awayGf = parseFloat(normalizedData.awayTableData.GF || '0');
    const awayGa = parseFloat(normalizedData.awayTableData.GA || '0');
    const awayXg = parseFloat(normalizedData.awayTableData.xG || '0');
    const awayXga = parseFloat(normalizedData.awayTableData.xGA || '0');
    
    if (homeMp > 0 && awayMp > 0) {
      // Calcular médias de gols da tabela
      const homeAvgScored = homeGf / homeMp;
      const homeAvgConceded = homeGa / homeMp;
      const awayAvgScored = awayGf / awayMp;
      const awayAvgConceded = awayGa / awayMp;
      
      // Usar xG se disponível, caso contrário usar GF/MP
      const homeExpectedScored = homeXg > 0 ? homeXg / homeMp : homeAvgScored;
      const homeExpectedConceded = homeXga > 0 ? homeXga / homeMp : homeAvgConceded;
      const awayExpectedScored = awayXg > 0 ? awayXg / awayMp : awayAvgScored;
      const awayExpectedConceded = awayXga > 0 ? awayXga / awayMp : awayAvgConceded;
      
      // Lambda para Poisson: média de gols esperados
      const lambdaHome = homeExpectedScored + awayExpectedConceded;
      const lambdaAway = awayExpectedScored + homeExpectedConceded;
      const lambdaTotal = lambdaHome + lambdaAway;
      
      // Calcular probabilidade Over 1.5 usando Poisson
      const over15Prob = 1 - poissonCumulative(1, lambdaTotal);
      tableProb = Math.max(10, Math.min(98, over15Prob * 100));
      
      if (import.meta.env.DEV) {
        console.log('[AnalysisEngine] Prob. Tabela calculada:', {
          lambdaHome,
          lambdaAway,
          lambdaTotal,
          tableProb,
        });
      }
    }
  }

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
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    finalEv = ((finalProb / 100) * normalizedData.oddOver15 - 1) * 100;
  }

  return {
    probabilityOver15: prob, // Probabilidade estatística pura
    tableProbability: tableProb, // Probabilidade baseada apenas em dados da tabela
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
    // Probabilidades Over/Under calculadas estatisticamente (sempre disponíveis, mesmo sem IA)
    overUnderProbabilities,
  };
}
