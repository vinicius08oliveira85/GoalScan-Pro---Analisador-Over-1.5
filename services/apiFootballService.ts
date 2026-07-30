import { logger } from '../utils/logger';

const PROXY_URL = '/api/football-api';
const EXPORT_URL = '/api/export-championship';

async function proxyPost<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  const body: Record<string, unknown> = {
    endpoint,
    params: {},
  };

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      (body.params as Record<string, string>)[k] = String(v);
    }
  }

  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const msg = `API-Football ${resp.status}`;
    logger.error(`[APIFootball] ${msg} (${endpoint})`);
    throw new Error(msg);
  }

  return resp.json() as Promise<T>;
}

export interface ApiStandingTeam {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  status: string;
  description: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export interface ApiStandingsResponse {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, unknown>;
  results: number;
  response: Array<{
    league: {
      id: number;
      name: string;
      country: string;
      logo: string;
      flag: string;
      season: number;
      standings: ApiStandingTeam[][];
    };
  }>;
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
    venue: { name: string; city: string };
  };
  league: {
    id: number;
    name: string;
    round: string;
    season: number;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

export interface ApiFixturesResponse {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, unknown>;
  results: number;
  response: ApiFixture[];
}

export interface ExportedLeague {
  version: string;
  exported_at: string;
  league: {
    id: number;
    name: string;
    season: number;
  };
  standings: Array<{
    rank: number;
    team: string;
    team_id: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    points: number;
    form: string;
    home: { played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number };
    away: { played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number };
  }>;
  fixtures: Array<{
    fixture_id: number;
    date: string;
    status: string;
    round: string;
    home_team: string;
    home_team_id: number;
    away_team: string;
    away_team_id: number;
    goals_home: number | null;
    goals_away: number | null;
  }>;
  stats: {
    total_teams: number;
    total_matches: number;
  };
}

export async function fetchStandings(leagueId: number, season: number): Promise<ApiStandingsResponse> {
  logger.info(`[APIFootball] Fetching standings: league=${leagueId}, season=${season}`);
  return proxyPost<ApiStandingsResponse>('standings', { league: leagueId, season });
}

export async function fetchFixtures(leagueId: number, season: number): Promise<ApiFixturesResponse> {
  logger.info(`[APIFootball] Fetching fixtures: league=${leagueId}, season=${season}`);
  return proxyPost<ApiFixturesResponse>('fixtures', { league: leagueId, season });
}

export async function fetchHeadToHead(team1Id: number, team2Id: number): Promise<ApiFixturesResponse> {
  logger.info(`[APIFootball] Fetching H2H: ${team1Id} vs ${team2Id}`);
  return proxyPost<ApiFixturesResponse>('fixtures/headtohead', { h2h: `${team1Id}-${team2Id}` });
}

export async function exportLeagueData(
  leagueId: number,
  season: number,
): Promise<ExportedLeague> {
  logger.info(`[APIFootball] Exporting league: ${leagueId}, season=${season}`);
  const resp = await fetch(`${EXPORT_URL}?league_id=${leagueId}&season=${season}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(35000),
  });
  if (!resp.ok) {
    const msg = `Export ${resp.status}`;
    logger.error(`[APIFootball] ${msg} (league=${leagueId})`);
    throw new Error(msg);
  }
  return resp.json() as Promise<ExportedLeague>;
}
