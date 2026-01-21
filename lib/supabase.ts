import { logger } from '../utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

// Configuração do cliente Supabase
// Credenciais carregadas de variáveis de ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Importação dinâmica do Supabase (via importmap no HTML)
let supabaseClient: SupabaseClient | null = null;
let supabaseModule: typeof import('@supabase/supabase-js') | null = null;
// Promise compartilhada para evitar race conditions
let initializationPromise: Promise<SupabaseClient> | null = null;

// Cache de status do serviço (compartilhado com championshipService)
const STORAGE_KEY_SERVICE_STATUS = 'goalscan_supabase_status';
const SERVICE_STATUS_CACHE_DURATION = 60000; // 1 minuto

// Flag para garantir que o interceptor seja configurado apenas uma vez
let fetchInterceptorSetup = false;

interface ServiceStatus {
  isUnavailable: boolean;
  lastCheck: number;
  retryAfter: number;
}

/**
 * Verifica se o serviço Supabase está marcado como indisponível
 */
function isServiceUnavailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    
    const stored = localStorage.getItem(STORAGE_KEY_SERVICE_STATUS);
    if (!stored) return false;
    
    const status = JSON.parse(stored) as ServiceStatus;
    const now = Date.now();
    
    // Verificar se o cache ainda é válido e se o serviço está indisponível
    if (status.isUnavailable && now < status.retryAfter && (now - status.lastCheck) < SERVICE_STATUS_CACHE_DURATION) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Intercepta requisições fetch para Supabase quando o serviço está indisponível
 * Isso previne requisições desnecessárias e erros 503 no console
 * IMPORTANTE: Esta função deve ser chamada ANTES de qualquer requisição ao Supabase
 */
function setupFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  
  // Garantir que o interceptor seja configurado apenas uma vez
  if (fetchInterceptorSetup) return;
  fetchInterceptorSetup = true;
  
  // Interceptar fetch globalmente para requisições ao Supabase
  const originalFetch = window.fetch;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Verificar se é uma requisição ao Supabase
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isSupabaseRequest = url.includes('supabase.co');
    const isGeminiRequest = url.includes('generativelanguage.googleapis.com');
    
    // Se for requisição ao Supabase e o serviço está indisponível, retornar resposta 503 silenciosamente
    if (isSupabaseRequest && isServiceUnavailable()) {
      // Retornar uma resposta 503 sem fazer a requisição real
      // Isso previne erros no console e requisições desnecessárias
      return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Para outras requisições ou quando serviço está disponível, fazer requisição normal
    try {
      const response = await originalFetch(input, init);
      
      // Se a resposta for 503 do Supabase, marcar serviço como indisponível
      if (isSupabaseRequest && response.status === 503) {
        const retryAfter = Date.now() + SERVICE_STATUS_CACHE_DURATION;
        try {
          if (window.localStorage) {
            const status: ServiceStatus = {
              isUnavailable: true,
              lastCheck: Date.now(),
              retryAfter,
            };
            localStorage.setItem(STORAGE_KEY_SERVICE_STATUS, JSON.stringify(status));
          }
        } catch {
          // Ignorar erros de localStorage
        }
      }
      
      // Para requisições ao Gemini, 404 são esperados (fallback de modelos)
      // O sistema de fallback tratará esses erros silenciosamente
      // Os logs do console serão suprimidos pelo setupGeminiErrorSuppression
      
      return response;
    } catch (error) {
      // Se for erro de rede em requisição ao Supabase, marcar como indisponível
      if (isSupabaseRequest) {
        const retryAfter = Date.now() + SERVICE_STATUS_CACHE_DURATION;
        try {
          if (window.localStorage) {
            const status: ServiceStatus = {
              isUnavailable: true,
              lastCheck: Date.now(),
              retryAfter,
            };
            localStorage.setItem(STORAGE_KEY_SERVICE_STATUS, JSON.stringify(status));
          }
        } catch {
          // Ignorar erros de localStorage
        }
      }
      
      throw error;
    }
  };
}

// Interceptor para suprimir erros 400 e 409 esperados do Supabase no console
// quando já estão sendo tratados pelo código
function setupSupabaseErrorSuppression(): void {
  if (typeof window === 'undefined') return;
  
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Interceptar console.error
  console.error = (...args: unknown[]) => {
    const message = args.join(' ');
    
    // Suprimir erros 400 e 409 do Supabase que já estão sendo tratados
    if (
      message.includes('supabase.co') &&
      (message.includes('400') || message.includes('409')) &&
      (message.includes('championships') || message.includes('championship_tables'))
    ) {
      // Não logar - erro já está sendo tratado
      return;
    }
    
    originalConsoleError.apply(console, args);
  };
  
  // Interceptar console.warn
  console.warn = (...args: unknown[]) => {
    const message = args.join(' ');
    
    // Suprimir warnings 400 e 409 do Supabase que já estão sendo tratados
    if (
      message.includes('supabase.co') &&
      (message.includes('400') || message.includes('409')) &&
      (message.includes('championships') || message.includes('championship_tables'))
    ) {
      // Não logar - erro já está sendo tratado
      return;
    }
    
    originalConsoleWarn.apply(console, args);
  };
}

// Interceptor para suprimir erros 404 esperados da API do Gemini no console
function setupGeminiErrorSuppression(): void {
  if (typeof window === 'undefined') return;
  
  // Interceptar console.error para suprimir erros 404 do Gemini
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = String(args.join(' ')).toLowerCase();
    // Suprimir erros 404 da API do Gemini (são esperados durante fallback de modelos)
    if (
      (message.includes('404') || 
       message.includes('not found') || 
       message.includes('failed to load resource')) &&
      (message.includes('generativelanguage.googleapis.com') ||
       message.includes('gemini'))
    ) {
      // Não logar no console - erro esperado durante fallback
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  // Interceptar console.warn também (alguns navegadores logam 404 como warning)
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = String(args.join(' ')).toLowerCase();
    if (
      (message.includes('404') || 
       message.includes('not found') || 
       message.includes('failed to load resource')) &&
      (message.includes('generativelanguage.googleapis.com') ||
       message.includes('gemini'))
    ) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
  
  // Interceptar console.log também (caso algum código logue erros 404)
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    const message = String(args.join(' ')).toLowerCase();
    if (
      (message.includes('404') || 
       message.includes('not found') || 
       message.includes('failed to load resource') ||
       message.includes('post') && message.includes('generativelanguage')) &&
      (message.includes('generativelanguage.googleapis.com') ||
       message.includes('gemini'))
    ) {
      return;
    }
    originalConsoleLog.apply(console, args);
  };
  
  // Interceptar eventos de erro não capturados relacionados ao Gemini
  window.addEventListener('error', (event) => {
    const message = (event.message || '').toLowerCase();
    const source = (event.filename || event.target?.toString() || '').toLowerCase();
    
    // Suprimir erros 404 da API do Gemini (são esperados durante fallback de modelos)
    if (
      (message.includes('404') || 
       message.includes('failed to load') || 
       message.includes('not found')) &&
      (source.includes('generativelanguage.googleapis.com') || 
       message.includes('generativelanguage.googleapis.com') ||
       source.includes('gemini') ||
       message.includes('gemini'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);
  
  // Interceptar promessas rejeitadas não tratadas relacionadas ao Gemini
  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event.reason || '').toLowerCase();
    
    // Suprimir rejeições 404 da API do Gemini
    if (
      (reason.includes('404') || 
       reason.includes('failed to fetch') || 
       reason.includes('not found')) &&
      (reason.includes('generativelanguage.googleapis.com') ||
       reason.includes('gemini'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
}

// Configurar interceptor IMEDIATAMENTE quando o módulo é carregado
// Isso garante que o interceptor esteja ativo antes de qualquer requisição
if (typeof window !== 'undefined') {
  setupFetchInterceptor();
  setupSupabaseErrorSuppression();
  setupGeminiErrorSuppression();
}

export const getSupabaseClient = async () => {
  // Se já existe cliente, retornar imediatamente
  if (supabaseClient) {
    return supabaseClient;
  }

  // Se já existe uma inicialização em andamento, aguardar ela
  if (initializationPromise) {
    return initializationPromise;
  }

  // Criar nova Promise de inicialização
  initializationPromise = (async () => {
    logger.log('[Supabase] Inicializando cliente...');
    logger.log('[Supabase] Verificando variáveis de ambiente...');
    logger.log(
      '[Supabase] VITE_SUPABASE_URL:',
      SUPABASE_URL ? `${SUPABASE_URL.substring(0, 20)}...` : 'NÃO CONFIGURADO'
    );
    logger.log(
      '[Supabase] VITE_SUPABASE_ANON_KEY:',
      SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 10)}...` : 'NÃO CONFIGURADO'
    );

    // Validar que as variáveis de ambiente estão configuradas
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missingVars: string[] = [];
      if (!SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
      if (!SUPABASE_ANON_KEY) missingVars.push('VITE_SUPABASE_ANON_KEY');

      // Detectar se está rodando em produção (Vercel)
      const isProduction =
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('vercel.com') ||
        process.env.NODE_ENV === 'production';

      let errorMessage = `Variáveis de ambiente do Supabase não configuradas: ${missingVars.join(', ')}.\n\n`;

      if (isProduction) {
        errorMessage += '🔧 CONFIGURAÇÃO NO VERCEL:\n';
        errorMessage += '1. Acesse: https://vercel.com/dashboard\n';
        errorMessage += '2. Selecione seu projeto\n';
        errorMessage += '3. Vá em Settings > Environment Variables\n';
        errorMessage += '4. Adicione as seguintes variáveis:\n';
        errorMessage += '   - VITE_SUPABASE_URL = https://seu-projeto.supabase.co\n';
        errorMessage += '   - VITE_SUPABASE_ANON_KEY = sua_chave_anonima_aqui\n';
        errorMessage += '5. Faça um novo deploy (ou aguarde o redeploy automático)\n\n';
        errorMessage +=
          '💡 As variáveis precisam começar com VITE_ para serem expostas ao cliente.';
      } else {
        errorMessage += '🔧 CONFIGURAÇÃO LOCAL:\n';
        errorMessage += '1. Crie um arquivo .env na raiz do projeto\n';
        errorMessage += '2. Adicione as seguintes variáveis:\n';
        errorMessage += '   VITE_SUPABASE_URL=https://seu-projeto.supabase.co\n';
        errorMessage += '   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui\n';
        errorMessage += '3. Reinicie o servidor de desenvolvimento (npm run dev)';
      }

      const error = new Error(errorMessage);
      logger.error('[Supabase] ❌ Erro de configuração:', error.message);
      logger.error('[Supabase] 💡 Dica: As variáveis de ambiente precisam estar configuradas.');
      throw error;
    }

    // Validar formato da URL
    try {
      new URL(SUPABASE_URL);
      logger.log('[Supabase] ✅ URL válida');
    } catch {
      const error = new Error(
        `URL do Supabase inválida: ${SUPABASE_URL}. ` +
          'A URL deve estar no formato: https://seu-projeto.supabase.co'
      );
      logger.error('[Supabase] ❌ Erro de validação:', error.message);
      throw error;
    }

    // Validar formato da chave (deve ter pelo menos 20 caracteres e começar com formato válido)
    // Chaves do Supabase podem ser:
    // - Formato JWT (eyJ...): ~200+ caracteres
    // - Formato publishable (sb_publishable_...): ~40-50 caracteres
    // - Formato anon tradicional: ~100+ caracteres
    if (SUPABASE_ANON_KEY.length < 20) {
      const error = new Error(
        'Chave anônima do Supabase parece inválida (muito curta). ' +
          'Verifique se VITE_SUPABASE_ANON_KEY está correta e completa no Vercel.'
      );
      console.error('[Supabase] ❌ Erro de validação:', error.message);
      throw error;
    }

    // Verificar se a chave parece estar completa (não cortada)
    // Chaves publishable começam com "sb_publishable_"
    // Chaves JWT começam com "eyJ"
    const isValidFormat =
      SUPABASE_ANON_KEY.startsWith('sb_') ||
      SUPABASE_ANON_KEY.startsWith('eyJ') ||
      SUPABASE_ANON_KEY.length >= 50;

    if (!isValidFormat && SUPABASE_ANON_KEY.length < 50) {
      logger.warn(
        '[Supabase] ⚠️  Aviso: Chave anônima pode estar incompleta. Verifique se copiou a chave completa no Vercel.'
      );
    }

    try {
      logger.log('[Supabase] Carregando módulo @supabase/supabase-js...');
      // Carregar módulo via importmap (disponível no runtime)
      if (!supabaseModule) {
        supabaseModule = await import('@supabase/supabase-js');
        logger.log('[Supabase] ✅ Módulo carregado com sucesso');
      }

      logger.log('[Supabase] Criando cliente Supabase...');
      
      // O interceptor já foi configurado no nível do módulo
      // Apenas garantir que está ativo
      if (typeof window !== 'undefined' && !fetchInterceptorSetup) {
        setupFetchInterceptor();
      }
      
      // Configurar opções para evitar múltiplas instâncias do GoTrueClient
      supabaseClient = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Usar storage compartilhado para evitar múltiplas instâncias
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          storageKey: 'sb-auth-token',
        },
        global: {
          // Headers padrão
          headers: {
            'x-client-info': 'goalscan-pro@1.0.0',
          },
        },
      });
      logger.log('[Supabase] ✅ Cliente inicializado com sucesso');

      // Limpar a Promise de inicialização após sucesso
      const client = supabaseClient;
      initializationPromise = null;
      return client;
    } catch (error: unknown) {
      // Limpar a Promise de inicialização em caso de erro
      initializationPromise = null;

      logger.error('[Supabase] ❌ Erro ao inicializar cliente Supabase:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });

      const detailedError = new Error(
        `Erro ao inicializar cliente Supabase: ${error?.message || 'Erro desconhecido'}. ` +
          'Verifique se o módulo @supabase/supabase-js está instalado (npm install @supabase/supabase-js)'
      );
      throw detailedError;
    }
  })();

  return initializationPromise;
};
