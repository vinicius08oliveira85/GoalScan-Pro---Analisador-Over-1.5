import { ExternalSignals, MatchData } from '../types';
import { performAnalysis } from './analysisEngine';
import { generateGeminiContent, getGeminiSettings, toGeminiFriendlyError } from './geminiClient';
import { syncMatchScore, MatchScore } from './googleMatchSync';
import { getExternalSignals } from './externalSignalsService';

/**
 * TIPAGEM E CONFIGURAÇÕES
 */
type AiOver15Result = {
  reportMarkdown: string;
  provider: 'gemini' | 'local';
  notice?: {
    kind: 'info' | 'warning' | 'error';
    title: string;
    message: string;
  };
  externalSignals?: ExternalSignals;
};

/**
 * PARSERS E UTILS
 */

function safeNumber(n: unknown): number | null {
  return (typeof n === 'number' && Number.isFinite(n)) ? n : null;
}

/**
 * Helper unificado para extração de métricas (Probabilidade/Confiança)
 * Suporta variações de Markdown, negritos, espaços e separadores decimais.
 */
function extractMetric(markdown: string, label: string): number | null {
  if (!markdown) return null;
  
  // Captura rótulos como "**Probabilidade (IA)**:", "Probabilidade IA -", etc.
  const regex = new RegExp(
    `(?:\\*\\*|\\*|__|_)?${label}(?:\\s|\\(IA\\))?(?:\\*\\*|\\*|__|_)?\\s*[:\\-]?\\s*([\\d,]+\\.?\\d*)\\s*%`,
    'i'
  );

  const match = markdown.match(regex);
  if (match?.[1]) {
    const value = parseFloat(match[1].replace(',', '.'));
    return (!isNaN(value) && value >= 0 && value <= 100) ? value : null;
  }

  // Fallback: busca por estrutura similar a JSON no texto
  const jsonRegex = new RegExp(`"${label.toLowerCase()}"\\s*:\\s*([\\d.]+)`, 'i');
  const jsonMatch = markdown.match(jsonRegex);
  return jsonMatch ? parseFloat(jsonMatch[1]) : null;
}

export const extractProbabilityFromMarkdown = (md: string) => extractMetric(md, 'Probabilidade');
export const extractConfidenceFromMarkdown = (md: string) => extractMetric(md, 'Confiança');

/**
 * Extrai probabilidades Over/Under para diferentes linhas do markdown retornado pela IA
 */
export function parseOverUnderProbabilities(markdown: string): {
  [line: string]: { over: number; under: number };
} {
  const probabilities: { [line: string]: { over: number; under: number } } = {};
  const lines = ['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'];

  // Tentar extrair do JSON primeiro
  const jsonMatch = markdown.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.overUnderProbabilities) {
        return jsonData.overUnderProbabilities;
      }
    } catch (e) {
      // Continuar com parsing de texto
    }
  }

  // Extrair de formato de texto
  for (const line of lines) {
    // Procurar por padrões como "Over 1.5: 75%", "Under 1.5: 25%"
    const overRegex = new RegExp(
      `(?:Over|Mais)\\s*${line.replace('.', '\\.')}\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*%`,
      'i'
    );
    const underRegex = new RegExp(
      `(?:Under|Menos)\\s*${line.replace('.', '\\.')}\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*%`,
      'i'
    );

    const overMatch = markdown.match(overRegex);
    const underMatch = markdown.match(underRegex);

    const over = overMatch ? parseFloat(overMatch[1]) : null;
    const under = underMatch ? parseFloat(underMatch[1]) : null;

    if (over !== null || under !== null) {
      probabilities[line] = {
        over: over !== null ? Math.min(Math.max(over, 0), 100) : 0,
        under: under !== null ? Math.min(Math.max(under, 0), 100) : 0,
      };
    }
  }

  return probabilities;
}

/**
 * Extrai combinações recomendadas (Over E Under >= 75%) do markdown retornado pela IA
 */
export function parseRecommendedCombinations(markdown: string): Array<{
  overLine: number;
  underLine: number;
  overProb: number;
  underProb: number;
  combinedProb: number;
}> {
  const combinations: Array<{
    overLine: number;
    underLine: number;
    overProb: number;
    underProb: number;
    combinedProb: number;
  }> = [];

  // Tentar extrair do JSON primeiro
  const jsonMatch = markdown.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.recommendedCombinations && Array.isArray(jsonData.recommendedCombinations)) {
        return jsonData.recommendedCombinations.filter(
          (c: { overProb: number; underProb: number }) => c.overProb >= 75 && c.underProb >= 75
        );
      }
    } catch (e) {
      // Continuar com parsing de texto
    }
  }

  // Extrair de formato de texto
  // Procurar por padrões como "Over 1.5 (75%) E Under 3.5 (80%) = 60% combinado"
  const combinationRegex = /(?:Over|Mais)\s*(\d+\.?\d*)\s*\((\d+(?:\.\d+)?)%\)\s*(?:E|AND)\s*(?:Under|Menos)\s*(\d+\.?\d*)\s*\((\d+(?:\.\d+)?)%\)\s*(?:=|combinado|combined)\s*(\d+(?:\.\d+)?)%/gi;
  
  let match;
  while ((match = combinationRegex.exec(markdown)) !== null) {
    const overLine = parseFloat(match[1]);
    const overProb = parseFloat(match[2]);
    const underLine = parseFloat(match[3]);
    const underProb = parseFloat(match[4]);
    const combinedProb = parseFloat(match[5]);

    if (overProb >= 75 && underProb >= 75) {
      combinations.push({
        overLine,
        underLine,
        overProb: Math.min(Math.max(overProb, 0), 100),
        underProb: Math.min(Math.max(underProb, 0), 100),
        combinedProb: Math.min(Math.max(combinedProb, 0), 100),
      });
    }
  }

  return combinations;
}

/**
 * CONSTRUÇÃO DE CONTEXTO E PROMPT
 */

async function buildContext(
  data: MatchData,
  liveScore?: MatchScore,
  options?: { useExternalSignals?: boolean }
) {
  const result = performAnalysis(data);
  const home = data.homeTeamStats?.gols?.home;
  const away = data.awayTeamStats?.gols?.away;

  const externalSignals = await getExternalSignals({
    enabled: Boolean(options?.useExternalSignals),
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    matchDate: data.matchDate,
    matchTime: data.matchTime,
  });

  // Validação: Verificar que todos os dados necessários estão presentes
  const hasHomeStats = !!home;
  const hasAwayStats = !!away;
  const hasHomeTableData = !!data.homeTableData;
  const hasAwayTableData = !!data.awayTableData;
  const hasCompetitionAvg = !!(data.competitionAvg && data.competitionAvg > 0);
  const hasStandardFor = !!data.homeStandardForData && !!data.awayStandardForData;
  const hasPassingFor = !!data.homePassingForData && !!data.awayPassingForData;
  const hasGcaFor = !!data.homeGcaForData && !!data.awayGcaForData;

  if (import.meta.env.DEV) {
    console.log('[AIOver15Service] Construindo contexto para IA:', {
      hasHomeStats,
      hasAwayStats,
      hasHomeTableData,
      hasAwayTableData,
      hasCompetitionAvg,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
    });

    // Avisar se dados importantes estão faltando
    const missingForAI: string[] = [];
    if (!hasHomeStats) missingForAI.push('Estatísticas Globais do time da casa');
    if (!hasAwayStats) missingForAI.push('Estatísticas Globais do time visitante');
    if (!hasHomeTableData) missingForAI.push('Dados da tabela do time da casa');
    if (!hasAwayTableData) missingForAI.push('Dados da tabela do time visitante');
    if (!hasCompetitionAvg) missingForAI.push('Média da competição');
    if (!hasStandardFor) missingForAI.push('Tabela complementar standard_for (casa/fora)');
    if (!hasPassingFor) missingForAI.push('Tabela complementar passing_for (casa/fora)');
    if (!hasGcaFor) missingForAI.push('Tabela complementar gca_for (casa/fora)');

    if (missingForAI.length > 0) {
      console.warn('[AIOver15Service] Dados faltando para análise da IA:', missingForAI);
      console.warn('[AIOver15Service] A análise da IA pode ser menos precisa sem esses dados.');
    } else {
      console.log('[AIOver15Service] Todos os dados necessários estão presentes para análise completa.');
    }
  }

  return {
    match: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      matchDate: data.matchDate ?? null,
      liveData: liveScore ? {
        homeScore: liveScore.homeScore,
        awayScore: liveScore.awayScore,
        minute: liveScore.minute,
        status: liveScore.status,
      } : null,
    },
    market: {
      oddOver15: safeNumber(data.oddOver15),
      competitionAvg: safeNumber(data.competitionAvg),
    },
    // Estatísticas Globais (inseridas manualmente pelo usuário - 10 últimos jogos Casa/Fora)
    stats: {
      home: { 
        avgScored: home?.avgScored, 
        avgConceded: home?.avgConceded,
        avgTotal: home?.avgTotal,
        cleanSheetPct: home?.cleanSheetPct,
        noGoalsPct: home?.noGoalsPct,
        over25Pct: home?.over25Pct,
        under25Pct: home?.under25Pct,
      },
      away: { 
        avgScored: away?.avgScored, 
        avgConceded: away?.avgConceded,
        avgTotal: away?.avgTotal,
        cleanSheetPct: away?.cleanSheetPct,
        noGoalsPct: away?.noGoalsPct,
        over25Pct: away?.over25Pct,
        under25Pct: away?.under25Pct,
      },
    },
    // Dados completos da tabela do campeonato (TODOS os campos: Rk, Squad, MP, W, D, L, GF, GA, GD, Pts, xG, xGA, etc.)
    championshipTables: {
      geral: {
        home: data.homeTableData || null,
        away: data.awayTableData || null,
      },
      standard_for: {
        home: data.homeStandardForData || null,
        away: data.awayStandardForData || null,
        competitionAvg: data.competitionStandardForAvg || null,
      },
      passing_for: {
        home: data.homePassingForData || null,
        away: data.awayPassingForData || null,
        competitionAvg: data.competitionPassingForAvg || null,
      },
      gca_for: {
        home: data.homeGcaForData || null,
        away: data.awayGcaForData || null,
        competitionAvg: data.competitionGcaForAvg || null,
      },
    },
    baseline: {
      prob: safeNumber(result.probabilityOver15),
      ev: safeNumber(result.ev),
      risk: result.riskLevel,
    },
    externalSignals,
  };
}

async function buildPrompt(
  data: MatchData,
  liveScore?: MatchScore,
  options?: { useExternalSignals?: boolean }
): Promise<string> {
  const ctx = await buildContext(data, liveScore, options);
  
  return [
    '# PERSONA: Analista Quantitativo de Apostas (Over/Under Gols)',
    '# OBJETIVO: Gerar relatório técnico completo com probabilidades Over/Under para múltiplas linhas.',
    '',
    '## REGRAS CRÍTICAS:',
    '1. Use APENAS o JSON abaixo. Proibido inventar dados ou usar conhecimento externo.',
    '2. O formato da primeira seção DEVE ser exatamente:',
    '   - **Probabilidade (IA)**: XX%',
    '   - **Confiança (IA)**: XX%',
    '3. Se houver liveData (minute > 0), priorize o cenário atual da partida sobre o histórico.',
    '4. Calcule probabilidades Over/Under para as seguintes linhas: 0.5, 1.5, 2.5, 3.5, 4.5, 5.5',
    '5. Identifique combinações de apostas (Over X.5 E Under Y.5) onde ambas probabilidades >= 75%',
    '',
    '## ESTRUTURA DO RELATÓRIO:',
    '## Painel de Resultados e EV',
    '## Probabilidades Over/Under por Linha',
    '## Combinações Recomendadas (Over E Under >= 75%)',
    '## Análise Quantitativa',
    '## Sinais a Favor',
    '## Red Flags',
    '## Plano de Entrada',
    '',
    '## FORMATO ESPERADO DAS PROBABILIDADES:',
    '```json',
    '{',
    '  "overUnderProbabilities": {',
    '    "0.5": { "over": 95, "under": 5 },',
    '    "1.5": { "over": 75, "under": 25 },',
    '    "2.5": { "over": 60, "under": 40 },',
    '    "3.5": { "over": 40, "under": 60 },',
    '    "4.5": { "over": 20, "under": 80 },',
    '    "5.5": { "over": 10, "under": 90 }',
    '  },',
    '  "recommendedCombinations": [',
    '    {',
    '      "overLine": 1.5,',
    '      "underLine": 3.5,',
    '      "overProb": 75,',
    '      "underProb": 80,',
    '      "combinedProb": 60',
    '    }',
    '  ]',
    '}',
    '```',
    '',
    '## DADOS PARA ANÁLISE (JSON):',
    JSON.stringify(ctx, null, 2),
    '',
    '## NOTAS IMPORTANTES:',
    '',
    '### SOBRE OS DADOS (OBRIGATÓRIO ANALISAR TODAS AS 4 TABELAS):',
    '',
    '⚠️ REGRA CRÍTICA: Você DEVE analisar TODAS as 4 tabelas disponíveis em "championshipTables".',
    'Se alguma tabela estiver como "null", ainda assim mencione isso no relatório e explique o impacto.',
    '',
    '1. "stats" - Estatísticas Globais inseridas manualmente (últimos 10 jogos Casa/Fora)',
    '   - Use como fonte PRINCIPAL para análise de tendências recentes',
    '',
    '2. "championshipTables.geral" - Tabela de classificação (OBRIGATÓRIA)',
    '   - Rk: Classificação na tabela (times no topo tendem a ser mais ofensivos)',
    '   - MP: Partidas Jogadas (verificar se é amostra suficiente)',
    '   - GF/MP e GA/MP: médias de gols marcados/sofridos (comparar com stats)',
    '   - xG/xGA: Expected Goals (mais preciso que gols reais, use para ajustes finos)',
    '   - "Last 5": Forma recente (W/D/L)',
    '   - GD: Saldo de gols',
    '   - Pts/MP: Pontos por partida (indica força do time)',
    '',
    '3. "championshipTables.standard_for" - Métricas de qualidade/ritmo (OBRIGATÓRIA se disponível)',
    '   - npxG+xAG/90: Qualidade ofensiva esperada (sem pênaltis)',
    '   - Poss: Posse de bola (times com mais posse tendem a criar mais chances)',
    '   - PrgP/PrgC: Passes progressivos/carregadas (ritmo do jogo)',
    '   - Playing Time MP: Partidas jogadas para normalização',
    '   - competitionAvg: Médias do campeonato para comparação',
    '',
    '4. "championshipTables.passing_for" - Criação via passe (OBRIGATÓRIA se disponível)',
    '   - Prog/90: Passes progressivos por 90 minutos',
    '   - KP/90: Key Passes (passes chave) por 90 minutos',
    '   - PPA/90: Passes para área por 90 minutos',
    '   - competitionAvg: Médias do campeonato para comparação',
    '   - Use para avaliar capacidade de criação de chances via construção de jogo',
    '',
    '5. "championshipTables.gca_for" - Ações de criação de chute/gol (OBRIGATÓRIA se disponível)',
    '   - SCA/90: Shot-Creating Actions por 90 minutos',
    '   - GCA/90: Goal-Creating Actions por 90 minutos',
    '   - competitionAvg: Médias do campeonato para comparação',
    '   - Use para avaliar capacidade de gerar finalizações e gols',
    '',
    '⚠️ IMPORTANTE: Se alguma tabela estiver como "null", você DEVE:',
    '   - Mencionar explicitamente no relatório qual tabela está faltando',
    '   - Explicar o impacto da ausência dessa tabela na análise',
    '   - Ainda assim usar as outras tabelas disponíveis para análise',
    '',
    '### COMO COMBINAR OS DADOS (TODAS AS 4 TABELAS DEVEM SER ANALISADAS):',
    '',
    '⚠️ REGRA: Você DEVE analisar e mencionar TODAS as 4 tabelas no seu relatório.',
    '',
    '1. Use Estatísticas Globais (stats) como base principal - são dos últimos 10 jogos específicos (Casa/Fora)',
    '',
    '2. Use dados da tabela "geral" para contexto e validação:',
    '   - Verificar consistência: GF/MP deve ser similar a stats.avgScored',
    '   - Usar xG/xGA para ajustes finos (mais preciso que gols reais)',
    '   - Considerar classificação (Rk) e forma recente (Last 5)',
    '   - Analisar saldo de gols (GD) para entender força ofensiva/defensiva',
    '',
    '3. Use dados da tabela "standard_for" para avaliar qualidade/ritmo:',
    '   - Comparar npxG+xAG/90 de cada time com a média do campeonato',
    '   - Analisar posse de bola (Poss) - times com mais posse criam mais chances',
    '   - Avaliar ritmo via PrgP/PrgC (passes progressivos)',
    '   - Times com ritmo alto + qualidade ofensiva alta = maior probabilidade de gols',
    '',
    '4. Use dados da tabela "passing_for" para avaliar criação via passe:',
    '   - Comparar Prog/KP/PPA por 90 de cada time com a média do campeonato',
    '   - Times com alta criação via passe = mais chances de gol',
    '   - Combinar com dados de standard_for para análise completa',
    '',
    '5. Use dados da tabela "gca_for" para avaliar ações de criação:',
    '   - Comparar SCA/GCA por 90 de cada time com a média do campeonato',
    '   - Times com alta SCA/GCA = mais finalizações e gols',
    '   - Combinar com passing_for para entender como as chances são criadas',
    '',
    '6. Se houver divergência entre stats e tabelas, priorize stats (são mais específicos)',
    '',
    '7. Use competitionAvg de cada tabela como baseline da competição para comparação',
    '',
    '8. MENCIONE EXPLICITAMENTE no relatório:',
    '   - Quais tabelas foram analisadas',
    '   - Quais tabelas estão faltando (se houver)',
    '   - Como cada tabela influenciou sua análise',
    '   - Impacto da ausência de tabelas (se houver)',
    '',
    '### SINAIS EXTERNOS (quando enabled=true):',
    '- externalSignals.lineups: pode conter escalações/formation/venue (não inventar jogadores).',
    '- externalSignals.weather: contém snapshot de clima + suggestedProbabilityDeltaPp (ajuste conservador).',
    '- Use sinais externos principalmente para: (a) ajustar confiança, (b) aplicar ajuste fino explicado.',
    '',
    '### ANÁLISE DE FATORES DE RISCO:',
    '- Times com alta classificação (Rk baixo) + boa forma (Last 5 com muitos W) = maior probabilidade de gols',
    '- Times com xG alto mas GF baixo = podem estar com azar, probabilidade pode aumentar',
    '- Times com xGA baixo mas GA alto = defesa pode estar em crise, probabilidade de gols contra aumenta',
    '- Saldo de gols (GD) muito positivo = time ofensivo, maior chance de Over',
    '- Forma recente (Last 5) com muitas derrotas = pode indicar problemas ofensivos ou defensivos',
    '',
    '### CÁLCULO DE PROBABILIDADES:',
    '- Use distribuição Poisson ou modelos similares baseados em médias de gols',
    '- Considere fatores contextuais (classificação, forma, xG) para ajustes',
    '- Probabilidades devem somar 100% para cada linha (Over + Under = 100%)',
    '- Identifique combinações onde Over X.5 E Under Y.5 têm ambas >= 75% de probabilidade'
  ].join('\n');
}

/**
 * FALLBACK LOCAL (Lógica Estatística de Segurança)
 */

async function localFallbackReport(
  data: MatchData,
  liveScore?: MatchScore,
  notice?: AiOver15Result['notice'],
  options?: { useExternalSignals?: boolean }
): Promise<AiOver15Result> {
  const ctx = await buildContext(data, liveScore, options);
  const baseProb = ctx.baseline.prob ?? 0;
  
  // Ajuste de probabilidade em tempo real para o fallback
  let adjustedProb = baseProb;
  if (liveScore && liveScore.status === 'live') {
    const goals = (liveScore.homeScore ?? 0) + (liveScore.awayScore ?? 0);
    const min = liveScore.minute ?? 0;
    
    if (goals >= 2) adjustedProb = 100;
    else if (goals === 0 && min > 60) adjustedProb *= 0.4; // Desconto por tempo esgotando
    else if (goals === 1) adjustedProb = Math.max(adjustedProb, 75);
  }

  const md = [
    ...(notice ? [`> **${notice.title}**\n> ${notice.message}\n`] : []),
    '## Painel de Resultados e EV',
    `- **Probabilidade (IA)**: ${adjustedProb.toFixed(1)}%`,
    `- **Confiança (IA)**: 100% (Modelo Estatístico Local)`,
    `- **EV**: ${ctx.baseline.ev?.toFixed(1) ?? 'N/A'}%`,
    `- **Nível de Risco**: ${ctx.baseline.risk}`,
    '',
    '## Sinais Externos (Status)',
    `- Lineups: ${ctx.externalSignals?.lineups.status ?? 'disabled'}`,
    `- Clima: ${ctx.externalSignals?.weather.status ?? 'disabled'}`,
    '',
    '---',
    '',
    '## Análise Quantitativa (Fallback Local)',
    `Partida entre ${data.homeTeam} e ${data.awayTeam}.`,
    liveScore ? `Placar Atual: ${liveScore.homeScore}-${liveScore.awayScore} (${liveScore.minute}').` : 'Análise Pré-Jogo.',
    `Média da Competição: ${ctx.market.competitionAvg}% para Over 1.5.`,
    '',
    '## Observações',
    'Este relatório foi gerado localmente devido à indisponibilidade da API do Gemini.'
  ].join('\n');

  return { reportMarkdown: md, provider: 'local', notice, externalSignals: ctx.externalSignals };
}

/**
 * FUNÇÃO PRINCIPAL EXPORTADA
 */

export async function generateAiOver15Report(
  data: MatchData,
  options?: { fetchLiveData?: boolean; liveScore?: MatchScore; useExternalSignals?: boolean }
): Promise<AiOver15Result> {
  let liveScore = options?.liveScore;

  // Sync de dados ao vivo
  if (options?.fetchLiveData && data.matchDate && !liveScore) {
    try {
      const res = await syncMatchScore(data.homeTeam, data.awayTeam, data.matchDate);
      if (res.success) liveScore = res.score;
    } catch (e) { console.warn('Live sync failed', e); }
  }

  const apiKey = getGeminiSettings().apiKey;
  if (!apiKey) {
    return await localFallbackReport(data, liveScore, {
      kind: 'info',
      title: 'IA Local Ativa',
      message: 'Chave API não configurada. Usando processamento estatístico local.'
    }, options);
  }

  try {
    const prompt = await buildPrompt(data, liveScore, options);
    const reportMarkdown = await generateGeminiContent(prompt, apiKey);
    // Contexto também é útil para UI (status de sinais externos)
    const ctx = await buildContext(data, liveScore, options);
    return { reportMarkdown, provider: 'gemini', externalSignals: ctx.externalSignals };
  } catch (e) {
    const friendly = toGeminiFriendlyError(e);
    return await localFallbackReport(data, liveScore, {
      kind: 'warning',
      title: friendly?.title ?? 'Erro na IA',
      message: friendly?.message ?? 'Falha na comunicação com o Gemini. Usando fallback.'
    }, options);
  }
}