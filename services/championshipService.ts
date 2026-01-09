import { Championship, ChampionshipTable, TableType, TableRowGeral } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';

export interface ChampionshipRow {
  id: string;
  nome: string;
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

/**
 * Carrega todos os campeonatos do Supabase ou localStorage
 */
export const loadChampionships = async (): Promise<Championship[]> => {
  try {
    logger.log('[ChampionshipService] Carregando campeonatos...');
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from('championships')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      // Se tabela não existe, usar localStorage
      if (error.code === 'PGRST116' || error.code === '42P01') {
        logger.warn('[ChampionshipService] Tabela não encontrada, usando localStorage');
        return loadChampionshipsFromLocalStorage();
      }
      logger.error('[ChampionshipService] Erro ao carregar campeonatos:', error);
      throw error;
    }

    if (!data) {
      return loadChampionshipsFromLocalStorage();
    }

    logger.log(`[ChampionshipService] ${data.length} campeonato(s) carregado(s)`);

    // Converter do formato do banco para Championship
    const championships = data.map((row: ChampionshipRow) => ({
      id: row.id,
      nome: row.nome,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // Sincronizar com localStorage
    saveChampionshipsToLocalStorage(championships);

    return championships;
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao carregar campeonatos:', error);
    // Fallback para localStorage
    return loadChampionshipsFromLocalStorage();
  }
};

/**
 * Carrega um campeonato específico
 */
export const loadChampionship = async (id: string): Promise<Championship | null> => {
  try {
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
      logger.error('[ChampionshipService] Erro ao carregar campeonato:', error);
      return loadChampionshipFromLocalStorage(id);
    }

    if (!data) {
      return loadChampionshipFromLocalStorage(id);
    }

    return {
      id: data.id,
      nome: data.nome,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao carregar campeonato:', error);
    return loadChampionshipFromLocalStorage(id);
  }
};

/**
 * Salva ou atualiza um campeonato
 */
export const saveChampionship = async (championship: Championship): Promise<Championship> => {
  try {
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
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

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Salvar apenas no localStorage
        return saveChampionshipToLocalStorage(championship);
      }
      logger.error('[ChampionshipService] Erro ao salvar campeonato:', error);
      throw error;
    }

    const saved: Championship = {
      id: data.id,
      nome: data.nome,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    // Sincronizar com localStorage
    const championships = await loadChampionships();
    const updated = championships.filter((c) => c.id !== saved.id);
    updated.push(saved);
    saveChampionshipsToLocalStorage(updated);

    return saved;
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao salvar campeonato:', error);
    // Fallback para localStorage
    return saveChampionshipToLocalStorage(championship);
  }
};

/**
 * Deleta um campeonato
 */
export const deleteChampionship = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();

    const { error } = await supabase.from('championships').delete().eq('id', id);

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        deleteChampionshipFromLocalStorage(id);
        return;
      }
      logger.error('[ChampionshipService] Erro ao deletar campeonato:', error);
      throw error;
    }

    // Remover do localStorage também
    deleteChampionshipFromLocalStorage(id);
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao deletar campeonato:', error);
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
      logger.error('[ChampionshipService] Erro ao carregar tabelas:', error);
      return loadChampionshipTablesFromLocalStorage(championshipId);
    }

    if (!data) {
      return loadChampionshipTablesFromLocalStorage(championshipId);
    }

    const tables = data.map((row: ChampionshipTableRow) => ({
      id: row.id,
      championship_id: row.championship_id,
      table_type: row.table_type,
      table_name: row.table_name,
      table_data: row.table_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // Sincronizar com localStorage
    saveChampionshipTablesToLocalStorage(tables);

    return tables;
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao carregar tabelas:', error);
    return loadChampionshipTablesFromLocalStorage(championshipId);
  }
};

/**
 * Salva ou atualiza uma tabela de campeonato
 */
export const saveChampionshipTable = async (
  table: ChampionshipTable
): Promise<ChampionshipTable> => {
  try {
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
      logger.error('[ChampionshipService] Erro ao salvar tabela:', error);
      throw error;
    }

    const saved: ChampionshipTable = {
      id: data.id,
      championship_id: data.championship_id,
      table_type: data.table_type,
      table_name: data.table_name,
      table_data: data.table_data,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    // Sincronizar com localStorage
    const tables = await loadChampionshipTables(table.championship_id);
    const updated = tables.filter((t) => t.id !== saved.id);
    updated.push(saved);
    saveChampionshipTablesToLocalStorage(updated);

    return saved;
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao salvar tabela:', error);
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
    return allTables.filter((t) => t.championship_id === championshipId);
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

