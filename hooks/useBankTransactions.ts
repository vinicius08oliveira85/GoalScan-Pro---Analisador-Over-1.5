import { useCallback, useMemo } from 'react';
import type { AnalysisResult, BankSettings, BetInfo, MatchData, SavedAnalysis } from '../types';
import { runSaveBetInfoFlow, type SaveBetInfoFlowContext } from '../services/bankTransactionService';
import { syncPendingBetInfoWithMatchOdd } from '../utils/betFinancials';

export type UseBankTransactionsArgs = {
  bankSettings: BankSettings | null | undefined;
  selectedMatch: SavedAnalysis | null;
  setSelectedMatch: React.Dispatch<React.SetStateAction<SavedAnalysis | null>>;
  currentMatchData: MatchData | null;
  setCurrentMatchData: React.Dispatch<React.SetStateAction<MatchData | null>>;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
  saveMatch: (m: SavedAnalysis) => Promise<SavedAnalysis>;
  saveSettings: (s: BankSettings) => Promise<void>;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  isUpdatingBetStatus: boolean;
  setIsUpdatingBetStatus: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useBankTransactions({
  bankSettings,
  selectedMatch,
  setSelectedMatch,
  currentMatchData,
  setCurrentMatchData,
  analysisResult,
  setAnalysisResult,
  saveMatch,
  saveSettings,
  showError,
  showSuccess,
  isUpdatingBetStatus,
  setIsUpdatingBetStatus,
}: UseBankTransactionsArgs) {
  const flowCtx: SaveBetInfoFlowContext = useMemo(
    () => ({
      bankSettings,
      selectedMatch,
      currentMatchData,
      analysisResult,
      isUpdatingBetStatus,
      saveMatch,
      saveSettings,
      showError,
      showSuccess,
      setSelectedMatch,
    }),
    [
      bankSettings,
      selectedMatch,
      currentMatchData,
      analysisResult,
      isUpdatingBetStatus,
      saveMatch,
      saveSettings,
      showError,
      showSuccess,
      setSelectedMatch,
    ]
  );

  const handleSaveBetInfo = useCallback(
    async (betInfo: BetInfo, providedOldBetInfo?: BetInfo) => {
      await runSaveBetInfoFlow(flowCtx, betInfo, providedOldBetInfo);
    },
    [flowCtx]
  );

  const handleUpdateBetStatus = useCallback(
    async (match: SavedAnalysis, status: 'won' | 'lost') => {
      if (!match.betInfo || match.betInfo.betAmount === 0) {
        showError('Esta partida não possui aposta registrada.');
        return;
      }

      if (match.betInfo.status === status) {
        return;
      }

      if (isUpdatingBetStatus) {
        return;
      }

      try {
        setIsUpdatingBetStatus(true);

        const oldBetInfo = match.betInfo;
        const financialsBase =
          oldBetInfo.status === 'pending'
            ? syncPendingBetInfoWithMatchOdd(oldBetInfo, match.data.oddOver15)
            : oldBetInfo;
        const updatedBetInfo: BetInfo = {
          ...financialsBase,
          status,
          resultAt: Date.now(),
        };

        const updatedMatch: SavedAnalysis = {
          ...match,
          betInfo: updatedBetInfo,
          timestamp: Date.now(),
        };

        setSelectedMatch((prev) => {
          if (prev && prev.id === match.id) {
            return updatedMatch;
          }
          return prev;
        });
        setCurrentMatchData((prev) => prev ?? match.data);
        setAnalysisResult((prev) => prev ?? match.result);

        await runSaveBetInfoFlow(flowCtx, updatedBetInfo, oldBetInfo);

        showSuccess(`Aposta marcada como ${status === 'won' ? 'ganha' : 'perdida'}!`);
      } catch {
        showError('Erro ao atualizar status da aposta. Tente novamente.');
      } finally {
        setIsUpdatingBetStatus(false);
      }
    },
    [
      flowCtx,
      isUpdatingBetStatus,
      setAnalysisResult,
      setCurrentMatchData,
      setIsUpdatingBetStatus,
      setSelectedMatch,
      showError,
      showSuccess,
    ]
  );

  return { handleSaveBetInfo, handleUpdateBetStatus };
}
