type GeminiApiVersion = 'v1' | 'v1beta';

type GeminiSettings = {
  apiKey: string | null;
  apiVersion: GeminiApiVersion;
  model: string;
};

class GeminiCallError extends Error {
  status: number;
  raw: string;
  retryAfterSeconds: number | null;
  apiVersion: GeminiApiVersion;
  model: string;

  constructor(opts: {
    status: number;
    raw: string;
    retryAfterSeconds: number | null;
    apiVersion: GeminiApiVersion;
    model: string;
    message: string;
  }) {
    super(opts.message);
    this.name = 'GeminiCallError';
    this.status = opts.status;
    this.raw = opts.raw;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.apiVersion = opts.apiVersion;
    this.model = opts.model;
  }
}

function normalizeEnvValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getGeminiSettings(): GeminiSettings {
  /**
   * Importante (Vite):
   * - `import.meta.env.*` funciona para variáveis `VITE_*`
   * - `define: { 'process.env.X': '...' }` só substitui acessos ESTÁTICOS (`process.env.X`)
   *
   * Logo, não podemos usar `process.env[key]` (dinâmico), senão o build não injeta os valores
   * e a IA "some" em produção (especialmente quando a chave é configurada como `GEMINI_API_KEY`).
   */
  const viteEnv = (import.meta as Record<string, string | undefined>).env ?? {};

  // Preferência: `VITE_*` (padrão Vite), mas aceita compat via `process.env.*` (injetado no build).
  const apiKey =
    normalizeEnvValue(viteEnv.VITE_GEMINI_API_KEY) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).VITE_GEMINI_API_KEY) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).GEMINI_API_KEY) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).API_KEY) ||
    null;

  const apiVersionRaw = (
    normalizeEnvValue(viteEnv.VITE_GEMINI_API_VERSION) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).VITE_GEMINI_API_VERSION) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).GEMINI_API_VERSION) ||
    'v1beta'
  ).toLowerCase();
  const apiVersion: GeminiApiVersion = apiVersionRaw === 'v1' ? 'v1' : 'v1beta';

  const modelRaw =
    normalizeEnvValue(viteEnv.VITE_GEMINI_MODEL) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).VITE_GEMINI_MODEL) ||
    normalizeEnvValue((process.env as Record<string, string | undefined>).GEMINI_MODEL) ||
    'gemini-3.0-flash';
  const model = normalizeGeminiModel(modelRaw);

  return { apiKey, apiVersion, model };
}

function normalizeGeminiModel(model: string): string {
  const m = (model || '').trim();
  if (!m) return 'gemini-3.0-flash';
  // Aceita "models/gemini-..." mas normaliza para apenas "gemini-..."
  let normalized = m.startsWith('models/') ? m.slice('models/'.length) : m;

  // Mapear modelos inválidos para válidos
  if (normalized === 'gemini-1.5-flash-latest') {
    normalized = 'gemini-3.0-flash';
  } else if (normalized === 'gemini-2.0-flash') {
    normalized = 'gemini-3.0-flash';
  } else if (normalized.endsWith('-latest')) {
    // Remover sufixo -latest de outros modelos (não existe)
    normalized = normalized.replace(/-latest$/, '');
  }

  return normalized;
}

/**
 * Retorna lista de modelos válidos para uma versão específica da API.
 * Cada versão da API tem modelos diferentes disponíveis.
 */
function getValidModelsForVersion(apiVersion: GeminiApiVersion): string[] {
  if (apiVersion === 'v1beta') {
    // v1beta: todos os modelos disponíveis, incluindo preview e modelos mais antigos
    return [
      'gemini-3.0-flash',
      'gemini-3.0-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-3-flash-preview', // Modelo preview disponível
      'gemini-pro', // Modelo mais antigo (pode estar disponível em algumas contas)
    ];
  } else {
    // v1: gemini-1.5-pro NÃO está disponível, mas gemini-pro pode estar
    return [
      'gemini-3.0-flash',
      'gemini-3.0-pro',
      'gemini-1.5-flash',
      'gemini-pro', // Modelo mais antigo (pode estar disponível em algumas contas)
      // gemini-1.5-pro não está disponível em v1
      // gemini-3-flash-preview pode não estar disponível em v1
    ];
  }
}

/**
 * Retorna a ordem de fallback de modelos para uma versão específica.
 * Filtra apenas modelos que estão disponíveis na versão especificada.
 */
function getFallbackOrderForVersion(startModel: string, apiVersion: GeminiApiVersion): string[] {
  const validModels = getValidModelsForVersion(apiVersion);
  const normalizedStart = normalizeGeminiModel(startModel);

  // Ordem de prioridade padrão (modelos mais novos primeiro, depois mais antigos)
  const priorityOrder = [
    'gemini-3.0-flash',
    'gemini-3.0-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-3-flash-preview',
    'gemini-pro', // Fallback final para modelos mais antigos
  ];

  // Filtrar apenas modelos válidos para esta versão
  const validPriorityOrder = priorityOrder.filter((m) => validModels.includes(m));

  // Encontrar índice do modelo inicial na ordem de prioridade
  const startIndex = validPriorityOrder.findIndex(
    (m) => normalizeGeminiModel(m) === normalizedStart
  );

  if (startIndex === -1) {
    // Modelo não encontrado na ordem, retornar ordem padrão filtrada
    return validPriorityOrder;
  }

  // Retornar modelos a partir do modelo inicial
  return validPriorityOrder.slice(startIndex);
}

function buildGenerateContentUrl(opts: {
  apiVersion: GeminiApiVersion;
  model: string;
  apiKey: string;
}): string {
  const { apiVersion, model, apiKey } = opts;
  return `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
    normalizeGeminiModel(model)
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function callGeminiOnce(opts: {
  prompt: string;
  apiKey: string;
  apiVersion: GeminiApiVersion;
  model: string;
}): Promise<string> {
  const url = buildGenerateContentUrl(opts);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: 0.25, // Ajustado para análises mais consistentes (menos conservador que 0.3, mais preciso)
        topP: 0.9,
        maxOutputTokens: 3000, // Aumentado para permitir análises mais completas e detalhadas
      },
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
    const retryAfter = Number.isFinite(retryAfterSeconds as number)
      ? (retryAfterSeconds as number)
      : null;
    let message = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      const msg: unknown = parsed?.error?.message;
      if (typeof msg === 'string' && msg.trim().length > 0) message = msg.trim();
    } catch {
      // keep raw
    }
    throw new GeminiCallError({
      status: res.status,
      raw,
      retryAfterSeconds: retryAfter,
      apiVersion: opts.apiVersion,
      model: opts.model,
      message: `Falha ao chamar Gemini (${res.status}). ${message}`.trim(),
    });
  }

  const json = (await res.json()) as Record<string, unknown>;
  const text: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  // Validação robusta da resposta
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Resposta inválida do Gemini (sem texto).');
  }

  const trimmedText = text.trim();

  // Validação de tamanho mínimo (análises muito curtas podem estar incompletas)
  const minLength = 200; // Mínimo de 200 caracteres para uma análise útil
  if (trimmedText.length < minLength) {
    throw new Error(
      `Resposta do Gemini muito curta (${trimmedText.length} caracteres). Análise pode estar incompleta.`
    );
  }

  // Validação básica de estrutura (deve conter pelo menos uma seção com ##)
  if (!trimmedText.includes('##')) {
    throw new Error('Resposta do Gemini não segue o formato esperado (sem seções markdown).');
  }

  return trimmedText;
}

function isModelNotFoundError(err: unknown): err is GeminiCallError {
  return (
    err instanceof GeminiCallError &&
    err.status === 404 &&
    (/not found|NOT_FOUND|models\/|not supported|is not found/i.test(err.message) ||
      err.message.includes('is not found for API version') ||
      err.message.includes('is not supported for generateContent'))
  );
}

export type GeminiErrorKind =
  | 'quota_exceeded'
  | 'rate_limited'
  | 'invalid_key'
  | 'forbidden'
  | 'bad_request'
  | 'server_error'
  | 'unknown';

export type GeminiFriendlyError = {
  kind: GeminiErrorKind;
  title: string;
  message: string;
  retryAfterSeconds?: number;
};

function isQuotaExceededMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('exceeded your current quota') ||
    m.includes('quota exceeded') ||
    m.includes('limit: 0') ||
    m.includes('billing') ||
    m.includes('check your plan') ||
    m.includes('ai.dev/usage') ||
    m.includes('rate-limits')
  );
}

export function toGeminiFriendlyError(err: unknown): GeminiFriendlyError | null {
  if (!(err instanceof GeminiCallError)) return null;

  const base = {
    retryAfterSeconds: err.retryAfterSeconds ?? undefined,
  };

  if (err.status === 404) {
    // Verificar se é erro de modelo não encontrado
    if (isModelNotFoundError(err)) {
      return {
        kind: 'unknown',
        title: 'Modelo Gemini não disponível (404)',
        message:
          'Nenhum modelo Gemini está disponível com esta API key. ' +
          'Possíveis causas:\n' +
          '• A API key não tem acesso aos modelos - Verifique no Google AI Studio (https://aistudio.google.com/app/apikey)\n' +
          '• Os modelos podem não estar disponíveis na sua região\n' +
          '• A API key pode estar inválida ou expirada\n' +
          '• Pode ser necessário habilitar a API do Gemini no Google Cloud Console\n\n' +
          'O sistema usará análise local (fallback) até que a API key seja configurada corretamente.',
        ...base,
      };
    }
    return {
      kind: 'unknown',
      title: 'Recurso não encontrado (404)',
      message:
        'O recurso solicitado não foi encontrado. Verifique a configuração da API key e do modelo.',
      ...base,
    };
  }

  if (err.status === 429) {
    if (isQuotaExceededMessage(err.message)) {
      return {
        kind: 'quota_exceeded',
        title: 'Gemini indisponível (quota excedida)',
        message:
          'Sua chave atingiu o limite/quotas do Gemini (ou o plano atual não permite requisições). Verifique billing/planos no Google AI Studio e tente novamente depois.',
        ...base,
      };
    }
    return {
      kind: 'rate_limited',
      title: 'Gemini temporariamente limitado (429)',
      message:
        'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente. Se persistir, revise limites e billing do projeto no Google AI Studio.',
      ...base,
    };
  }

  if (err.status === 401) {
    return {
      kind: 'invalid_key',
      title: 'Gemini não autorizado (401)',
      message:
        'A chave do Gemini parece inválida/expirada. Confirme `VITE_GEMINI_API_KEY` no ambiente e se a API está habilitada no projeto.',
      ...base,
    };
  }

  if (err.status === 403) {
    return {
      kind: 'forbidden',
      title: 'Gemini bloqueado (403)',
      message:
        'Acesso negado (projeto sem permissão, billing ausente ou restrição de API). Verifique o billing e as permissões/chave no Google AI Studio.',
      ...base,
    };
  }

  if (err.status === 400) {
    return {
      kind: 'bad_request',
      title: 'Requisição inválida ao Gemini (400)',
      message:
        'O Gemini rejeitou a requisição. Tente novamente; se persistir, revise o payload/modelo configurado.',
      ...base,
    };
  }

  if (err.status >= 500) {
    return {
      kind: 'server_error',
      title: `Gemini instável (${err.status})`,
      message: 'O serviço do Gemini parece instável no momento. Tente novamente em instantes.',
      ...base,
    };
  }

  return {
    kind: 'unknown',
    title: `Falha ao chamar Gemini (${err.status})`,
    message: err.message || 'Erro desconhecido ao chamar o Gemini.',
    ...base,
  };
}

function uniqueAttempts(attempts: Array<{ apiVersion: GeminiApiVersion; model: string }>) {
  const seen = new Set<string>();
  return attempts.filter((a) => {
    const key = `${a.apiVersion}:${normalizeGeminiModel(a.model)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateGeminiContent(prompt: string, apiKey: string): Promise<string> {
  const { apiVersion, model } = getGeminiSettings();

  // Priorizar v1 primeiro (mais estável), depois v1beta
  // Isso ajuda quando a API key não tem acesso a modelos mais novos
  const primaryVersion: GeminiApiVersion = 'v1';
  const secondaryVersion: GeminiApiVersion = apiVersion === 'v1beta' ? 'v1beta' : 'v1';

  // Obter modelos válidos para cada versão
  const primaryVersionModels = getFallbackOrderForVersion(model, primaryVersion);
  const secondaryVersionModels = getFallbackOrderForVersion(model, secondaryVersion);

  // Construir lista de tentativas: primeiro v1 (estável), depois versão configurada
  const attempts: Array<{ apiVersion: GeminiApiVersion; model: string }> = [];

  // 1. Primeiro tentar com v1 (versão mais estável)
  for (const m of primaryVersionModels) {
    attempts.push({ apiVersion: primaryVersion, model: m });
  }

  // 2. Se todos falharem na v1, tentar versão alternativa (v1beta se configurado)
  if (secondaryVersion !== primaryVersion) {
    for (const m of secondaryVersionModels) {
      attempts.push({ apiVersion: secondaryVersion, model: m });
    }
  }

  const uniqueAttemptsList = uniqueAttempts(attempts);

  let lastErr: unknown = null;
  let attemptedModels: string[] = [];

  for (const a of uniqueAttemptsList) {
    attemptedModels.push(`${a.apiVersion}/${a.model}`);
    try {
      return await callGeminiOnce({ prompt, apiKey, apiVersion: a.apiVersion, model: a.model });
    } catch (err) {
      lastErr = err;
      // Só tenta fallback automático se for claramente "modelo não encontrado".
      if (!isModelNotFoundError(err)) throw err;
    }
  }

  // Se todos os modelos falharam com 404, fornecer mensagem mais útil
  if (lastErr instanceof GeminiCallError && lastErr.status === 404) {
    const errorMsg =
      `Nenhum modelo Gemini disponível. Tentados: ${attemptedModels.join(', ')}. ` +
      `\n\nPossíveis causas:` +
      `\n1. A API key não tem acesso aos modelos - Verifique no Google AI Studio (https://aistudio.google.com/app/apikey)` +
      `\n2. Os modelos podem não estar disponíveis na sua região` +
      `\n3. A API key pode estar inválida ou expirada` +
      `\n4. Pode ser necessário habilitar a API do Gemini no Google Cloud Console` +
      `\n\nSolução: O sistema usará análise local (fallback) até que a API key seja configurada corretamente.`;
    throw new Error(errorMsg);
  }

  throw lastErr instanceof Error ? lastErr : new Error('Falha ao chamar Gemini.');
}
