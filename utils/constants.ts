export const APP_VERSION = '3.9.0';
export const APP_EDITION = 'ELITE';

// Analysis Engine
export const DIXON_COLES_RHO = -0.13;
export const HOME_FIELD_ADVANTAGE = 1.08;
export const DEFAULT_TOTAL_TEAMS = 20;

// Confidence Score Thresholds
export const CONFIDENCE_THRESHOLDS = {
  ALTA_CONFIANCA: 80,
  CENARIO_FAVORAVEL: 70,
  ENTRADA_RECOMENDADA: 82,
  RISK_HIGH: 88,
  RISK_MEDIUM: 78,
  RISK_LOW: 68,
} as const;

// Weights for stat blending
export const STAT_WEIGHTS = {
  HOME: 0.5,
  AWAY: 0.3,
  GLOBAL: 0.2,
} as const;

// Gemini API defaults
export const GEMINI_DEFAULTS = {
  TEMPERATURE: 0.25,
  TOP_P: 0.9,
  MAX_OUTPUT_TOKENS: 3000,
} as const;
