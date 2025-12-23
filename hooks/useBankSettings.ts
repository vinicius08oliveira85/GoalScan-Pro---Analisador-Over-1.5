import { useState, useEffect, useCallback } from 'react';
import { BankSettings } from '../types';
import { loadBankSettings, saveBankSettings } from '../services/supabaseService';
import { errorService } from '../services/errorService';
import { syncBankToWidgets } from '../services/widgetSyncService';

export const useBankSettings = (onError?: (message: string) => void) => {
  const [bankSettings, setBankSettings] = useState<BankSettings | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Carregar configurações de banca
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setSyncError(null);
      
      const bank = await loadBankSettings();
      
      if (bank) {
        setBankSettings(bank);
        try {
          localStorage.setItem('goalscan_bank_settings', JSON.stringify(bank));
          syncBankToWidgets(bank);
        } catch (e) {
          console.warn('Erro ao salvar no localStorage (backup):', e);
        }
      } else {
        // Tentar carregar do localStorage como fallback
        const storedBank = localStorage.getItem('goalscan_bank_settings');
        if (storedBank) {
          try {
            setBankSettings(JSON.parse(storedBank));
          } catch (e) {
            console.error('Erro ao carregar configurações de banca do localStorage:', e);
          }
        }
      }
      
      setLastSyncTime(Date.now());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      errorService.logError(error instanceof Error ? error : new Error(errorMessage), {
        component: 'useBankSettings',
        action: 'loadSettings'
      });
      
      // Tentar carregar do localStorage como fallback
      const storedBank = localStorage.getItem('goalscan_bank_settings');
      if (storedBank) {
        try {
          setBankSettings(JSON.parse(storedBank));
        } catch (e) {
          console.error('Erro ao carregar configurações de banca do localStorage:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Salvar configurações de banca
  const saveSettings = useCallback(async (settings: BankSettings) => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      await saveBankSettings(settings);
      setBankSettings(settings);
      
      // Salvar no localStorage como backup
      try {
        localStorage.setItem('goalscan_bank_settings', JSON.stringify(settings));
        syncBankToWidgets(settings);
      } catch (e) {
        console.warn('Erro ao salvar no localStorage (backup):', e);
      }
      
      setLastSyncTime(Date.now());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      errorService.logError(error instanceof Error ? error : new Error(errorMessage), {
        component: 'useBankSettings',
        action: 'saveSettings'
      });
      setSyncError('Erro ao sincronizar banca. Dados salvos localmente.');
      if (onError) {
        onError('Erro ao salvar configurações de banca. Dados salvos localmente.');
      }
      
      // Salvar no localStorage mesmo em caso de erro
      try {
        localStorage.setItem('goalscan_bank_settings', JSON.stringify(settings));
      } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Carregar na inicialização
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    bankSettings,
    isLoading,
    isSyncing,
    syncError,
    lastSyncTime,
    saveSettings,
    reloadSettings: loadSettings
  };
};

