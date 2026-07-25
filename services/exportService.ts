import { logger } from '../utils/logger';

const LS_KEYS = [
  'goalscan_championships',
  'goalscan_championship_tables',
  'goalscan_saved',
  'goalscan_bank_settings',
  'goalscan_bank_base',
  'goalscan_leverage_plan',
  'goalscan_theme_mode',
  'goalscan_scheduled_notifications',
] as const;

export interface GoalScanBackup {
  version: '1.0';
  exportedAt: string;
  supabase: {
    championships: unknown[];
    championshipTables: unknown[];
    championshipTeams: unknown[];
    championshipComplement: unknown[];
    savedAnalyses: unknown[];
    bankSettings: unknown[];
    bankTransactions: unknown[];
  };
  localStorage: Record<string, unknown>;
}

async function fetchAll<T>(from: string): Promise<T[]> {
  try {
    const { getSupabaseClient } = await import('./championshipService');
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from(from).select('*');
    if (error || !data) return [];
    return data as T[];
  } catch {
    return [];
  }
}

export async function exportAllData(): Promise<GoalScanBackup> {
  logger.log('[ExportService] Iniciando exportação completa...');

  const [
    championships,
    championshipTables,
    championshipTeams,
    championshipComplement,
    savedAnalyses,
    bankSettings,
    bankTransactions,
  ] = await Promise.all([
    fetchAll('championships'),
    fetchAll('championship_tables'),
    fetchAll('championship_teams'),
    fetchAll('championship_complement'),
    fetchAll('saved_analyses'),
    fetchAll('bank_settings'),
    fetchAll('bank_transactions'),
  ]);

  const localStorageData: Record<string, unknown> = {};
  for (const key of LS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        localStorageData[key] = JSON.parse(raw);
      }
    } catch {
      // skip corrupted keys
    }
  }

  const backup: GoalScanBackup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    supabase: {
      championships,
      championshipTables,
      championshipTeams,
      championshipComplement,
      savedAnalyses,
      bankSettings,
      bankTransactions,
    },
    localStorage: localStorageData,
  };

  logger.log('[ExportService] Exportação concluída:', {
    championships: championships.length,
    tables: championshipTables.length,
    teams: championshipTeams.length,
    complement: championshipComplement.length,
    analyses: savedAnalyses.length,
    bankSettings: bankSettings.length,
    transactions: bankTransactions.length,
    lsKeys: Object.keys(localStorageData).length,
  });

  return backup;
}

export function downloadJson(data: GoalScanBackup, filename?: string): void {
  const name = filename || `goalscan_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  logger.log('[ExportService] Download iniciado:', name);
}
