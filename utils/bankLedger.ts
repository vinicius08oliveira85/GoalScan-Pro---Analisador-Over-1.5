import Decimal from 'decimal.js';
import type { BetInfo, SavedAnalysis } from '../types';
import { roundMoney2, sumMoneyValues } from './bankMoney';
import { computeBetPayouts, getBetDisplayFinancials } from './betFinancials';

export type BankCurvePoint = {
  date: string; // label (ex.: "12 jan" ou "Início")
  timestamp: number; // usado para ordenar e tooltips
  cash: number; // banca disponível (desconta pendentes)
  equity: number; // cash + valor travado em pendentes
};

export type BankLedgerSummary = {
  realizedProfit: number; // lucro/prejuízo apenas de apostas finalizadas (won/lost)
  investedSettled: number; // soma de stakes (won/lost)
  roiSettledPct: number; // ROI (%) em apostas finalizadas

  wonBets: number;
  lostBets: number;
  pendingBets: number;
  cancelledBets: number;

  pendingExposure: number; // soma de stakes pendentes
};

type BankEvent = {
  ts: number;
  kind: 'place' | 'settle';
  matchId: string;
  amount: number;
  potentialReturn: number;
  status: BetInfo['status'];
};

const BR_TZ = 'America/Sao_Paulo';

function clampNonNegativeMoney(value: number): number {
  return Math.max(0, roundMoney2(value));
}

function sumMoney(values: number[]): number {
  return sumMoneyValues(values.filter((v) => Number.isFinite(v)));
}

function formatDayLabel(ts: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    day: '2-digit',
    month: 'short',
  }).format(new Date(ts));
}

function getSafePlacedAt(match: SavedAnalysis): number {
  const placedAt = match.betInfo?.placedAt;
  if (typeof placedAt === 'number' && Number.isFinite(placedAt) && placedAt > 0) return placedAt;
  return match.timestamp;
}

function getSafeResultAt(match: SavedAnalysis, placedAt: number): number {
  const resultAt = match.betInfo?.resultAt;
  const raw =
    typeof resultAt === 'number' && Number.isFinite(resultAt) && resultAt > 0
      ? resultAt
      : match.timestamp;
  // Evitar settle antes do place quando timestamps estão ausentes/invertidos
  return Math.max(raw, placedAt);
}

export function computeNetCashDelta(savedMatches: SavedAnalysis[]): number {
  // Delta de cash entre base e agora, olhando apenas o estado atual das apostas.
  // won: +profit, lost/pending: -stake, cancelled: 0
  const deltas: number[] = [];

  for (const match of savedMatches) {
    const bet = match.betInfo;
    if (!bet || !(bet.betAmount > 0)) continue;

    if (bet.status === 'won') {
      deltas.push(getBetDisplayFinancials(match).potentialProfit);
    } else if (bet.status === 'lost' || bet.status === 'pending') {
      deltas.push(-bet.betAmount);
    }
  }

  return sumMoneyValues(deltas);
}

export function buildBankCurve(
  savedMatches: SavedAnalysis[],
  baseCash: number
): { series: BankCurvePoint[]; summary: BankLedgerSummary; finalCash: number; finalEquity: number } {
  const events: BankEvent[] = [];

  const counts = {
    won: 0,
    lost: 0,
    pending: 0,
    cancelled: 0,
  };

  const realizedProfitParts: number[] = [];
  const investedSettledParts: number[] = [];
  const pendingExposureParts: number[] = [];

  for (const match of savedMatches) {
    const bet = match.betInfo;
    if (!bet || !(bet.betAmount > 0)) continue;

    counts[bet.status] += 1;

    if (bet.status === 'won') {
      realizedProfitParts.push(getBetDisplayFinancials(match).potentialProfit);
      investedSettledParts.push(bet.betAmount);
    } else if (bet.status === 'lost') {
      realizedProfitParts.push(-bet.betAmount);
      investedSettledParts.push(bet.betAmount);
    } else if (bet.status === 'pending') {
      pendingExposureParts.push(bet.betAmount);
    }

    const placedAt = getSafePlacedAt(match);
    const payout =
      bet.odd > 0 ? computeBetPayouts(bet.betAmount, bet.odd) : null;
    const returnOnWin = payout?.potentialReturn ?? bet.potentialReturn;

    events.push({
      ts: placedAt,
      kind: 'place',
      matchId: match.id,
      amount: bet.betAmount,
      potentialReturn: returnOnWin,
      status: bet.status,
    });

    if (bet.status !== 'pending') {
      const settleAt = getSafeResultAt(match, placedAt);
      events.push({
        ts: settleAt,
        kind: 'settle',
        matchId: match.id,
        amount: bet.betAmount,
        potentialReturn: returnOnWin,
        status: bet.status,
      });
    }
  }

  const summary: BankLedgerSummary = {
    realizedProfit: sumMoney(realizedProfitParts),
    investedSettled: sumMoney(investedSettledParts),
    roiSettledPct: 0,

    wonBets: counts.won,
    lostBets: counts.lost,
    pendingBets: counts.pending,
    cancelledBets: counts.cancelled,

    pendingExposure: sumMoney(pendingExposureParts),
  };

  summary.roiSettledPct =
    summary.investedSettled > 0
      ? new Decimal(summary.realizedProfit)
          .div(summary.investedSettled)
          .mul(100)
          .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
          .toNumber()
      : 0;

  if (events.length === 0) {
    const base = clampNonNegativeMoney(baseCash);
    return {
      series: [{ date: 'Início', timestamp: Date.now(), cash: base, equity: base }],
      summary,
      finalCash: base,
      finalEquity: base,
    };
  }

  events.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (a.kind !== b.kind) return a.kind === 'place' ? -1 : 1;
    return a.matchId.localeCompare(b.matchId);
  });

  let cash = clampNonNegativeMoney(baseCash);
  let exposure = 0;

  const series: BankCurvePoint[] = [
    {
      date: 'Início',
      timestamp: events[0].ts - 1,
      cash,
      equity: clampNonNegativeMoney(cash + exposure),
    },
  ];

  let currentDayLabel: string | null = null;
  let lastPoint: BankCurvePoint | null = null;

  for (const ev of events) {
    if (ev.kind === 'place') {
      cash = clampNonNegativeMoney(cash - ev.amount);
      exposure = clampNonNegativeMoney(exposure + ev.amount);
    } else {
      if (ev.status === 'won') {
        cash = clampNonNegativeMoney(cash + ev.potentialReturn);
      } else if (ev.status === 'cancelled') {
        cash = clampNonNegativeMoney(cash + ev.amount);
      }
      exposure = clampNonNegativeMoney(exposure - ev.amount);
    }

    const label = formatDayLabel(ev.ts);
    if (currentDayLabel === null) currentDayLabel = label;

    if (label !== currentDayLabel) {
      if (lastPoint) series.push(lastPoint);
      currentDayLabel = label;
    }

    lastPoint = {
      date: label,
      timestamp: ev.ts,
      cash,
      equity: clampNonNegativeMoney(cash + exposure),
    };
  }

  if (lastPoint) series.push(lastPoint);

  return {
    series,
    summary,
    finalCash: cash,
    finalEquity: clampNonNegativeMoney(cash + exposure),
  };
}


