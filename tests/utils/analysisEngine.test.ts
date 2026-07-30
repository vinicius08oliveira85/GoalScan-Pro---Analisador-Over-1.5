import { describe, it, expect } from 'vitest';
import { performAnalysis } from '../../services/analysisEngine';
import { calculateTableCompletenessScore, poissonProbability, poissonCumulative, calculateDixonColesUnder15, calculateOverUnderProbabilities, smoothAdjustment, smoothClamp, validateStatsConsistency } from '../../services/analysisEngineUtils';
import { MatchData } from '../../types';

function createMockMatchData(overrides?: Partial<MatchData>): MatchData {
  return {
    homeTeam: 'Time A',
    awayTeam: 'Time B',
    competitionAvg: 2.6,
    homeGoalsScoredAvg: 1.5,
    homeGoalsConcededAvg: 1,
    awayGoalsScoredAvg: 1.4,
    awayGoalsConcededAvg: 1.1,
    homeOver15Freq: 60,
    awayOver15Freq: 40,
    h2hOver15Freq: 45,
    homeXG: 1.5,
    awayXG: 1.2,
    homeShotsOnTarget: 5,
    awayShotsOnTarget: 4,
    homeBTTSFreq: 50,
    awayBTTSFreq: 50,
    homeCleanSheetFreq: 20,
    awayCleanSheetFreq: 20,
    oddOver15: 1.8,
    matchImportance: 0,
    keyAbsences: 'none',
    homeHistory: [],
    awayHistory: [],
    homeTeamStats: {
      percurso: { home: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, away: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, global: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 } },
      gols: {
        home: { avgTotal: 2.5, cleanSheetPct: 30, noGoalsPct: 15, over25Pct: 55, under25Pct: 45, avgScored: 1.8, avgConceded: 0.7 },
        away: { avgTotal: 2.2, cleanSheetPct: 25, noGoalsPct: 20, over25Pct: 50, under25Pct: 50, avgScored: 1.5, avgConceded: 0.7 },
        global: { avgTotal: 0, cleanSheetPct: 0, noGoalsPct: 0, over25Pct: 0, under25Pct: 0, avgScored: 0, avgConceded: 0 },
      },
    },
    awayTeamStats: {
      percurso: { home: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, away: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, global: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 } },
      gols: {
        home: { avgTotal: 2.0, cleanSheetPct: 35, noGoalsPct: 25, over25Pct: 45, under25Pct: 55, avgScored: 1.3, avgConceded: 0.7 },
        away: { avgTotal: 2.3, cleanSheetPct: 28, noGoalsPct: 18, over25Pct: 52, under25Pct: 48, avgScored: 1.6, avgConceded: 0.7 },
        global: { avgTotal: 0, cleanSheetPct: 0, noGoalsPct: 0, over25Pct: 0, under25Pct: 0, avgScored: 0, avgConceded: 0 },
      },
    },
    ...overrides,
  };
}

describe('performAnalysis', () => {
  it('deve retornar um resultado de análise válido', () => {
    const result = performAnalysis(createMockMatchData());

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
    expect(result.combinedProbability).toBeGreaterThanOrEqual(10);
    expect(result.combinedProbability).toBeLessThanOrEqual(98);
  });

  it('deve calcular EV corretamente quando odd é fornecida', () => {
    const result = performAnalysis(createMockMatchData());
    expect(result.ev).toBeDefined();
    expect(typeof result.ev).toBe('number');
  });

  it('deve incluir métricas avançadas', () => {
    const result = performAnalysis(createMockMatchData());

    expect(result.advancedMetrics).toHaveProperty('offensiveVolume');
    expect(result.advancedMetrics).toHaveProperty('defensiveLeaking');
    expect(result.advancedMetrics).toHaveProperty('bttsCorrelation');
    expect(result.advancedMetrics).toHaveProperty('formTrend');
  });

  it('deve incluir probabilidades Over/Under', () => {
    const result = performAnalysis(createMockMatchData());
    expect(result.overUnderProbabilities).toBeDefined();
    if (result.overUnderProbabilities) {
      expect(result.overUnderProbabilities['1.5']).toBeDefined();
      expect(result.overUnderProbabilities['2.5']).toBeDefined();
    }
  });

  it('deve retornar distribuição Poisson', () => {
    const result = performAnalysis(createMockMatchData());
    expect(result.poissonHome).toHaveLength(6);
    expect(result.poissonAway).toHaveLength(6);
  });

  it('deve determinar riskLevel corretamente', () => {
    const result = performAnalysis(createMockMatchData());
    expect(['Baixo', 'Moderado', 'Alto', 'Muito Alto']).toContain(result.riskLevel);
  });

  it('deve lidar com dados mínimos (sem teamStats)', () => {
    const minimalData: MatchData = {
      homeTeam: 'Time A',
      awayTeam: 'Time B',
      competitionAvg: 2.5,
      homeGoalsScoredAvg: 1,
      homeGoalsConcededAvg: 1,
      awayGoalsScoredAvg: 1,
      awayGoalsConcededAvg: 1,
      homeBTTSFreq: 50,
      awayBTTSFreq: 50,
      homeCleanSheetFreq: 0,
      awayCleanSheetFreq: 0,
      h2hOver15Freq: 50,
      homeXG: 0,
      awayXG: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      matchImportance: 0,
      keyAbsences: 'none',
      homeHistory: [],
      awayHistory: [],
    };

    const result = performAnalysis(minimalData);
    expect(result.probabilityOver15).toBeGreaterThanOrEqual(10);
    expect(result.probabilityOver15).toBeLessThanOrEqual(98);
    expect(result.combinedProbability).toBeGreaterThanOrEqual(10);
    expect(result.combinedProbability).toBeLessThanOrEqual(98);
  });

  it('deve lançar erro para dados inválidos', () => {
    expect(() => performAnalysis(null as never)).toThrow();
    expect(() => performAnalysis({} as MatchData)).toThrow();
  });

  it('deve funcionar com oddOver15 zerada', () => {
    const data = createMockMatchData({ oddOver15: 0 });
    const result = performAnalysis(data);
    expect(result.ev).toBe(0);
  });

  it('deve retornar probabilitiesOver15 e combinedProbability diferentes', () => {
    const result = performAnalysis(createMockMatchData());
    expect(result.probabilityOver15).not.toBe(result.combinedProbability);
  });

  it('deve retornar confidenceScore entre 0 e 100', () => {
    const result = performAnalysis(createMockMatchData());
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
  });
});

describe('calculateTableCompletenessScore', () => {
  it('deve retornar score 0 quando não há tabelas', () => {
    const data = createMockMatchData({ homeTableData: undefined, awayTableData: undefined });
    const result = calculateTableCompletenessScore(data);
    expect(result.score).toBe(0);
    expect(result.availableTables).toHaveLength(0);
    expect(result.missingTables).toHaveLength(2);
  });

  it('deve retornar score 0.5 quando apenas tabela geral está disponível', () => {
    const data = createMockMatchData({
      homeTableData: { MP: '10', GF: '15', GA: '10' },
      awayTableData: { MP: '10', GF: '12', GA: '8' },
    });
    const result = calculateTableCompletenessScore(data);
    expect(result.score).toBe(0.5);
    expect(result.availableTables).toContain('geral');
  });

  it('deve retornar score 1.0 quando todas as tabelas estão disponíveis', () => {
    const data = createMockMatchData({
      homeTableData: { MP: '10', GF: '15', GA: '10' },
      awayTableData: { MP: '10', GF: '12', GA: '8' },
      homeComplementData: { Squad: 'Time A' },
      awayComplementData: { Squad: 'Time B' },
      competitionComplementAvg: { pl: 0, poss: 50, age: 25, playingTimeMp: 0, playingTime90s: 10, performanceGls: 0, performanceAst: 0, performanceGA: 0, performanceGPK: 0, per90Gls: 1, per90Ast: 0, per90GA: 0, per90GPK: 0, per90GAPK: 0 },
    });
    const result = calculateTableCompletenessScore(data);
    expect(result.score).toBe(1.0);
    expect(result.availableTables).toHaveLength(2);
  });

  it('não deve duplicar tabelas', () => {
    const data = createMockMatchData({
      homeTableData: { MP: '10', GF: '15', GA: '10' },
      awayTableData: { MP: '10', GF: '12', GA: '8' },
      homeComplementData: { Squad: 'Time A' },
      awayComplementData: { Squad: 'Time B' },
      competitionComplementAvg: { pl: 0, poss: 50, age: 25, playingTimeMp: 0, playingTime90s: 10, performanceGls: 0, performanceAst: 0, performanceGA: 0, performanceGPK: 0, per90Gls: 1, per90Ast: 0, per90GA: 0, per90GPK: 0, per90GAPK: 0 },
    });
    const result = calculateTableCompletenessScore(data);
    expect(result.availableTables).toHaveLength(2);
    const uniqueTables = new Set(result.availableTables);
    expect(uniqueTables.size).toBe(result.availableTables.length);
  });
});

describe('Poisson utilities', () => {
  it('poissonProbability deve calcular valores válidos', () => {
    expect(poissonProbability(0, 1.5)).toBeGreaterThan(0);
    expect(poissonProbability(1, 1.5)).toBeGreaterThan(0);
    expect(poissonProbability(5, 1.5)).toBeGreaterThan(0);
    // Soma das probabilidades até 10 gols deve ser ~1
    let sum = 0;
    for (let i = 0; i <= 10; i++) sum += poissonProbability(i, 2.5);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('poissonCumulative deve ser monotônica', () => {
    const lambda = 2.0;
    let prev = 0;
    for (let k = 0; k <= 5; k++) {
      const cum = poissonCumulative(k, lambda);
      expect(cum).toBeGreaterThanOrEqual(prev);
      prev = cum;
    }
  });

  it('calculateDixonColesUnder15 deve retornar entre 0 e 1', () => {
    const p = calculateDixonColesUnder15(1.5, 1.2);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('calculateOverUnderProbabilities deve cobrir todas as linhas', () => {
    const probs = calculateOverUnderProbabilities(2.5);
    const lines = ['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'];
    for (const line of lines) {
      expect(probs[line]).toBeDefined();
      expect(probs[line].over).toBeGreaterThanOrEqual(0);
      expect(probs[line].over).toBeLessThanOrEqual(100);
      expect(probs[line].under).toBeGreaterThanOrEqual(0);
      expect(probs[line].under).toBeLessThanOrEqual(100);
    }
  });
});

describe('smoothAdjustment', () => {
  it('deve retornar valor entre -strength e strength', () => {
    const r = smoothAdjustment(2.5, 2.0, 8);
    expect(r).toBeGreaterThanOrEqual(-8);
    expect(r).toBeLessThanOrEqual(8);
  });

  it('deve ser positivo quando value > threshold', () => {
    expect(smoothAdjustment(3.0, 2.0, 8)).toBeGreaterThan(0);
  });

  it('deve ser negativo quando value < threshold e strength negativo', () => {
    expect(smoothAdjustment(10, 40, -6)).toBeLessThan(0);
  });
});

describe('smoothClamp', () => {
  it('deve respeitar limites', () => {
    expect(smoothClamp(5, 10, 90)).toBe(10);
    expect(smoothClamp(95, 10, 90)).toBe(90);
    expect(smoothClamp(50, 10, 90)).toBe(50);
  });
});

describe('validateStatsConsistency', () => {
  it('deve retornar consistência alta para dados similares', () => {
    const r = validateStatsConsistency(
      { avgScored: 1.5, avgConceded: 1.0 },
      { avgScored: 1.4, avgConceded: 0.9 },
      { avgScored: 1.45, avgConceded: 0.95 }
    );
    expect(r.consistencyScore).toBeGreaterThan(0.5);
    expect(r.hasSignificantDivergence).toBe(false);
  });

  it('deve detectar divergência significativa', () => {
    const r = validateStatsConsistency(
      { avgScored: 1.5, avgConceded: 1.0 },
      { avgScored: 2.5, avgConceded: 2.0 },
      { avgScored: 2.0, avgConceded: 1.5 }
    );
    expect(r.hasSignificantDivergence).toBe(true);
  });
});
