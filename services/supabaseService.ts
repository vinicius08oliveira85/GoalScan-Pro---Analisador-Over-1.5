import { SavedAnalysis, MatchData, AnalysisResult, BetInfo, BankSettings, SelectedBet } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { errorService } from './errorService';
import { logger } from '../utils/logger';
import {
  validateMatchData,
  validateMatchDataPartial,
  validateBetInfo,
  validateBankSettings,
} from '../utils/validation';

// Cache de status do serviço (compartilhado com championshipService e lib/supabase)
const STORAGE_KEY_SERVICE_STATUS = 'goalscan_supabase_status';
const SERVICE_STATUS_CACHE_DURATION = 60000; // 1 minuto

interface ServiceStatus {
  isUnavailable: boolean;
  lastCheck: number;
  retryAfter: number;
}

/**
 * Verifica se um erro é um erro HTTP temporário (503, 502, 504, etc)
 */
function isTemporaryError(error: unknown): boolean {
  if (!error) return false;
  
  const err = error as { 
    message?: string; 
    code?: string | number; 
    status?: number;
    statusCode?: number;
  };
  
  const statusCode = err.status || err.statusCode || 
    (typeof err.code === 'number' ? err.code : null);
  
  const temporaryStatusCodes = [503, 502, 504, 429, 408];
  if (statusCode && temporaryStatusCodes.includes(statusCode)) {
    return true;
  }
  
  const message = (err.message || '').toLowerCase();
  return message.includes('503') || 
         message.includes('service unavailable') ||
         message.includes('502') ||
         message.includes('504') ||
         message.includes('gateway timeout') ||
         message.includes('insufficient resources');
}

/**
 * Verifica se o serviço Supabase está marcado como indisponível
 */
function isServiceUnavailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    
    const stored = localStorage.getItem(STORAGE_KEY_SERVICE_STATUS);
    if (!stored) return false;
    
    const status = JSON.parse(stored) as ServiceStatus;
    const now = Date.now();
    
    if (status.isUnavailable && now < status.retryAfter && (now - status.lastCheck) < SERVICE_STATUS_CACHE_DURATION) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Marca o serviço como indisponível
 */
function setServiceUnavailable(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    const status: ServiceStatus = {
      isUnavailable: true,
      lastCheck: Date.now(),
      retryAfter: Date.now() + SERVICE_STATUS_CACHE_DURATION,
    };
    localStorage.setItem(STORAGE_KEY_SERVICE_STATUS, JSON.stringify(status));
  } catch {
    // Ignorar erros
  }
}

export interface SavedAnalysisRow {
  id: string;
  timestamp: number;
  match_data: MatchData;
  analysis_result: AnalysisResult;
  bet_info?: BetInfo;
  selected_bets?: SelectedBet[]; // Apostas selecionadas quando a partida foi salva
  created_at?: string;
  updated_at?: string;
}

export interface BankSettingsRow {
  id: string;
  total_bank: number;
  base_bank?: number | null;
  leverage?: number | null;
  currency: string;
  updated_at?: number;
  created_at?: string;
}

/**
 * Carrega todas as análises salvas do Supabase
 */
export const loadSavedAnalyses = async (): Promise<SavedAnalysis[]> => {
  // Verificar se o serviço está indisponível ANTES de fazer qualquer requisição
  if (isServiceUnavailable()) {
    // Retornar array vazio silenciosamente - serviço está conhecidamente indisponível
    return [];
  }

  try {
    // Log apenas em modo dev
    if (import.meta.env.DEV) {
      logger.log('[Supabase] Iniciando carregamento de análises salvas...');
    }
    
    const supabase = await getSupabaseClient();

    if (import.meta.env.DEV) {
      logger.log('[Supabase] Cliente inicializado, fazendo query...');
    }
    
    const { data, error } = await supabase
      .from('saved_analyses')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      // Se é erro temporário, marcar serviço como indisponível e retornar vazio
      if (isTemporaryError(error)) {
        setServiceUnavailable();
        return [];
      }

      // Log apenas erros não temporários e apenas em dev
      if (import.meta.env.DEV) {
        logger.error('[Supabase] Erro ao carregar análises:', {
          code: error.code,
          message: error.message,
          status: error.status,
        });
      }

      // Identificar tipo de erro específico
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Tabela não existe - não é erro crítico, retornar vazio
        if (import.meta.env.DEV) {
          logger.warn('[Supabase] Tabela saved_analyses não encontrada.');
        }
        return [];
      } else if (error.code === '42501' || error.status === 401) {
        // Erro de autenticação/permissão - apenas em dev
        if (import.meta.env.DEV) {
          logger.error('[Supabase] Erro de autenticação.');
        }
        return [];
      }

      // Outros erros - retornar vazio silenciosamente
      return [];
    }

    if (!data) {
      return [];
    }

    if (import.meta.env.DEV) {
      logger.log(`[Supabase] ${data.length} análise(s) carregada(s) com sucesso`);
    }

    // Converter do formato do banco para SavedAnalysis
    const analyses = data.map((row: SavedAnalysisRow) => ({
      id: row.id,
      timestamp: row.timestamp,
      data: row.match_data,
      result: row.analysis_result,
      betInfo: row.bet_info,
      selectedBets: row.selected_bets,
    }));

    return analyses;
  } catch (error: unknown) {
    // Se é erro temporário, marcar serviço como indisponível e retornar vazio
    if (isTemporaryError(error)) {
      setServiceUnavailable();
      return [];
    }

    // Log apenas erros não temporários e apenas em dev
    if (import.meta.env.DEV) {
      logger.error('[Supabase] Erro capturado ao carregar análises:', {
        message: error instanceof Error ? error.message : String(error),
        status: (error as { status?: number })?.status,
      });
    }

    // Retornar array vazio em vez de lançar erro
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
        selected_bets: analysis.selectedBets,
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
      betInfo: data.bet_info || analysis.betInfo,
      selectedBets: data.selected_bets || analysis.selectedBets,
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
      betInfo: data.bet_info || analysis.betInfo,
    };
  } catch (error) {
    logger.error('Erro ao atualizar análise:', error);
    throw error;
  }
};

/**
 * Deleta uma análise do Supabase
 */
export const deleteAnalysis = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('saved_analyses').delete().eq('id', id);

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
export const saveOrUpdateAnalysis = async (
  analysis: SavedAnalysis,
  strictValidation: boolean = false
): Promise<SavedAnalysis> => {
  try {
    // Validar dados antes de salvar
    // Se strictValidation for false, usa validação parcial (apenas campos críticos)
    // Isso permite salvar análises da IA mesmo com alguns campos opcionais inválidos
    try {
      if (strictValidation) {
        validateMatchData(analysis.data);
      } else {
        validateMatchDataPartial(analysis.data);
      }
      if (analysis.betInfo) {
        validateBetInfo(analysis.betInfo);
      }
    } catch (validationError) {
      logger.error('Erro de validação ao salvar análise:', validationError);
      const errorMessage =
        validationError instanceof Error ? validationError.message : 'Erro desconhecido';
      logger.error('Detalhes da validação:', {
        homeTeam: analysis.data.homeTeam,
        awayTeam: analysis.data.awayTeam,
        error: errorMessage,
      });
      throw new Error(`Dados inválidos: ${errorMessage}`);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('saved_analyses')
      .upsert(
        {
          id: analysis.id,
          timestamp: analysis.timestamp,
          match_data: analysis.data,
          analysis_result: analysis.result,
          bet_info: analysis.betInfo,
          selected_bets: analysis.selectedBets,
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .single();

    if (error) {
      // Se é erro temporário, não logar - já tratado
      if (isTemporaryError(error)) {
        setServiceUnavailable();
        // Retornar análise mesmo sem salvar no Supabase (já salva no localStorage)
        return analysis;
      }
      
      // Apenas logar erros não temporários e apenas em dev
      if (import.meta.env.DEV) {
        logger.error('Erro ao salvar/atualizar análise no Supabase:', error);
      }
      
      // Retornar análise mesmo sem salvar no Supabase (já salva no localStorage)
      return analysis;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      data: data.match_data,
      result: data.analysis_result,
      betInfo: data.bet_info || analysis.betInfo,
      selectedBets: data.selected_bets || analysis.selectedBets,
    };
  } catch (error) {
    // Se é erro temporário, retornar análise mesmo sem salvar no Supabase
    if (isTemporaryError(error)) {
      setServiceUnavailable();
      // Retornar análise - já será salva no localStorage pelo hook
      return analysis;
    }
    
    // Apenas logar erros não temporários e apenas em dev
    if (import.meta.env.DEV) {
      logger.error('Erro ao salvar/atualizar análise:', error);
    }
    
    // Retornar análise mesmo sem salvar no Supabase (já salva no localStorage)
    return analysis;
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
  // Verificar se o serviço está indisponível ANTES de fazer qualquer requisição
  if (isServiceUnavailable()) {
    // Retornar null silenciosamente - serviço está conhecidamente indisponível
    return null;
  }

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('bank_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      // Se é erro temporário, marcar serviço como indisponível e retornar null
      if (isTemporaryError(error)) {
        setServiceUnavailable();
        return null;
      }

      // Se não encontrar registro (PGRST116) ou tabela não existe (404), retornar null silenciosamente
      if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 404) {
        // Tabela não existe ou registro não encontrado - não é erro crítico
        return null;
      }

      // Outros erros: retornar null silenciosamente
      return null;
    }

    if (!data) {
      return null;
    }

    // Converter do formato do banco para BankSettings
    return {
      totalBank: data.total_bank,
      baseBank: typeof data.base_bank === 'number' ? data.base_bank : undefined,
      leverage: typeof data.leverage === 'number' ? data.leverage : undefined,
      currency: data.currency,
      updatedAt: data.updated_at || Date.now(),
    };
  } catch (error: unknown) {
    // Se é erro temporário, marcar serviço como indisponível e retornar null
    if (isTemporaryError(error)) {
      setServiceUnavailable();
      return null;
    }

    // Tratar erros de rede ou outros erros inesperados
    if ((error as { status?: number; code?: string })?.status === 404 || (error as { status?: number; code?: string })?.code === '42P01') {
      // Tabela não existe - não é erro crítico
      return null;
    }

    // Outros erros: retornar null silenciosamente
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
      throw new Error(
        `Dados inválidos: ${validationError instanceof Error ? validationError.message : 'Erro desconhecido'}`
      );
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('bank_settings')
      .upsert(
        {
          id: 'default',
          total_bank: settings.totalBank,
          base_bank: settings.baseBank ?? null,
          leverage: settings.leverage ?? null,
          currency: settings.currency,
          updated_at: settings.updatedAt,
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .single();

    if (error) {
      // Se alguma coluna não existe ainda, tentar novamente sem ela
      // (evita erro 400/PGRST204 enquanto as migrações não são aplicadas)
      const msg = (error.message || '').toLowerCase();
      const isColumnMissing =
        error.code === 'PGRST204' ||
        (error.status === 400 && (msg.includes('base_bank') || msg.includes('leverage') || msg.includes('column') || msg.includes('schema cache')));

      if (isColumnMissing) {
        logger.warn(
          'Coluna(s) não encontrada(s) no Supabase. Tentando salvar apenas campos básicos. Execute as migrações add_base_bank_to_bank_settings.sql e add_leverage_to_bank_settings.sql se necessário.'
        );

        // Tentar primeiro sem leverage e base_bank
        const { data: data2, error: error2 } = await supabase
          .from('bank_settings')
          .upsert(
            {
              id: 'default',
              total_bank: settings.totalBank,
              currency: settings.currency,
              updated_at: settings.updatedAt,
            },
            {
              onConflict: 'id',
            }
          )
          .select()
          .single();

        if (!error2 && data2) {
          // Retornar com baseBank e leverage preservados (serão salvos no localStorage)
          return {
            totalBank: data2.total_bank,
            baseBank: settings.baseBank,
            leverage: settings.leverage,
            currency: data2.currency,
            updatedAt: data2.updated_at || Date.now(),
          };
        }

        // Se ainda falhar, pode ser que a tabela não exista
        if (error2) {
          logger.warn('Erro ao salvar mesmo sem colunas opcionais. Dados salvos apenas no localStorage.');
          return settings;
        }
      }

      // Se a tabela não existe (404 ou 42P01), não lançar erro - apenas logar em dev
      if (error.code === '42P01' || error.status === 404) {
        logger.warn(
          'Tabela bank_settings não encontrada. Dados salvos apenas no localStorage. Execute o SQL em supabase/migrations/create_bank_settings.sql'
        );
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
      baseBank: typeof data.base_bank === 'number' ? data.base_bank : settings.baseBank,
      leverage: typeof data.leverage === 'number' ? data.leverage : settings.leverage,
      currency: data.currency,
      updatedAt: data.updated_at || Date.now(),
    };
  } catch (error: unknown) {
    // Tratar erros de rede ou outros erros inesperados
    if ((error as { status?: number; code?: string })?.status === 404 || (error as { status?: number; code?: string })?.code === '42P01') {
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
