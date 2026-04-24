import Decimal from 'decimal.js';
import type { BetInfo } from '../types';
import { calculateBankUpdate } from './bankCalculator';
import { decimalMoney, roundMoney2 } from './bankMoney';

export type AtomicLedgerType = 'DEBIT' | 'CREDIT' | 'PROFIT';

export type BankSaveBetContext = {
  oldBetInfo?: BetInfo;
  betInfo: BetInfo;
};

/**
 * Classificação de auditoria para `bank_transactions` (movimento sempre em valor absoluto).
 */
export function ledgerForSignedDelta(
  signedDelta: number,
  ctx: { oldStatus?: BetInfo['status']; newStatus: BetInfo['status'] }
): { type: AtomicLedgerType; amount: number } {
  const d = decimalMoney(signedDelta);
  if (d.lt(0)) {
    return { type: 'DEBIT', amount: roundMoney2(d.abs()) };
  }
  if (d.gt(0)) {
    if (ctx.oldStatus === 'pending' && ctx.newStatus === 'won') {
      return { type: 'PROFIT', amount: roundMoney2(d) };
    }
    return { type: 'CREDIT', amount: roundMoney2(d) };
  }
  return { type: 'CREDIT', amount: 0 };
}

/**
 * Delta de banca ao salvar/atualizar aposta (mesma regra usada pela RPC / Edge).
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
