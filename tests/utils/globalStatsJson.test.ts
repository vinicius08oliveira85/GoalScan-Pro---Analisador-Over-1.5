import { describe, it, expect } from 'vitest';
import {
  parseGlobalStatsTableJson,
  buildGlobalStatsTableJson,
  parseDualGlobalStatsJson,
} from '../../utils/globalStatsJson';
import {
  GLOBAL_STATS_GOLS_EXPORT_FIELDS,
  GLOBAL_STATS_GOLS_FIELD_META,
  getGlobalStatsGolsExportRows,
} from '../../utils/globalStatsMetricMappings';
import type { GlobalStatsTableJson } from '../../types';

const gironaSample: GlobalStatsTableJson = {
  id: '6d356ff7-2e4c-4cd3-9654-9fc2adaaf236',
  title: 'Girona',
  headers: ['Casa', 'Fora', 'Global'],
  rows: [
    { metric: 'Média de gols marcados por jogo', values: ['1.75', '1', '1.3'] },
    { metric: 'Média de gols sofridos por jogo', values: ['1', '1', '1'] },
    { metric: 'Média de gols marcados+sofridos', values: ['2.75', '2', '2.3'] },
    { metric: 'Jogos sem sofrer', values: ['25%', '17%', '20%'] },
    { metric: 'Jogos sem marcar gols', values: ['-', '33%', '20%'] },
    { metric: 'Jogos com Mais de 2,5 Gols', values: ['75%', '17%', '40%'] },
    { metric: 'Jogos com menos de 2,5 Gols', values: ['25%', '83%', '60%'] },
  ],
  firstColumnHeader: '',
};

describe('globalStatsJson', () => {
  it('getGlobalStatsGolsExportRows alinha meta, ordem e rótulos do JSON canônico (Girona)', () => {
    const rows = getGlobalStatsGolsExportRows();
    expect(rows.map((r) => r.field)).toEqual([...GLOBAL_STATS_GOLS_EXPORT_FIELDS]);
    rows.forEach((r) => {
      expect(r.metric).toBe(GLOBAL_STATS_GOLS_FIELD_META[r.field].exportLabel);
      expect(r.kind).toBe(GLOBAL_STATS_GOLS_FIELD_META[r.field].kind);
    });
    expect(rows.map((r) => r.metric)).toEqual(gironaSample.rows.map((row) => row.metric));
  });

  it('parseGlobalStatsTableJson interpreta o JSON de exemplo (Girona)', () => {
    const g = parseGlobalStatsTableJson(gironaSample);
    expect(g.home.avgScored).toBe(1.75);
    expect(g.away.avgScored).toBe(1);
    expect(g.global.avgScored).toBe(1.3);
    expect(g.home.noGoalsPct).toBe(0);
    expect(g.away.noGoalsPct).toBe(33);
    expect(g.global.cleanSheetPct).toBe(20);
    expect(g.home.over25Pct).toBe(75);
  });

  it('buildGlobalStatsTableJson + parseGlobalStatsTableJson é redondo', () => {
    const gols = parseGlobalStatsTableJson(gironaSample);
    const back = buildGlobalStatsTableJson('Girona', gols, 'test-id');
    const g2 = parseGlobalStatsTableJson(back);
    expect(g2.home.avgScored).toBeCloseTo(gols.home.avgScored, 5);
    expect(g2.away.noGoalsPct).toBe(gols.away.noGoalsPct);
  });

  it('parseDualGlobalStatsJson aceita { home, away }', () => {
    const { homeTeamStats, awayTeamStats } = parseDualGlobalStatsJson({
      home: gironaSample,
      away: { ...gironaSample, title: 'Valencia', id: 'x' },
    });
    expect(homeTeamStats.gols.home.avgScored).toBe(1.75);
    expect(awayTeamStats.gols.home.avgScored).toBe(1.75);
  });

  it('parseDualGlobalStatsJson aceita [casa, fora]', () => {
    const r = parseDualGlobalStatsJson([gironaSample, { ...gironaSample, title: 'B' }]);
    expect(r.homeTeamStats.gols.global.under25Pct).toBe(60);
  });
});
