import { MatchData, AnalysisResult, CompetitionComplementAverages, TableRowComplement } from '../types';
import { logger } from '../utils/logger';
import { smoothAdjustment, smoothClamp, poissonProbability, poissonCumulative, calculateDixonColesUnder15, calculateOverUnderProbabilities, getWeightedTeamStats, calculateOpponentStrength, calculateMomentum, validateStatsConsistency, createDefaultComplementAvg, calculateAdaptiveWeights, calculateTableCompletenessScore, getTableImpactSummary, validateTableDataIntegrity, normalizeMatchData } from './analysisEngineUtils';

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

  // Extrair médias de gols combinadas (já ponderadas)
  const homeAvgScored = homeWeightedStats.avgScored || 0;
  const homeAvgConceded = homeWeightedStats.avgConceded || 0;
  const awayAvgScored = awayWeightedStats.avgScored || 0;
  const awayAvgConceded = awayWeightedStats.avgConceded || 0;

  if (homeAvgScored === 0 && homeAvgConceded === 0 && awayAvgScored === 0 && awayAvgConceded === 0) {
    return null;
  }

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

  // 4. Calcular força do oponente para ajustar lambda
  const homeOpponentStrength = calculateOpponentStrength(
    awayWeightedStats,
    data.awayTableData
  );
  const awayOpponentStrength = calculateOpponentStrength(
    homeWeightedStats,
    data.homeTableData
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

  logger.log('[AnalysisEngine] Prob. Estatísticas calculada (com dados Global):', {
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
 * SEMPRE usa a tabela geral (obrigatória) e a tabela complemento quando disponível (mesmo parcialmente).
 *
 * @param data - Dados da partida incluindo homeTableData, awayTableData, homeComplementData, awayComplementData
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

  // Para time visitante: usar Away MP, Away GF, Away GA, etc.
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
  
  if (hasXgData) {
    logger.log('[AnalysisEngine] ✅ Formato COMPLETO detectado - usando xG + GF/GA para análise');
  } else {
    logger.log('[AnalysisEngine] ⚠️ Formato BÁSICO detectado - usando apenas GF/GA (sem xG)');
    logger.log('[AnalysisEngine] A análise será baseada em gols reais (GF/GA) em vez de Expected Goals (xG)');
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
  // Confiabilidade da tabela: quanto mais jogos, menos "extremos" (shrink para a média)
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

  // 3b. Complemento (championship_complement): ajustar baseado em Playing Time, Performance e Per 90 Minutes
  // Usar complemento mesmo parcialmente - se houver pelo menos um dos dados, tentar usar
  const hasHomeComplement = !!data.homeComplementData;
  const hasAwayComplement = !!data.awayComplementData;
  const hasCompetitionAvg = !!data.competitionComplementAvg;
  const hasFullComplement = hasHomeComplement && hasAwayComplement && hasCompetitionAvg;
  const hasPartialComplement = hasHomeComplement || hasAwayComplement;

  logger.log('[AnalysisEngine] calculateTableProbability - Verificando complemento:', {
    hasHomeComplement,
    hasAwayComplement,
    hasCompetitionAvg,
    hasFullComplement,
    hasPartialComplement,
    lambdaHomeAntes: lambdaHome,
    lambdaAwayAntes: lambdaAway,
  });

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
      if (hasHomeComplement && data.homeComplementData) allRows.push(data.homeComplementData as TableRowComplement);
      if (hasAwayComplement && data.awayComplementData) allRows.push(data.awayComplementData as TableRowComplement);

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

        logger.log('[AnalysisEngine] ✅ Média básica de complemento calculada a partir de dados parciais:', avg);
      }
    }
    
    // GARANTIR que avg nunca seja null - usar valores padrão se necessário
    const avgToUse = avg || createDefaultComplementAvg();
    
    if (!avg) {
      logger.warn('[AnalysisEngine] ⚠️ Usando valores padrão para média de complemento (dados parciais disponíveis mas média não calculada)');
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
    const homeRow: Partial<TableRowComplement> = hasHomeComplement && data.homeComplementData
      ? data.homeComplementData
      : {};
    const awayRow: Partial<TableRowComplement> = hasAwayComplement && data.awayComplementData
      ? data.awayComplementData
      : {};

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

    logger.log('[AnalysisEngine] ✅ Ajuste complemento aplicado (TABELA COMPLEMENTO SENDO USADA):', {
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
  } else {
    logger.warn('[AnalysisEngine] ⚠️ Tabela complemento não disponível - ajustes adicionais não aplicados');
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

  logger.log('[AnalysisEngine] ===== Prob. Tabela calculada (com todas as tabelas) =====');
  logger.log('[AnalysisEngine] ✅ TABELAS APLICADAS NA ANÁLISE:', {
    tabelaGeral: {
      aplicada: true, // Sempre aplicada (base para cálculo)
      homeTableData: !!data.homeTableData,
      awayTableData: !!data.awayTableData,
      impacto: 'Alto - base para cálculo de lambda',
    },
    tabelaComplemento: {
      aplicada: hasPartialComplement,
      completo: hasFullComplement,
      parcial: hasPartialComplement && !hasFullComplement,
      homeComplementData: hasHomeComplement,
      awayComplementData: hasAwayComplement,
      competitionComplementAvg: hasCompetitionAvg,
      usandoValoresPadrao: hasPartialComplement && !avg,
      impacto: hasPartialComplement ? 'Médio-Alto - ajuste de posse, performance e idade' : 'Não aplicada',
    },
    'ambasTabelasAplicadas': true && hasPartialComplement,
  });
  logger.log('[AnalysisEngine] Resultados:', {
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
    logger.warn('[AnalysisEngine] ⚠️ Tabela complemento NÃO foi aplicada (nenhum dado disponível):', {
      hasHomeComplement,
      hasAwayComplement,
      hasCompetitionAvg,
      'recomendacao': 'Adicione a tabela de complemento para aumentar a precisão',
    });
  } else if (!hasFullComplement) {
    logger.warn('[AnalysisEngine] ⚠️ Tabela complemento aplicada PARCIALMENTE:', {
      hasHomeComplement,
      hasAwayComplement,
      hasCompetitionAvg,
      'médiaCalculada': !!avg && !data.competitionComplementAvg,
      'usandoValoresPadrao': !avg,
    });
  } else {
    logger.log('[AnalysisEngine] ✅✅✅ TODAS AS TABELAS (GERAL + COMPLEMENTO) FORAM APLICADAS COMPLETAMENTE NO CÁLCULO DA PROBABILIDADE!');
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
  const hasComplement = !!(
    data.homeComplementData &&
    data.awayComplementData &&
    data.competitionComplementAvg
  );

  // 1) Peso base por confiabilidade da tabela (MP)
  const homeMp = hasTableData ? parseFloat(data.homeTableData!.MP || '0') : 0;
  const awayMp = hasTableData ? parseFloat(data.awayTableData!.MP || '0') : 0;
  const minMp = Math.min(homeMp || 0, awayMp || 0);

  // MP ~ 12+ costuma dar estabilidade razoável (clamp 0..1)
  const tableReliability = hasTableData ? clamp(minMp / 12, 0, 1) : 0;

  // Estatísticas são mais recentes, mas a tabela ganha peso conforme MP aumenta
  let tableWeight = 0.25 + 0.15 * tableReliability; // 0.25..0.40
  let statsWeight = 1 - tableWeight; // 0.60..0.75

  // Pequeno bônus quando há complemento presente (mais contexto)
  if (hasComplement && hasTableData) {
    tableWeight = clamp(tableWeight + 0.03, 0, 0.45);
    statsWeight = 1 - tableWeight;
  }

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
 * Valida os dados de entrada da análise
 */
function validateAnalysisInput(data: MatchData): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Dados de entrada inválidos: data deve ser um objeto');
  }
  if (!data.homeTeam || !data.awayTeam) {
    throw new Error('Dados de entrada inválidos: homeTeam e awayTeam são obrigatórios');
  }
}

/**
 * Extrai estatísticas de avgTotal com fallback para dados da tabela
 */
function extractTeamAverages(
  data: MatchData
): { homeAvgTotal: number; awayAvgTotal: number; avgTotal: number } {
  let homeAvgTotal = data.homeTeamStats?.gols?.home?.avgTotal || 0;
  let awayAvgTotal = data.awayTeamStats?.gols?.away?.avgTotal || 0;

  if (homeAvgTotal === 0 && data.homeTableData) {
    const mp = parseFloat(data.homeTableData['Home MP'] || data.homeTableData.MP || '0');
    const gf = parseFloat(data.homeTableData['Home GF'] || data.homeTableData.GF || '0');
    const ga = parseFloat(data.homeTableData['Home GA'] || data.homeTableData.GA || '0');
    if (mp > 0) homeAvgTotal = (gf / mp) + (ga / mp);
  }

  if (awayAvgTotal === 0 && data.awayTableData) {
    const mp = parseFloat(data.awayTableData['Away MP'] || data.awayTableData.MP || '0');
    const gf = parseFloat(data.awayTableData['Away GF'] || data.awayTableData.GF || '0');
    const ga = parseFloat(data.awayTableData['Away GA'] || data.awayTableData.GA || '0');
    if (mp > 0) awayAvgTotal = (gf / mp) + (ga / mp);
  }

  return { homeAvgTotal, awayAvgTotal, avgTotal: (homeAvgTotal + awayAvgTotal) / 2 };
}

/**
 * Calcula métricas avançadas
 */
function computeAdvancedMetrics(
  avgTotal: number,
  homeGoalsConceded: number,
  awayGoalsConceded: number,
  avgCleanSheet: number,
  data: MatchData
): { offensiveVolume: number; defensiveLeaking: number; bttsCorrelation: number; formTrend: number } {
  const offensiveVolume = Math.min(100, Math.max(0, (avgTotal / 3) * 100));
  const defensiveLeaking = Math.min(100, Math.max(0, ((homeGoalsConceded + awayGoalsConceded) / 2) * 50));
  const bttsCorrelation = Math.min(100, Math.max(0, 100 - avgCleanSheet));

  let formTrend = 0;
  if (data.homeHistory?.length && data.awayHistory?.length) {
    const recentHome = data.homeHistory.slice(0, 3);
    const recentAway = data.awayHistory.slice(0, 3);
    const homeRecentGoals = recentHome.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / recentHome.length;
    const awayRecentGoals = recentAway.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / recentAway.length;
    const recentAvg = (homeRecentGoals + awayRecentGoals) / 2;
    if (recentAvg > avgTotal) formTrend = Math.min(10, (recentAvg - avgTotal) * 2);
    else if (recentAvg < avgTotal) formTrend = Math.max(-10, (recentAvg - avgTotal) * 2);
  }

  return { offensiveVolume, defensiveLeaking, bttsCorrelation, formTrend };
}

/**
 * Calcula score de confiança baseado em qualidade e completude dos dados
 */
function computeConfidenceScore(params: {
  estimatedOver15Freq: number;
  competitionAvg: number;
  hasTeamStats: boolean;
  homeAvgTotal: number;
  awayAvgTotal: number;
  avgCleanSheet: number;
  avgNoGoals: number;
  tableCompleteness: { score: number; missingTables: string[] };
  hasHomeTeamStats: boolean;
  hasHomeTableData: boolean;
  hasAwayTeamStats: boolean;
  hasAwayTableData: boolean;
  normalizedData: MatchData;
}): number {
  let confidence = 30;
  const { estimatedOver15Freq, competitionAvg, hasTeamStats, homeAvgTotal, awayAvgTotal, avgCleanSheet, avgNoGoals, tableCompleteness, hasHomeTeamStats, hasHomeTableData, hasAwayTeamStats, hasAwayTableData, normalizedData } = params;

  if (estimatedOver15Freq > 50) confidence += 30;
  if (competitionAvg > 0) confidence += 10;
  if (hasTeamStats) {
    confidence += 20;
    if (homeAvgTotal > 0 && awayAvgTotal > 0) confidence += 5;
    if (avgCleanSheet > 0 || avgNoGoals > 0) confidence += 5;
  }
  if (normalizedData.h2hOver15Freq > 0) confidence += 5;
  if (normalizedData.homeXG && normalizedData.awayXG && normalizedData.homeXG > 0 && normalizedData.awayXG > 0) confidence += 5;

  if (tableCompleteness.score === 1.0) confidence += 15;
  else if (tableCompleteness.score >= 0.5) confidence += 8;
  else confidence = Math.max(confidence - 5, 20);

  let crossValidationScore = 0;
  if (hasHomeTeamStats && hasHomeTableData && normalizedData.homeTeamStats) {
    const homeWeighted = getWeightedTeamStats(
      normalizedData.homeTeamStats.gols.home,
      normalizedData.homeTeamStats.gols.away,
      normalizedData.homeTeamStats.gols.global,
      'home'
    );
    const mp = parseFloat(normalizedData.homeTableData?.MP || '0');
    const gf = parseFloat(normalizedData.homeTableData?.GF || '0');
    const ga = parseFloat(normalizedData.homeTableData?.GA || '0');
    if (mp > 0 && homeWeighted.avgScored > 0) {
      const scoredDiff = Math.abs(homeWeighted.avgScored - gf / mp);
      const concededDiff = Math.abs(homeWeighted.avgConceded - ga / mp);
      if (scoredDiff < 0.3 && concededDiff < 0.3) {
        confidence += 3;
        crossValidationScore += 0.5;
      } else if (scoredDiff < 0.5 && concededDiff < 0.5) {
        confidence += 1;
        crossValidationScore += 0.25;
      }
    }
  }

  if (hasAwayTeamStats && hasAwayTableData && normalizedData.awayTeamStats) {
    const awayWeighted = getWeightedTeamStats(
      normalizedData.awayTeamStats.gols.home,
      normalizedData.awayTeamStats.gols.away,
      normalizedData.awayTeamStats.gols.global,
      'away'
    );
    const mp = parseFloat(normalizedData.awayTableData?.MP || '0');
    const gf = parseFloat(normalizedData.awayTableData?.GF || '0');
    const ga = parseFloat(normalizedData.awayTableData?.GA || '0');
    if (mp > 0 && awayWeighted.avgScored > 0) {
      const scoredDiff = Math.abs(awayWeighted.avgScored - gf / mp);
      const concededDiff = Math.abs(awayWeighted.avgConceded - ga / mp);
      if (scoredDiff < 0.3 && concededDiff < 0.3) {
        confidence += 3;
        crossValidationScore += 0.5;
      } else if (scoredDiff < 0.5 && concededDiff < 0.5) {
        confidence += 1;
        crossValidationScore += 0.25;
      }
    }
  }

  if (crossValidationScore >= 1.0) confidence += 5;
  else if (crossValidationScore >= 0.5) confidence += 2;

  if (homeAvgTotal > 0 && homeAvgTotal < 6 && awayAvgTotal > 0 && awayAvgTotal < 6) confidence += 2;
  if (competitionAvg > 0 && competitionAvg < 5) confidence += 2;

  const dataCompletenessScore = (estimatedOver15Freq > 50 ? 1 : 0) + (competitionAvg > 0 ? 1 : 0) + (hasTeamStats ? 1 : 0);
  if (dataCompletenessScore < 2) confidence = Math.max(confidence - 10, 20);

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Extrai lambdas base para Poisson a partir dos dados disponíveis
 */
function computeBaseLambdas(
  data: MatchData
): { lambdaHome: number; lambdaAway: number; homeGoalsScored: number; homeGoalsConceded: number; awayGoalsScored: number; awayGoalsConceded: number } {
  let homeGoalsScored = 0;
  let homeGoalsConceded = 0;
  let awayGoalsScored = 0;
  let awayGoalsConceded = 0;

  if (data.homeTeamStats && data.awayTeamStats) {
    const hw = getWeightedTeamStats(data.homeTeamStats.gols.home, data.homeTeamStats.gols.away, data.homeTeamStats.gols.global, 'home');
    const aw = getWeightedTeamStats(data.awayTeamStats.gols.home, data.awayTeamStats.gols.away, data.awayTeamStats.gols.global, 'away');
    homeGoalsScored = hw.avgScored;
    homeGoalsConceded = hw.avgConceded;
    awayGoalsScored = aw.avgScored;
    awayGoalsConceded = aw.avgConceded;
  }

  if (data.homeTableData) {
    const mp = parseFloat(data.homeTableData['Home MP'] || data.homeTableData.MP || '0');
    const gf = parseFloat(data.homeTableData['Home GF'] || data.homeTableData.GF || '0');
    const ga = parseFloat(data.homeTableData['Home GA'] || data.homeTableData.GA || '0');
    if (mp > 0) { homeGoalsScored = gf / mp; homeGoalsConceded = ga / mp; }
  }

  if (data.awayTableData) {
    const mp = parseFloat(data.awayTableData['Away MP'] || data.awayTableData.MP || '0');
    const gf = parseFloat(data.awayTableData['Away GF'] || data.awayTableData.GF || '0');
    const ga = parseFloat(data.awayTableData['Away GA'] || data.awayTableData.GA || '0');
    if (mp > 0) { awayGoalsScored = gf / mp; awayGoalsConceded = ga / mp; }
  }

  homeGoalsScored = homeGoalsScored || 1.0;
  homeGoalsConceded = homeGoalsConceded || 1.0;
  awayGoalsScored = awayGoalsScored || 1.0;
  awayGoalsConceded = awayGoalsConceded || 1.0;

  const homeXg = data.homeTableData?.['Home xG'] || data.homeTableData?.xG;
  const awayXga = data.awayTableData?.['Away xGA'] || data.awayTableData?.['Home xGA'] || data.awayTableData?.xGA;
  if (homeXg && awayXga && parseFloat(String(homeXg)) > 0 && parseFloat(String(awayXga)) > 0) {
    homeGoalsScored = (homeGoalsScored + parseFloat(String(homeXg))) / 2;
    awayGoalsConceded = (awayGoalsConceded + parseFloat(String(awayXga))) / 2;
  }

  const awayXg = data.awayTableData?.['Away xG'] || data.awayTableData?.xG;
  const homeXga = data.homeTableData?.['Home xGA'] || data.homeTableData?.xGA;
  if (awayXg && homeXga && parseFloat(String(awayXg)) > 0 && parseFloat(String(homeXga)) > 0) {
    awayGoalsScored = (awayGoalsScored + parseFloat(String(awayXg))) / 2;
    homeGoalsConceded = (homeGoalsConceded + parseFloat(String(homeXga))) / 2;
  }

  let lambdaHome = (homeGoalsScored + awayGoalsConceded) / 2;
  let lambdaAway = (awayGoalsScored + homeGoalsConceded) / 2;

  if (data.homeTeamStats && data.awayTeamStats) {
    const hw = getWeightedTeamStats(data.homeTeamStats.gols.home, data.homeTeamStats.gols.away, data.homeTeamStats.gols.global, 'home');
    const aw = getWeightedTeamStats(data.awayTeamStats.gols.home, data.awayTeamStats.gols.away, data.awayTeamStats.gols.global, 'away');

    const homeOS = calculateOpponentStrength(aw, data.awayTableData);
    const awayOS = calculateOpponentStrength(hw, data.homeTableData);
    lambdaHome *= (1 - homeOS.defensiveStrength * 0.08) * (1 + homeOS.offensiveStrength * 0.04);
    lambdaAway *= (1 - awayOS.defensiveStrength * 0.08) * (1 + awayOS.offensiveStrength * 0.04);

    const hm = calculateMomentum(data.homeHistory || [], hw.avgScored, hw.avgConceded, true);
    const am = calculateMomentum(data.awayHistory || [], aw.avgScored, aw.avgConceded, false);
    lambdaHome *= (1 + hm.offensiveMomentum * 0.08 - hm.defensiveMomentum * 0.04);
    lambdaAway *= (1 + am.offensiveMomentum * 0.08 - am.defensiveMomentum * 0.04);

    const cs = (hw.cleanSheetPct + aw.cleanSheetPct) / 2;
    const ng = (hw.noGoalsPct + aw.noGoalsPct) / 2;
    if (cs > 40) { const r = Math.min(0.06, (cs - 40) / 100); lambdaHome *= (1 - r * 0.5); lambdaAway *= (1 - r * 0.5); }
    if (ng > 20) { const r = Math.min(0.05, (ng - 20) / 100); lambdaHome *= (1 - r * 0.5); lambdaAway *= (1 - r * 0.5); }

    const ov25 = (hw.over25Pct + aw.over25Pct) / 2;
    if (ov25 > 50) { const inc = Math.min(0.04, (ov25 - 50) / 100); lambdaHome *= (1 + inc * 0.5); lambdaAway *= (1 + inc * 0.5); }

    const hc = validateStatsConsistency(data.homeTeamStats.gols.home, data.homeTeamStats.gols.away, data.homeTeamStats.gols.global);
    const ac = validateStatsConsistency(data.awayTeamStats.gols.home, data.awayTeamStats.gols.away, data.awayTeamStats.gols.global);
    if ((hc.consistencyScore + ac.consistencyScore) / 2 < 0.7) { lambdaHome *= 0.97; lambdaAway *= 0.97; }
  }

  return { lambdaHome, lambdaAway, homeGoalsScored, homeGoalsConceded, awayGoalsScored, awayGoalsConceded };
}

/**
 * Combina lambdas de estatísticas e tabela com shrinkage para a média da competição
 */
function combineLambdas(
  statsLambdaHome: number | undefined,
  statsLambdaAway: number | undefined,
  tableLambdaHome: number | undefined,
  tableLambdaAway: number | undefined,
  lambdaHome: number,
  lambdaAway: number,
  statsWeight: number,
  tableWeight: number,
  competitionAvg: number,
  confidence: number,
  minMp: number,
  statsProb: number,
  tableProb: number | null,
  hasStatsSide: boolean,
  hasTableSide: boolean
): { lambdaHomeFinal: number; lambdaAwayFinal: number; lambdaFinal: number; bttsProbability: number } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  let lambdaHomeCombined = lambdaHome;
  let lambdaAwayCombined = lambdaAway;
  let baseShrink = 0.18;

  if (hasStatsSide && hasTableSide) {
    lambdaHomeCombined = statsLambdaHome! * statsWeight + tableLambdaHome! * tableWeight;
    lambdaAwayCombined = statsLambdaAway! * statsWeight + tableLambdaAway! * tableWeight;
    baseShrink = 0.08;
  } else if (hasStatsSide) {
    lambdaHomeCombined = statsLambdaHome!;
    lambdaAwayCombined = statsLambdaAway!;
    baseShrink = 0.12;
  } else if (hasTableSide) {
    lambdaHomeCombined = tableLambdaHome!;
    lambdaAwayCombined = tableLambdaAway!;
    baseShrink = 0.12;
  }

  const lambdaCombined = lambdaHomeCombined + lambdaAwayCombined;
  const divergenceProb = tableProb != null ? Math.abs(statsProb - tableProb) : 0;
  const confidencePenalty = clamp((80 - confidence) / 250, 0, 0.18);
  const mpPenalty = minMp > 0 ? clamp((10 - minMp) / 40, 0, 0.1) : 0;
  const divergencePenalty = hasStatsSide && hasTableSide ? clamp((divergenceProb - 15) / 250, 0, 0.1) : 0;
  const shrink = clamp(baseShrink + confidencePenalty + mpPenalty + divergencePenalty, 0.05, 0.28);

  let lambdaFinal = lambdaCombined;
  if (competitionAvg > 0 && Number.isFinite(competitionAvg)) {
    lambdaFinal = (1 - shrink) * lambdaCombined + shrink * competitionAvg;
  }

  const maxLambdaFinal = competitionAvg > 0 && Number.isFinite(competitionAvg)
    ? clamp(competitionAvg * 2.2, 4.5, 6.5) : 6.5;
  lambdaFinal = clamp(lambdaFinal, 0.2, maxLambdaFinal);

  const ratioHome = Math.max(0, Math.min(1, lambdaCombined > 0 ? lambdaHomeCombined / lambdaCombined : 0.5));
  const lambdaHomeFinal = lambdaFinal * ratioHome;
  const lambdaAwayFinal = Math.max(0, lambdaFinal - lambdaHomeFinal);

  const bttsProbability = Math.max(0, Math.min(100, (1 - Math.exp(-lambdaHomeFinal)) * (1 - Math.exp(-lambdaAwayFinal)) * 100));

  return { lambdaHomeFinal, lambdaAwayFinal, lambdaFinal, bttsProbability };
}

/**
 * Determina nível de risco baseado na probabilidade final
 */
function determineRiskLevel(finalProb: number): AnalysisResult['riskLevel'] {
  if (finalProb > 88) return 'Baixo';
  if (finalProb > 78) return 'Moderado';
  if (finalProb > 68) return 'Alto';
  return 'Muito Alto';
}

/**
 * Monta o objeto de resultado final da análise
 */
function buildAnalysisResult(params: {
  statsProb: number;
  tableProb: number | null;
  finalProb: number;
  bttsProbability: number;
  confidence: number;
  pHome: number[];
  pAway: number[];
  ev: number;
  finalEv: number;
  advancedMetrics: ReturnType<typeof computeAdvancedMetrics>;
  overUnderProbabilities: { [line: string]: { over: number; under: number } };
  tableOverUnderProbabilities?: { [line: string]: { over: number; under: number } };
  statsOverUnderProbabilities?: { [line: string]: { over: number; under: number } };
}): AnalysisResult {
  const { statsProb, tableProb, finalProb, bttsProbability, confidence, pHome, pAway, ev, finalEv, advancedMetrics, overUnderProbabilities, tableOverUnderProbabilities, statsOverUnderProbabilities } = params;

  return {
    probabilityOver15: statsProb,
    tableProbability: tableProb,
    combinedProbability: finalProb,
    bttsProbability,
    confidenceScore: confidence,
    poissonHome: pHome,
    poissonAway: pAway,
    riskLevel: determineRiskLevel(finalProb),
    ev: finalEv,
    verdict: finalProb > 80 ? 'ALTA CONFIANÇA EM GOLS' : finalProb > 70 ? 'CENÁRIO FAVORÁVEL' : 'JOGO TRANCADO',
    recommendation: finalProb > 82
      ? 'Entrada recomendada pré-live ou Over 1.0 HT no minuto 15.'
      : 'Aguarde o Live. Só entre se houver 3 chutes a gol nos primeiros 10 minutos.',
    advancedMetrics,
    overUnderProbabilities,
    tableOverUnderProbabilities,
    statsOverUnderProbabilities,
  };
}

/**
 * Executa análise completa de uma partida para Over 1.5 goals usando algoritmo Poisson v3.8.
 * Combina estatísticas históricas (últimos 10 jogos) com dados da tabela (temporada completa)
 * para calcular probabilidade, EV, risco e recomendações de aposta.
 */
export function performAnalysis(data: MatchData): AnalysisResult {
  validateAnalysisInput(data);

  logger.log('[AnalysisEngine] ===== INÍCIO DA ANÁLISE =====');
  logger.log('[AnalysisEngine] Times:', { homeTeam: data.homeTeam, awayTeam: data.awayTeam });

  const normalizedData = normalizeMatchData(data);
  const hasHomeTeamStats = !!normalizedData.homeTeamStats;
  const hasAwayTeamStats = !!normalizedData.awayTeamStats;
  const hasHomeTableData = !!normalizedData.homeTableData;
  const hasAwayTableData = !!normalizedData.awayTableData;
  const competitionAvg = normalizedData.competitionAvg || 0;
  const hasTeamStats = hasHomeTeamStats && hasAwayTeamStats;
  const tableCompleteness = calculateTableCompletenessScore(normalizedData);

  logger.log('[AnalysisEngine] Dados:', { hasHomeTeamStats, hasAwayTeamStats, hasHomeTableData, hasAwayTableData, competitionAvg, tableCompleteness: `${(tableCompleteness.score * 100).toFixed(0)}%` });

  // --- Probabilidade base ---
  const { homeAvgTotal, awayAvgTotal, avgTotal } = extractTeamAverages(normalizedData);
  const homeCleanSheet = normalizedData.homeTeamStats?.gols?.home?.cleanSheetPct || 0;
  const awayCleanSheet = normalizedData.awayTeamStats?.gols?.away?.cleanSheetPct || 0;
  const avgCleanSheet = (homeCleanSheet + awayCleanSheet) / 2;
  const homeNoGoals = normalizedData.homeTeamStats?.gols?.home?.noGoalsPct || 0;
  const awayNoGoals = normalizedData.awayTeamStats?.gols?.away?.noGoalsPct || 0;
  const avgNoGoals = (homeNoGoals + awayNoGoals) / 2;
  const homeOver25 = normalizedData.homeTeamStats?.gols?.home?.over25Pct || 0;
  const awayOver25 = normalizedData.awayTeamStats?.gols?.away?.over25Pct || 0;
  const avgOver25 = (homeOver25 + awayOver25) / 2;

  let estimatedOver15Freq = 50;
  if (avgTotal > 0) {
    const recencyWeight = hasTeamStats ? 1.0 : 0.85;
    if (avgTotal >= 2.5) estimatedOver15Freq = 90 + (avgTotal - 2.5) * 4;
    else if (avgTotal >= 2.0) estimatedOver15Freq = 75 + (avgTotal - 2.0) * 30;
    else if (avgTotal >= 1.5) estimatedOver15Freq = 60 + (avgTotal - 1.5) * 30;
    else estimatedOver15Freq = 30 + (avgTotal / 1.5) * 30;
    estimatedOver15Freq = estimatedOver15Freq * recencyWeight + 50 * (1 - recencyWeight);
  }

  const csWeight = hasTeamStats ? 0.3 : 0.2;
  const ngWeight = hasTeamStats ? 0.2 : 0.15;
  const ov25Weight = hasTeamStats ? 0.2 : 0.15;
  estimatedOver15Freq -= avgCleanSheet * csWeight;
  estimatedOver15Freq -= avgNoGoals * ngWeight;
  estimatedOver15Freq += avgOver25 * ov25Weight;
  estimatedOver15Freq = Math.max(10, Math.min(98, estimatedOver15Freq));

  const weights = calculateAdaptiveWeights(estimatedOver15Freq, competitionAvg, hasTeamStats);
  let prob = estimatedOver15Freq * (weights.homeWeight + weights.awayWeight) + competitionAvg * weights.competitionWeight;

  if (avgTotal > 0) prob += smoothAdjustment(avgTotal, 2.0, 8);
  if (avgCleanSheet > 0) prob += smoothAdjustment(avgCleanSheet, 40, -6);
  if (avgNoGoals > 0) prob += smoothAdjustment(avgNoGoals, 20, -4);
  if (avgOver25 > 0) prob += smoothAdjustment(avgOver25, 50, 3);

  // Forma recente (Last 5)
  if (normalizedData.homeTableData?.['Last 5'] || normalizedData.awayTableData?.['Last 5']) {
    const parseRecentForm = (last5: string | undefined): number => {
      if (!last5) return 0;
      let t = 0;
      for (const m of last5.trim().toUpperCase()) { if (m === 'W') t += 1; else if (m === 'L') t -= 0.5; }
      return t / 5;
    };
    const avgForm = (parseRecentForm(normalizedData.homeTableData?.['Last 5']) + parseRecentForm(normalizedData.awayTableData?.['Last 5'])) / 2;
    prob += avgForm * 3;
  }

  // H2H
  if (normalizedData.h2hOver15Freq > 0) prob = prob * 0.85 + normalizedData.h2hOver15Freq * 0.15;
  if (normalizedData.h2hMatches?.length) {
    const h2h = normalizedData.h2hMatches;
    const avgGoals = h2h.reduce((s, m) => s + m.totalGoals, 0) / h2h.length;
    const o15 = (h2h.filter(m => m.totalGoals > 1.5).length / h2h.length) * 100;
    const o25 = (h2h.filter(m => m.totalGoals > 2.5).length / h2h.length) * 100;
    let adj = 0;
    if (avgGoals > 2.5) adj += 2;
    else if (avgGoals < 1.5) adj -= 2;
    if (o15 >= 80) adj += 1.5;
    else if (o15 <= 20) adj -= 1.5;
    if (o25 >= 60) adj += 1;
    prob += adj;
  }

  if (normalizedData.homeXG && normalizedData.awayXG && normalizedData.homeXG > 0 && normalizedData.awayXG > 0) {
    const avgXG = (normalizedData.homeXG + normalizedData.awayXG) / 2;
    if (avgXG > 2.5) prob += 3;
    else if (avgXG < 1.5) prob -= 3;
  }

  if (estimatedOver15Freq === 50 && competitionAvg > 0) prob = competitionAvg;
  prob = smoothClamp(prob, 10, 98);

  // --- Lambdas base ---
  const baseLambdas = computeBaseLambdas(normalizedData);
  const { lambdaHome, lambdaAway } = baseLambdas;

  logger.log('[AnalysisEngine] Lambdas base:', { lambdaHome, lambdaAway });

  // Poisson base
  const pHome: number[] = [];
  const pAway: number[] = [];
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHome));
    pAway.push(poissonProbability(i, lambdaAway));
  }

  // EV inicial
  let ev = 0;
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    ev = ((prob / 100) * normalizedData.oddOver15 - 1) * 100;
  }

  // --- Métricas avançadas ---
  const advancedMetrics = computeAdvancedMetrics(avgTotal, baseLambdas.homeGoalsConceded, baseLambdas.awayGoalsConceded, avgCleanSheet, normalizedData);

  // --- Confiança ---
  const confidence = computeConfidenceScore({
    estimatedOver15Freq, competitionAvg, hasTeamStats, homeAvgTotal, awayAvgTotal,
    avgCleanSheet, avgNoGoals, tableCompleteness, hasHomeTeamStats, hasHomeTableData,
    hasAwayTeamStats, hasAwayTableData, normalizedData,
  });

  // --- Probabilidades das fontes ---
  const statsResult = calculateStatisticsProbability(normalizedData);
  const statsProb = statsResult?.probability ?? prob;
  const statsLambdaHome = statsResult?.lambdaHome;
  const statsLambdaAway = statsResult?.lambdaAway;
  const statsOverUnderProbabilities = statsResult?.overUnderProbabilities;

  const tableResult = calculateTableProbability(normalizedData);
  const tableProb = tableResult?.probability ?? null;
  const tableLambdaHome = tableResult?.lambdaHome;
  const tableLambdaAway = tableResult?.lambdaAway;
  const tableOverUnderProbabilities = tableResult?.overUnderProbabilities;

  // --- Pesos ---
  const { statsWeight, tableWeight } = combineStatisticsAndTable(statsProb, tableProb, normalizedData);

  const isPosFinite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const hasStatsSide = isPosFinite(statsLambdaHome) && isPosFinite(statsLambdaAway);
  const hasTableSide = isPosFinite(tableLambdaHome) && isPosFinite(tableLambdaAway);

  const minMp = hasHomeTableData && hasAwayTableData
    ? Math.min(parseFloat(normalizedData.homeTableData?.MP || '0') || 0, parseFloat(normalizedData.awayTableData?.MP || '0') || 0)
    : 0;

  // --- Lambda final combinado ---
  const { lambdaHomeFinal, lambdaAwayFinal, lambdaFinal, bttsProbability } = combineLambdas(
    statsLambdaHome, statsLambdaAway, tableLambdaHome, tableLambdaAway,
    lambdaHome, lambdaAway, statsWeight, tableWeight, competitionAvg,
    confidence, minMp, statsProb, tableProb, hasStatsSide, hasTableSide
  );

  // Poisson final
  pHome.length = 0;
  pAway.length = 0;
  for (let i = 0; i <= 5; i++) {
    pHome.push(poissonProbability(i, lambdaHomeFinal));
    pAway.push(poissonProbability(i, lambdaAwayFinal));
  }

  const overUnderProbabilities = calculateOverUnderProbabilities(lambdaFinal);
  const under15ProbDC = calculateDixonColesUnder15(lambdaHomeFinal, lambdaAwayFinal);
  const finalProb = (1 - under15ProbDC) * 100;

  if (overUnderProbabilities['1.5']) {
    overUnderProbabilities['1.5'].over = finalProb;
    overUnderProbabilities['1.5'].under = under15ProbDC * 100;
  }

  let finalEv = ev;
  if (normalizedData.oddOver15 && normalizedData.oddOver15 > 1) {
    finalEv = ((finalProb / 100) * normalizedData.oddOver15 - 1) * 100;
  }

  logger.log('[AnalysisEngine] Final:', { finalProb, confidence, finalEv, bttsProbability });

  return buildAnalysisResult({
    statsProb, tableProb, finalProb, bttsProbability, confidence,
    pHome, pAway, ev, finalEv, advancedMetrics,
    overUnderProbabilities, tableOverUnderProbabilities, statsOverUnderProbabilities,
  });
}
