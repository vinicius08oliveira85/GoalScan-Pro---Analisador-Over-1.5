import { z } from 'zod';
import type { GlobalStatsTableJson, GolsStats, TeamStatistics } from '../types';
import {
  GLOBAL_STATS_GOLS_METRIC_MAPPINGS,
  getGlobalStatsGolsExportRows,
} from './globalStatsMetricMappings';
import { parseNumber } from './globalStatsParser';

const rowSchema = z.object({
  metric: z.string(),
  values: z.array(z.union([z.string(), z.number(), z.null()])),
});

const tableSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  headers: z.array(z.union([z.string(), z.number()])).min(3),
  rows: z.array(rowSchema),
  firstColumnHeader: z.union([z.string(), z.number()]).optional(),
});

function createEmptyGols(): GolsStats {
  return {
    avgScored: 0,
    avgConceded: 0,
    avgTotal: 0,
    cleanSheetPct: 0,
    noGoalsPct: 0,
    over25Pct: 0,
    under25Pct: 0,
  };
}

function normalizeCell(raw: string): number {
  const t = raw.trim();
  if (t === '' || t === '-' || t === 'N/A' || t === '—') {
    return 0;
  }
  return parseNumber(t);
}

/**
 * Interpreta um objeto no formato GlobalStatsTableJson e devolve apenas o bloco `gols`.
 */
export function parseGlobalStatsTableJson(input: unknown): {
  home: GolsStats;
  away: GolsStats;
  global: GolsStats;
} {
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('JSON inválido: esperado objeto com title, headers (3 colunas) e rows.');
  }

  const stats = {
    home: createEmptyGols(),
    away: createEmptyGols(),
    global: createEmptyGols(),
  };

  for (const row of parsed.data.rows) {
    const metricName = row.metric.trim();
    if (!metricName) continue;

    const v = row.values.map((x) => String(x ?? '').trim());
    if (v.length < 3) continue;

    for (const mapping of GLOBAL_STATS_GOLS_METRIC_MAPPINGS) {
      if (mapping.pattern.test(metricName)) {
        const field = mapping.field;
        (stats.home[field] as number) = normalizeCell(v[0]);
        (stats.away[field] as number) = normalizeCell(v[1]);
        (stats.global[field] as number) = normalizeCell(v[2]);
        break;
      }
    }
  }

  return stats;
}

function formatDecimal(n: number): string {
  if (n === 0) return '0';
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return String(r);
}

function formatPercent(n: number): string {
  if (n === 0) return '0%';
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return `${r}%`;
  return `${r}%`;
}

/**
 * Monta o JSON canônico a partir do bloco `gols` já preenchido no formulário.
 */
export function buildGlobalStatsTableJson(
  title: string,
  gols: { home: GolsStats; away: GolsStats; global: GolsStats },
  id?: string
): GlobalStatsTableJson {
  const rows: GlobalStatsTableJson['rows'] = getGlobalStatsGolsExportRows().map(({ metric, field, kind }) => {
    const fmt = kind === 'decimal' ? formatDecimal : formatPercent;
    return {
      metric,
      values: [fmt(gols.home[field]), fmt(gols.away[field]), fmt(gols.global[field])] as [
        string,
        string,
        string,
      ],
    };
  });

  const out: GlobalStatsTableJson = {
    title,
    headers: ['Casa', 'Fora', 'Global'],
    rows,
    firstColumnHeader: '',
  };
  if (id) out.id = id;
  return out;
}

function emptyPercursoTeamStats(gols: { home: GolsStats; away: GolsStats; global: GolsStats }): TeamStatistics {
  const p = {
    winStreak: 0,
    drawStreak: 0,
    lossStreak: 0,
    withoutWin: 0,
    withoutDraw: 0,
    withoutLoss: 0,
  };
  return {
    percurso: { home: p, away: p, global: p },
    gols,
  };
}

export interface ParsedGlobalStatsFromFile {
  homeTeamStats: TeamStatistics;
  awayTeamStats: TeamStatistics;
}

/**
 * Arquivo JSON com os dois times: `{ "home": {...}, "away": {...} }`, `{ "timeCasa": {...}, "timeFora": {...} }` ou array `[casa, fora]`.
 */
export function parseDualGlobalStatsJson(parsed: unknown): ParsedGlobalStatsFromFile {
  if (Array.isArray(parsed)) {
    if (parsed.length !== 2) {
      throw new Error('JSON em array deve ter exatamente 2 objetos: [ timeCasa, timeVisitante ].');
    }
    const gHome = parseGlobalStatsTableJson(parsed[0]);
    const gAway = parseGlobalStatsTableJson(parsed[1]);
    return {
      homeTeamStats: emptyPercursoTeamStats(gHome),
      awayTeamStats: emptyPercursoTeamStats(gAway),
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON inválido.');
  }

  const o = parsed as Record<string, unknown>;
  if (o.home != null && o.away != null) {
    return {
      homeTeamStats: emptyPercursoTeamStats(parseGlobalStatsTableJson(o.home)),
      awayTeamStats: emptyPercursoTeamStats(parseGlobalStatsTableJson(o.away)),
    };
  }
  if (o.timeCasa != null && o.timeFora != null) {
    return {
      homeTeamStats: emptyPercursoTeamStats(parseGlobalStatsTableJson(o.timeCasa)),
      awayTeamStats: emptyPercursoTeamStats(parseGlobalStatsTableJson(o.timeFora)),
    };
  }

  throw new Error(
    'Para importar os dois times via arquivo JSON, use { home, away }, { timeCasa, timeFora } ou [casa, fora]. Um único time: use "Colar Dados" no bloco do time.'
  );
}
