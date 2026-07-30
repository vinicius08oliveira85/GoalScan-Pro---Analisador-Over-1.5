import { FootballLeague, CACHE_TTL_MS, getLeagueById } from '../config/footballLeagues';
import {
  fetchStandings,
  fetchFixtures,
  ApiStandingTeam,
  ApiFixture,
} from './apiFootballService';
import { Championship, ChampionshipTable, TableRowGeral, TeamStatistics } from '../types';
import { logger } from '../utils/logger';

export interface ImportProgress {
  step: 'extraindo' | 'salvando' | 'concluido' | 'erro';
  league: string;
  message: string;
  progress: number;
}

export interface LeagueStandingRow {
  teamId: number;
  teamName: string;
  teamLogo: string;
  rank: number;
  points: number;
  form: string | null;
  all: ApiStandingTeam['all'];
  home: ApiStandingTeam['home'];
  away: ApiStandingTeam['away'];
}

export interface LeagueMatch {
  fixtureId: number;
  date: string;
  status: string;
  round: string;
  homeTeam: { id: number; name: string; logo: string };
  awayTeam: { id: number; name: string; logo: string };
  goals: { home: number | null; away: number | null };
}

export interface LeagueData {
  leagueId: number;
  leagueName: string;
  season: number;
  standings: LeagueStandingRow[];
  fixtures: LeagueMatch[];
  cachedAt: number;
}

export interface TeamStatsFromFixtures {
  teamId: number;
  teamName: string;
  home: { played: number; scored: number; conceded: number; cleanSheets: number; noGoals: number; over25: number };
  away: { played: number; scored: number; conceded: number; cleanSheets: number; noGoals: number; over25: number };
  global: { played: number; scored: number; conceded: number; cleanSheets: number; noGoals: number; over25: number };
}

interface CacheEntry {
  data: LeagueData;
  timestamp: number;
}

const CACHE_PREFIX = 'apiFootball_';

function cacheKey(leagueId: number): string {
  return `${CACHE_PREFIX}${leagueId}`;
}

function getFromCache(leagueId: number, forceRefresh = false): LeagueData | null {
  if (forceRefresh) return null;
  try {
    const raw = localStorage.getItem(cacheKey(leagueId));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(leagueId));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function saveToCache(data: LeagueData): void {
  const entry: CacheEntry = { data, timestamp: Date.now() };
  localStorage.setItem(cacheKey(data.leagueId), JSON.stringify(entry));
}

function mapStandings(teams: ApiStandingTeam[]): LeagueStandingRow[] {
  return teams.map((t) => ({
    teamId: t.team.id,
    teamName: t.team.name,
    teamLogo: t.team.logo,
    rank: t.rank,
    points: t.points,
    form: t.form,
    all: t.all,
    home: t.home,
    away: t.away,
  }));
}

function mapFixtures(fixtures: ApiFixture[]): LeagueMatch[] {
  return fixtures.map((f) => ({
    fixtureId: f.fixture.id,
    date: f.fixture.date,
    status: f.fixture.status.short,
    round: f.league.round,
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
    goals: { home: f.goals.home, away: f.goals.away },
  }));
}

function standingToTableRow(s: LeagueStandingRow): TableRowGeral {
  const gf = s.all.goals.for;
  const ga = s.all.goals.against;
  const homeGf = s.home.goals.for;
  const homeGa = s.home.goals.against;
  const awayGf = s.away.goals.for;
  const awayGa = s.away.goals.against;
  const homePts = s.home.win * 3 + s.home.draw;
  const awayPts = s.away.win * 3 + s.away.draw;
  const ptsMp = s.all.played > 0 ? (s.points / s.all.played).toFixed(2) : '0';
  const homePtsMp = s.home.played > 0 ? (homePts / s.home.played).toFixed(2) : '0';
  const awayPtsMp = s.away.played > 0 ? (awayPts / s.away.played).toFixed(2) : '0';

  return {
    Rk: String(s.rank),
    Squad: s.teamName,
    MP: String(s.all.played),
    W: String(s.all.win),
    D: String(s.all.draw),
    L: String(s.all.lose),
    GF: String(gf),
    GA: String(ga),
    GD: String(gf - ga),
    Pts: String(s.points),
    'Pts/MP': ptsMp,
    'Last 5': s.form || '',
    'Home MP': String(s.home.played),
    'Home W': String(s.home.win),
    'Home D': String(s.home.draw),
    'Home L': String(s.home.lose),
    'Home GF': String(homeGf),
    'Home GA': String(homeGa),
    'Home GD': String(homeGf - homeGa),
    'Home Pts': String(homePts),
    'Home Pts/MP': homePtsMp,
    'Away MP': String(s.away.played),
    'Away W': String(s.away.win),
    'Away D': String(s.away.draw),
    'Away L': String(s.away.lose),
    'Away GF': String(awayGf),
    'Away GA': String(awayGa),
    'Away GD': String(awayGf - awayGa),
    'Away Pts': String(awayPts),
    'Away Pts/MP': awayPtsMp,
  };
}

export function computeTeamStatsFromFixtures(fixtures: LeagueMatch[]): Map<number, TeamStatsFromFixtures> {
  const stats = new Map<number, TeamStatsFromFixtures>();

  function ensure(id: number, name: string): TeamStatsFromFixtures {
    let s = stats.get(id);
    if (!s) {
      s = { teamId: id, teamName: name, home: { played: 0, scored: 0, conceded: 0, cleanSheets: 0, noGoals: 0, over25: 0 }, away: { played: 0, scored: 0, conceded: 0, cleanSheets: 0, noGoals: 0, over25: 0 }, global: { played: 0, scored: 0, conceded: 0, cleanSheets: 0, noGoals: 0, over25: 0 } };
      stats.set(id, s);
    }
    return s;
  }

  for (const f of fixtures) {
    if (f.goals.home === null || f.goals.away === null) continue;
    const home = f.goals.home;
    const away = f.goals.away;
    const total = home + away;

    const hs = ensure(f.homeTeam.id, f.homeTeam.name);
    hs.home.played++;
    hs.home.scored += home;
    hs.home.conceded += away;
    if (away === 0) hs.home.cleanSheets++;
    if (home === 0) hs.home.noGoals++;
    if (total > 2.5) hs.home.over25++;
    hs.global.played++;
    hs.global.scored += home;
    hs.global.conceded += away;
    if (away === 0) hs.global.cleanSheets++;
    if (home === 0) hs.global.noGoals++;
    if (total > 2.5) hs.global.over25++;

    const as = ensure(f.awayTeam.id, f.awayTeam.name);
    as.away.played++;
    as.away.scored += away;
    as.away.conceded += home;
    if (home === 0) as.away.cleanSheets++;
    if (away === 0) as.away.noGoals++;
    if (total > 2.5) as.away.over25++;
    as.global.played++;
    as.global.scored += away;
    as.global.conceded += home;
    if (home === 0) as.global.cleanSheets++;
    if (away === 0) as.global.noGoals++;
    if (total > 2.5) as.global.over25++;
  }

  return stats;
}

export function teamStatsToAnalysisFormat(ts: TeamStatsFromFixtures): TeamStatistics {
  const pct = (num: number, denom: number) => denom > 0 ? (num / denom) * 100 : 0;
  const avg = (num: number, denom: number) => denom > 0 ? num / denom : 0;

  return {
    percurso: {
      home: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 },
      away: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 },
      global: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 },
    },
    gols: {
      home: {
        avgTotal: avg(ts.home.scored + ts.home.conceded, ts.home.played),
        cleanSheetPct: pct(ts.home.cleanSheets, ts.home.played),
        noGoalsPct: pct(ts.home.noGoals, ts.home.played),
        over25Pct: pct(ts.home.over25, ts.home.played),
        under25Pct: 100 - pct(ts.home.over25, ts.home.played),
        avgScored: avg(ts.home.scored, ts.home.played),
        avgConceded: avg(ts.home.conceded, ts.home.played),
      },
      away: {
        avgTotal: avg(ts.away.scored + ts.away.conceded, ts.away.played),
        cleanSheetPct: pct(ts.away.cleanSheets, ts.away.played),
        noGoalsPct: pct(ts.away.noGoals, ts.away.played),
        over25Pct: pct(ts.away.over25, ts.away.played),
        under25Pct: 100 - pct(ts.away.over25, ts.away.played),
        avgScored: avg(ts.away.scored, ts.away.played),
        avgConceded: avg(ts.away.conceded, ts.away.played),
      },
      global: {
        avgTotal: avg(ts.global.scored + ts.global.conceded, ts.global.played),
        cleanSheetPct: pct(ts.global.cleanSheets, ts.global.played),
        noGoalsPct: pct(ts.global.noGoals, ts.global.played),
        over25Pct: pct(ts.global.over25, ts.global.played),
        under25Pct: 100 - pct(ts.global.over25, ts.global.played),
        avgScored: avg(ts.global.scored, ts.global.played),
        avgConceded: avg(ts.global.conceded, ts.global.played),
      },
    },
  };
}

export async function importLeague(
  league: FootballLeague,
  onProgress?: (p: ImportProgress) => void,
  forceRefresh = false,
): Promise<LeagueData> {
  if (!forceRefresh) {
    const cached = getFromCache(league.id);
    if (cached) {
      logger.info(`[MultiLeague] Cache hit for ${league.name}`);
      return cached;
    }
  }

  onProgress?.({
    step: 'extraindo',
    league: league.name,
    message: `Extraindo classificacao de ${league.name}...`,
    progress: 0,
  });

  const standingsResp = await fetchStandings(league.id, league.season);

  onProgress?.({
    step: 'extraindo',
    league: league.name,
    message: `Extraindo jogos de ${league.name}...`,
    progress: 50,
  });

  const fixturesResp = await fetchFixtures(league.id, league.season);

  const standingsRows = standingsResp.response?.[0]?.league?.standings?.[0] || [];
  const standings = mapStandings(standingsRows);
  const fixtures = mapFixtures(fixturesResp.response || []);

  const data: LeagueData = {
    leagueId: league.id,
    leagueName: league.name,
    season: league.season,
    standings,
    fixtures,
    cachedAt: Date.now(),
  };

  saveToCache(data);
  return data;
}

export async function importMultipleLeagues(
  leagueIds: number[],
  onProgress?: (p: ImportProgress) => void,
  forceRefresh = false,
): Promise<Map<number, LeagueData>> {
  const results = new Map<number, LeagueData>();
  let completed = 0;

  for (const id of leagueIds) {
    const league = getLeagueById(id);
    if (!league) continue;

    try {
      const data = await importLeague(league, onProgress, forceRefresh);
      results.set(id, data);
      completed++;

      onProgress?.({
        step: 'extraindo',
        league: league.name,
        message: `${league.name} extraida com sucesso`,
        progress: Math.round((completed / leagueIds.length) * 100),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error(`[MultiLeague] Erro ao importar ${league.name}:`, error);
      onProgress?.({
        step: 'erro',
        league: league.name,
        message: `Erro ao importar ${league.name}: ${msg}`,
        progress: Math.round((completed / leagueIds.length) * 100),
      });
    }
  }

  return results;
}

const LS_CHAMPIONSHIPS = 'goalscan_championships';
const LS_TABLES = 'goalscan_championship_tables';

function saveChampionshipToLocal(championship: Championship): Championship {
  try {
    const raw = localStorage.getItem(LS_CHAMPIONSHIPS);
    const list: Championship[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((c) => c.id === championship.id);
    if (idx >= 0) list[idx] = championship;
    else list.push(championship);
    localStorage.setItem(LS_CHAMPIONSHIPS, JSON.stringify(list));
  } catch (e) {
    logger.error('[MultiLeague] Erro ao salvar championship no localStorage:', e);
  }
  return championship;
}

function saveTableToLocal(table: ChampionshipTable): ChampionshipTable {
  try {
    const raw = localStorage.getItem(LS_TABLES);
    const list: ChampionshipTable[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((t) => t.championship_id !== table.championship_id || t.table_type !== table.table_type);
    filtered.push(table);
    localStorage.setItem(LS_TABLES, JSON.stringify(filtered));
  } catch (e) {
    logger.error('[MultiLeague] Erro ao salvar tabela no localStorage:', e);
  }
  return table;
}

function loadChampionshipsFromLocal(): Championship[] {
  try {
    const raw = localStorage.getItem(LS_CHAMPIONSHIPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveLeagueAsChampionship(
  league: FootballLeague,
  data: LeagueData,
): Promise<{ championship: Championship | null; tables: ChampionshipTable[] }> {
  const result: { championship: Championship | null; tables: ChampionshipTable[] } = {
    championship: null,
    tables: [],
  };

  const championshipId = `league_${league.id}_${league.season}`;

  const existing = loadChampionshipsFromLocal();
  const found = existing.find((c) => c.id === championshipId);

  const championship: Championship = {
    id: championshipId,
    nome: `${league.icon} ${league.name} ${league.season}`,
    table_format: 'basica',
    created_at: found?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const savedChamp = saveChampionshipToLocal(championship);
  result.championship = savedChamp;

  let geralTable: ChampionshipTable | null = null;
  if (data.standings.length > 0) {
    const geralRows = data.standings.map(standingToTableRow);
    geralTable = {
      id: `${championshipId}_geral`,
      championship_id: championshipId,
      table_type: 'geral',
      table_name: 'Classificacao',
      table_data: geralRows,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    result.tables.push(saveTableToLocal(geralTable));
  }

  if (result.tables.length > 0) {
    try {
      const { saveChampionship, saveChampionshipTable } = await import('./championshipTables');
      await saveChampionship(championship);
      for (const t of result.tables) {
        await saveChampionshipTable(t);
      }
      logger.info(`[MultiLeague] Synced ${league.name} to Supabase`);
    } catch (e) {
      logger.warn(`[MultiLeague] Supabase sync failed for ${league.name}, localStorage only:`, e);
    }
  }

  if (data.fixtures.length > 0) {
    const jogosTable: ChampionshipTable = {
      id: `${championshipId}_jogos`,
      championship_id: championshipId,
      table_type: 'jogos',
      table_name: 'Jogos',
      table_data: data.fixtures as unknown[],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    result.tables.push(saveTableToLocal(jogosTable));
    try {
      const { saveChampionshipTable } = await import('./championshipTables');
      await saveChampionshipTable(jogosTable);
    } catch (e) {
      logger.warn(`[MultiLeague] Supabase sync failed for fixtures of ${league.name}:`, e);
    }
  }

  if (data.fixtures.length > 0 && geralTable) {
    const teamFixturesStats = computeTeamStatsFromFixtures(data.fixtures);
    const geralRows = data.standings.map(standingToTableRow);
    for (const row of geralRows) {
      const tfs = teamFixturesStats.get(
        data.standings.find((s) => s.teamName === row.Squad)?.teamId ?? -1,
      );
      if (tfs) {
        (row as Record<string, unknown>)['teamStats'] = teamStatsToAnalysisFormat(tfs);
      }
    }
  }

  return result;
}

export function clearLeagueCache(leagueId: number): void {
  try {
    localStorage.removeItem(cacheKey(leagueId));
    logger.info(`[MultiLeague] Cache cleared for league ${leagueId}`);
  } catch (e) {
    logger.error('[MultiLeague] Erro ao limpar cache:', e);
  }
}
