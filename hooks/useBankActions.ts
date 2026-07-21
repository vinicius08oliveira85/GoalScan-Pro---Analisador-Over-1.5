import { useState, useCallback } from 'react';
import {
  BankSettings,
  BetInfo,
  SavedAnalysis,
  MatchData,
  AnalysisResult,
} from '../types';
import { calculateBankUpdate } from '../utils/bankCalculator';

interface UseBankActionsProps {
  bankSettings?: BankSettings;
  selectedMatch: SavedAnalysis | null;
  currentMatchData: MatchData | null;
  analysisResult: AnalysisResult | null;
  saveSettings: (settings: BankSettings) => Promise<void>;
  saveMatch: (match: SavedAnalysis) => Promise<SavedAnalysis>;
  setSelectedMatch: (match: SavedAnalysis | null) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export const useBankActions = ({
  bankSettings,
  selectedMatch,
  currentMatchData,
  analysisResult,
  saveSettings,
  saveMatch,
  setSelectedMatch,
  showSuccess,
  showError,
}: UseBankActionsProps) => {
  const [isUpdatingBetStatus, setIsUpdatingBetStatus] = useState<boolean>(false);

  const handleSaveBankSettings = useCallback(async (settings: BankSettings) => {
    try {
      await saveSettings(settings);
      showSuccess('Configurações de banca salvas com sucesso!');
    } catch {
      showError('Erro ao salvar configurações de banca.');
    }
  }, [saveSettings, showSuccess, showError]);

  const handleUpdateBetStatus = useCallback(async (match: SavedAnalysis, status: 'won' | 'lost') => {
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
      const updatedBetInfo: BetInfo = {
        ...oldBetInfo,
        status,
        resultAt: Date.now(),
      };

      const updatedMatch: SavedAnalysis = {
        ...match,
        betInfo: updatedBetInfo,
        timestamp: Date.now(),
      };

      if (selectedMatch && selectedMatch.id === match.id) {
        setSelectedMatch(updatedMatch);
        if (!currentMatchData) {
          // currentMatchData e analysisResult are not settable here directly
          // but we need to keep the hook interface clean
        }
        if (!analysisResult) {
          // handled above
        }
      }

      await handleSaveBetInfo(updatedBetInfo, oldBetInfo);
      await saveMatch(updatedMatch);

      showSuccess(`Aposta marcada como ${status === 'won' ? 'ganha' : 'perdida'}!`);
    } catch {
      showError('Erro ao atualizar status da aposta. Tente novamente.');
    } finally {
      setIsUpdatingBetStatus(false);
    }
  }, [isUpdatingBetStatus, selectedMatch, currentMatchData, analysisResult, setSelectedMatch, saveMatch, showSuccess, showError]);

  const handleSaveBetInfo = useCallback(async (betInfo: BetInfo, providedOldBetInfo?: BetInfo) => {
    if (isUpdatingBetStatus && !providedOldBetInfo) {
      return;
    }

    if (bankSettings) {
      const oldBetInfo = providedOldBetInfo || selectedMatch?.betInfo;
      const isNewBet = !oldBetInfo || oldBetInfo.betAmount === 0;
      const isRemovingBet = betInfo.betAmount === 0 || betInfo.status === 'cancelled';

      let oldStatus: BetInfo['status'] | undefined;
      let oldBetAmount = 0;

      if (isNewBet) {
        oldStatus = undefined;
      } else {
        oldStatus = oldBetInfo.status;
        oldBetAmount = oldBetInfo.betAmount;
      }

      const newStatus = betInfo.status;
      const newBetAmount = betInfo.betAmount;

      const statusChanged = oldStatus !== newStatus;
      const valueChanged = oldBetAmount !== newBetAmount;
      const needsBankUpdate = isNewBet || isRemovingBet || statusChanged || valueChanged;

      if (needsBankUpdate) {
        const betAmountForCalc = isRemovingBet ? oldBetAmount : newBetAmount;
        const potentialReturnForCalc = isRemovingBet
          ? oldBetInfo?.potentialReturn || 0
          : betInfo.potentialReturn;

        let valueChangeAdjustment = 0;
        if (!isNewBet && !isRemovingBet && valueChanged && oldStatus) {
          if (oldStatus === 'pending') {
            valueChangeAdjustment = oldBetAmount - newBetAmount;
          } else if (oldStatus === 'won') {
            const oldReturn = oldBetInfo.potentialReturn || 0;
            valueChangeAdjustment = betInfo.potentialReturn - oldReturn;
          } else if (oldStatus === 'lost') {
            valueChangeAdjustment = oldBetAmount - newBetAmount;
          }
        }

        const bankDifference =
          calculateBankUpdate(oldStatus, newStatus, betAmountForCalc, potentialReturnForCalc) +
          valueChangeAdjustment;

        if (bankDifference !== 0) {
          const updatedBank = bankSettings.totalBank + bankDifference;
          const newBankSettings: BankSettings = {
            ...bankSettings,
            totalBank: Math.max(0, Number(updatedBank.toFixed(2))),
            updatedAt: Date.now(),
          };
          await saveSettings(newBankSettings);
          showSuccess('Banca atualizada com sucesso!');
        }
      }

      if ((newStatus === 'won' || newStatus === 'lost') && !betInfo.resultAt) {
        betInfo.resultAt = Date.now();
      }
    }

    if (selectedMatch && currentMatchData && analysisResult) {
      try {
        const updatedMatch: SavedAnalysis = {
          ...selectedMatch,
          data: currentMatchData,
          result: analysisResult,
          betInfo,
          timestamp: Date.now(),
        };

        const savedMatch = await saveMatch(updatedMatch);
        setSelectedMatch(savedMatch);
        showSuccess('Aposta atualizada com sucesso!');
      } catch {
        showError('Erro ao salvar aposta. Tente novamente.');
      }
    } else if (currentMatchData && analysisResult) {
      const tempMatch: SavedAnalysis = {
        id: selectedMatch?.id || crypto.randomUUID(),
        timestamp: selectedMatch?.timestamp || Date.now(),
        data: currentMatchData,
        result: analysisResult,
        betInfo,
      };
      setSelectedMatch(tempMatch);
    }
  }, [isUpdatingBetStatus, bankSettings, selectedMatch, currentMatchData, analysisResult, saveSettings, saveMatch, setSelectedMatch, showSuccess, showError]);

  return {
    isUpdatingBetStatus,
    handleSaveBankSettings,
    handleUpdateBetStatus,
    handleSaveBetInfo,
  };
};
