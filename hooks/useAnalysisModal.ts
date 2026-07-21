import { useState, useCallback } from 'react';
import { performAnalysis } from '../services/analysisEngine';
import type { MatchData, AnalysisResult, SavedAnalysis, SelectedBet } from '../types';
import type { AnalysisUiTab } from '../components/AnalysisDashboard';
import { syncPendingBetInfoWithMatchOdd } from '../utils/betFinancials';
import { logger } from '../utils/logger';

interface UseAnalysisModalOptions {
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  saveMatch: (match: SavedAnalysis) => Promise<void>;
}

export function useAnalysisModal({ showError, showSuccess, saveMatch }: UseAnalysisModalOptions) {
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SavedAnalysis | null>(null);
  const [analysisModalTab, setAnalysisModalTab] = useState<AnalysisUiTab>('dados');

  const handleNavigateToAnalysis = useCallback((match: SavedAnalysis | null = null) => {
    if (match) {
      setSelectedMatch(match);
      setCurrentMatchData(match.data);
      setAnalysisResult(match.result);
      setAnalysisModalTab('verdict');
    } else {
      setSelectedMatch(null);
      setCurrentMatchData(null);
      setAnalysisResult(null);
      setAnalysisModalTab('dados');
    }
    setShowAnalysisModal(true);
  }, []);

  const handleCloseAnalysis = useCallback(() => {
    setShowAnalysisModal(false);
    setAnalysisResult(null);
    setCurrentMatchData(null);
    setSelectedMatch(null);
    setAnalysisModalTab('dados');
  }, []);

  const handleAnalyze = useCallback((data: MatchData) => {
    if (import.meta.env.DEV) {
      logger.log('[App] handleAnalyze - Dados recebidos do MatchForm');
      logger.log('[App] Times:', { homeTeam: data.homeTeam, awayTeam: data.awayTeam });
      const hasGeral = !!(data.homeTableData && data.awayTableData);
      if (hasGeral) {
        logger.log('[App] Tabela geral presente');
      } else {
        logger.warn('[App] Tabela geral ausente');
      }
    }

    const result = performAnalysis(data);
    setAnalysisResult(result);
    setCurrentMatchData(data);
    setAnalysisModalTab('verdict');
  }, []);

  const handleOddChange = useCallback((newOdd: number) => {
    setCurrentMatchData((prev) => {
      if (!prev) return prev;
      const updatedData = { ...prev, oddOver15: newOdd };

      setAnalysisResult((prevResult) => {
        if (!prevResult) return prevResult;
        const updatedResult = performAnalysis(updatedData);
        updatedResult.overUnderProbabilities = prevResult.overUnderProbabilities;
        updatedResult.recommendedCombinations = prevResult.recommendedCombinations;
        return updatedResult;
      });

      return updatedData;
    });
  }, []);

  const handleSaveMatch = useCallback(async (selectedBets?: SelectedBet[]) => {
    if (!analysisResult || !currentMatchData) return;

    try {
      let matchToSave: SavedAnalysis;

      const betInfoToSave =
        selectedMatch?.betInfo &&
        selectedMatch.betInfo.betAmount > 0 &&
        selectedMatch.betInfo.status === 'pending'
          ? syncPendingBetInfoWithMatchOdd(selectedMatch.betInfo, currentMatchData.oddOver15)
          : selectedMatch?.betInfo;

      if (selectedMatch) {
        matchToSave = {
          ...selectedMatch,
          data: currentMatchData,
          result: analysisResult,
          betInfo: betInfoToSave,
          selectedBets,
          timestamp: Date.now(),
        };
      } else {
        matchToSave = {
          id: Math.random().toString(36).slice(2, 11),
          timestamp: Date.now(),
          data: currentMatchData,
          result: analysisResult,
          betInfo: betInfoToSave,
          selectedBets,
        };
      }

      await saveMatch(matchToSave);
      showSuccess('Partida salva com sucesso!');

      setTimeout(() => {
        handleCloseAnalysis();
      }, 300);
    } catch {
      showError('Erro ao salvar partida. Tente novamente.');
    }
  }, [analysisResult, currentMatchData, selectedMatch, saveMatch, showError, showSuccess, handleCloseAnalysis]);

  return {
    showAnalysisModal,
    analysisResult,
    currentMatchData,
    selectedMatch,
    analysisModalTab,
    setAnalysisModalTab,
    setSelectedMatch,
    setCurrentMatchData,
    setAnalysisResult,
    handleNavigateToAnalysis,
    handleCloseAnalysis,
    handleAnalyze,
    handleOddChange,
    handleSaveMatch,
  };
}
