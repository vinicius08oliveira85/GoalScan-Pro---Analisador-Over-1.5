import { describe, it, expect } from 'vitest';
import {
  computeBetPayouts,
  getBetDisplayFinancials,
  syncPendingBetInfoWithMatchOdd,
} from '../../utils/betFinancials';
import type { AnalysisResult, BetInfo, MatchData, SavedAnalysis } from '../../types';

const baseResult = { ev: 0 } as AnalysisResult;

describe('computeBetPayouts', () => {
  it('calcula retorno e lucro com alavancagem 1', () => {
    const r = computeBetPayouts(100, 2.0, 1);
    expect(r.potentialReturn).toBe(200);
    expect(r.potentialProfit).toBe(100);
  });

  it('aplica alavancagem', () => {
    const r = computeBetPayouts(50, 1.8, 2);
    expect(r.potentialReturn).toBe(180);
    expect(r.potentialProfit).toBe(130);
  });
});

describe('getBetDisplayFinancials', () => {
  const data = (odd: number): MatchData =>
    ({ oddOver15: odd } as MatchData);

  it('pendente usa alavancagem global quando a aposta não define leverage', () => {
    const betInfo: BetInfo = {
      betAmount: 100,
      odd: 2,
      potentialReturn: 200,
      potentialProfit: 100,
      bankPercentage: 10,
      status: 'pending',
    };
    const m: SavedAnalysis = {
      id: '1',
      timestamp: 1,
      data: data(2.0),
      result: baseResult,
      betInfo,
    };
    const r = getBetDisplayFinancials(m, 2);
    expect(r.potentialReturn).toBe(400);
    expect(r.potentialProfit).toBe(300);
  });

  it('pendente usa odd da partida quando > 1', () => {
    const betInfo: BetInfo = {
      betAmount: 100,
      odd: 1.5,
      potentialReturn: 150,
      potentialProfit: 50,
      bankPercentage: 10,
      status: 'pending',
    };
    const m: SavedAnalysis = {
      id: '1',
      timestamp: 1,
      data: data(2.0),
      result: baseResult,
      betInfo,
    };
    const r = getBetDisplayFinancials(m);
    expect(r.potentialReturn).toBe(200);
    expect(r.potentialProfit).toBe(100);
  });

  it('ganhou usa valores gravados na aposta', () => {
    const betInfo: BetInfo = {
      betAmount: 100,
      odd: 1.5,
      potentialReturn: 150,
      potentialProfit: 50,
      bankPercentage: 10,
      status: 'won',
    };
    const m: SavedAnalysis = {
      id: '1',
      timestamp: 1,
      data: data(3.0),
      result: baseResult,
      betInfo,
    };
    const r = getBetDisplayFinancials(m);
    expect(r.potentialReturn).toBe(150);
    expect(r.potentialProfit).toBe(50);
  });
});

describe('syncPendingBetInfoWithMatchOdd', () => {
  it('atualiza odd e payouts para pendente', () => {
    const betInfo: BetInfo = {
      betAmount: 40,
      odd: 1.4,
      potentialReturn: 56,
      potentialProfit: 16,
      bankPercentage: 5,
      status: 'pending',
    };
    const synced = syncPendingBetInfoWithMatchOdd(betInfo, 2.0, 1);
    expect(synced.odd).toBe(2);
    expect(synced.potentialReturn).toBe(80);
    expect(synced.potentialProfit).toBe(40);
  });

  it('não altera aposta ganha', () => {
    const betInfo: BetInfo = {
      betAmount: 40,
      odd: 1.4,
      potentialReturn: 56,
      potentialProfit: 16,
      bankPercentage: 5,
      status: 'won',
    };
    const synced = syncPendingBetInfoWithMatchOdd(betInfo, 2.0, 1);
    expect(synced).toEqual(betInfo);
  });
});
