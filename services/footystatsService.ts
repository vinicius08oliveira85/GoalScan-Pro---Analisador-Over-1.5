import { logger } from '../utils/logger';

const FOOTYSTATS_API_URL = '/api/footystats-extract';

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?url=',
];

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
  PPG?: string;
  CS?: string;
  BTTS?: string;
  xG?: string;
  Over15?: string;
  Over25?: string;
  AVG?: string;
  [key: string]: unknown;
}

export interface FootyStatsMatch {
  homeTeam: string;
  awayTeam: string;
  score?: string;
  date?: string;
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

async function callPythonApi<T>(url: string): Promise<FootyStatsResult<T>> {
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
  return response.json() as Promise<FootyStatsResult<T>>;
}

async function fetchViaCorsProxy(fullUrl: string): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const resp = await fetch(proxy + encodeURIComponent(fullUrl), {
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const html = await resp.text();
        if (html.length > 1000) return html;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function isPremiumLink(text: string): boolean {
  return text.includes('premium') || text.includes('footystats.org') || text.includes('lock');
}

function extractStandingsFromHtml(html: string): FootyStatsStanding[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table.full-league-table');
  if (!table) return [];

  const rows = table.querySelectorAll('tbody tr');
  const results: FootyStatsStanding[] = [];

  rows.forEach(row => {
    const positionEl = row.querySelector('td.position');
    const teamEl = row.querySelector('td.team a');
    if (!positionEl || !teamEl) return;

    const entry: FootyStatsStanding = {
      Rk: positionEl.textContent?.trim() || '',
      Squad: teamEl.textContent?.trim() || '',
      MP: row.querySelector('td.mp')?.textContent?.trim() || '',
      W: row.querySelector('td.win')?.textContent?.trim() || '',
      D: row.querySelector('td.draw')?.textContent?.trim() || '',
      L: row.querySelector('td.loss')?.textContent?.trim() || '',
      GF: row.querySelector('td.gf')?.textContent?.trim() || '',
      GA: row.querySelector('td.ga')?.textContent?.trim() || '',
      GD: row.querySelector('td.gd')?.textContent?.trim() || '',
      Pts: row.querySelector('td.points')?.textContent?.trim() || '',
    };

    const ppgEl = row.querySelector('td.ppg');
    if (ppgEl) entry.PPG = ppgEl.textContent?.trim() || '';

    const csEl = row.querySelector('td.cs');
    if (csEl) {
      const val = csEl.textContent?.trim() || '';
      if (!isPremiumLink(val)) entry.CS = val;
    }

    const bttsEl = row.querySelector('td.btts');
    if (bttsEl) {
      const val = bttsEl.textContent?.trim() || '';
      if (!isPremiumLink(val)) entry.BTTS = val;
    }

    const xgEl = row.querySelector('td.fts');
    if (xgEl) {
      const val = xgEl.textContent?.trim() || '';
      if (!isPremiumLink(val)) entry.xG = val;
    }

    const over15El = row.querySelector('td.over15');
    if (over15El) {
      const val = over15El.textContent?.trim() || '';
      if (!isPremiumLink(val)) entry.Over15 = val;
    }

    const over25El = row.querySelector('td.over25');
    if (over25El) {
      const val = over25El.textContent?.trim() || '';
      if (!isPremiumLink(val)) entry.Over25 = val;
    }

    const avgEl = row.querySelector('td.avg');
    if (avgEl) {
      const val = avgEl.textContent?.trim() || '';
      if (!isPremiumLink(val)) entry.AVG = val;
    }

    results.push(entry);
  });

  return results;
}

function extractFixturesFromHtml(html: string): FootyStatsMatch[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const matches: FootyStatsMatch[] = [];
  const seen = new Set<string>();

  const rows = doc.querySelectorAll('tr.match');
  rows.forEach(row => {
    const homeEl = row.querySelector('td.team-home a span');
    const awayEl = row.querySelector('td.team-away a span');
    if (!homeEl || !awayEl) return;

    const home = homeEl.textContent?.trim() || '';
    const away = awayEl.textContent?.trim() || '';
    if (!home || !away) return;

    const key = `${home}_${away}`;
    if (seen.has(key)) return;
    seen.add(key);

    const entry: FootyStatsMatch = { homeTeam: home, awayTeam: away };
    const text = row.textContent || '';

    const scoreMatch = text.match(/(\d+)\s*[-–:]\s*(\d+)/);
    if (scoreMatch) entry.score = `${scoreMatch[1]}-${scoreMatch[2]}`;
    const dateMatch = text.match(/(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/);
    if (dateMatch) entry.date = dateMatch[1];

    matches.push(entry);
  });

  return matches;
}

function extractFormFromHtml(html: string): { last5: FootyStatsFormEntry[]; last10: FootyStatsFormEntry[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table.full-league-table');
  const results: FootyStatsFormEntry[][] = [];

  tables.forEach(table => {
    const entries: FootyStatsFormEntry[] = [];
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const a = row.querySelector('td.team a');
      if (!a) return;
      const name = a.textContent?.trim() || '';
      if (!name) return;

      const entry: FootyStatsFormEntry = { Squad: name };
      const positionEl = row.querySelector('td.position');
      if (positionEl) entry.Rk = positionEl.textContent?.trim() || '';
      const ptsEl = row.querySelector('td.points');
      if (ptsEl) entry.Pts = ptsEl.textContent?.trim() || '';
      row.querySelectorAll('td').forEach((td, i) => {
        const val = td.textContent?.trim() || '';
        if (val && !isPremiumLink(val)) entry[`col_${i}`] = val;
      });
      entries.push(entry);
    });
    if (entries.length > 0) results.push(entries);
  });

  if (results.length >= 2) return { last5: results[0], last10: results[1] };
  if (results.length === 1 && results[0].length >= 20) {
    const mid = Math.floor(results[0].length / 2);
    return { last5: results[0].slice(0, mid), last10: results[0].slice(mid) };
  }
  if (results.length === 1) return { last5: results[0], last10: [] };
  return { last5: [], last10: [] };
}

async function callWithFallback<T>(
  url: string,
  pythonParser: (url: string) => Promise<FootyStatsResult<T>>,
  clientParser: (html: string) => T,
): Promise<FootyStatsResult<T>> {
  const pyResult = await pythonParser(url).catch(() => null);
  if (pyResult?.success && pyResult.data) return pyResult;

  logger.info('[FootyStats] Python falhou, tentando client-side via CORS proxy...');
  const html = await fetchViaCorsProxy(url);
  if (!html) {
    return {
      success: false,
      error: pyResult?.error || 'Não foi possível acessar o FootyStats por nenhuma via.',
    };
  }

  try {
    const data = clientParser(html);
    const hasData = Array.isArray(data) ? data.length > 0
      : typeof data === 'object' && data !== null
        ? Object.values(data).some(v => Array.isArray(v) && v.length > 0)
        : false;
    if (hasData) {
      return { success: true, data, type: url.includes('fixtures') ? 'fixtures' : url.includes('form-table') ? 'form_table' : 'standings' };
    }
  } catch (e) {
    logger.error('[FootyStats] Erro ao parsear HTML client-side:', e);
  }

  return { success: false, error: 'HTML obtido mas não foi possível extrair os dados.' };
}

export async function extractStandings(url?: string): Promise<FootyStatsResult<{ table: FootyStatsStanding[] }>> {
  const targetUrl = url || URLS.standings;
  return callWithFallback(
    targetUrl,
    (u) => callPythonApi<{ table: FootyStatsStanding[] }>(u),
    (html) => ({ table: extractStandingsFromHtml(html) }),
  );
}

export async function extractFixtures(url?: string): Promise<FootyStatsResult<{ matches: FootyStatsMatch[] }>> {
  const targetUrl = url || URLS.fixtures;
  return callWithFallback(
    targetUrl,
    (u) => callPythonApi<{ matches: FootyStatsMatch[] }>(u),
    (html) => ({ matches: extractFixturesFromHtml(html) }),
  );
}

export async function extractFormTable(url?: string): Promise<FootyStatsResult<{ last5: FootyStatsFormEntry[]; last10: FootyStatsFormEntry[] }>> {
  const targetUrl = url || URLS.formTable;
  return callWithFallback(
    targetUrl,
    (u) => callPythonApi<{ last5: FootyStatsFormEntry[]; last10: FootyStatsFormEntry[] }>(u),
    (html) => extractFormFromHtml(html),
  );
}
