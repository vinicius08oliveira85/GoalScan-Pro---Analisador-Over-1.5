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
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { parseNumeric } from '../utils/numbers';
import { getServiceStatus, setServiceStatus, clearServiceStatus, withRetry } from './championshipCore';
import { updateChampionshipUploadedAt } from './championshipCore';

/**
 * Interface para linha da tabela championship_complement no banco
 */
export interface ChampionshipComplementRow {
  squad: string;
  championship_id: string;
  table_name: string;
  pl?: string;
  age?: string;
  poss?: string;
  playing_time_mp?: string;
  playing_time_starts?: string;
  playing_time_min?: string;
  playing_time_90s?: string;
  performance_gls?: string;
  performance_ast?: string;
  performance_g_a?: string;
  performance_g_pk?: string;
  performance_pk?: string;
  performance_pkatt?: string;
  performance_crdy?: string;
  performance_crdr?: string;
  per_90_gls?: string;
  per_90_ast?: string;
  per_90_g_a?: string;
  per_90_g_pk?: string;
  per_90_g_a_pk?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Normaliza dados de complemento do CSV para formato do banco
 */
function normalizeComplementData(
  championshipId: string,
  tableName: string,
  row: TableRowComplement
): ChampionshipComplement {
  return {
    squad: row.Squad,
    championship_id: championshipId,
    table_name: tableName,
    pl: row.Pl,
    age: row.Age,
    poss: row.Poss,
    playing_time_mp: row['Playing Time MP'],
    playing_time_starts: row['Playing Time Starts'],
    playing_time_min: row['Playing Time Min'],
    playing_time_90s: row['Playing Time 90s'],
    performance_gls: row['Performance Gls'],
    performance_ast: row['Performance Ast'],
    performance_g_a: row['Performance G+A'],
    performance_g_pk: row['Performance G-PK'],
    performance_pk: row['Performance PK'],
    performance_pkatt: row['Performance PKatt'],
    performance_crdy: row['Performance CrdY'],
    performance_crdr: row['Performance CrdR'],
    per_90_gls: row['Per 90 Minutes Gls'],
    per_90_ast: row['Per 90 Minutes Ast'],
    per_90_g_a: row['Per 90 Minutes G+A'],
    per_90_g_pk: row['Per 90 Minutes G-PK'],
    per_90_g_a_pk: row['Per 90 Minutes G+A-PK'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Converte dados do banco para formato TableRowComplement
 */
export function convertChampionshipComplementToTableRow(
  complement: ChampionshipComplement
): TableRowComplement {
  return {
    Squad: complement.squad,
    Pl: complement.pl,
    Age: complement.age,
    Poss: complement.poss,
    'Playing Time MP': complement.playing_time_mp,
    'Playing Time Starts': complement.playing_time_starts,
    'Playing Time Min': complement.playing_time_min,
    'Playing Time 90s': complement.playing_time_90s,
    'Performance Gls': complement.performance_gls,
    'Performance Ast': complement.performance_ast,
    'Performance G+A': complement.performance_g_a,
    'Performance G-PK': complement.performance_g_pk,
    'Performance PK': complement.performance_pk,
    'Performance PKatt': complement.performance_pkatt,
    'Performance CrdY': complement.performance_crdy,
    'Performance CrdR': complement.performance_crdr,
    'Per 90 Minutes Gls': complement.per_90_gls,
    'Per 90 Minutes Ast': complement.per_90_ast,
    'Per 90 Minutes G+A': complement.per_90_g_a,
    'Per 90 Minutes G-PK': complement.per_90_g_pk,
    'Per 90 Minutes G+A-PK': complement.per_90_g_a_pk,
  };
}

/**
 * Salva dados normalizados de complemento na tabela championship_complement
 * Substitui dados existentes do campeonato (DELETE + INSERT)
 */
export const saveChampionshipComplement = async (
  championshipId: string,
  tableName: string,
  complementData: TableRowComplement[]
): Promise<void> => {
try {
     const supabase = await getSupabaseClient();
     if (!supabase) throw new Error('Supabase nao configurado');
 
     // 1. Deletar dados existentes do campeonato
    const { error: deleteError } = await supabase
      .from('championship_complement')
      .delete()
      .eq('championship_id', championshipId);

    if (deleteError && deleteError.code !== 'PGRST116' && deleteError.code !== '42P01') {
      // Ignorar erro se tabela não existe ainda
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Erro ao deletar complemento existente:', deleteError);
      }
    }

    // 2. Normalizar e inserir novos dados
    const normalizedComplement = complementData
      .map((row) => normalizeComplementData(championshipId, tableName, row))
      .filter((complement) => {
        // Validar campos obrigatórios antes de inserir
        if (!complement.squad || complement.squad.trim() === '') {
          if (import.meta.env.DEV) {
            logger.warn('[ChampionshipService] Complemento sem nome (Squad) ignorado:', complement);
          }
          return false;
        }
        return true;
      });

    if (normalizedComplement.length === 0) {
      if (import.meta.env.DEV) {
        logger.warn('[ChampionshipService] Nenhum complemento válido para inserir após validação');
      }
      return;
    }

    const { error: insertError } = await supabase
      .from('championship_complement')
      .insert(normalizedComplement);

    if (insertError) {
      if (import.meta.env.DEV) {
        logger.error('[ChampionshipService] Erro ao inserir complemento:', insertError);
      }
      throw new Error(`Erro ao salvar complemento: ${insertError.message}`);
    }

    // 3. Atualizar uploaded_at do campeonato
    await updateChampionshipUploadedAt(championshipId);

    if (import.meta.env.DEV) {
      logger.info(
        `[ChampionshipService] Complemento salvo com sucesso: ${normalizedComplement.length} registros`
      );
    }
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao salvar complemento:', error);
    throw error;
  }
};

/**
 * Carrega todos os dados de complemento de um campeonato
 */
export const loadChampionshipComplement = async (
   championshipId: string
 ): Promise<ChampionshipComplement[]> => {
   try {
     const supabase = await getSupabaseClient();
     if (!supabase) return [];
     const { data, error } = await supabase
       .from('championship_complement')
       .select('*')
       .eq('championship_id', championshipId)
       .order('squad', { ascending: true });

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

    return (data as ChampionshipComplementRow[]).map((row) => ({
      squad: row.squad,
      championship_id: row.championship_id,
      table_name: row.table_name,
      pl: row.pl,
      age: row.age,
      poss: row.poss,
      playing_time_mp: row.playing_time_mp,
      playing_time_starts: row.playing_time_starts,
      playing_time_min: row.playing_time_min,
      playing_time_90s: row.playing_time_90s,
      performance_gls: row.performance_gls,
      performance_ast: row.performance_ast,
      performance_g_a: row.performance_g_a,
      performance_g_pk: row.performance_g_pk,
      performance_pk: row.performance_pk,
      performance_pkatt: row.performance_pkatt,
      performance_crdy: row.performance_crdy,
      performance_crdr: row.performance_crdr,
      per_90_gls: row.per_90_gls,
      per_90_ast: row.per_90_ast,
      per_90_g_a: row.per_90_g_a,
      per_90_g_pk: row.per_90_g_pk,
      per_90_g_a_pk: row.per_90_g_a_pk,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao carregar complemento:', error);
    return [];
  }
};

/**
 * Busca dados de complemento de um time específico
 */
export const getComplementBySquad = async (
championshipId: string,
   squad: string
 ): Promise<ChampionshipComplement | null> => {
   try {
     const supabase = await getSupabaseClient();
     if (!supabase) return null;
     const { data, error } = await supabase
       .from('championship_complement')
       .select('*')
       .eq('championship_id', championshipId)
       .eq('squad', squad)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Tabela não existe ainda
        return null;
      }
      if (error.code === 'PGRST116') {
        // Nenhum registro encontrado
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    const row = data as ChampionshipComplementRow;
    return {
      squad: row.squad,
      championship_id: row.championship_id,
      table_name: row.table_name,
      pl: row.pl,
      age: row.age,
      poss: row.poss,
      playing_time_mp: row.playing_time_mp,
      playing_time_starts: row.playing_time_starts,
      playing_time_min: row.playing_time_min,
      playing_time_90s: row.playing_time_90s,
      performance_gls: row.performance_gls,
      performance_ast: row.performance_ast,
      performance_g_a: row.performance_g_a,
      performance_g_pk: row.performance_g_pk,
      performance_pk: row.performance_pk,
      performance_pkatt: row.performance_pkatt,
      performance_crdy: row.performance_crdy,
      performance_crdr: row.performance_crdr,
      per_90_gls: row.per_90_gls,
      per_90_ast: row.per_90_ast,
      per_90_g_a: row.per_90_g_a,
      per_90_g_pk: row.per_90_g_pk,
      per_90_g_a_pk: row.per_90_g_a_pk,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (error: unknown) {
    logger.error('[ChampionshipService] Erro ao buscar complemento por squad:', error);
    return null;
  }
};

/**
 * Calcula médias da competição a partir dos dados de complemento
 */
export const calculateCompetitionComplementAverages = (
  complementData: ChampionshipComplement[]
): CompetitionComplementAverages | null => {
  if (!complementData || complementData.length === 0) {
    return null;
  }

  const parseNum = (value: string | undefined): number => {
    if (!value) return 0;
    const raw = String(value).trim().replace(/,/g, '');
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  let totalPl = 0;
  let totalAge = 0;
  let totalPoss = 0;
  let totalPlayingTimeMp = 0;
  let totalPlayingTime90s = 0;
  let totalPerformanceGls = 0;
  let totalPerformanceAst = 0;
  let totalPerformanceGA = 0;
  let totalPerformanceGPK = 0;
  let totalPer90Gls = 0;
  let totalPer90Ast = 0;
  let totalPer90GA = 0;
  let totalPer90GPK = 0;
  let totalPer90GAPK = 0;
  let count = 0;

  complementData.forEach((complement) => {
    const pl = parseNum(complement.pl);
    const age = parseNum(complement.age);
    const poss = parseNum(complement.poss);
    const mp = parseNum(complement.playing_time_mp);
    const n90s = parseNum(complement.playing_time_90s);
    const gls = parseNum(complement.performance_gls);
    const ast = parseNum(complement.performance_ast);
    const ga = parseNum(complement.performance_g_a);
    const gpk = parseNum(complement.performance_g_pk);
    const per90Gls = parseNum(complement.per_90_gls);
    const per90Ast = parseNum(complement.per_90_ast);
    const per90GA = parseNum(complement.per_90_g_a);
    const per90GPK = parseNum(complement.per_90_g_pk);
    const per90GAPK = parseNum(complement.per_90_g_a_pk);

    if (pl > 0 || age > 0 || poss > 0 || mp > 0) {
      totalPl += pl;
      totalAge += age;
      totalPoss += poss;
      totalPlayingTimeMp += mp;
      totalPlayingTime90s += n90s;
      totalPerformanceGls += gls;
      totalPerformanceAst += ast;
      totalPerformanceGA += ga;
      totalPerformanceGPK += gpk;
      totalPer90Gls += per90Gls;
      totalPer90Ast += per90Ast;
      totalPer90GA += per90GA;
      totalPer90GPK += per90GPK;
      totalPer90GAPK += per90GAPK;
      count++;
    }
  });

  if (count === 0) {
    return null;
  }

  return {
    pl: totalPl / count,
    age: totalAge / count,
    poss: totalPoss / count,
    playingTimeMp: totalPlayingTimeMp / count,
    playingTime90s: totalPlayingTime90s / count,
    performanceGls: totalPerformanceGls / count,
    performanceAst: totalPerformanceAst / count,
    performanceGA: totalPerformanceGA / count,
    performanceGPK: totalPerformanceGPK / count,
    per90Gls: totalPer90Gls / count,
    per90Ast: totalPer90Ast / count,
    per90GA: totalPer90GA / count,
    per90GPK: totalPer90GPK / count,
    per90GAPK: totalPer90GAPK / count,
  };
};
