import { describe, it, expect } from 'vitest';
import {
  computeBetPayouts,
  getBetDisplayFinancials,
  syncPendingBetInfoWithMatchOdd,
} from '../../utils/betFinancials';
import type { AnalysisResult, BetInfo, MatchData, SavedAnalysis } from '../../types';

const baseResult = { ev: 0 } as AnalysisResult;

describe('computeBetPayouts', () => {
  it('retorno = stake × odd; lucro = stake × (odd − 1)', () => {
    const r = computeBetPayouts(100, 2.0);
    expect(r.potentialReturn).toBe(200);
    expect(r.potentialProfit).toBe(100);
  });

  it('exemplo mercado: stake 5, odd 1,24 → lucro 1,20', () => {
    const r = computeBetPayouts(5, 1.24);
    expect(r.potentialReturn).toBe(6.2);
    expect(r.potentialProfit).toBe(1.2);
  });
});

describe('getBetDisplayFinancials', () => {
  const data = (odd: number): MatchData =>
    ({ oddOver15: odd } as MatchData);

  it('pendente não usa alavancagem: só stake × odd da partida', () => {
    const betInfo: BetInfo = {
      betAmount: 5,
      odd: 1.24,
      potentialReturn: 999,
      potentialProfit: 999,
      bankPercentage: 10,
      status: 'pending',
    };
    const m: SavedAnalysis = {
      id: '1',
      timestamp: 1,
      data: data(1.24),
      result: baseResult,
      betInfo,
    };
    const r = getBetDisplayFinancials(m);
    expect(r.potentialReturn).toBe(6.2);
    expect(r.potentialProfit).toBe(1.2);
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

  it('ganhou: ignora lucro/retorno legados e recalcula com odd da aposta (sem alavancagem)', () => {
    const betInfo: BetInfo = {
      betAmount: 5,
      odd: 1.24,
      potentialReturn: 8.06,
      potentialProfit: 3.06,
      bankPercentage: 10,
      status: 'won',
    };
    const m: SavedAnalysis = {
      id: '1',
      timestamp: 1,
      data: data(2.0),
      result: baseResult,
      betInfo,
    };
    const r = getBetDisplayFinancials(m);
    expect(r.potentialReturn).toBe(6.2);
    expect(r.potentialProfit).toBe(1.2);
  });

  it('ganhou sem odd gravada mantém valores persistidos', () => {
    const betInfo: BetInfo = {
      betAmount: 100,
      odd: 0,
      potentialReturn: 150,
      potentialProfit: 50,
      bankPercentage: 10,
      status: 'won',
    };
    const m: SavedAnalysis = {
      id: '1',
      timestamp: 1,
      data: data(2.0),
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
    const synced = syncPendingBetInfoWithMatchOdd(betInfo, 2.0);
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
    const synced = syncPendingBetInfoWithMatchOdd(betInfo, 2.0);
    expect(synced).toEqual(betInfo);
  });
});
