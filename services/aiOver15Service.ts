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
 * Melhorado com mais padrões e validação robusta
 */
export function extractProbabilityFromMarkdown(markdown: string): number | null {
  if (!markdown || typeof markdown !== 'string') return null;

  // Padrões expandidos para capturar mais variações:
  // - **Probabilidade (IA)**: XX%
  // - Probabilidade (IA): XX%
  // - **Probabilidade (IA)**: XX,XX%
  // - Probabilidade IA: XX%
  // - Probabilidade: XX% (dentro de contexto de IA)
  // - Prob. (IA): XX%
  const patterns = [
    /\*\*Probabilidade\s*\(?IA\)?\*\*:\s*([\d,]+\.?\d*)\s*%/i,
    /Probabilidade\s*\(?IA\)?:\s*([\d,]+\.?\d*)\s*%/i,
    /Probabilidade.*?IA.*?:\s*([\d,]+\.?\d*)\s*%/i,
    /Prob\.?\s*\(?IA\)?:\s*([\d,]+\.?\d*)\s*%/i,
    /Probabilidade\s*\(IA\):\s*([\d,]+\.?\d*)\s*%/i,
    // Padrão mais flexível com espaços variados
    /Probabilidade\s*[: -]\s*([\d,]+\.?\d*)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      // Normalizar separador decimal (aceitar vírgula ou ponto)
      const normalized = match[1].replace(',', '.');
      const value = parseFloat(normalized);

      // Validação robusta: deve ser número válido e estar em range razoável
      if (!isNaN(value) && Number.isFinite(value) && value >= 0 && value <= 100) {
        // Validação adicional: valores muito extremos podem ser erros
        if (value < 5 || value > 95) {
          // Log para debug (em produção, usar logger)
          console.warn(`Probabilidade extraída parece extrema: ${value}%`);
        }
        return value;
      }
    }
  }

  // Tentar extrair de JSON estruturado como fallback
  try {
    const jsonMatch = markdown.match(/\{[\s\S]*?"probabilidade"[^}]*?([\d,]+\.?\d*)[\s\S]*?\}/i);
    if (jsonMatch && jsonMatch[1]) {
      const normalized = jsonMatch[1].replace(',', '.');
      const value = parseFloat(normalized);
      if (!isNaN(value) && Number.isFinite(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  } catch {
    // Ignorar erros de parsing JSON
  }

  return null;
}

/**
 * Extrai a confiança da análise da IA do markdown.
 * Procura por padrões como "**Confiança (IA)**: XX%" ou "Confiança (IA): XX%"
 * Melhorado com mais padrões e validação robusta
 */
export function extractConfidenceFromMarkdown(markdown: string): number | null {
  if (!markdown || typeof markdown !== 'string') return null;

  // Padrões expandidos para capturar mais variações:
  // - **Confiança (IA)**: XX%
  // - Confiança (IA): XX%
  // - **Confiança (IA)**: XX,XX%
  // - Confiança IA: XX%
  // - Conf. (IA): XX%
  const patterns = [
    /\*\*Confiança\s*\(?IA\)?\*\*:\s*([\d,]+\.?\d*)\s*%/i,
    /Confiança\s*\(?IA\)?:\s*([\d,]+\.?\d*)\s*%/i,
    /Confiança.*?IA.*?:\s*([\d,]+\.?\d*)\s*%/i,
    /Conf\.?\s*\(?IA\)?:\s*([\d,]+\.?\d*)\s*%/i,
    /Confiança\s*\(IA\):\s*([\d,]+\.?\d*)\s*%/i,
    // Padrão mais flexível com espaços variados
    /Confiança\s*[: -]\s*([\d,]+\.?\d*)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      // Normalizar separador decimal (aceitar vírgula ou ponto)
      const normalized = match[1].replace(',', '.');
      const value = parseFloat(normalized);

      // Validação robusta: deve ser número válido e estar em range razoável
      if (!isNaN(value) && Number.isFinite(value) && value >= 0 && value <= 100) {
        // Validação adicional: valores muito baixos podem ser erros
        if (value < 10) {
          // Log para debug (em produção, usar logger)
          console.warn(`Confiança extraída parece muito baixa: ${value}%`);
        }
        return value;
      }
    }
  }

  // Tentar extrair de JSON estruturado como fallback
  try {
    const jsonMatch = markdown.match(/\{[\s\S]*?"confiança"[^}]*?([\d,]+\.?\d*)[\s\S]*?\}/i);
    if (jsonMatch && jsonMatch[1]) {
      const normalized = jsonMatch[1].replace(',', '.');
      const value = parseFloat(normalized);
      if (!isNaN(value) && Number.isFinite(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  } catch {
    // Ignorar erros de parsing JSON
  }

  return null;
}

function buildContext(data: MatchData) {
  const result = performAnalysis(data);

  // Usar estatísticas específicas: home para time da casa, away para visitante
  const home = data.homeTeamStats?.gols?.home;
  const away = data.awayTeamStats?.gols?.away;

  return {
    match: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      matchDate: data.matchDate ?? null,
      matchTime: data.matchTime ?? null,
    },
    market: {
      oddOver15: safeNumber(data.oddOver15),
      competitionAvgOver15Pct: safeNumber(data.competitionAvg),
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
      awayOver25Pct: safeNumber(away?.over25Pct),
    },
    modelBaseline: {
      probabilityOver15Pct: safeNumber(result.probabilityOver15),
      confidenceScorePct: safeNumber(result.confidenceScore),
      riskLevel: result.riskLevel,
      evPct: safeNumber(result.ev),
    },
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
    '⚠️ **FORMATO OBRIGATÓRIO**: Use EXATAMENTE estes formatos para facilitar extração automática:',
    '- **Probabilidade (IA)**: XX% (sua estimativa baseada nos dados - DEVE ser um número entre 0 e 100)',
    '- **Confiança (IA)**: XX% (baseada na qualidade e completude dos dados fornecidos - DEVE ser um número entre 0 e 100) + breve justificativa',
    '- **EV (Expected Value)**: XX% (se odd disponível) + interpretação (positivo = valor, negativo = desfavorável)',
    '- **Convergência com modelo**: (maior/igual/menor) + explicação técnica em 1-2 frases',
    '- **Nível de risco**: (Baixo/Moderado/Alto/Muito Alto) baseado na análise',
    '',
    '**IMPORTANTE**:',
    '- Use ponto (.) ou vírgula (,) como separador decimal, mas seja consistente',
    '- Os valores de Probabilidade e Confiança DEVEM aparecer na primeira seção',
    '- Não use formatação adicional que possa confundir a extração (ex: "~XX%", "aproximadamente XX%")',
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
    JSON.stringify(ctx, null, 2),
  ].join('\n');
}

function localFallbackReport(data: MatchData, notice?: AiOver15Result['notice']): AiOver15Result {
  const ctx = buildContext(data);
  const p = ctx.modelBaseline.probabilityOver15Pct ?? 0;
  const c = ctx.modelBaseline.confidenceScorePct ?? 0;
  const ev = ctx.modelBaseline.evPct;
  const risk = ctx.modelBaseline.riskLevel;

  // Análise mais detalhada do fallback local
  const home = ctx.inputs;
  const hasGoodData = (home.homeOver15Pct ?? 0) > 0 && (home.awayOver15Pct ?? 0) > 0;
  const avgTotal = ((home.homeAvgTotal ?? 0) + (home.awayAvgTotal ?? 0)) / 2;
  const avgCleanSheet = ((home.homeCleanSheetPct ?? 0) + (home.awayCleanSheetPct ?? 0)) / 2;
  const avgNoGoals = ((home.homeNoGoalsPct ?? 0) + (home.awayNoGoalsPct ?? 0)) / 2;

  // Construir sinais a favor baseados nos dados
  const positiveSignals: string[] = [];
  if ((home.homeOver15Pct ?? 0) > 70) {
    positiveSignals.push(
      `Time da casa com ${home.homeOver15Pct?.toFixed(0)}% de Over 1.5 indica consistência ofensiva`
    );
  }
  if ((home.awayOver15Pct ?? 0) > 70) {
    positiveSignals.push(
      `Time visitante com ${home.awayOver15Pct?.toFixed(0)}% de Over 1.5 sugere ritmo ofensivo`
    );
  }
  if (avgTotal > 2.5) {
    positiveSignals.push(
      `Média total de gols de ${avgTotal.toFixed(2)} indica jogos com muitos gols`
    );
  }
  if ((home.homeOver25Pct ?? 0) > 60 || (home.awayOver25Pct ?? 0) > 60) {
    positiveSignals.push(`Over 2.5% alto confirma tendência ofensiva`);
  }

  // Construir red flags baseados nos dados
  const redFlags: string[] = [];
  if (avgCleanSheet > 50) {
    redFlags.push(`Clean Sheet médio de ${avgCleanSheet.toFixed(0)}% indica defesas muito sólidas`);
  }
  if (avgNoGoals > 30) {
    redFlags.push(`Taxa de "sem marcar" de ${avgNoGoals.toFixed(0)}% sugere ataques fracos`);
  }
  if (avgTotal < 1.8) {
    redFlags.push(`Média total de gols de ${avgTotal.toFixed(2)} indica cenário de jogo trancado`);
  }
  if (!hasGoodData) {
    redFlags.push(`Dados limitados reduzem confiabilidade da análise`);
  }

  const md = [
    ...(notice ? [`> **${notice.title}**`, `> ${notice.message}`, '>'] : []),
    '## Painel de Resultados e EV',
    `- **Probabilidade (IA)**: ${p.toFixed(1)}%`,
    `- **Confiança (IA)**: ${c.toFixed(1)}% (baseada na completude dos dados fornecidos)`,
    `- **EV (Expected Value)**: ${typeof ev === 'number' ? `${ev.toFixed(1)}% ${ev > 0 ? '(valor positivo)' : ev < 0 ? '(odd desfavorável)' : '(sem valor)'}` : 'indisponível (odd não informada)'}`,
    `- **Convergência com modelo**: igual (fallback local usando o modelo estatístico atual)`,
    `- **Nível de risco**: ${risk}`,
    '',
    '---',
    '',
    '## Análise Quantitativa',
    hasGoodData
      ? `Análise baseada em dados de Over 1.5% dos times (casa: ${home.homeOver15Pct?.toFixed(0)}%, visitante: ${home.awayOver15Pct?.toFixed(0)}%) e média da competição (${ctx.market.competitionAvgOver15Pct?.toFixed(0)}%).`
      : 'Análise baseada principalmente na média da competição devido à limitação de dados dos times.',
    avgTotal > 0 && `Média total de gols combinada: ${avgTotal.toFixed(2)} gols por jogo.`,
    '',
    '---',
    '',
    '## Sinais a Favor',
    positiveSignals.length > 0
      ? positiveSignals.map((s) => `- ${s}`).join('\n')
      : '- Dados limitados impedem identificação clara de sinais favoráveis',
    '',
    '---',
    '',
    '## Red Flags (Contra)',
    redFlags.length > 0
      ? redFlags.map((s) => `- ${s}`).join('\n')
      : '- Nenhum red flag significativo identificado com os dados disponíveis',
    '',
    '---',
    '',
    '## Plano de Entrada',
    `- **Pré-live**: ${p > 75 && typeof ev === 'number' && ev > 0 ? 'Entrada recomendada se probabilidade alta e EV positivo' : 'Aguardar análise mais detalhada ou monitorar no live'}`,
    '- **Live (gatilhos)**: Monitorar intensidade ofensiva nos primeiros 10-15 minutos (finalizações perigosas, pressão contínua)',
    '- **Evitar**: Jogos com médias muito baixas, times com alta taxa de clean sheet ou baixa criação de chances',
    '',
    '---',
    '',
    '## Observações e Limitações',
    hasGoodData
      ? '- Base de dados razoável para análise estatística'
      : '- Dados limitados: análise baseada principalmente em baseline da competição',
    typeof ev !== 'number' && '- Odd não informada: cálculo de EV indisponível',
    '- Esta é uma análise local (fallback). Para análise mais detalhada com IA, configure `VITE_GEMINI_API_KEY` no ambiente.',
    `- **Risco**: ${risk}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { reportMarkdown: md, provider: 'local', notice };
}

export async function generateAiOver15Report(data: MatchData): Promise<AiOver15Result> {
  const apiKey = getGeminiSettings().apiKey;
  if (!apiKey) {
    return localFallbackReport(data, {
      kind: 'info',
      title: 'IA online desativada',
      message:
        'Nenhuma chave do Gemini foi encontrada no ambiente. Usando análise local (modelo atual).',
    });
  }

  const prompt = buildPrompt(data);
  try {
    const reportMarkdown = await generateGeminiContent(prompt, apiKey);
    return { reportMarkdown, provider: 'gemini' };
  } catch (e) {
    const friendly = toGeminiFriendlyError(e);

    // Se o erro não for um GeminiCallError, mas contém mensagem sobre modelos não disponíveis
    if (!friendly && e instanceof Error && e.message.includes('Nenhum modelo Gemini disponível')) {
      return localFallbackReport(data, {
        kind: 'warning',
        title: 'Modelos Gemini não disponíveis (404)',
        message:
          e.message +
          '\n\nO sistema usará análise local (fallback) até que a API key seja configurada corretamente.',
      });
    }

    const retryHint =
      friendly?.retryAfterSeconds != null && friendly.retryAfterSeconds > 0
        ? ` (tente novamente em ~${friendly.retryAfterSeconds}s)`
        : '';

    return localFallbackReport(data, {
      kind:
        friendly?.kind === 'quota_exceeded'
          ? 'warning'
          : friendly?.kind === 'invalid_key' || friendly?.kind === 'forbidden'
            ? 'error'
            : 'warning',
      title: friendly?.title ?? 'Falha ao chamar IA online',
      message: `${friendly?.message ?? (e instanceof Error ? e.message : 'Não foi possível usar o Gemini agora.')}${retryHint} Usando fallback local.`,
    });
  }
}
