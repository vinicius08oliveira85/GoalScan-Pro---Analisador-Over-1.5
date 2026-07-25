export type ClassValue = string | undefined | null | false;

/**
 * Pequeno helper para compor classNames sem dependências extras.
 * Mantém o bundle leve e evita duplicação de lógica nos componentes.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}


