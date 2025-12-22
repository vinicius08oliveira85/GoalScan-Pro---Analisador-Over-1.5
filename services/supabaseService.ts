import { SavedAnalysis, MatchData, AnalysisResult } from '../types';
import { getSupabaseClient } from '../lib/supabase';

export interface SavedAnalysisRow {
  id: string;
  timestamp: number;
  match_data: MatchData;
  analysis_result: AnalysisResult;
  created_at?: string;
  updated_at?: string;
}

/**
 * Carrega todas as análises salvas do Supabase
 */
export const loadSavedAnalyses = async (): Promise<SavedAnalysis[]> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('saved_analyses')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Erro ao carregar análises do Supabase:', error);
      throw error;
    }

    if (!data) {
      return [];
    }

    // Converter do formato do banco para SavedAnalysis
    return data.map((row: SavedAnalysisRow) => ({
      id: row.id,
      timestamp: row.timestamp,
      data: row.match_data,
      result: row.analysis_result,
    }));
  } catch (error) {
    console.error('Erro ao carregar análises:', error);
    // Em caso de erro, retornar array vazio para não quebrar a aplicação
    return [];
  }
};

/**
 * Salva uma nova análise no Supabase
 */
export const saveAnalysis = async (analysis: SavedAnalysis): Promise<SavedAnalysis> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('saved_analyses')
      .insert({
        id: analysis.id,
        timestamp: analysis.timestamp,
        match_data: analysis.data,
        analysis_result: analysis.result,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar análise no Supabase:', error);
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
    };
  } catch (error) {
    console.error('Erro ao salvar análise:', error);
    throw error;
  }
};

/**
 * Atualiza uma análise existente no Supabase
 */
export const updateAnalysis = async (analysis: SavedAnalysis): Promise<SavedAnalysis> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('saved_analyses')
      .update({
        timestamp: analysis.timestamp,
        match_data: analysis.data,
        analysis_result: analysis.result,
      })
      .eq('id', analysis.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar análise no Supabase:', error);
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
    };
  } catch (error) {
    console.error('Erro ao atualizar análise:', error);
    throw error;
  }
};

/**
 * Deleta uma análise do Supabase
 */
export const deleteAnalysis = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('saved_analyses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar análise do Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao deletar análise:', error);
    throw error;
  }
};

/**
 * Salva ou atualiza uma análise (upsert)
 */
export const saveOrUpdateAnalysis = async (analysis: SavedAnalysis): Promise<SavedAnalysis> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('saved_analyses')
      .upsert({
        id: analysis.id,
        timestamp: analysis.timestamp,
        match_data: analysis.data,
        analysis_result: analysis.result,
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar/atualizar análise no Supabase:', error);
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
    };
  } catch (error) {
    console.error('Erro ao salvar/atualizar análise:', error);
    throw error;
  }
};

