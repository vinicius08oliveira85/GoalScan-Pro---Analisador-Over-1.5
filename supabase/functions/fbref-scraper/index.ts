// Usar o runtime nativo do Deno (evita dependência externa do std em deploys)

// Tipos
interface ExtractRequest {
  championshipUrl: string;
  championshipId: string;
  extractTypes: ('table' | 'matches' | 'team-stats' | 'all')[];
}

type FbrefTableType = 'geral' | 'standard_for' | 'passing_for' | 'gca_for';

interface ExtractionResult {
  success: boolean;
  data?: {
    tables?: Record<FbrefTableType, unknown[]>;
    missingTables?: FbrefTableType[];
    matches?: unknown[];
    teamStats?: unknown[];
  };
  error?: string;
}

// Headers mínimos e “seguros” para o runtime do Edge (Fetch spec bloqueia vários headers).
// Evitar: Accept-Encoding, Connection, Referer, Sec-Fetch-*, Upgrade-Insecure-Requests, etc.
const SAFE_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
};

// Alguns sites bloqueiam o UA padrão do Deno; tentamos aplicar um UA “browser-like”.
// Caso o runtime bloqueie `User-Agent`, fazemos fallback automático para SAFE_HEADERS.
const UA_HEADERS = {
  ...SAFE_HEADERS,
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Delay entre requisições (respeitar rate limit)
const DELAY_MS = 3000; // 3 segundos

// Validar URL do fbref.com
function isValidFbrefUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'fbref.com' || urlObj.hostname.endsWith('.fbref.com');
  } catch {
    return false;
  }
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TABLE_ID_CANDIDATES: Record<FbrefTableType, Array<string | RegExp>> = {
  // “Geral” (classificação): o id muda por competição/temporada, mas termina em _overall.
  // Exemplos comuns: stats_results_2025-2026_111_overall, results2025-2026111_overall, results_..._overall
  geral: [/^stats_results_.*_overall$/i, /^results.*_overall$/i, /_overall$/i],
  standard_for: ['stats_squads_standard_for', /standard_for$/i],
  passing_for: ['stats_squads_passing_for', /passing_for$/i],
  gca_for: ['stats_squads_gca_for', /gca_for$/i],
};

function decodeHtmlEntities(input: string): string {
  // Decoder simples (suficiente para chaves/valores comuns do FBref)
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

function stripTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, '').trim());
}

function normalizeHeaderKey(header: string): string {
  const h = header.replace(/\s+/g, ' ').trim();
  // Normalizações pontuais mantendo compatibilidade com export do FBref
  if (/^pts\s*\/\s*mp$/i.test(h)) return 'Pts/MP';
  if (/^xgd\s*\/\s*90$/i.test(h)) return 'xGD/90';
  return h;
}

function collectTablesById(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const tableRegex = /<table[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/table>/gi;
  for (const match of html.matchAll(tableRegex)) {
    const id = match[1];
    const tableHtml = match[0];
    if (id && tableHtml) map.set(id, tableHtml);
  }
  return map;
}

function findTableHtml(
  allTables: Map<string, string>,
  type: FbrefTableType
): { id: string; html: string } | null {
  const candidates = TABLE_ID_CANDIDATES[type] || [];
  for (const cand of candidates) {
    if (typeof cand === 'string') {
      const html = allTables.get(cand);
      if (html) return { id: cand, html };
      continue;
    }

    // RegExp: procurar o primeiro id compatível
    for (const [id, html] of allTables.entries()) {
      if (cand.test(id)) {
        // Evitar pegar tabela home_away por engano no “geral”
        if (type === 'geral' && /home_away/i.test(id)) continue;
        return { id, html };
      }
    }
  }
  return null;
}

function extractSection(tableHtml: string, tag: 'thead' | 'tbody'): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = tableHtml.match(re);
  return m && m[1] ? m[1] : null;
}

function extractTrBlocks(sectionHtml: string): string[] {
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  return Array.from(sectionHtml.matchAll(trRegex)).map((m) => m[1] ?? '').filter(Boolean);
}

type CellDesc = { text: string; colspan: number; rowspan: number };

function extractHeaderCells(trHtml: string): CellDesc[] {
  const cellRegex = /<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi;
  const cells: CellDesc[] = [];
  for (const m of trHtml.matchAll(cellRegex)) {
    const attrs = m[2] ?? '';
    const inner = m[3] ?? '';

    const colspan = Number.parseInt((attrs.match(/colspan="(\d+)"/i)?.[1] ?? '1'), 10);
    const rowspan = Number.parseInt((attrs.match(/rowspan="(\d+)"/i)?.[1] ?? '1'), 10);

    const text = stripTags(inner).replace(/\s+/g, ' ').trim();
    if (!text) continue;

    cells.push({
      text,
      colspan: Number.isFinite(colspan) && colspan > 0 ? colspan : 1,
      rowspan: Number.isFinite(rowspan) && rowspan > 0 ? rowspan : 1,
    });
  }
  return cells;
}

function buildHeadersFromThead(theadHtml: string): string[] {
  const rows = extractTrBlocks(theadHtml);
  if (rows.length === 0) return [];

  const headerRows = rows.map(extractHeaderCells);
  const maxCols = Math.max(
    0,
    ...headerRows.map((r) => r.reduce((sum, c) => sum + (c.colspan || 1), 0))
  );
  if (maxCols <= 0) return [];

  const matrix: string[][] = Array.from({ length: rows.length }, () =>
    Array.from({ length: maxCols }, () => '')
  );

  for (let r = 0; r < headerRows.length; r++) {
    let cIdx = 0;
    for (const cell of headerRows[r]) {
      while (cIdx < maxCols && matrix[r][cIdx]) cIdx++;
      if (cIdx >= maxCols) break;

      for (let rr = r; rr < Math.min(rows.length, r + cell.rowspan); rr++) {
        for (let cc = cIdx; cc < Math.min(maxCols, cIdx + cell.colspan); cc++) {
          if (!matrix[rr][cc]) matrix[rr][cc] = cell.text;
        }
      }

      cIdx += cell.colspan;
    }
  }

  const headers: string[] = [];
  for (let col = 0; col < maxCols; col++) {
    const parts: string[] = [];
    for (let row = 0; row < matrix.length; row++) {
      const t = (matrix[row][col] || '').trim();
      if (!t) continue;
      if (!parts.includes(t)) parts.push(t);
    }

    const combined = normalizeHeaderKey(parts.join(' ').replace(/\s+/g, ' ').trim());
    headers.push(combined || `col_${col}`);
  }

  return headers;
}

function extractRowCells(trHtml: string): string[] {
  // No tbody, o Squad e/ou Rk costuma vir em <th scope="row">, então lemos th+td em ordem
  const cellRegex = /<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi;
  const cells: string[] = [];
  for (const m of trHtml.matchAll(cellRegex)) {
    const inner = m[3] ?? '';
    const text = stripTags(inner).replace(/\s+/g, ' ').trim();
    cells.push(text);
  }
  return cells;
}

function parseTableHtml(tableHtml: string): unknown[] {
  const thead = extractSection(tableHtml, 'thead');
  const tbody = extractSection(tableHtml, 'tbody');

  const headers = thead ? buildHeadersFromThead(thead) : [];
  if (!tbody) return [];

  const rows: unknown[] = [];
  const trBlocks = extractTrBlocks(tbody);
  for (const trHtml of trBlocks) {
    const cells = extractRowCells(trHtml);
    if (cells.length === 0) continue;

    const row: Record<string, unknown> = {};
    const max = Math.min(headers.length, cells.length);

    for (let i = 0; i < max; i++) {
      const key = headers[i] || `col_${i}`;
      row[key] = cells[i];
    }

    // Campo mínimo para união (Squad) — ignorar linhas que não representem times
    const squad = row.Squad;
    if (typeof squad !== 'string' || !squad.trim()) continue;

    rows.push(row);
  }

  return rows;
}

async function fetchHtml(url: string): Promise<string> {
  // Validar URL
  if (!isValidFbrefUrl(url)) {
    throw new Error('URL inválida. Apenas URLs do fbref.com são permitidas.');
  }

  // Fazer requisição com delay (rate limit)
  await delay(DELAY_MS);

  let response: Response;
  try {
    response = await fetch(url, { headers: UA_HEADERS });
  } catch (e) {
    // Possível erro: forbidden header name (User-Agent). Fallback para headers mínimos.
    response = await fetch(url, { headers: SAFE_HEADERS });
    if (e) console.warn('[fbref-scraper] fetch with UA failed, retrying with SAFE_HEADERS:', e);
  }
  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

async function extractTablesFromUrl(url: string): Promise<{
  tables: Record<FbrefTableType, unknown[]>;
  missingTables: FbrefTableType[];
}> {
  const html = await fetchHtml(url);
  const allTables = collectTablesById(html);

  const tables: Record<FbrefTableType, unknown[]> = {
    geral: [],
    standard_for: [],
    passing_for: [],
    gca_for: [],
  };
  const missing: FbrefTableType[] = [];

  (Object.keys(tables) as FbrefTableType[]).forEach((type) => {
    const found = findTableHtml(allTables, type);
    if (!found) {
      missing.push(type);
      return;
    }

    const parsed = parseTableHtml(found.html);
    if (!parsed || parsed.length === 0) {
      missing.push(type);
      return;
    }

    tables[type] = parsed;
  });

  return { tables, missingTables: missing };
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ExtractRequest = await req.json();

    // Validar request
    if (!body.championshipUrl || !body.championshipId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'championshipUrl e championshipId são obrigatórios',
        } as ExtractionResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validar URL
    if (!isValidFbrefUrl(body.championshipUrl)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'URL inválida. Apenas URLs do fbref.com são permitidas.',
        } as ExtractionResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result: ExtractionResult = {
      success: true,
      data: {},
    };

    // Extrair tabela se solicitado
    if (body.extractTypes.includes('table') || body.extractTypes.includes('all')) {
      try {
        const extracted = await extractTablesFromUrl(body.championshipUrl);
        result.data!.tables = extracted.tables;
        result.data!.missingTables = extracted.missingTables;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[fbref-scraper] Erro ao extrair tabelas:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro ao extrair tabelas: ${message}`,
          } as ExtractionResult),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // TODO: Implementar extração de jogos e estatísticas de times nas próximas fases

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[fbref-scraper] Erro inesperado:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      } as ExtractionResult),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

