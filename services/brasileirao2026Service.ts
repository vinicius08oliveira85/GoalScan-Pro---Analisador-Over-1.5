import { Championship, ChampionshipTable } from '../types';
import { saveChampionship, saveChampionshipTable, loadChampionships } from './championshipService';
import { extractFbrefDataClientSide, FbrefExtractionResult } from './fbrefService';
import { logger } from '../utils/logger';

const FBREF_BRASILEIRAO_URL = 'https://fbref.com/en/comps/24/2026/2026-Campeonato-Brasileiro-Serie-A-Stats';

export interface ImportProgress {
  step: 'criando' | 'extraindo' | 'salvando' | 'concluido' | 'erro';
  message: string;
  progress: number;
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
      created_at: new Date().toISOString(),
    };

    const saved = await saveChampionship(championship);
    return saved;
  } catch (error) {
    logger.error('[Brasileirao2026] Erro ao criar campeonato:', error);
    return null;
  }
}

async function tryFbrefClientSide(
  championshipId: string,
  onProgress?: ProgressCallback
): Promise<FbrefExtractionResult | null> {
  try {
    onProgress?.({ step: 'extraindo', message: 'Tentando extrair via proxy (método rápido)...', progress: 30 });
    const result = await extractFbrefDataClientSide({
      championshipUrl: FBREF_BRASILEIRAO_URL,
      championshipId,
      extractTypes: ['table'],
    });
    return result;
  } catch (error) {
    logger.warn('[Brasileirao2026] Extração client-side falhou:', error);
    return null;
  }
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

    let extractionResult: FbrefExtractionResult | null = await tryFbrefClientSide(championship.id, onProgress);

    if (!extractionResult?.success || !extractionResult.data?.tables) {
      onProgress?.({
        step: 'erro',
        message: 'Não foi possível extrair automaticamente. Use o modo "Colar HTML" no botão FBref.',
        progress: 0,
      });
      return result;
    }

    onProgress?.({ step: 'salvando', message: 'Salvando tabelas...', progress: 70 });

    const tablesToSave = mergeTables(extractionResult);
    const savedTables: ChampionshipTable[] = [];

    for (const [tableType, rows] of Object.entries(tablesToSave)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const validTypes = ['geral', 'complement'];
      if (!validTypes.includes(tableType)) continue;

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

    result.tables = savedTables;

    onProgress?.({
      step: 'concluido',
      message: `Importação concluída! ${savedTables.length} tabela(s) salva(s) com ${extractionResult.data.tables.geral?.length || 0} times.`,
      progress: 100,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[Brasileirao2026] Erro na importação:', error);
    onProgress?.({ step: 'erro', message: `Erro: ${message}`, progress: 0 });
    return result;
  }
}
