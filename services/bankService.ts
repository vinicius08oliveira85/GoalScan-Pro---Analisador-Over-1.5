import { BankSettings } from '../types';
import { supabase } from './supabaseService';

const SAVE_ERROR_MESSAGE = 'Erro ao salvar configurações da banca.';

/**
 * Salva as configurações da banca no Supabase.
 * Futuramente, esta função será substituída por uma chamada à Edge Function.
 * @param settings As configurações a serem salvas.
 * @returns As configurações salvas.
 */
export const saveBankSettings = async (settings: BankSettings): Promise<BankSettings> => {
  try {
    // A lógica atual de UPSERT será movida para a Edge Function
    // Por enquanto, mantemos a chamada direta para garantir a funcionalidade.
    const { data, error } = await supabase
      .from('bank_settings')
      .upsert({
        id: settings.id, // Supondo que as configurações tenham um ID fixo ou de usuário
        total_bank: settings.totalBank,
        currency: settings.currency,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving bank settings:', error);
      throw new Error(SAVE_ERROR_MESSAGE);
    }

    // Mapear de volta para o tipo BankSettings
    return {
      id: data.id,
      totalBank: data.total_bank,
      currency: data.currency,
      updatedAt: new Date(data.updated_at).getTime(),
    };
  } catch (e) {
    // Fallback para localStorage em caso de erro na API
    console.warn('Could not save bank settings to Supabase, falling back to localStorage.');
    localStorage.setItem('goalscan_bank_settings', JSON.stringify(settings));
    return settings;
  }
};

/**
 * Carrega as configurações da banca.
 * @returns As configurações da banca do Supabase ou do localStorage como fallback.
 */
export const loadBankSettings = async (): Promise<BankSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('bank_settings')
      .select('*')
      .single();

    if (error) {
      // Não logar o erro se for "No rows found", pois é um estado esperado.
      if (error.code !== 'PGRST116') {
        console.error('Supabase error loading bank settings:', error);
      }
      throw new Error('No settings in Supabase');
    }

    return {
      id: data.id,
      totalBank: data.total_bank,
      currency: data.currency,
      updatedAt: new Date(data.updated_at).getTime(),
    };
  } catch (e) {
    console.warn('Could not load bank settings from Supabase, trying localStorage.');
    const localSettings = localStorage.getItem('goalscan_bank_settings');
    return localSettings ? JSON.parse(localSettings) : null;
  }
};
