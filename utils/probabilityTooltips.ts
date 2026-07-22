import { AnalysisResult, MatchData, SelectedBet, TableRowGeral } from '../types';
import { parseNumeric } from './numbers';
import { getEdgeConfidenceInterval } from './betMetrics';
import { calculateSelectedBetsProbability } from './betRange';

/**
 * Gera tooltip detalhado para Prob. Estatística
 */
export function getStatisticalProbabilityTooltip(
  result: AnalysisResult,
  data: MatchData
): string {
  const hasHomeStats = !!data.homeTeamStats;
  const hasAwayStats = !!data.awayTeamStats;

  if (!hasHomeStats || !hasAwayStats) {
    return 'Probabilidade estatística não disponível. Preencha as Estatísticas Globais (últimos 10 jogos) de ambos os times.';
  }

  const homeAvgScored = data.homeTeamStats.gols.home.avgScored || 0;
  const homeAvgConceded = data.homeTeamStats.gols.home.avgConceded || 0;
  const awayAvgScored = data.awayTeamStats.gols.away.avgScored || 0;
  const awayAvgConceded = data.awayTeamStats.gols.away.avgConceded || 0;
  const homeCleanSheet = data.homeTeamStats.gols.home.cleanSheetPct || 0;
  const awayCleanSheet = data.awayTeamStats.gols.away.cleanSheetPct || 0;
  const homeNoGoals = data.homeTeamStats.gols.home.noGoalsPct || 0;
  const awayNoGoals = data.awayTeamStats.gols.away.noGoalsPct || 0;
  const homeOver25 = data.homeTeamStats.gols.home.over25Pct || 0;
  const awayOver25 = data.awayTeamStats.gols.away.over25Pct || 0;

  return `Probabilidade baseada apenas nas Estatísticas Globais (últimos 10 jogos).

📊 Dados das Estatísticas considerados:
• Média de Gols Marcados (Casa/Fora) ✓
  - Time da Casa: ${homeAvgScored.toFixed(2)} gols/jogo
  - Time Visitante: ${awayAvgScored.toFixed(2)} gols/jogo
• Média de Gols Sofridos (Casa/Fora) ✓
  - Time da Casa: ${homeAvgConceded.toFixed(2)} gols/jogo
  - Time Visitante: ${awayAvgConceded.toFixed(2)} gols/jogo
• Clean Sheets: ${((homeCleanSheet + awayCleanSheet) / 2).toFixed(1)}% (média)
• Jogos sem Marcar: ${((homeNoGoals + awayNoGoals) / 2).toFixed(1)}% (média)
• Over 2.5%: ${((homeOver25 + awayOver25) / 2).toFixed(1)}% (média)
• Forma Recente (últimos 3 jogos do histórico)${data.homeHistory?.length && data.awayHistory?.length ? ' ✓' : ' ✗'}

🔢 Método: Distribuição Poisson avançada com ajustes baseados em:
• Lambda calculado usando médias específicas (casa/fora)
• Ajuste por clean sheets (defesas boas reduzem probabilidade)
• Ajuste por jogos sem marcar (ataques fracos reduzem probabilidade)
• Ajuste por Over 2.5% (confirma tendência ofensiva)
• Ajuste por forma recente (últimos 3 jogos vs média histórica)

💡 Esta probabilidade reflete a forma RECENTE dos times (últimos 10 jogos), enquanto a Prob. Tabela mostra a temporada completa.`;
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
  const hasStandardFor = !!(
    data.homeComplementData &&
    data.awayComplementData &&
    data.competitionStandardForAvg
  );
  const homeRk = data.homeTableData?.Rk ? parseFloat(data.homeTableData.Rk) : 0;
  const awayRk = data.awayTableData?.Rk ? parseFloat(data.awayTableData.Rk) : 0;

  return `Probabilidade baseada apenas nos dados da tabela do campeonato (temporada completa).

📊 Dados da Tabela considerados:
• Gols Feitos (GF) e Gols Acontecidos (GA)${hasTableData ? ' ✓' : ' ✗'}
• Expected Goals (xG) e Expected Goals Against (xGA)${data.homeTableData?.xG && data.awayTableData?.xG ? ' ✓' : ' ✗'}
• Posição na Tabela (Rk)${homeRk > 0 && awayRk > 0 ? ' ✓' : ' ✗'}
• Saldo de Gols (GD)${hasTableData ? ' ✓' : ' ✗'}
• Expected Goal Difference (xGD)${data.homeTableData?.xGD && data.awayTableData?.xGD ? ' ✓' : ' ✗'}
• Pontos por Jogo (Pts/MP)${hasTableData ? ' ✓' : ' ✗'}
• Força do Oponente (posição do adversário)${homeRk > 0 && awayRk > 0 ? ' ✓' : ' ✗'}
• Forma Recente (Last 5)${data.homeTableData?.['Last 5'] || data.awayTableData?.['Last 5'] ? ' ✓' : ' ✗'}
${hasStandardFor ? `\n📎 Complemento (Standard - For):\n• Qualidade ofensiva (npxG+xAG/90 ou xG+xAG/90) ✓\n• Ritmo/volume (Poss, PrgP, PrgC) ✓` : ''}

🔢 Método: Distribuição Poisson avançada com ajustes baseados em:
• Posição na tabela (times no topo são mais ofensivos)
• Saldo de gols (GD positivo indica ataque forte)
• xGD (Expected Goal Difference - qualidade ofensiva/defensiva)
• Pontos por jogo (forma na temporada)
• Força relativa dos oponentes
${hasStandardFor ? '\n• Ajustes adicionais por qualidade ofensiva e ritmo (standard_for), com impacto moderado e limites (clamp) para evitar extremos' : ''}

💡 A tabela oferece uma visão mais ampla (temporada completa) enquanto as estatísticas focam nos últimos 10 jogos.`;
}

/**
 * Gera tooltip detalhado para Prob. Final
 */
export function getFinalProbabilityTooltip(
  result: AnalysisResult,
  displayProbability: number,
  selectedBets: SelectedBet[],
  hasTable: boolean
): string {
  let selectionBlock = '';
  if (selectedBets.length > 0) {
    const selectionProb =
      calculateSelectedBetsProbability(selectedBets, result.overUnderProbabilities) ??
      calculateSelectedBetsProbability(selectedBets);

    if (selectedBets.length === 1) {
      const bet = selectedBets[0];
      selectionBlock = `Seleção ativa: ${bet.type === 'over' ? 'Over' : 'Under'} ${bet.line}
📌 Prob. Seleção: ${selectionProb != null ? selectionProb.toFixed(1) : bet.probability.toFixed(1)}%

⚠️ Observação: quando há seleção, EV/Edge/Risco seguem a seleção (não o Over 1.5).\n\n`;
    } else if (selectedBets.length === 2) {
      const bet1 = selectedBets[0];
      const bet2 = selectedBets[1];
      selectionBlock = `Seleção ativa: ${bet1.type === 'over' ? 'Over' : 'Under'} ${bet1.line} + ${bet2.type === 'over' ? 'Over' : 'Under'} ${bet2.line}
📌 Prob. Seleção (range): ${selectionProb != null ? selectionProb.toFixed(1) : '—'}%

⚠️ Observação: quando há seleção, EV/Edge/Risco seguem a seleção (não o Over 1.5).\n\n`;
    }
  }

  if (hasTable && result.tableProbability != null) {
    const statProb = result.probabilityOver15;
    const tableProb = result.tableProbability;
    const combined = result.combinedProbability || displayProbability;
    const divergence = Math.abs(statProb - tableProb);

    return `${selectionBlock}Prob. Final (Over 1.5) combinando Estatísticas (últimos 10 jogos) + Tabela (temporada completa).

📊 Prob. Estatística (Over 1.5): ${statProb.toFixed(1)}%
📋 Prob. Tabela (Over 1.5): ${tableProb.toFixed(1)}%
🎯 Prob. Final (Over 1.5): ${combined.toFixed(1)}%

${divergence > 20 ? `⚠️ Divergência alta entre fontes (${divergence.toFixed(1)}%). O sistema ajusta os pesos automaticamente.` : '✓ Valores consistentes entre fontes.'}

🔢 Over/Under Combinada: é calculada a partir do λ (gols esperados) combinado das fontes e recalculada via Poisson para manter consistência entre todas as linhas (0.5–5.5).`;
  }

  return `${selectionBlock}Prob. Final (Over 1.5) baseada apenas em estatísticas (dados da tabela não disponíveis).

📊 Prob. Estatística (Over 1.5): ${result.probabilityOver15.toFixed(1)}%

🔢 Over/Under: é derivada do λ (gols esperados) estimado pelas estatísticas e recalculada via Poisson para manter consistência entre linhas.

💡 Sincronize os dados da tabela do campeonato para obter uma probabilidade mais precisa combinando estatísticas recentes com dados da temporada completa.`;
}

/**
 * Gera tooltip detalhado para Edge (pp)
 */
export function getEdgeTooltip(
  edgePp: number | null,
  displayProbability: number,
  odd: number | undefined,
  confidenceScore?: number,
  probabilityLabel: string = 'Probabilidade'
): string {
  if (edgePp == null || !odd) {
    return 'Edge não disponível. Adicione uma odd para calcular o edge (vantagem) da aposta.';
  }

  const impliedProb = (1 / odd) * 100;
  const houseMargin = 0.06; // 6% margem típica
  const fairImplied = impliedProb * (1 - houseMargin); // Probabilidade justa (sem margem)
  const edgeLabel = edgePp >= 5 ? 'Excelente' : edgePp >= 2 ? 'Boa' : edgePp >= 0 ? 'Positiva' : 'Negativa';

  let confidenceIntervalText = '';
  if (confidenceScore != null) {
    const interval = getEdgeConfidenceInterval(displayProbability, confidenceScore, odd, houseMargin);
    if (interval) {
      const range = (interval.edgeMax - interval.edgeMin).toFixed(1);
      confidenceIntervalText = `\n📊 Intervalo de Confiança: ${interval.edgeMin >= 0 ? '+' : ''}${interval.edgeMin.toFixed(1)}pp a ${interval.edgeMax >= 0 ? '+' : ''}${interval.edgeMax.toFixed(1)}pp (±${range}pp)`;
    }
  }

  return `Edge (Vantagem) = ${probabilityLabel} - Prob. Implícita Justa

📊 ${probabilityLabel}: ${displayProbability.toFixed(1)}%
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
function tableHasXg(td: TableRowGeral | null | undefined): boolean {
  if (!td) return false;
  return !!(td['Home xG'] || td['Home xGA'] || td.xG || td.xGA);
}

function parseMp(td: TableRowGeral | null | undefined): number {
  if (!td) return 0;
  return parseNumeric(td['Home MP'] || td['Away MP'] || td.MP || '0');
}

export function calculateDataQuality(data: MatchData): number {
  const {
    homeTableData, awayTableData,
    homeTeamStats, awayTeamStats,
    homeComplementData, awayComplementData, competitionComplementAvg,
    competitionAvg,
    homeXG, awayXG,
    h2hMatches,
  } = data;

  let score = 0;

  // ── Core (50 pts) ──
  // Tabela Geral (30)
  if (homeTableData) score += 15;
  if (awayTableData) score += 15;

  // TeamStats (20)
  if (homeTeamStats) score += 10;
  if (awayTeamStats) score += 10;

  // ── Qualidade (30 pts) ──
  // Formato completa — tabela com xG (5)
  if (tableHasXg(homeTableData) && tableHasXg(awayTableData)) score += 5;

  // CompetitionAvg > 0 (10)
  if (competitionAvg && competitionAvg > 0) score += 10;

  // Complemento (10)
  if (homeComplementData) score += 4;
  if (awayComplementData) score += 4;
  if (competitionComplementAvg) score += 2;

  // MP confiável — ambos os times com 5+ jogos (5)
  if (parseMp(homeTableData) >= 5 && parseMp(awayTableData) >= 5) score += 5;

  // ── Extras (20 pts) ──
  // Last 5 (10)
  if (homeTableData?.['Last 5']) score += 5;
  if (awayTableData?.['Last 5']) score += 5;

  // H2H (5)
  if (h2hMatches && h2hMatches.length > 0) {
    score += Math.min(5, (h2hMatches.length / 5) * 5);
  }

  // xG values > 0 (5)
  if (homeXG > 0) score += 2.5;
  if (awayXG > 0) score += 2.5;

  return Math.min(100, score);
}

/**
 * Tooltip para probabilidade de Over (por linha) usando a fonte combinada.
 */
export function getMarketOverTooltip(line: string): string {
  return `Over ${line}: probabilidade de o total de gols ser maior que ${line}.

🔢 Método: Poisson (λ combinado)
• O λ (gols esperados) é estimado combinando Estatísticas (últimos 10 jogos) + Tabela (temporada), quando disponíveis.
• Calibração: aplica shrinkage para a média do campeonato (e ajustes por confiabilidade/divergência) para reduzir probabilidades extremas sem base.
• A tabela Over/Under é recalculada via Poisson para manter consistência entre linhas (0.5–5.5).`;
}

/**
 * Tooltip para probabilidade de Under (por linha) usando a fonte combinada.
 */
export function getMarketUnderTooltip(line: string): string {
  return `Under ${line}: probabilidade de o total de gols ser menor ou igual a ${Math.floor(Number(line))}.

🔢 Método: Poisson (λ combinado)
• O λ (gols esperados) é estimado combinando Estatísticas (últimos 10 jogos) + Tabela (temporada), quando disponíveis.
• Calibração: aplica shrinkage para a média do campeonato (e ajustes por confiabilidade/divergência) para reduzir probabilidades extremas sem base.
• A tabela Over/Under é recalculada via Poisson para manter consistência entre linhas (0.5–5.5).`;
}

/**
 * Tooltip para o card "Ambas" (BTTS + Range).
 */
export function getBothGoalsTooltip(options?: { selectionLabel?: string; hasRange?: boolean }): string {
  const hasRange = options?.hasRange === true;
  const selectionLabel = options?.selectionLabel;

  return `BTTS (Ambas marcam): probabilidade de os dois times marcarem pelo menos 1 gol.

🔢 Cálculo (Poisson):
BTTS = (1 - e^{-λ_casa}) × (1 - e^{-λ_fora})

📌 Calibração:
O λ final é calibrado com shrinkage para a média do campeonato e ajustes por confiabilidade/divergência entre fontes, reduzindo “overconfidence”.

Range (Over + Under): probabilidade de o total de gols ficar dentro de um intervalo.

✅ Fórmula correta (não é produto):
P(range) = Under(linha_superior) - Under(linha_inferior)
${hasRange && selectionLabel ? `\n📌 Seleção atual: ${selectionLabel}` : ''}
${!hasRange ? '\n💡 Para ver o Range, selecione 1 Over + 1 Under na aba Combinada.' : ''}`;
}

