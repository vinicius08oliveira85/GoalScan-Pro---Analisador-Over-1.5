import { MatchData } from '../types';
import { performAnalysis } from './analysisEngine';

type AiOver15Result = {
  reportMarkdown: string;
  provider: 'gemini' | 'local';
};

function getGeminiApiKey(): string | null {
  // Preferência:
  // 1) `VITE_GEMINI_API_KEY` (padrão Vite)
  // 2) `GEMINI_API_KEY` / `API_KEY` (inject via build/define)
  const fromVite = (import.meta as any)?.env?.VITE_GEMINI_API_KEY as string | undefined;
  // Importante:
  // No frontend, `process` normalmente NÃO existe em runtime. Porém, o Vite pode substituir
  // `process.env.X` por literais no build via `define` (ver `vite.config.ts`).
  // Portanto, não podemos usar `typeof process !== 'undefined'` aqui, senão a chave injetada
  // nunca é lida em produção.
  const fromProcess = (process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY) as string | undefined;

  const key = fromVite || fromProcess || null;
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
}

function getGeminiModel(): string {
  // Permitimos configurar o modelo via env, mas mantemos um default.
  // Em geral, os endpoints modernos aceitam `gemini-1.5-flash` em `v1`.
  const fromVite = (import.meta as any)?.env?.VITE_GEMINI_MODEL as string | undefined;
  const fromProcess = (process.env.VITE_GEMINI_MODEL || process.env.GEMINI_MODEL) as string | undefined;
  const model = (fromVite || fromProcess || 'gemini-1.5-flash').trim();
  return model.length > 0 ? model : 'gemini-1.5-flash';
}

function getGeminiApiVersion(): 'v1' | 'v1beta' {
  // Corrige o 404 reportado: `v1beta` pode não listar/aceitar alguns modelos/métodos.
  // Default seguro: `v1`.
  const fromVite = (import.meta as any)?.env?.VITE_GEMINI_API_VERSION as string | undefined;
  const fromProcess = (process.env.VITE_GEMINI_API_VERSION ||
    process.env.GEMINI_API_VERSION) as string | undefined;
  const v = (fromVite || fromProcess || 'v1').trim();
  return v === 'v1beta' ? 'v1beta' : 'v1';
}

function safeNumber(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n;
}

function buildContext(data: MatchData) {
  const result = performAnalysis(data);

  const home = data.homeTeamStats?.gols?.global;
  const away = data.awayTeamStats?.gols?.global;

  return {
    match: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      matchDate: data.matchDate ?? null,
      matchTime: data.matchTime ?? null
    },
    market: {
      oddOver15: safeNumber(data.oddOver15),
      competitionAvgOver15Pct: safeNumber(data.competitionAvg)
    },
    inputs: {
      homeOver15Pct: safeNumber(data.homeOver15Freq),
      awayOver15Pct: safeNumber(data.awayOver15Freq),
      homeAvgScored: safeNumber(home?.avgScored),
      homeAvgConceded: safeNumber(home?.avgConceded),
      homeAvgTotal: safeNumber(home?.avgTotal),
      homeCleanSheetPct: safeNumber(home?.cleanSheetPct),
      homeNoGoalsPct: safeNumber(home?.noGoalsPct),
      homeOver25Pct: safeNumber(home?.over25Pct),
      awayAvgScored: safeNumber(away?.avgScored),
      awayAvgConceded: safeNumber(away?.avgConceded),
      awayAvgTotal: safeNumber(away?.avgTotal),
      awayCleanSheetPct: safeNumber(away?.cleanSheetPct),
      awayNoGoalsPct: safeNumber(away?.noGoalsPct),
      awayOver25Pct: safeNumber(away?.over25Pct)
    },
    modelBaseline: {
      probabilityOver15Pct: safeNumber(result.probabilityOver15),
      confidenceScorePct: safeNumber(result.confidenceScore),
      riskLevel: result.riskLevel,
      evPct: safeNumber(result.ev)
    }
  };
}

function buildPrompt(data: MatchData): string {
  const ctx = buildContext(data);
  return [
    'Você é um analista quantitativo de futebol focado em mercados de gols.',
    'Objetivo: gerar uma análise para OVER 1.5 gols com alta assertividade, usando SOMENTE os dados fornecidos abaixo (não invente estatísticas, não cite fontes/URLs, não faça "pesquisa na web").',
    'Quando um campo estiver ausente/null, reconheça a limitação e não assuma valores.',
    '',
    'Regras de saída:',
    '- Responda em pt-BR.',
    '- Use Markdown.',
    '- Entregue uma conclusão prática (pré-live e gatilhos de live).',
    '- Traga um número final de probabilidade (0-100) e um nível de confiança (0-100).',
    '',
    'Estrutura obrigatória:',
    '## Resumo (Over 1.5)',
    '- **Probabilidade (IA)**: XX%',
    '- **Confiança (IA)**: XX%',
    '- **Convergência com modelo**: (maior/igual/menor) + 1 frase',
    '',
    '## Sinais a favor',
    '- ...',
    '',
    '## Red flags (contra)',
    '- ...',
    '',
    '## Plano de entrada',
    '- **Pré-live**: ...',
    '- **Live (gatilhos)**: ...',
    '- **Evitar**: ...',
    '',
    '## Observações',
    '- Se faltarem dados, diga exatamente quais e como isso afeta a análise.',
    '',
    'Dados (JSON):',
    JSON.stringify(ctx, null, 2)
  ].join('\n');
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const apiVersion = getGeminiApiVersion();
  const model = getGeminiModel();
  const url =
    `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 900
      }
    })
  });

  if (!res.ok) {
    // A API pode retornar JSON com { error: { message } }. Se falhar, caímos para texto cru.
    const raw = await res.text().catch(() => '');
    try {
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      const msg: unknown = parsed?.error?.message;
      if (typeof msg === 'string' && msg.trim().length > 0) {
        throw new Error(`Falha ao chamar Gemini (${res.status}). ${msg}`.trim());
      }
    } catch {
      // ignore parse errors; handled below
    }
    throw new Error(`Falha ao chamar Gemini (${res.status}). ${raw}`.trim());
  }

  const json = (await res.json()) as any;
  const text: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Resposta inválida do Gemini (sem texto).');
  }
  return text.trim();
}

function localFallbackReport(data: MatchData): AiOver15Result {
  const ctx = buildContext(data);
  const p = ctx.modelBaseline.probabilityOver15Pct ?? 0;
  const c = ctx.modelBaseline.confidenceScorePct ?? 0;
  const ev = ctx.modelBaseline.evPct;

  const md = [
    '## Resumo (Over 1.5)',
    `- **Probabilidade (IA)**: ${p.toFixed(0)}%`,
    `- **Confiança (IA)**: ${c.toFixed(0)}%`,
    `- **Convergência com modelo**: igual (fallback local usando o modelo atual)`,
    '',
    '## Sinais a favor',
    '- **Over 1.5 (%)** dos times e **média total de gols** puxam a probabilidade para cima quando altos.',
    '- **Over 2.5 (%)** ajuda a confirmar ritmo ofensivo.',
    '',
    '## Red flags (contra)',
    '- **Clean sheet (%)** alto e **sem marcar (%)** alto tendem a reduzir Over 1.5.',
    '- Se a **média total** estiver baixa, o cenário é mais “trancado”.',
    '',
    '## Plano de entrada',
    '- **Pré-live**: entrar apenas se a probabilidade estiver alta e o EV estiver positivo.',
    '- **Live (gatilhos)**: intensidade cedo (finalizações perigosas / pressão contínua).',
    '- **Evitar**: jogo morno, baixa criação, muitos 0x0 recentes ou times com alta taxa de clean sheet.',
    '',
    '## Observações',
    `- **Risco**: ${ctx.modelBaseline.riskLevel}.`,
    `- **EV**: ${typeof ev === 'number' ? `${ev.toFixed(1)}%` : 'indisponível (odd não informada).'}`,
    '- Para destravar a IA online, configure `GEMINI_API_KEY` no ambiente (sem comitar a chave).'
  ].join('\n');

  return { reportMarkdown: md, provider: 'local' };
}

export async function generateAiOver15Report(data: MatchData): Promise<AiOver15Result> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return localFallbackReport(data);

  const prompt = buildPrompt(data);
  const reportMarkdown = await callGemini(prompt, apiKey);
  return { reportMarkdown, provider: 'gemini' };
}

