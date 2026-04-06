import type { GolsStats } from '../types';

export type GolsMetricValueKind = 'decimal' | 'percent';

export type GlobalStatsGolsFieldMeta = {
  /** Texto da coluna "metric" no JSON canônico e referência para documentação. */
  exportLabel: string;
  kind: GolsMetricValueKind;
};

/**
 * Uma linha por chave de `GolsStats`: rótulo e tipo de formatação na exportação JSON.
 * Ao adicionar métrica: atualize também {@link GLOBAL_STATS_GOLS_EXPORT_FIELDS} e a cadeia de parse.
 */
export const GLOBAL_STATS_GOLS_FIELD_META: Record<keyof GolsStats, GlobalStatsGolsFieldMeta> = {
  avgScored: { exportLabel: 'Média de gols marcados por jogo', kind: 'decimal' },
  avgConceded: { exportLabel: 'Média de gols sofridos por jogo', kind: 'decimal' },
  avgTotal: { exportLabel: 'Média de gols marcados+sofridos', kind: 'decimal' },
  cleanSheetPct: { exportLabel: 'Jogos sem sofrer', kind: 'percent' },
  noGoalsPct: { exportLabel: 'Jogos sem marcar gols', kind: 'percent' },
  over25Pct: { exportLabel: 'Jogos com Mais de 2,5 Gols', kind: 'percent' },
  under25Pct: { exportLabel: 'Jogos com menos de 2,5 Gols', kind: 'percent' },
};

/**
 * Ordem das linhas no JSON exportado (e ordem canônica esperada na UI).
 */
export const GLOBAL_STATS_GOLS_EXPORT_FIELDS: readonly (keyof GolsStats)[] = [
  'avgScored',
  'avgConceded',
  'avgTotal',
  'cleanSheetPct',
  'noGoalsPct',
  'over25Pct',
  'under25Pct',
];

export type GlobalStatsGolsExportRowSpec = {
  field: keyof GolsStats;
  metric: string;
  kind: GolsMetricValueKind;
};

/** Deriva linhas de exportação a partir de {@link GLOBAL_STATS_GOLS_FIELD_META} e {@link GLOBAL_STATS_GOLS_EXPORT_FIELDS}. */
export function getGlobalStatsGolsExportRows(): readonly GlobalStatsGolsExportRowSpec[] {
  return GLOBAL_STATS_GOLS_EXPORT_FIELDS.map((field) => {
    const meta = GLOBAL_STATS_GOLS_FIELD_META[field];
    return { field, metric: meta.exportLabel, kind: meta.kind };
  });
}

export type GlobalStatsGolsMetricMapping = {
  pattern: RegExp;
  field: keyof GolsStats;
};

/**
 * Cadeia de parse (Excel/CSV/JSON): primeiro padrão que casa com o texto da métrica define o campo.
 * Ordem importa (ex.: "marcados+sofridos" antes de "marcados por jogo"; "média.*total" depois das médias por jogo).
 * Cada `field` deve existir em {@link GLOBAL_STATS_GOLS_FIELD_META}.
 */
export const GLOBAL_STATS_GOLS_METRIC_MAPPINGS: readonly GlobalStatsGolsMetricMapping[] = [
  { pattern: /média.*gols.*marcados\+sofridos|média.*marcados\s*\+\s*sofridos/i, field: 'avgTotal' },
  { pattern: /média.*gols.*marcados por jogo/i, field: 'avgScored' },
  { pattern: /média.*gols.*sofridos por jogo/i, field: 'avgConceded' },
  { pattern: /média.*total/i, field: 'avgTotal' },
  { pattern: /jogos.*sem.*sofrer/i, field: 'cleanSheetPct' },
  { pattern: /jogos.*sem.*marcar/i, field: 'noGoalsPct' },
  { pattern: /jogos.*mais.*2[.,]?5.*gols|over.*2[.,]?5/i, field: 'over25Pct' },
  { pattern: /jogos.*menos.*2[.,]?5.*gols|under.*2[.,]?5/i, field: 'under25Pct' },
];
