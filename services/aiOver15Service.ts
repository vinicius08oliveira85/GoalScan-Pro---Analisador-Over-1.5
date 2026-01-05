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
 * CONSTRUÇÃO DE CONTEXTO E PROMPT
 */

function buildContext(data: MatchData, liveScore?: MatchScore) {
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
    stats: {
      home: { over15: safeNumber(data.homeOver15Freq), avgScored: home?.avgScored, avgTotal: home?.avgTotal },
      away: { over15: safeNumber(data.awayOver15Freq), avgScored: away?.avgScored, avgTotal: away?.avgTotal },
    },
    baseline: {
      prob: safeNumber(result.probabilityOver15),
      ev: safeNumber(result.ev),
      risk: result.riskLevel,
    }
  };
}

function buildPrompt(data: MatchData, liveScore?: MatchScore): string {
  const ctx = buildContext(data, liveScore);
  
  return [
    '# PERSONA: Analista Quantitativo de Apostas (Over 1.5 Gols)',
    '# OBJETIVO: Gerar relatório técnico baseado exclusivamente nos dados fornecidos.',
    '',
    '## REGRAS CRÍTICAS:',
    '1. Use APENAS o JSON abaixo. Proibido inventar dados ou usar conhecimento externo.',
    '2. O formato da primeira seção DEVE ser exatamente:',
    '   - **Probabilidade (IA)**: XX%',
    '   - **Confiança (IA)**: XX%',
    '3. Se houver liveData (minute > 0), priorize o cenário atual da partida sobre o histórico.',
    '',
    '## ESTRUTURA DO RELATÓRIO:',
    '## Painel de Resultados e EV -> Análise Quantitativa -> Sinais a Favor -> Red Flags -> Plano de Entrada',
    '',
    '## DADOS PARA ANÁLISE (JSON):',
    JSON.stringify(ctx, null, 2)
  ].join('\n');
}

/**
 * FALLBACK LOCAL (Lógica Estatística de Segurança)
 */

function localFallbackReport(data: MatchData, liveScore?: MatchScore, notice?: AiOver15Result['notice']): AiOver15Result {
  const ctx = buildContext(data, liveScore);
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
    return localFallbackReport(data, liveScore, {
      kind: 'info',
      title: 'IA Local Ativa',
      message: 'Chave API não configurada. Usando processamento estatístico local.'
    });
  }

  try {
    const prompt = buildPrompt(data, liveScore);
    const reportMarkdown = await generateGeminiContent(prompt, apiKey);
    return { reportMarkdown, provider: 'gemini' };
  } catch (e) {
    const friendly = toGeminiFriendlyError(e);
    return localFallbackReport(data, liveScore, {
      kind: 'warning',
      title: friendly?.title ?? 'Erro na IA',
      message: friendly?.message ?? 'Falha na comunicação com o Gemini. Usando fallback.'
    });
  }
}