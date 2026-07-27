import { getTable, getStandings, SUPPORTED_SERIES } from 'campeonato-brasileiro-api';
import { Championship, ChampionshipTable, TableRowGeral } from '../types';
import { saveChampionship, saveChampionshipTable, loadChampionships } from './championshipService';
import { extractFbrefDataClientSide, FbrefExtractionResult } from './fbrefService';
import { extractFootyStatsTable } from './footystatsService';
import { logger } from '../utils/logger';

const FBREF_BRASILEIRAO_URL = 'https://fbref.com/en/comps/24/2026/2026-Campeonato-Brasileiro-Serie-A-Stats';
const GE_PROXY_URL = '/api/brasileirao-proxy';

export interface ImportProgress {
  step: 'criando' | 'extraindo' | 'salvando' | 'concluido' | 'erro';
  message: string;
  progress: number;
  source?: string;
}

type ProgressCallback = (progress: ImportProgress) => void;

function getChampionshipId(): string {
  return 'brasileirao_2026';
}

export async function findOrCreateBrasileiraoChampionship(
  onProgress?: ProgressCallback
): Promise<Championship | null> {
  try {
    const existing = await loadChampionships();
    const found = existing.find((c) => c.id === getChampionshipId() || c.nome.includes('Brasileiro Série A 2026'));
    if (found) return found;

    onProgress?.({ step: 'criando', message: 'Criando campeonato...', progress: 10 });

    const championship: Championship = {
      id: getChampionshipId(),
      nome: 'Campeonato Brasileiro Série A 2026',
      fbrefUrl: FBREF_BRASILEIRAO_URL,
      table_format: 'basica',
      created_at: new Date().toISOString(),
    };

    const saved = await saveChampionship(championship);
    return saved;
  } catch (error) {
    logger.error('[Brasileirao2026] Erro ao criar campeonato:', error);
    return null;
  }
}

async function tryCampeonatoApiDirect(
  onProgress?: ProgressCallback
): Promise<TableRowGeral[] | null> {
  try {
    onProgress?.({ step: 'extraindo', message: 'Tentando ge.globo.com (fonte oficial Globo Esporte)...', progress: 25, source: 'ge' });
    const table = await getTable('a', {
      fetch: globalThis.fetch,
    });
    if (!table?.entries?.length) return null;

    return table.entries.map((entry: any) => ({
      Rk: String(entry.position || ''),
      Squad: entry.team?.name || '',
      MP: String(entry.matches || ''),
      W: String(entry.wins || ''),
      D: String(entry.draws || ''),
      L: String(entry.losses || ''),
      GF: String(entry.goalsFor || ''),
      GA: String(entry.goalsAgainst || ''),
      GD: String(entry.goalDifference || ''),
      Pts: String(entry.points || ''),
      'Pts/MP': entry.matches ? String((entry.points / entry.matches).toFixed(2)) : '',
      'Last 5': Array.isArray(entry.recentForm) ? entry.recentForm.join('') : '',
    }));
  } catch (error) {
    logger.warn('[Brasileirao2026] ge.globo.com direto falhou (provável CORS):', error);
    return null;
  }
}

async function tryCampeonatoApiViaProxy(
  onProgress?: ProgressCallback
): Promise<TableRowGeral[] | null> {
  try {
    onProgress?.({ step: 'extraindo', message: 'Tentando via proxy ge.globo.com...', progress: 30, source: 'ge' });

    const response = await fetch(GE_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serie: 'a' }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      logger.warn('[Brasileirao2026] Proxy ge.globo.com falhou:', errData?.error || response.statusText);
      return null;
    }

    const { html } = await response.json();
    if (!html || html.length < 5000) return null;

    const table = await getTable('a', { html });
    if (!table?.entries?.length) return null;

    return table.entries.map((entry: any) => ({
      Rk: String(entry.position || ''),
      Squad: entry.team?.name || '',
      MP: String(entry.matches || ''),
      W: String(entry.wins || ''),
      D: String(entry.draws || ''),
      L: String(entry.losses || ''),
      GF: String(entry.goalsFor || ''),
      GA: String(entry.goalsAgainst || ''),
      GD: String(entry.goalDifference || ''),
      Pts: String(entry.points || ''),
      'Pts/MP': entry.matches ? String((entry.points / entry.matches).toFixed(2)) : '',
      'Last 5': Array.isArray(entry.recentForm) ? entry.recentForm.join('') : '',
    }));
  } catch (error) {
    logger.warn('[Brasileirao2026] Proxy ge.globo.com falhou:', error);
    return null;
  }
}

async function tryFbrefClientSide(
  championshipId: string,
  onProgress?: ProgressCallback
): Promise<FbrefExtractionResult | null> {
  try {
    onProgress?.({ step: 'extraindo', message: 'Tentando FBref (proxy)...', progress: 40, source: 'fbref' });
    const result = await extractFbrefDataClientSide({
      championshipUrl: FBREF_BRASILEIRAO_URL,
      championshipId,
      extractTypes: ['table'],
    });
    return result;
  } catch (error) {
    logger.warn('[Brasileirao2026] FBref falhou:', error);
    return null;
  }
}

async function tryFootyStats(
  onProgress?: ProgressCallback
): Promise<FbrefExtractionResult | null> {
  try {
    onProgress?.({ step: 'extraindo', message: 'Tentando FootyStats...', progress: 35, source: 'footystats' });
    const result = await extractFootyStatsTable();
    return result as unknown as FbrefExtractionResult;
  } catch (error) {
    logger.warn('[Brasileirao2026] FootyStats falhou:', error);
    return null;
  }
}

interface TableEntry {
  position?: number | null;
  team?: { name?: string | null };
  points?: number | null;
  matches?: number | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  goalDifference?: number | null;
  recentForm?: Array<string | null>;
}

function apiEntriesToGeralRows(entries: TableEntry[]): TableRowGeral[] {
  return entries.map((entry) => ({
    Rk: String(entry.position ?? ''),
    Squad: entry.team?.name ?? '',
    MP: String(entry.matches ?? ''),
    W: String(entry.wins ?? ''),
    D: String(entry.draws ?? ''),
    L: String(entry.losses ?? ''),
    GF: String(entry.goalsFor ?? ''),
    GA: String(entry.goalsAgainst ?? ''),
    GD: String(entry.goalDifference ?? ''),
    Pts: String(entry.points ?? ''),
    'Pts/MP': entry.matches && entry.points ? String((entry.points / entry.matches).toFixed(2)) : '',
    'Last 5': Array.isArray(entry.recentForm) ? entry.recentForm.filter(Boolean).join('') : '',
  }));
}

function mergeTables(extractionResult: FbrefExtractionResult): Record<string, unknown[]> {
  const tables = extractionResult.data?.tables as Record<string, unknown[]> | undefined;
  if (!tables) return {};

  const mergeBySquad = (tableArrays: unknown[][]): Record<string, unknown>[] => {
    const merged = new Map<string, Record<string, unknown>>();
    for (const tableRows of tableArrays) {
      if (!Array.isArray(tableRows)) continue;
      for (const row of tableRows) {
        const r = row as Record<string, unknown>;
        const squad = r.Squad || r.squad;
        if (!squad) continue;
        const key = String(squad);
        const existing = merged.get(key);
        if (existing) {
          Object.assign(existing, r);
        } else {
          merged.set(key, { ...r });
        }
      }
    }
    return Array.from(merged.values());
  };

  return {
    geral: tables.geral || [],
    complement: mergeBySquad([
      tables.standard || [],
      tables.goalkeeping || [],
      tables.shooting || [],
      tables.playing_time || [],
      tables.misc || [],
    ]),
  };
}

export async function importBrasileirao2026(
  onProgress?: ProgressCallback
): Promise<{ championship: Championship | null; tables: ChampionshipTable[] }> {
  const result: { championship: Championship | null; tables: ChampionshipTable[] } = {
    championship: null,
    tables: [],
  };

  try {
    const championship = await findOrCreateBrasileiraoChampionship(onProgress);
    if (!championship) {
      onProgress?.({ step: 'erro', message: 'Erro ao criar/encontrar campeonato', progress: 0 });
      return result;
    }
    result.championship = championship;

    let geralRows: TableRowGeral[] | null = null;
    let extractionResult: FbrefExtractionResult | null = null;
    let usedSource = '';

    geralRows = await tryCampeonatoApiDirect(onProgress);
    if (geralRows?.length) {
      usedSource = 'ge.globo.com (direto)';
      onProgress?.({ step: 'extraindo', message: `Dados encontrados no ${usedSource}!`, progress: 60, source: 'ge' });
    }

    if (!geralRows?.length) {
      geralRows = await tryCampeonatoApiViaProxy(onProgress);
      if (geralRows?.length) {
        usedSource = 'ge.globo.com (proxy)';
        onProgress?.({ step: 'extraindo', message: `Dados encontrados no ${usedSource}!`, progress: 60, source: 'ge' });
      }
    }

    if (!geralRows?.length) {
      extractionResult = await tryFootyStats(onProgress);
      if (extractionResult?.success && extractionResult.data?.tables) {
        usedSource = 'FootyStats';
        onProgress?.({
          step: 'extraindo',
          message: `Dados encontrados no ${usedSource}!`,
          progress: 60,
          source: 'footystats',
        });
      }
    }

    if (!geralRows?.length && !extractionResult?.success) {
      extractionResult = await tryFbrefClientSide(championship.id, onProgress);
      if (extractionResult?.success && extractionResult.data?.tables) {
        usedSource = 'FBref';
        onProgress?.({ step: 'extraindo', message: `Dados encontrados no ${usedSource}!`, progress: 60, source: 'fbref' });
      }
    }

    if (!geralRows?.length && !extractionResult?.success) {
      onProgress?.({
        step: 'erro',
        message: 'Não foi possível obter dados automáticos de nenhuma fonte. Tente colar o HTML manualmente pelo botão FBref.',
        progress: 0,
      });
      return result;
    }

    onProgress?.({ step: 'salvando', message: `Salvando tabelas (fonte: ${usedSource})...`, progress: 70 });

    const savedTables: ChampionshipTable[] = [];

    if (geralRows?.length) {
      const table: ChampionshipTable = {
        id: `${championship.id}_geral`,
        championship_id: championship.id,
        table_type: 'geral',
        table_name: 'Geral',
        table_data: geralRows,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = await saveChampionshipTable(table);
      if (saved) savedTables.push(saved);
    }

    if (extractionResult?.success && extractionResult.data?.tables) {
      const tablesToSave = mergeTables(extractionResult);
      for (const [tableType, rows] of Object.entries(tablesToSave)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        if (!['geral', 'complement'].includes(tableType)) continue;

        if (tableType === 'geral' && savedTables.length > 0) continue;

        const table: ChampionshipTable = {
          id: `${championship.id}_${tableType}`,
          championship_id: championship.id,
          table_type: tableType as 'geral' | 'complement',
          table_name: tableType === 'geral' ? 'Geral' : 'Complemento',
          table_data: rows,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const saved = await saveChampionshipTable(table);
        if (saved) savedTables.push(saved);
      }
    }

    result.tables = savedTables;

    const totalRows = geralRows?.length || extractionResult?.data?.tables?.geral?.length || 0;
    onProgress?.({
      step: 'concluido',
      message: `Importação concluída via ${usedSource}! ${savedTables.length} tabela(s) com ${totalRows} times.`,
      progress: 100,
      source: usedSource,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[Brasileirao2026] Erro na importação:', error);
    onProgress?.({ step: 'erro', message: `Erro: ${message}`, progress: 0 });
    return result;
  }
}
