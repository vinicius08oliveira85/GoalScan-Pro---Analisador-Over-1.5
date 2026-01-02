import { describe, it, expect } from 'vitest';
import { performAnalysis } from '../../services/analysisEngine';
import { MatchData } from '../../types';

describe('performAnalysis', () => {
  const mockMatchData: MatchData = {
    homeTeam: 'Time A',
    awayTeam: 'Time B',
    competition: 'Brasileirão',
    competitionAvg: 50,
    homeOver15Freq: 60,
    awayOver15Freq: 40,
    h2hOver15Freq: 45,
    homeXG: 1.5,
    awayXG: 1.2,
    oddOver15: 1.8,
    homeTeamStats: {
      gols: {
        home: {
          avgTotal: 2.5,
          cleanSheetPct: 30,
          noGoalsPct: 15,
          over25Pct: 55,
          avgScored: 1.8,
          avgConceded: 0.7
        },
        away: {
          avgTotal: 2.2,
          cleanSheetPct: 25,
          noGoalsPct: 20,
          over25Pct: 50,
          avgScored: 1.5,
          avgConceded: 0.7
        }
      }
    },
    awayTeamStats: {
      gols: {
        home: {
          avgTotal: 2.0,
          cleanSheetPct: 35,
          noGoalsPct: 25,
          over25Pct: 45,
          avgScored: 1.3,
          avgConceded: 0.7
        },
        away: {
          avgTotal: 2.3,
          cleanSheetPct: 28,
          noGoalsPct: 18,
          over25Pct: 52,
          avgScored: 1.6,
          avgConceded: 0.7
        }
      }
    }
  };

  it('deve retornar um resultado de análise válido', () => {
    const result = performAnalysis(mockMatchData);

    expect(result).toHaveProperty('probabilityOver15');
    expect(result).toHaveProperty('combinedProbability');
    expect(result).toHaveProperty('confidenceScore');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('ev');
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('recommendation');

    expect(typeof result.probabilityOver15).toBe('number');
    expect(result.probabilityOver15).toBeGreaterThanOrEqual(10);
    expect(result.probabilityOver15).toBeLessThanOrEqual(98);
  });

  it('deve calcular EV corretamente quando odd é fornecida', () => {
    const result = performAnalysis(mockMatchData);

    expect(result.ev).toBeDefined();
    expect(typeof result.ev).toBe('number');
  });

  it('deve incluir métricas avançadas', () => {
    const result = performAnalysis(mockMatchData);

    expect(result.advancedMetrics).toHaveProperty('offensiveVolume');
    expect(result.advancedMetrics).toHaveProperty('defensiveLeaking');
    expect(result.advancedMetrics).toHaveProperty('bttsCorrelation');
    expect(result.advancedMetrics).toHaveProperty('formTrend');
  });

  it('deve lidar com dados mínimos', () => {
    const minimalData: MatchData = {
      homeTeam: 'Time A',
      awayTeam: 'Time B',
      competition: 'Test',
      competitionAvg: 40,
      homeOver15Freq: 50,
      awayOver15Freq: 50
    };

    const result = performAnalysis(minimalData);

    expect(result.probabilityOver15).toBeGreaterThanOrEqual(10);
    expect(result.probabilityOver15).toBeLessThanOrEqual(98);
  });

  it('deve lançar erro para dados inválidos', () => {
    expect(() => performAnalysis(null as never)).toThrow();
    expect(() => performAnalysis({} as MatchData)).toThrow();
  });
});