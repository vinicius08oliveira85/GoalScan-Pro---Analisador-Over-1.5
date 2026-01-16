import { getSupabaseClient } from '../lib/supabase';
import { ChampionshipTable, TableType } from '../types';
import { logger } from '../utils/logger';

export type ExtractType = 'table' | 'matches' | 'team-stats' | 'all';

// API route Python no Vercel
const FBREF_SCRAPER_API_URL = '/api/fbref-extract';
const FBREF_SELENIUM_SCRAPER_API_URL = '/api/fbref-extract-selenium';

export interface FbrefExtractionRequest {
  championshipUrl: string;
  championshipId: string;
  extractTypes: ExtractType[];
}

export interface FbrefExtractionResult {
  success: boolean;
  data?: {
    tables?: Record<'geral' | 'home_away' | 'standard_for', unknown[]>;
    missingTables?: Array<'geral' | 'home_away' | 'standard_for'>;
    matches?: unknown[];
    teamStats?: unknown[];
  };
  error?: string;
  error_details?: {
    type?: string;
    status_code?: number;
    message?: string;
    url?: string;
    [key: string]: unknown;
  };
}

const CACHE_KEY_PREFIX = 'fbref_extraction_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Cache helper
function getCacheKey(url: string, extractTypes: ExtractType[]): string {
  return `${CACHE_KEY_PREFIX}${url}_${extractTypes.join('_')}`;
}

function getCachedResult(key: string): FbrefExtractionResult | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { result, timestamp } = JSON.parse(cached);
    const now = Date.now();

    if (now - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

function setCachedResult(key: string, result: FbrefExtractionResult): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        result,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    logger.warn('[FBrefService] Erro ao salvar cache:', error);
  }
}

/**
 * Extrai dados do fbref.com via Edge Function (requests + BeautifulSoup)
 */
export const extractFbrefData = async (
  request: FbrefExtractionRequest
): Promise<FbrefExtractionResult> => {
  try {
    // Validar URL
    if (!request.championshipUrl || !request.championshipUrl.includes('fbref.com')) {
      return {
        success: false,
        error: 'URL inválida. Apenas URLs do fbref.com são permitidas.',
      };
    }

    // Verificar cache
    const cacheKey = getCacheKey(request.championshipUrl, request.extractTypes);
    const cached = getCachedResult(cacheKey);
    if (cached) {
      logger.log('[FBrefService] Usando dados do cache');
      return cached;
    }

    // Chamar API Python no Vercel
    const response = await fetch(FBREF_SCRAPER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        championshipUrl: request.championshipUrl,
        championshipId: request.championshipId,
        extractTypes: request.extractTypes,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: FbrefExtractionResult['error_details'] | undefined;
      
      try {
        const errorData = (await response.json()) as { error?: string; error_details?: FbrefExtractionResult['error_details'] };
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
        if (errorData?.error_details) {
          errorDetails = errorData.error_details;
        }
      } catch {
        // Ignora erro ao parsear JSON
      }
      
      logger.error('[FBrefService] Erro ao chamar API:', {
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        details: errorDetails,
      });
      
      return {
        success: false,
        error: errorMessage,
        error_details: errorDetails,
      };
    }

    const result = (await response.json()) as FbrefExtractionResult;

    // Salvar no cache se bem-sucedido
    if (result.success) {
      setCachedResult(cacheKey, result);
    }

    return result;
  } catch (error) {
    logger.error('[FBrefService] Erro inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao extrair dados',
    };
  }
};

const TABLE_NAME_BY_TYPE: Record<TableType, string> = {
  geral: 'Geral',
  home_away: 'Home/Away - Desempenho Casa vs Fora',
  standard_for: 'Standard (For) - Complemento',
  passing_for: 'Passing (For) - Complemento',
  gca_for: 'GCA (For) - Complemento',
};

/**
 * Salva tabela extraída no campeonato
 */
export const saveExtractedTable = async (
  championshipId: string,
  tableType: TableType,
  tableData: unknown[]
): Promise<ChampionshipTable | null> => {
  try {
    // Validar dados
    if (!Array.isArray(tableData) || tableData.length === 0) {
      throw new Error('Dados da tabela inválidos');
    }

    // Verificar se há campo Squad (obrigatório)
    const firstRow = tableData[0] as Record<string, unknown>;
    if (!firstRow.Squad && !firstRow.squad) {
      throw new Error('Dados da tabela devem conter o campo "Squad"');
    }

    // Normalizar campo Squad
    const normalizedData = tableData.map((row) => {
      const r = row as Record<string, unknown>;
      if (r.squad && !r.Squad) {
        r.Squad = r.squad;
      }
      return r;
    });

    // Importar função de salvar tabela
    const { saveChampionshipTable } = await import('./championshipService');

    const table: ChampionshipTable = {
      // ID estável por campeonato + tipo (evita “acúmulo” de versões no banco; mantém sempre a mais recente)
      id: `${championshipId}_${tableType}`,
      championship_id: championshipId,
      table_type: tableType,
      table_name: TABLE_NAME_BY_TYPE[tableType] ?? tableType,
      table_data: normalizedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = await saveChampionshipTable(table);
    return saved;
  } catch (error) {
    logger.error('[FBrefService] Erro ao salvar tabela:', error);
    throw error;
  }
};

/**
 * Salva um pacote de tabelas extraídas (geral + home_away + standard_for).
 * Retorna as tabelas efetivamente salvas (pode pular as vazias).
 */
export const saveExtractedTables = async (
  championshipId: string,
  tablesByType: Record<'geral' | 'home_away' | 'standard_for', unknown[]>
): Promise<ChampionshipTable[]> => {
  const saved: ChampionshipTable[] = [];

  for (const tableType of Object.keys(tablesByType) as Array<keyof typeof tablesByType>) {
    const rows = tablesByType[tableType];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const res = await saveExtractedTable(championshipId, tableType as TableType, rows);
    if (res) saved.push(res);
  }

  return saved;
};

/**
 * Extrai dados do fbref.com via Selenium (para páginas com JavaScript dinâmico)
 */
export const extractFbrefDataWithSelenium = async (
  request: FbrefExtractionRequest
): Promise<FbrefExtractionResult> => {
  try {
    // Validar URL
    if (!request.championshipUrl || !request.championshipUrl.includes('fbref.com')) {
      return {
        success: false,
        error: 'URL inválida. Apenas URLs do fbref.com são permitidas.',
      };
    }

    // Cache com sufixo diferente para Selenium
    const cacheKey = `${getCacheKey(request.championshipUrl, request.extractTypes)}_selenium`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
      logger.log('[FBrefService] Usando dados do cache (Selenium)');
      return cached;
    }

    // Chamar API Python com Selenium no Vercel
    const response = await fetch(FBREF_SELENIUM_SCRAPER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        championshipUrl: request.championshipUrl,
        championshipId: request.championshipId,
        extractTypes: request.extractTypes,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: FbrefExtractionResult['error_details'] | undefined;
      
      try {
        const errorData = (await response.json()) as { error?: string; error_details?: FbrefExtractionResult['error_details'] };
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
        if (errorData?.error_details) {
          errorDetails = errorData.error_details;
        }
      } catch {
        // Ignora erro ao parsear JSON
      }
      
      logger.error('[FBrefService] Erro ao chamar API Selenium:', {
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        details: errorDetails,
      });
      
      return {
        success: false,
        error: errorMessage,
        error_details: errorDetails,
      };
    }

    const result = (await response.json()) as FbrefExtractionResult;

    // Log detalhado de erros
    if (!result.success && result.error_details) {
      logger.error('[FBrefService] Detalhes do erro (Selenium):', {
        type: result.error_details.type,
        status_code: result.error_details.status_code,
        message: result.error_details.message,
        url: result.error_details.url,
      });
    }

    // Salvar no cache se bem-sucedido
    if (result.success) {
      setCachedResult(cacheKey, result);
    }

    return result;
  } catch (error) {
    logger.error('[FBrefService] Erro inesperado (Selenium):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao extrair dados com Selenium',
    };
  }
};

/**
 * Limpa cache de extrações
 */
export const clearFbrefCache = (): void => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    logger.log('[FBrefService] Cache limpo');
  } catch (error) {
    logger.warn('[FBrefService] Erro ao limpar cache:', error);
  }
};

