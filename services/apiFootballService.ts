import { logger } from '../utils/logger';

const PROXY_BASE = '/api/football-proxy';

async function proxyGet<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(PROXY_BASE, window.location.origin);
  url.searchParams.set('endpoint', endpoint);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const resp = await fetch(url.toString(), {
    signal: AbortSignal.timeout(20000),
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

export async function fetchStandings(leagueId: number, season: number): Promise<ApiStandingsResponse> {
  logger.info(`[APIFootball] Fetching standings: league=${leagueId}, season=${season}`);
  return proxyGet<ApiStandingsResponse>('standings', { league: leagueId, season });
}

export async function fetchFixtures(leagueId: number, season: number): Promise<ApiFixturesResponse> {
  logger.info(`[APIFootball] Fetching fixtures: league=${leagueId}, season=${season}`);
  return proxyGet<ApiFixturesResponse>('fixtures', { league: leagueId, season });
}

export async function fetchHeadToHead(team1Id: number, team2Id: number): Promise<ApiFixturesResponse> {
  logger.info(`[APIFootball] Fetching H2H: ${team1Id} vs ${team2Id}`);
  return proxyGet<ApiFixturesResponse>('fixtures/headtohead', { h2h: `${team1Id}-${team2Id}` });
}
