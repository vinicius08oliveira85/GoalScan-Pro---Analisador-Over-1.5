import { SavedAnalysis, RiskLevel } from '../types';
import { getPrimaryProbability } from './probability';
import { getMatchDateInBrasilia } from './dateFormatter';

// Tipos de Filtro
export type EVFilter = 'all' | 'positive' | 'negative';
export type ProbabilityRange = 'all' | 'high' | 'medium' | 'low';
export type BetStatusFilter = 'all' | 'won' | 'lost' | 'pending' | 'cancelled';
export type DateRange = 'all' | 'today' | 'week' | 'month' | 'thisMonth';

export interface FilterState {
  ev: EVFilter;
  probability: ProbabilityRange;
  riskLevels: RiskLevel[];
  betStatus: BetStatusFilter;
  dateRange: DateRange;
}

export type SortField = 'date' | 'ev' | 'probability' | 'risk' | 'timestamp';
export type SortOrder = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  order: SortOrder;
}

/**
 * Verifica se há filtros ativos
 */
export function hasActiveFilters(filterState: FilterState): boolean {
  return (
    filterState.ev !== 'all' ||
    filterState.probability !== 'all' ||
    filterState.riskLevels.length > 0 ||
    filterState.betStatus !== 'all' ||
    filterState.dateRange !== 'all'
  );
}

/**
 * Conta o número de filtros ativos
 */
export function countActiveFilters(filterState: FilterState): number {
  let count = 0;
  if (filterState.ev !== 'all') count++;
  if (filterState.probability !== 'all') count++;
  if (filterState.riskLevels.length > 0) count++;
  if (filterState.betStatus !== 'all') count++;
  if (filterState.dateRange !== 'all') count++;
  return count;
}

/**
 * Obtém a data do jogo para ordenação
 */
function getMatchDateTime(match: SavedAnalysis): Date | null {
  try {
    return getMatchDateInBrasilia(match.data.date);
  } catch {
    return null;
  }
}

/**
 * Utilitário Interno: Normaliza a data para comparação (apenas ano, mês, dia)
 */
const normalizeDate = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Aplica todos os filtros em uma ÚNICA iteração (O(n))
 */
export function applyAllFilters(
  matches: SavedAnalysis[],
  filterState: FilterState
): SavedAnalysis[] {
  if (!hasActiveFilters(filterState)) return matches;

  const now = new Date();
  const todayTime = normalizeDate(now);
  const sevenDaysAgo = todayTime - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = todayTime - 30 * 24 * 60 * 60 * 1000;
  const monthStartTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  return matches.filter((match) => {
    const matchDate = getMatchDateTime(match);
    const matchTime = matchDate?.getTime() || 0;
    const matchDayOnly = matchDate ? normalizeDate(matchDate) : 0;
    const prob = getPrimaryProbability(match.result);

    // 1. Filtro de EV
    if (filterState.ev === 'positive' && match.result.ev <= 0) return false;
    if (filterState.ev === 'negative' && match.result.ev > 0) return false;

    // 2. Filtro de Probabilidade
    if (filterState.probability === 'high' && prob < 70) return false;
    if (filterState.probability === 'medium' && (prob < 50 || prob >= 70)) return false;
    if (filterState.probability === 'low' && prob >= 50) return false;

    // 3. Filtro de Risco
    if (filterState.riskLevels.length > 0 && !filterState.riskLevels.includes(match.result.riskLevel)) return false;

    // 4. Filtro de Status de Aposta
    if (filterState.betStatus !== 'all') {
      const isNoBet = !match.betInfo || match.betInfo.betAmount === 0;
      if (filterState.betStatus === 'no-bet' && !isNoBet) return false;
      if (filterState.betStatus !== 'no-bet' && match.betInfo?.status !== filterState.betStatus) return false;
    }

    // 5. Filtro de Data
    if (filterState.dateRange !== 'all') {
      if (!matchDate) return false;
      switch (filterState.dateRange) {
        case 'today': if (matchDayOnly !== todayTime) return false; break;
        case 'this-week': {
          const weekStart = todayTime - (now.getDay() * 24 * 60 * 60 * 1000);
          if (matchTime < weekStart || matchTime > now.getTime()) return false;
          break;
        }
        case 'this-month': if (matchTime < monthStartTime || matchTime > now.getTime()) return false; break;
        case 'last-7-days': if (matchTime < sevenDaysAgo || matchTime > now.getTime()) return false; break;
        case 'last-30-days': if (matchTime < thirtyDaysAgo || matchTime > now.getTime()) return false; break;
      }
    }

    return true;
  });
}

/**
 * Mapeamento de Ordenação (Estratégia mais limpa que switch/case)
 */
const RISK_ORDER: Record<string, number> = { 'Baixo': 1, 'Moderado': 2, 'Alto': 3, 'Muito Alto': 4 };

const SortComparators: Record<SortField, (a: SavedAnalysis, b: SavedAnalysis) => number> = {
  date: (a, b) => (getMatchDateTime(b)?.getTime() || b.timestamp) - (getMatchDateTime(a)?.getTime() || a.timestamp),
  ev: (a, b) => b.result.ev - a.result.ev,
  probability: (a, b) => getPrimaryProbability(b.result) - getPrimaryProbability(a.result),
  risk: (a, b) => (RISK_ORDER[b.result.riskLevel] || 0) - (RISK_ORDER[a.result.riskLevel] || 0),
  timestamp: (a, b) => b.timestamp - a.timestamp,
};

export function sortMatches(
  matches: SavedAnalysis[],
  sortBy: SortField,
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  const comparator = SortComparators[sortBy];
  if (!comparator) return matches;

  return [...matches].sort((a, b) => {
    const res = comparator(a, b);
    return order === 'asc' ? -res : res;
  });
}

/**
 * Filtra partidas por categoria (abas)
 */
export function filterMatchesByCategory(matches: SavedAnalysis[], category: string): SavedAnalysis[] {
  switch (category) {
    case 'pendentes':
      return matches.filter(match => match.betInfo?.status === 'pending');
    case 'finalizadas':
      return matches.filter(match => match.betInfo?.status && ['won', 'lost', 'cancelled'].includes(match.betInfo.status));
    case 'todas':
    default:
      return matches;
  }
}

/**
 * Conta partidas por categoria
 */
export function getCategoryCounts(matches: SavedAnalysis[]): {
  pendentes: number;
  finalizadas: number;
  todas: number;
} {
  const counts = {
    pendentes: 0,
    finalizadas: 0,
    todas: matches.length,
  };

  matches.forEach(match => {
    if (match.betInfo?.status === 'pending') {
      counts.pendentes++;
    } else if (match.betInfo?.status && ['won', 'lost', 'cancelled'].includes(match.betInfo.status)) {
      counts.finalizadas++;
    }
  });

  return counts;
}