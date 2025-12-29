import { z } from 'zod';

// Schema para validação de MatchData
export const matchDataSchema = z.object({
  homeTeam: z.string().min(1, 'Nome do time da casa é obrigatório').max(100),
  awayTeam: z.string().min(1, 'Nome do time visitante é obrigatório').max(100),
  matchDate: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional()
  ),
  matchTime: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.union([
      z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)'),
      z.literal(''),
      z.undefined()
    ]).optional()
  ),
  competitionAvg: z.number().min(0).max(100).optional(),
  oddOver15: z.number().min(1.01, 'Odd deve ser maior que 1.00').max(50).optional(),
  
  // Médias de gols
  homeGoalsScoredAvg: z.number().min(0).max(10).default(0),
  homeGoalsConcededAvg: z.number().min(0).max(10).default(0),
  awayGoalsScoredAvg: z.number().min(0).max(10).default(0),
  awayGoalsConcededAvg: z.number().min(0).max(10).default(0),
  
  // Frequências (percentuais)
  homeOver15Freq: z.number().min(0).max(100).default(0),
  awayOver15Freq: z.number().min(0).max(100).default(0),
  homeBTTSFreq: z.number().min(0).max(100).default(0),
  awayBTTSFreq: z.number().min(0).max(100).default(0),
  homeCleanSheetFreq: z.number().min(0).max(100).default(0),
  awayCleanSheetFreq: z.number().min(0).max(100).default(0),
  h2hOver15Freq: z.number().min(0).max(100).default(0),
  
  // Métricas avançadas
  homeXG: z.number().min(0).max(10).default(0),
  awayXG: z.number().min(0).max(10).default(0),
  homeShotsOnTarget: z.number().min(0).max(50).default(0),
  awayShotsOnTarget: z.number().min(0).max(50).default(0),
  
  // Importância e ausências
  matchImportance: z.number().min(0).max(10).default(0),
  keyAbsences: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  
  // Histórico
  homeHistory: z.array(z.object({
    date: z.string(),
    homeScore: z.number().min(0).max(20),
    awayScore: z.number().min(0).max(20)
  })).default([]),
  awayHistory: z.array(z.object({
    date: z.string(),
    homeScore: z.number().min(0).max(20),
    awayScore: z.number().min(0).max(20)
  })).default([]),
  
  // Campos opcionais
  homeGoalsScoredAtHome: z.number().min(0).max(10).optional(),
  homeGoalsConcededAtHome: z.number().min(0).max(10).optional(),
  awayGoalsScoredAway: z.number().min(0).max(10).optional(),
  awayGoalsConcededAway: z.number().min(0).max(10).optional(),
  homeXA: z.number().min(0).max(10).optional(),
  awayXA: z.number().min(0).max(10).optional(),
  homeProgressivePasses: z.number().min(0).optional(),
  awayProgressivePasses: z.number().min(0).optional(),
  homeKeyPasses: z.number().min(0).optional(),
  awayKeyPasses: z.number().min(0).optional(),
  h2hAvgGoals: z.number().min(0).max(10).optional(),
  h2hMatches: z.array(z.object({
    date: z.string(),
    homeScore: z.number().min(0).max(20),
    awayScore: z.number().min(0).max(20),
    totalGoals: z.number().min(0).max(40)
  })).optional(),
  homeTeamStats: z.any().optional(),
  awayTeamStats: z.any().optional()
});

// Schema para validação de BetInfo
export const betInfoSchema = z.object({
  betAmount: z.number().min(5, 'Valor mínimo da aposta é R$ 5,00').max(1000000),
  odd: z.number().min(1.01, 'Odd deve ser maior que 1.00').max(1000),
  potentialReturn: z.number().min(0),
  potentialProfit: z.number(),
  bankPercentage: z
    .number()
    .min(0, '% da banca não pode ser negativo')
    .max(100, '% da banca deve ser no máximo 100%'),
  status: z.enum(['pending', 'won', 'lost', 'cancelled']),
  placedAt: z.number().optional(),
  resultAt: z.number().optional()
});

// Schema para validação de BankSettings
export const bankSettingsSchema = z.object({
  totalBank: z.number().min(0, 'Banca não pode ser negativa').max(100000000),
  currency: z.string().length(3, 'Moeda deve ter 3 caracteres (ex: BRL, USD)'),
  updatedAt: z.number()
});

// Schema para validação parcial (apenas campos críticos)
const matchDataPartialSchema = z.object({
  homeTeam: z.string().min(1, 'Nome do time da casa é obrigatório').max(100),
  awayTeam: z.string().min(1, 'Nome do time visitante é obrigatório').max(100),
}).passthrough(); // Permite campos adicionais sem validar

// Função helper para validar e sanitizar dados
export function validateMatchData(data: unknown) {
  try {
    return matchDataSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

// Função para validação parcial (apenas campos críticos)
// Útil quando salvando automaticamente após gerar análise da IA
export function validateMatchDataPartial(data: unknown) {
  try {
    return matchDataPartialSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateBetInfo(data: unknown) {
  try {
    return betInfoSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateBankSettings(data: unknown) {
  try {
    return bankSettingsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

