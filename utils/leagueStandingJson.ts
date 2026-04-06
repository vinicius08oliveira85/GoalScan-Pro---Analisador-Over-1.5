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

const ALLOWED_KEYS = new Set([
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
  'Last 5',
  'Attendance',
  'Top Team Scorer',
  'Goalkeeper',
  'Notes',
  'Status_B',
]);

/**
 * Extrai do objeto bruto as chaves que não fazem parte do núcleo da classificação
 * (ex.: Lookup_*), para persistir em extra_fields sem poluir a tabela nem a análise.
 */
export function extractImportExtras(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === 'importExtras') continue;
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
 * Limpa uma linha bruta do JSON: remove Lookup_*, valores #N/D, chaves desconhecidas.
 */
export function cleanStandingRow(row: Record<string, unknown>): TableRowGeral {
  const out: TableRowGeral = {} as TableRowGeral;

  for (const [key, val] of Object.entries(row)) {
    if (key.startsWith('Lookup_')) continue;
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

/**
 * Valida e normaliza o array JSON da classificação agregada da liga.
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
    const raw = item as Record<string, unknown>;
    const squadRaw = raw.Squad;
    if (squadRaw == null || String(squadRaw).trim() === '') {
      return { ok: false, error: `Item ${index}: campo "Squad" obrigatório.` };
    }

    const cleaned = cleanStandingRow(raw);
    if (!cleaned.Squad) {
      return { ok: false, error: `Item ${index}: "Squad" inválido após normalização.` };
    }

    const mp = parseNumericField(cleaned.MP);
    const gf = parseNumericField(cleaned.GF);
    const ga = parseNumericField(cleaned.GA);
    if (!(mp > 0) || !Number.isFinite(gf) || !Number.isFinite(ga)) {
      return {
        ok: false,
        error: `Item ${index} (${cleaned.Squad}): "MP", "GF" e "GA" devem ser numéricos válidos (MP > 0).`,
      };
    }

    const importExtras = extractImportExtras(raw);
    const rowWithExtras: TableRowGeral =
      Object.keys(importExtras).length > 0 ? { ...cleaned, importExtras } : cleaned;

    rows.push(rowWithExtras);
  }

  return { ok: true, rows };
}
