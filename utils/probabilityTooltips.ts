import { AnalysisResult, MatchData } from '../types';
import { getEdgeConfidenceInterval } from './betMetrics';

/**
 * Gera tooltip detalhado para Prob. Estatística
 */
export function getStatisticalProbabilityTooltip(
  result: AnalysisResult,
  data: MatchData
): string {
  const hasHomeStats = !!data.homeTeamStats;
  const hasAwayStats = !!data.awayTeamStats;
  const hasHomeTable = !!data.homeTableData;
  const hasAwayTable = !!data.awayTableData;
  const hasCompetitionAvg = !!(data.competitionAvg && data.competitionAvg > 0);

  const dataSources: string[] = [];
  if (hasHomeStats && hasAwayStats) {
    dataSources.push('Estatísticas Globais (últimos 10 jogos casa/fora)');
  } else if (hasHomeTable || hasAwayTable) {
    dataSources.push('Dados da Tabela (GF/MP, GA/MP)');
  }

  if (hasCompetitionAvg) {
    dataSources.push('Média da Competição');
  }

  if (data.homeTableData?.['Last 5'] || data.awayTableData?.['Last 5']) {
    dataSources.push('Forma Recente (Last 5)');
  }

  if (data.h2hMatches && data.h2hMatches.length > 0) {
    dataSources.push(`Confrontos Diretos (${data.h2hMatches.length} jogos)`);
  }

  const dataQuality = calculateDataQuality(data);
  const qualityLabel = dataQuality >= 80 ? 'Alta' : dataQuality >= 60 ? 'Média' : 'Baixa';

  return `Probabilidade baseada em estatísticas históricas usando distribuição Poisson.

📊 Fontes de Dados:
${dataSources.length > 0 ? dataSources.map(s => `• ${s}`).join('\n') : '• Dados limitados disponíveis'}

📈 Qualidade dos Dados: ${qualityLabel} (${dataQuality.toFixed(0)}%)

🔢 Método: Distribuição Poisson com ajustes baseados em:
• Médias de gols marcados/sofridos
• Frequências de clean sheets e jogos sem gols
• Forma recente dos times
• Confrontos diretos (quando disponível)

${!hasHomeStats || !hasAwayStats ? '⚠️ Usando dados da tabela como fallback (menos preciso que Estatísticas Globais)' : ''}`;
}

/**
 * Gera tooltip detalhado para Prob. Tabela
 */
export function getTableProbabilityTooltip(
  result: AnalysisResult,
  data: MatchData
): string {
  if (result.tableProbability == null) {
    return 'Probabilidade da tabela não disponível. Sincronize os dados da tabela do campeonato.';
  }

  const hasTableData = !!(data.homeTableData && data.awayTableData);

  return `Probabilidade baseada apenas nos dados da tabela do campeonato (temporada completa).

📊 Dados da Tabela considerados:
• Gols Feitos (GF) e Gols Acontecidos (GA)${hasTableData ? ' ✓' : ' ✗'}
• Expected Goals (xG) e Expected Goals Against (xGA)${data.homeTableData?.xG && data.awayTableData?.xG ? ' ✓' : ' ✗'}
• Forma Recente (Last 5)${data.homeTableData?.['Last 5'] || data.awayTableData?.['Last 5'] ? ' ✓' : ' ✗'}

🔢 Método: Distribuição Poisson usando médias de gols da temporada completa.

💡 A tabela oferece uma visão mais ampla (temporada completa) enquanto as estatísticas focam nos últimos 10 jogos.`;
}

/**
 * Gera tooltip detalhado para Prob. Final
 */
export function getFinalProbabilityTooltip(
  result: AnalysisResult,
  displayProbability: number,
  selectedBets: Array<{ line: string; type: 'over' | 'under'; probability: number }>,
  hasTable: boolean
): string {
  if (selectedBets.length > 0) {
    if (selectedBets.length === 1) {
      const bet = selectedBets[0];
      return `Probabilidade da aposta selecionada: ${bet.type === 'over' ? 'Over' : 'Under'} ${bet.line}

📊 Probabilidade: ${bet.probability.toFixed(1)}%

Esta é a probabilidade usada para cálculos de EV e recomendações.`;
    } else {
      const bet1 = selectedBets[0];
      const bet2 = selectedBets[1];
      const combined = (bet1.probability / 100) * (bet2.probability / 100) * 100;
      return `Probabilidade combinada das apostas selecionadas:

📊 Aposta 1: ${bet1.type === 'over' ? 'Over' : 'Under'} ${bet1.line} (${bet1.probability.toFixed(1)}%)
📊 Aposta 2: ${bet2.type === 'over' ? 'Over' : 'Under'} ${bet2.line} (${bet2.probability.toFixed(1)}%)

🔢 Probabilidade Combinada: ${combined.toFixed(1)}%
   = ${(bet1.probability / 100).toFixed(3)} × ${(bet2.probability / 100).toFixed(3)} × 100

Esta é a probabilidade usada para cálculos de EV e recomendações.`;
    }
  }

  if (hasTable && result.tableProbability != null) {
    const statProb = result.probabilityOver15;
    const tableProb = result.tableProbability;
    const combined = result.combinedProbability || displayProbability;
    const divergence = Math.abs(statProb - tableProb);
    
    // Pesos padrão: 70% estatísticas, 30% tabela (ajustados dinamicamente)
    const statsWeight = 0.7;
    const tableWeight = 0.3;

    return `Probabilidade final combinando Estatísticas (últimos 10 jogos) + Tabela (temporada completa).

📊 Prob. Estatística: ${statProb.toFixed(1)}% (peso: ${(statsWeight * 100).toFixed(0)}%)
📋 Prob. Tabela: ${tableProb.toFixed(1)}% (peso: ${(tableWeight * 100).toFixed(0)}%)
🎯 Prob. Final: ${combined.toFixed(1)}%

${divergence > 20 ? `⚠️ Divergência alta entre fontes (${divergence.toFixed(1)}%). O sistema ajusta os pesos automaticamente.` : '✓ Valores consistentes entre fontes.'}

Esta probabilidade é usada para cálculos de EV e recomendações.`;
  }

  return `Probabilidade final baseada apenas em estatísticas (dados da tabela não disponíveis).

📊 Prob. Estatística: ${result.probabilityOver15.toFixed(1)}%

💡 Sincronize os dados da tabela do campeonato para obter uma probabilidade mais precisa combinando estatísticas recentes com dados da temporada completa.`;
}

/**
 * Gera tooltip detalhado para Edge (pp)
 */
export function getEdgeTooltip(
  edgePp: number | null,
  displayProbability: number,
  odd: number | undefined,
  confidenceScore?: number
): string {
  if (edgePp == null || !odd) {
    return 'Edge não disponível. Adicione uma odd para calcular o edge (vantagem) da aposta.';
  }

  const impliedProb = (1 / odd) * 100;
  const houseMargin = 0.06; // 6% margem típica
  const fairImplied = impliedProb / (1 - houseMargin);
  const edgeLabel = edgePp >= 5 ? 'Excelente' : edgePp >= 2 ? 'Boa' : edgePp >= 0 ? 'Positiva' : 'Negativa';

  let confidenceIntervalText = '';
  if (confidenceScore != null) {
    const interval = getEdgeConfidenceInterval(displayProbability, confidenceScore, odd, houseMargin);
    if (interval) {
      const range = (interval.edgeMax - interval.edgeMin).toFixed(1);
      confidenceIntervalText = `\n📊 Intervalo de Confiança: ${interval.edgeMin >= 0 ? '+' : ''}${interval.edgeMin.toFixed(1)}pp a ${interval.edgeMax >= 0 ? '+' : ''}${interval.edgeMax.toFixed(1)}pp (±${range}pp)`;
    }
  }

  return `Edge (Vantagem) = Prob. Final - Prob. Implícita Justa

📊 Prob. Final: ${displayProbability.toFixed(1)}%
📊 Prob. Implícita (com margem): ${impliedProb.toFixed(1)}% (1 / ${odd.toFixed(2)})
📊 Prob. Implícita Justa: ${fairImplied.toFixed(1)}% (ajustada para margem de ${(houseMargin * 100).toFixed(0)}%)
📈 Edge: ${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(1)}pp${confidenceIntervalText}

${edgePp >= 0 
  ? `✅ ${edgeLabel} - Sua análise vê mais chance que a casa de apostas. Aposta com valor positivo.`
  : `❌ ${edgeLabel} - A casa de apostas vê mais chance que sua análise. Odd desfavorável.`
}

💡 Edge positivo indica que a odd oferecida é melhor que o valor justo baseado na sua análise. O cálculo considera a margem típica da casa (${(houseMargin * 100).toFixed(0)}%).`;
}

/**
 * Calcula qualidade/completude dos dados (0-100)
 */
export function calculateDataQuality(data: MatchData): number {
  let score = 0;
  let maxScore = 0;

  // Estatísticas Globais (peso alto)
  maxScore += 30;
  if (data.homeTeamStats) score += 15;
  if (data.awayTeamStats) score += 15;

  // Dados da Tabela (peso médio)
  maxScore += 20;
  if (data.homeTableData) score += 10;
  if (data.awayTableData) score += 10;

  // Média da Competição (peso médio)
  maxScore += 15;
  if (data.competitionAvg && data.competitionAvg > 0) score += 15;

  // Forma Recente (peso baixo)
  maxScore += 10;
  if (data.homeTableData?.['Last 5']) score += 5;
  if (data.awayTableData?.['Last 5']) score += 5;

  // Confrontos Diretos (peso médio)
  maxScore += 15;
  if (data.h2hMatches && data.h2hMatches.length > 0) {
    score += Math.min(15, (data.h2hMatches.length / 5) * 15); // Mais jogos = mais score
  }

  // xG (peso baixo, bonus)
  maxScore += 10;
  if (data.homeXG > 0) score += 5;
  if (data.awayXG > 0) score += 5;

  return Math.min(100, (score / maxScore) * 100);
}

