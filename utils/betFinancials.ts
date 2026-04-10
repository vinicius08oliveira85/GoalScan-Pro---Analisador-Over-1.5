import Decimal from 'decimal.js';
import type { BetInfo, SavedAnalysis } from '../types';
import { roundMoney2 } from './bankMoney';

/**
 * Retorno e lucro do bilhete (odd decimal de mercado), sem alavancagem da banca:
 * retorno bruto = stake × odd; lucro líquido = retorno − stake = stake × (odd − 1).
 */
export function computeBetPayouts(
  betAmount: number,
  odd: number
): { potentialReturn: number; potentialProfit: number } {
  if (!Number.isFinite(betAmount) || betAmount <= 0 || !Number.isFinite(odd) || odd <= 0) {
    return { potentialReturn: 0, potentialProfit: 0 };
  }
  const potentialReturn = roundMoney2(new Decimal(betAmount).mul(odd));
  const potentialProfit = roundMoney2(new Decimal(potentialReturn).minus(betAmount));
  return { potentialReturn, potentialProfit };
}

/**
 * Apostas finalizadas: mantém valores gravados na aposta.
 * Pendentes: recalcula com a odd atual da partida (formulário), com fallback para odd salva.
 */
export function getBetDisplayFinancials(match: SavedAnalysis): {
  potentialReturn: number;
  potentialProfit: number;
} {
  const bi = match.betInfo;
  if (!bi || bi.betAmount <= 0) {
    return { potentialReturn: 0, potentialProfit: 0 };
  }
  if (bi.status === 'won') {
    const oddSettled = bi.odd > 0 ? bi.odd : 0;
    if (oddSettled > 0) {
      return computeBetPayouts(bi.betAmount, oddSettled);
    }
    return { potentialReturn: bi.potentialReturn, potentialProfit: bi.potentialProfit };
  }
  if (bi.status === 'lost') {
    return { potentialReturn: bi.potentialReturn, potentialProfit: bi.potentialProfit };
  }
  const liveOdd =
    Number.isFinite(match.data.oddOver15) && (match.data.oddOver15 as number) > 1
      ? (match.data.oddOver15 as number)
      : bi.odd > 0
        ? bi.odd
        : 0;
  return computeBetPayouts(bi.betAmount, liveOdd);
}

/** Atualiza odd e valores projetados na aposta pendente antes de persistir a análise. */
export function syncPendingBetInfoWithMatchOdd(
  betInfo: BetInfo,
  matchOdd: number | undefined | null
): BetInfo {
  if (betInfo.betAmount <= 0 || betInfo.status !== 'pending') {
    return betInfo;
  }
  const odd =
    Number.isFinite(matchOdd) && (matchOdd as number) > 1
      ? (matchOdd as number)
      : betInfo.odd > 0
        ? betInfo.odd
        : betInfo.odd;
  const { potentialReturn, potentialProfit } = computeBetPayouts(betInfo.betAmount, odd);
  return {
    ...betInfo,
    odd,
    potentialReturn,
    potentialProfit,
  };
}
