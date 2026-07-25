import React from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Championship, ChampionshipTable } from '../../types';

interface TableStatusProps {
  updatedAt: number | string | null | undefined;
  className?: string;
}

/**
 * Último instante conhecido em que os dados do campeonato/tabelas foram gravados.
 * Prioriza upload e `updated_at` das tabelas; fallback para metadados do campeonato.
 */
export function getChampionshipDataFreshnessMs(
  championship: Pick<Championship, 'uploaded_at' | 'updated_at' | 'created_at'>,
  tables?: Pick<ChampionshipTable, 'updated_at'>[]
): number | null {
  const candidates: (string | undefined)[] = [
    championship.uploaded_at,
    championship.updated_at,
    championship.created_at,
    ...(tables?.map((t) => t.updated_at) ?? []),
  ].filter((s): s is string => Boolean(s));

  const times = candidates
    .map((s) => new Date(s).getTime())
    .filter((n) => Number.isFinite(n));

  if (times.length === 0) return null;
  return Math.max(...times);
}

const TableStatus: React.FC<TableStatusProps> = ({ updatedAt, className }) => {
  if (updatedAt == null || updatedAt === '') return null;

  const lastUpdateDate =
    typeof updatedAt === 'number' ? updatedAt : new Date(updatedAt).getTime();
  if (!Number.isFinite(lastUpdateDate)) return null;

  const diffInMs = Date.now() - lastUpdateDate;
  const diffInDays = Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));

  let statusText = '';
  let toneClass = '';
  let Icon = Clock;

  if (diffInDays === 0) {
    statusText = 'Atualizado hoje';
    toneClass =
      'border-success/35 text-success bg-success/10 ring-success/15 shadow-success/5';
    Icon = CheckCircle2;
  } else if (diffInDays === 1) {
    statusText = 'Atualizado ontem';
    toneClass =
      'border-warning/35 text-warning bg-warning/10 ring-warning/15 shadow-warning/5';
  } else if (diffInDays < 7) {
    statusText = `Há ${diffInDays} dias`;
    toneClass =
      'border-warning/35 text-warning bg-warning/10 ring-warning/15 shadow-warning/5';
  } else {
    statusText = `Desatualizado (${diffInDays}d)`;
    toneClass = 'border-error/40 text-error bg-error/10 ring-error/20 shadow-error/10';
    Icon = AlertCircle;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-tighter shadow-sm backdrop-blur-xl transition-all duration-300',
        'bg-base-100/40 ring-1 ring-base-300/40',
        toneClass,
        className
      )}
      title="Referência temporal dos dados para análises (ex.: Poisson)"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="leading-none">{statusText}</span>

      {diffInDays > 3 && (
        <span className="relative ml-0.5 flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              diffInDays > 7 ? 'bg-error' : 'bg-warning'
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              diffInDays > 7 ? 'bg-error' : 'bg-warning'
            )}
          />
        </span>
      )}
    </div>
  );
};

export default TableStatus;
