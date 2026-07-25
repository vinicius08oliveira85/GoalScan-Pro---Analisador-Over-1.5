/**
 * JSON.parse seguro que retorna null em vez de throw em dados inválidos.
 *
 * @example
 * ```ts
 * const data = safeJsonParse<{ id: string }>(localStorage.getItem('item'));
 * if (data) { /* usar data *\/ }
 * ```
 */
export function safeJsonParse<T = unknown>(
  raw: string | null | undefined,
  validator?: (parsed: unknown) => parsed is T,
): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validator) {
      return validator(parsed) ? parsed : null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}
