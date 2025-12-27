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
    'gemini-1.5-flash-latest';
  const model = normalizeGeminiModel(modelRaw);

  return { apiKey, apiVersion, model };
}

function normalizeGeminiModel(model: string): string {
  const m = (model || '').trim();
  if (!m) return 'gemini-1.5-flash-latest';
  // Aceita "models/gemini-..." mas normaliza para apenas "gemini-..."
  return m.startsWith('models/') ? m.slice('models/'.length) : m;
}

function addLatestSuffixIfMissing(model: string): string {
  const m = normalizeGeminiModel(model);
  if (m.endsWith('-latest')) return m;
  // Alguns modelos existem em variantes com "-latest"; tentar isso costuma resolver 404.
  if (m.startsWith('gemini-') && !m.includes('-0')) return `${m}-latest`;
  return `${m}-latest`;
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
    /not found|NOT_FOUND|models\//i.test(err.message)
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

  const attempts = uniqueAttempts([
    { apiVersion, model },
    // Fallback 1: v1beta + "-latest" (resolve a maioria dos 404 de modelo)
    { apiVersion: 'v1beta', model: addLatestSuffixIfMissing(model) },
    // Fallback 2: modelo flash mais novo (quando 1.5-flash não existe na conta/região/API)
    { apiVersion: 'v1beta', model: 'gemini-2.0-flash' }
  ]);

  let lastErr: unknown = null;
  for (const a of attempts) {
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

