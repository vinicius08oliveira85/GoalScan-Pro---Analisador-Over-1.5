/**
 * Converte um valor desconhecido para número de forma robusta.
 * Remove separadores de milhar, trata null/undefined/vazio, e retorna fallback.
 */
export function parseNumeric(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

  const raw = String(value).trim();
  if (!raw || raw === '-' || raw === 'N/A') return fallback;

  const normalized = raw.replace(/,/g, '').replace(/%/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : fallback;
}
