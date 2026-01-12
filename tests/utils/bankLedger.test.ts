import { describe, it, expect } from 'vitest';
import type { BetInfo, SavedAnalysis } from '../../types';
import { buildBankCurve, computeNetCashDelta } from '../../utils/bankLedger';

function makeMatch(id: string, betInfo?: BetInfo, timestamp: number = Date.now()): SavedAnalysis {
  return {
    id,
    timestamp,
    data: {} as any,
    result: {} as any,
    betInfo,
  } as SavedAnalysis;
}

describe('bankLedger', () => {
  it('computeNetCashDelta deve somar lucro de won e descontar stake de lost/pending', () => {
    const won = makeMatch(
      'won',
      {
        betAmount: 10,
        odd: 2,
        potentialReturn: 20,
        potentialProfit: 10,
        bankPercentage: 10,
        status: 'won',
        placedAt: 1000,
        resultAt: 2000,
      },
      1000
    );

    const lost = makeMatch(
      'lost',
      {
        betAmount: 5,
        odd: 2,
        potentialReturn: 10,
        potentialProfit: 5,
        bankPercentage: 5,
        status: 'lost',
        placedAt: 3000,
        resultAt: 4000,
      },
      3000
    );

    const pending = makeMatch(
      'pending',
      {
        betAmount: 7,
        odd: 2,
        potentialReturn: 14,
        potentialProfit: 7,
        bankPercentage: 7,
        status: 'pending',
        placedAt: 5000,
      },
      5000
    );

    const cancelled = makeMatch(
      'cancelled',
      {
        betAmount: 3,
        odd: 2,
        potentialReturn: 6,
        potentialProfit: 3,
        bankPercentage: 3,
        status: 'cancelled',
        placedAt: 7000,
        resultAt: 8000,
      },
      7000
    );

    // won: +10, lost: -5, pending: -7, cancelled: 0 => -2
    expect(computeNetCashDelta([won, lost, pending, cancelled])).toBe(-2);
  });

  it('buildBankCurve deve manter equity constante em aposta pending (cash cai, exposure sobe)', () => {
    const base = 100;
    const match = makeMatch(
      'm1',
      {
        betAmount: 10,
        odd: 2,
        potentialReturn: 20,
        potentialProfit: 10,
        bankPercentage: 10,
        status: 'pending',
        placedAt: 1_000_000,
      },
      1_000_000
    );

    const { finalCash, finalEquity, summary } = buildBankCurve([match], base);
    expect(finalCash).toBe(90);
    expect(finalEquity).toBe(100);
    expect(summary.pendingExposure).toBe(10);
    expect(summary.pendingBets).toBe(1);
  });

  it('buildBankCurve deve refletir ganho em aposta won (cash final = base + profit)', () => {
    const base = 100;
    const match = makeMatch(
      'm1',
      {
        betAmount: 10,
        odd: 2,
        potentialReturn: 20,
        potentialProfit: 10,
        bankPercentage: 10,
        status: 'won',
        placedAt: 1_000_000,
        resultAt: 2_000_000,
      },
      1_000_000
    );

    const { finalCash, finalEquity, summary } = buildBankCurve([match], base);
    expect(finalCash).toBe(110);
    expect(finalEquity).toBe(110);
    expect(summary.realizedProfit).toBe(10);
    expect(summary.investedSettled).toBe(10);
    expect(summary.roiSettledPct).toBe(100);
  });

  it('buildBankCurve deve refletir perda em aposta lost (cash final = base - stake)', () => {
    const base = 100;
    const match = makeMatch(
      'm1',
      {
        betAmount: 10,
        odd: 2,
        potentialReturn: 20,
        potentialProfit: 10,
        bankPercentage: 10,
        status: 'lost',
        placedAt: 1_000_000,
        resultAt: 2_000_000,
      },
      1_000_000
    );

    const { finalCash, finalEquity, summary } = buildBankCurve([match], base);
    expect(finalCash).toBe(90);
    expect(finalEquity).toBe(90);
    expect(summary.realizedProfit).toBe(-10);
    expect(summary.investedSettled).toBe(10);
  });

  it('buildBankCurve deve estornar em aposta cancelled (cash volta ao base)', () => {
    const base = 100;
    const match = makeMatch(
      'm1',
      {
        betAmount: 10,
        odd: 2,
        potentialReturn: 20,
        potentialProfit: 10,
        bankPercentage: 10,
        status: 'cancelled',
        placedAt: 1_000_000,
        resultAt: 2_000_000,
      },
      1_000_000
    );

    const { finalCash, finalEquity, summary } = buildBankCurve([match], base);
    expect(finalCash).toBe(100);
    expect(finalEquity).toBe(100);
    expect(summary.cancelledBets).toBe(1);
  });
});


