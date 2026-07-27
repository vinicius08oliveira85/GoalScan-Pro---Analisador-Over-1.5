import { logger } from '../utils/logger';

const FOOTYSTATS_API_URL = '/api/footystats-extract';

// CORS proxies gratuitos para fallback client-side
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

/**
 * Tenta extrair tabelas do HTML via DOMParser no navegador (client-side)
 * Usa um CORS proxy para contornar bloqueios
 */
async function parseHtmlClientSide(fullUrl: string): Promise<string | null> {
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

function extractStandingsFromHtml(html: string): FootyStatsStanding[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const tables = doc.querySelectorAll('table');
  let rows: NodeListOf<HTMLTableRowElement> | null = null;

  for (const table of tables) {
    const trs = table.querySelectorAll('tbody tr');
    if (trs.length >= 18) { rows = trs as NodeListOf<HTMLTableRowElement>; break; }
  }

  if (!rows || rows.length === 0) return [];

  const results: FootyStatsStanding[] = [];
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) continue;

    const entry: FootyStatsStanding = { Rk: '', Squad: '', MP: '', W: '', D: '', L: '', GF: '', GA: '', GD: '', Pts: '' };
    const squadEl = row.querySelector('td.team-name a, td.team-name span, td a');
    if (squadEl) entry.Squad = squadEl.textContent?.trim() || '';
    if (!entry.Squad) continue;

    const cellValues: string[] = [];
    cells.forEach(c => cellValues.push(c.textContent?.trim() || ''));

    entry.Rk = cellValues[0] || '';
    const colMap = ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'];
    const startIdx = 1;
    colMap.forEach((key, i) => {
      const val = cellValues[startIdx + i];
      if (val) (entry as any)[key] = val;
    });
    results.push(entry);
  }
  return results;
}

function extractFixturesFromHtml(html: string): FootyStatsMatch[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const matches: FootyStatsMatch[] = [];
  const seen = new Set<string>();

  const rows = doc.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;
    const text = row.textContent || '';
    const parts = text.split(/\s{3,}|\t+/).map(s => s.trim()).filter(Boolean);

    const teams = parts.filter(p => /^[A-Z][a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ\s]{2,}/.test(p) && p.length > 2);
    if (teams.length < 2) return;

    const home = teams[0], away = teams[teams.length - 1];
    const key = `${home}_${away}`;
    if (seen.has(key)) return;
    seen.add(key);

    const entry: FootyStatsMatch = { homeTeam: home, awayTeam: away };
    const scoreMatch = text.match(/(\d+)\s*[-–:]\s*(\d+)/);
    if (scoreMatch) entry.score = `${scoreMatch[1]}-${scoreMatch[2]}`;
    const htMatch = text.match(/\((\d+)[-–:](\d+)\)/);
    if (htMatch) entry.htScore = `${htMatch[1]}-${htMatch[2]}`;
    const dateMatch = text.match(/(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/);
    if (dateMatch) entry.date = dateMatch[1];
    matches.push(entry);
  });

  return matches;
}

function extractFormFromHtml(html: string): { last5: FootyStatsFormEntry[]; last10: FootyStatsFormEntry[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  const allRows: FootyStatsFormEntry[] = [];

  tables.forEach(table => {
    const trs = table.querySelectorAll('tbody tr');
    trs.forEach(row => {
      const squadEl = row.querySelector('td.team-name a, td.team-name span, td a');
      if (!squadEl) return;
      const entry: FootyStatsFormEntry = { Squad: squadEl.textContent?.trim() || '' };
      if (!entry.Squad) return;
      row.querySelectorAll('td').forEach((td, i) => {
        const val = td.textContent?.trim();
        if (val) entry[`col_${i}`] = val;
      });
      allRows.push(entry);
    });
  });

  if (allRows.length === 0) return { last5: [], last10: [] };
  if (allRows.length >= 40) {
    const mid = Math.floor(allRows.length / 2);
    return { last5: allRows.slice(0, mid), last10: allRows.slice(mid) };
  }
  return { last5: allRows, last10: [] };
}

async function callWithFallback<T>(
  url: string,
  pythonParser: (url: string) => Promise<FootyStatsResult<T>>,
  clientParser: (html: string) => T,
): Promise<FootyStatsResult<T>> {
  // Tenta Python API primeiro (Vercel)
  const pyResult = await pythonParser(url).catch(() => null);
  if (pyResult?.success && pyResult.data) return pyResult;

  // Fallback: client-side via CORS proxy
  logger.info('[FootyStats] Python falhou, tentando client-side via CORS proxy...');
  const html = await parseHtmlClientSide(url);
  if (!html) {
    return {
      success: false,
      error: pyResult?.error || 'Não foi possível acessar o FootyStats por nenhuma via. O site pode estar bloqueado.',
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
