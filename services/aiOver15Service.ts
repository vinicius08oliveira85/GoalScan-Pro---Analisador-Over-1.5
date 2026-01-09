import { MatchData } from '../types';
import { performAnalysis } from './analysisEngine';
import { generateGeminiContent, getGeminiSettings, toGeminiFriendlyError } from './geminiClient';
import { syncMatchScore, MatchScore } from './googleMatchSync';

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

async function buildContext(data: MatchData, liveScore?: MatchScore) {
  const result = performAnalysis(data);
  const home = data.homeTeamStats?.gols?.home;
  const away = data.awayTeamStats?.gols?.away;

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
    // Estatísticas Globais (inseridas manualmente pelo usuário)
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
    // Dados completos da tabela do campeonato (TODOS os campos)
    championshipTable: {
      home: data.homeTableData || null,
      away: data.awayTableData || null,
    },
    baseline: {
      prob: safeNumber(result.probabilityOver15),
      ev: safeNumber(result.ev),
      risk: result.riskLevel,
    }
  };
}

async function buildPrompt(data: MatchData, liveScore?: MatchScore): Promise<string> {
  const ctx = await buildContext(data, liveScore);
  
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
    '- "stats" contém as Estatísticas Globais inseridas manualmente pelo usuário (baseadas nos últimos 10 jogos Casa/Fora)',
    '- "championshipTable" contém TODOS os campos da tabela do campeonato para cada equipe',
    '- Analise todos os campos da tabela (Classificação, Partidas Jogadas, Vitórias, Empates, Derrotas, Gols, Pontos, xG, etc.)',
    '- Use os dados da tabela + Estatísticas Globais para calcular probabilidades precisas'
  ].join('\n');
}

/**
 * FALLBACK LOCAL (Lógica Estatística de Segurança)
 */

async function localFallbackReport(data: MatchData, liveScore?: MatchScore, notice?: AiOver15Result['notice']): Promise<AiOver15Result> {
  const ctx = await buildContext(data, liveScore);
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

  return { reportMarkdown: md, provider: 'local', notice };
}

/**
 * FUNÇÃO PRINCIPAL EXPORTADA
 */

export async function generateAiOver15Report(
  data: MatchData,
  options?: { fetchLiveData?: boolean; liveScore?: MatchScore; }
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
    });
  }

  try {
    const prompt = await buildPrompt(data, liveScore);
    const reportMarkdown = await generateGeminiContent(prompt, apiKey);
    return { reportMarkdown, provider: 'gemini' };
  } catch (e) {
    const friendly = toGeminiFriendlyError(e);
    return await localFallbackReport(data, liveScore, {
      kind: 'warning',
      title: friendly?.title ?? 'Erro na IA',
      message: friendly?.message ?? 'Falha na comunicação com o Gemini. Usando fallback.'
    });
  }
}