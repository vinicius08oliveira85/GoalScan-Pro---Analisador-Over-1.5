/** Limiares apenas para rótulos de interface (não afetam cálculos). */
export type Over15VerdictLabel = 'ALTA PROBABILIDADE' | 'PROBABILIDADE MÉDIA' | 'BAIXA PROBABILIDADE';

export function getOver15VerdictLabel(probabilityPercent: number): {
  label: Over15VerdictLabel;
  badgeClass: string;
} {
  if (probabilityPercent >= 65) {
    return { label: 'ALTA PROBABILIDADE', badgeClass: 'badge-success' };
  }
  if (probabilityPercent >= 45) {
    return { label: 'PROBABILIDADE MÉDIA', badgeClass: 'badge-warning' };
  }
  return { label: 'BAIXA PROBABILIDADE', badgeClass: 'badge-error' };
}
