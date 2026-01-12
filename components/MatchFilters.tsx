import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Trophy,
} from 'lucide-react';
import {
  FilterState,
  SortState,
  countActiveFilters,
} from '../utils/matchFilters';
import { SavedAnalysis } from '../types';
import { Championship } from '../types';
import { getChampionshipMap } from '../utils/championshipUtils';
import { getMatchDateInBrasilia } from '../utils/dateFormatter';

interface MatchFiltersProps {
  filterState: FilterState;
  sortState: SortState;
  onFilterChange: (filters: FilterState) => void;
  onSortChange: (sort: SortState) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
  allMatches: SavedAnalysis[]; // Todas as partidas para destacar dias no calendário
}

const MatchFilters: React.FC<MatchFiltersProps> = ({
  filterState,
  sortState,
  onFilterChange,
  onSortChange,
  onClearFilters,
  filteredCount,
  totalCount,
  allMatches,
}) => {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const activeFiltersCount = countActiveFilters(filterState);

  // Carregar campeonatos
  useEffect(() => {
    getChampionshipMap().then((map) => {
      const champs: Championship[] = Array.from(map.entries()).map(([id, nome]) => ({
        id,
        nome,
      }));
      setChampionships(champs);
    });
  }, []);

  // Extrair datas únicas das partidas para destacar no calendário
  const matchDates = useMemo(() => {
    const dates = new Set<string>();
    allMatches.forEach((match) => {
      if (match.data.matchDate) {
        const matchDate = getMatchDateInBrasilia(match.data.matchDate, match.data.matchTime);
        if (matchDate) {
          const dateStr = matchDate.toISOString().split('T')[0];
          dates.add(dateStr);
        }
      }
    });
    return dates;
  }, [allMatches]);

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({
      ...filterState,
      [key]: value,
    });
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Header com contador e botão limpar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="btn btn-sm btn-ghost gap-2 text-error hover:bg-error/10"
              aria-label="Limpar todos os filtros"
            >
              <X className="w-4 h-4" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* Contador de resultados */}
        <div className="text-sm opacity-70">
          <span className="font-semibold">{filteredCount}</span> de <span>{totalCount}</span>{' '}
          partidas
        </div>
      </div>

      {/* Filtros sempre visíveis, lado a lado */}
      <div className="custom-card p-4 md:p-6 border border-base-300/50">
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-start sm:items-end">
          {/* Filtro por Campeonato */}
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <label className="text-xs font-bold uppercase opacity-60 mb-2 block flex items-center gap-2">
              <Trophy className="w-3 h-3" />
              Campeonato
            </label>
            <select
              value={filterState.championshipId || ''}
              onChange={(e) => handleFilterChange('championshipId', e.target.value || undefined)}
              className="select select-bordered w-full bg-base-200/50 border-base-300/50 focus:border-primary"
            >
              <option value="">Todos os campeonatos</option>
              {championships.map((champ) => (
                <option key={champ.id} value={champ.id}>
                  {champ.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Data Específica (Date Picker) */}
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <label className="text-xs font-bold uppercase opacity-60 mb-2 block flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Data da Partida
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterState.selectedDate || ''}
                onChange={(e) => handleFilterChange('selectedDate', e.target.value || undefined)}
                className="input input-bordered flex-1 bg-base-200/50 border-base-300/50 focus:border-primary"
              />
              {filterState.selectedDate && (
                <button
                  onClick={() => handleFilterChange('selectedDate', undefined)}
                  className="btn btn-sm btn-circle btn-ghost text-error hover:bg-error/10"
                  aria-label="Limpar data"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Dica visual: mostrar quantos dias têm partidas */}
            {matchDates.size > 0 && (
              <p className="text-xs opacity-60 mt-1">
                {matchDates.size} dia{matchDates.size !== 1 ? 's' : ''} com partidas registradas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchFilters;
