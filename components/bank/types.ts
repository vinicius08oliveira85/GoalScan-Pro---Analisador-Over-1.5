import type { LucideIcon } from 'lucide-react';

export type SaveStatus = 'idle' | 'loading' | 'success' | 'error';
export type ValidationState = 'idle' | 'valid' | 'invalid';
export type StatColor = 'success' | 'error' | 'warning' | 'primary';

export type BankStatCard = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: StatColor;
  subtitle: string;
};


