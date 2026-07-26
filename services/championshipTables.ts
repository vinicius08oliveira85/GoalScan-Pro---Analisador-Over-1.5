import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';
import { parseNumeric } from '../utils/numbers';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
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
import {
  getServiceStatus,
  setServiceStatus,
  clearServiceStatus,
  withRetry,
  isTemporaryError,
  getErrorStatus,
  isConstraintError,
  loadChampionships,
  STORAGE_KEY_CHAMPIONSHIP_TABLES,
  ChampionshipTableRow,
  ChampionshipTeamRow,
  SERVICE_STATUS_CACHE_DURATION,
} from './championshipCore';
import { updateChampionshipUploadedAt, loadChampionship } from './championshipCore';
import {
  saveChampionshipComplement,
  loadChampionshipComplement,
  getComplementBySquad,
  calculateCompetitionComplementAverages,
  convertChampionshipComplementToTableRow,
  ChampionshipComplementRow,
} from './championshipComplement';

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
  // Validações básicas
  if (!table.championship_id || table.championship_id.trim() === '') {
    const errorMsg = 'championship_id é obrigatório para salvar tabela';
    if (import.meta.env.DEV) {
      logger.error(`[ChampionshipService] ${errorMsg}`, table);
    }
    throw new Error(errorMsg);
  }

  if (!table.table_data) {
    const errorMsg = 'table_data é obrigatório para salvar tabela';
    if (import.meta.env.DEV) {
      logger.error(`[ChampionshipService] ${errorMsg}`, table);
    }
    throw new Error(errorMsg);
  }

  // Verificar cache de status do serviço ANTES de fazer qualquer requisição
  const serviceStatus = getServiceStatus();
  if (serviceStatus?.isUnavailable && Date.now() < serviceStatus.retryAfter) {
    // Serviço está conhecidamente indisponível - salvar apenas no localStorage silenciosamente
    if (import.meta.env.DEV) {
      logger.warn('[ChampionshipService] Serviço indisponível, salvando apenas no localStorage');
    }
    return saveChampionshipTableToLocalStorage(table);
  }

  try {
    const result = await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const now = new Date().toISOString();
      
      if (import.meta.env.DEV) {
        logger.log(`[ChampionshipService] Salvando tabela ${table.table_type} para campeonato ${table.championship_id}`);
      }

      const { data, error } = await supabase
        .from('championship_tables')
        .upsert(
          {
            id: table.id,
            championship_id: table.championship_id,
            table_type: table.table_type,
            table_name: table.table_name,
            table_data: table.table_data,
            created_at: table.created_at || now,
            updated_at: now,
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
        
        const errorStatus = getErrorStatus(error);
        const errorMessage = (error as { message?: string }).message || '';
        const errorDetails = (error as { details?: string }).details || '';
        
        // Erro 409 (Conflict) - pode ser conflito de constraint ou ID duplicado
        if (errorStatus === 409 || error.code === '23505') {
          if (import.meta.env.DEV) {
            logger.warn(
              '[ChampionshipService] Erro 409 (Conflict) ao salvar tabela. ' +
              'Pode ser conflito de constraint ou ID duplicado. ' +
              'Tentando resolver conflito.',
              { error, errorStatus, errorMessage, errorDetails, errorDetailsFull: JSON.stringify(error, null, 2) }
            );
          }
          
          // Verificar se é conflito de ID (tentar buscar tabela existente primeiro)
          const isIdConflict = errorMessage.toLowerCase().includes('duplicate') || 
                               errorMessage.toLowerCase().includes('unique') ||
                               error.code === '23505';
          
          if (isIdConflict) {
            // Tentar buscar tabela existente com mesmo championship_id e table_type
            const { data: existingTable, error: findError } = await supabase
              .from('championship_tables')
              .select('*')
              .eq('championship_id', table.championship_id)
              .eq('table_type', table.table_type)
              .maybeSingle();
            
            if (findError && import.meta.env.DEV) {
              logger.warn('[ChampionshipService] Erro ao buscar tabela existente:', findError);
            }
            
            if (existingTable) {
              // Tentar atualizar tabela existente
              const { data: updatedTable, error: updateError } = await supabase
                .from('championship_tables')
                .update({
                  table_name: table.table_name,
                  table_data: table.table_data,
                  updated_at: now,
                })
                .eq('id', existingTable.id)
                .select()
                .single();
              
              if (updateError) {
                if (import.meta.env.DEV) {
                  logger.warn(
                    '[ChampionshipService] Erro ao atualizar tabela existente, tentando DELETE + INSERT:',
                    updateError
                  );
                }
                
                // Se UPDATE falhar, tentar DELETE + INSERT
                const { error: deleteError } = await supabase
                  .from('championship_tables')
                  .delete()
                  .eq('id', existingTable.id);
                
                if (deleteError) {
                  if (import.meta.env.DEV) {
                    logger.error('[ChampionshipService] Erro ao deletar tabela existente:', deleteError);
                  }
                  return saveChampionshipTableToLocalStorage(table);
                }
                
                // Inserir nova tabela
                const { data: insertedTable, error: insertError } = await supabase
                  .from('championship_tables')
                  .insert({
                    id: existingTable.id, // Usar mesmo ID
                    championship_id: table.championship_id,
                    table_type: table.table_type,
                    table_name: table.table_name,
                    table_data: table.table_data,
                    created_at: existingTable.created_at || now,
                    updated_at: now,
                  })
                  .select()
                  .single();
                
                if (insertError) {
                  if (import.meta.env.DEV) {
                    logger.error('[ChampionshipService] Erro ao inserir tabela após DELETE:', insertError);
                  }
                  return saveChampionshipTableToLocalStorage(table);
                }
                
                if (import.meta.env.DEV) {
                  logger.log(`[ChampionshipService] Tabela salva com DELETE + INSERT (ID: ${existingTable.id})`);
                }
                
                if (!insertedTable) {
                  if (import.meta.env.DEV) {
                    logger.error('[ChampionshipService] Nenhum dado retornado após DELETE + INSERT');
                  }
                  return saveChampionshipTableToLocalStorage(table);
                }
                
                return insertedTable;
              }
              
              if (import.meta.env.DEV) {
                logger.log(`[ChampionshipService] Tabela atualizada com sucesso (ID: ${existingTable.id})`);
              }
              
              if (!updatedTable) {
                if (import.meta.env.DEV) {
                  logger.error('[ChampionshipService] Nenhum dado retornado após atualização');
                }
                return saveChampionshipTableToLocalStorage(table);
              }
              
              return updatedTable;
            }
          }
          
          // Se não encontrou tabela existente ou não é conflito de ID, tentar com novo ID
          const newId = `${table.championship_id}_${table.table_type}_${Date.now()}`;
          const { data: dataWithNewId, error: errorWithNewId } = await supabase
            .from('championship_tables')
            .upsert(
              {
                id: newId,
                championship_id: table.championship_id,
                table_type: table.table_type,
                table_name: table.table_name,
                table_data: table.table_data,
                created_at: table.created_at || now,
                updated_at: now,
              },
              {
                onConflict: 'id',
              }
            )
            .select()
            .single();
          
          if (errorWithNewId) {
            if (import.meta.env.DEV) {
              logger.error(
                '[ChampionshipService] Erro ao salvar tabela mesmo com novo ID:',
                { error: errorWithNewId, errorStatus: getErrorStatus(errorWithNewId) }
              );
            }
            
            // Se ainda falhar, pode ser constraint - tentar INSERT direto sem upsert
            const { data: dataInsert, error: errorInsert } = await supabase
              .from('championship_tables')
              .insert({
                id: newId,
                championship_id: table.championship_id,
                table_type: table.table_type,
                table_name: table.table_name,
                table_data: table.table_data,
                created_at: table.created_at || now,
                updated_at: now,
              })
              .select()
              .single();
            
            if (errorInsert) {
              if (import.meta.env.DEV) {
                logger.error('[ChampionshipService] Erro ao inserir tabela diretamente:', errorInsert);
              }
              return saveChampionshipTableToLocalStorage(table);
            }
            
            if (import.meta.env.DEV) {
              logger.log(`[ChampionshipService] Tabela salva com INSERT direto (ID: ${newId})`);
            }
            
            if (!dataInsert) {
              if (import.meta.env.DEV) {
                logger.error('[ChampionshipService] Nenhum dado retornado após INSERT direto');
              }
              return saveChampionshipTableToLocalStorage(table);
            }
            
            return dataInsert;
          }
          
          if (import.meta.env.DEV) {
            logger.log(`[ChampionshipService] Tabela salva com novo ID: ${newId} (ID anterior causava conflito)`);
          }
          
          if (!dataWithNewId) {
            if (import.meta.env.DEV) {
              logger.error('[ChampionshipService] Nenhum dado retornado após salvar com novo ID');
            }
            return saveChampionshipTableToLocalStorage(table);
          }
          
          return dataWithNewId;
        }
        
        // Se for erro de constraint (ex: table_type não permitido), fazer fallback para localStorage
        if (isConstraintError(error)) {
          if (import.meta.env.DEV) {
            logger.warn(
              '[ChampionshipService] Erro de constraint ao salvar tabela. ' +
              'A constraint do banco pode não permitir o table_type. ' +
              'Salvando apenas no localStorage. Execute a migração update_championship_tables_constraint.sql no Supabase.',
              { error, errorStatus, errorMessage, errorDetails, errorDetailsFull: JSON.stringify(error, null, 2) }
            );
          }
          return saveChampionshipTableToLocalStorage(table);
        }
        
        if (isTemporaryError(error)) {
          throw error;
        }
        
        // Apenas logar erros não temporários e apenas em modo dev
        if (import.meta.env.DEV) {
          logger.error(
            '[ChampionshipService] Erro ao salvar tabela:',
            { error, errorStatus, errorMessage, errorDetails, errorDetailsFull: JSON.stringify(error, null, 2) }
          );
        }
        throw error;
      }

      if (!data) {
        throw new Error('Nenhum dado retornado do Supabase após salvar tabela');
      }

      if (import.meta.env.DEV) {
        logger.log(`[ChampionshipService] Tabela ${table.table_type} salva com sucesso (ID: ${data.id})`);
      }

      return data;
    }, `Salvamento de tabela ${table.id}`);

    // Validar que result contém dados válidos
    if (!result || !result.id) {
      if (import.meta.env.DEV) {
        logger.error('[ChampionshipService] Resultado inválido após salvar tabela:', result);
      }
      return saveChampionshipTableToLocalStorage(table);
    }
    
    const saved: ChampionshipTable = {
      id: result.id,
      championship_id: result.championship_id,
      table_type: result.table_type,
      table_name: result.table_name,
      table_data: result.table_data,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };
    
    if (import.meta.env.DEV) {
      logger.log(`[ChampionshipService] Tabela salva com sucesso no Supabase (ID: ${saved.id}, Tipo: ${saved.table_type})`);
    }

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
 * Deleta uma tabela de campeonato por championship_id e table_type
 */
export const deleteChampionshipTable = async (
  championshipId: string,
  tableType: string
): Promise<void> => {
  if (!championshipId || !tableType) {
    throw new Error('championshipId e tableType são obrigatórios para deletar tabela');
  }

  try {
    await withRetry(async () => {
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('championship_tables')
        .delete()
        .eq('championship_id', championshipId)
        .eq('table_type', tableType);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          deleteChampionshipTableFromLocalStorageByType(championshipId, tableType);
          return;
        }
        if (isTemporaryError(error)) {
          throw error;
        }
        if (import.meta.env.DEV) {
          logger.error('[ChampionshipService] Erro ao deletar tabela:', error);
        }
      }
    }, `Deletar tabela ${tableType} do campeonato ${championshipId}`);
  } catch {
    // Serviço indisponível — deletar do localStorage silenciosamente
  }

  deleteChampionshipTableFromLocalStorageByType(championshipId, tableType);
  clearServiceStatus();
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
      if (teams.length > 0) {
        return teams.map((team) => team.squad).filter((squad) => squad && squad.trim() !== '');
      }

      // Fallback: ler de championship_tables (JSONB) se championship_teams estiver vazio
      const tables = await loadChampionshipTables(championshipId);
      const geralTable = tables.find((t) => t.table_type === 'geral');
      if (geralTable && Array.isArray(geralTable.table_data)) {
        const rows = geralTable.table_data as Array<{ Squad?: string; [key: string]: unknown }>;
        return rows
          .map((row) => row.Squad)
          .filter((squad): squad is string => typeof squad === 'string' && squad.trim() !== '');
      }
      return [];
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
    const homeGf = parseNumeric(team.home_gf);
    const homeMp = parseNumeric(team.home_mp);
    if (homeGf > 0 && homeMp > 0) {
      totalGoals += homeGf;
      totalMatches += homeMp;
    } else if (homeMp > 0) {
      totalMatches += homeMp;
    }

    // Usar campos Away
    const awayGf = parseNumeric(team.away_gf);
    const awayMp = parseNumeric(team.away_mp);
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
    const homeGf = parseNumeric(row['Home GF']);
    const homeMp = parseNumeric(row['Home MP']);
    const awayGf = parseNumeric(row['Away GF']);
    const awayMp = parseNumeric(row['Away MP']);

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
      const gf = parseNumeric(row.GF);
      const mp = parseNumeric(row.MP);
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
  competitionAvg?: number;
  homeComplementData?: TableRowComplement | null;
  awayComplementData?: TableRowComplement | null;
  competitionComplementAvg?: CompetitionComplementAverages | null;
}> => {
  try {
    let teams = await loadChampionshipTeams(championshipId);
    let homeData: TableRowGeral | null = null;
    let awayData: TableRowGeral | null = null;

    // Se championship_teams retornou times, usar o fluxo normal
    if (teams.length > 0) {
      const homeTeam = teams.find((t) => t.squad === homeSquad) || null;
      const awayTeam = teams.find((t) => t.squad === awaySquad) || null;

      homeData = homeTeam ? convertChampionshipTeamToTableRowGeral(homeTeam, true) : null;
      awayData = awayTeam ? convertChampionshipTeamToTableRowGeral(awayTeam, false) : null;

      logger.log('[ChampionshipService] Dados carregados de championship_teams:', {
        homeFound: !!homeTeam,
        awayFound: !!awayTeam,
      });
    }

    // Fallback: ler diretamente de championship_tables (JSONB) se não encontrou nos times normalizados
    if (!homeData || !awayData) {
      logger.log('[ChampionshipService] Fallback: lendo de championship_tables (JSONB)...');
      const tables = await loadChampionshipTables(championshipId);
      const geralTable = tables.find((t) => t.table_type === 'geral');
      
      if (geralTable && Array.isArray(geralTable.table_data)) {
        const rows = geralTable.table_data as TableRowGeral[];
        
        if (!homeData) {
          const homeRow = rows.find((r) => r.Squad === homeSquad);
          if (homeRow) {
            homeData = homeRow;
            logger.log('[ChampionshipService] Time da casa encontrado na tabela geral JSONB:', homeSquad);
          }
        }
        
        if (!awayData) {
          const awayRow = rows.find((r) => r.Squad === awaySquad);
          if (awayRow) {
            awayData = awayRow;
            logger.log('[ChampionshipService] Time visitante encontrado na tabela geral JSONB:', awaySquad);
          }
        }
      }
    }

    if (!homeData) {
      logger.warn(`[ChampionshipService] Time da casa "${homeSquad}" não encontrado`);
    }
    if (!awayData) {
      logger.warn(`[ChampionshipService] Time visitante "${awaySquad}" não encontrado`);
    }

    // Validação: verificar se dados obrigatórios estão presentes
    if (homeData) {
      const homeMp = parseFloat(homeData['Home MP'] || homeData.MP || '0');
      const homeGf = parseFloat(homeData['Home GF'] || homeData.GF || '0');
      const homeGa = parseFloat(homeData['Home GA'] || homeData.GA || '0');
      
      if (homeMp === 0 || (homeGf === 0 && homeGa === 0)) {
        logger.warn(
          `[ChampionshipService] Dados incompletos para time da casa "${homeSquad}": MP=${homeMp}, GF=${homeGf}, GA=${homeGa}`
        );
      }
    }
    
    if (awayData) {
      const awayMp = parseFloat(awayData['Away MP'] || awayData.MP || '0');
      const awayGf = parseFloat(awayData['Away GF'] || awayData.GF || '0');
      const awayGa = parseFloat(awayData['Away GA'] || awayData.GA || '0');
      
      if (awayMp === 0 || (awayGf === 0 && awayGa === 0)) {
        logger.warn(
          `[ChampionshipService] Dados incompletos para time visitante "${awaySquad}": MP=${awayMp}, GF=${awayGf}, GA=${awayGa}`
        );
      }
    }

    // Calcular média de gols do campeonato
    // Usar teams do championship_teams se disponível, senão calcular da tabela geral JSONB
    let competitionAvg: number | undefined;
    if (teams.length > 0) {
      competitionAvg = calculateCompetitionAverageGoalsFromTeams(teams) ?? undefined;
    } else {
      // Calcular da tabela geral JSONB
      const tables = await loadChampionshipTables(championshipId);
      const geralTable = tables.find((t) => t.table_type === 'geral');
      if (geralTable && Array.isArray(geralTable.table_data)) {
        const rows = geralTable.table_data as TableRowGeral[];
        let totalGoals = 0;
        let totalMatches = 0;
        for (const row of rows) {
          const gf = parseFloat(row['Home GF'] || row.GF || '0');
          const mp = parseFloat(row['Home MP'] || row.MP || '0');
          if (mp > 0) {
            totalGoals += gf;
            totalMatches += mp;
          }
        }
        if (totalMatches > 0) {
          competitionAvg = parseFloat(((2 * totalGoals) / totalMatches).toFixed(2));
          logger.log('[ChampionshipService] Média calculada da tabela geral JSONB:', competitionAvg);
        }
      }
    }

    // Complemento (championship_complement) - opcional
    let complementData = await loadChampionshipComplement(championshipId);
    
    // Fallback: ler complemento de championship_tables (JSONB) se vazio
    if (complementData.length === 0) {
      logger.log('[ChampionshipService] Fallback: lendo complemento de championship_tables (JSONB)...');
      const tables = await loadChampionshipTables(championshipId);
      const complementTable = tables.find((t) => t.table_type === 'complement');
      
      if (complementTable && Array.isArray(complementTable.table_data)) {
        const complementRows = complementTable.table_data as Array<Record<string, unknown>>;
        
        // Converter rows JSONB para formato ChampionshipComplement
        complementData = complementRows
          .filter((row) => {
            const squad = row.Squad || row.squad;
            return squad === homeSquad || squad === awaySquad;
          })
          .map((row) => ({
            squad: String(row.Squad || row.squad || ''),
            championship_id: championshipId,
            table_name: complementTable.table_name,
            pl: row.Pl != null ? String(row.Pl) : undefined,
            age: row.Age != null ? String(row.Age) : undefined,
            poss: row.Poss != null ? String(row.Poss) : undefined,
            playing_time_mp: row['Playing Time MP'] != null ? String(row['Playing Time MP']) : undefined,
            playing_time_starts: row['Playing Time Starts'] != null ? String(row['Playing Time Starts']) : undefined,
            playing_time_min: row['Playing Time Min'] != null ? String(row['Playing Time Min']) : undefined,
            playing_time_90s: row['Playing Time 90s'] != null ? String(row['Playing Time 90s']) : undefined,
            performance_gls: row['Performance Gls'] != null ? String(row['Performance Gls']) : undefined,
            performance_ast: row['Performance Ast'] != null ? String(row['Performance Ast']) : undefined,
            performance_g_a: row['Performance G+A'] != null ? String(row['Performance G+A']) : undefined,
            performance_g_pk: row['Performance G-PK'] != null ? String(row['Performance G-PK']) : undefined,
            performance_pk: row['Performance PK'] != null ? String(row['Performance PK']) : undefined,
            performance_pkatt: row['Performance PKatt'] != null ? String(row['Performance PKatt']) : undefined,
            performance_crdy: row['Performance CrdY'] != null ? String(row['Performance CrdY']) : undefined,
            performance_crdr: row['Performance CrdR'] != null ? String(row['Performance CrdR']) : undefined,
            per_90_gls: row['Per 90 Minutes Gls'] != null ? String(row['Per 90 Minutes Gls']) : undefined,
            per_90_ast: row['Per 90 Minutes Ast'] != null ? String(row['Per 90 Minutes Ast']) : undefined,
            per_90_g_a: row['Per 90 Minutes G+A'] != null ? String(row['Per 90 Minutes G+A']) : undefined,
            per_90_g_pk: row['Per 90 Minutes G-PK'] != null ? String(row['Per 90 Minutes G-PK']) : undefined,
            per_90_g_a_pk: row['Per 90 Minutes G+A-PK'] != null ? String(row['Per 90 Minutes G+A-PK']) : undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
        
        logger.log('[ChampionshipService] Complemento carregado da tabela JSONB:', complementData.length, 'times');
      }
    }

    const homeComplement = complementData.find((c) => c.squad === homeSquad) || null;
    const awayComplement = complementData.find((c) => c.squad === awaySquad) || null;
    
    const homeComplementData = homeComplement
      ? convertChampionshipComplementToTableRow(homeComplement)
      : null;
    const awayComplementData = awayComplement
      ? convertChampionshipComplementToTableRow(awayComplement)
      : null;
    
    // Calcular média de complemento
    let competitionComplementAvg = calculateCompetitionComplementAverages(complementData);
    
    if (!competitionComplementAvg && (homeComplement || awayComplement)) {
      const partialData: ChampionshipComplement[] = [];
      if (homeComplement) partialData.push(homeComplement);
      if (awayComplement) partialData.push(awayComplement);
      competitionComplementAvg = calculateCompetitionComplementAverages(partialData);
    }

    logger.log('[ChampionshipService] syncTeamStatsFromTable resultado:', {
      homeFound: !!homeData,
      awayFound: !!awayData,
      competitionAvg,
      complementHome: !!homeComplementData,
      complementAway: !!awayComplementData,
    });

    return {
      homeTableData: homeData,
      awayTableData: awayData,
      competitionAvg,
      homeComplementData,
      awayComplementData,
      competitionComplementAvg: competitionComplementAvg || undefined,
    };
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao sincronizar dados da tabela:', error);
    return {
      homeTableData: null,
      awayTableData: null,
      homeComplementData: null,
      awayComplementData: null,
      competitionComplementAvg: null,
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
    const current = await loadChampionship(championshipId);
    if (current && (!current.table_format || current.table_format !== detectedFormat)) {
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
    const normalizedTeams = teamsData
      .map((row) => normalizeTeamData(championshipId, tableName, row))
      .filter((team) => {
        // Validar campos obrigatórios antes de inserir
        if (!team.squad || team.squad.trim() === '') {
          if (import.meta.env.DEV) {
            logger.warn('[ChampionshipService] Time sem nome (Squad) ignorado:', team);
          }
          return false;
        }
        
        // Validar se tem pelo menos MP ou dados básicos
        const hasHomeMp = team.home_mp && parseFloat(team.home_mp) > 0;
        const hasAwayMp = team.away_mp && parseFloat(team.away_mp) > 0;
        
        if (!hasHomeMp && !hasAwayMp) {
          if (import.meta.env.DEV) {
            logger.warn(`[ChampionshipService] Time "${team.squad}" sem dados de MP (Home ou Away) ignorado`);
          }
          return false;
        }
        
        return true;
      });

    if (normalizedTeams.length === 0) {
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Nenhum time válido para inserir após validação');
      }
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
      
      // Se for erro de constraint UNIQUE (23505), tentar inserir um por vez com upsert
      const errorStatus = getErrorStatus(insertError);
      const errorMessage = (insertError as { message?: string }).message || '';
      const isUniqueConstraintError = insertError.code === '23505' || 
                                      errorMessage.toLowerCase().includes('unique') ||
                                      errorMessage.toLowerCase().includes('duplicate');
      
      if (isUniqueConstraintError) {
        if (import.meta.env.DEV) {
          logger.warn(
            '[ChampionshipService] Erro de constraint UNIQUE ao inserir times. ' +
            'Tentando inserir um por vez com upsert...',
            { error: insertError, errorStatus }
          );
        }
        
        // Inserir um por vez usando upsert para evitar conflitos
        // Primeiro deletar times existentes deste campeonato para evitar conflitos
        const { error: deleteError } = await supabase
          .from('championship_teams')
          .delete()
          .eq('championship_id', championshipId);
        
        if (deleteError && import.meta.env.DEV) {
          logger.warn('[ChampionshipService] Erro ao deletar times existentes antes de reinserir:', deleteError);
        }
        
        // Agora inserir todos os times novamente
        const { error: retryInsertError } = await supabase
          .from('championship_teams')
          .insert(normalizedTeams);
        
        if (retryInsertError) {
          if (import.meta.env.DEV) {
            logger.error(
              '[ChampionshipService] Erro ao inserir times após DELETE:',
              { error: retryInsertError, errorStatus: getErrorStatus(retryInsertError) }
            );
          }
          throw retryInsertError;
        }
        
        if (import.meta.env.DEV) {
          logger.log(
            `[ChampionshipService] ${normalizedTeams.length} time(s) salvo(s) após resolver conflito UNIQUE para campeonato ${championshipId}`
          );
        }
        return;
        
        if (import.meta.env.DEV) {
          logger.log(
            `[ChampionshipService] ${normalizedTeams.length} time(s) processado(s) individualmente para campeonato ${championshipId}`
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

// Funções auxiliares para localStorage

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

function deleteChampionshipTableFromLocalStorageByType(championshipId: string, tableType: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHAMPIONSHIP_TABLES);
    if (!stored) return;
    const allTables = JSON.parse(stored) as ChampionshipTable[];
    const filtered = allTables.filter(
      (t) => !(t.championship_id === championshipId && t.table_type === tableType)
    );
    localStorage.setItem(STORAGE_KEY_CHAMPIONSHIP_TABLES, JSON.stringify(filtered));
  } catch (error) {
    logger.error('[ChampionshipService] Erro ao deletar tabela do localStorage:', error);
  }
}

// Re-exports for convenience
export { loadChampionships, loadChampionship, saveChampionship, deleteChampionship } from './championshipCore';
export type { ChampionshipComplementRow } from './championshipComplement';
export { saveChampionshipComplement, loadChampionshipComplement, getComplementBySquad, calculateCompetitionComplementAverages } from './championshipComplement';
