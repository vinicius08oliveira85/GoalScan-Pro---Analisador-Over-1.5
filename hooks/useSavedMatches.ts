import { useState, useEffect, useCallback } from 'react';
import { SavedAnalysis } from '../types';
import { loadSavedAnalyses, saveOrUpdateAnalysis, deleteAnalysis } from '../services/supabaseService';
import { errorService } from '../services/errorService';
import { syncMatchesToWidgets } from '../services/widgetSyncService';

export const useSavedMatches = (onError?: (message: string) => void) => {
  const [savedMatches, setSavedMatches] = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isUsingLocalData, setIsUsingLocalData] = useState<boolean>(false);

  // Carregar partidas salvas
  const loadMatches = useCallback(async () => {
    console.log('[useSavedMatches] Iniciando carregamento de partidas...');
    setIsLoading(true);
    setSyncError(null);
    setIsUsingLocalData(false);
    
    // Primeiro, tentar carregar do localStorage para exibição imediata
    let localMatches: SavedAnalysis[] = [];
    try {
      const stored = localStorage.getItem('goalscan_saved');
      if (stored) {
        localMatches = JSON.parse(stored);
        console.log(`[useSavedMatches] ${localMatches.length} partida(s) encontrada(s) no localStorage`);
        // Exibir dados locais imediatamente enquanto tenta sincronizar
        setSavedMatches(localMatches);
        syncMatchesToWidgets(localMatches);
      } else {
        console.log('[useSavedMatches] Nenhuma partida encontrada no localStorage');
      }
    } catch (e) {
      console.warn('[useSavedMatches] Erro ao carregar do localStorage:', e);
    }
    
    // Agora tentar carregar do Supabase para sincronizar
    try {
      console.log('[useSavedMatches] Tentando carregar do Supabase...');
      const matches = await loadSavedAnalyses();
      console.log(`[useSavedMatches] ${matches.length} partida(s) carregada(s) do Supabase`);
      
      setSavedMatches(matches);
      setIsUsingLocalData(false);
      
      // Salvar no localStorage como backup
      try {
        localStorage.setItem('goalscan_saved', JSON.stringify(matches));
        syncMatchesToWidgets(matches);
        console.log('[useSavedMatches] Dados sincronizados e salvos no localStorage');
      } catch (e) {
        console.warn('[useSavedMatches] Erro ao salvar no localStorage (backup):', e);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[useSavedMatches] Erro ao carregar do Supabase:', {
        message: errorMessage,
        code: error?.code,
        status: error?.status,
        name: error?.name
      });
      
      errorService.logError(error instanceof Error ? error : new Error(errorMessage), {
        component: 'useSavedMatches',
        action: 'loadMatches',
        errorCode: error?.code,
        errorStatus: error?.status
      });
      
      // Determinar tipo de erro para mensagem mais específica
      let errorMsg = 'Erro ao sincronizar com o servidor. Usando dados locais...';
      if (error?.message?.includes('Variáveis de ambiente')) {
        errorMsg = 'Variáveis de ambiente do Supabase não configuradas. Usando dados locais.';
      } else if (error?.message?.includes('Tabela') || error?.code === '42P01') {
        errorMsg = 'Tabela não encontrada no Supabase. Usando dados locais.';
      } else if (error?.message?.includes('conexão') || error?.status === 0) {
        errorMsg = 'Erro de conexão com Supabase. Usando dados locais.';
      } else if (error?.code === '42501' || error?.status === 401) {
        errorMsg = 'Erro de autenticação com Supabase. Verifique as credenciais.';
      }
      
      setSyncError(errorMsg);
      setIsUsingLocalData(true);
      
      if (onError) {
        onError(errorMsg);
      }
      
      // Se não havia dados locais e falhou ao carregar do Supabase, manter array vazio
      if (localMatches.length === 0) {
        console.warn('[useSavedMatches] Nenhum dado disponível (nem local nem remoto)');
        setSavedMatches([]);
      } else {
        console.log(`[useSavedMatches] Usando ${localMatches.length} partida(s) do localStorage como fallback`);
        // Manter os dados locais que já foram carregados
      }
    } finally {
      setIsLoading(false);
      console.log('[useSavedMatches] Carregamento concluído');
    }
  }, [onError]);

  // Salvar partida
  const saveMatch = useCallback(async (match: SavedAnalysis) => {
    try {
      setIsSaving(true);
      setSyncError(null);
      
      const savedMatch = await saveOrUpdateAnalysis(match);
      
      setSavedMatches(prev => {
        const existingIndex = prev.findIndex(m => m.id === match.id);
        const updated = existingIndex >= 0
          ? prev.map(m => m.id === match.id ? savedMatch : m)
          : [savedMatch, ...prev];
        
        // Sincronizar com widgets
        syncMatchesToWidgets(updated);
        
        // Salvar no localStorage
        try {
          localStorage.setItem('goalscan_saved', JSON.stringify(updated));
        } catch (e) {
          console.warn('Erro ao salvar no localStorage:', e);
        }
        
        return updated;
      });
      
      return savedMatch;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      errorService.logError(error instanceof Error ? error : new Error(errorMessage), {
        component: 'useSavedMatches',
        action: 'saveMatch'
      });
      setSyncError('Erro ao salvar no servidor. Os dados foram salvos localmente.');
      if (onError) {
        onError('Erro ao salvar partida. Os dados foram salvos localmente.');
      }
      
      // Salvar localmente como fallback
      setSavedMatches(prev => {
        const existingIndex = prev.findIndex(m => m.id === match.id);
        const updated = existingIndex >= 0
          ? prev.map(m => m.id === match.id ? match : m)
          : [match, ...prev];
        
        try {
          localStorage.setItem('goalscan_saved', JSON.stringify(updated));
        } catch (e) {
          console.error('Erro ao salvar no localStorage:', e);
        }
        
        return updated;
      });
      
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Deletar partida
  const removeMatch = useCallback(async (id: string) => {
    try {
      setSyncError(null);
      await deleteAnalysis(id);
      
      setSavedMatches(prev => {
        const updated = prev.filter(m => m.id !== id);
        syncMatchesToWidgets(updated);
        
        try {
          localStorage.setItem('goalscan_saved', JSON.stringify(updated));
        } catch (e) {
          console.warn('Erro ao atualizar localStorage:', e);
        }
        
        return updated;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      errorService.logError(error instanceof Error ? error : new Error(errorMessage), {
        component: 'useSavedMatches',
        action: 'removeMatch'
      });
      setSyncError('Erro ao deletar no servidor. A partida foi removida localmente.');
      if (onError) {
        onError('Erro ao deletar partida. A partida foi removida localmente.');
      }
      
      // Remover localmente mesmo em caso de erro
      setSavedMatches(prev => prev.filter(m => m.id !== id));
      try {
        const updated = savedMatches.filter(m => m.id !== id);
        localStorage.setItem('goalscan_saved', JSON.stringify(updated));
      } catch (e) {
        console.error('Erro ao atualizar localStorage:', e);
      }
    }
  }, [savedMatches]);

  // Carregar na inicialização
  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  return {
    savedMatches,
    isLoading,
    isSaving,
    syncError,
    isUsingLocalData,
    saveMatch,
    removeMatch,
    reloadMatches: loadMatches
  };
};

