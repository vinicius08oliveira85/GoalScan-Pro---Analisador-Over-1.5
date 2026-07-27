import { Championship, ChampionshipTable, TableRowGeral } from '../types';
import { saveChampionship, saveChampionshipTable, loadChampionships } from './championshipService';
import { extractStandings, extractFixtures, extractFormTable, FootyStatsStanding, FootyStatsMatch, FootyStatsFormEntry } from './footystatsService';
import { logger } from '../utils/logger';

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

function standingToGeralRow(s: FootyStatsStanding): TableRowGeral {
  return {
    Rk: s.Rk || '',
    Squad: s.Squad || '',
    MP: s.MP || '',
    W: s.W || '',
    D: s.D || '',
    L: s.L || '',
    GF: s.GF || '',
    GA: s.GA || '',
    GD: s.GD || '',
    Pts: s.Pts || '',
    'Pts/MP': s['Pts/MP'] || '',
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

    onProgress?.({ step: 'extraindo', message: 'Extraindo classificação do FootyStats...', progress: 25, source: 'footystats' });
    const standingsRes = await extractStandings();

    onProgress?.({ step: 'extraindo', message: 'Extraindo jogos do FootyStats...', progress: 45, source: 'footystats' });
    const fixturesRes = await extractFixtures();

    onProgress?.({ step: 'extraindo', message: 'Extraindo forma do FootyStats...', progress: 65, source: 'footystats' });
    const formRes = await extractFormTable();

    if (!standingsRes.success) {
      onProgress?.({
        step: 'erro',
        message: standingsRes.error || 'Não foi possível obter dados do FootyStats.',
        progress: 0,
      });
      return result;
    }

    onProgress?.({ step: 'salvando', message: 'Salvando tabelas...', progress: 80 });
    const savedTables: ChampionshipTable[] = [];

    if (standingsRes.data?.table?.length) {
      const geralRows = standingsRes.data.table.map(standingToGeralRow);
      const table: ChampionshipTable = {
        id: `${championship.id}_geral`,
        championship_id: championship.id,
        table_type: 'geral',
        table_name: 'Classificação',
        table_data: geralRows,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = await saveChampionshipTable(table);
      if (saved) savedTables.push(saved);
    }

    if (fixturesRes.data?.matches?.length) {
      const table: ChampionshipTable = {
        id: `${championship.id}_jogos`,
        championship_id: championship.id,
        table_type: 'jogos',
        table_name: 'Jogos',
        table_data: fixturesRes.data.matches as unknown[],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = await saveChampionshipTable(table);
      if (saved) savedTables.push(saved);
    }

    if (formRes.data?.last5?.length || formRes.data?.last10?.length) {
      const table: ChampionshipTable = {
        id: `${championship.id}_forma`,
        championship_id: championship.id,
        table_type: 'forma',
        table_name: 'Forma',
        table_data: formRes.data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = await saveChampionshipTable(table);
      if (saved) savedTables.push(saved);
    }

    result.tables = savedTables;

    const totalSquads = standingsRes.data?.table?.length || 0;
    onProgress?.({
      step: 'concluido',
      message: `Importação concluída via FootyStats! ${savedTables.length} tabela(s), ${totalSquads} times.`,
      progress: 100,
      source: 'FootyStats',
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[Brasileirao2026] Erro na importação:', error);
    onProgress?.({ step: 'erro', message: `Erro: ${message}`, progress: 0 });
    return result;
  }
}
