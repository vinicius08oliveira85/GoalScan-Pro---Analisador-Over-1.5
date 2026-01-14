import {
  Championship,
  ChampionshipTable,
  CompetitionGcaForAverages,
  CompetitionPassingForAverages,
  CompetitionStandardForAverages,
  TableType,
  TableRowGcaFor,
  TableRowGeral,
  TableRowPassingFor,
  TableRowStandardFor,
} from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';

export interface ChampionshipRow {
  id: string;
  nome: string;
  fbref_url?: string | null;
  created_at?: string;
  updated_at?: string;
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
      fbrefUrl: row.fbref_url ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
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
        fbrefUrl: (data as unknown as { fbref_url?: string | null }).fbref_url ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
            fbref_url: championship.fbrefUrl ?? null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        )
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01' || error.code === '42703') {
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
      fbrefUrl: (result as unknown as { fbref_url?: string | null }).fbref_url ?? championship.fbrefUrl ?? null,
      created_at: result.created_at,
      updated_at: result.updated_at,
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
    const tables = await loadChampionshipTables(championshipId);
    const table = tables.find((t) => t.table_type === tableType);

    if (!table || !table.table_data) {
      return [];
    }

    // Se for tabela geral, extrair Squads
    if (tableType === 'geral' && Array.isArray(table.table_data)) {
      const rows = table.table_data as TableRowGeral[];
      return rows.map((row) => row.Squad).filter((squad) => squad && squad.trim() !== '');
    }

    // Para outros tipos de tabela, tentar extrair campo "Squad" se existir
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
 */
export const getTeamDataFromTable = async (
  championshipId: string,
  squad: string,
  tableType: TableType = 'geral'
): Promise<TableRowGeral | null> => {
  try {
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
      // Converter GF e MP para números
      const gf = parseFloat(row.GF || '0');
      const mp = parseFloat(row.MP || '0');

      if (!isNaN(gf) && !isNaN(mp) && mp > 0) {
        totalGoals += gf;
        totalMatches += mp;
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

function calculateCompetitionAverageGoalsFromRows(rows: TableRowGeral[]): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let totalGoals = 0;
  let totalMatches = 0;

  for (const row of rows) {
    const gf = parseNumberFromUnknown(row.GF);
    const mp = parseNumberFromUnknown(row.MP);
    if (gf > 0 && mp > 0) {
      totalGoals += gf;
      totalMatches += mp;
    } else if (mp > 0) {
      // mesmo com GF=0, conta a partida para média do campeonato
      totalMatches += mp;
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

function calculateCompetitionPassingForAveragesFromRows(
  rows: TableRowPassingFor[]
): CompetitionPassingForAverages | null {
  const parseNum = (value: unknown): number => {
    if (value == null) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const normalized = raw.replace(/,/g, '').replace(/%/g, '');
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const getPer90 = (row: Record<string, unknown>, per90Keys: string[], totalKeys: string[]): number => {
    for (const k of per90Keys) {
      const v = parseNum(row[k]);
      if (v > 0) return v;
    }
    const n90 =
      parseNum(row['90s']) ||
      parseNum(row['Playing Time 90s']) ||
      parseNum(row['Playing Time 90S']) ||
      parseNum(row['Playing Time 90s ']);

    for (const k of totalKeys) {
      const total = parseNum(row[k]);
      if (total > 0 && n90 > 0) return total / n90;
    }
    return 0;
  };

  let progSum = 0;
  let kpSum = 0;
  let ppaSum = 0;
  let countProg = 0;
  let countKp = 0;
  let countPpa = 0;

  for (const r of rows) {
    const row = r as unknown as Record<string, unknown>;

    const prog = getPer90(row, ['Per 90 Minutes Prog', 'Prog/90', 'Prog 90'], ['Prog']);
    if (prog > 0) {
      progSum += prog;
      countProg++;
    }

    const kp = getPer90(row, ['Per 90 Minutes KP', 'KP/90', 'KP 90'], ['KP']);
    if (kp > 0) {
      kpSum += kp;
      countKp++;
    }

    const ppa = getPer90(row, ['Per 90 Minutes PPA', 'PPA/90', 'PPA 90'], ['PPA']);
    if (ppa > 0) {
      ppaSum += ppa;
      countPpa++;
    }
  }

  const progAvg = countProg > 0 ? progSum / countProg : 0;
  const kpAvg = countKp > 0 ? kpSum / countKp : 0;
  const ppaAvg = countPpa > 0 ? ppaSum / countPpa : 0;

  if (progAvg <= 0 && kpAvg <= 0 && ppaAvg <= 0) return null;

  return {
    progPer90: Math.round(progAvg * 100) / 100,
    kpPer90: Math.round(kpAvg * 100) / 100,
    ppaPer90: Math.round(ppaAvg * 100) / 100,
  };
}

function calculateCompetitionGcaForAveragesFromRows(rows: TableRowGcaFor[]): CompetitionGcaForAverages | null {
  const parseNum = (value: unknown): number => {
    if (value == null) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const normalized = raw.replace(/,/g, '').replace(/%/g, '');
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const getPer90 = (row: Record<string, unknown>, per90Keys: string[], totalKeys: string[]): number => {
    for (const k of per90Keys) {
      const v = parseNum(row[k]);
      if (v > 0) return v;
    }
    const n90 =
      parseNum(row['90s']) ||
      parseNum(row['Playing Time 90s']) ||
      parseNum(row['Playing Time 90S']) ||
      parseNum(row['Playing Time 90s ']);

    for (const k of totalKeys) {
      const total = parseNum(row[k]);
      if (total > 0 && n90 > 0) return total / n90;
    }
    return 0;
  };

  let scaSum = 0;
  let gcaSum = 0;
  let countSca = 0;
  let countGca = 0;

  for (const r of rows) {
    const row = r as unknown as Record<string, unknown>;
    const sca = getPer90(row, ['SCA90', 'SCA 90', 'Per 90 Minutes SCA'], ['SCA']);
    if (sca > 0) {
      scaSum += sca;
      countSca++;
    }

    const gca = getPer90(row, ['GCA90', 'GCA 90', 'Per 90 Minutes GCA'], ['GCA']);
    if (gca > 0) {
      gcaSum += gca;
      countGca++;
    }
  }

  const scaAvg = countSca > 0 ? scaSum / countSca : 0;
  const gcaAvg = countGca > 0 ? gcaSum / countGca : 0;

  if (scaAvg <= 0 && gcaAvg <= 0) return null;

  return {
    scaPer90: Math.round(scaAvg * 100) / 100,
    gcaPer90: Math.round(gcaAvg * 100) / 100,
  };
}

/**
 * Sincroniza dados completos da tabela do campeonato para ambas equipes
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
  homePassingForData?: TableRowPassingFor | null;
  awayPassingForData?: TableRowPassingFor | null;
  competitionPassingForAvg?: CompetitionPassingForAverages | null;
  homeGcaForData?: TableRowGcaFor | null;
  awayGcaForData?: TableRowGcaFor | null;
  competitionGcaForAvg?: CompetitionGcaForAverages | null;
}> => {
  try {
    // Carregar tabelas uma única vez (evita múltiplas chamadas ao Supabase/localStorage)
    const tables = await loadChampionshipTables(championshipId);

    // Log: verificar quais tabelas foram carregadas
    if (import.meta.env.DEV) {
      console.log('[ChampionshipService] syncTeamStatsFromTable - Tabelas carregadas:', {
        total: tables.length,
        tipos: tables.map(t => t.table_type),
        homeSquad,
        awaySquad,
      });
    }

    const geralTable = tables.find((t) => t.table_type === 'geral');
    const geralRows = Array.isArray(geralTable?.table_data)
      ? (geralTable?.table_data as TableRowGeral[])
      : [];

    const homeData = geralRows.find((row) => row.Squad === homeSquad) || null;
    const awayData = geralRows.find((row) => row.Squad === awaySquad) || null;

    // Média de gols do campeonato (derivada da tabela geral)
    const competitionAvg = calculateCompetitionAverageGoalsFromRows(geralRows);

    // Complemento (standard_for) - opcional
    const standardForTable = tables.find((t) => t.table_type === 'standard_for');
    const standardForRows = Array.isArray(standardForTable?.table_data)
      ? (standardForTable?.table_data as TableRowStandardFor[])
      : [];

    const homeStandardForData =
      standardForRows.find((row) => row.Squad === homeSquad) || null;
    const awayStandardForData =
      standardForRows.find((row) => row.Squad === awaySquad) || null;

    const competitionStandardForAvg = calculateCompetitionStandardForAveragesFromRows(standardForRows);

    // Complementos adicionais (passing_for / gca_for) - opcionais
    const passingForTable = tables.find((t) => t.table_type === 'passing_for');
    const passingForRows = Array.isArray(passingForTable?.table_data)
      ? (passingForTable?.table_data as TableRowPassingFor[])
      : [];

    if (import.meta.env.DEV) {
      if (!passingForTable) {
        console.warn('[ChampionshipService] ⚠️ Tabela passing_for não encontrada para campeonato:', championshipId);
      } else if (passingForRows.length === 0) {
        console.warn('[ChampionshipService] ⚠️ Tabela passing_for está vazia');
      } else {
        console.log('[ChampionshipService] ✅ Tabela passing_for encontrada com', passingForRows.length, 'times');
        // Verificar se os Squads estão na tabela
        const homeFound = passingForRows.some(row => row.Squad === homeSquad);
        const awayFound = passingForRows.some(row => row.Squad === awaySquad);
        if (!homeFound) {
          console.warn('[ChampionshipService] ⚠️ Time da casa não encontrado na tabela passing_for:', homeSquad);
          console.log('[ChampionshipService] Squads disponíveis (primeiros 5):', passingForRows.slice(0, 5).map(r => r.Squad));
        }
        if (!awayFound) {
          console.warn('[ChampionshipService] ⚠️ Time visitante não encontrado na tabela passing_for:', awaySquad);
        }
      }
    }

    const homePassingForData = passingForRows.find((row) => row.Squad === homeSquad) || null;
    const awayPassingForData = passingForRows.find((row) => row.Squad === awaySquad) || null;
    const competitionPassingForAvg = calculateCompetitionPassingForAveragesFromRows(passingForRows);

    const gcaForTable = tables.find((t) => t.table_type === 'gca_for');
    const gcaForRows = Array.isArray(gcaForTable?.table_data)
      ? (gcaForTable?.table_data as TableRowGcaFor[])
      : [];

    if (import.meta.env.DEV) {
      if (!gcaForTable) {
        console.warn('[ChampionshipService] ⚠️ Tabela gca_for não encontrada para campeonato:', championshipId);
      } else if (gcaForRows.length === 0) {
        console.warn('[ChampionshipService] ⚠️ Tabela gca_for está vazia');
      } else {
        console.log('[ChampionshipService] ✅ Tabela gca_for encontrada com', gcaForRows.length, 'times');
        // Verificar se os Squads estão na tabela
        const homeFound = gcaForRows.some(row => row.Squad === homeSquad);
        const awayFound = gcaForRows.some(row => row.Squad === awaySquad);
        if (!homeFound) {
          console.warn('[ChampionshipService] ⚠️ Time da casa não encontrado na tabela gca_for:', homeSquad);
          console.log('[ChampionshipService] Squads disponíveis (primeiros 5):', gcaForRows.slice(0, 5).map(r => r.Squad));
        }
        if (!awayFound) {
          console.warn('[ChampionshipService] ⚠️ Time visitante não encontrado na tabela gca_for:', awaySquad);
        }
      }
    }

    const homeGcaForData = gcaForRows.find((row) => row.Squad === homeSquad) || null;
    const awayGcaForData = gcaForRows.find((row) => row.Squad === awaySquad) || null;
    const competitionGcaForAvg = calculateCompetitionGcaForAveragesFromRows(gcaForRows);

    // Validação de correspondência de Squads entre tabelas
    if (import.meta.env.DEV) {
      const squadsFound: Record<string, string[]> = {
        geral: homeData ? [homeData.Squad, awayData?.Squad].filter(Boolean) as string[] : [],
        standard_for: homeStandardForData ? [homeStandardForData.Squad, awayStandardForData?.Squad].filter(Boolean) as string[] : [],
        passing_for: homePassingForData ? [homePassingForData.Squad, awayPassingForData?.Squad].filter(Boolean) as string[] : [],
        gca_for: homeGcaForData ? [homeGcaForData.Squad, awayGcaForData?.Squad].filter(Boolean) as string[] : [],
      };

      // Verificar se há divergência de nomes entre tabelas
      const allSquads = Object.values(squadsFound).flat();
      const uniqueSquads = [...new Set(allSquads)];
      if (uniqueSquads.length > 2) {
        console.warn('[ChampionshipService] ⚠️ Possível divergência de nomes de Squads entre tabelas:', {
          buscado: { home: homeSquad, away: awaySquad },
          encontrado: squadsFound,
          unicos: uniqueSquads,
        });
      }

      // Verificar completude
      const tablesLoaded = {
        geral: !!(homeData && awayData),
        standard_for: !!(homeStandardForData && awayStandardForData && competitionStandardForAvg),
        passing_for: !!(homePassingForData && awayPassingForData && competitionPassingForAvg),
        gca_for: !!(homeGcaForData && awayGcaForData && competitionGcaForAvg),
      };
      const missingTables = Object.entries(tablesLoaded)
        .filter(([, loaded]) => !loaded)
        .map(([name]) => name);

      if (missingTables.length > 0) {
        console.warn('[ChampionshipService] ⚠️ Tabelas faltando após sincronização:', missingTables);
      } else {
        console.log('[ChampionshipService] ✅ Todas as 4 tabelas carregadas com sucesso!');
      }
    }

    return {
      homeTableData: homeData,
      awayTableData: awayData,
      competitionAvg: competitionAvg || undefined,
      homeStandardForData,
      awayStandardForData,
      competitionStandardForAvg,
      homePassingForData,
      awayPassingForData,
      competitionPassingForAvg,
      homeGcaForData,
      awayGcaForData,
      competitionGcaForAvg,
    };
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao sincronizar dados da tabela:', error);
    return {
      homeTableData: null,
      awayTableData: null,
      homeStandardForData: null,
      awayStandardForData: null,
      competitionStandardForAvg: null,
      homePassingForData: null,
      awayPassingForData: null,
      competitionPassingForAvg: null,
      homeGcaForData: null,
      awayGcaForData: null,
      competitionGcaForAvg: null,
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

