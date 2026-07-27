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

// UI / UX Constants
export const UI_CONSTANTS = {
  /** Toninho's delay for entrance animations (ms) */
  ENTRANCE_DELAY: 100,
  /** Auto-close timeout for in-app notifications (ms) */
  NOTIFICATION_AUTO_CLOSE: 10000,
  /** Exit animation delay for notifications (ms) */
  NOTIFICATION_EXIT_DELAY: 300,
  /** Default toast duration (ms) */
  TOAST_DURATION: 5000,
  /** Status feedback reset delay (ms) */
  STATUS_RESET_DELAY: 3000,
  /** Quick bank preset values */
  QUICK_BANK_VALUES: [100, 500, 1000, 5000] as const,
  /** Bank max validation */
  BANK_MAX_VALUE: 100_000_000,
} as const;

export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
} as const;

export const TIMEOUTS = {
  /** Supabase query timeout (ms) */
  SUPABASE: 5000,
  /** Abort controller timeout for external fetches (ms) */
  FETCH_ABORT: 5000,
  /** Copy/paste feedback delay (ms) */
  COPY_FEEDBACK: 2000,
  /** Debounce delay for auto-extraction (ms) */
  AUTO_EXTRACT_DEBOUNCE: 300,
  /** Bank reconcile status reset (ms) */
  RECONCILE_STATUS_RESET: 2000,
  /** Bank reconcile secondary reset (ms) */
  RECONCILE_STATUS_RESET_LONG: 2500,
  /** Analysis close animation delay (ms) */
  ANALYSIS_CLOSE_DELAY: 300,
  /** Match form sync delay (ms) */
  MATCH_FORM_SYNC: 500,
  /** Notification polling interval (ms) */
  NOTIFICATION_POLL: 60000,
  /** Leverage input max value */
  LEVERAGE_MAX_VALUE: 1_000_000,
} as const;
