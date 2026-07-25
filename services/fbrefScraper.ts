import type { TableRowGeral, TableRowComplement, ChampionshipTable, TableFormat } from '../types';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { parseAndNormalizeLeagueStandingJson } from '../utils/leagueStandingJson';

export interface FbrefScrapeResult {
  championshipName: string;
  season: string;
  fbrefUrl: string;
  tableRows: TableRowGeral[];
  complementRows: TableRowComplement[];
  tableFormat: TableFormat;
}

function parseHtml(rawHtml: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(rawHtml, 'text/html');
}

function uncommentHiddenTables(doc: Document): void {
  const comments = doc.body.querySelectorAll('comment');
  comments.forEach((comment) => {
    const text = comment.textContent || '';
    if (text.includes('<table') && (text.includes('id="') || text.includes('id ='))) {
      const wrapper = doc.createElement('div');
      wrapper.innerHTML = text;
      comment.replaceWith(...Array.from(wrapper.childNodes));
    }
  });
}

function extractTableHeaders(table: HTMLTableElement): string[] {
  const headers: string[] = [];
  const thElements = table.querySelectorAll('thead tr:last-child th, thead tr th');
  thElements.forEach((th) => {
    const text = (th.textContent || '').trim().replace(/\s+/g, ' ');
    headers.push(text);
  });
  return headers;
}

function extractTableRows(table: HTMLTableElement, headers: string[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const tbody = table.querySelector('tbody');
  if (!tbody) return rows;

  const trElements = tbody.querySelectorAll('tr:not(.thead)');
  trElements.forEach((tr) => {
    const cells = tr.querySelectorAll('td, th');
    const row: Record<string, string> = {};
    cells.forEach((cell, i) => {
      if (i < headers.length) {
        row[headers[i]] = (cell.textContent || '').trim();
      }
    });
    if (row['Squad'] || row['Rk']) {
      rows.push(row);
    }
  });
  return rows;
}

function findTableByPattern(doc: Document, pattern: RegExp): HTMLTableElement | null {
  const tables = doc.querySelectorAll('table');
  for (const table of tables) {
    const id = table.getAttribute('id') || '';
    if (pattern.test(id)) return table;
  }
  return null;
}

function findTableByHeaders(doc: Document, requiredHeaders: string[]): HTMLTableElement | null {
  const tables = doc.querySelectorAll('table');
  for (const table of tables) {
    const headers = extractTableHeaders(table);
    const headerText = headers.join(' ').toLowerCase();
    if (requiredHeaders.every((h) => headerText.includes(h))) {
      return table;
    }
  }
  return null;
}

function cleanSquadName(raw: string): string {
  return raw.replace(/^Club Crest\s*/i, '').replace(/\s+/g, ' ').trim();
}

function mapStandingRow(raw: Record<string, string>, rank: number): TableRowGeral {
  const squad = cleanSquadName(raw['Squad'] || '');
  const row: TableRowGeral = {
    Rk: String(rank),
    Squad: squad,
  };

  const fieldMap: Record<string, string> = {
    'MP': 'MP', 'W': 'W', 'D': 'D', 'L': 'L',
    'GF': 'GF', 'GA': 'GA', 'GD': 'GD',
    'Pts': 'Pts', 'Pts/MP': 'Pts/MP',
    'xG': 'xG', 'xGA': 'xGA', 'xGD': 'xGD', 'xGD/90': 'xGD/90',
    'Last 5': 'Last 5', 'Attendance': 'Attendance',
    'Top Team Scorer': 'Top Team Scorer', 'Goalkeeper': 'Goalkeeper',
    'Notes': 'Notes',
  };

  for (const [fbrefCol, appCol] of Object.entries(fieldMap)) {
    const val = raw[fbrefCol];
    if (val !== undefined && val !== '') {
      (row as Record<string, unknown>)[appCol] = val;
    }
  }

  const homeMap: Record<string, string> = {
    'Home MP': 'Home MP', 'Home W': 'Home W', 'Home D': 'Home D',
    'Home L': 'Home L', 'Home GF': 'Home GF', 'Home GA': 'Home GA',
    'Home GD': 'Home GD', 'Home Pts': 'Home Pts', 'Home Pts/MP': 'Home Pts/MP',
    'Home xG': 'Home xG', 'Home xGA': 'Home xGA',
    'Home xGD': 'Home xGD', 'Home xGD/90': 'Home xGD/90',
  };

  for (const [fbrefCol, appCol] of Object.entries(homeMap)) {
    const val = raw[fbrefCol];
    if (val !== undefined && val !== '') {
      (row as Record<string, unknown>)[appCol] = val;
    }
  }

  const awayMap: Record<string, string> = {
    'Away MP': 'Away MP', 'Away W': 'Away W', 'Away D': 'Away D',
    'Away L': 'Away L', 'Away GF': 'Away GF', 'Away GA': 'Away GA',
    'Away GD': 'Away GD', 'Away Pts': 'Away Pts', 'Away Pts/MP': 'Away Pts/MP',
    'Away xG': 'Away xG', 'Away xGA': 'Away xGA',
    'Away xGD': 'Away xGD', 'Away xGD/90': 'Away xGD/90',
  };

  for (const [fbrefCol, appCol] of Object.entries(awayMap)) {
    const val = raw[fbrefCol];
    if (val !== undefined && val !== '') {
      (row as Record<string, unknown>)[appCol] = val;
    }
  }

  return row;
}

function mapComplementRow(raw: Record<string, string>): TableRowComplement | null {
  const squad = cleanSquadName(raw['Squad'] || '');
  if (!squad) return null;

  const row: TableRowComplement = { Squad: squad };

  const fieldMap: Record<string, keyof TableRowComplement> = {
    'Players': 'Pl', 'Squad Size': 'Pl',
    'Age': 'Avg Age',
    'Poss': 'Poss',
    'MP': 'Playing Time MP',
    'Starts': 'Playing Time Starts',
    'Min': 'Playing Time Min',
    '90s': 'Playing Time 90s',
    'Gls': 'Performance Gls',
    'Ast': 'Performance Ast',
    'G+A': 'Performance G+A',
    'G-PK': 'Performance G-PK',
    'PK': 'Performance PK',
    'PKatt': 'Performance PKatt',
    'CrdY': 'Performance CrdY',
    'CrdR': 'Performance CrdR',
    'Gls.1': 'Per 90 Minutes Gls',
    'Ast.1': 'Per 90 Minutes Ast',
    'G+A.1': 'Per 90 Minutes G+A',
    'G-PK.1': 'Per 90 Minutes G-PK',
    'G+A-PK': 'Per 90 Minutes G+A-PK',
  };

  for (const [fbrefCol, appCol] of Object.entries(fieldMap)) {
    const val = raw[fbrefCol];
    if (val !== undefined && val !== '' && appCol in row) {
      (row as Record<string, unknown>)[appCol] = val;
    }
  }

  if (raw['Pl']) (row as Record<string, unknown>)['Pl'] = raw['Pl'];
  if (raw['Age']) (row as Record<string, unknown>)['Age'] = raw['Age'];

  return row;
}

function mergeHomeAwayIntoStanding(
  overallRows: Record<string, string>[],
  homeRows: Record<string, string>[],
  awayRows: Record<string, string>[]
): TableRowGeral[] {
  const homeMap = new Map<string, Record<string, string>>();
  const awayMap = new Map<string, Record<string, string>>();
  homeRows.forEach((r) => homeMap.set(cleanSquadName(r['Squad']), r));
  awayRows.forEach((r) => awayMap.set(cleanSquadName(r['Squad']), r));

  return overallRows.map((raw, i) => {
    const squad = cleanSquadName(raw['Squad']);
    const home = homeMap.get(squad);
    const away = awayMap.get(squad);

    const merged: Record<string, string> = { ...raw };

    if (home) {
      merged['Home MP'] = home['MP'] || '';
      merged['Home W'] = home['W'] || '';
      merged['Home D'] = home['D'] || '';
      merged['Home L'] = home['L'] || '';
      merged['Home GF'] = home['GF'] || '';
      merged['Home GA'] = home['GA'] || '';
      merged['Home GD'] = home['GD'] || '';
      merged['Home Pts'] = home['Pts'] || '';
    }

    if (away) {
      merged['Away MP'] = away['MP'] || '';
      merged['Away W'] = away['W'] || '';
      merged['Away D'] = away['D'] || '';
      merged['Away L'] = away['L'] || '';
      merged['Away GF'] = away['GF'] || '';
      merged['Away GA'] = away['GA'] || '';
      merged['Away GD'] = away['GD'] || '';
      merged['Away Pts'] = away['Pts'] || '';
    }

    return mapStandingRow(merged, i + 1);
  });
}

function extractSeasonFromUrl(url: string): string {
  const match = url.match(/\/(\d{4})-/);
  return match ? match[1] : String(new Date().getFullYear());
}

function extractNameFromDoc(doc: Document): string {
  const h1 = doc.querySelector('h1');
  if (h1) {
    const text = (h1.textContent || '').trim();
    const cleaned = text.replace(/^[\d-]+\s*/, '').replace(/\s*Stats\s*$/i, '').trim();
    if (cleaned) return cleaned;
  }
  return 'Campeonato Brasileiro';
}

export function parseFbrefHtml(html: string, url: string): FbrefScrapeResult {
  const doc = parseHtml(html);
  uncommentHiddenTables(doc);

  const season = extractSeasonFromUrl(url);
  const championshipName = extractNameFromDoc(doc);

  let tableRows: TableRowGeral[] = [];
  let complementRows: TableRowComplement[] = [];

  const overallTable = findTableByPattern(doc, /_overall/i)
    || findTableByHeaders(doc, ['squad', 'mp', 'pts']);
  if (overallTable) {
    const headers = extractTableHeaders(overallTable);
    const rawRows = extractTableRows(overallTable, headers);

    const homeTable = findTableByPattern(doc, /_home/i);
    const awayTable = findTableByPattern(doc, /_away/i);

    if (homeTable && awayTable) {
      const homeHeaders = extractTableHeaders(homeTable);
      const awayHeaders = extractTableHeaders(awayTable);
      const homeRaw = extractTableRows(homeTable, homeHeaders);
      const awayRaw = extractTableRows(awayTable, awayHeaders);
      tableRows = mergeHomeAwayIntoStanding(rawRows, homeRaw, awayRaw);
    } else {
      tableRows = rawRows.map((r, i) => mapStandingRow(r, i + 1));
    }
  }

  const complementTable = findTableByHeaders(doc, ['squad', 'poss']) || findTableByPattern(doc, /standard/i);
  if (complementTable) {
    const headers = extractTableHeaders(complementTable);
    const rawRows = extractTableRows(complementTable, headers);
    complementRows = rawRows.map(mapComplementRow).filter(Boolean) as TableRowComplement[];
  }

  const tableFormat = detectTableFormatFromData(tableRows);

  return { championshipName, season, fbrefUrl: url, tableRows, complementRows, tableFormat };
}

export async function fetchFbrefPage(url: string, proxyUrl?: string): Promise<string> {
  const targetUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar página: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function buildChampionshipTableFromScrape(
  championshipId: string,
  tableRows: TableRowGeral[],
  tableFormat: TableFormat
): ChampionshipTable {
  return {
    id: crypto.randomUUID(),
    championship_id: championshipId,
    table_type: 'geral',
    table_name: 'Classificação',
    table_data: tableRows,
  };
}
