import {
  Championship,
  ChampionshipTable,
  ChampionshipTeam,
  CompetitionStandardForAverages,
  TableType,
  TableRowGeral,
  TableRowStandardFor,
  TableFormat,
} from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';

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
const STORAGE_KEY_CHAMPIONSHIP_TABLES = 'goalscan_championship_tables';
const STORAGE_KEY_SERVICE_STATUS = 'goalscan_supabase_status';

// Cache de status do serviço (evita requisições repetidas quando serviço está indisponível)
interface ServiceStatus {
  isUnavailable: boolean;
  lastCheck: number;
  retryAfter: number; // timestamp para próxima tentativa
}

const SERVICE_STATUS_CACHE_DURATION = 60000; // 1 minuto
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

// Proteção contra requisições excessivas
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 segundos entre requisições

/**
 * Verifica se um erro é um erro HTTP temporário (503, 502, 504, etc)
 */
function isTemporaryError(error: unknown): boolean {
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
 * Verifica se um erro é um erro de constraint violation (400)
 * Especificamente para detectar problemas com table_type constraint
 */
function isConstraintError(error: unknown): boolean {
  if (!error) return false;
  
  const err = error as { 
    message?: string; 
    code?: string | number; 
    status?: number;
    statusCode?: number;
    details?: string;
  };
  
  // Verificar status code 400
  const statusCode = err.status || err.statusCode || 
    (typeof err.code === 'number' ? err.code : null);
  
  if (statusCode === 400) {
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
function getServiceStatus(): ServiceStatus | null {
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
function setServiceStatus(isUnavailable: boolean, retryAfter: number = 0): void {
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
function clearServiceStatus(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SERVICE_STATUS);
  } catch {
    // Ignorar erros
  }
}

/**
 * Executa uma operação com retry e backoff exponencial
 */
async function withRetry<T>(
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

    const saved: Championship = {
      id: result.id,
      nome: result.nome,
      fbrefUrl: (result as { fbref_url?: string }).fbref_url || null,
      table_format: (result as { table_format?: string }).table_format as TableFormat | undefined || null,
      created_at: result.created_at,
      updated_at: result.updated_at,
      uploaded_at: (result as { uploaded_at?: string }).uploaded_at,
    };

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
 * Carrega todas as tabelas de um campeonato
 */
export const loadChampionshipTables = async (
  championshipId: string
): Promise<ChampionshipTable[]> => {
  try {
    const parseTimeMs = (value?: string): number => {
      if (!value) return 0;
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? ms : 0;
    };

    const getRecencyMs = (t: ChampionshipTable): number => {
      return Math.max(parseTimeMs(t.updated_at), parseTimeMs(t.created_at));
    };

    const dedupeLatestByType = (tables: ChampionshipTable[]): ChampionshipTable[] => {
      const byType = new Map<string, ChampionshipTable>();
      for (const t of tables) {
        const key = String(t.table_type);
        const existing = byType.get(key);
        if (!existing) {
          byType.set(key, t);
          continue;
        }
        if (getRecencyMs(t) >= getRecencyMs(existing)) {
          byType.set(key, t);
        }
      }
      return Array.from(byType.values());
    };

    const result = await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('championship_tables')
        .select('*')
        .eq('championship_id', championshipId)
        .order('table_type', { ascending: true });

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return loadChampionshipTablesFromLocalStorage(championshipId);
        }
        
        if (isTemporaryError(error)) {
          throw error;
        }
        
        logger.error('[ChampionshipService] Erro ao carregar tabelas:', error);
        return loadChampionshipTablesFromLocalStorage(championshipId);
      }

      if (!data) {
        return loadChampionshipTablesFromLocalStorage(championshipId);
      }

      return data;
    }, `Carregamento de tabelas do campeonato ${championshipId}`);

    const tablesRaw = (result as ChampionshipTableRow[]).map((row: ChampionshipTableRow) => ({
      id: row.id,
      championship_id: row.championship_id,
      table_type: row.table_type,
      table_name: row.table_name,
      table_data: row.table_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // Deduplicar por table_type (pegar a mais recente por updated_at/created_at)
    const tables = dedupeLatestByType(tablesRaw);

    // Sincronizar com localStorage
    saveChampionshipTablesToLocalStorage(tables);
    clearServiceStatus();

    return tables;
  } catch (error: unknown) {
    if (isTemporaryError(error)) {
      setServiceStatus(true, Date.now() + SERVICE_STATUS_CACHE_DURATION);
    } else {
      logger.error('[ChampionshipService] Erro ao carregar tabelas:', error);
    }
    return loadChampionshipTablesFromLocalStorage(championshipId);
  }
};

/**
 * Salva ou atualiza uma tabela de campeonato
 */
export const saveChampionshipTable = async (
  table: ChampionshipTable
): Promise<ChampionshipTable> => {
  // Verificar cache de status do serviço ANTES de fazer qualquer requisição
  const serviceStatus = getServiceStatus();
  if (serviceStatus?.isUnavailable && Date.now() < serviceStatus.retryAfter) {
    // Serviço está conhecidamente indisponível - salvar apenas no localStorage silenciosamente
    return saveChampionshipTableToLocalStorage(table);
  }

  try {
    const result = await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('championship_tables')
        .upsert(
          {
            id: table.id,
            championship_id: table.championship_id,
            table_type: table.table_type,
            table_name: table.table_name,
            table_data: table.table_data,
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
          return saveChampionshipTableToLocalStorage(table);
        }
        
        // Se for erro de constraint (ex: table_type não permitido), fazer fallback para localStorage
        if (isConstraintError(error)) {
          if (import.meta.env.DEV) {
            logger.warn(
              '[ChampionshipService] Erro de constraint ao salvar tabela. ' +
              'A constraint do banco pode não permitir o table_type. ' +
              'Salvando apenas no localStorage. Execute a migração update_championship_tables_constraint.sql no Supabase.',
              error
            );
          }
          return saveChampionshipTableToLocalStorage(table);
        }
        
        if (isTemporaryError(error)) {
          throw error;
        }
        
        // Apenas logar erros não temporários e apenas em modo dev
        if (import.meta.env.DEV) {
          logger.error('[ChampionshipService] Erro ao salvar tabela:', error);
        }
        throw error;
      }

      return data;
    }, `Salvamento de tabela ${table.id}`);

    const saved: ChampionshipTable = {
      id: result.id,
      championship_id: result.championship_id,
      table_type: result.table_type,
      table_name: result.table_name,
      table_data: result.table_data,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };

    // Se for tabela do tipo 'geral', também salvar na tabela normalizada
    if (table.table_type === 'geral' && Array.isArray(table.table_data)) {
      try {
        await saveChampionshipTeamsNormalized(
          table.championship_id,
          table.table_name,
          table.table_data as TableRowGeral[]
        );
        
        // Atualizar uploaded_at no campeonato
        await updateChampionshipUploadedAt(table.championship_id);
      } catch (error) {
        // Log mas não falhar o salvamento da tabela JSONB
        if (import.meta.env.DEV) {
          logger.warn('[ChampionshipService] Erro ao salvar dados normalizados:', error);
        }
      }
    }

    // Sincronizar com localStorage
    const tables = await loadChampionshipTables(table.championship_id);
    const updated = tables.filter((t) => t.id !== saved.id);
    updated.push(saved);
    saveChampionshipTablesToLocalStorage(updated);
    clearServiceStatus();

    return saved;
  } catch (error: unknown) {
    if (isTemporaryError(error)) {
      setServiceStatus(true, Date.now() + SERVICE_STATUS_CACHE_DURATION);
      // Não logar - erro temporário esperado, já tratado
    } else {
      // Apenas logar erros não temporários e apenas em modo dev
      if (import.meta.env.DEV) {
        logger.error('[ChampionshipService] Erro ao salvar tabela:', error);
      }
    }
    return saveChampionshipTableToLocalStorage(table);
  }
};

/**
 * Obtém lista de Squads de uma tabela específica
 */
export const getSquadsFromTable = async (
  championshipId: string,
  tableType: TableType = 'geral'
): Promise<string[]> => {
  try {
    // Para tabela geral, buscar de championship_teams (normalizada)
    if (tableType === 'geral') {
      const teams = await loadChampionshipTeams(championshipId);
      return teams.map((team) => team.squad).filter((squad) => squad && squad.trim() !== '');
    }

    // Para outros tipos de tabela (ex: standard_for), ainda usar championship_tables
    const tables = await loadChampionshipTables(championshipId);
    const table = tables.find((t) => t.table_type === tableType);

    if (!table || !table.table_data) {
      return [];
    }

    // Tentar extrair campo "Squad" se existir
    if (Array.isArray(table.table_data)) {
      const rows = table.table_data as Array<{ Squad?: string; [key: string]: unknown }>;
      return rows
        .map((row) => row.Squad)
        .filter((squad): squad is string => typeof squad === 'string' && squad.trim() !== '');
    }

    return [];
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao obter Squads:', error);
    return [];
  }
};

/**
 * Obtém dados de uma equipe específica da tabela do campeonato
 * Para tabela geral, busca de championship_teams e converte para TableRowGeral
 * Para outros tipos, ainda usa championship_tables (compatibilidade)
 */
export const getTeamDataFromTable = async (
  championshipId: string,
  squad: string,
  tableType: TableType = 'geral'
): Promise<TableRowGeral | null> => {
  try {
    // Para tabela geral, buscar de championship_teams (normalizada)
    if (tableType === 'geral') {
      const teams = await loadChampionshipTeams(championshipId);
      const team = teams.find((t) => t.squad === squad);
      
      if (!team) {
        return null;
      }

      // Converter para TableRowGeral (usar campos Home como padrão)
      // Nota: Esta função não sabe se o time é home ou away, então retorna ambos os campos
      const row: TableRowGeral = {
        Rk: team.rk || '',
        Squad: team.squad,
        'Home MP': team.home_mp,
        'Home W': team.home_w,
        'Home D': team.home_d,
        'Home L': team.home_l,
        'Home GF': team.home_gf,
        'Home GA': team.home_ga,
        'Home GD': team.home_gd,
        'Home Pts': team.home_pts,
        'Home Pts/MP': team.home_pts_mp,
        'Home xG': team.home_xg,
        'Home xGA': team.home_xga,
        'Home xGD': team.home_xgd,
        'Home xGD/90': team.home_xgd_90,
        'Away MP': team.away_mp,
        'Away W': team.away_w,
        'Away D': team.away_d,
        'Away L': team.away_l,
        'Away GF': team.away_gf,
        'Away GA': team.away_ga,
        'Away GD': team.away_gd,
        'Away Pts': team.away_pts,
        'Away Pts/MP': team.away_pts_mp,
        'Away xG': team.away_xg,
        'Away xGA': team.away_xga,
        'Away xGD': team.away_xgd,
        'Away xGD/90': team.away_xgd_90,
      };

      // Adicionar campos extras se existirem
      if (team.extra_fields && typeof team.extra_fields === 'object') {
        for (const [key, value] of Object.entries(team.extra_fields)) {
          if (!row.hasOwnProperty(key)) {
            row[key] = value;
          }
        }
      }

      return row;
    }

    // Para outros tipos de tabela, ainda usar championship_tables
    const tables = await loadChampionshipTables(championshipId);
    const table = tables.find((t) => t.table_type === tableType);

    if (!table || !table.table_data || !Array.isArray(table.table_data)) {
      return null;
    }

    const rows = table.table_data as TableRowGeral[];
    const teamRow = rows.find((row) => row.Squad === squad);

    return teamRow || null;
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao obter dados da equipe:', error);
    return null;
  }
};

/**
 * Calcula a média de gols por partida do campeonato baseado na tabela
 * Fórmula: (soma de todos os gols marcados) / (número total de partidas)
 * Como cada partida envolve 2 times: média = 2 * soma(GF) / soma(MP)
 */
export const calculateCompetitionAverageGoals = async (
  championshipId: string,
  tableType: TableType = 'geral'
): Promise<number | null> => {
  try {
    const tables = await loadChampionshipTables(championshipId);
    const table = tables.find((t) => t.table_type === tableType);

    if (!table || !table.table_data || !Array.isArray(table.table_data)) {
      return null;
    }

    const rows = table.table_data as TableRowGeral[];
    
    if (rows.length === 0) {
      return null;
    }

    let totalGoals = 0; // Soma de todos os gols marcados (GF)
    let totalMatches = 0; // Soma de todas as partidas jogadas (MP)

    for (const row of rows) {
      // Tentar usar campos Home/Away primeiro (estrutura do CSV)
      const homeGf = parseFloat(row['Home GF'] || '0');
      const homeMp = parseFloat(row['Home MP'] || '0');
      const awayGf = parseFloat(row['Away GF'] || '0');
      const awayMp = parseFloat(row['Away MP'] || '0');
      
      // Se tiver campos Home/Away, usar eles
      if (!isNaN(homeMp) && homeMp > 0) {
        totalGoals += homeGf;
        totalMatches += homeMp;
      }
      if (!isNaN(awayMp) && awayMp > 0) {
        totalGoals += awayGf;
        totalMatches += awayMp;
      }
      
      // Se não tiver campos Home/Away, tentar campos gerais (formato antigo)
      if (isNaN(homeMp) && isNaN(awayMp)) {
        const gf = parseFloat(row.GF || '0');
        const mp = parseFloat(row.MP || '0');

        if (!isNaN(gf) && !isNaN(mp) && mp > 0) {
          totalGoals += gf;
          totalMatches += mp;
        }
      }
    }

    if (totalMatches === 0) {
      return null;
    }

    // Média de gols por partida = 2 * totalGoals / totalMatches
    // (multiplicamos por 2 porque cada partida envolve 2 times)
    const averageGoals = (2 * totalGoals) / totalMatches;

    // Arredondar para 2 casas decimais
    return Math.round(averageGoals * 100) / 100;
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao calcular média de gols do campeonato:', error);
    }
    return null;
  }
};

function parseNumberFromUnknown(value: unknown): number {
  if (value == null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.replace(/,/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Calcula média de gols do campeonato a partir de ChampionshipTeam[]
 * Usa campos Home/Away: soma(Home GF) + soma(Away GF) / soma(Home MP) + soma(Away MP)
 */
function calculateCompetitionAverageGoalsFromTeams(teams: ChampionshipTeam[]): number | null {
  if (!Array.isArray(teams) || teams.length === 0) return null;

  let totalGoals = 0;
  let totalMatches = 0;

  for (const team of teams) {
    // Usar campos Home
    const homeGf = parseNumberFromUnknown(team.home_gf);
    const homeMp = parseNumberFromUnknown(team.home_mp);
    if (homeGf > 0 && homeMp > 0) {
      totalGoals += homeGf;
      totalMatches += homeMp;
    } else if (homeMp > 0) {
      totalMatches += homeMp;
    }

    // Usar campos Away
    const awayGf = parseNumberFromUnknown(team.away_gf);
    const awayMp = parseNumberFromUnknown(team.away_mp);
    if (awayGf > 0 && awayMp > 0) {
      totalGoals += awayGf;
      totalMatches += awayMp;
    } else if (awayMp > 0) {
      totalMatches += awayMp;
    }
  }

  if (totalMatches === 0) return null;
  // Média de gols por partida = 2 * totalGoals / totalMatches
  // (multiplicamos por 2 porque cada partida envolve 2 times)
  const averageGoals = (2 * totalGoals) / totalMatches;
  return Math.round(averageGoals * 100) / 100;
}

/**
 * Calcula média de gols do campeonato a partir de TableRowGeral[]
 * Usa campos Home/Away quando disponíveis, fallback para campos gerais (compatibilidade)
 */
function calculateCompetitionAverageGoalsFromRows(rows: TableRowGeral[]): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let totalGoals = 0;
  let totalMatches = 0;

  for (const row of rows) {
    // Tentar usar campos Home/Away primeiro (estrutura do CSV)
    const homeGf = parseNumberFromUnknown(row['Home GF']);
    const homeMp = parseNumberFromUnknown(row['Home MP']);
    const awayGf = parseNumberFromUnknown(row['Away GF']);
    const awayMp = parseNumberFromUnknown(row['Away MP']);

    if (homeMp > 0 || awayMp > 0) {
      // Usar campos Home/Away
      if (homeGf > 0 && homeMp > 0) {
        totalGoals += homeGf;
        totalMatches += homeMp;
      } else if (homeMp > 0) {
        totalMatches += homeMp;
      }

      if (awayGf > 0 && awayMp > 0) {
        totalGoals += awayGf;
        totalMatches += awayMp;
      } else if (awayMp > 0) {
        totalMatches += awayMp;
      }
    } else {
      // Fallback para campos gerais (formato antigo - compatibilidade)
      const gf = parseNumberFromUnknown(row.GF);
      const mp = parseNumberFromUnknown(row.MP);
      if (gf > 0 && mp > 0) {
        totalGoals += gf;
        totalMatches += mp;
      } else if (mp > 0) {
        totalMatches += mp;
      }
    }
  }

  if (totalMatches === 0) return null;
  const averageGoals = (2 * totalGoals) / totalMatches;
  return Math.round(averageGoals * 100) / 100;
}

function calculateCompetitionStandardForAveragesFromRows(
  rows: TableRowStandardFor[]
): CompetitionStandardForAverages | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let possSum = 0;
  let possCount = 0;

  let npxGxAG90Sum = 0;
  let npxGxAG90Count = 0;

  let prgPSum = 0;
  let prgPCount = 0;

  let prgCSum = 0;
  let prgCCount = 0;

  for (const row of rows) {
    const poss = parseNumberFromUnknown(row.Poss);
    if (poss > 0) {
      possSum += poss;
      possCount += 1;
    }

    const npx = parseNumberFromUnknown(row['Per 90 Minutes npxG+xAG']);
    const xg = parseNumberFromUnknown(row['Per 90 Minutes xG+xAG']);
    const quality = npx > 0 ? npx : xg;
    if (quality > 0) {
      npxGxAG90Sum += quality;
      npxGxAG90Count += 1;
    }

    const mp = parseNumberFromUnknown(row['Playing Time MP']);
    const prgP = parseNumberFromUnknown(row['Progression PrgP']);
    const prgC = parseNumberFromUnknown(row['Progression PrgC']);

    if (mp > 0 && prgP > 0) {
      prgPSum += prgP / mp;
      prgPCount += 1;
    }
    if (mp > 0 && prgC > 0) {
      prgCSum += prgC / mp;
      prgCCount += 1;
    }
  }

  const possAvg = possCount > 0 ? possSum / possCount : 0;
  const npxGxAG90Avg = npxGxAG90Count > 0 ? npxGxAG90Sum / npxGxAG90Count : 0;
  const prgPPerMatchAvg = prgPCount > 0 ? prgPSum / prgPCount : 0;
  const prgCPerMatchAvg = prgCCount > 0 ? prgCSum / prgCCount : 0;

  if (possAvg <= 0 && npxGxAG90Avg <= 0 && prgPPerMatchAvg <= 0 && prgCPerMatchAvg <= 0) {
    return null;
  }

  return {
    poss: Math.round(possAvg * 100) / 100,
    npxGxAG90: Math.round(npxGxAG90Avg * 100) / 100,
    prgPPerMatch: Math.round(prgPPerMatchAvg * 100) / 100,
    prgCPerMatch: Math.round(prgCPerMatchAvg * 100) / 100,
  };
}

/**
 * Converte ChampionshipTeam para TableRowGeral com campos Home/Away
 * Para time da casa: inclui campos Home do próprio time
 * Para time visitante: inclui campos Away do próprio time
 */
function convertChampionshipTeamToTableRowGeral(
  team: ChampionshipTeam,
  isHome: boolean
): TableRowGeral {
  const baseRow: TableRowGeral = {
    Rk: team.rk || '',
    Squad: team.squad,
  };

  if (isHome) {
    // Time da casa: usar campos Home
    baseRow['Home MP'] = team.home_mp;
    baseRow['Home W'] = team.home_w;
    baseRow['Home D'] = team.home_d;
    baseRow['Home L'] = team.home_l;
    baseRow['Home GF'] = team.home_gf;
    baseRow['Home GA'] = team.home_ga;
    baseRow['Home GD'] = team.home_gd;
    baseRow['Home Pts'] = team.home_pts;
    baseRow['Home Pts/MP'] = team.home_pts_mp;
    baseRow['Home xG'] = team.home_xg;
    baseRow['Home xGA'] = team.home_xga;
    baseRow['Home xGD'] = team.home_xgd;
    baseRow['Home xGD/90'] = team.home_xgd_90;
  } else {
    // Time visitante: usar campos Away
    baseRow['Away MP'] = team.away_mp;
    baseRow['Away W'] = team.away_w;
    baseRow['Away D'] = team.away_d;
    baseRow['Away L'] = team.away_l;
    baseRow['Away GF'] = team.away_gf;
    baseRow['Away GA'] = team.away_ga;
    baseRow['Away GD'] = team.away_gd;
    baseRow['Away Pts'] = team.away_pts;
    baseRow['Away Pts/MP'] = team.away_pts_mp;
    baseRow['Away xG'] = team.away_xg;
    baseRow['Away xGA'] = team.away_xga;
    baseRow['Away xGD'] = team.away_xgd;
    baseRow['Away xGD/90'] = team.away_xgd_90;
  }

  // Adicionar campos extras se existirem
  if (team.extra_fields && typeof team.extra_fields === 'object') {
    for (const [key, value] of Object.entries(team.extra_fields)) {
      if (!baseRow.hasOwnProperty(key)) {
        baseRow[key] = value;
      }
    }
  }

  return baseRow;
}

/**
 * Sincroniza dados completos da tabela do campeonato para ambas equipes
 * Busca dados da tabela normalizada championship_teams (com campos Home/Away)
 * Retorna TODOS os campos da tabela para análise pela IA
 */
export const syncTeamStatsFromTable = async (
  championshipId: string,
  homeSquad: string,
  awaySquad: string
): Promise<{
  homeTableData: TableRowGeral | null;
  awayTableData: TableRowGeral | null;
  competitionAvg?: number; // Média de gols do campeonato calculada automaticamente
  homeStandardForData?: TableRowStandardFor | null;
  awayStandardForData?: TableRowStandardFor | null;
  competitionStandardForAvg?: CompetitionStandardForAverages | null;
}> => {
  try {
    // Carregar times normalizados da tabela championship_teams
    const teams = await loadChampionshipTeams(championshipId);

    const homeTeam = teams.find((t) => t.squad === homeSquad) || null;
    const awayTeam = teams.find((t) => t.squad === awaySquad) || null;

    // Converter ChampionshipTeam para TableRowGeral
    // Para time da casa: usar campos Home do próprio time
    // Para time visitante: usar campos Away do próprio time
    const homeData = homeTeam ? convertChampionshipTeamToTableRowGeral(homeTeam, true) : null;
    const awayData = awayTeam ? convertChampionshipTeamToTableRowGeral(awayTeam, false) : null;

    // Calcular média de gols do campeonato usando todos os times
    const competitionAvg = calculateCompetitionAverageGoalsFromTeams(teams);

    // Complemento (standard_for) - opcional (ainda usa championship_tables)
    const tables = await loadChampionshipTables(championshipId);
    const standardForTable = tables.find((t) => t.table_type === 'standard_for');
    const standardForRows = Array.isArray(standardForTable?.table_data)
      ? (standardForTable?.table_data as TableRowStandardFor[])
      : [];

    const homeStandardForData =
      standardForRows.find((row) => row.Squad === homeSquad) || null;
    const awayStandardForData =
      standardForRows.find((row) => row.Squad === awaySquad) || null;

    const competitionStandardForAvg = calculateCompetitionStandardForAveragesFromRows(standardForRows);

    return {
      homeTableData: homeData,
      awayTableData: awayData,
      competitionAvg: competitionAvg || undefined,
      homeStandardForData,
      awayStandardForData,
      competitionStandardForAvg,
    };
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao sincronizar dados da tabela:', error);
    return {
      homeTableData: null,
      awayTableData: null,
      homeStandardForData: null,
      awayStandardForData: null,
      competitionStandardForAvg: null,
    };
  }
};

/**
 * Converte dados do JSON/CSV para formato normalizado
 * Suporta estrutura do CSV (Home/Away) e formato antigo (geral)
 */
function normalizeTeamData(
  championshipId: string,
  tableName: string,
  row: TableRowGeral
): ChampionshipTeam {
  // Separar campos conhecidos de campos extras
  const knownFields = new Set([
    'Rk', 'Squad',
    // Campos Home
    'Home MP', 'Home W', 'Home D', 'Home L', 'Home GF', 'Home GA', 'Home GD',
    'Home Pts', 'Home Pts/MP', 'Home xG', 'Home xGA', 'Home xGD', 'Home xGD/90',
    // Campos Away
    'Away MP', 'Away W', 'Away D', 'Away L', 'Away GF', 'Away GA', 'Away GD',
    'Away Pts', 'Away Pts/MP', 'Away xG', 'Away xGA', 'Away xGD', 'Away xGD/90',
    // Campos gerais (formato antigo - para compatibilidade)
    'MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Pts/MP', 'xG', 'xGA', 'xGD', 'xGD/90',
    'Last 5', 'Attendance', 'Top Team Scorer', 'Goalkeeper', 'Notes',
    // Campos de link (ignorados)
    'Top Team Scorer_link', 'Goalkeeper_link',
  ]);

  // Coletar campos extras (que não são conhecidos)
  const extraFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!knownFields.has(key) && key !== 'Squad' && key !== 'Rk') {
      extraFields[key] = value;
    }
  }

  // Criar objeto normalizado
  const normalized: ChampionshipTeam = {
    id: `${championshipId}_${row.Squad}_${Date.now()}`,
    championship_id: championshipId,
    squad: row.Squad,
    table_name: tableName,
    rk: row.Rk,
    
    // Campos Home (prioridade: usar campos Home do CSV)
    home_mp: row['Home MP'] || undefined,
    home_w: row['Home W'] || undefined,
    home_d: row['Home D'] || undefined,
    home_l: row['Home L'] || undefined,
    home_gf: row['Home GF'] || undefined,
    home_ga: row['Home GA'] || undefined,
    home_gd: row['Home GD'] || undefined,
    home_pts: row['Home Pts'] || undefined,
    home_pts_mp: row['Home Pts/MP'] || undefined,
    home_xg: row['Home xG'] || undefined,
    home_xga: row['Home xGA'] || undefined,
    home_xgd: row['Home xGD'] || undefined,
    home_xgd_90: row['Home xGD/90'] || undefined,
    
    // Campos Away
    away_mp: row['Away MP'] || undefined,
    away_w: row['Away W'] || undefined,
    away_d: row['Away D'] || undefined,
    away_l: row['Away L'] || undefined,
    away_gf: row['Away GF'] || undefined,
    away_ga: row['Away GA'] || undefined,
    away_gd: row['Away GD'] || undefined,
    away_pts: row['Away Pts'] || undefined,
    away_pts_mp: row['Away Pts/MP'] || undefined,
    away_xg: row['Away xG'] || undefined,
    away_xga: row['Away xGA'] || undefined,
    away_xgd: row['Away xGD'] || undefined,
    away_xgd_90: row['Away xGD/90'] || undefined,
    
    // Campos extras (se houver)
    extra_fields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
    
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return normalized;
}

/**
 * Detecta o formato da planilha baseado nos dados existentes no banco
 */
export const detectChampionshipTableFormat = async (
  championshipId: string
): Promise<TableFormat | null> => {
  try {
    const supabase = await getSupabaseClient();
    
    // Chamar função SQL de detecção
    const { data, error } = await supabase.rpc('detect_championship_table_format', {
      champ_id: championshipId,
    });

    if (error) {
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Erro ao detectar formato:', error);
      }
      return null;
    }

    return (data as TableFormat) || null;
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao detectar formato:', error);
    }
    return null;
  }
};

/**
 * Atualiza o formato da planilha do campeonato
 */
export const updateChampionshipTableFormat = async (
  championshipId: string,
  tableFormat: TableFormat
): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('championships')
      .update({ table_format: tableFormat })
      .eq('id', championshipId);

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Tabela não existe ou coluna não existe ainda
        return;
      }
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Erro ao atualizar table_format:', error);
      }
    }
  } catch (error: unknown) {
    // Ignorar erros silenciosamente
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao atualizar table_format:', error);
    }
  }
};

/**
 * Salva dados normalizados dos times na tabela championship_teams
 * Substitui dados existentes do campeonato (DELETE + INSERT)
 * Detecta e atualiza automaticamente o formato da planilha
 */
export const saveChampionshipTeamsNormalized = async (
  championshipId: string,
  tableName: string,
  teamsData: TableRowGeral[]
): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();

    // 1. Detectar formato da planilha automaticamente
    const detectedFormat = detectTableFormatFromData(teamsData);
    
    // 2. Atualizar formato no campeonato (se ainda não estiver definido ou se detectado for diferente)
    const championship = await loadChampionship(championshipId);
    if (championship && (!championship.table_format || championship.table_format !== detectedFormat)) {
      await updateChampionshipTableFormat(championshipId, detectedFormat);
    }

    // 3. Deletar dados existentes do campeonato
    const { error: deleteError } = await supabase
      .from('championship_teams')
      .delete()
      .eq('championship_id', championshipId);

    if (deleteError && deleteError.code !== 'PGRST116' && deleteError.code !== '42P01') {
      // Ignorar erro se tabela não existe ainda
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Erro ao deletar times existentes:', deleteError);
      }
    }

    // 4. Normalizar e inserir novos dados
    const normalizedTeams = teamsData.map((row) =>
      normalizeTeamData(championshipId, tableName, row)
    );

    if (normalizedTeams.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from('championship_teams')
      .insert(normalizedTeams);

    if (insertError) {
      if (insertError.code === 'PGRST116' || insertError.code === '42P01') {
        // Tabela não existe ainda, apenas logar em dev
        if (import.meta.env.DEV) {
          logger.warn(
            '[ChampionshipService] Tabela championship_teams não encontrada. ' +
            'Execute a migração create_championship_teams.sql no Supabase.'
          );
        }
        return;
      }
      throw insertError;
    }

    if (import.meta.env.DEV) {
      logger.log(
        `[ChampionshipService] ${normalizedTeams.length} time(s) normalizado(s) salvo(s) para campeonato ${championshipId} (formato: ${detectedFormat})`
      );
    }
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao salvar times normalizados:', error);
    }
    throw error;
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

/**
 * Carrega times normalizados de um campeonato
 */
export const loadChampionshipTeams = async (
  championshipId: string
): Promise<ChampionshipTeam[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('championship_teams')
      .select('*')
      .eq('championship_id', championshipId)
      .order('rk', { ascending: true });

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Tabela não existe ainda
        return [];
      }
      throw error;
    }

    if (!data) {
      return [];
    }

    return (data as ChampionshipTeamRow[]).map((row) => ({
      id: row.id,
      championship_id: row.championship_id,
      squad: row.squad,
      table_name: row.table_name,
      rk: row.rk,
      
      // Campos Home
      home_mp: row.home_mp,
      home_w: row.home_w,
      home_d: row.home_d,
      home_l: row.home_l,
      home_gf: row.home_gf,
      home_ga: row.home_ga,
      home_gd: row.home_gd,
      home_pts: row.home_pts,
      home_pts_mp: row.home_pts_mp,
      home_xg: row.home_xg,
      home_xga: row.home_xga,
      home_xgd: row.home_xgd,
      home_xgd_90: row.home_xgd_90,
      
      // Campos Away
      away_mp: row.away_mp,
      away_w: row.away_w,
      away_d: row.away_d,
      away_l: row.away_l,
      away_gf: row.away_gf,
      away_ga: row.away_ga,
      away_gd: row.away_gd,
      away_pts: row.away_pts,
      away_pts_mp: row.away_pts_mp,
      away_xg: row.away_xg,
      away_xga: row.away_xga,
      away_xgd: row.away_xgd,
      away_xgd_90: row.away_xgd_90,
      
      // Campos extras
      extra_fields: row.extra_fields,
      
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao carregar times normalizados:', error);
    }
    return [];
  }
};

/**
 * Tipo para diagnóstico de disponibilidade de tabelas
 */
export interface ChampionshipTablesDiagnostic {
  allTablesExist: boolean;
  missingTables: TableType[];
  emptyTables: TableType[];
  tables: Record<TableType, { exists: boolean; hasData: boolean; rowCount?: number }>;
}

/**
 * Verifica a disponibilidade das tabelas de um campeonato
 * @param championshipId ID do campeonato
 * @param homeSquad Nome do time da casa (opcional)
 * @param awaySquad Nome do time visitante (opcional)
 * @returns Diagnóstico das tabelas disponíveis
 */
export const checkChampionshipTablesAvailability = async (
  championshipId: string,
  homeSquad?: string,
  awaySquad?: string
): Promise<ChampionshipTablesDiagnostic> => {
  try {
    // Carregar tabelas do campeonato
    const tables = await loadChampionshipTables(championshipId);
    
    // Verificar tabela geral (pode vir de championship_teams ou championship_tables)
    const geralTable = tables.find((t) => t.table_type === 'geral');
    const geralRows = Array.isArray(geralTable?.table_data)
      ? (geralTable.table_data as TableRowGeral[])
      : [];
    
    // Verificar se há times na tabela normalizada (championship_teams)
    const teams = await loadChampionshipTeams(championshipId);
    const hasGeralData = teams.length > 0 || geralRows.length > 0;
    
    // Verificar se os times específicos existem (se fornecidos)
    let hasHomeSquad = true;
    let hasAwaySquad = true;
    if (homeSquad) {
      hasHomeSquad = teams.some((t) => t.squad === homeSquad) || 
                     geralRows.some((r) => r.Squad === homeSquad);
    }
    if (awaySquad) {
      hasAwaySquad = teams.some((t) => t.squad === awaySquad) || 
                     geralRows.some((r) => r.Squad === awaySquad);
    }
    
    // Verificar tabela standard_for
    const standardForTable = tables.find((t) => t.table_type === 'standard_for');
    const standardForRows = Array.isArray(standardForTable?.table_data)
      ? (standardForTable.table_data as unknown[])
      : [];
    const hasStandardForData = standardForRows.length > 0;
    
    // Construir diagnóstico
    const diagnostic: ChampionshipTablesDiagnostic = {
      allTablesExist: hasGeralData && hasStandardForData,
      missingTables: [],
      emptyTables: [],
      tables: {
        geral: {
          exists: hasGeralData,
          hasData: hasGeralData && (hasHomeSquad && hasAwaySquad),
          rowCount: teams.length || geralRows.length,
        },
        standard_for: {
          exists: !!standardForTable,
          hasData: hasStandardForData,
          rowCount: standardForRows.length,
        },
      },
    };
    
    // Identificar tabelas faltantes ou vazias
    if (!hasGeralData) {
      diagnostic.missingTables.push('geral');
    } else if (!hasHomeSquad || !hasAwaySquad) {
      diagnostic.emptyTables.push('geral');
    }
    
    if (!standardForTable) {
      diagnostic.missingTables.push('standard_for');
    } else if (!hasStandardForData) {
      diagnostic.emptyTables.push('standard_for');
    }
    
    return diagnostic;
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao verificar disponibilidade de tabelas:', error);
    }
    
    // Retornar diagnóstico vazio em caso de erro
    return {
      allTablesExist: false,
      missingTables: ['geral', 'standard_for'],
      emptyTables: [],
      tables: {
        geral: { exists: false, hasData: false },
        standard_for: { exists: false, hasData: false },
      },
    };
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
  const tables = loadChampionshipTablesFromLocalStorage(id);
  tables.forEach((table) => {
    deleteChampionshipTableFromLocalStorage(table.id);
  });
}

function loadChampionshipTablesFromLocalStorage(championshipId: string): ChampionshipTable[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHAMPIONSHIP_TABLES);
    if (!stored) return [];
    const allTables = JSON.parse(stored) as ChampionshipTable[];
    const filtered = allTables.filter((t) => t.championship_id === championshipId);

    // Deduplicar por table_type (pegar a mais recente por updated_at/created_at)
    const parseTimeMs = (value?: string): number => {
      if (!value) return 0;
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? ms : 0;
    };
    const getRecencyMs = (t: ChampionshipTable): number =>
      Math.max(parseTimeMs(t.updated_at), parseTimeMs(t.created_at));

    const byType = new Map<string, ChampionshipTable>();
    for (const t of filtered) {
      const key = String(t.table_type);
      const existing = byType.get(key);
      if (!existing || getRecencyMs(t) >= getRecencyMs(existing)) {
        byType.set(key, t);
      }
    }

    return Array.from(byType.values());
  } catch {
    return [];
  }
}

function saveChampionshipTablesToLocalStorage(tables: ChampionshipTable[]): void {
  try {
    // Carregar todas as tabelas e mesclar
    const stored = localStorage.getItem(STORAGE_KEY_CHAMPIONSHIP_TABLES);
    let allTables: ChampionshipTable[] = [];
    if (stored) {
      try {
        allTables = JSON.parse(stored) as ChampionshipTable[];
      } catch {
        allTables = [];
      }
    }

    // Remover tabelas do mesmo campeonato e adicionar as novas
    const championshipId = tables[0]?.championship_id;
    if (championshipId) {
      allTables = allTables.filter((t) => t.championship_id !== championshipId);
    }
    allTables.push(...tables);

    localStorage.setItem(STORAGE_KEY_CHAMPIONSHIP_TABLES, JSON.stringify(allTables));
  } catch (error) {
    logger.error('[ChampionshipService] Erro ao salvar tabelas no localStorage:', error);
  }
}

function saveChampionshipTableToLocalStorage(table: ChampionshipTable): ChampionshipTable {
  const tables = loadChampionshipTablesFromLocalStorage(table.championship_id);
  const existingIndex = tables.findIndex((t) => t.id === table.id);
  if (existingIndex >= 0) {
    tables[existingIndex] = table;
  } else {
    tables.push(table);
  }
  saveChampionshipTablesToLocalStorage(tables);
  return table;
}

function deleteChampionshipTableFromLocalStorage(tableId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHAMPIONSHIP_TABLES);
    if (!stored) return;
    const allTables = JSON.parse(stored) as ChampionshipTable[];
    const filtered = allTables.filter((t) => t.id !== tableId);
    localStorage.setItem(STORAGE_KEY_CHAMPIONSHIP_TABLES, JSON.stringify(filtered));
  } catch (error) {
    logger.error('[ChampionshipService] Erro ao deletar tabela do localStorage:', error);
  }
}

