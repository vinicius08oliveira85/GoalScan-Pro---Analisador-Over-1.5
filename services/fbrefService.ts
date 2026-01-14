import { getSupabaseClient } from '../lib/supabase';
import { ChampionshipTable, TableType } from '../types';
import { logger } from '../utils/logger';

export type ExtractType = 'table' | 'matches' | 'team-stats' | 'all';

export interface FbrefExtractionRequest {
  championshipUrl: string;
  championshipId: string;
  extractTypes: ExtractType[];
  tableType?: 'geral' | 'standard_for';
}

export interface FbrefExtractionResult {
  success: boolean;
  data?: {
    table?: unknown[];
    matches?: unknown[];
    teamStats?: unknown[];
  };
  error?: string;
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
 * Extrai dados do fbref.com via Edge Function
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

    // Obter cliente Supabase
    const supabase = await getSupabaseClient();

    // Chamar Edge Function
    const { data, error } = await supabase.functions.invoke('fbref-scraper', {
      body: {
        championshipUrl: request.championshipUrl,
        championshipId: request.championshipId,
        extractTypes: request.extractTypes,
        tableType: request.tableType || 'geral',
      },
    });

    if (error) {
      logger.error('[FBrefService] Erro ao chamar Edge Function:', error);
      return {
        success: false,
        error: error.message || 'Erro ao extrair dados do fbref.com',
      };
    }

    const result = data as FbrefExtractionResult;

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
      id: `${championshipId}_${tableType}_${Date.now()}`,
      championship_id: championshipId,
      table_type: tableType,
      table_name: tableType === 'geral' ? 'Geral' : 'Standard (For) - Complemento',
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

