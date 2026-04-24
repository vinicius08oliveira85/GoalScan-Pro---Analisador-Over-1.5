
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { SavedAnalysis } from '../types';
import {
  Plus,
  Target,
  Activity,
  TrendingUp as TrendingUpIcon,
  CheckCircle,
  Clock,
  History,
} from 'lucide-react';
import { SkeletonMatchCard } from './Skeleton';
import { animations } from '../utils/animations';
import MatchFilters from './MatchFilters';
import MatchCardList from './MatchCardList';
import MatchCardCompact from './MatchCardCompact';
import { useWindowSize } from '../hooks/useWindowSize';
import EmptyState from './ui/EmptyState';
import {
  filterMatchesByCategory,
  getCategoryCounts,
  FilterState,
  SortState,
  applyAllFilters,
  sortMatches,
} from '../utils/matchFilters';
import { getPrimaryProbability } from '../utils/probability';
import { groupMatchesByChronoSections } from '../utils/matchChronoGroups';
import { cn } from '../utils/cn';
import type { TabCategory } from './MatchTabs';

export type MatchChipFilter = 'todas' | 'pendentes' | 'ganhas' | 'perdidas';

function chipToTabCategory(chip: MatchChipFilter): TabCategory {
  if (chip === 'pendentes') return 'pendentes';
  if (chip === 'ganhas' || chip === 'perdidas') return 'finalizadas';
  return 'todas';
}

const CHIP_STORAGE_KEY = 'matchesChipFilter';

function readInitialChip(savedMatches: SavedAnalysis[]): MatchChipFilter {
  try {
    const raw = localStorage.getItem(CHIP_STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const v = JSON.parse(raw) as string;
    if (v === 'todas' || v === 'pendentes' || v === 'ganhas' || v === 'perdidas') return v;
  } catch {
    /* fallback */
  }
  const counts = getCategoryCounts(savedMatches);
  return counts.pendentes > 0 ? 'pendentes' : 'todas';
}

// Componente de Empty State por categoria
const EmptyStateByCategory: React.FC<{
  category: TabCategory;
  onNewMatch: () => void;
  totalMatches: number;
}> = ({ category, onNewMatch, totalMatches }) => {
  const emptyStates = {
    pendentes: {
      icon: Clock,
      title: 'Nenhuma Partida Pendente',
      description:
        totalMatches > 0
          ? 'Todas as suas partidas já foram finalizadas ou não possuem apostas pendentes.'
          : 'Adicione partidas e registre apostas para acompanhar seus resultados.',
      showButton: totalMatches === 0,
      buttonLabel: 'Adicionar Partida',
    },
    finalizadas: {
      icon: CheckCircle,
      title: 'Nenhuma Partida Finalizada',
      description:
        'Ainda não há partidas finalizadas. As partidas aparecerão aqui após serem concluídas.',
      showButton: false,
    },
    todas: {
      icon: History,
      title: 'Nenhuma Partida Salva',
      description:
        'Comece criando sua primeira análise. Clique no botão abaixo para adicionar uma nova partida e começar a usar o GoalScan Pro.',
      showButton: true,
      buttonLabel: 'Adicionar Primeira Partida',
    },
  };

  const state = emptyStates[category];
  const Icon = state.icon;

  return (
    <motion.div
      key={category}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', bounce: 0.32, duration: 0.55 }}
    >
      <EmptyState
        icon={<Icon className="h-14 w-14 opacity-40 md:h-16 md:w-16" aria-hidden="true" />}
        title={state.title}
        description={state.description}
        actions={
          state.showButton ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={onNewMatch}
              className="btn btn-primary btn-lg focus-ring gap-2 shadow-xl hover:shadow-2xl"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              {state.buttonLabel ?? 'Adicionar Partida'}
            </motion.button>
          ) : null
        }
      />
    </motion.div>
  );
};

interface MatchesScreenProps {
  savedMatches: SavedAnalysis[];
  onMatchClick: (match: SavedAnalysis) => void;
  onNewMatch: () => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  onUpdateBetStatus?: (match: SavedAnalysis, status: 'won' | 'lost') => void;
  onAnalyzeResult?: (match: SavedAnalysis) => void;
  isLoading?: boolean;
  isUpdatingBetStatus?: boolean;
  /** Código ISO da moeda da banca (ex.: BRL) para exibir símbolo nos cards. */
  bankCurrency?: string;
}

const MatchesScreen: React.FC<MatchesScreenProps> = ({
  savedMatches,
  onMatchClick,
  onNewMatch,
  onDeleteMatch,
  onUpdateBetStatus,
  onAnalyzeResult,
  isLoading = false,
  isUpdatingBetStatus = false,
  bankCurrency,
}) => {
  const [chipFilter, setChipFilter] = useState<MatchChipFilter>(() => readInitialChip(savedMatches));

  const [filterState, setFilterState] = useState<FilterState>(() => {
    const saved = localStorage.getItem('matchesFilterState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* fallback */
      }
    }
    return {
      championshipId: undefined,
      selectedDate: undefined,
    };
  });

  const [sortState, setSortState] = useState<SortState>(() => {
    const saved = localStorage.getItem('matchesSortState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* fallback */
      }
    }
    return {
      field: 'date',
      order: 'asc',
    };
  });

  const windowSize = useWindowSize();
  const isMobile = windowSize.isMobile;

  const activeTabCategory = chipToTabCategory(chipFilter);

  useEffect(() => {
    localStorage.setItem(CHIP_STORAGE_KEY, JSON.stringify(chipFilter));
  }, [chipFilter]);

  useEffect(() => {
    localStorage.setItem('matchesFilterState', JSON.stringify(filterState));
  }, [filterState]);

  useEffect(() => {
    localStorage.setItem('matchesSortState', JSON.stringify(sortState));
  }, [sortState]);

  const filteredMatches = useMemo(() => {
    let matches = filterMatchesByCategory(savedMatches, activeTabCategory);
    matches = applyAllFilters(matches, filterState);
    matches = sortMatches(matches, sortState.field, sortState.order);
    if (chipFilter === 'ganhas') {
      matches = matches.filter((m) => m.betInfo?.status === 'won');
    } else if (chipFilter === 'perdidas') {
      matches = matches.filter((m) => m.betInfo?.status === 'lost');
    }
    return matches;
  }, [savedMatches, chipFilter, activeTabCategory, filterState, sortState]);

  const chipCounts = useMemo(
    () => ({
      todas: savedMatches.length,
      pendentes: filterMatchesByCategory(savedMatches, 'pendentes').length,
      ganhas: savedMatches.filter((m) => m.betInfo?.status === 'won').length,
      perdidas: savedMatches.filter((m) => m.betInfo?.status === 'lost').length,
    }),
    [savedMatches]
  );

  const chronoSections = useMemo(() => groupMatchesByChronoSections(filteredMatches), [filteredMatches]);

  const totalMatches = filteredMatches.length;
  const positiveEV = filteredMatches.filter((m) => m.result.ev > 0).length;
  const avgProbability =
    filteredMatches.length > 0
      ? filteredMatches.reduce((sum, m) => sum + getPrimaryProbability(m.result), 0) /
        filteredMatches.length
      : 0;

  const handleClearFilters = () => {
    setFilterState({
      championshipId: undefined,
      selectedDate: undefined,
    });
  };

  const chips: { id: MatchChipFilter; label: string; activeClass: string; idleClass: string }[] = [
    {
      id: 'todas',
      label: 'Todas',
      activeClass: 'bg-primary/20 text-primary ring-2 ring-primary/30 shadow-md shadow-primary/10',
      idleClass: 'bg-base-200/40 text-base-content/70 hover:bg-base-200/60 dark:bg-base-100/25',
    },
    {
      id: 'pendentes',
      label: 'Pendentes',
      activeClass: 'bg-warning/15 text-warning ring-2 ring-warning/25 shadow-md shadow-warning/10',
      idleClass: 'bg-base-200/40 text-base-content/70 hover:bg-warning/10 dark:bg-base-100/25',
    },
    {
      id: 'ganhas',
      label: 'Ganhas',
      activeClass: 'bg-success/15 text-success ring-2 ring-success/25 shadow-md shadow-success/10',
      idleClass: 'bg-base-200/40 text-base-content/70 hover:bg-success/10 dark:bg-base-100/25',
    },
    {
      id: 'perdidas',
      label: 'Perdidas',
      activeClass: 'bg-error/12 text-error ring-2 ring-error/25 shadow-md shadow-error/10',
      idleClass: 'bg-base-200/40 text-base-content/70 hover:bg-error/10 dark:bg-base-100/25',
    },
  ];

  return (
    <div className="min-w-0 space-y-6 pb-20 md:space-y-8 md:pb-8">
      {/* Chips de visão (mapeiam para categorias + recorte visual ganhas/perdidas) */}
      <motion.div
        layout
        className="flex min-w-0 flex-wrap gap-2 rounded-2xl border border-white/10 bg-base-100/35 p-2 shadow-inner shadow-primary/5 backdrop-blur-xl dark:border-white/10 dark:bg-base-100/20"
      >
        {chips.map((chip) => (
          <motion.button
            key={chip.id}
            type="button"
            layout
            onClick={() => setChipFilter(chip.id)}
            aria-pressed={chipFilter === chip.id}
            className={cn(
              'relative flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all duration-300 sm:flex-none sm:px-4 md:text-sm',
              chipFilter === chip.id ? chip.activeClass : chip.idleClass
            )}
          >
            <span>{chip.label}</span>
            <span
              className={cn(
                'tabular-nums text-[10px] font-bold opacity-60 md:text-xs',
                chipFilter === chip.id && 'opacity-90'
              )}
            >
              {chipCounts[chip.id]}
            </span>
          </motion.button>
        ))}
      </motion.div>

      <div className="flex min-w-0 flex-col gap-4">
        <MatchFilters
          filterState={filterState}
          sortState={sortState}
          onFilterChange={setFilterState}
          onSortChange={setSortState}
          onClearFilters={handleClearFilters}
          filteredCount={filteredMatches.length}
          totalCount={filterMatchesByCategory(savedMatches, activeTabCategory).length}
          allMatches={savedMatches}
        />
      </div>

      {totalMatches > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 md:gap-3">
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={0}
            className="custom-card flex items-center gap-2 rounded-3xl border border-white/10 bg-base-100/35 p-2 backdrop-blur-xl md:gap-2.5 md:p-2.5 dark:bg-base-100/20"
          >
            <div className="flex-shrink-0 rounded-xl border border-primary/25 bg-primary/10 p-1.5 md:p-2">
              <Activity className="h-4 w-4 text-primary md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-bold uppercase opacity-50 md:text-[10px]">Total de Partidas</p>
              <p className="text-lg font-black md:text-xl">{totalMatches}</p>
            </div>
          </motion.div>
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={1}
            className="custom-card flex items-center gap-2 rounded-3xl border border-white/10 bg-base-100/35 p-2 backdrop-blur-xl md:gap-2.5 md:p-2.5 dark:bg-base-100/20"
          >
            <div className="flex-shrink-0 rounded-xl border border-success/25 bg-success/10 p-1.5 md:p-2">
              <Target className="h-4 w-4 text-success md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-bold uppercase opacity-50 md:text-[10px]">EV Positivo</p>
              <p className="text-lg font-black text-success md:text-xl">{positiveEV}</p>
            </div>
          </motion.div>
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={2}
            className="custom-card flex items-center gap-2 rounded-3xl border border-white/10 bg-base-100/35 p-2 backdrop-blur-xl md:gap-2.5 md:p-2.5 dark:bg-base-100/20"
          >
            <div className="flex-shrink-0 rounded-xl border border-teal-500/25 bg-teal-500/10 p-1.5 md:p-2">
              <TrendingUpIcon className="h-4 w-4 text-teal-400 md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-bold uppercase opacity-50 md:text-[10px]">Prob. Média</p>
              <p className="text-lg font-black text-teal-400 md:text-xl">{avgProbability.toFixed(1)}%</p>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-0">
        <div className="min-w-0 flex-1">
          <h2 className="mb-0.5 text-lg font-black tracking-tighter sm:text-xl">Partidas Salvas</h2>
          <p className="text-[10px] opacity-60 sm:text-xs">Gerencie suas análises e resultados</p>
        </div>
        <button
          type="button"
          onClick={onNewMatch}
          className="btn btn-primary btn-sm focus:outline-nonefocus:ring-2 min-h-[36px] w-full gap-1.5 px-3 py-1.5 shadow-lg transition-transform hover:scale-[1.02] focus:ring-primary sm:w-auto"
          aria-label="Adicionar nova partida para análise"
        >
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
          <span className="hidden text-sm sm:inline">Adicionar Partida</span>
          <span className="text-xs sm:hidden">Nova Partida</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonMatchCard key={index} />
          ))}
        </div>
      ) : savedMatches.length === 0 ? (
        <EmptyStateByCategory category="todas" onNewMatch={onNewMatch} totalMatches={0} />
      ) : filteredMatches.length === 0 ? (
        <EmptyStateByCategory
          category={chipToTabCategory(chipFilter)}
          onNewMatch={onNewMatch}
          totalMatches={savedMatches.length}
        />
      ) : (
        <LayoutGroup id="matches-list-layout">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${chipFilter}-${isMobile ? 'm' : 'd'}-${sortState.field}-${sortState.order}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0 space-y-8"
            >
              {chronoSections.map((section) => (
                <section key={section.id} className="min-w-0">
                  <div className="sticky top-0 z-20 -mx-1 mb-3 flex items-center gap-2 border-b border-white/10 bg-base-100/80 py-2.5 pl-1 pr-2 text-[11px] font-black uppercase tracking-[0.2em] text-base-content/60 backdrop-blur-md dark:bg-base-200/75 md:text-xs">
                    <span className="h-1 w-6 rounded-full bg-gradient-to-r from-primary to-secondary opacity-80" />
                    {section.label}
                  </div>
                  <motion.div
                    variants={animations.staggerChildren}
                    initial="initial"
                    animate="animate"
                    className={isMobile ? 'min-w-0 space-y-2.5' : 'min-w-0 space-y-3'}
                  >
                    {section.matches.map((match, index) =>
                      isMobile ? (
                        <MatchCardCompact
                          key={match.id}
                          match={match}
                          index={index}
                          onMatchClick={onMatchClick}
                          onDeleteMatch={onDeleteMatch}
                          bankCurrency={bankCurrency}
                        />
                      ) : (
                        <MatchCardList
                          key={match.id}
                          match={match}
                          index={index}
                          onMatchClick={onMatchClick}
                          onDeleteMatch={onDeleteMatch}
                          onUpdateBetStatus={onUpdateBetStatus}
                          onAnalyzeResult={onAnalyzeResult}
                          isUpdatingBetStatus={isUpdatingBetStatus}
                          bankCurrency={bankCurrency}
                        />
                      )
                    )}
                  </motion.div>
                </section>
              ))}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
      )}
    </div>
  );
};

export default MatchesScreen;
