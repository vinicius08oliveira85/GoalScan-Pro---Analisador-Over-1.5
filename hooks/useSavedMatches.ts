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

  // Carregar partidas salvas
  const loadMatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setSyncError(null);
      const matches = await loadSavedAnalyses();
      setSavedMatches(matches);
      
      // Salvar no localStorage como backup
      try {
        localStorage.setItem('goalscan_saved', JSON.stringify(matches));
        syncMatchesToWidgets(matches);
      } catch (e) {
        console.warn('Erro ao salvar no localStorage (backup):', e);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      errorService.logError(error instanceof Error ? error : new Error(errorMessage), {
        component: 'useSavedMatches',
        action: 'loadMatches'
      });
      setSyncError('Erro ao sincronizar com o servidor. Usando dados locais...');
      if (onError) {
        onError('Erro ao carregar partidas salvas. Usando dados locais.');
      }
      
      // Tentar carregar do localStorage como fallback
      const stored = localStorage.getItem('goalscan_saved');
      if (stored) {
        try {
          setSavedMatches(JSON.parse(stored));
        } catch (e) {
          console.error('Erro ao carregar do localStorage:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    saveMatch,
    removeMatch,
    reloadMatches: loadMatches
  };
};

