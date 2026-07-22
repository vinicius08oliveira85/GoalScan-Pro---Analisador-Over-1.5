import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSavedMatches } from '../../hooks/useSavedMatches';
import type { SavedAnalysis } from '../../types';
import * as supabaseService from '../../services/supabaseService';

vi.mock('../../services/supabaseService', () => ({
  loadSavedAnalyses: vi.fn(),
  saveOrUpdateAnalysis: vi.fn(),
  deleteAnalysis: vi.fn(),
}));

vi.mock('../../services/widgetSyncService', () => ({
  syncMatchesToWidgets: vi.fn(),
}));

describe('useSavedMatches', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('preserva os jogos locais quando o Supabase retorna vazio', async () => {
    const localMatch: SavedAnalysis = {
      id: 'match-1',
      timestamp: 1,
      data: {
        homeTeam: 'Time A',
        awayTeam: 'Time B',
        homeGoalsScoredAvg: 1.2,
        homeGoalsConcededAvg: 1.1,
        awayGoalsScoredAvg: 1.3,
        awayGoalsConcededAvg: 1.4,
        homeXG: 1.5,
        awayXG: 1.4,
        homeShotsOnTarget: 5,
        awayShotsOnTarget: 4,
        homeBTTSFreq: 0.4,
        awayBTTSFreq: 0.3,
        homeCleanSheetFreq: 0.2,
        awayCleanSheetFreq: 0.1,
        h2hOver15Freq: 0.5,
        matchImportance: 5,
        keyAbsences: 'none',
        homeHistory: [],
        awayHistory: [],
      },
      result: {
        probabilityOver15: 0.7,
        combinedProbability: 0.7,
        confidenceScore: 0.8,
        poissonHome: [0, 1, 2],
        poissonAway: [0, 1, 2],
        riskLevel: 'Baixo',
        verdict: 'ok',
        recommendation: 'ok',
        ev: 0.2,
        advancedMetrics: {
          offensiveVolume: 1,
          defensiveLeaking: 1,
          bttsCorrelation: 1,
          formTrend: 1,
        },
      },
    };

    localStorage.setItem('goalscan_saved', JSON.stringify([localMatch]));
    vi.mocked(supabaseService.loadSavedAnalyses).mockResolvedValue([]);

    const { result } = renderHook(() => useSavedMatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.savedMatches).toEqual([localMatch]);
  });
});
