import { logger } from '../utils/logger';
import { isServiceUnavailable } from '../utils/serviceStatus';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;
let supabaseModule: typeof import('@supabase/supabase-js') | null = null;
let initializationPromise: Promise<SupabaseClient> | null = null;

let fetchInterceptorSetup = false;

function setupFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  if (fetchInterceptorSetup) return;
  fetchInterceptorSetup = true;

  const origFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isSupabaseRequest = url.includes('supabase.co');

    if (isSupabaseRequest && isServiceUnavailable()) {
      return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return origFetch(input, init);
  };
}

function setupErrorSuppression(): void {
  if (typeof window === 'undefined') return;

  const origError = console.error;
  const origWarn = console.warn;
  const origLog = console.log;

  const shouldSuppress = (message: string): boolean => {
    const m = message.toLowerCase();
    const isSupabase =
      m.includes('supabase.co') &&
      (m.includes('400') || m.includes('409') || m.includes('bad request') || m.includes('conflict')) &&
      (m.includes('championships') || m.includes('championship_tables'));
    const isGemini404 =
      (m.includes('404') || m.includes('not found') || m.includes('failed to load resource')) &&
      (m.includes('generativelanguage.googleapis.com') || m.includes('gemini'));
    return isSupabase || isGemini404;
  };

  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args.join(' '))) return;
    origError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args.join(' '))) return;
    origWarn.apply(console, args);
  };

  console.log = (...args: unknown[]) => {
    if (shouldSuppress(args.join(' '))) return;
    origLog.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    const msg = (event.message || '').toLowerCase();
    const src = (event.filename || event.target?.toString() || '').toLowerCase();
    const isSupabaseErr =
      (msg.includes('400') || msg.includes('409')) &&
      (src.includes('supabase.co') || msg.includes('supabase.co')) &&
      (src.includes('championships') || msg.includes('championships') ||
        src.includes('championship_tables') || msg.includes('championship_tables'));
    const isGeminiErr =
      (msg.includes('404') || msg.includes('failed to load') || msg.includes('not found')) &&
      (src.includes('generativelanguage.googleapis.com') || msg.includes('gemini'));
    if (isSupabaseErr || isGeminiErr) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event.reason || '').toLowerCase();
    const isSupabaseRejection =
      (reason.includes('400') || reason.includes('409')) &&
      reason.includes('supabase.co') &&
      (reason.includes('championships') || reason.includes('championship_tables'));
    const isGeminiRejection =
      (reason.includes('404') || reason.includes('failed to fetch') || reason.includes('not found')) &&
      (reason.includes('generativelanguage.googleapis.com') || reason.includes('gemini'));
    if (isSupabaseRejection || isGeminiRejection) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
}

if (typeof window !== 'undefined') {
  setupFetchInterceptor();
  setupErrorSuppression();
}

export const getSupabaseClient = async () => {
  if (supabaseClient) return supabaseClient;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    logger.log('[Supabase] Inicializando cliente...');
    logger.log(
      '[Supabase] VITE_SUPABASE_URL:',
      SUPABASE_URL ? `${SUPABASE_URL.substring(0, 20)}...` : 'NÃO CONFIGURADO'
    );
    logger.log(
      '[Supabase] VITE_SUPABASE_ANON_KEY:',
      SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 10)}...` : 'NÃO CONFIGURADO'
    );

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missingVars: string[] = [];
      if (!SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
      if (!SUPABASE_ANON_KEY) missingVars.push('VITE_SUPABASE_ANON_KEY');

      const isProduction =
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('vercel.com') ||
        import.meta.env.PROD;

      let errorMessage = `Variáveis de ambiente do Supabase não configuradas: ${missingVars.join(', ')}.\n\n`;

      if (isProduction) {
        errorMessage += 'CONFIGURAÇÃO NO VERCEL:\n';
        errorMessage += '1. Acesse: https://vercel.com/dashboard\n';
        errorMessage += '2. Selecione seu projeto\n';
        errorMessage += '3. Vá em Settings > Environment Variables\n';
        errorMessage += '4. Adicione as seguintes variáveis:\n';
        errorMessage += '   - VITE_SUPABASE_URL = https://seu-projeto.supabase.co\n';
        errorMessage += '   - VITE_SUPABASE_ANON_KEY = sua_chave_anonima_aqui\n';
        errorMessage += '5. Faça um novo deploy (ou aguarde o redeploy automático)\n\n';
        errorMessage += 'As variáveis precisam começar com VITE_ para serem expostas ao cliente.';
      } else {
        errorMessage += 'CONFIGURAÇÃO LOCAL:\n';
        errorMessage += '1. Crie um arquivo .env na raiz do projeto\n';
        errorMessage += '2. Adicione as seguintes variáveis:\n';
        errorMessage += '   VITE_SUPABASE_URL=https://seu-projeto.supabase.co\n';
        errorMessage += '   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui\n';
        errorMessage += '3. Reinicie o servidor de desenvolvimento (npm run dev)';
      }

      const error = new Error(errorMessage);
      logger.error('[Supabase] Erro de configuração:', error.message);
      throw error;
    }

    try {
      new URL(SUPABASE_URL);
      logger.log('[Supabase] URL válida');
    } catch {
      const error = new Error(
        `URL do Supabase inválida: ${SUPABASE_URL}. A URL deve estar no formato: https://seu-projeto.supabase.co`
      );
      logger.error('[Supabase] Erro de validação:', error.message);
      throw error;
    }

    if (SUPABASE_ANON_KEY.length < 20) {
      const error = new Error(
        'Chave anônima do Supabase parece inválida (muito curta). Verifique se VITE_SUPABASE_ANON_KEY está correta.'
      );
      throw error;
    }

    const isValidFormat =
      SUPABASE_ANON_KEY.startsWith('sb_') ||
      SUPABASE_ANON_KEY.startsWith('eyJ') ||
      SUPABASE_ANON_KEY.length >= 50;

    if (!isValidFormat && SUPABASE_ANON_KEY.length < 50) {
      logger.warn(
        '[Supabase] Chave anônima pode estar incompleta. Verifique se copiou a chave completa.'
      );
    }

    try {
      logger.log('[Supabase] Carregando módulo @supabase/supabase-js...');
      if (!supabaseModule) {
        supabaseModule = await import('@supabase/supabase-js');
        logger.log('[Supabase] Módulo carregado com sucesso');
      }

      if (typeof window !== 'undefined' && !fetchInterceptorSetup) {
        setupFetchInterceptor();
      }

      supabaseClient = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          storageKey: 'sb-auth-token',
        },
        global: {
          headers: {
            'x-client-info': 'goalscan-pro@1.0.0',
          },
        },
      });
      logger.log('[Supabase] Cliente inicializado com sucesso');

      const client = supabaseClient;
      initializationPromise = null;
      return client;
    } catch (error: unknown) {
      initializationPromise = null;

      logger.error('[Supabase] Erro ao inicializar cliente Supabase:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });

      const detailedError = new Error(
        `Erro ao inicializar cliente Supabase: ${error instanceof Error ? error.message : String(error)}. ` +
          'Verifique se o módulo @supabase/supabase-js está instalado (npm install @supabase/supabase-js)'
      );
      throw detailedError;
    }
  })();

  return initializationPromise;
};
