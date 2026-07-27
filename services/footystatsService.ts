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
  last5?: string;
  ppg?: string;
  cs?: string;
  btts?: string;
  xg?: string;
  over15?: string;
  over25?: string;
  avg?: string;
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

const HEADER_ALIASES: Record<string, string> = {
  '#': 'Rk', 'pos': 'Rk', 'position': 'Rk', 'rk': 'Rk',
  'team': 'Squad', 'club': 'Squad', 'equipe': 'Squad', 'time': 'Squad',
  'mp': 'MP', 'pld': 'MP', 'played': 'MP', 'j': 'MP',
  'w': 'W', 'win': 'W', 'vitorias': 'W',
  'd': 'D', 'draw': 'D', 'empates': 'D',
  'l': 'L', 'loss': 'L', 'derrotas': 'L',
  'gf': 'GF', 'goals for': 'GF', 'gols pro': 'GF',
  'ga': 'GA', 'goals against': 'GA', 'gols contra': 'GA',
  'gd': 'GD', 'goal diff': 'GD', 'saldo': 'GD',
  'pts': 'Pts', 'points': 'Pts', 'pontos': 'Pts',
  'last 5': 'last5', 'last 6': 'last5', 'form': 'last5',
  'ppg': 'ppg', 'pts/mp': 'ppg', 'pontos/j': 'ppg',
  'cs': 'cs', 'clean sheet': 'cs',
  'btts': 'btts', 'both teams': 'btts',
  'xgf': 'xg', 'x g': 'xg', 'expected goals': 'xg',
  '1.5+': 'over15', 'over 1.5': 'over15',
  '2.5+': 'over25', 'over 2.5': 'over25',
  'avg': 'avg', 'media': 'avg',
};

function normalizeHeader(text: string): string | null {
  const cleaned = text.replace(/[^a-zA-Z0-9+#.]/g, ' ').trim().toLowerCase();
  for (const [key, val] of Object.entries(HEADER_ALIASES)) {
    if (cleaned === key || cleaned.startsWith(key) || key.startsWith(cleaned)) {
      return val;
    }
  }
  return null;
}

function isPremiumLink(text: string): boolean {
  return text.includes('premium') || text.includes('footystats.org');
}

function extractStandingsFromTable(table: HTMLTableElement): FootyStatsStanding[] {
  const thead = table.querySelector('thead');
  const headerMap: number[] = [];
  const squadColIdx: number[] = [];

  if (thead) {
    const headerCells = thead.querySelectorAll('th, td');
    headerCells.forEach((cell, i) => {
      const text = cell.textContent?.trim() || '';
      const normalized = normalizeHeader(text);
      if (normalized) {
        if (normalized === 'Squad') squadColIdx.push(i);
        else headerMap.push(i);
      }
    });
  }

  const rows = table.querySelectorAll('tbody tr');
  const results: FootyStatsStanding[] = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;

    const entry: FootyStatsStanding = { Rk: '', Squad: '', MP: '', W: '', D: '', L: '', GF: '', GA: '', GD: '', Pts: '' };

    let squadFound = false;
    if (squadColIdx.length > 0) {
      for (const idx of squadColIdx) {
        if (idx < cells.length) {
          const a = cells[idx].querySelector('a');
          const name = (a || cells[idx]).textContent?.trim() || '';
          if (name && name.length > 2 && !isPremiumLink(name)) {
            entry.Squad = name;
            squadFound = true;
            break;
          }
        }
      }
    }

    if (!squadFound) {
      cells.forEach((cell, i) => {
        const a = cell.querySelector('a');
        if (!a) return;
        const name = a.textContent?.trim() || '';
        if (name && name.length > 2 && !isPremiumLink(name)) {
          const isNumeric = /^\d/.test(name);
          if (!isNumeric) {
            entry.Squad = name;
            squadFound = true;
          }
        }
      });
    }

    if (!squadFound) return;

    if (headerMap.length > 0) {
      headerMap.forEach(h => {
        const val = cells[h]?.textContent?.trim() || '';
        if (!val || isPremiumLink(val)) return;
        const headerText = thead?.querySelectorAll('th, td')[h]?.textContent?.trim() || '';
        const key = normalizeHeader(headerText);
        if (key && key !== 'Squad' && key !== 'Rk') {
          (entry as any)[key] = val;
        }
      });
    } else {
      const textValues: string[] = [];
      cells.forEach(c => {
        const t = c.textContent?.trim() || '';
        if (!isPremiumLink(t)) textValues.push(t);
      });

      const numericCols = ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'];
      let dataIdx = 0;
      for (let i = 0; i < textValues.length && dataIdx < numericCols.length; i++) {
        if (textValues[i] === entry.Squad) continue;
        if (/^\d/.test(textValues[i]) || textValues[i] === '0') {
          (entry as any)[numericCols[dataIdx]] = textValues[i];
          dataIdx++;
        }
      }
    }

    results.push(entry);
  });

  return results;
}

function extractStandingsFromHtml(html: string): FootyStatsStanding[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');

  for (const table of tables) {
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length >= 18) {
      const result = extractStandingsFromTable(table);
      if (result.length >= 18) return result;
    }
  }
  for (const table of tables) {
    const result = extractStandingsFromTable(table);
    if (result.length > 0) return result;
  }
  return [];
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

    const teamLinks: string[] = [];
    cells.forEach(cell => {
      const a = cell.querySelector('a');
      if (!a) return;
      const name = a.textContent?.trim() || '';
      if (name.length > 2 && !isPremiumLink(name) && !/^\d/.test(name)) {
        teamLinks.push(name);
      }
    });

    if (teamLinks.length < 2) return;
    const home = teamLinks[0], away = teamLinks[teamLinks.length - 1];
    const key = `${home}_${away}`;
    if (seen.has(key)) return;
    seen.add(key);

    const text = row.textContent || '';
    const entry: FootyStatsMatch = { homeTeam: home, awayTeam: away };

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
  const allTables = doc.querySelectorAll('table');
  const tables: FootyStatsFormEntry[][] = [];

  allTables.forEach(table => {
    const entries: FootyStatsFormEntry[] = [];
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length < 5) return;

    rows.forEach(row => {
      const a = row.querySelector('td a');
      if (!a) return;
      const name = a.textContent?.trim() || '';
      if (!name || name.length < 3 || isPremiumLink(name)) return;

      const entry: FootyStatsFormEntry = { Squad: name };
      row.querySelectorAll('td').forEach((td, i) => {
        const val = td.textContent?.trim() || '';
        if (val && !isPremiumLink(val)) entry[`col_${i}`] = val;
      });
      entries.push(entry);
    });

    if (entries.length > 0) tables.push(entries);
  });

  if (tables.length >= 2) return { last5: tables[0], last10: tables[1] };
  if (tables.length === 1 && tables[0].length >= 20) {
    const mid = Math.floor(tables[0].length / 2);
    return { last5: tables[0].slice(0, mid), last10: tables[0].slice(mid) };
  }
  if (tables.length === 1) return { last5: tables[0], last10: [] };
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
