import {
  TableType,
  TableRowGeral,
} from '../types';
import { logger } from '../utils/logger';
import { loadChampionshipTables, loadChampionshipTeams } from './championshipTables';
import { loadChampionshipComplement } from './championshipComplement';

/**
 * Tipo para diagnóstico de disponibilidade de tabelas
 */
export interface ChampionshipTablesDiagnostic {
  allTablesExist: boolean;
  missingTables: TableType[];
  emptyTables: TableType[];
  tables: Record<TableType, { exists: boolean; hasData: boolean; rowCount?: number }>;
  complement?: { exists: boolean; hasData: boolean; rowCount?: number };
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
    
    // Verificar tabela de complemento (championship_complement)
    const complementData = await loadChampionshipComplement(championshipId);
    const hasComplementData = complementData.length > 0;
    let hasHomeComplement = true;
    let hasAwayComplement = true;
    if (homeSquad) {
      hasHomeComplement = complementData.some((c) => c.squad === homeSquad);
    }
    if (awaySquad) {
      hasAwayComplement = complementData.some((c) => c.squad === awaySquad);
    }
    
    // Construir diagnóstico
    const diagnostic: ChampionshipTablesDiagnostic = {
      allTablesExist: hasGeralData && hasComplementData,
      missingTables: [],
      emptyTables: [],
      tables: {
        geral: {
          exists: hasGeralData,
          hasData: hasGeralData && (hasHomeSquad && hasAwaySquad),
          rowCount: teams.length || geralRows.length,
        },
        complement: {
          exists: hasComplementData,
          hasData: hasComplementData && (hasHomeComplement && hasAwayComplement),
          rowCount: complementData.length,
        },
      },
    };
    
    // Identificar tabelas faltantes ou vazias
    if (!hasGeralData) {
      diagnostic.missingTables.push('geral');
    } else if (!hasHomeSquad || !hasAwaySquad) {
      diagnostic.emptyTables.push('geral');
    }
    
    if (!hasComplementData) {
      diagnostic.missingTables.push('complement');
    } else if (!hasHomeComplement || !hasAwayComplement) {
      diagnostic.emptyTables.push('complement');
    }
    
    return diagnostic;
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      logger.error('[ChampionshipService] Erro ao verificar disponibilidade de tabelas:', error);
    }
    
    // Retornar diagnóstico vazio em caso de erro
    return {
      allTablesExist: false,
      missingTables: ['geral', 'complement'],
      emptyTables: [],
      tables: {
        geral: { exists: false, hasData: false },
        complement: { exists: false, hasData: false },
      },
    };
  }
};
