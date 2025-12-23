import { describe, it, expect } from 'vitest';
import { validateMatchData, validateBetInfo, validateBankSettings } from '../../utils/validation';

describe('validateMatchData', () => {
  it('deve validar dados corretos', () => {
    const validData = {
      homeTeam: 'Time A',
      awayTeam: 'Time B',
      homeOver15Freq: 70,
      awayOver15Freq: 65,
      homeGoalsScoredAvg: 1.5,
      homeGoalsConcededAvg: 1.0,
      awayGoalsScoredAvg: 1.3,
      awayGoalsConcededAvg: 1.2,
      homeXG: 1.4,
      awayXG: 1.3,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 4,
      homeBTTSFreq: 50,
      awayBTTSFreq: 45,
      homeCleanSheetFreq: 30,
      awayCleanSheetFreq: 35,
      h2hOver15Freq: 80,
      matchImportance: 5,
      keyAbsences: 'none' as const,
      homeHistory: [],
      awayHistory: []
    };

    expect(() => validateMatchData(validData)).not.toThrow();
  });

  it('deve rejeitar times vazios', () => {
    const invalidData = {
      homeTeam: '',
      awayTeam: 'Time B',
      homeOver15Freq: 70,
      awayOver15Freq: 65,
      homeGoalsScoredAvg: 1.5,
      homeGoalsConcededAvg: 1.0,
      awayGoalsScoredAvg: 1.3,
      awayGoalsConcededAvg: 1.2,
      homeXG: 1.4,
      awayXG: 1.3,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 4,
      homeBTTSFreq: 50,
      awayBTTSFreq: 45,
      homeCleanSheetFreq: 30,
      awayCleanSheetFreq: 35,
      h2hOver15Freq: 80,
      matchImportance: 5,
      keyAbsences: 'none' as const,
      homeHistory: [],
      awayHistory: []
    };

    expect(() => validateMatchData(invalidData)).toThrow();
  });

  it('deve rejeitar valores fora do range', () => {
    const invalidData = {
      homeTeam: 'Time A',
      awayTeam: 'Time B',
      homeOver15Freq: 150, // > 100
      awayOver15Freq: 65,
      homeGoalsScoredAvg: 1.5,
      homeGoalsConcededAvg: 1.0,
      awayGoalsScoredAvg: 1.3,
      awayGoalsConcededAvg: 1.2,
      homeXG: 1.4,
      awayXG: 1.3,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 4,
      homeBTTSFreq: 50,
      awayBTTSFreq: 45,
      homeCleanSheetFreq: 30,
      awayCleanSheetFreq: 35,
      h2hOver15Freq: 80,
      matchImportance: 5,
      keyAbsences: 'none' as const,
      homeHistory: [],
      awayHistory: []
    };

    expect(() => validateMatchData(invalidData)).toThrow();
  });
});

describe('validateBetInfo', () => {
  it('deve validar aposta correta', () => {
    const validBet = {
      betAmount: 100,
      odd: 2.5,
      potentialReturn: 250,
      potentialProfit: 150,
      bankPercentage: 10,
      status: 'pending' as const
    };

    expect(() => validateBetInfo(validBet)).not.toThrow();
  });

  it('deve rejeitar valor de aposta zero', () => {
    const invalidBet = {
      betAmount: 0,
      odd: 2.5,
      potentialReturn: 0,
      potentialProfit: 0,
      bankPercentage: 0,
      status: 'pending' as const
    };

    expect(() => validateBetInfo(invalidBet)).toThrow();
  });

  it('deve rejeitar valor de aposta menor que R$ 5,00', () => {
    const invalidBet = {
      betAmount: 4.99,
      odd: 2.5,
      potentialReturn: 12.48,
      potentialProfit: 7.49,
      bankPercentage: 1,
      status: 'pending' as const
    };

    expect(() => validateBetInfo(invalidBet)).toThrow();
  });

  it('deve aceitar valor de aposta igual ou maior que R$ 5,00', () => {
    const validBet = {
      betAmount: 5.00,
      odd: 2.5,
      potentialReturn: 12.50,
      potentialProfit: 7.50,
      bankPercentage: 1,
      status: 'pending' as const
    };

    expect(() => validateBetInfo(validBet)).not.toThrow();
  });

  it('deve rejeitar odd inválida', () => {
    const invalidBet = {
      betAmount: 100,
      odd: 0.5, // < 1.01
      potentialReturn: 50,
      potentialProfit: -50,
      bankPercentage: 10,
      status: 'pending' as const
    };

    expect(() => validateBetInfo(invalidBet)).toThrow();
  });
});

describe('validateBankSettings', () => {
  it('deve validar configurações corretas', () => {
    const validSettings = {
      totalBank: 1000,
      currency: 'BRL',
      updatedAt: Date.now()
    };

    expect(() => validateBankSettings(validSettings)).not.toThrow();
  });

  it('deve rejeitar banca negativa', () => {
    const invalidSettings = {
      totalBank: -100,
      currency: 'BRL',
      updatedAt: Date.now()
    };

    expect(() => validateBankSettings(invalidSettings)).toThrow();
  });

  it('deve rejeitar moeda com formato inválido', () => {
    const invalidSettings = {
      totalBank: 1000,
      currency: 'R$', // Deve ter 3 caracteres
      updatedAt: Date.now()
    };

    expect(() => validateBankSettings(invalidSettings)).toThrow();
  });
});

