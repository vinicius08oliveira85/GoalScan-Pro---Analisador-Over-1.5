type GeminiApiVersion = 'v1' | 'v1beta';

type GeminiSettings = {
  apiKey: string | null;
  apiVersion: GeminiApiVersion;
  model: string;
};

class GeminiCallError extends Error {
  status: number;
  raw: string;
  apiVersion: GeminiApiVersion;
  model: string;

  constructor(opts: { status: number; raw: string; apiVersion: GeminiApiVersion; model: string; message: string }) {
    super(opts.message);
    this.name = 'GeminiCallError';
    this.status = opts.status;
    this.raw = opts.raw;
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

