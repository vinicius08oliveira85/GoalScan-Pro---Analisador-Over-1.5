import { twMerge } from 'tailwind-merge';

export type ClassValue = string | undefined | null | false;

/**
 * Compõe classNames e resolve conflitos entre utilitários Tailwind (última classe vence).
 */
export function cn(...values: ClassValue[]): string {
  return twMerge(values.filter(Boolean).join(' '));
}
