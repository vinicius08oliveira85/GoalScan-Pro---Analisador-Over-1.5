import Decimal from 'decimal.js';
import type { BetInfo } from '../types';
import { calculateBankUpdate } from '../utils/bankCalculator';
import { applyBankDelta, decimalMoney, roundMoney2 } from '../utils/bankMoney';
import { getSupabaseClient } from '../lib/supabase';
import { logger } from '../utils/logger';

export type BankSaveBetContext = {
  oldBetInfo?: BetInfo;
  betInfo: BetInfo;
};

export type AtomicLedgerType = 'DEBIT' | 'CREDIT' | 'PROFIT';

/**
 * Classificação de auditoria para `bank_transactions` (movimento sempre em valor absoluto).
 * Ganho pendente→ganhou usa PROFIT; reembolsos/cancelamentos CREDIT; saídas DEBIT.
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
 * Replica a lógica de delta de banca (usada para derivar o movimento enviado à RPC).
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

export type ProcessBetTransactionParams = {
  settingsId?: string;
  betId: string;
  signedDelta: number;
  ledgerType: AtomicLedgerType;
  ledgerAmount: number;
  betInfo: BetInfo;
  incrementLeverageProgressionDay?: boolean;
};

export type ProcessBetTransactionResult =
  | { ok: true; balanceAfter: number; betInfoFromRpc?: unknown }
  | { ok: false; error: string };

/**
 * Operação atômica no Postgres (RPC `process_bet_transaction`): banca + ledger + `saved_analyses.bet_info`.
 */
export async function processBetTransactionAtomic(
  params: ProcessBetTransactionParams
): Promise<ProcessBetTransactionResult> {
  const signed = roundMoney2(decimalMoney(params.signedDelta));
  const needBankMove = signed !== 0;
  const needIncrement = Boolean(params.incrementLeverageProgressionDay);
  if (!needBankMove && !needIncrement) {
    return { ok: false, error: 'noop' };
  }

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('process_bet_transaction', {
      p_settings_id: params.settingsId ?? 'default',
      p_bet_id: params.betId,
      p_signed_delta: signed,
      p_tx_type: params.ledgerType,
      p_tx_amount: needBankMove ? params.ledgerAmount : 0,
      p_bet_info: JSON.parse(JSON.stringify(params.betInfo)) as Record<string, unknown>,
      p_increment_leverage_day: needIncrement,
    });

    if (error) {
      logger.warn('[bankService] RPC process_bet_transaction', error.message);
      return { ok: false, error: error.message };
    }

    const row = data as Record<string, unknown> | null;
    const rawBal = row?.balance_after;
    const balanceAfterNum =
      typeof rawBal === 'number'
        ? rawBal
        : typeof rawBal === 'string'
          ? Number.parseFloat(rawBal)
          : NaN;
    const balanceAfter = Number.isFinite(balanceAfterNum) ? roundMoney2(balanceAfterNum) : NaN;

    if (!Number.isFinite(balanceAfter)) {
      return { ok: false, error: 'Resposta RPC sem balance_after válido.' };
    }

    return { ok: true, balanceAfter, betInfoFromRpc: row?.bet_info ?? row?.betInfo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[bankService] processBetTransactionAtomic', msg);
    return { ok: false, error: msg };
  }
}

/** Mescla `leverageProgressionDay` retornado pela RPC no `betInfo` local. */
export function mergeBetInfoAfterRpc(base: BetInfo, rpcBetInfo: unknown): BetInfo {
  if (!rpcBetInfo || typeof rpcBetInfo !== 'object') return base;
  const o = rpcBetInfo as Record<string, unknown>;
  const day = o.leverageProgressionDay;
  if (typeof day === 'number' && Number.isFinite(day)) {
    return { ...base, leverageProgressionDay: Math.trunc(day) };
  }
  return base;
}

/** Payload alinhado a logging / fallback. */
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
 * Fallback quando a RPC não está disponível ou falha (sem alterar saldo no servidor).
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
