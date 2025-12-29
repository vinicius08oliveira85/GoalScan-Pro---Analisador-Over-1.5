import { SavedAnalysis, MatchData, AnalysisResult, BetInfo, BankSettings } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';
import { validateMatchData, validateBetInfo, validateBankSettings } from '../utils/validation';

export interface SavedAnalysisRow {
  id: string;
  timestamp: number;
  match_data: MatchData;
  analysis_result: AnalysisResult;
  ai_analysis?: string;  // Markdown completo da análise da IA
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
    logger.log('[Supabase] Iniciando carregamento de análises salvas...');
    const supabase = await getSupabaseClient();
    
    logger.log('[Supabase] Cliente inicializado, fazendo query...');
    const { data, error } = await supabase
      .from('saved_analyses')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      // Log detalhado do erro
      logger.error('[Supabase] Erro ao carregar análises:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: error.status
      });
      
      errorService.logApiError('loadSavedAnalyses', error.status || 500, error.message);
      
      // Identificar tipo de erro específico
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Tabela não existe
        logger.warn('[Supabase] Tabela saved_analyses não encontrada. Verifique se a tabela foi criada no Supabase.');
        throw new Error('Tabela saved_analyses não encontrada no Supabase. Verifique a configuração do banco de dados.');
      } else if (error.code === '42501' || error.status === 401) {
        // Erro de autenticação/permissão
        logger.error('[Supabase] Erro de autenticação. Verifique as credenciais (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).');
        throw new Error('Erro de autenticação com Supabase. Verifique as variáveis de ambiente.');
      } else if (error.status === 0 || error.message?.includes('Failed to fetch')) {
        // Erro de conexão
        logger.error('[Supabase] Erro de conexão. Verifique sua conexão com a internet e a URL do Supabase.');
        throw new Error('Erro de conexão com Supabase. Verifique sua conexão com a internet.');
      }
      
      throw error;
    }

    if (!data) {
      logger.log('[Supabase] Nenhum dado retornado (data é null)');
      return [];
    }

    logger.log(`[Supabase] ${data.length} análise(s) carregada(s) com sucesso`);
    
    // Converter do formato do banco para SavedAnalysis
    const analyses = data.map((row: SavedAnalysisRow) => ({
      id: row.id,
      timestamp: row.timestamp,
      data: row.match_data,
      result: row.analysis_result,
      aiAnalysis: row.ai_analysis,
      betInfo: row.bet_info,
    }));
    
    return analyses;
  } catch (error: any) {
    // Log detalhado do erro capturado
    logger.error('[Supabase] Erro capturado ao carregar análises:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      code: error?.code,
      status: error?.status
    });
    
    errorService.logError(
      error instanceof Error ? error : new Error(error?.message || 'Erro desconhecido ao carregar análises'),
      {
        component: 'supabaseService',
        action: 'loadSavedAnalyses',
        errorCode: error?.code,
        errorStatus: error?.status
      }
    );
    
    // Re-lançar o erro para que o hook possa tratá-lo adequadamente
    throw error;
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
        ai_analysis: analysis.aiAnalysis,
        bet_info: analysis.betInfo,
      })
      .select()
      .single();

    if (error) {
      logger.error('Erro ao salvar análise no Supabase:', error);
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
      aiAnalysis: data.ai_analysis,
      betInfo: data.bet_info,
    };
  } catch (error) {
    logger.error('Erro ao salvar análise:', error);
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
        ai_analysis: analysis.aiAnalysis,
        bet_info: analysis.betInfo,
      })
      .eq('id', analysis.id)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao atualizar análise no Supabase:', error);
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
      aiAnalysis: data.ai_analysis,
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
      logger.error('Erro ao deletar análise do Supabase:', error);
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
    // Validar dados antes de salvar
    try {
      validateMatchData(analysis.data);
      if (analysis.betInfo) {
        validateBetInfo(analysis.betInfo);
      }
    } catch (validationError) {
      logger.error('Erro de validação ao salvar análise:', validationError);
      throw new Error(`Dados inválidos: ${validationError instanceof Error ? validationError.message : 'Erro desconhecido'}`);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('saved_analyses')
      .upsert({
        id: analysis.id,
        timestamp: analysis.timestamp,
        match_data: analysis.data,
        analysis_result: analysis.result,
        ai_analysis: analysis.aiAnalysis,
        bet_info: analysis.betInfo,
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      logger.error('Erro ao salvar/atualizar análise no Supabase:', error);
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
      aiAnalysis: data.ai_analysis,
      betInfo: data.bet_info,
    };
  } catch (error) {
    logger.error('Erro ao salvar/atualizar análise:', error);
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
        logger.warn('Tabela bank_settings não encontrada. Usando localStorage como fallback. Execute o SQL em supabase/migrations/create_bank_settings.sql');
        return null;
      }
      
      // Outros erros: logar apenas em desenvolvimento
      logger.error('Erro ao carregar configurações de banca do Supabase:', error);
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
      logger.warn('Tabela bank_settings não encontrada. Execute o SQL em supabase/migrations/create_bank_settings.sql');
      return null;
    }
    
    // Outros erros: logar apenas em desenvolvimento
    logger.error('Erro ao carregar configurações de banca:', error);
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
    // Validar dados antes de salvar
    try {
      validateBankSettings(settings);
    } catch (validationError) {
      logger.error('Erro de validação ao salvar configurações de banca:', validationError);
      throw new Error(`Dados inválidos: ${validationError instanceof Error ? validationError.message : 'Erro desconhecido'}`);
    }

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
        logger.warn('Tabela bank_settings não encontrada. Dados salvos apenas no localStorage. Execute o SQL em supabase/migrations/create_bank_settings.sql');
        // Retornar as configurações mesmo sem salvar no Supabase
        // O localStorage já foi atualizado pelo App.tsx
        return settings;
      }
      
      // Outros erros: logar apenas em desenvolvimento
      logger.error('Erro ao salvar configurações de banca no Supabase:', error);
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
      logger.warn('Tabela bank_settings não encontrada. Dados salvos apenas no localStorage.');
      // Retornar as configurações mesmo sem salvar no Supabase
      return settings;
    }
    
    // Outros erros: logar apenas em desenvolvimento
    logger.error('Erro ao salvar configurações de banca:', error);
    // Retornar as configurações mesmo em caso de erro
    return settings;
  }
};

