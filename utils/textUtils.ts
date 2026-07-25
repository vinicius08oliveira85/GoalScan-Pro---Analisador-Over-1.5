/**
 * Normaliza texto para comparação: minúsculas, sem acentos, sem caracteres especiais.
 *
 * @example
 * ```ts
 * normalizeText('FC Barcelona') // 'fc barcelona'
 * normalizeText('Atlético Madrid') // 'atletico madrid'
 * ```
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
