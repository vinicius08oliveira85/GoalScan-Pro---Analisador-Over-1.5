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
  const viteEnv = (import.meta as any)?.env ?? {};

  // Preferência: `VITE_*` (padrão Vite), mas aceita compat via `process.env.*` (injetado no build).
  const apiKey =
    normalizeEnvValue(viteEnv.VITE_GEMINI_API_KEY) ||
    normalizeEnvValue((process.env as any)?.VITE_GEMINI_API_KEY) ||
    normalizeEnvValue((process.env as any)?.GEMINI_API_KEY) ||
    normalizeEnvValue((process.env as any)?.API_KEY) ||
    null;

  const apiVersionRaw = (normalizeEnvValue(viteEnv.VITE_GEMINI_API_VERSION) ||
    normalizeEnvValue((process.env as any)?.VITE_GEMINI_API_VERSION) ||
    normalizeEnvValue((process.env as any)?.GEMINI_API_VERSION) ||
    'v1beta')
    .toLowerCase();
  const apiVersion: GeminiApiVersion = apiVersionRaw === 'v1' ? 'v1' : 'v1beta';

  const modelRaw =
    normalizeEnvValue(viteEnv.VITE_GEMINI_MODEL) ||
    normalizeEnvValue((process.env as any)?.VITE_GEMINI_MODEL) ||
    normalizeEnvValue((process.env as any)?.GEMINI_MODEL) ||
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
    // v1beta: todos os modelos disponíveis, incluindo preview
    return [
      'gemini-3.0-flash',
      'gemini-3.0-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-3-flash-preview' // Modelo preview disponível
    ];
  } else {
    // v1: gemini-1.5-pro NÃO está disponível
    return [
      'gemini-3.0-flash',
      'gemini-3.0-pro',
      'gemini-1.5-flash'
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
  
  // Ordem de prioridade padrão
  const priorityOrder = [
    'gemini-3.0-flash',
    'gemini-3.0-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-3-flash-preview'
  ];
  
  // Filtrar apenas modelos válidos para esta versão
  const validPriorityOrder = priorityOrder.filter(m => validModels.includes(m));
  
  // Encontrar índice do modelo inicial na ordem de prioridade
  const startIndex = validPriorityOrder.findIndex(m => normalizeGeminiModel(m) === normalizedStart);
  
  if (startIndex === -1) {
    // Modelo não encontrado na ordem, retornar ordem padrão filtrada
    return validPriorityOrder;
  }
  
  // Retornar modelos a partir do modelo inicial
  return validPriorityOrder.slice(startIndex);
}

function getFallbackModel(model: string): string | null {
  const m = normalizeGeminiModel(model);
  // Chain de fallback: 3.0-flash → 3.0-pro → 1.5-flash → 1.5-pro → 3-flash-preview
  // Retorna null quando não há mais fallbacks disponíveis
  // Nota: Esta função é mantida para compatibilidade, mas getFallbackOrderForVersion
  // é preferida pois considera modelos válidos por versão da API
  if (m === 'gemini-3.0-flash') {
    return 'gemini-3.0-pro';
  }
  if (m === 'gemini-3.0-pro') {
    return 'gemini-1.5-flash';
  }
  if (m === 'gemini-1.5-flash') {
    return 'gemini-1.5-pro';
  }
  if (m === 'gemini-1.5-pro') {
    return 'gemini-3-flash-preview'; // Último fallback antes de null
  }
  if (m === 'gemini-3-flash-preview') {
    return null; // Fim da cadeia de fallback
  }
  // Caso padrão: usar gemini-3.0-flash
  return 'gemini-3.0-flash';
}

function buildGenerateContentUrl(opts: { apiVersion: GeminiApiVersion; model: string; apiKey: string }): string {
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
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 900
      }
    })
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
    const retryAfter = Number.isFinite(retryAfterSeconds as number) ? (retryAfterSeconds as number) : null;
    let message = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as any) : null;
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
      message: `Falha ao chamar Gemini (${res.status}). ${message}`.trim()
    });
  }

  const json = (await res.json()) as any;
  const text: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Resposta inválida do Gemini (sem texto).');
  }
  return text.trim();
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
    retryAfterSeconds: err.retryAfterSeconds ?? undefined
  };

  if (err.status === 429) {
    if (isQuotaExceededMessage(err.message)) {
      return {
        kind: 'quota_exceeded',
        title: 'Gemini indisponível (quota excedida)',
        message:
          'Sua chave atingiu o limite/quotas do Gemini (ou o plano atual não permite requisições). Verifique billing/planos no Google AI Studio e tente novamente depois.',
        ...base
      };
    }
    return {
      kind: 'rate_limited',
      title: 'Gemini temporariamente limitado (429)',
      message:
        'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente. Se persistir, revise limites e billing do projeto no Google AI Studio.',
      ...base
    };
  }

  if (err.status === 401) {
    return {
      kind: 'invalid_key',
      title: 'Gemini não autorizado (401)',
      message:
        'A chave do Gemini parece inválida/expirada. Confirme `VITE_GEMINI_API_KEY` no ambiente e se a API está habilitada no projeto.',
      ...base
    };
  }

  if (err.status === 403) {
    return {
      kind: 'forbidden',
      title: 'Gemini bloqueado (403)',
      message:
        'Acesso negado (projeto sem permissão, billing ausente ou restrição de API). Verifique o billing e as permissões/chave no Google AI Studio.',
      ...base
    };
  }

  if (err.status === 400) {
    return {
      kind: 'bad_request',
      title: 'Requisição inválida ao Gemini (400)',
      message: 'O Gemini rejeitou a requisição. Tente novamente; se persistir, revise o payload/modelo configurado.',
      ...base
    };
  }

  if (err.status >= 500) {
    return {
      kind: 'server_error',
      title: `Gemini instável (${err.status})`,
      message: 'O serviço do Gemini parece instável no momento. Tente novamente em instantes.',
      ...base
    };
  }

  return {
    kind: 'unknown',
    title: `Falha ao chamar Gemini (${err.status})`,
    message: err.message || 'Erro desconhecido ao chamar o Gemini.',
    ...base
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

  // Obter modelos válidos para a versão configurada
  const configuredVersionModels = getFallbackOrderForVersion(model, apiVersion);
  
  // Obter versão alternativa para fallback
  const fallbackVersion: GeminiApiVersion = apiVersion === 'v1beta' ? 'v1' : 'v1beta';
  const fallbackVersionModels = getFallbackOrderForVersion(model, fallbackVersion);

  // Construir lista de tentativas: primeiro versão configurada, depois fallback
  const attempts: Array<{ apiVersion: GeminiApiVersion; model: string }> = [];
  
  // 1. Primeiro tentar com a versão configurada (usando apenas modelos válidos para essa versão)
  for (const m of configuredVersionModels) {
    attempts.push({ apiVersion, model: m });
  }
  
  // 2. Se todos falharem na versão configurada, tentar versão alternativa (usando apenas modelos válidos para essa versão)
  for (const m of fallbackVersionModels) {
    attempts.push({ apiVersion: fallbackVersion, model: m });
  }

  const uniqueAttemptsList = uniqueAttempts(attempts);

  let lastErr: unknown = null;
  for (const a of uniqueAttemptsList) {
    try {
      return await callGeminiOnce({ prompt, apiKey, apiVersion: a.apiVersion, model: a.model });
    } catch (err) {
      lastErr = err;
      // Só tenta fallback automático se for claramente "modelo não encontrado".
      if (!isModelNotFoundError(err)) throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Falha ao chamar Gemini.');
}

