/**
 * Sinais derivados de `MatchData` para o motor de análise (λ, confiança, métricas).
 *
 * Mapa resumido MatchData → efeito:
 * - `homeTeamStats` / `awayTeamStats` → `gols.home|away|global`: base do λ (via getWeightedTeamStats);
 *   `firstGoal` (quando presente): micro-ajuste ofensivo.
 * - `homeXG` / `awayXG` + médias de gols: força de ataque = média ponderada gols reais + xG (`blendAttackRate`).
 * - `homeShotsOnTarget`, `homeXA`, passes progressivos/chave: proxies de volume ofensivo (ajuste limitado ao λ).
 * - `homeHistory` / `awayHistory` (datas opcionais): peso maior nos últimos 5 jogos (`weightedRecentGoalsPerGame`).
 * - `h2hMatches` / `h2hAvgGoals`: ajuste H2H (em `performAnalysis`, ramo probabilidade legada).
 * - `homeTableData` / `awayTableData`: ramo “tabela temporada” — combinado com peso separado no `analysisEngine`.
 * - `matchImportance`, `keyAbsences`: multiplicadores de intensidade / penalidade no λ.
 * - `competitionAvg`: shrink do λ total na etapa final de combinação.
 *
 * Ver também: `services/analysisEngine.ts` (Poisson, Dixon–Coles, combinação stats/tabela).
 */

import type { RecentMatch } from '../types';

/** Peso dos gols reais vs xG na “força de ataque” (regra de negócio). */
export const BLEND_WEIGHT_GOALS = 0.55;
export const BLEND_WEIGHT_XG = 0.45;

/** Peso do histórico ponderado (últimos 10) vs snapshot do formulário (xG/chutes) quando ambos existem. */
export const WEIGHT_HISTORIC_RATE = 0.7;
export const WEIGHT_FORM_SNAPSHOT = 0.3;

export type GolsStatsSlice = {
  avgScored: number;
  avgConceded: number;
  avgTotal: number;
  cleanSheetPct: number;
  noGoalsPct: number;
  over25Pct: number;
  under25Pct: number;
};

export const EMPTY_GOLS_STATS: GolsStatsSlice = {
  avgScored: 0,
  avgConceded: 0,
  avgTotal: 0,
  cleanSheetPct: 0,
  noGoalsPct: 0,
  over25Pct: 0,
  under25Pct: 0,
};

/**
 * Preenche campos ausentes e garante números finitos (evita undefined em médias).
 */
export function normalizeGolsStatsSlice(s?: Partial<GolsStatsSlice> | null): GolsStatsSlice {
  if (!s) return { ...EMPTY_GOLS_STATS };
  const over25 = Math.max(0, Math.min(100, Number(s.over25Pct) || 0));
  let under25 =
    s.under25Pct != null && Number.isFinite(Number(s.under25Pct))
      ? Math.max(0, Math.min(100, Number(s.under25Pct)))
      : Math.max(0, 100 - over25);
  const avgScored = Math.max(0, Number(s.avgScored) || 0);
  const avgConceded = Math.max(0, Number(s.avgConceded) || 0);
  let avgTotal = Math.max(0, Number(s.avgTotal) || 0);
  if (avgTotal <= 0 && (avgScored > 0 || avgConceded > 0)) {
    avgTotal = avgScored + avgConceded;
  }
  return {
    avgScored,
    avgConceded,
    avgTotal,
    cleanSheetPct: Math.max(0, Math.min(100, Number(s.cleanSheetPct) || 0)),
    noGoalsPct: Math.max(0, Math.min(100, Number(s.noGoalsPct) || 0)),
    over25Pct: over25,
    under25Pct: under25,
  };
}

/** Média campo a campo entre perfis casa e fora (fallback quando `global` não veio na API). */
export function averageGolsStatsSlice(a: GolsStatsSlice, b: GolsStatsSlice): GolsStatsSlice {
  const mid = (x: number, y: number) => (x + y) / 2;
  return {
    avgScored: mid(a.avgScored, b.avgScored),
    avgConceded: mid(a.avgConceded, b.avgConceded),
    avgTotal: mid(a.avgTotal, b.avgTotal),
    cleanSheetPct: mid(a.cleanSheetPct, b.cleanSheetPct),
    noGoalsPct: mid(a.noGoalsPct, b.noGoalsPct),
    over25Pct: mid(a.over25Pct, b.over25Pct),
    under25Pct: mid(a.under25Pct, b.under25Pct),
  };
}

/**
 * Se `global` não tem sinal, usa média casa/fora do mesmo time.
 */
export function resolveGlobalGolsSlice(
  home: GolsStatsSlice,
  away: GolsStatsSlice,
  globalRaw?: Partial<GolsStatsSlice> | null
): GolsStatsSlice {
  const g = normalizeGolsStatsSlice(globalRaw);
  if (g.avgScored > 0 || g.avgConceded > 0 || g.avgTotal > 0) return g;
  return averageGolsStatsSlice(home, away);
}

/**
 * Força de ataque: média ponderada entre taxa de gols e xG por jogo.
 */
export function blendAttackRate(
  goalsPerGame: number,
  xgPerGame: number,
  wGoals: number = BLEND_WEIGHT_GOALS,
  wXg: number = BLEND_WEIGHT_XG
): number {
  const g = Math.max(0, goalsPerGame);
  const x = Math.max(0, xgPerGame);
  if (x <= 0) return g;
  if (g <= 0) return x;
  const wSum = wGoals + wXg;
  return (g * wGoals + x * wXg) / wSum;
}

/**
 * Normaliza métrica de volume para [0,1] usando referência típica; `cap` limita o fator multiplicador aplicado no motor.
 */
export function normalizePerLeague(
  value: number,
  typicalMean: number,
  cap: number = 1
): number {
  if (!(typicalMean > 0) || !Number.isFinite(value)) return 0;
  const ratio = value / typicalMean;
  return Math.max(0, Math.min(cap, ratio));
}

/**
 * Média de gols totais por jogo nos últimos `maxGames`, com peso maior nos jogos mais recentes.
 * Assume `history[0]` = jogo mais recente. Pesos: mais recente primeiro.
 */
const RECENCY_WEIGHTS = [1.35, 1.25, 1.15, 1.05, 1.0];

export function weightedRecentGoalsPerGame(history: RecentMatch[], maxGames: number = 5): number {
  if (!history.length) return 0;
  const slice = history.slice(0, maxGames);
  let wSum = 0;
  let weighted = 0;
  for (let i = 0; i < slice.length; i++) {
    const m = slice[i];
    const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
    const w = RECENCY_WEIGHTS[i] ?? RECENCY_WEIGHTS[RECENCY_WEIGHTS.length - 1];
    weighted += total * w;
    wSum += w;
  }
  return wSum > 0 ? weighted / wSum : 0;
}

/**
 * Diferença relativa xG − gols (por jogo). Positivo: cria mais que converte (possível “alta” futura);
 * negativo: conversão acima do xG (possível regressão).
 */
export function xgFinishDelta(goalsPerGame: number, xgPerGame: number): number {
  const g = Math.max(0.25, goalsPerGame);
  const x = Math.max(0, xgPerGame);
  return (x - g) / g;
}

/**
 * Ajuste finito ao λ a partir do delta finishing (evita sobreajuste).
 */
export function finishingLambdaFactor(delta: number): number {
  const d = Math.max(-1.5, Math.min(1.5, delta));
  return 1 + d * 0.05;
}

const TYPICAL_SHOTS = 5;
const TYPICAL_XA = 0.35;
const TYPICAL_PROG_PASSES = 28;
const TYPICAL_KEY_PASSES = 2.5;

export type VolumeInputs = {
  shotsOnTarget?: number;
  xa?: number;
  progressivePasses?: number;
  keyPasses?: number;
};

/**
 * Combina proxies de volume em um único fator 1 ± pequeno (máx. ~6% combinado).
 */
export function volumeOffenseFactor(v: VolumeInputs): number {
  let adj = 0;
  if (v.shotsOnTarget != null && v.shotsOnTarget > 0) {
    adj += (normalizePerLeague(v.shotsOnTarget, TYPICAL_SHOTS, 1.2) - 1) * 0.04;
  }
  if (v.xa != null && v.xa > 0) {
    adj += (normalizePerLeague(v.xa, TYPICAL_XA, 1.2) - 1) * 0.025;
  }
  if (v.progressivePasses != null && v.progressivePasses > 0) {
    adj += (normalizePerLeague(v.progressivePasses, TYPICAL_PROG_PASSES, 1.15) - 1) * 0.02;
  }
  if (v.keyPasses != null && v.keyPasses > 0) {
    adj += (normalizePerLeague(v.keyPasses, TYPICAL_KEY_PASSES, 1.15) - 1) * 0.02;
  }
  return Math.max(0.94, Math.min(1.06, 1 + adj));
}

/**
 * Mistura taxa vinda do histórico ponderado com snapshot do formulário (xG).
 */
export function blendHistoricWithFormSnapshot(
  historicRate: number,
  formRate: number,
  wHist: number = WEIGHT_HISTORIC_RATE,
  wForm: number = WEIGHT_FORM_SNAPSHOT
): number {
  if (!(formRate > 0)) return Math.max(0, historicRate);
  if (!(historicRate > 0)) return Math.max(0, formRate);
  const s = wHist + wForm;
  return (historicRate * wHist + formRate * wForm) / s;
}
