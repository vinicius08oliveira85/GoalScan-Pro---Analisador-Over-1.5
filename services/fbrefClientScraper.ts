import { logger } from '../utils/logger';
import type { FbrefExtractionResult } from './fbrefService';

function normalizeHeader(raw: string): string {
  if (!raw) return raw;
  const s = raw.replace(/\s+/g, ' ').trim();
  const lower = s.toLowerCase();

  const map: Record<string, string> = {
    rk: 'Rk',
    rank: 'Rk',
    squad: 'Squad',
    team: 'Squad',
    mp: 'MP',
    'matches played': 'MP',
    w: 'W',
    wins: 'W',
    d: 'D',
    draws: 'D',
    l: 'L',
    losses: 'L',
    gf: 'GF',
    'goals for': 'GF',
    ga: 'GA',
    'goals against': 'GA',
    gd: 'GD',
    'goal difference': 'GD',
    pts: 'Pts',
    points: 'Pts',
    'pts/mp': 'Pts/MP',
    xg: 'xG',
    xga: 'xGA',
    xgd: 'xGD',
    'xgd/90': 'xGD/90',
  };

  if (lower in map) return map[lower];

  if (/pts.*mp/i.test(lower)) return 'Pts/MP';
  if (/xgd.*90/i.test(lower)) return 'xGD/90';

  return s;
}

function removeSuffix(header: string): string {
  return header.replace(/_link$/i, '');
}

function extractHeaders(tableEl: HTMLTableElement): string[] {
  const thead = tableEl.querySelector('thead');
  if (!thead) return [];

  const rows = Array.from(thead.querySelectorAll('tr'));
  if (rows.length === 0) return [];

  let maxCols = 0;
  for (const row of rows) {
    let count = 0;
    for (const cell of Array.from(row.querySelectorAll('th, td'))) {
      count += parseInt(cell.getAttribute('colspan') || '1', 10);
    }
    maxCols = Math.max(maxCols, count);
  }

  const matrix: string[][] = Array.from({ length: rows.length }, () => Array(maxCols).fill(''));

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const cells = Array.from(rows[rIdx].querySelectorAll('th, td'));
    let cIdx = 0;

    for (const cell of cells) {
      while (cIdx < maxCols && matrix[rIdx][cIdx]) cIdx++;
      if (cIdx >= maxCols) break;

      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
      const text = cell.textContent?.trim() || '';

      for (let r = rIdx; r < Math.min(rIdx + rowspan, rows.length); r++) {
        for (let c = cIdx; c < Math.min(cIdx + colspan, maxCols); c++) {
          if (!matrix[r][c]) matrix[r][c] = text;
        }
      }
      cIdx += colspan;
    }
  }

  return Array.from({ length: maxCols }, (_, colIdx) => {
    const seen = new Set<string>();
    const parts: string[] = [];

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const val = matrix[rIdx][colIdx]?.trim();
      if (val && !seen.has(val)) {
        seen.add(val);
        parts.push(val);
      }
    }

    if (parts.length === 0) return `col_${colIdx}`;

    const last = parts[parts.length - 1];
    if (parts.length === 1) return normalizeHeader(last);

    const first = parts[0];
    const categories = ['Playing Time', 'Performance', 'Expected', 'Progression', 'Per 90 Minutes'];

    if (first && categories.includes(first) && last) {
      return normalizeHeader(`${first}_${last}`);
    }

    if (last && (last.includes('/') || last.startsWith('xG'))) {
      return normalizeHeader(last);
    }

    return normalizeHeader(`${first} ${last}`);
  });
}

function extractRows(tableEl: HTMLTableElement, headers: string[]): Record<string, string>[] {
  const tbody = tableEl.querySelector('tbody');
  const rows = Array.from(
    (tbody || tableEl).querySelectorAll('tr')
  ).filter((row) => {
    const cls = row.className || '';
    return !cls.includes('thead');
  });

  const data: Record<string, string>[] = [];

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td, th'));
    const rowObj: Record<string, string> = {};
    let cIdx = 0;

    for (const cell of cells) {
      if (cIdx >= headers.length) {
        while (cIdx >= headers.length) headers.push(`col_${headers.length}`);
      }

      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const text = cell.textContent?.trim() || '';
      const header = headers[cIdx] || `col_${cIdx}`;

      rowObj[header] = text;

      for (let i = 1; i < colspan; i++) {
        if (cIdx + i < headers.length) {
          rowObj[headers[cIdx + i]] = text;
        }
      }

      cIdx += colspan;
    }

    for (const h of headers) {
      if (!(h in rowObj)) rowObj[h] = '';
    }

    if (Object.keys(rowObj).length > 0) data.push(rowObj);
  }

  return data;
}

function findTableById(doc: Document, pattern: RegExp): HTMLTableElement | null {
  const tables = Array.from(doc.querySelectorAll('table.stats_table, table[id]'));
  for (const t of tables) {
    const id = t.getAttribute('id') || '';
    if (pattern.test(id)) return t as HTMLTableElement;
  }
  return null;
}

function findTable(doc: Document, type: string): HTMLTableElement | null {
  const patterns: Record<string, RegExp[]> = {
    geral: [/results.*_overall/i, /stats.*_overall/i],
    home_away: [/results.*_home_away/i, /stats.*_home_away/i, /home_away/i],
    standard_for: [/standard_for/i, /shooting/i],
  };

  const pList = patterns[type] || [];

  for (const p of pList) {
    const t = findTableById(doc, p);
    if (t) return t;
  }

  const allStats = Array.from(doc.querySelectorAll('table.stats_table')) as HTMLTableElement[];
  for (const t of allStats) {
    const id = (t.getAttribute('id') || '').toLowerCase();
    if (type === 'geral' && id.includes('_overall') && !id.includes('home_away')) return t;
    if (type === 'home_away' && id.includes('home_away')) return t;
    if (type === 'standard_for' && (id.includes('standard_for') || id.includes('shooting'))) return t;
  }

  return null;
}

const FBREF_HTML_PROXY_URL = '/api/fbref-html-proxy';

async function fetchViaProxy(url: string): Promise<string> {
  const response = await fetch(FBREF_HTML_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  const json = await response.json();
  const html = json.html;

  if (typeof html !== 'string' || html.length < 10000) {
    throw new Error('Resposta do proxy não contém HTML válido do FBref');
  }

  return html;
}

function parseHtml(html: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const title = doc.querySelector('title')?.textContent?.toLowerCase() || '';
  if (title.includes('error') || title.includes('not found') || title.includes('404')) {
    throw new Error(`Página retornou erro: ${doc.querySelector('title')?.textContent}`);
  }

  return doc;
}

function processTable(
  doc: Document,
  type: string
): { rows: Record<string, string>[]; headers: string[] } | null {
  const tableEl = findTable(doc, type);
  if (!tableEl) return null;

  let headers = extractHeaders(tableEl);
  if (headers.length === 0) {
    const firstRow = tableEl.querySelector('tr');
    if (firstRow) {
      headers = Array.from(firstRow.querySelectorAll('th, td')).map(
        (cell) => cell.textContent?.trim() || `col_0`
      );
    }
  }

  if (headers.length === 0) return null;

  const rawRows = extractRows(tableEl, [...headers]);

  const cleaned = rawRows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.endsWith('_link')) continue;
      out[removeSuffix(k)] = v;
    }
    return out;
  });

  return { rows: cleaned, headers };
}

export async function extractFbrefClientSide(
  url: string
): Promise<FbrefExtractionResult> {
  try {
    if (!url || !url.includes('fbref.com')) {
      return {
        success: false,
        error: 'URL inválida. Apenas URLs do fbref.com são permitidas.',
      };
    }

    logger.log('[FbrefClientScraper] Iniciando extração client-side para:', url);

    const html = await fetchViaProxy(url);
    logger.log(`[FbrefClientScraper] HTML recebido (${html.length} bytes)`);

    return parseFbrefHtml(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    logger.error('[FbrefClientScraper] Erro:', message);

    return {
      success: false,
      error: `Erro na extração client-side: ${message}`,
    };
  }
}

/**
 * Analisa conteúdo colado pelo usuário (modo "Colar HTML").
 * Suporta dois formatos:
 *  1. HTML cru (View Source → Ctrl+A → Ctrl+C)
 *  2. Texto visível (Ctrl+A no browser → Ctrl+C) — parse tabulado
 * Não requer rede.
 */
export function parseFbrefHtml(html: string): FbrefExtractionResult {
  try {
    if (!html || html.trim().length < 200) {
      return {
        success: false,
        error: 'Conteúdo muito curto. Copie toda a página do FBref.',
      };
    }

    const isHtml = html.includes('<table') || html.includes('<thead') || html.includes('<tbody');

    if (isHtml) {
      return parseAsHtml(html);
    }

    return parseAsText(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    logger.error('[FbrefClientScraper] Erro ao analisar conteúdo:', message);

    return {
      success: false,
      error: `Erro ao analisar conteúdo: ${message}`,
    };
  }
}

function parseAsHtml(html: string): FbrefExtractionResult {
  if (!html.includes('stats_table') && !html.includes('id="results')) {
    return {
      success: false,
      error: 'O HTML não parece ser uma página do FBref.',
    };
  }

  logger.log(`[FbrefClientScraper] Analisando HTML (${html.length} bytes)`);

  const doc = parseHtml(html);
  const geral = processTable(doc, 'geral');

  if (!geral || geral.rows.length === 0) {
    return {
      success: false,
      error: 'Nenhuma tabela de classificação encontrada no HTML.',
    };
  }

  logger.log(`[FbrefClientScraper] Extraído: ${geral.rows.length} linhas (geral) do HTML`);

  return {
    success: true,
    data: {
      tables: { geral: geral.rows },
      missingTables: [],
    },
  };
}

function parseAsText(text: string): FbrefExtractionResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const SECTION_PATTERNS: Array<{ key: string; pattern: RegExp; requiredHeaders: RegExp[] }> = [
    {
      key: 'geral',
      pattern: /^Overall\s*Home\/Away/i,
      requiredHeaders: [/squad/i, /mp|pts/i],
    },
    {
      key: 'standard',
      pattern: /^Squad Standard Stats/i,
      requiredHeaders: [/squad/i, /gls|goals/i],
    },
    {
      key: 'goalkeeping',
      pattern: /^Squad Goalkeeping/i,
      requiredHeaders: [/squad/i, /ga|saves|cs/i],
    },
    {
      key: 'shooting',
      pattern: /^Squad Shooting/i,
      requiredHeaders: [/squad/i, /shots?|sot/i],
    },
    {
      key: 'playing_time',
      pattern: /^Squad Playing Time/i,
      requiredHeaders: [/squad/i, /min|starts|compl/i],
    },
    {
      key: 'misc',
      pattern: /^Squad Miscellaneous Stats/i,
      requiredHeaders: [/squad/i, /crdy|crdr|fls|int|tklw/i],
    },
  ];

  const allTables: Record<string, Record<string, string>[]> = {};

  for (const section of SECTION_PATTERNS) {
    let headerLine = '';
    let dataStartIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (section.pattern.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          const line = lines[j];
          if (!line) continue;

          const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
          const hasHeaders = section.requiredHeaders.every((rh) =>
            parts.some((p) => rh.test(p))
          );

          if (hasHeaders) {
            headerLine = line;
            dataStartIdx = j + 1;
            break;
          }
        }
        break;
      }
    }

    if (!headerLine || dataStartIdx < 0) continue;

    const headers = headerLine.split('\t').map((h) => h.trim()).filter(Boolean);
    if (headers.length < 3) continue;

    const squadIdx = headers.findIndex((h) => /^squad$/i.test(h));

    const rows: Record<string, string>[] = [];

    for (let i = dataStartIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/^Totals? may not be/i.test(line)) break;
      if (/^View Player Stats|^Share & Export|^Modify|^Become a Stathead/i.test(line)) break;
      if (/^Squad (Standard|Goalkeeping|Shooting|Playing Time|Miscellaneous)/i.test(line)) break;
      if (/^Leaders|^Nationalities|^League Notes/i.test(line)) break;

      const parts = line.split('\t').map((p) => p.trim());

      if (parts.length < 3) continue;

      const row: Record<string, string> = {};
      for (let h = 0; h < headers.length; h++) {
        let val = parts[h] ?? '';

        if (h === squadIdx) {
          val = val.replace(/^Club Crest\s*/i, '').trim();
        }

        row[headers[h]] = val;
      }

      if (squadIdx >= 0 && row[headers[squadIdx]]) {
        rows.push(row);
      }
    }

    if (rows.length > 0) {
      allTables[section.key] = rows;
    }
  }

  if (Object.keys(allTables).length === 0) {
    return {
      success: false,
      error:
        'Nenhuma tabela encontrada no conteúdo copiado. Copie a página inteira do FBref (seção Overall + todas as estatísticas).',
    };
  }

  const counts = Object.entries(allTables)
    .map(([k, v]) => `${k}: ${v.length}`)
    .join(', ');

  logger.log(`[FbrefClientScraper] Extraído do texto: ${counts}`);

  return {
    success: true,
    data: {
      tables: allTables as Record<'geral', unknown[]>,
      missingTables: [],
    },
  };
}
