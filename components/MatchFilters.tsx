import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trophy,
} from 'lucide-react';
import {
  FilterState,
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
  const [isExpanded, setIsExpanded] = useState(false);
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
      {/* Header com contador e botões principais */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn btn-sm gap-2 bg-base-200/50 hover:bg-base-200 border border-base-300/50"
            aria-label={isExpanded ? 'Recolher filtros' : 'Expandir filtros'}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="badge badge-primary badge-sm">{activeFiltersCount}</span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="btn btn-sm btn-ghost gap-2 text-error hover:bg-error/10"
              aria-label="Limpar todos os filtros"
            >
              <X className="w-4 h-4" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* Contador de resultados */}
        <div className="text-sm opacity-70">
          <span className="font-semibold">{filteredCount}</span> de <span>{totalCount}</span>{' '}
          partidas
        </div>
      </div>

      {/* Painel de filtros expandido */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="custom-card p-4 md:p-6 space-y-6 border border-base-300/50 overflow-hidden"
          >
            {/* Filtro por Campeonato */}
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block flex items-center gap-2">
                <Trophy className="w-3 h-3" />
                Campeonato
              </label>
              <select
                value={filterState.championshipId || ''}
                onChange={(e) => handleFilterChange('championshipId', e.target.value || undefined)}
                className="select select-bordered w-full max-w-xs bg-base-200/50 border-base-300/50 focus:border-primary"
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
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Data da Partida
              </label>
              <input
                type="date"
                value={filterState.selectedDate || ''}
                onChange={(e) => handleFilterChange('selectedDate', e.target.value || undefined)}
                className="input input-bordered w-full max-w-xs bg-base-200/50 border-base-300/50 focus:border-primary"
                style={{
                  // Estilizar o input date para destacar dias com partidas
                  backgroundImage: matchDates.size > 0 ? 'none' : undefined,
                }}
              />
              {filterState.selectedDate && (
                <button
                  onClick={() => handleFilterChange('selectedDate', undefined)}
                  className="btn btn-xs btn-ghost mt-2 text-error hover:bg-error/10"
                >
                  <X className="w-3 h-3" />
                  Limpar data
                </button>
              )}
              {/* Dica visual: mostrar quantos dias têm partidas */}
              {matchDates.size > 0 && (
                <p className="text-xs opacity-60 mt-1">
                  {matchDates.size} dia{matchDates.size !== 1 ? 's' : ''} com partidas registradas
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchFilters;
