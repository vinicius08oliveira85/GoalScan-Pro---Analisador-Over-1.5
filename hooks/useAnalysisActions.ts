import { useState, useCallback } from 'react';
import { TabType } from '../components/TabNavigation';
import {
  MatchData,
  AnalysisResult,
  SavedAnalysis,
  SelectedBet,
} from '../types';
import { performAnalysis } from '../services/analysisEngine';

interface UseAnalysisActionsProps {
  saveMatch: (match: SavedAnalysis) => Promise<SavedAnalysis>;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  setActiveTab: (tab: TabType) => void;
}

export const useAnalysisActions = ({
  saveMatch,
  showSuccess,
  showError,
  setActiveTab,
}: UseAnalysisActionsProps) => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SavedAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);

  const handleNavigateToAnalysis = useCallback((match: SavedAnalysis | null = null) => {
    if (match) {
      setSelectedMatch(match);
      setCurrentMatchData(match.data);
      setAnalysisResult(match.result);
    } else {
      setSelectedMatch(null);
      setCurrentMatchData(null);
      setAnalysisResult(null);
    }
    setShowAnalysisModal(true);
  }, []);

  const handleCloseAnalysis = useCallback(() => {
    setShowAnalysisModal(false);
    setAnalysisResult(null);
    setCurrentMatchData(null);
    setSelectedMatch(null);
  }, []);

  const handleNewMatch = useCallback(() => {
    handleNavigateToAnalysis(null);
  }, [handleNavigateToAnalysis]);

  const handleAnalyze = useCallback((data: MatchData) => {
    if (import.meta.env.DEV) {
      console.log('[App] ===== handleAnalyze - Dados recebidos do MatchForm =====');
      console.log('[App] Times:', {
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
      });
      console.log('[App] Status das tabelas:', {
        geral: !!(data.homeTableData && data.awayTableData),
        complement: !!(data.homeComplementData && data.awayComplementData && data.competitionComplementAvg),
      });

      const hasGeral = !!(data.homeTableData && data.awayTableData);
      const hasComplement = !!(data.homeComplementData && data.awayComplementData && data.competitionComplementAvg);

      const allTablesPresent = hasGeral && hasComplement;

      if (allTablesPresent) {
        console.log('[App] ✅ Todas as 2 tabelas presentes (geral, complement) - análise será completa');
      } else {
        const missingTables = [];
        if (!hasGeral) missingTables.push('geral');
        if (!hasComplement) missingTables.push('complement');
        console.warn(`[App] ⚠️ Tabelas faltando: ${missingTables.join(', ')} - análise será parcial`);
      }
    }

    const result = performAnalysis(data);
    setAnalysisResult(result);
    setCurrentMatchData(data);

    if (window.innerWidth < 768) {
      window.scrollTo({ top: 600, behavior: 'smooth' });
    }
  }, []);

  const handleOddChange = useCallback((newOdd: number) => {
    if (currentMatchData) {
      const updatedData = { ...currentMatchData, oddOver15: newOdd };
      setCurrentMatchData(updatedData);

      if (analysisResult) {
        const updatedResult = performAnalysis(updatedData);
        setAnalysisResult(updatedResult);
      }
    }
  }, [currentMatchData, analysisResult]);

  const handleSaveMatch = useCallback(async (selectedBets?: SelectedBet[]) => {
    if (analysisResult && currentMatchData) {
      try {
        let matchToSave: SavedAnalysis;

        if (selectedMatch) {
          matchToSave = {
            ...selectedMatch,
            data: currentMatchData,
            result: analysisResult,
            betInfo: selectedMatch.betInfo,
            selectedBets: selectedBets,
            timestamp: Date.now(),
          };
        } else {
          matchToSave = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            data: currentMatchData,
            result: analysisResult,
            selectedBets: selectedBets,
          };
        }

        await saveMatch(matchToSave);
        showSuccess('Partida salva com sucesso!');

        setTimeout(() => {
          handleCloseAnalysis();
          setActiveTab('matches');
        }, 300);
      } catch {
        showError('Erro ao salvar partida. Tente novamente.');
      }
    }
  }, [analysisResult, currentMatchData, selectedMatch, saveMatch, showSuccess, showError, handleCloseAnalysis, setActiveTab]);

  return {
    analysisResult,
    currentMatchData,
    selectedMatch,
    showAnalysisModal,
    setCurrentMatchData,
    setAnalysisResult,
    setSelectedMatch,
    setShowAnalysisModal,
    handleNavigateToAnalysis,
    handleCloseAnalysis,
    handleNewMatch,
    handleAnalyze,
    handleOddChange,
    handleSaveMatch,
  };
};
