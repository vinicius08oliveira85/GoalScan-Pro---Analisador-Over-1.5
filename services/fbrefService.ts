import { Championship, ChampionshipTable, TableType } from '../types';
import { logger } from '../utils/logger';
import { mapToTableRowsGeral } from '../utils/fbrefMapper';

/** Intervalo mínimo entre requisições ao scraper (respeito ao FBref / rate limit). */
export const FBREF_SYNC_DELAY_MS = 3000;

export interface FbrefExtractCallOptions {
  /** Não usar cache local (recomendado na sincronização em lote). */
  skipCache?: boolean;
  /** Interrompe a requisição HTTP (cancelar sincronização em lote). */
  signal?: AbortSignal;
}

export interface SyncChampionshipFromFbrefResult {
  championshipId: string;
  nome: string;
  success: boolean;
  error?: string;
}

export interface SyncAllChampionshipsOptions {
  useSelenium?: boolean;
  skipCache?: boolean;
  /** Pausa entre um campeonato e o próximo (ms). Padrão: FBREF_SYNC_DELAY_MS. */
  delayBetweenMs?: number;
  /** Abortar lote: interrompe após a requisição atual e marca o restante como cancelado. */
  signal?: AbortSignal;
  onBeforeEach?: (championship: Championship, index: number) => void;
  onAfterEach?: (result: SyncChampionshipFromFbrefResult, index: number) => void;
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

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
    tables?: Record<string, unknown[] | undefined>;
    missingTables?: Array<'geral'>;
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
 * Extrai dados do fbref.com via API de scraping (Vercel / requests + BeautifulSoup)
 */
export const extractFbrefData = async (
  request: FbrefExtractionRequest,
  callOptions?: FbrefExtractCallOptions
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
    if (!callOptions?.skipCache) {
      const cached = getCachedResult(cacheKey);
      if (cached) {
        logger.log('[FBrefService] Usando dados do cache');
        return cached;
      }
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
      signal: callOptions?.signal,
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
    if (result.success && !callOptions?.skipCache) {
      setCachedResult(cacheKey, result);
    }

    return result;
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Cancelado' };
    }
    logger.error('[FBrefService] Erro inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao extrair dados',
    };
  }
};

const TABLE_NAME_BY_TYPE: Record<TableType, string> = {
  geral: 'Geral',
  complement: 'Complemento',
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
  tablesByType: Record<string, unknown[]>
): Promise<ChampionshipTable[]> => {
  const saved: ChampionshipTable[] = [];
  const allowed: TableType[] = ['geral', 'complement'];

  for (const tableType of allowed) {
    const rows = tablesByType[tableType];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const res = await saveExtractedTable(championshipId, tableType, rows);
    if (res) saved.push(res);
  }

  return saved;
};

/**
 * Sincroniza um campeonato: extrai via API de scraping, aplica mapToTableRowsGeral e persiste.
 * `saveExtractedTable` → `saveChampionshipTable` atualiza `championship_teams` para tabela geral.
 */
export async function syncChampionshipFromFbref(
  championship: Championship,
  options?: FbrefExtractCallOptions & { useSelenium?: boolean }
): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  if (options?.signal?.aborted) {
    return { success: false, error: 'Cancelado', cancelled: true };
  }

  const url = championship.fbrefUrl?.trim();
  if (!url) {
    return { success: false, error: 'URL do FBref não configurada' };
  }
  if (!url.includes('fbref.com')) {
    return { success: false, error: 'URL inválida (deve ser do fbref.com)' };
  }

  const tableKind = championship.fbref_table_type ?? 'geral';
  if (tableKind === 'complement') {
    return {
      success: false,
      error:
        'Tipo "complement" não é suportado na API de extração atual (apenas tabela geral). Altere para Geral ou use upload manual.',
    };
  }

  const extractFn = options?.useSelenium ? extractFbrefDataWithSelenium : extractFbrefData;
  let result: FbrefExtractionResult;
  try {
    result = await extractFn(
      {
        championshipUrl: url,
        championshipId: championship.id,
        extractTypes: ['table'],
      },
      { skipCache: options?.skipCache ?? true, signal: options?.signal }
    );
  } catch (e) {
    if (isAbortError(e)) {
      return { success: false, error: 'Cancelado' };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Falha de conexão com o serviço de extração',
    };
  }

  if (!result.success) {
    const cancelled = result.error === 'Cancelado';
    return { success: false, error: result.error || 'Falha na extração do FBref', cancelled };
  }

  const raw = result.data?.tables?.geral;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { success: false, error: 'Nenhuma linha retornada na tabela geral do FBref' };
  }

  const mapped = mapToTableRowsGeral(raw);
  if (mapped.length === 0) {
    return {
      success: false,
      error: 'Nenhuma linha válida após o mapeamento (campo Squad obrigatório)',
    };
  }

  try {
    await saveExtractedTable(championship.id, 'geral', mapped as unknown[]);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao salvar tabela no banco',
    };
  }
}

/**
 * Percorre campeonatos com `fbrefUrl` preenchida e sincroniza um a um (erros não interrompem o lote).
 */
export async function syncAllChampionships(
  championships: Championship[],
  options?: SyncAllChampionshipsOptions
): Promise<SyncChampionshipFromFbrefResult[]> {
  const delay = options?.delayBetweenMs ?? FBREF_SYNC_DELAY_MS;
  const signal = options?.signal;
  const targets = championships.filter((c) => c.fbrefUrl && String(c.fbrefUrl).trim() !== '');
  const results: SyncChampionshipFromFbrefResult[] = [];

  const pushCancelledForRemaining = (fromIndex: number) => {
    for (let j = fromIndex; j < targets.length; j++) {
      const ch = targets[j];
      const entry: SyncChampionshipFromFbrefResult = {
        championshipId: ch.id,
        nome: ch.nome,
        success: false,
        error: 'Cancelado pelo usuário',
      };
      results.push(entry);
      options?.onAfterEach?.(entry, j);
    }
  };

  for (let i = 0; i < targets.length; i++) {
    if (signal?.aborted) {
      pushCancelledForRemaining(i);
      break;
    }

    const c = targets[i];
    if (i > 0 && delay > 0) {
      try {
        await sleep(delay, signal);
      } catch {
        pushCancelledForRemaining(i);
        break;
      }
    }

    if (signal?.aborted) {
      pushCancelledForRemaining(i);
      break;
    }

    options?.onBeforeEach?.(c, i);
    const r = await syncChampionshipFromFbref(c, {
      useSelenium: options?.useSelenium,
      skipCache: options?.skipCache ?? true,
      signal,
    });

    const entry: SyncChampionshipFromFbrefResult = {
      championshipId: c.id,
      nome: c.nome,
      success: r.success,
      error: r.error,
    };
    results.push(entry);
    options?.onAfterEach?.(entry, i);

    if (r.cancelled || r.error === 'Cancelado') {
      pushCancelledForRemaining(i + 1);
      break;
    }
  }

  return results;
}

/**
 * Extrai dados do fbref.com via Selenium (para páginas com JavaScript dinâmico)
 */
export const extractFbrefDataWithSelenium = async (
  request: FbrefExtractionRequest,
  callOptions?: FbrefExtractCallOptions
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
    if (!callOptions?.skipCache) {
      const cached = getCachedResult(cacheKey);
      if (cached) {
        logger.log('[FBrefService] Usando dados do cache (Selenium)');
        return cached;
      }
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
      signal: callOptions?.signal,
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
    if (result.success && !callOptions?.skipCache) {
      setCachedResult(cacheKey, result);
    }

    return result;
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Cancelado' };
    }
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

