import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SavedAnalysis } from '../types';
import {
  Plus,
  Target,
  Activity,
  TrendingUp as TrendingUpIcon,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { SkeletonMatchCard } from './Skeleton';
import { animations } from '../utils/animations';
import MatchTabs, { TabCategory } from './MatchTabs';
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
      icon: Target,
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
    >
      <EmptyState
        icon={<Icon className="w-12 h-12 md:w-14 md:h-14" aria-hidden="true" />}
        title={state.title}
        description={state.description}
        actions={
          state.showButton ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNewMatch}
              className="btn btn-primary btn-lg gap-2 shadow-xl hover:shadow-2xl focus-ring"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
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
}) => {
  const categoryCounts = useMemo(() => getCategoryCounts(savedMatches), [savedMatches]);

  // Estados iniciais com persistência no localStorage
  const [activeTab, setActiveTab] = useState<TabCategory>(() => {
    const counts = getCategoryCounts(savedMatches);
    return counts.pendentes > 0 ? 'pendentes' : 'todas';
  });

  const [filterState, setFilterState] = useState<FilterState>(() => {
    const saved = localStorage.getItem('matchesFilterState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback para estado padrão
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
        // Fallback para estado padrão
      }
    }
    return {
      field: 'date',
      order: 'asc', // Menor para maior (horário mais cedo primeiro)
    };
  });

  // Detectar se é mobile para escolher visualização automaticamente
  const windowSize = useWindowSize();
  const isMobile = windowSize.isMobile;

  // Persistir estados no localStorage
  useEffect(() => {
    localStorage.setItem('matchesFilterState', JSON.stringify(filterState));
  }, [filterState]);

  useEffect(() => {
    localStorage.setItem('matchesSortState', JSON.stringify(sortState));
  }, [sortState]);

  // Filtrar e ordenar partidas
  const filteredMatches = useMemo(() => {
    // Primeiro filtra por categoria (abas)
    let matches = filterMatchesByCategory(savedMatches, activeTab);

    // Depois aplica filtros avançados
    matches = applyAllFilters(matches, filterState);

    // Por fim ordena
    matches = sortMatches(matches, sortState.field, sortState.order);

    return matches;
  }, [savedMatches, activeTab, filterState, sortState]);

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

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Sistema de Abas */}
      <MatchTabs activeTab={activeTab} onTabChange={setActiveTab} counts={categoryCounts} />

      {/* Filtros e Visualização */}
      <div className="flex flex-col gap-4">
        <MatchFilters
          filterState={filterState}
          sortState={sortState}
          onFilterChange={setFilterState}
          onSortChange={setSortState}
          onClearFilters={handleClearFilters}
          filteredCount={filteredMatches.length}
          totalCount={filterMatchesByCategory(savedMatches, activeTab).length}
          allMatches={savedMatches}
        />
      </div>

      {/* Estatísticas Gerais */}
      {totalMatches > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={0}
            className="custom-card p-2 md:p-2.5 flex items-center gap-2 md:gap-2.5"
          >
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] font-bold opacity-40 uppercase mb-0.5">
                Total de Partidas
              </p>
              <p className="text-lg md:text-xl font-black">{totalMatches}</p>
            </div>
          </motion.div>
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={1}
            className="custom-card p-2 md:p-2.5 flex items-center gap-2 md:gap-2.5"
          >
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10 border border-success/20 flex-shrink-0">
              <Target className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] font-bold opacity-40 uppercase mb-0.5">
                EV Positivo
              </p>
              <p className="text-lg md:text-xl font-black text-success">{positiveEV}</p>
            </div>
          </motion.div>
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={2}
            className="custom-card p-2 md:p-2.5 flex items-center gap-2 md:gap-2.5"
          >
            <div className="p-1.5 md:p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 flex-shrink-0">
              <TrendingUpIcon className="w-4 h-4 md:w-5 md:h-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] font-bold opacity-40 uppercase mb-0.5">
                Prob. Média
              </p>
              <p className="text-lg md:text-xl font-black text-teal-400">
                {avgProbability.toFixed(1)}%
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Título e Botão Adicionar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-black tracking-tighter mb-0.5">Partidas Salvas</h2>
          <p className="text-[10px] sm:text-xs opacity-60">Gerencie suas análises e resultados</p>
        </div>
        <button
          onClick={onNewMatch}
          className="btn btn-primary btn-sm gap-1.5 shadow-lg hover:scale-105 transition-transform w-full sm:w-auto min-h-[36px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Adicionar nova partida para análise"
        >
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" aria-hidden="true" />
          <span className="hidden sm:inline text-sm">Adicionar Partida</span>
          <span className="sm:hidden text-xs">Nova Partida</span>
        </button>
      </div>

      {/* Grid de Partidas */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonMatchCard key={index} />
          ))}
        </div>
      ) : savedMatches.length === 0 ? (
        <EmptyStateByCategory category="todas" onNewMatch={onNewMatch} totalMatches={0} />
      ) : filteredMatches.length === 0 ? (
        <EmptyStateByCategory
          category={activeTab}
          onNewMatch={onNewMatch}
          totalMatches={savedMatches.length}
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${isMobile ? 'mobile' : 'desktop'}`}
            className={isMobile ? 'space-y-2' : 'space-y-3'}
            variants={animations.staggerChildren}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {filteredMatches.map((match, index) => {
              // Desktop/Web: Lista | Mobile: Compacta
              if (isMobile) {
                return (
                  <MatchCardCompact
                    key={match.id}
                    match={match}
                    index={index}
                    onMatchClick={onMatchClick}
                    onDeleteMatch={onDeleteMatch}
                  />
                );
              }

              return (
                  <MatchCardList
                    key={match.id}
                    match={match}
                    index={index}
                    onMatchClick={onMatchClick}
                    onDeleteMatch={onDeleteMatch}
                    onUpdateBetStatus={onUpdateBetStatus}
                    onAnalyzeResult={onAnalyzeResult}
                    isUpdatingBetStatus={isUpdatingBetStatus}
                  />
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default MatchesScreen;
