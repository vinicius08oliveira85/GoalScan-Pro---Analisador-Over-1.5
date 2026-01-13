/**
 * Helpers numéricos para inputs de banca (pt-BR) e multiplicadores (leverage).
 * Mantemos separado para evitar duplicação e reduzir tamanho dos componentes.
 */

export function formatMoneyPtBr(value: number): string {
  if (!Number.isFinite(value)) return '0,00';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Parse de moeda estilo pt-BR: '.' como milhar e ',' como decimal.
 * Ex.: "1.234,56" -> 1234.56
 */
export function parseMoneyPtBr(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Parse de decimal flexível: aceita "1.23" e "1,23".
 * Se vier "1.234,56" (pt-BR), trata '.' como milhar e ',' como decimal.
 */
export function parseDecimalFlexible(value: string): number {
  const cleaned = value.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }
  return parseFloat(normalized) || 0;
}

export function clampLeverage(value: number): number {
  if (!Number.isFinite(value)) return 1.0;
  return Math.min(10.0, Math.max(0.1, value));
}

export function formatLeveragePtBr(value: number): string {
  return clampLeverage(value).toFixed(2).replace('.', ',');
}

export function normalizeLeverageForSettings(value: number): number | undefined {
  const clamped = clampLeverage(value);
  if (Math.abs(clamped - 1.0) < 1e-9) return undefined;
  return Number(clamped.toFixed(2));
}


