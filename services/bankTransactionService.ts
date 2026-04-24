import type { Dispatch, SetStateAction } from 'react';
import type { AnalysisResult, BankSettings as BankSettingsType, BetInfo, MatchData, SavedAnalysis } from '../types';
import {
  commitBetToBankAtomic,
  computeBankDifferenceForBetSave,
  computeNextTotalBank,
  mergeBetInfoAfterRpc,
  updateBetAndBankEdgeFunctionMock,
} from './bankService';
import { getCurrencySymbol } from '../utils/currency';
import { canCoverPendingBetStake, decimalMoney, roundMoney2 } from '../utils/bankMoney';
import { logger } from '../utils/logger';

export type SaveBetInfoFlowContext = {
  bankSettings: BankSettingsType | null | undefined;
  selectedMatch: SavedAnalysis | null | undefined;
  currentMatchData: MatchData | null | undefined;
  analysisResult: AnalysisResult | null | undefined;
  isUpdatingBetStatus: boolean;
  saveMatch: (m: SavedAnalysis) => Promise<SavedAnalysis>;
  saveSettings: (s: BankSettingsType) => Promise<void>;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  setSelectedMatch: Dispatch<SetStateAction<SavedAnalysis | null>>;
};

/**
 * Persistência de aposta + movimentação de banca (Edge Function + RPC atômica, com fallback local).
 * Extraído de `App.tsx` para testabilidade e camada de serviço clara.
 */
export async function runSaveBetInfoFlow(
  ctx: SaveBetInfoFlowContext,
  betInfo: BetInfo,
  providedOldBetInfo?: BetInfo
): Promise<void> {
  const {
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
  } = ctx;

  if (isUpdatingBetStatus && !providedOldBetInfo) {
    return;
  }

  let workingBet: BetInfo = { ...betInfo };

  if (bankSettings && workingBet.status === 'pending' && workingBet.betAmount > 0) {
    const oldBet = providedOldBetInfo || selectedMatch?.betInfo;
    const prevPending = oldBet?.status === 'pending' ? oldBet.betAmount : 0;
    if (!canCoverPendingBetStake(workingBet.betAmount, bankSettings.totalBank, prevPending)) {
      const maxStake = roundMoney2(decimalMoney(bankSettings.totalBank).plus(prevPending));
      showError(
        `Saldo insuficiente para registrar esta aposta. Stake máximo disponível: ${getCurrencySymbol(bankSettings.currency)} ${maxStake.toFixed(2)}`
      );
      return;
    }
  }

  if (bankSettings && selectedMatch?.id) {
    const dataForSave = currentMatchData ?? selectedMatch.data;
    const resultForSave = analysisResult ?? selectedMatch.result;

    const oldBetInfo = providedOldBetInfo || selectedMatch.betInfo;
    const bankDifference = roundMoney2(
      computeBankDifferenceForBetSave({ oldBetInfo, betInfo: workingBet })
    );
    const incrementLeverageProgressionDay =
      oldBetInfo?.status === 'pending' &&
      workingBet.status === 'won' &&
      Boolean(workingBet.useLeverageProgression);

    const useAtomicRpc =
      Boolean(selectedMatch.id) && (bankDifference !== 0 || incrementLeverageProgressionDay);

    let updatedMatch: SavedAnalysis = {
      ...selectedMatch,
      data: dataForSave,
      result: resultForSave,
      betInfo: workingBet,
      timestamp: Date.now(),
    };

    if (useAtomicRpc) {
      await saveMatch(updatedMatch);
      const rpc = await commitBetToBankAtomic({
        matchId: selectedMatch.id,
        betInfo: workingBet,
        oldBetInfo,
        settingsId: 'default',
        incrementLeverageProgressionDay,
      });

      if (rpc.ok) {
        await saveSettings({
          ...bankSettings,
          totalBank: rpc.balanceAfter,
          updatedAt: Date.now(),
        });
        workingBet = mergeBetInfoAfterRpc(workingBet, rpc.betInfoFromRpc);
        updatedMatch = { ...updatedMatch, betInfo: workingBet };
        logger.log('[BankService] commitBetToBankAtomic OK', rpc.balanceAfter);
      } else if (rpc.error !== 'noop') {
        if (bankDifference !== 0) {
          const updatedBank = computeNextTotalBank(bankSettings.totalBank, bankDifference);
          const newBankSettings: BankSettingsType = {
            ...bankSettings,
            totalBank: updatedBank,
            updatedAt: Date.now(),
          };
          const edgeResult = await updateBetAndBankEdgeFunctionMock({
            matchId: selectedMatch.id,
            betInfo: workingBet,
            totalBankBefore: bankSettings.totalBank,
            bankDelta: bankDifference,
            totalBankAfter: updatedBank,
          });
          if (edgeResult.ok) {
            logger.log('[BankService] Fallback mock OK', edgeResult.requestId);
          }
          await saveSettings(newBankSettings);
        } else {
          logger.warn('[BankService] Transação falhou sem delta de banca', rpc.error);
        }
      }
    } else if (bankDifference !== 0) {
      const updatedBank = computeNextTotalBank(bankSettings.totalBank, bankDifference);
      const newBankSettings: BankSettingsType = {
        ...bankSettings,
        totalBank: updatedBank,
        updatedAt: Date.now(),
      };
      const edgeResult = await updateBetAndBankEdgeFunctionMock({
        matchId: selectedMatch?.id ?? 'local_temp',
        betInfo: workingBet,
        totalBankBefore: bankSettings.totalBank,
        bankDelta: bankDifference,
        totalBankAfter: updatedBank,
      });
      if (edgeResult.ok) {
        logger.log('[BankService] Edge mock OK', edgeResult.requestId);
      }
      await saveSettings(newBankSettings);
    }

    if (
      (workingBet.status === 'won' || workingBet.status === 'lost') &&
      !workingBet.resultAt
    ) {
      workingBet = { ...workingBet, resultAt: Date.now() };
    }

    updatedMatch = { ...updatedMatch, betInfo: workingBet };

    try {
      const savedMatch = await saveMatch(updatedMatch);
      setSelectedMatch(savedMatch);
      showSuccess('Aposta atualizada com sucesso!');
    } catch {
      showError('Erro ao salvar aposta. Tente novamente.');
    }
    return;
  }

  if (bankSettings && (!selectedMatch || !currentMatchData || !analysisResult)) {
    const oldBetInfo = providedOldBetInfo || selectedMatch?.betInfo;
    const bankDifference = roundMoney2(
      computeBankDifferenceForBetSave({ oldBetInfo, betInfo: workingBet })
    );
    if (bankDifference !== 0) {
      const updatedBank = computeNextTotalBank(bankSettings.totalBank, bankDifference);
      await saveSettings({
        ...bankSettings,
        totalBank: updatedBank,
        updatedAt: Date.now(),
      });
      await updateBetAndBankEdgeFunctionMock({
        matchId: selectedMatch?.id ?? 'local_temp',
        betInfo: workingBet,
        totalBankBefore: bankSettings.totalBank,
        bankDelta: bankDifference,
        totalBankAfter: updatedBank,
      });
    }
    if (
      (workingBet.status === 'won' || workingBet.status === 'lost') &&
      !workingBet.resultAt
    ) {
      workingBet = { ...workingBet, resultAt: Date.now() };
    }
  }

  if (selectedMatch && currentMatchData && analysisResult) {
    try {
      const updatedMatch: SavedAnalysis = {
        ...selectedMatch,
        data: currentMatchData,
        result: analysisResult,
        betInfo: workingBet,
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
      id: selectedMatch?.id || Math.random().toString(36).slice(2, 11),
      timestamp: selectedMatch?.timestamp || Date.now(),
      data: currentMatchData,
      result: analysisResult,
      betInfo: workingBet,
    };
    setSelectedMatch(tempMatch);
  }
}
