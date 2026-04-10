import Decimal from 'decimal.js';
import type { BetInfo, SavedAnalysis } from '../types';
import { roundMoney2 } from './bankMoney';

/**
 * Retorno e lucro líquido (retorno − stake), alinhados ao BetManager:
 * retorno = stake × odd × alavancagem.
 */
export function computeBetPayouts(
  betAmount: number,
  odd: number,
  leverage: number = 1
): { potentialReturn: number; potentialProfit: number } {
  if (!Number.isFinite(betAmount) || betAmount <= 0 || !Number.isFinite(odd) || odd <= 0) {
    return { potentialReturn: 0, potentialProfit: 0 };
  }
  const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const potentialReturn = roundMoney2(new Decimal(betAmount).mul(odd).mul(lev));
  const potentialProfit = roundMoney2(new Decimal(potentialReturn).minus(betAmount));
  return { potentialReturn, potentialProfit };
}

/**
 * Apostas finalizadas: mantém valores gravados na aposta.
 * Pendentes: recalcula com a odd atual da partida (formulário), com fallback para odd salva.
 */
export function getBetDisplayFinancials(
  match: SavedAnalysis,
  bankDefaultLeverage?: number
): { potentialReturn: number; potentialProfit: number } {
  const bi = match.betInfo;
  if (!bi || bi.betAmount <= 0) {
    return { potentialReturn: 0, potentialProfit: 0 };
  }
  if (bi.status === 'won' || bi.status === 'lost') {
    return { potentialReturn: bi.potentialReturn, potentialProfit: bi.potentialProfit };
  }
  const lev = bi.leverage ?? bankDefaultLeverage ?? 1;
  const liveOdd =
    Number.isFinite(match.data.oddOver15) && (match.data.oddOver15 as number) > 1
      ? (match.data.oddOver15 as number)
      : bi.odd > 0
        ? bi.odd
        : 0;
  return computeBetPayouts(bi.betAmount, liveOdd, lev);
}

/** Atualiza odd e valores projetados na aposta pendente antes de persistir a análise. */
export function syncPendingBetInfoWithMatchOdd(
  betInfo: BetInfo,
  matchOdd: number | undefined | null,
  bankDefaultLeverage?: number
): BetInfo {
  if (betInfo.betAmount <= 0 || betInfo.status !== 'pending') {
    return betInfo;
  }
  const lev = betInfo.leverage ?? bankDefaultLeverage ?? 1;
  const odd =
    Number.isFinite(matchOdd) && (matchOdd as number) > 1
      ? (matchOdd as number)
      : betInfo.odd > 0
        ? betInfo.odd
        : betInfo.odd;
  const { potentialReturn, potentialProfit } = computeBetPayouts(betInfo.betAmount, odd, lev);
  return {
    ...betInfo,
    odd,
    potentialReturn,
    potentialProfit,
  };
}
