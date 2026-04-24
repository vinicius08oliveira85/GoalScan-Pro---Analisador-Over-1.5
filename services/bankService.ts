import type { BetInfo, BankTransaction } from '../types';
import { applyBankDelta, decimalMoney, roundMoney2 } from '../utils/bankMoney';
import { getSupabaseClient } from '../lib/supabase';
import { logger } from '../utils/logger';
import {
  computeBankDifferenceForBetSave,
  ledgerForSignedDelta,
  type AtomicLedgerType,
  type BankSaveBetContext,
} from '../utils/bankDifferenceCore';

export type { AtomicLedgerType, BankSaveBetContext };
export { computeBankDifferenceForBetSave, ledgerForSignedDelta };

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

function parseRpcBalanceRow(data: unknown): { balanceAfter: number; betInfoFromRpc?: unknown } | null {
  const row = data as Record<string, unknown> | null;
  if (!row) return null;
  const rawBal = row.balance_after ?? row.balanceAfter;
  const balanceAfterNum =
    typeof rawBal === 'number'
      ? rawBal
      : typeof rawBal === 'string'
        ? Number.parseFloat(rawBal)
        : NaN;
  const balanceAfter = Number.isFinite(balanceAfterNum) ? roundMoney2(balanceAfterNum) : NaN;
  if (!Number.isFinite(balanceAfter)) return null;
  return { balanceAfter, betInfoFromRpc: row.bet_info ?? row.betInfo };
}

/**
 * Chama a RPC `process_bet_transaction` diretamente (transação atômica no Postgres).
 */
export async function processBetTransactionRpcDirect(
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

    const parsed = parseRpcBalanceRow(data);
    if (!parsed) {
      return { ok: false, error: 'Resposta RPC sem balance_after válido.' };
    }

    return { ok: true, balanceAfter: parsed.balanceAfter, betInfoFromRpc: parsed.betInfoFromRpc };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[bankService] processBetTransactionRpcDirect', msg);
    return { ok: false, error: msg };
  }
}

export type CommitBetBankPayload = {
  matchId: string;
  betInfo: BetInfo;
  oldBetInfo?: BetInfo;
  settingsId?: string;
  incrementLeverageProgressionDay?: boolean;
};

/**
 * Fluxo preferencial: Edge Function recalcula delta com Decimal e delega à RPC atômica.
 * Em falha de rede/função, usa RPC direta com os mesmos parâmetros derivados no cliente.
 */
export async function commitBetToBankAtomic(payload: CommitBetBankPayload): Promise<ProcessBetTransactionResult> {
  const signedDelta = roundMoney2(
    computeBankDifferenceForBetSave({
      oldBetInfo: payload.oldBetInfo,
      betInfo: payload.betInfo,
    })
  );
  const needIncrement = Boolean(payload.incrementLeverageProgressionDay);
  const needBankMove = signedDelta !== 0;

  if (!needBankMove && !needIncrement) {
    return { ok: false, error: 'noop' };
  }

  const ledger = ledgerForSignedDelta(signedDelta, {
    oldStatus: payload.oldBetInfo?.status,
    newStatus: payload.betInfo.status,
  });

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('update-bet-and-bank', {
      body: {
        match_id: payload.matchId,
        bet_info: JSON.parse(JSON.stringify(payload.betInfo)),
        old_bet_info: payload.oldBetInfo ? JSON.parse(JSON.stringify(payload.oldBetInfo)) : null,
        settings_id: payload.settingsId ?? 'default',
        increment_leverage_progression_day: needIncrement,
      },
    });

    if (!error && data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (d.success === true && d.data && typeof d.data === 'object') {
        const inner = d.data as Record<string, unknown>;
        const parsed = parseRpcBalanceRow(inner);
        if (parsed) {
          return { ok: true, balanceAfter: parsed.balanceAfter, betInfoFromRpc: inner.bet_info ?? inner.betInfo };
        }
      }
      if (d.success === false && typeof d.error === 'string') {
        logger.warn('[bankService] Edge update-bet-and-bank', d.error);
      }
    } else if (error) {
      logger.warn('[bankService] invoke update-bet-and-bank', error.message);
    }
  } catch (e) {
    logger.warn('[bankService] commitBetToBankAtomic edge', e instanceof Error ? e.message : String(e));
  }

  return processBetTransactionRpcDirect({
    settingsId: payload.settingsId,
    betId: payload.matchId,
    signedDelta,
    ledgerType: ledger.type,
    ledgerAmount: ledger.amount,
    betInfo: payload.betInfo,
    incrementLeverageProgressionDay: needIncrement,
  });
}

/**
 * @deprecated Use `commitBetToBankAtomic` com old/new bet_info. Mantido para chamadas legadas.
 */
export async function processBetTransactionAtomic(
  params: ProcessBetTransactionParams
): Promise<ProcessBetTransactionResult> {
  return processBetTransactionRpcDirect(params);
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

export function computeNextTotalBank(currentTotalBank: number, delta: number): number {
  return applyBankDelta(currentTotalBank, delta);
}

/**
 * Busca o histórico de transações da banca.
 */
function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapBankTransactionRow(row: Record<string, unknown>): BankTransaction {
  const typeRaw = String(row.type ?? '').toUpperCase();
  const type: BankTransaction['type'] =
    typeRaw === 'CREDIT' ? 'CREDIT' : typeRaw === 'PROFIT' ? 'PROFIT' : 'DEBIT';

  return {
    id: num(row.id),
    bet_id: String(row.bet_id ?? ''),
    amount: num(row.amount),
    type,
    balance_after: row.balance_after != null ? num(row.balance_after) : undefined,
    transaction_type: row.transaction_type != null ? String(row.transaction_type) : null,
    signed_delta: row.signed_delta != null ? num(row.signed_delta) : null,
    old_bank_balance: row.old_bank_balance != null ? num(row.old_bank_balance) : null,
    new_bank_balance: row.new_bank_balance != null ? num(row.new_bank_balance) : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    description: row.description != null ? String(row.description) : null,
  };
}

/**
 * Busca o histórico de transações da banca (`bank_transactions`).
 */
export async function fetchBankHistory(limit = 50): Promise<BankTransaction[]> {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!data?.length) return [];
    return (data as Record<string, unknown>[]).map(mapBankTransactionRow);
  } catch (e) {
    logger.error('[bankService] fetchBankHistory', e);
    return [];
  }
}
