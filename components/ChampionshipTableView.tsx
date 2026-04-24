import React, { useState, useMemo } from 'react';
import { ChampionshipTable } from '../types';
import { Search, ArrowUpDown } from 'lucide-react';
import { cn } from '../utils/cn';

interface ChampionshipTableViewProps {
  table: ChampionshipTable;
  onSquadSelect?: (squad: string) => void;
}

// Mapeamento parcial de campos para PT-BR (fallback: exibir o nome original da coluna)
const fieldTranslations: Record<string, string> = {
  // Geral
  Rk: 'Classificação',
  Squad: 'Equipe',
  MP: 'Partidas Jogadas',
  W: 'Vitórias',
  D: 'Empates',
  L: 'Derrotas',
  GF: 'Gols a Favor',
  GA: 'Gols Contra',
  GD: 'Saldo de Gols',
  Pts: 'Pontos',
  'Pts/MP': 'Pontos por Partida',
  xG: 'xG',
  xGA: 'xGA',
  xGD: 'xGD',
  'xGD/90': 'xGD/90',
  'Last 5': 'Últimos 5',
  Attendance: 'Público',
  'Top Team Scorer': 'Artilheiro',
  Goalkeeper: 'Goleiro',
  Notes: 'Obs.',

  // Standard (For) - Complemento
  '# Pl': '# Jogadores',
  Age: 'Idade Média',
  Poss: 'Posse (%)',
  'Playing Time MP': 'Partidas (MP)',
  'Playing Time Starts': 'Titularidades',
  'Playing Time Min': 'Minutos',
  'Playing Time 90s': '90s',
  'Progression PrgC': 'Carregadas Progressivas',
  'Progression PrgP': 'Passes Progressivos',
  'Per 90 Minutes xG+xAG': 'xG+xAG/90',
  'Per 90 Minutes npxG+xAG': 'npxG+xAG/90',
  'Per 90 Minutes xAG': 'xAG/90',
  'Performance Gls': 'Gols',
  'Performance Ast': 'Assistências',
  'Performance G+A': 'G+A',
  'Performance G-PK': 'Gols (sem pênalti)',
  'Performance PK': 'Pênaltis marcados',
  'Performance PKatt': 'Pênaltis tentados',
  'Performance CrdY': 'Cartões amarelos',
  'Performance CrdR': 'Cartões vermelhos',
  'Per 90 Minutes Gls': 'Gols/90',
  'Per 90 Minutes Ast': 'Assist./90',
  'Per 90 Minutes G+A': 'G+A/90',
  'Per 90 Minutes G-PK': 'G-PK/90',
  'Per 90 Minutes G+A-PK': 'G+A-PK/90',
};

// Campos que devem ser ocultos (links internos / blob de importação JSON)
const hiddenFields = ['Top Team Scorer_link', 'Goalkeeper_link', 'importExtras'];

function parseNumberMaybe(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/,/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

const ChampionshipTableView: React.FC<ChampionshipTableViewProps> = ({
  table,
  onSquadSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Converter dados da tabela para array de linhas
  const rows = useMemo(() => {
    if (!table.table_data || !Array.isArray(table.table_data)) {
      return [];
    }
    return table.table_data as Array<Record<string, unknown>>;
  }, [table.table_data]);

  // União das chaves de todas as linhas; Squad primeiro quando existir
  const columns = useMemo(() => {
    if (rows.length === 0) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of rows) {
      for (const key of Object.keys(row as Record<string, unknown>)) {
        if (hiddenFields.includes(key) || seen.has(key)) continue;
        seen.add(key);
        ordered.push(key);
      }
    }
    const squadIdx = ordered.indexOf('Squad');
    if (squadIdx > 0) {
      ordered.splice(squadIdx, 1);
      ordered.unshift('Squad');
    }
    return ordered;
  }, [rows]);

  // Filtrar e ordenar linhas
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;

    // Aplicar filtro de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return Object.values(row).some((value) =>
          String(value).toLowerCase().includes(term)
        );
      });
    }

    // Aplicar ordenação
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = (a as Record<string, unknown>)[sortField];
        const bValue = (b as Record<string, unknown>)[sortField];

        // Tentar converter para número (suporta separador de milhar)
        const aNum = parseNumberMaybe(aValue);
        const bNum = parseNumberMaybe(bValue);

        if (aNum != null && bNum != null) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Comparação de strings
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [rows, searchTerm, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSquadClick = (squad: string) => {
    if (onSquadSelect) {
      onSquadSelect(squad);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-base-200/30 p-8 text-center backdrop-blur-sm">
        <p className="text-sm text-base-content/60">Nenhum dado disponível nesta tabela.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-base-100/30 p-3 shadow-inner ring-1 ring-white/5 backdrop-blur-md dark:bg-base-100/20 sm:p-4 md:p-5">
      <div className="mb-3 sm:mb-4">
        <h3 className="mb-2 text-lg font-black tracking-tight sm:text-xl">{table.table_name}</h3>
        <div className="form-control">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" aria-hidden />
            <input
              type="text"
              placeholder="Buscar por equipe ou qualquer campo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered w-full rounded-2xl border-white/15 bg-base-200/50 pl-10 backdrop-blur-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="table table-sm w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-base-200/40 text-[11px] uppercase tracking-wide dark:bg-base-200/25">
              {columns.map((column) => (
                <th
                  key={column}
                  className="cursor-pointer border-b border-white/10 px-2 py-2.5 text-left font-black text-base-content/90 transition-colors hover:bg-primary/10 sm:px-3"
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="leading-tight">{fieldTranslations[column] || column}</span>
                    {sortField === column && (
                      <ArrowUpDown
                        className={cn('h-3.5 w-3.5 shrink-0 opacity-70', sortDirection === 'desc' && 'rotate-180')}
                        aria-hidden
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRows.map((row) => {
              const squadKey = (row as Record<string, unknown>).Squad || `row-${Math.random()}`;
              return (
                <tr key={String(squadKey)} className="border-b border-white/5 transition-colors hover:bg-primary/5">
                  {columns.map((column) => {
                    const value = (row as Record<string, unknown>)[column];
                    const displayValue = value !== null && value !== undefined ? String(value) : '-';
                    const numeric = column !== 'Squad' && parseNumberMaybe(value) != null;
                    const cellClass = cn(
                      'border-white/5 px-2 py-2 align-middle text-sm sm:px-3',
                      numeric && 'font-mono text-xs tabular-nums text-base-content/90 sm:text-sm',
                      !numeric && column !== 'Squad' && 'text-base-content/85',
                      column === 'Squad' && 'font-semibold'
                    );

                    if (column === 'Squad' && onSquadSelect) {
                      return (
                        <td key={column} className={cellClass}>
                          <button
                            type="button"
                            onClick={() => handleSquadClick(displayValue)}
                            className="btn btn-link btn-sm h-auto min-h-0 p-0 font-semibold text-primary hover:text-primary-focus"
                          >
                            {displayValue}
                          </button>
                        </td>
                      );
                    }

                    return (
                      <td key={column} className={cellClass}>
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedRows.length === 0 && searchTerm && (
        <div className="text-center py-8 text-base-content/60">
          Nenhum resultado encontrado para "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default ChampionshipTableView;

