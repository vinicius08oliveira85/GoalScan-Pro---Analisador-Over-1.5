import { useState, useEffect, useCallback } from 'react';
import { Championship, ChampionshipTable, TableType } from '../types';
import {
  loadChampionships,
  loadChampionship,
  saveChampionship,
  deleteChampionship,
  loadChampionshipTables,
  saveChampionshipTable,
  getSquadsFromTable,
} from '../services/championshipService';
import { logger } from '../utils/logger';

export const useChampionships = (onError?: (message: string) => void) => {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Carregar campeonatos
  const load = useCallback(async () => {
    logger.log('[useChampionships] Iniciando carregamento de campeonatos...');
    setIsLoading(true);

    // Primeiro, carregar do localStorage para renderização imediata
    let localData: Championship[] = [];
    try {
      const stored = localStorage.getItem('goalscan_championships');
      if (stored) {
        localData = JSON.parse(stored);
        if (Array.isArray(localData) && localData.length > 0) {
          setChampionships(localData);
          logger.log(`[useChampionships] Carregado ${localData.length} campeonato(s) do localStorage`);
          setIsLoading(false); // Renderizar imediatamente com dados locais
        }
      }
    } catch (localError) {
      // Ignorar erro do localStorage
      logger.warn('[useChampionships] Erro ao ler localStorage:', localError);
    }

    // Se não houver dados locais, garantir que isLoading seja false
    if (localData.length === 0) {
      setChampionships([]);
      setIsLoading(false);
    }

    // Tentar sincronizar com Supabase em background (timeout aumentado para 5 segundos)
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao carregar campeonatos')), 5000)
      );

      const data = await Promise.race([loadChampionships(), timeoutPromise]);
      
      if (Array.isArray(data)) {
        logger.log(`[useChampionships] ${data.length} campeonato(s) carregado(s) do Supabase`);
        setChampionships(data);
        
        // Atualizar localStorage com dados do Supabase
        try {
          localStorage.setItem('goalscan_championships', JSON.stringify(data));
        } catch (storageError) {
          logger.warn('[useChampionships] Erro ao salvar no localStorage:', storageError);
        }
      }
    } catch (supabaseError) {
      // Se falhar, manter dados do localStorage se existirem
      const errorMessage = supabaseError instanceof Error ? supabaseError.message : 'Erro desconhecido';
      
      // Não logar timeout como erro crítico
      if (errorMessage.includes('Timeout')) {
        logger.warn('[useChampionships] Timeout ao carregar do Supabase, usando localStorage');
      } else {
        logger.warn('[useChampionships] Erro ao carregar do Supabase, usando localStorage:', errorMessage);
      }

      // Garantir que temos dados do localStorage
      if (localData.length === 0) {
        try {
          const stored = localStorage.getItem('goalscan_championships');
          if (stored) {
            const fallbackData = JSON.parse(stored);
            if (Array.isArray(fallbackData)) {
              setChampionships(fallbackData);
            }
          }
        } catch {
          // Se tudo falhar, manter array vazio
          setChampionships([]);
        }
      }
    }
  }, [onError]);

  // Carregar ao montar componente
  useEffect(() => {
    load();
  }, [load]);

  // Salvar campeonato
  const save = useCallback(
    async (championship: Championship): Promise<Championship | null> => {
      logger.log('[useChampionships] Salvando campeonato...', championship.nome);
      setIsSaving(true);

      try {
        const saved = await saveChampionship(championship);
        logger.log('[useChampionships] Campeonato salvo com sucesso');

        // Atualizar lista local
        setChampionships((prev) => {
          const existingIndex = prev.findIndex((c) => c.id === saved.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = saved;
            return updated;
          }
          return [...prev, saved];
        });

        return saved;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('[useChampionships] Erro ao salvar campeonato:', errorMessage);

        if (onError) {
          onError(`Erro ao salvar campeonato: ${errorMessage}`);
        }
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [onError]
  );

  // Deletar campeonato
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      logger.log('[useChampionships] Deletando campeonato...', id);
      setIsSaving(true);

      try {
        await deleteChampionship(id);
        logger.log('[useChampionships] Campeonato deletado com sucesso');

        // Atualizar lista local
        setChampionships((prev) => prev.filter((c) => c.id !== id));

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('[useChampionships] Erro ao deletar campeonato:', errorMessage);

        if (onError) {
          onError(`Erro ao deletar campeonato: ${errorMessage}`);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [onError]
  );

  // Carregar tabelas de um campeonato
  const loadTables = useCallback(
    async (championshipId: string): Promise<ChampionshipTable[]> => {
      try {
        return await loadChampionshipTables(championshipId);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('[useChampionships] Erro ao carregar tabelas:', errorMessage);

        if (onError) {
          onError(`Erro ao carregar tabelas: ${errorMessage}`);
        }
        return [];
      }
    },
    [onError]
  );

  // Salvar tabela
  const saveTable = useCallback(
    async (table: ChampionshipTable): Promise<ChampionshipTable | null> => {
      try {
        return await saveChampionshipTable(table);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('[useChampionships] Erro ao salvar tabela:', errorMessage);

        if (onError) {
          onError(`Erro ao salvar tabela: ${errorMessage}`);
        }
        return null;
      }
    },
    [onError]
  );

  // Obter Squads de uma tabela
  const getSquads = useCallback(
    async (championshipId: string, tableType: TableType = 'geral'): Promise<string[]> => {
      try {
        return await getSquadsFromTable(championshipId, tableType);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('[useChampionships] Erro ao obter Squads:', errorMessage);
        return [];
      }
    },
    []
  );

  return {
    championships,
    isLoading,
    isSaving,
    load,
    save,
    remove,
    loadTables,
    saveTable,
    getSquads,
  };
};

