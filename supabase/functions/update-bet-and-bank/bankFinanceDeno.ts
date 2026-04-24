/**
 * Cálculos financeiros para a Edge Function (Deno).
 * Manter alinhado com `utils/bankDifferenceCore.ts` + `utils/bankCalculator.ts` + `utils/bankMoney.ts`.
 */
import Decimal from "https://esm.sh/decimal.js@10.6.0";

export type BetStatus = "pending" | "won" | "lost" | "cancelled" | undefined | null;

export type BetInfoLike = {
  betAmount: number;
  potentialReturn: number;
  status: "pending" | "won" | "lost" | "cancelled";
};

function decimalMoney(value: number | string): Decimal {
  const d = new Decimal(value);
  return d.isFinite() ? d : new Decimal(0);
}

function roundMoney2(value: Decimal | number | string): number {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (!d.isFinite()) return 0;
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function getStatusImpact(status: BetStatus, amount: number, potentialReturn: number): Decimal {
  const a = decimalMoney(amount);
  const pr = decimalMoney(potentialReturn);
  switch (status) {
    case "pending":
    case "lost":
      return a.neg();
    case "won":
      return pr.minus(a);
    case "cancelled":
    default:
      return new Decimal(0);
  }
}

function calculateBankUpdate(
  oldStatus: BetStatus,
  newStatus: BetStatus,
  betAmount: number,
  potentialReturn: number
): number {
  if (oldStatus === newStatus) return 0;
  const oldImpact = getStatusImpact(oldStatus, betAmount, potentialReturn);
  const newImpact = getStatusImpact(newStatus, betAmount, potentialReturn);
  return roundMoney2(newImpact.minus(oldImpact));
}

export type AtomicLedgerType = "DEBIT" | "CREDIT" | "PROFIT";

export function ledgerForSignedDelta(
  signedDelta: number,
  ctx: { oldStatus?: BetInfoLike["status"]; newStatus: BetInfoLike["status"] }
): { type: AtomicLedgerType; amount: number } {
  const d = decimalMoney(signedDelta);
  if (d.lt(0)) return { type: "DEBIT", amount: roundMoney2(d.abs()) };
  if (d.gt(0)) {
    if (ctx.oldStatus === "pending" && ctx.newStatus === "won") {
      return { type: "PROFIT", amount: roundMoney2(d) };
    }
    return { type: "CREDIT", amount: roundMoney2(d) };
  }
  return { type: "CREDIT", amount: 0 };
}

export function computeBankDifferenceForBetSave(ctx: {
  oldBetInfo?: BetInfoLike;
  betInfo: BetInfoLike;
}): number {
  const { oldBetInfo, betInfo } = ctx;
  const isNewBet = !oldBetInfo || oldBetInfo.betAmount === 0;
  const isRemovingBet = betInfo.betAmount === 0 || betInfo.status === "cancelled";

  let oldStatus: BetInfoLike["status"] | undefined;
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
    if (oldStatus === "pending") {
      valueChangeAdj = decimalMoney(oldBetAmount).minus(newBetAmount);
    } else if (oldStatus === "won") {
      const oldReturn = oldBetInfo!.potentialReturn || 0;
      valueChangeAdj = decimalMoney(betInfo.potentialReturn).minus(oldReturn);
    } else if (oldStatus === "lost") {
      valueChangeAdj = decimalMoney(oldBetAmount).minus(newBetAmount);
    }
  }

  const statusDelta = decimalMoney(
    calculateBankUpdate(oldStatus, newStatus, betAmountForCalc, potentialReturnForCalc)
  );
  return roundMoney2(statusDelta.plus(valueChangeAdj));
}
