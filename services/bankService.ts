import Decimal from 'decimal.js';
import type { BetInfo } from '../types';
import { calculateBankUpdate } from '../utils/bankCalculator';
import { applyBankDelta, decimalMoney, roundMoney2 } from '../utils/bankMoney';

export type BankSaveBetContext = {
  oldBetInfo?: BetInfo;
  betInfo: BetInfo;
};

/**
 * Replica a lógica de delta de banca usada ao salvar/atualizar aposta (antes aplicada em App.tsx).
 * Retorna 0 se nenhum ajuste for necessário.
 */
export function computeBankDifferenceForBetSave(ctx: BankSaveBetContext): number {
  const { oldBetInfo, betInfo } = ctx;
  const isNewBet = !oldBetInfo || oldBetInfo.betAmount === 0;
  const isRemovingBet = betInfo.betAmount === 0 || betInfo.status === 'cancelled';

  let oldStatus: BetInfo['status'] | undefined;
  let oldBetAmount = 0;

  if (isNewBet) {
    oldStatus = undefined;
  } else {
    oldStatus = oldBetInfo!.status;
    oldBetAmount = oldBetInfo!.betAmount;
  }

  const newStatus = betInfo.status;
  const newBetAmount = betInfo.betAmount;

  const statusChanged = oldStatus !== newStatus;
  const valueChanged = oldBetAmount !== newBetAmount;
  const needsBankUpdate = isNewBet || isRemovingBet || statusChanged || valueChanged;

  if (!needsBankUpdate) return 0;

  const betAmountForCalc = isRemovingBet ? oldBetAmount : newBetAmount;
  const potentialReturnForCalc = isRemovingBet
    ? oldBetInfo?.potentialReturn || 0
    : betInfo.potentialReturn;

  let valueChangeAdj = new Decimal(0);
  if (!isNewBet && !isRemovingBet && valueChanged && oldStatus) {
    if (oldStatus === 'pending') {
      valueChangeAdj = decimalMoney(oldBetAmount).minus(newBetAmount);
    } else if (oldStatus === 'won') {
      const oldReturn = oldBetInfo!.potentialReturn || 0;
      valueChangeAdj = decimalMoney(betInfo.potentialReturn).minus(oldReturn);
    } else if (oldStatus === 'lost') {
      valueChangeAdj = decimalMoney(oldBetAmount).minus(newBetAmount);
    }
  }

  const statusDelta = decimalMoney(
    calculateBankUpdate(oldStatus, newStatus, betAmountForCalc, potentialReturnForCalc)
  );
  return roundMoney2(statusDelta.plus(valueChangeAdj));
}

export function computeNextTotalBank(currentTotalBank: number, delta: number): number {
  return applyBankDelta(currentTotalBank, delta);
}

/** Payload alinhado a uma futura Edge Function `update-bet-and-bank` no Supabase. */
export type UpdateBetAndBankPayload = {
  matchId: string;
  betInfo: BetInfo;
  totalBankBefore: number;
  bankDelta: number;
  totalBankAfter: number;
};

export type UpdateBetAndBankResult =
  | { ok: true; requestId: string; serverTotalBank?: number }
  | { ok: false; error: string };

/**
 * Mock da chamada atômica ao backend. Substituir por `supabase.functions.invoke('update-bet-and-bank')`
 * quando a função existir; hoje apenas simula latência e eco dos dados.
 */
export async function updateBetAndBankEdgeFunctionMock(
  payload: UpdateBetAndBankPayload
): Promise<UpdateBetAndBankResult> {
  await new Promise((r) => setTimeout(r, 30));
  if (!(payload.totalBankAfter >= 0)) {
    return { ok: false, error: 'Saldo inválido após transação' };
  }
  return {
    ok: true,
    requestId: `edge_mock_${Date.now()}_${payload.matchId.slice(0, 8)}`,
    serverTotalBank: payload.totalBankAfter,
  };
}
