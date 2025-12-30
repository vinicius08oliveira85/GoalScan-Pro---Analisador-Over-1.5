import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowUpDown
} from 'lucide-react';
import { 
  FilterState, 
  EVFilter, 
  ProbabilityRange, 
  RiskLevel, 
  BetStatusFilter, 
  DateRange,
  SortField,
  SortOrder,
  SortState,
  countActiveFilters 
} from '../utils/matchFilters';

interface MatchFiltersProps {
  filterState: FilterState;
  sortState: SortState;
  onFilterChange: (filters: FilterState) => void;
  onSortChange: (sort: SortState) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

const MatchFilters: React.FC<MatchFiltersProps> = ({
  filterState,
  sortState,
  onFilterChange,
  onSortChange,
  onClearFilters,
  filteredCount,
  totalCount
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeFiltersCount = countActiveFilters(filterState);

  const handleFilterChange = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFilterChange({
      ...filterState,
      [key]: value
    });
  };

  const handleRiskLevelToggle = (level: RiskLevel) => {
    const currentLevels = filterState.riskLevels;
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter(l => l !== level)
      : [...currentLevels, level];
    handleFilterChange('riskLevels', newLevels);
  };

  const handleSortFieldChange = (field: SortField) => {
    // Se clicar no mesmo campo, inverte a ordem
    if (sortState.field === field) {
      onSortChange({
        ...sortState,
        order: sortState.order === 'asc' ? 'desc' : 'asc'
      });
    } else {
      onSortChange({
        field,
        order: 'desc' // Padrão: maior para menor
      });
    }
  };

  const evOptions: { value: EVFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todos', icon: null },
    { value: 'positive', label: 'EV Positivo', icon: <TrendingUp className="w-3 h-3" /> },
    { value: 'negative', label: 'EV Negativo', icon: <TrendingDown className="w-3 h-3" /> }
  ];

  const probabilityOptions: { value: ProbabilityRange; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'high', label: 'Alta (≥70%)' },
    { value: 'medium', label: 'Média (50-70%)' },
    { value: 'low', label: 'Baixa (<50%)' }
  ];

  const riskLevels: RiskLevel[] = ['Baixo', 'Moderado', 'Alto', 'Muito Alto'];

  const betStatusOptions: { value: BetStatusFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todas', icon: null },
    { value: 'won', label: 'Ganhou', icon: <CheckCircle className="w-3 h-3" /> },
    { value: 'lost', label: 'Perdeu', icon: <XCircle className="w-3 h-3" /> },
    { value: 'pending', label: 'Pendente', icon: <Clock className="w-3 h-3" /> },
    { value: 'no-bet', label: 'Sem aposta', icon: <X className="w-3 h-3" /> }
  ];

  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'today', label: 'Hoje' },
    { value: 'this-week', label: 'Esta semana' },
    { value: 'this-month', label: 'Este mês' },
    { value: 'last-7-days', label: 'Últimos 7 dias' },
    { value: 'last-30-days', label: 'Últimos 30 dias' }
  ];

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'date', label: 'Data' },
    { value: 'ev', label: 'EV' },
    { value: 'probability', label: 'Probabilidade' },
    { value: 'risk', label: 'Risco' },
    { value: 'timestamp', label: 'Criação' }
  ];

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
              <span className="badge badge-primary badge-sm">
                {activeFiltersCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Ordenação rápida */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
            <ArrowUpDown className="w-4 h-4 opacity-60 flex-shrink-0" />
            <div className="flex gap-1 bg-base-200/50 backdrop-blur-xl rounded-xl p-1 border border-base-300/50 min-w-max">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortFieldChange(option.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${sortState.field === option.value
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                      : 'text-base-content/60 hover:text-base-content/80 hover:bg-base-300/50'
                    }
                  `}
                  title={`Ordenar por ${option.label} ${sortState.field === option.value ? (sortState.order === 'asc' ? '(crescente)' : '(decrescente)') : ''}`}
                >
                  {option.label}
                  {sortState.field === option.value && (
                    <span className="ml-1">
                      {sortState.order === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

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
          <span className="font-semibold">{filteredCount}</span>
          {' '}de{' '}
          <span>{totalCount}</span>
          {' '}partidas
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
            {/* Filtro por EV */}
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block">
                Valor Esperado (EV)
              </label>
              <div className="flex flex-wrap gap-2">
                {evOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFilterChange('ev', option.value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                      ${filterState.ev === option.value
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                        : 'bg-base-200/50 text-base-content/70 hover:bg-base-200 border border-base-300/50'
                      }
                    `}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por Probabilidade */}
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block">
                Probabilidade
              </label>
              <div className="flex flex-wrap gap-2">
                {probabilityOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFilterChange('probability', option.value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${filterState.probability === option.value
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                        : 'bg-base-200/50 text-base-content/70 hover:bg-base-200 border border-base-300/50'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por Nível de Risco */}
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block">
                Nível de Risco
              </label>
              <div className="flex flex-wrap gap-2">
                {riskLevels.map((level) => {
                  const isActive = filterState.riskLevels.includes(level);
                  const getRiskClasses = (lvl: RiskLevel, active: boolean) => {
                    if (!active) {
                      return 'bg-base-200/50 text-base-content/70 hover:bg-base-200 border border-base-300/50';
                    }
                    switch (lvl) {
                      case 'Baixo':
                        return 'bg-success/20 text-success border-2 border-success/50 shadow-md';
                      case 'Moderado':
                        return 'bg-warning/20 text-warning border-2 border-warning/50 shadow-md';
                      case 'Alto':
                      case 'Muito Alto':
                        return 'bg-error/20 text-error border-2 border-error/50 shadow-md';
                      default:
                        return 'bg-base-200/50 text-base-content/70 border border-base-300/50';
                    }
                  };
                  return (
                    <button
                      key={level}
                      onClick={() => handleRiskLevelToggle(level)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${getRiskClasses(level, isActive)}`}
                    >
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro por Status de Aposta */}
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block">
                Status da Aposta
              </label>
              <div className="flex flex-wrap gap-2">
                {betStatusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFilterChange('betStatus', option.value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                      ${filterState.betStatus === option.value
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                        : 'bg-base-200/50 text-base-content/70 hover:bg-base-200 border border-base-300/50'
                      }
                    `}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por Data/Período */}
            <div>
              <label className="text-xs font-bold uppercase opacity-60 mb-2 block flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Período
              </label>
              <div className="flex flex-wrap gap-2">
                {dateRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFilterChange('dateRange', option.value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${filterState.dateRange === option.value
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                        : 'bg-base-200/50 text-base-content/70 hover:bg-base-200 border border-base-300/50'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchFilters;

