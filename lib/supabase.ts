import { logger } from '../utils/logger';
import {
  isServiceUnavailable,
  setServiceUnavailable,
  SERVICE_STATUS_CACHE_DURATION,
} from '../utils/serviceStatus';
import type { SupabaseClient } from '@supabase/supabase-js';

// Configuração do cliente Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Importação dinâmica do Supabase
let supabaseClient: SupabaseClient | null = null;
let supabaseModule: typeof import('@supabase/supabase-js') | null = null;
let initializationPromise: Promise<SupabaseClient> | null = null;

// Flag para garantir que o interceptor seja configurado apenas uma vez
let fetchInterceptorSetup = false;

/**
 * Intercepta fetch globalmente: retorna 503 sintético para requisições ao Supabase
 * quando o serviço está marcado como indisponível (circuit-breaker).
 *
 * APENAS intercepta requests ao Supabase; todas as outras passam direto.
 */
function setupFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  if (fetchInterceptorSetup) return;
  fetchInterceptorSetup = true;

  const originalFetch = window.fetch;

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

    try {
      const response = await originalFetch(input, init);

      if (isSupabaseRequest && response.status === 503) {
        setServiceUnavailable();
      }

      return response;
    } catch (error) {
      if (isSupabaseRequest) {
        setServiceUnavailable();
      }
      throw error;
    }
  };
}

// Configurar interceptor IMEDIATAMENTE quando o módulo é carregado
if (typeof window !== 'undefined') {
  setupFetchInterceptor();
}

export const getSupabaseClient = async () => {
  if (supabaseClient) return supabaseClient;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    logger.log('[Supabase] Inicializando cliente...');

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
        errorMessage += '💡 As variáveis precisam começar com VITE_ para serem expostas ao cliente.';
      } else {
        errorMessage += 'CONFIGURAÇÃO LOCAL:\n';
        errorMessage += '1. Crie um arquivo .env na raiz do projeto\n';
        errorMessage += '2. Adicione as seguintes variáveis:\n';
        errorMessage += '   VITE_SUPABASE_URL=https://seu-projeto.supabase.co\n';
        errorMessage += '   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui\n';
        errorMessage += '3. Reinicie o servidor de desenvolvimento (npm run dev)';
      }

      throw new Error(errorMessage);
    }

    try {
      new URL(SUPABASE_URL);
    } catch {
      throw new Error(
        `URL do Supabase inválida: ${SUPABASE_URL}. ` +
          'A URL deve estar no formato: https://seu-projeto.supabase.co'
      );
    }

    if (SUPABASE_ANON_KEY.length < 20) {
      throw new Error(
        'Chave anônima do Supabase parece inválida (muito curta). ' +
          'Verifique se VITE_SUPABASE_ANON_KEY está correta e completa.'
      );
    }

    try {
      if (!supabaseModule) {
        supabaseModule = await import('@supabase/supabase-js');
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
            'x-client-info': 'goalscan-pro@3.8.3',
          },
        },
      });

      const client = supabaseClient;
      initializationPromise = null;
      return client;
    } catch (error: unknown) {
      initializationPromise = null;
      throw new Error(
        `Erro ao inicializar cliente Supabase: ${error instanceof Error ? error.message : 'Erro desconhecido'}. ` +
          'Verifique se o módulo @supabase/supabase-js está instalado (npm install @supabase/supabase-js)'
      );
    }
  })();

  return initializationPromise;
};
