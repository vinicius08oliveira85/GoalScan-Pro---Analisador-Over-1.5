import {
  Championship,
  ChampionshipTable,
  ChampionshipTeam,
  ChampionshipComplement,
  CompetitionComplementAverages,
  TableType,
  TableRowGeral,
  TableRowComplement,
  TableFormat,
} from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { parseNumeric } from '../utils/numbers';

export interface ChampionshipRow {
  id: string;
  nome: string;
  created_at?: string;
  updated_at?: string;
  uploaded_at?: string;
}

export interface ChampionshipTableRow {
  id: string;
  championship_id: string;
  table_type: TableType;
  table_name: string;
  table_data: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface ChampionshipTeamRow {
  id: string;
  championship_id: string;
  squad: string;
  table_name: string;
  rk?: string;
  
  // Campos Home
  home_mp?: string;
  home_w?: string;
  home_d?: string;
  home_l?: string;
  home_gf?: string;
  home_ga?: string;
  home_gd?: string;
  home_pts?: string;
  home_pts_mp?: string;
  home_xg?: string;
  home_xga?: string;
  home_xgd?: string;
  home_xgd_90?: string;
  
  // Campos Away
  away_mp?: string;
  away_w?: string;
  away_d?: string;
  away_l?: string;
  away_gf?: string;
  away_ga?: string;
  away_gd?: string;
  away_pts?: string;
  away_pts_mp?: string;
  away_xg?: string;
  away_xga?: string;
  away_xgd?: string;
  away_xgd_90?: string;
  
  // Campo para campos extras
  extra_fields?: Record<string, unknown>;
  
  created_at?: string;
  updated_at?: string;
}

const STORAGE_KEY_CHAMPIONSHIPS = 'goalscan_championships';
export const STORAGE_KEY_CHAMPIONSHIP_TABLES = 'goalscan_championship_tables';
const STORAGE_KEY_SERVICE_STATUS = 'goalscan_supabase_status';

// Cache de status do serviço (evita requisições repetidas quando serviço está indisponível)
interface ServiceStatus {
  isUnavailable: boolean;
  lastCheck: number;
  retryAfter: number; // timestamp para próxima tentativa
}

export const SERVICE_STATUS_CACHE_DURATION = 60000; // 1 minuto
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

// Proteção contra requisições excessivas
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 segundos entre requisições

/**
 * Verifica se um erro é um erro HTTP temporário (503, 502, 504, etc)
 */
export function isTemporaryError(error: unknown): boolean {
  if (!error) return false;
  
  const err = error as { 
    message?: string; 
    code?: string | number; 
    status?: number;
    statusCode?: number;
    error?: string; // Para detectar {error: 'Service Unavailable'}
  };
  
  // Verificar propriedade 'error' quando o erro é um objeto
  if (err.error && typeof err.error === 'string') {
    const errorStr = err.error.toLowerCase();
    if (errorStr.includes('service unavailable') || 
        errorStr.includes('503') ||
        errorStr.includes('502') ||
        errorStr.includes('504')) {
      return true;
    }
  }
  
  // Verificar status code direto
  const statusCode = err.status || err.statusCode || 
    (typeof err.code === 'number' ? err.code : null);
  
  // Erros temporários comuns
  const temporaryStatusCodes = [503, 502, 504, 429, 408];
  if (statusCode && temporaryStatusCodes.includes(statusCode)) {
    return true;
  }
  
  // Verificar mensagem de erro
  const message = (err.message || '').toLowerCase();
  return message.includes('503') || 
         message.includes('service unavailable') ||
         message.includes('502') ||
         message.includes('504') ||
         message.includes('gateway timeout');
}

/**
 * Extrai o status code de um erro do Supabase
 */
export function getErrorStatus(error: unknown): number | null {
  if (!error) return null;
  
  const err = error as { 
    status?: number; 
    statusCode?: number; 
    code?: string | number;
  };
  
  // Tentar extrair status de diferentes propriedades
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (typeof err.code === 'number') return err.code;
  
  // Verificar se code é string com número
  if (typeof err.code === 'string') {
    const numericCode = parseInt(err.code, 10);
    if (!isNaN(numericCode)) return numericCode;
  }
  
  return null;
}

/**
 * Verifica se um erro é um erro de constraint violation (400)
 * Especificamente para detectar problemas com table_type constraint
 */
export function isConstraintError(error: unknown): boolean {
  if (!error) return false;
  
  const statusCode = getErrorStatus(error);
  
  if (statusCode === 400) {
    const err = error as { 
      message?: string; 
      details?: string;
    };
    
    // Verificar se é erro de constraint
    const message = (err.message || '').toLowerCase();
    const details = (err.details || '').toLowerCase();
    
    return message.includes('check') ||
           message.includes('constraint') ||
           message.includes('violates') ||
           details.includes('check') ||
           details.includes('constraint') ||
           details.includes('violates');
  }
  
  return false;
}

/**
 * Obtém o status do serviço do cache
 */
export function getServiceStatus(): ServiceStatus | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SERVICE_STATUS);
    if (!stored) return null;
    const status = JSON.parse(stored) as ServiceStatus;
    
    // Verificar se o cache ainda é válido
    const now = Date.now();
    if (now - status.lastCheck > SERVICE_STATUS_CACHE_DURATION) {
      return null; // Cache expirado
    }
    
    return status;
  } catch {
    return null;
  }
}

/**
 * Salva o status do serviço no cache
 */
export function setServiceStatus(isUnavailable: boolean, retryAfter: number = 0): void {
  try {
    const status: ServiceStatus = {
      isUnavailable,
      lastCheck: Date.now(),
      retryAfter: retryAfter || Date.now() + SERVICE_STATUS_CACHE_DURATION,
    };
    localStorage.setItem(STORAGE_KEY_SERVICE_STATUS, JSON.stringify(status));
  } catch {
    // Ignorar erros de localStorage
  }
}

/**
 * Limpa o cache de status do serviço (quando serviço volta a funcionar)
 */
export function clearServiceStatus(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SERVICE_STATUS);
  } catch {
    // Ignorar erros
  }
}

/**
 * Executa uma operação com retry e backoff exponencial
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: unknown = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Se chegou aqui, a operação foi bem-sucedida
      if (attempt > 0) {
        logger.log(`[ChampionshipService] ${operationName} bem-sucedido após ${attempt} tentativa(s)`);
        clearServiceStatus(); // Limpar cache quando serviço volta a funcionar
      }
      
      return result;
    } catch (error: unknown) {
      lastError = error;
      
      // Se não é erro temporário ou é a última tentativa, não fazer retry
      if (!isTemporaryError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Calcular delay com backoff exponencial
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      
      // Log apenas na primeira tentativa e apenas em modo dev para evitar spam
      if (attempt === 0 && import.meta.env.DEV) {
        logger.warn(
          `[ChampionshipService] ${operationName} falhou temporariamente (erro 503). ` +
          `Tentando novamente em ${delay}ms... (tentativa ${attempt + 1}/${maxRetries + 1})`
        );
      }
      
      // Aguardar antes de tentar novamente
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error(`${operationName} falhou após ${maxRetries + 1} tentativas`);
}

/**
 * Carrega todos os campeonatos do Supabase ou localStorage
 */
export const loadChampionships = async (): Promise<Championship[]> => {
  // Verificar cache de status do serviço ANTES de fazer qualquer requisição
  const serviceStatus = getServiceStatus();
  if (serviceStatus?.isUnavailable && Date.now() < serviceStatus.retryAfter) {
    // Não logar warning - serviço está conhecidamente indisponível
    // Retornar silenciosamente dados do localStorage
    return loadChampionshipsFromLocalStorage();
  }

  // Proteção contra requisições excessivas (throttle)
  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    // Se a última requisição foi há menos de 2 segundos, retornar dados do localStorage
    return loadChampionshipsFromLocalStorage();
  }
  lastRequestTime = now;

  try {
    // Log apenas em modo debug (não em produção)
    if (import.meta.env.DEV) {
      logger.log('[ChampionshipService] Carregando campeonatos...');
    }
    
    const result = await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('championships')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        // Se tabela não existe, usar localStorage
        if (error.code === 'PGRST116' || error.code === '42P01') {
          if (import.meta.env.DEV) {
            logger.warn('[ChampionshipService] Tabela não encontrada, usando localStorage');
          }
          return loadChampionshipsFromLocalStorage();
        }
        
        // Se é erro temporário, lançar para que o retry funcione
        if (isTemporaryError(error)) {
          throw error;
        }
        
        // Apenas logar erros não temporários
        if (import.meta.env.DEV) {
          logger.error('[ChampionshipService] Erro ao carregar campeonatos:', error);
        }
        throw error;
      }

      if (!data) {
        return loadChampionshipsFromLocalStorage();
      }

      return data;
    }, 'Carregamento de campeonatos');

    // Converter do formato do banco para Championship
    const championships = (result as ChampionshipRow[]).map((row: ChampionshipRow) => ({
      id: row.id,
      nome: row.nome,
      fbrefUrl: (row as { fbref_url?: string }).fbref_url || null,
      table_format: (row as { table_format?: string }).table_format as TableFormat | undefined || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      uploaded_at: row.uploaded_at,
    }));

    if (import.meta.env.DEV) {
      logger.log(`[ChampionshipService] ${championships.length} campeonato(s) carregado(s)`);
    }

    // Sincronizar com localStorage
    saveChampionshipsToLocalStorage(championships);
    clearServiceStatus(); // Limpar cache quando sucesso

    return championships;
  } catch (error: unknown) {
    // Se é erro temporário, atualizar cache de status
    if (isTemporaryError(error)) {
      const retryAfter = Date.now() + SERVICE_STATUS_CACHE_DURATION;
      setServiceStatus(true, retryAfter);
      // Não logar warning - erro temporário esperado, já tratado
    } else {
      // Apenas logar erros não temporários
      if (import.meta.env.DEV) {
        logger.error('[ChampionshipService] Erro ao carregar campeonatos:', error);
      }
    }
    
    // Fallback para localStorage
    return loadChampionshipsFromLocalStorage();
  }
};

/**
 * Carrega um campeonato específico
 */
export const loadChampionship = async (id: string): Promise<Championship | null> => {
  try {
    const result = await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('championships')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return loadChampionshipFromLocalStorage(id);
        }
        
        if (isTemporaryError(error)) {
          throw error;
        }
        
        logger.error('[ChampionshipService] Erro ao carregar campeonato:', error);
        return loadChampionshipFromLocalStorage(id);
      }

      if (!data) {
        return loadChampionshipFromLocalStorage(id);
      }

      return {
        id: data.id,
        nome: data.nome,
        fbrefUrl: (data as { fbref_url?: string }).fbref_url || null,
        table_format: (data as { table_format?: string }).table_format as TableFormat | undefined || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        uploaded_at: (data as { uploaded_at?: string }).uploaded_at,
      };
    }, `Carregamento de campeonato ${id}`);

    clearServiceStatus();
    return result as Championship | null;
  } catch (error: unknown) {
    if (isTemporaryError(error)) {
      setServiceStatus(true, Date.now() + SERVICE_STATUS_CACHE_DURATION);
    } else {
      logger.error('[ChampionshipService] Erro ao carregar campeonato:', error);
    }
    return loadChampionshipFromLocalStorage(id);
  }
};

/**
 * Salva ou atualiza um campeonato
 */
export const saveChampionship = async (championship: Championship): Promise<Championship> => {
  // Verificar cache de status do serviço ANTES de fazer qualquer requisição
  const serviceStatus = getServiceStatus();
  if (serviceStatus?.isUnavailable && Date.now() < serviceStatus.retryAfter) {
    // Serviço está conhecidamente indisponível - salvar apenas no localStorage silenciosamente
    return saveChampionshipToLocalStorage(championship);
  }

  try {
    const result = await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('championships')
        .upsert(
          {
            id: championship.id,
            nome: championship.nome,
            fbref_url: championship.fbrefUrl || null,
            table_format: championship.table_format || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        )
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          // Salvar apenas no localStorage
          return saveChampionshipToLocalStorage(championship);
        }
        
        // Erro 400 pode ser campo não existente (ex: table_format)
        const errorStatus = getErrorStatus(error);
        if (errorStatus === 400) {
          const errorMessage = (error as { message?: string }).message || '';
          const errorDetails = (error as { details?: string }).details || '';
          const isTableFormatError = errorMessage.toLowerCase().includes('table_format') || 
                                    errorMessage.toLowerCase().includes('column') ||
                                    errorDetails.toLowerCase().includes('table_format') ||
                                    errorDetails.toLowerCase().includes('column');
          
          if (import.meta.env.DEV) {
            logger.warn(
              '[ChampionshipService] Erro 400 ao salvar campeonato.',
              { 
                error, 
                errorStatus, 
                errorMessage, 
                errorDetails,
                isTableFormatError,
                errorDetailsFull: JSON.stringify(error, null, 2)
              }
            );
          }
          
          // Se for erro de campo não existente (table_format), tentar salvar sem ele
          if (isTableFormatError || championship.table_format) {
            if (import.meta.env.DEV) {
              logger.log('[ChampionshipService] Tentando salvar sem table_format...');
            }
            
            // Tentar salvar sem table_format
            const { data: dataWithoutFormat, error: errorWithoutFormat } = await supabase
              .from('championships')
              .upsert(
                {
                  id: championship.id,
                  nome: championship.nome,
                  fbref_url: championship.fbrefUrl || null,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'id',
                }
              )
              .select()
              .single();
            
            if (errorWithoutFormat) {
              if (import.meta.env.DEV) {
                logger.error(
                  '[ChampionshipService] Erro ao salvar campeonato mesmo sem table_format:',
                  { error: errorWithoutFormat, errorStatus: getErrorStatus(errorWithoutFormat) }
                );
              }
              // Se ainda falhar, pode ser outro problema - tentar apenas com campos básicos
              const { data: dataBasic, error: errorBasic } = await supabase
                .from('championships')
                .upsert(
                  {
                    id: championship.id,
                    nome: championship.nome,
                    updated_at: new Date().toISOString(),
                  },
                  {
                    onConflict: 'id',
                  }
                )
                .select()
                .single();
              
              if (errorBasic) {
                if (import.meta.env.DEV) {
                  logger.error('[ChampionshipService] Erro ao salvar campeonato mesmo com campos básicos:', errorBasic);
                }
                return saveChampionshipToLocalStorage(championship);
              }
              
              if (import.meta.env.DEV) {
                logger.log('[ChampionshipService] Campeonato salvo com campos básicos apenas');
              }
              
              return dataBasic;
            }
            
            if (import.meta.env.DEV) {
              logger.log('[ChampionshipService] Campeonato salvo sem table_format (campo não existe no banco)');
            }
            
            if (!dataWithoutFormat) {
              if (import.meta.env.DEV) {
                logger.error('[ChampionshipService] Nenhum dado retornado após salvar sem table_format');
              }
              return saveChampionshipToLocalStorage(championship);
            }
            
            return dataWithoutFormat;
          }
          
          // Se não for erro de table_format, logar e fazer fallback
          if (import.meta.env.DEV) {
            logger.error(
              '[ChampionshipService] Erro 400 não relacionado a table_format:',
              { error, errorMessage, errorDetails }
            );
          }
          return saveChampionshipToLocalStorage(championship);
        }
        
        if (isTemporaryError(error)) {
          throw error;
        }
        
        // Apenas logar erros não temporários e apenas em modo dev
        if (import.meta.env.DEV) {
          logger.error('[ChampionshipService] Erro ao salvar campeonato:', error);
        }
        throw error;
      }

      return data;
    }, `Salvamento de campeonato ${championship.id}`);

    // Validar que result contém dados válidos
    if (!result || !result.id) {
      if (import.meta.env.DEV) {
        logger.error('[ChampionshipService] Resultado inválido após salvar campeonato:', result);
      }
      return saveChampionshipToLocalStorage(championship);
    }
    
    const saved: Championship = {
      id: result.id,
      nome: result.nome,
      fbrefUrl: (result as { fbref_url?: string }).fbref_url || null,
      table_format: (result as { table_format?: string }).table_format as TableFormat | undefined || null,
      created_at: result.created_at,
      updated_at: result.updated_at,
      uploaded_at: (result as { uploaded_at?: string }).uploaded_at,
    };
    
    if (import.meta.env.DEV) {
      logger.log(`[ChampionshipService] Campeonato salvo com sucesso no Supabase (ID: ${saved.id})`);
    }

    // Sincronizar com localStorage
    const championships = await loadChampionships();
    const updated = championships.filter((c) => c.id !== saved.id);
    updated.push(saved);
    saveChampionshipsToLocalStorage(updated);
    clearServiceStatus();

    return saved;
  } catch (error: unknown) {
    if (isTemporaryError(error)) {
      setServiceStatus(true, Date.now() + SERVICE_STATUS_CACHE_DURATION);
      // Não logar - erro temporário esperado, já tratado
    } else {
      // Apenas logar erros não temporários e apenas em modo dev
      if (import.meta.env.DEV) {
        logger.error('[ChampionshipService] Erro ao salvar campeonato:', error);
      }
    }
    // Fallback para localStorage
    return saveChampionshipToLocalStorage(championship);
  }
};

/**
 * Deleta um campeonato
 */
export const deleteChampionship = async (id: string): Promise<void> => {
  try {
    await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('championships').delete().eq('id', id);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          deleteChampionshipFromLocalStorage(id);
          return;
        }
        
        if (isTemporaryError(error)) {
          throw error;
        }
        
        logger.error('[ChampionshipService] Erro ao deletar campeonato:', error);
        throw error;
      }

      return;
    }, `Deleção de campeonato ${id}`);

    // Remover do localStorage também
    deleteChampionshipFromLocalStorage(id);
    clearServiceStatus();
  } catch (error: unknown) {
    if (isTemporaryError(error)) {
      setServiceStatus(true, Date.now() + SERVICE_STATUS_CACHE_DURATION);
    } else {
      logger.error('[ChampionshipService] Erro ao deletar campeonato:', error);
    }
    // Tentar remover do localStorage mesmo em caso de erro
    deleteChampionshipFromLocalStorage(id);
  }
};

/**
 * Atualiza o campo uploaded_at do campeonato
 */
export const updateChampionshipUploadedAt = async (championshipId: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('championships')
      .update({ uploaded_at: new Date().toISOString() })
      .eq('id', championshipId);

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Tabela não existe ou coluna não existe ainda
        return;
      }
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Erro ao atualizar uploaded_at:', error);
      }
    }
  } catch (error: unknown) {
    // Ignorar erros silenciosamente
    if (import.meta.env.DEV) {
      logger.warn('[ChampionshipService] Erro ao atualizar uploaded_at:', error);
    }
  }
};

// Funções auxiliares para localStorage

function loadChampionshipsFromLocalStorage(): Championship[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHAMPIONSHIPS);
    if (!stored) return [];
    return JSON.parse(stored) as Championship[];
  } catch {
    return [];
  }
}

function loadChampionshipFromLocalStorage(id: string): Championship | null {
  const championships = loadChampionshipsFromLocalStorage();
  return championships.find((c) => c.id === id) || null;
}

function saveChampionshipsToLocalStorage(championships: Championship[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CHAMPIONSHIPS, JSON.stringify(championships));
  } catch (error) {
    logger.error('[ChampionshipService] Erro ao salvar no localStorage:', error);
  }
}

function saveChampionshipToLocalStorage(championship: Championship): Championship {
  const championships = loadChampionshipsFromLocalStorage();
  const existingIndex = championships.findIndex((c) => c.id === championship.id);
  if (existingIndex >= 0) {
    championships[existingIndex] = championship;
  } else {
    championships.push(championship);
  }
  saveChampionshipsToLocalStorage(championships);
  return championship;
}

function deleteChampionshipFromLocalStorage(id: string): void {
  const championships = loadChampionshipsFromLocalStorage();
  const filtered = championships.filter((c) => c.id !== id);
  saveChampionshipsToLocalStorage(filtered);
  // Também remover tabelas relacionadas
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHAMPIONSHIP_TABLES);
    if (stored) {
      const allTables = JSON.parse(stored) as ChampionshipTable[];
      const remaining = allTables.filter((t) => t.championship_id !== id);
      localStorage.setItem(STORAGE_KEY_CHAMPIONSHIP_TABLES, JSON.stringify(remaining));
    }
  } catch (error) {
    logger.error('[ChampionshipService] Erro ao deletar tabelas do localStorage:', error);
  }
}
