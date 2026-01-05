/**
 * Utilitário para gerenciar chaves da API do Gemini com suporte a fallback
 * 
 * Quando a chave principal atinge quota ou falha, automaticamente tenta a chave fallback.
 */

// Carregar chaves das variáveis de ambiente
// No Vite, variáveis são expostas via process.env durante o build
// No cliente, usamos process.env que foi injetado pelo Vite
const getEnvVar = (key: string): string => {
  // Tenta process.env (injetado pelo Vite durante build)
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  // Fallback para import.meta.env (se disponível)
  try {
    const env = (globalThis as { import?: { meta?: { env?: Record<string, string | undefined> } } }).import?.meta?.env;
    if (env?.[key]) {
      return env[key] as string;
    }
  } catch {
    // Ignora erros
  }
  return '';
};

const GEMINI_API_KEY = getEnvVar('GEMINI_API_KEY');
const GEMINI_API_KEY_FALLBACK = getEnvVar('GEMINI_API_KEY_FALLBACK');

/**
 * Retorna todas as chaves disponíveis na ordem de prioridade
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  
  if (GEMINI_API_KEY) {
    keys.push(GEMINI_API_KEY);
  }
  
  if (GEMINI_API_KEY_FALLBACK) {
    keys.push(GEMINI_API_KEY_FALLBACK);
  }
  
  return keys;
}

/**
 * Retorna a chave principal (primeira na lista)
 */
export function getPrimaryGeminiKey(): string | null {
  return GEMINI_API_KEY || null;
}

/**
 * Retorna a chave fallback (segunda na lista)
 */
export function getFallbackGeminiKey(): string | null {
  return GEMINI_API_KEY_FALLBACK || null;
}

/**
 * Verifica se há chaves configuradas
 */
export function hasGeminiKeys(): boolean {
  return getGeminiApiKeys().length > 0;
}

/**
 * Verifica se um erro indica que a quota foi excedida ou há problema com a chave
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  
  const err = error as { message?: string; code?: string | number; status?: string | number };
  const errorMessage = err.message?.toLowerCase() || '';
  const errorCode = err.code || err.status || '';
  const statusCode = typeof err.status === 'number' ? err.status : 
                     typeof errorCode === 'number' ? errorCode : 
                     parseInt(String(errorCode)) || 0;
  
  // Erros comuns do Gemini API que indicam problema com a chave
  const quotaIndicators = [
    'quota',
    'rate limit',
    'resource exhausted',
    '429', // Too Many Requests
    '403', // Forbidden (pode ser quota)
    'permission denied',
    'api key',
    'invalid api key',
    'billing',
    'quota exceeded',
    'model not found', // 404 pode ser modelo inválido, mas também pode ser problema de chave
    '404' // Modelo não encontrado - pode indicar problema de acesso
  ];
  
  // Status codes que indicam problema com quota ou acesso
  if (statusCode === 429 || statusCode === 403) {
    return true;
  }
  
  return quotaIndicators.some(indicator => 
    errorMessage.includes(indicator) || 
    String(errorCode).includes(indicator)
  );
}

/**
 * Executa uma função com retry automático usando fallback de chaves
 * 
 * @param apiCall Função que recebe a chave API e retorna uma Promise
 * @param options Opções de retry
 * @returns Promise com o resultado da chamada
 */
export async function callWithFallback<T>(
  apiCall: (apiKey: string) => Promise<T>,
  options: {
    onKeySwitch?: (fromKey: string, toKey: string) => void;
    onError?: (error: unknown, keyIndex: number) => void;
  } = {}
): Promise<T> {
  const keys = getGeminiApiKeys();
  
  if (keys.length === 0) {
    throw new Error('Nenhuma chave da API do Gemini configurada. Configure GEMINI_API_KEY no .env');
  }
  
  let lastError: unknown = null;
  
  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    
    try {
      const result = await apiCall(currentKey);
      
      // Se chegou aqui, a chamada foi bem-sucedida
      if (i > 0 && options.onKeySwitch) {
        // Informar que usou fallback (mas não precisa trocar, já funcionou)
        console.log(`[Gemini] Chave principal falhou, usando fallback (chave ${i + 1}/${keys.length})`);
      }
      
      return result;
    } catch (error: unknown) {
      lastError = error;
      
      // Log do erro
      if (options.onError) {
        options.onError(error, i);
      }
      
      // Verificar se é erro que justifica tentar próxima chave
      const shouldTryNext = isQuotaExceededError(error) || 
                           error.status === 404 || // Modelo não encontrado pode ser problema de acesso
                           error.status === 429 || // Rate limit
                           error.status === 403;   // Forbidden
      
      if (shouldTryNext && i < keys.length - 1) {
        const nextKey = keys[i + 1];
        const errorType = error.status === 404 ? 'modelo não encontrado' :
                         error.status === 429 ? 'quota excedida' :
                         error.status === 403 ? 'acesso negado' :
                         'erro de API';
        
        console.warn(
          `[Gemini] Chave ${i + 1} falhou (${errorType}). ` +
          `Tentando chave fallback ${i + 2}/${keys.length}...`
        );
        
        if (options.onKeySwitch) {
          options.onKeySwitch(currentKey, nextKey);
        }
        
        // Continuar loop para tentar próxima chave
        continue;
      }
      
      // Se não é erro de quota ou é a última chave, lançar erro
      if (i === keys.length - 1) {
        // Última chave falhou, lançar erro
        throw new Error(
          `Todas as chaves da API do Gemini falharam. Último erro: ${error.message || error}`
        );
      }
    }
  }
  
  // Se chegou aqui, todas as chaves falharam
  throw lastError || new Error('Todas as chaves da API do Gemini falharam');
}
