#!/usr/bin/env node

/**
 * Script CLI para buscar dados do FBref e gerar JSON para importação.
 *
 * Uso:
 *   node scripts/fbref-import.mjs [URL]
 *   node scripts/fbref-import.mjs                          # usa URL padrão (Brasileirão 2025)
 *   node scripts/fbref-import.mjs https://fbref.com/en/comps/24/2024/2024-Serie-A-Stats
 *
 * Saída: JSON no stdout que pode ser salvo em arquivo:
 *   node scripts/fbref-import.mjs > data/fbref-seriea-2025.json
 */

const DEFAULT_URL = 'https://fbref.com/en/comps/24/2025/2025-Serie-A-Stats';

const url = process.argv[2] || DEFAULT_URL;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
};

async function fetchWithRetry(fetchUrl, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(fetchUrl, { headers: HEADERS, redirect: 'follow' });
      if (resp.status === 429) {
        const wait = delay * (i + 1) * 2;
        console.error(`[fbref-import] Rate limited (429). Aguardando ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return await resp.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = delay * (i + 1);
      console.error(`[fbref-import] Tentativa ${i + 1} falhou: ${err.message}. Retry em ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

function cleanSquadName(raw) {
  return raw.replace(/^Club Crest\s*/i, '').replace(/\s+/g, ' ').trim();
}

function parseTablesFromHtml(html) {
  const tables = [];
  const tableRegex = /<table[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  while ((match = tableRegex.exec(html)) !== null) {
    tables.push({ id: match[1], html: match[2] });
  }

  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  let cmatch;
  while ((cmatch = commentRegex.exec(html)) !== null) {
    const inner = cmatch[1];
    if (inner.includes('<table')) {
      let tmatch;
      const tregex = /<table[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/table>/gi;
      while ((tmatch = tregex.exec(inner)) !== null) {
        if (!tables.some((t) => t.id === tmatch[1])) {
          tables.push({ id: tmatch[1], html: tmatch[2] });
        }
      }
    }
  }
  return tables;
}

function parseRows(tableHtml) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  let isHeader = true;

  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const trContent = trMatch[1];

    if (/<th\b/.test(trContent) && isHeader) continue;
    if (/<\/thead>/i.test(trContent)) {
      isHeader = false;
      continue;
    }

    const cells = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(trContent)) !== null) {
      let text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      text = text.replace(/<sup[^>]*>.*?<\/sup>/gi, '').trim();
      cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseHeaders(tableHtml) {
  const theadMatch = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i);
  if (!theadMatch) return [];

  const lastRowMatch = theadMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!lastRowMatch || lastRowMatch.length === 0) return [];

  const lastRow = lastRowMatch[lastRowMatch.length - 1];
  const headers = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let thMatch;
  while ((thMatch = thRegex.exec(lastRow)) !== null {
    let text = thMatch[1].replace(/<[^>]+>/g, '').trim();
    text = text.replace(/\s+/g, ' ');
    headers.push(text);
  }
  return headers;
}

function rowsToObjects(headers, rows) {
  return rows.map((cells) => {
    const obj = {};
    cells.forEach((cell, i) => {
      if (i < headers.length) {
        obj[headers[i]] = cell;
      }
    });
    return obj;
  });
}

function extractChampionshipName(html) {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = h1Match[1].replace(/<[^>]+>/g, '').trim();
    const cleaned = text.replace(/^[\d-]+\s*/, '').replace(/\s*Stats\s*$/i, '').trim();
    if (cleaned) return cleaned;
  }
  return 'Campeonato Brasileiro';
}

function extractSeason(url) {
  const match = url.match(/\/(\d{4})-/);
  return match ? match[1] : String(new Date().getFullYear());
}

function mapStandingRows(rawObjects) {
  return rawObjects.map((raw, i) => {
    const squad = cleanSquadName(raw['Squad'] || '');
    const row = { Rk: String(i + 1), Squad: squad };

    const direct = ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Pts/MP',
      'xG', 'xGA', 'xGD', 'xGD/90', 'Last 5', 'Attendance',
      'Top Team Scorer', 'Goalkeeper', 'Notes'];
    for (const f of direct) {
      if (raw[f] !== undefined && raw[f] !== '') row[f] = raw[f];
    }

    const homeFields = ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Pts/MP', 'xG', 'xGA', 'xGD', 'xGD/90'];
    for (const f of homeFields) {
      const key = `Home ${f}`;
      if (raw[key] !== undefined && raw[key] !== '') row[key] = raw[key];
    }

    const awayFields = ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Pts/MP', 'xG', 'xGA', 'xGD', 'xGD/90'];
    for (const f of awayFields) {
      const key = `Away ${f}`;
      if (raw[key] !== undefined && raw[key] !== '') row[key] = raw[key];
    }

    return row;
  });
}

function mapComplementRows(rawObjects) {
  const fieldMap = {
    'Players': 'Pl', 'Squad Size': 'Pl',
    'Age': 'Age',
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
    'Gls/90': 'Per 90 Minutes Gls',
    'Ast/90': 'Per 90 Minutes Ast',
    'G+A/90': 'Per 90 Minutes G+A',
    'G-PK/90': 'Per 90 Minutes G-PK',
    'G+A-PK/90': 'Per 90 Minutes G+A-PK',
  };

  return rawObjects
    .map((raw) => {
      const squad = cleanSquadName(raw['Squad'] || '');
      if (!squad) return null;
      const row = { Squad: squad };
      for (const [fbref, app] of Object.entries(fieldMap)) {
        if (raw[fbref] !== undefined && raw[fbref] !== '') {
          row[app] = raw[fbref];
        }
      }
      return row;
    })
    .filter(Boolean);
}

function mergeHomeAway(overall, home, away) {
  const homeMap = new Map();
  const awayMap = new Map();
  home.forEach((r) => homeMap.set(cleanSquadName(r['Squad']), r));
  away.forEach((r) => awayMap.set(cleanSquadName(r['Squad']), r));

  return overall.map((raw) => {
    const squad = cleanSquadName(raw['Squad']);
    const h = homeMap.get(squad);
    const a = awayMap.get(squad);
    const merged = { ...raw };

    if (h) {
      for (const f of ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Pts/MP']) {
        merged[`Home ${f}`] = h[f] || '';
      }
    }
    if (a) {
      for (const f of ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Pts/MP']) {
        merged[`Away ${f}`] = a[f] || '';
      }
    }
    return merged;
  });
}

try {
  console.error(`[fbref-import] Buscando: ${url}`);
  const html = await fetchWithRetry(url);
  console.error(`[fbref-import] Recebido ${html.length} bytes`);

  const tables = parseTablesFromHtml(html);
  console.error(`[fbref-import] Encontradas ${tables.length} tabelas: ${tables.map((t) => t.id).join(', ')}`);

  const season = extractSeason(url);
  const championshipName = extractChampionshipName(html);

  let tableRows = [];
  let complementRows = [];

  const overallTable = tables.find((t) => /_overall/i.test(t.id));
  const homeTable = tables.find((t) => /_home/i.test(t.id));
  const awayTable = tables.find((t) => /_away/i.test(t.id));

  if (overallTable) {
    const headers = parseHeaders(overallTable.html);
    const rows = parseRows(overallTable.html);
    const rawObjects = rowsToObjects(headers, rows);

    if (homeTable && awayTable) {
      const homeHeaders = parseHeaders(homeTable.html);
      const awayHeaders = parseHeaders(awayTable.html);
      const homeRaw = rowsToObjects(homeHeaders, parseRows(homeTable.html));
      const awayRaw = rowsToObjects(awayHeaders, parseRows(awayTable.html));
      const merged = mergeHomeAway(rawObjects, homeRaw, awayRaw);
      tableRows = mapStandingRows(merged);
    } else {
      tableRows = mapStandingRows(rawObjects);
    }

    console.error(`[fbref-import] Standings: ${tableRows.length} times`);
  }

  const standardTable = tables.find((t) => /standard/i.test(t.id) || /stats/i.test(t.id));
  if (standardTable) {
    const headers = parseHeaders(standardTable.html);
    const rows = parseRows(standardTable.html);
    const rawObjects = rowsToObjects(headers, rows);
    complementRows = mapComplementRows(rawObjects);
    console.error(`[fbref-import] Complement: ${complementRows.length} times`);
  }

  const result = {
    championshipName,
    season,
    fbrefUrl: url,
    tableRows,
    complementRows,
    tableFormat: tableRows.some((r) => r['Home xG'] || r['Away xG']) ? 'completa' : 'basica',
  };

  process.stdout.write(JSON.stringify(result, null, 2));
  console.error(`[fbref-import] Concluído. ${tableRows.length} times, ${complementRows.length} complementos.`);
} catch (err) {
  console.error(`[fbref-import] ERRO: ${err.message}`);
  process.exit(1);
}
