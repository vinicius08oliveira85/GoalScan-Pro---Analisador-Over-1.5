import type { TableRowGeral } from '../types';

const CLUB_CREST_PREFIX = /^club\s+crest\s+/i;

/** Remove prefixos comuns de exportação (ex.: "Club Crest Barcelona" → "Barcelona"). */
export function normalizeSquadName(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  return s.replace(CLUB_CREST_PREFIX, '').trim();
}

function isNdValue(v: unknown): boolean {
  if (v == null) return true;
  const t = String(v).trim();
  if (!t) return true;
  return /^#N\/[AD]$/i.test(t) || t === '#N/D' || t === '#N/A';
}

const LOOKUP_PREFIX = 'Lookup_';

/**
 * Sufixo após "Lookup_" que vira coluna própria na tabela única (planilha + JSON exportado).
 * Alinhado ao complemento Standard / exportações com PROCV.
 */
const LOOKUP_STRIP_TARGETS = new Set([
  '# Pl',
  'Age',
  'Poss',
  'Playing Time MP',
  'Playing Time Starts',
  'Playing Time Min',
  'Playing Time 90s',
  'Progression PrgC',
  'Progression PrgP',
  'Performance Gls',
  'Performance Ast',
  'Performance G+A',
  'Performance G-PK',
  'Performance PK',
  'Performance PKatt',
  'Performance CrdY',
  'Performance CrdR',
  'Per 90 Minutes Gls',
  'Per 90 Minutes Ast',
  'Per 90 Minutes G+A',
  'Per 90 Minutes G-PK',
  'Per 90 Minutes G+A-PK',
  'Per 90 Minutes xG+xAG',
  'Per 90 Minutes npxG+xAG',
  'Per 90 Minutes xAG',
]);

const STANDING_KEYS = [
  'Rk',
  'Squad',
  'MP',
  'W',
  'D',
  'L',
  'GF',
  'GA',
  'GD',
  'Pts',
  'Pts/MP',
  'xG',
  'xGA',
  'xGD',
  'xGD/90',
  'Last 5',
  'Attendance',
  'Top Team Scorer',
  'Goalkeeper',
  'Notes',
  'Status_B',
  'Home MP',
  'Home W',
  'Home D',
  'Home L',
  'Home GF',
  'Home GA',
  'Home GD',
  'Home Pts',
  'Home Pts/MP',
  'Home xG',
  'Home xGA',
  'Home xGD',
  'Home xGD/90',
  'Away MP',
  'Away W',
  'Away D',
  'Away L',
  'Away GF',
  'Away GA',
  'Away GD',
  'Away Pts',
  'Away Pts/MP',
  'Away xG',
  'Away xGA',
  'Away xGD',
  'Away xGD/90',
] as const;

const ALLOWED_KEYS = new Set<string>([...STANDING_KEYS, ...LOOKUP_STRIP_TARGETS]);

function trimRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim()] = v;
  }
  return out;
}

/**
 * Extrai do objeto bruto as chaves que não fazem parte do núcleo da classificação
 * (ex.: metadados desconhecidos), para persistir em extra_fields sem poluir a análise.
 */
export function extractImportExtras(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === 'importExtras') continue;
    if (key.startsWith(LOOKUP_PREFIX)) continue;
    if (ALLOWED_KEYS.has(key)) continue;
    if (isNdValue(val)) continue;
    out[key] = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? val : String(val);
  }
  return out;
}

/** Remove `importExtras` de cada linha antes de salvar em championship_tables ou exibir na grade. */
export function stripImportExtrasFromRows(rows: TableRowGeral[]): TableRowGeral[] {
  return rows.map((row) => stripImportExtrasFromRow(row)!);
}

/** Remove `importExtras` de uma linha (ex.: antes da análise Poisson). */
export function stripImportExtrasFromRow(row: TableRowGeral | undefined): TableRowGeral | undefined {
  if (!row) return undefined;
  const { importExtras: _ignored, ...rest } = row as TableRowGeral & { importExtras?: unknown };
  return rest as TableRowGeral;
}

/**
 * Limpa uma linha bruta: promove Lookup_* conhecidos, remove Lookup_*, valores #N/D, chaves não permitidas.
 */
export function cleanStandingRow(row: Record<string, unknown>): TableRowGeral {
  const merged: Record<string, unknown> = { ...row };

  for (const [key, val] of Object.entries(row)) {
    if (!key.startsWith(LOOKUP_PREFIX)) continue;
    const inner = key.slice(LOOKUP_PREFIX.length);
    if (!LOOKUP_STRIP_TARGETS.has(inner)) continue;
    if (isNdValue(val)) continue;
    merged[inner] = val;
  }

  const out: TableRowGeral = {} as TableRowGeral;

  for (const [key, val] of Object.entries(merged)) {
    if (key.startsWith(LOOKUP_PREFIX)) continue;
    if (!ALLOWED_KEYS.has(key)) continue;
    if (isNdValue(val)) continue;
    if (key === 'Squad') {
      out.Squad = normalizeSquadName(String(val));
    } else {
      (out as Record<string, string>)[key] = String(val).trim();
    }
  }

  return out;
}

function parseNumericField(v: string | undefined): number {
  if (v == null || v === '') return NaN;
  const n = Number.parseFloat(String(v).replace(/,/g, '').replace(/^\+/, ''));
  return Number.isFinite(n) ? n : NaN;
}

export type ParseLeagueJsonResult =
  | { ok: true; rows: TableRowGeral[] }
  | { ok: false; error: string };

function validateStandingNumbers(cleaned: TableRowGeral, squadLabel: string, index: number): string | null {
  const mp = parseNumericField(cleaned.MP);
  const gf = parseNumericField(cleaned.GF);
  const ga = parseNumericField(cleaned.GA);

  const homeMp = parseNumericField(cleaned['Home MP']);
  const awayMp = parseNumericField(cleaned['Away MP']);
  const homeGf = parseNumericField(cleaned['Home GF']);
  const homeGa = parseNumericField(cleaned['Home GA']);
  const awayGf = parseNumericField(cleaned['Away GF']);
  const awayGa = parseNumericField(cleaned['Away GA']);

  const validAgg = mp > 0 && Number.isFinite(gf) && Number.isFinite(ga);
  const validHomeAway =
    (homeMp > 0 || awayMp > 0) &&
    Number.isFinite(homeGf) &&
    Number.isFinite(homeGa) &&
    Number.isFinite(awayGf) &&
    Number.isFinite(awayGa);

  if (validAgg || validHomeAway) return null;

  return (
    `Item ${index} (${squadLabel}): informe totais agregados (MP, GF, GA) ou colunas Home/Away completas ` +
    '(Home MP, Home GF, Home GA, Away MP, Away GF, Away GA com valores numéricos).'
  );
}

/**
 * Valida e normaliza o array JSON da classificação (agregada e/ou Home/Away + colunas de lookup promovidas).
 */
export function parseAndNormalizeLeagueStandingJson(parsed: unknown): ParseLeagueJsonResult {
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'O JSON deve ser um array de objetos.' };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'O array está vazio.' };
  }

  const rows: TableRowGeral[] = [];
  let index = 0;
  for (const item of parsed) {
    index += 1;
    if (item == null || typeof item !== 'object') {
      return { ok: false, error: `Item ${index}: esperado objeto.` };
    }
    const raw = trimRowKeys(item as Record<string, unknown>);
    const squadRaw = raw.Squad;
    if (squadRaw == null || String(squadRaw).trim() === '') {
      return { ok: false, error: `Item ${index}: campo "Squad" obrigatório.` };
    }

    const cleaned = cleanStandingRow(raw);
    if (!cleaned.Squad) {
      return { ok: false, error: `Item ${index}: "Squad" inválido após normalização.` };
    }

    const msg = validateStandingNumbers(cleaned, cleaned.Squad, index);
    if (msg) {
      return { ok: false, error: msg };
    }

    const importExtras = extractImportExtras(raw);
    const rowWithExtras: TableRowGeral =
      Object.keys(importExtras).length > 0 ? { ...cleaned, importExtras } : cleaned;

    rows.push(rowWithExtras);
  }

  return { ok: true, rows };
}
