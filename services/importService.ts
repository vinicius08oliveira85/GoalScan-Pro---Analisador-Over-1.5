import { logger } from '../utils/logger';
import { getSupabaseClient } from '../lib/supabase';
import type { GoalScanBackup } from './exportService';

export interface ImportResult {
  success: boolean;
  message: string;
  details: {
    championships: number;
    tables: number;
    teams: number;
    complement: number;
    analyses: number;
    bankSettings: number;
    transactions: number;
    localStorageKeys: number;
  };
}

async function upsertAll(table: string, rows: unknown[]): Promise<number> {
  if (!rows || rows.length === 0) return 0;
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      logger.warn(`[ImportService] Erro ao importar ${table}:`, error.message);
      return 0;
    }
    return rows.length;
  } catch (e) {
    logger.warn(`[ImportService] Falha ao importar ${table}:`, e);
    return 0;
  }
}

async function upsertComplement(rows: unknown[]): Promise<number> {
  if (!rows || rows.length === 0) return 0;
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('championship_complement')
      .upsert(rows, { onConflict: 'championship_id,squad' });
    if (error) {
      logger.warn('[ImportService] Erro ao importar complement:', error.message);
      return 0;
    }
    return rows.length;
  } catch {
    return 0;
  }
}

export async function importFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      success: false,
      message: 'Arquivo JSON inválido.',
      details: { championships: 0, tables: 0, teams: 0, complement: 0, analyses: 0, bankSettings: 0, transactions: 0, localStorageKeys: 0 },
    };
  }

  if (!validateBackup(data)) {
    return {
      success: false,
      message: 'Formato de backup inválido. O arquivo deve ser um backup exportado pelo GoalScan Pro.',
      details: { championships: 0, tables: 0, teams: 0, complement: 0, analyses: 0, bankSettings: 0, transactions: 0, localStorageKeys: 0 },
    };
  }

  return importBackup(data);
}

export function validateBackup(data: unknown): data is GoalScanBackup {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (obj.version !== '1.0') return false;
  if (!obj.supabase || typeof obj.supabase !== 'object') return false;
  if (!obj.localStorage || typeof obj.localStorage !== 'object') return false;
  const sb = obj.supabase as Record<string, unknown>;
  if (!Array.isArray(sb.championships)) return false;
  if (!Array.isArray(sb.savedAnalyses)) return false;
  return true;
}

export async function importBackup(backup: GoalScanBackup): Promise<ImportResult> {
  logger.log('[ImportService] Iniciando importação...');

  const sb = backup.supabase;

  const championships = await upsertAll('championships', sb.championships);
  const tables = await upsertAll('championship_tables', sb.championshipTables);
  const teams = await upsertAll('championship_teams', sb.championshipTeams);
  const complement = await upsertComplement(sb.championshipComplement);
  const analyses = await upsertAll('saved_analyses', sb.savedAnalyses);
  const bankSettings = await upsertAll('bank_settings', sb.bankSettings);
  const transactions = await upsertAll('bank_transactions', sb.bankTransactions);

  let localStorageKeys = 0;
  for (const [key, value] of Object.entries(backup.localStorage)) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      localStorageKeys++;
    } catch {
      // skip full storage
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('goalscan-data-changed'));
  }

  const total = championships + tables + teams + complement + analyses + bankSettings + transactions + localStorageKeys;

  const result: ImportResult = {
    success: total > 0,
    message: total > 0
      ? `Importação concluída: ${championships} campeonatos, ${tables} tabelas, ${teams} times, ${complement} complementos, ${analyses} análises, ${bankSettings} config. banca, ${transactions} transações, ${localStorageKeys} chaves locais.`
      : 'Nenhum dado foi importado. Verifique se o Supabase está disponível.',
    details: {
      championships,
      tables,
      teams,
      complement,
      analyses,
      bankSettings,
      transactions,
      localStorageKeys,
    },
  };

  logger.log('[ImportService] Importação concluída:', result);
  return result;
}
