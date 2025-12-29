import { MatchData } from '../types';
import { performAnalysis } from './analysisEngine';
import { generateGeminiContent, getGeminiSettings, toGeminiFriendlyError } from './geminiClient';

type AiOver15Result = {
  reportMarkdown: string;
  provider: 'gemini' | 'local';
  notice?: {
    kind: 'info' | 'warning' | 'error';
    title: string;
    message: string;
  };
};

function safeNumber(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n;
}

/**
 * Extrai a probabilidade da análise da IA do markdown.
 * Procura por padrões como "**Probabilidade (IA)**: XX%" ou "Probabilidade (IA): XX%"
 */
export function extractProbabilityFromMarkdown(markdown: string): number | null {
  if (!markdown || typeof markdown !== 'string') return null;
  
  // Padrões possíveis:
  // - **Probabilidade (IA)**: XX%
  // - Probabilidade (IA): XX%
  // - **Probabilidade (IA)**: XX,XX%
  const patterns = [
    /\*\*Probabilidade\s*\(?IA\)?\*\*:\s*([\d,]+\.?\d*)\s*%/i,
    /Probabilidade\s*\(?IA\)?:\s*([\d,]+\.?\d*)\s*%/i,
    /Probabilidade.*?IA.*?:\s*([\d,]+\.?\d*)\s*%/i
  ];
  
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  }
  
  return null;
}

/**
 * Extrai a confiança da análise da IA do markdown.
 * Procura por padrões como "**Confiança (IA)**: XX%" ou "Confiança (IA): XX%"
 */
export function extractConfidenceFromMarkdown(markdown: string): number | null {
  if (!markdown || typeof markdown !== 'string') return null;
  
  // Padrões possíveis:
  // - **Confiança (IA)**: XX%
  // - Confiança (IA): XX%
  // - **Confiança (IA)**: XX,XX%
  const patterns = [
    /\*\*Confiança\s*\(?IA\)?\*\*:\s*([\d,]+\.?\d*)\s*%/i,
    /Confiança\s*\(?IA\)?:\s*([\d,]+\.?\d*)\s*%/i,
    /Confiança.*?IA.*?:\s*([\d,]+\.?\d*)\s*%/i
  ];
  
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  }
  
  return null;
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
    '# Análise Quantitativa de Apostas - Over 1.5 Gols',
    '',
    '## Identidade e Objetivo',
    'Você é um analista quantitativo especializado em apostas esportivas, com expertise em análise estatística de mercados de gols no futebol.',
    'Sua função é gerar uma análise profissional, baseada exclusivamente em dados, para avaliar a probabilidade de OVER 1.5 gols em uma partida.',
    'Foque em análise objetiva, interpretação técnica de métricas e recomendações acionáveis para apostadores.',
    '',
    '## Regras Estritas - Dados Externos PROIBIDOS',
    '⚠️ **CRÍTICO**: Você DEVE trabalhar APENAS com os dados fornecidos no JSON abaixo.',
    '',
    '**PROIBIÇÕES ABSOLUTAS:**',
    '- ❌ NÃO invente, assuma ou crie estatísticas que não estão nos dados fornecidos',
    '- ❌ NÃO cite fontes externas, URLs, sites ou referências a dados não fornecidos',
    '- ❌ NÃO faça "pesquisa na web" ou busque informações adicionais',
    '- ❌ NÃO mencione informações sobre escalações, lesões, ou contexto externo que não esteja nos dados',
    '- ❌ NÃO use conhecimento pré-treinado sobre times, jogadores ou competições específicas',
    '',
    '**QUANDO DADOS ESTIVEREM AUSENTES:**',
    '- Reconheça explicitamente quais campos estão ausentes (null)',
    '- Explique como a ausência desses dados afeta a confiabilidade da análise',
    '- NÃO assuma valores ou faça estimativas baseadas em conhecimento externo',
    '',
    '## Instruções de Interpretação de Dados',
    '',
    '**Médias de Gols:**',
    '- `avgScored`: Média de gols marcados por jogo (indica força ofensiva)',
    '- `avgConceded`: Média de gols sofridos por jogo (indica fragilidade defensiva)',
    '- `avgTotal`: Média total de gols por jogo (soma de marcados + sofridos, dividido por 2)',
    '- **Interpretação**: avgTotal > 2.5 indica jogos com muitos gols; < 1.8 indica jogos trancados',
    '',
    '**Percentuais de Mercado:**',
    '- `homeOver15Pct` / `awayOver15Pct`: % de jogos com mais de 1.5 gols (dado mais relevante)',
    '- `homeOver25Pct` / `awayOver25Pct`: % de jogos com mais de 2.5 gols (confirma tendência ofensiva)',
    '- `homeCleanSheetPct` / `awayCleanSheetPct`: % de jogos sem sofrer gols (indica defesa sólida)',
    '- `homeNoGoalsPct` / `awayNoGoalsPct`: % de jogos sem marcar (indica ataque fraco)',
    '- **Interpretação**: Percentuais altos de Over 1.5% favorecem a aposta; Clean Sheet alto e No Goals alto são red flags',
    '',
    '**Análise de Valor (EV):**',
    '- `evPct`: Expected Value em percentual. Positivo = valor positivo; Negativo = odd desfavorável',
    '- `oddOver15`: Odd oferecida pela casa de apostas',
    '- `probabilityOver15Pct`: Probabilidade calculada pelo modelo quantitativo',
    '- **Interpretação**: EV > 0% indica aposta com valor; compare probabilidade do modelo com odd implícita (1/odd * 100)',
    '',
    '**Baseline do Modelo:**',
    '- `probabilityOver15Pct`: Probabilidade calculada pelo modelo estatístico (baseline)',
    '- `confidenceScorePct`: Nível de confiança do modelo (baseado na qualidade dos dados)',
    '- `riskLevel`: Nível de risco (Baixo/Moderado/Alto/Muito Alto)',
    '- **Interpretação**: Compare sua análise com o baseline; explique convergências ou divergências',
    '',
    '## Estrutura Obrigatória da Análise',
    '',
    '⚠️ **IMPORTANTE**: Siga EXATAMENTE esta ordem. Cada seção deve ser um bloco separado com quebra de linha antes e depois.',
    '',
    '### 1. ## Painel de Resultados e EV',
    '**PRIMEIRO BLOCO** - Informações principais consolidadas:',
    '- **Probabilidade (IA)**: XX% (sua estimativa baseada nos dados)',
    '- **Confiança (IA)**: XX% (baseada na qualidade e completude dos dados fornecidos) + breve justificativa',
    '- **EV (Expected Value)**: XX% (se odd disponível) + interpretação (positivo = valor, negativo = desfavorável)',
    '- **Convergência com modelo**: (maior/igual/menor) + explicação técnica em 1-2 frases',
    '- **Nível de risco**: (Baixo/Moderado/Alto/Muito Alto) baseado na análise',
    '',
    '---',
    '',
    '### 2. ## Análise Quantitativa',
    '**SEGUNDO BLOCO** - Interpretação técnica detalhada dos dados:',
    '- Compare médias de gols (avgScored, avgConceded, avgTotal) entre os times',
    '- Analise percentuais de Over 1.5% e Over 2.5% de cada time',
    '- Avalie indicadores defensivos (Clean Sheet%, No Goals%)',
    '- Compare com média da competição (competitionAvgOver15Pct)',
    '- Use linguagem técnica mas acessível, focando em dados e probabilidades',
    '- Forneça análise comparativa entre time da casa e visitante',
    '',
    '---',
    '',
    '### 3. ## Sinais a Favor',
    '**TERCEIRO BLOCO** - Fatores quantitativos que suportam Over 1.5:',
    '- Liste cada sinal com explicação técnica clara',
    '- Exemplo: "Média total de gols combinada de 2.8 indica ritmo ofensivo acima da média"',
    '- Exemplo: "Over 1.5% de 75% no time da casa sugere consistência ofensiva"',
    '- Foque em dados, não em opiniões subjetivas',
    '- Quantifique o impacto de cada sinal na probabilidade',
    '',
    '---',
    '',
    '### 4. ## Red Flags (Contra)',
    '**QUARTO BLOCO** - Fatores quantitativos que reduzem probabilidade:',
    '- Liste cada red flag com análise de risco',
    '- Exemplo: "Clean Sheet% de 60% no time visitante indica defesa muito sólida"',
    '- Exemplo: "Média total abaixo de 1.6 gols sugere cenário de jogo trancado"',
    '- Quantifique o impacto de cada red flag na probabilidade',
    '- Se não houver red flags significativos, indique claramente',
    '',
    '---',
    '',
    '### 5. ## Plano de Entrada',
    '**QUINTO BLOCO** - Recomendações práticas para apostas:',
    '- **Pré-live**: Recomendação baseada em probabilidade e EV (entrar apenas se probabilidade alta E EV positivo)',
    '- **Live (gatilhos)**: Sinais quantitativos para monitorar (ex: 3+ finalizações nos primeiros 10min, pressão ofensiva contínua)',
    '- **Evitar**: Cenários quantitativos que indicam baixa probabilidade (ex: jogo com médias muito baixas, times com alta taxa de clean sheet)',
    '',
    '---',
    '',
    '### 6. ## Observações e Limitações',
    '**ÚLTIMO BLOCO** - Transparência sobre dados e confiabilidade:',
    '- Liste explicitamente quais dados estão ausentes (null)',
    '- Explique como a ausência desses dados afeta a confiabilidade da análise',
    '- Indique nível de confiança baseado na completude dos dados',
    '- Se todos os dados estiverem presentes, indique "Base de dados completa"',
    '',
    '## Formato de Saída',
    '- Responda em português brasileiro (pt-BR)',
    '- Use Markdown para formatação',
    '- **CRÍTICO**: Cada seção (##) deve ter uma linha em branco ANTES e DEPOIS para separação visual clara',
    '- Use `---` (três hífens) como separador entre seções principais para melhor legibilidade',
    '- Mantenha tom profissional, analítico e baseado em dados',
    '- Evite linguagem casual ou informal',
    '- Foque em probabilidades, estatísticas e análise quantitativa',
    '- Garanta que os blocos apareçam um embaixo do outro, na ordem especificada',
    '',
    '**Exemplo de estrutura visual:**',
    '```',
    '',
    '## Painel de Resultados e EV',
    '[conteúdo]',
    '',
    '---',
    '',
    '## Análise Quantitativa',
    '[conteúdo]',
    '',
    '---',
    '',
    '## Sinais a Favor',
    '[conteúdo]',
    '```',
    '',
    '---',
    '',
    '## Dados Fornecidos (JSON)',
    'Analise APENAS estes dados. Não invente, não assuma, não cite fontes externas:',
    '',
    JSON.stringify(ctx, null, 2)
  ].join('\n');
}

function localFallbackReport(data: MatchData, notice?: AiOver15Result['notice']): AiOver15Result {
  const ctx = buildContext(data);
  const p = ctx.modelBaseline.probabilityOver15Pct ?? 0;
  const c = ctx.modelBaseline.confidenceScorePct ?? 0;
  const ev = ctx.modelBaseline.evPct;

  const md = [
    ...(notice
      ? [
          `> **${notice.title}**`,
          `> ${notice.message}`,
          '>'
        ]
      : []),
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
    '- Para destravar a IA online, configure `VITE_GEMINI_API_KEY` no ambiente (sem comitar a chave).'
  ].join('\n');

  return { reportMarkdown: md, provider: 'local', notice };
}

export async function generateAiOver15Report(data: MatchData): Promise<AiOver15Result> {
  const apiKey = getGeminiSettings().apiKey;
  if (!apiKey) {
    return localFallbackReport(data, {
      kind: 'info',
      title: 'IA online desativada',
      message: 'Nenhuma chave do Gemini foi encontrada no ambiente. Usando análise local (modelo atual).'
    });
  }

  const prompt = buildPrompt(data);
  try {
    const reportMarkdown = await generateGeminiContent(prompt, apiKey);
    return { reportMarkdown, provider: 'gemini' };
  } catch (e) {
    const friendly = toGeminiFriendlyError(e);
    const retryHint =
      friendly?.retryAfterSeconds != null && friendly.retryAfterSeconds > 0
        ? ` (tente novamente em ~${friendly.retryAfterSeconds}s)`
        : '';

    return localFallbackReport(data, {
      kind: friendly?.kind === 'quota_exceeded' ? 'warning' : 'warning',
      title: friendly?.title ?? 'Falha ao chamar IA online',
      message: `${friendly?.message ?? 'Não foi possível usar o Gemini agora.'}${retryHint} Usando fallback local.`
    });
  }
}

