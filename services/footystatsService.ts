import { logger } from '../utils/logger';

const FOOTYSTATS_API_URL = '/api/footystats-extract';

const URLS = {
  standings: 'https://footystats.org/brazil/serie-a',
  fixtures: 'https://footystats.org/brazil/serie-a/fixtures',
  formTable: 'https://footystats.org/brazil/serie-a/form-table',
};

export interface FootyStatsStanding {
  Rk: string;
  Squad: string;
  MP: string;
  W: string;
  D: string;
  L: string;
  GF: string;
  GA: string;
  GD: string;
  Pts: string;
  [key: string]: unknown;
}

export interface FootyStatsMatch {
  homeTeam: string;
  awayTeam: string;
  score?: string;
  htScore?: string;
  date?: string;
  time?: string;
  status?: string;
}

export interface FootyStatsFormEntry {
  Squad: string;
  [key: string]: unknown;
}

export interface FootyStatsResult<T> {
  success: boolean;
  data?: T;
  type?: 'standings' | 'fixtures' | 'form_table';
  error?: string;
}

async function callApi<T>(url: string): Promise<FootyStatsResult<T>> {
  try {
    if (!url.includes('footystats.org')) {
      return { success: false, error: 'URL inválida' };
    }
    const response = await fetch(FOOTYSTATS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      let msg = `Erro HTTP ${response.status}`;
      try { const d = await response.json() as { error?: string }; if (d?.error) msg = d.error; } catch { }
      return { success: false, error: msg };
    }
    const result = await response.json() as FootyStatsResult<T>;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[FootyStatsService] Erro:', error);
    return { success: false, error: `Erro ao extrair do FootyStats: ${message}` };
  }
}

export async function extractStandings(url?: string): Promise<FootyStatsResult<{ table: FootyStatsStanding[] }>> {
  return callApi<{ table: FootyStatsStanding[] }>(url || URLS.standings);
}

export async function extractFixtures(url?: string): Promise<FootyStatsResult<{ matches: FootyStatsMatch[] }>> {
  return callApi<{ matches: FootyStatsMatch[] }>(url || URLS.fixtures);
}

export async function extractFormTable(url?: string): Promise<FootyStatsResult<{ last5: FootyStatsFormEntry[]; last10: FootyStatsFormEntry[] }>> {
  return callApi<{ last5: FootyStatsFormEntry[]; last10: FootyStatsFormEntry[] }>(url || URLS.formTable);
}
