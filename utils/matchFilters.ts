import { SavedAnalysis, RiskLevel } from '../types';
import { getPrimaryProbability } from './probability';
import { getMatchDateInBrasilia } from './dateFormatter';

export interface FilterState {
  championshipId?: string; // Filtro por campeonato
  selectedDate?: string; // Data específica selecionada (YYYY-MM-DD)
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
    (filterState.championshipId !== undefined && filterState.championshipId !== '') ||
    (filterState.selectedDate !== undefined && filterState.selectedDate !== '')
  );
}

/**
 * Conta o número de filtros ativos
 */
export function countActiveFilters(filterState: FilterState): number {
  let count = 0;
  if (filterState.championshipId && filterState.championshipId !== '') count++;
  if (filterState.selectedDate && filterState.selectedDate !== '') count++;
  return count;
}

/**
 * Obtém a data do jogo para ordenação
 */
function getMatchDateTime(match: SavedAnalysis): Date | null {
  try {
    if (!match.data.matchDate) return null;
    return getMatchDateInBrasilia(match.data.matchDate, match.data.matchTime);
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

  return matches.filter((match) => {
    const matchDate = getMatchDateTime(match);

    // 1. Filtro de Data Específica (date picker)
    if (filterState.selectedDate) {
      if (!matchDate) return false;
      const selectedDateStr = new Date(filterState.selectedDate).toISOString().split('T')[0];
      const matchDateStr = matchDate.toISOString().split('T')[0];
      if (matchDateStr !== selectedDateStr) return false;
    }

    // 2. Filtro de Campeonato
    if (filterState.championshipId && filterState.championshipId !== '') {
      if (match.data.championshipId !== filterState.championshipId) return false;
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
      return matches.filter(match => {
        // Partidas com status pending
        if (match.betInfo?.status === 'pending') return true;
        // Partidas sem aposta registrada (sem betInfo ou sem betAmount)
        if (!match.betInfo || !match.betInfo.betAmount || match.betInfo.betAmount === 0) return true;
        return false;
      });
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
    // Partidas finalizadas (won, lost, cancelled)
    if (match.betInfo?.status && ['won', 'lost', 'cancelled'].includes(match.betInfo.status)) {
      counts.finalizadas++;
    } 
    // Partidas pendentes: status pending OU sem aposta registrada
    else if (match.betInfo?.status === 'pending' || !match.betInfo || !match.betInfo.betAmount || match.betInfo.betAmount === 0) {
      counts.pendentes++;
    }
  });

  return counts;
}