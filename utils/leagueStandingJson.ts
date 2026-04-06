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

    rows.push(cleaned);
  }

  return { ok: true, rows };
}
