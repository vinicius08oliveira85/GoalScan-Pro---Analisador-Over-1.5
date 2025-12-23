import { SavedAnalysis, MatchData, AnalysisResult, BetInfo, BankSettings } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';

export interface SavedAnalysisRow {
  id: string;
  timestamp: number;
  match_data: MatchData;
  analysis_result: AnalysisResult;
  bet_info?: BetInfo;
  created_at?: string;
  updated_at?: string;
}

export interface BankSettingsRow {
  id: string;
  total_bank: number;
  currency: string;
  updated_at?: number;
  created_at?: string;
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
      errorService.logApiError('loadSavedAnalyses', error.status || 500, error.message);
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
      betInfo: row.bet_info,
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
        bet_info: analysis.betInfo,
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
      betInfo: data.bet_info,
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
        bet_info: analysis.betInfo,
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
      betInfo: data.bet_info,
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
        bet_info: analysis.betInfo,
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
      betInfo: data.bet_info,
    };
  } catch (error) {
    console.error('Erro ao salvar/atualizar análise:', error);
    throw error;
  }
};

/**
 * Carrega as configurações de banca do Supabase
 * 
 * NOTA: Se a tabela bank_settings não existir no Supabase, execute o SQL em:
 * supabase/migrations/create_bank_settings.sql
 * 
 * Acesse: Supabase Dashboard > SQL Editor > Execute o script
 */
export const loadBankSettings = async (): Promise<BankSettings | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('bank_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      // Se não encontrar registro (PGRST116) ou tabela não existe (404), retornar null silenciosamente
      if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 404) {
        // Tabela não existe ou registro não encontrado - não é erro crítico
        // O sistema continuará usando localStorage como fallback
        if (process.env.NODE_ENV === 'development') {
          console.warn('Tabela bank_settings não encontrada. Usando localStorage como fallback. Execute o SQL em supabase/migrations/create_bank_settings.sql');
        }
        return null;
      }
      
      // Outros erros: logar apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Erro ao carregar configurações de banca do Supabase:', error);
      }
      return null; // Retornar null em vez de lançar erro para não quebrar a aplicação
    }

    if (!data) {
      return null;
    }

    // Converter do formato do banco para BankSettings
    return {
      totalBank: data.total_bank,
      currency: data.currency,
      updatedAt: data.updated_at || Date.now(),
    };
  } catch (error: any) {
    // Tratar erros de rede ou outros erros inesperados
    if (error?.status === 404 || error?.code === '42P01') {
      // Tabela não existe - não é erro crítico
      if (process.env.NODE_ENV === 'development') {
        console.warn('Tabela bank_settings não encontrada. Execute o SQL em supabase/migrations/create_bank_settings.sql');
      }
      return null;
    }
    
    // Outros erros: logar apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Erro ao carregar configurações de banca:', error);
    }
    // Em caso de erro, retornar null para não quebrar a aplicação
    return null;
  }
};

/**
 * Salva ou atualiza as configurações de banca no Supabase
 * 
 * NOTA: Se a tabela bank_settings não existir, esta função falhará silenciosamente
 * e os dados serão salvos apenas no localStorage como fallback.
 * 
 * Para criar a tabela, execute: supabase/migrations/create_bank_settings.sql
 */
export const saveBankSettings = async (settings: BankSettings): Promise<BankSettings> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('bank_settings')
      .upsert({
        id: 'default',
        total_bank: settings.totalBank,
        currency: settings.currency,
        updated_at: settings.updatedAt,
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      // Se a tabela não existe (404 ou 42P01), não lançar erro - apenas logar em dev
      if (error.code === '42P01' || error.status === 404) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Tabela bank_settings não encontrada. Dados salvos apenas no localStorage. Execute o SQL em supabase/migrations/create_bank_settings.sql');
        }
        // Retornar as configurações mesmo sem salvar no Supabase
        // O localStorage já foi atualizado pelo App.tsx
        return settings;
      }
      
      // Outros erros: logar apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Erro ao salvar configurações de banca no Supabase:', error);
      }
      // Retornar as configurações mesmo em caso de erro
      // O localStorage já foi atualizado pelo App.tsx
      return settings;
    }

    if (!data) {
      // Se não retornou dados, retornar as configurações originais
      return settings;
    }

    return {
      totalBank: data.total_bank,
      currency: data.currency,
      updatedAt: data.updated_at || Date.now(),
    };
  } catch (error: any) {
    // Tratar erros de rede ou outros erros inesperados
    if (error?.status === 404 || error?.code === '42P01') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Tabela bank_settings não encontrada. Dados salvos apenas no localStorage.');
      }
      // Retornar as configurações mesmo sem salvar no Supabase
      return settings;
    }
    
    // Outros erros: logar apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Erro ao salvar configurações de banca:', error);
    }
    // Retornar as configurações mesmo em caso de erro
    return settings;
  }
};

