import { describe, it, expect } from 'vitest';
import {
  blendAttackRate,
  blendHistoricWithFormSnapshot,
  finishingLambdaFactor,
  normalizeGolsStatsSlice,
  resolveGlobalGolsSlice,
  weightedRecentGoalsPerGame,
  xgFinishDelta,
} from '../../services/matchDataSignals';
import type { RecentMatch } from '../../types';

describe('matchDataSignals', () => {
  it('normalizeGolsStatsSlice preenche under25 a partir de over25', () => {
    const s = normalizeGolsStatsSlice({ over25Pct: 60, avgScored: 1, avgConceded: 1 });
    expect(s.under25Pct).toBe(40);
  });

  it('resolveGlobalGolsSlice usa média casa/fora quando global vazio', () => {
    const home = normalizeGolsStatsSlice({ avgScored: 2, avgConceded: 1, avgTotal: 3, over25Pct: 50 });
    const away = normalizeGolsStatsSlice({ avgScored: 1, avgConceded: 2, avgTotal: 3, over25Pct: 50 });
    const g = resolveGlobalGolsSlice(home, away, undefined);
    expect(g.avgScored).toBe(1.5);
    expect(g.avgConceded).toBe(1.5);
  });

  it('blendAttackRate combina gols e xG', () => {
    expect(blendAttackRate(2, 1, 0.5, 0.5)).toBe(1.5);
    expect(blendAttackRate(0, 1.2)).toBe(1.2);
    expect(blendAttackRate(1.5, 0)).toBe(1.5);
  });

  it('blendHistoricWithFormSnapshot mistura histórico e snapshot', () => {
    expect(blendHistoricWithFormSnapshot(2, 1)).toBeCloseTo(1.7, 5);
  });

  it('weightedRecentGoalsPerGame dá mais peso aos jogos recentes', () => {
    const hist: RecentMatch[] = [
      { date: '2026-01-04', homeScore: 4, awayScore: 0 },
      { date: '2026-01-01', homeScore: 0, awayScore: 0 },
    ];
    const w = weightedRecentGoalsPerGame(hist, 5);
    expect(w).toBeGreaterThan(2);
    expect(w).toBeLessThan(4);
  });

  it('xgFinishDelta e finishingLambdaFactor', () => {
    expect(xgFinishDelta(1, 1.5)).toBeCloseTo(0.5, 5);
    const f = finishingLambdaFactor(xgFinishDelta(1, 1.5));
    expect(f).toBeGreaterThan(1);
    expect(f).toBeLessThan(1.2);
  });
});
