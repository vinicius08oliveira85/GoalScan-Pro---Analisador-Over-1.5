import { SavedAnalysis } from '../types';
import { getPrimaryProbability } from './probability';
import { getMatchDateInBrasilia } from './dateFormatter';

/**
 * Utilitários para classificação e filtragem de partidas
 */

// Tipos para filtros
export type EVFilter = 'all' | 'positive' | 'negative';
export type ProbabilityRange = 'all' | 'high' | 'medium' | 'low';
export type RiskLevel = 'Baixo' | 'Moderado' | 'Alto' | 'Muito Alto';
export type BetStatusFilter = 'all' | 'won' | 'lost' | 'pending' | 'no-bet';
export type DateRange = 'all' | 'today' | 'this-week' | 'this-month' | 'last-7-days' | 'last-30-days';
export type SortField = 'date' | 'ev' | 'probability' | 'risk' | 'timestamp';
export type SortOrder = 'asc' | 'desc';

export interface FilterState {
  ev: EVFilter;
  probability: ProbabilityRange;
  riskLevels: RiskLevel[];
  betStatus: BetStatusFilter;
  dateRange: DateRange;
}

export interface SortState {
  field: SortField;
  order: SortOrder;
}

/**
 * Obtém a data/hora da partida como Date object no fuso de Brasília
 */
function getMatchDateTime(match: SavedAnalysis): Date | null {
  if (match.data.matchDate) {
    try {
      const date = getMatchDateInBrasilia(match.data.matchDate, match.data.matchTime);
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date;
    } catch {
      return null;
    }
  }
  
  // Fallback: usar timestamp da análise (já está em UTC, converter para Brasília na formatação)
  return new Date(match.timestamp);
}

/**
 * Verifica se a partida é hoje
 */
export function isMatchToday(match: SavedAnalysis): boolean {
  const matchDate = getMatchDateTime(match);
  if (!matchDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const matchDateOnly = new Date(matchDate);
  matchDateOnly.setHours(0, 0, 0, 0);
  
  return matchDateOnly.getTime() === today.getTime();
}

/**
 * Verifica se a partida é futura
 */
export function isMatchFuture(match: SavedAnalysis): boolean {
  const matchDate = getMatchDateTime(match);
  if (!matchDate) return false;
  
  const now = new Date();
  
  return matchDate.getTime() > now.getTime();
}

/**
 * Verifica se a partida já passou (data/hora no passado)
 */
export function isMatchPast(match: SavedAnalysis): boolean {
  const matchDate = getMatchDateTime(match);
  if (!matchDate) return false;
  
  const now = new Date();
  
  return matchDate.getTime() < now.getTime();
}

/**
 * Verifica se a partida está finalizada
 * Critério: 
 * - Partidas com status 'won' ou 'lost' (independente da data)
 * - Partidas que já passaram E têm betInfo com valor > 0 (mesmo sem status definido)
 */
export function isMatchFinalized(match: SavedAnalysis): boolean {
  // Se tem status final (won ou lost), está finalizada
  const hasFinalStatus = match.betInfo?.status === 'won' || match.betInfo?.status === 'lost';
  if (hasFinalStatus) return true;
  
  // Se já passou e tem aposta registrada, considera finalizada
  const isPast = isMatchPast(match);
  const hasBet = match.betInfo && match.betInfo.betAmount > 0;
  
  return isPast && hasBet;
}

/**
 * Verifica se a partida está pendente
 * Critério: 
 * - Partidas com betInfo.status === 'pending'
 * - Partidas sem betInfo mas que ainda não passaram (data futura ou hoje)
 * - Exclui partidas sem betInfo que já passaram
 */
export function isMatchPending(match: SavedAnalysis): boolean {
  // Se tem betInfo com status pending, está pendente
  if (match.betInfo?.status === 'pending') return true;
  
  // Se não tem betInfo, verifica se ainda não passou
  if (!match.betInfo) {
    const isPast = isMatchPast(match);
    // Só é pendente se ainda não passou
    return !isPast;
  }
  
  return false;
}

/**
 * Filtra partidas por categoria
 */
export function filterMatchesByCategory(
  matches: SavedAnalysis[],
  category: 'pendentes' | 'finalizadas' | 'todas'
): SavedAnalysis[] {
  switch (category) {
    case 'pendentes':
      return matches.filter(isMatchPending);
    
    case 'finalizadas':
      return matches.filter(isMatchFinalized);
    
    case 'todas':
    default:
      return matches;
  }
}

/**
 * Conta partidas por categoria
 */
export function countMatchesByCategory(
  matches: SavedAnalysis[],
  category: 'pendentes' | 'finalizadas' | 'todas'
): number {
  return filterMatchesByCategory(matches, category).length;
}

/**
 * Obtém contadores para todas as categorias
 */
export function getCategoryCounts(matches: SavedAnalysis[]) {
  return {
    pendentes: countMatchesByCategory(matches, 'pendentes'),
    finalizadas: countMatchesByCategory(matches, 'finalizadas'),
    todas: countMatchesByCategory(matches, 'todas')
  };
}

/**
 * Filtra partidas por EV (Expected Value)
 */
export function filterByEV(
  matches: SavedAnalysis[],
  evFilter: EVFilter
): SavedAnalysis[] {
  if (evFilter === 'all') return matches;
  
  return matches.filter(match => {
    if (evFilter === 'positive') return match.result.ev > 0;
    if (evFilter === 'negative') return match.result.ev <= 0;
    return true;
  });
}

/**
 * Filtra partidas por faixa de probabilidade
 */
export function filterByProbability(
  matches: SavedAnalysis[],
  probabilityRange: ProbabilityRange
): SavedAnalysis[] {
  if (probabilityRange === 'all') return matches;
  
  return matches.filter(match => {
    const probability = getPrimaryProbability(match.result);
    
    switch (probabilityRange) {
      case 'high':
        return probability >= 70;
      case 'medium':
        return probability >= 50 && probability < 70;
      case 'low':
        return probability < 50;
      default:
        return true;
    }
  });
}

/**
 * Filtra partidas por nível de risco
 */
export function filterByRiskLevel(
  matches: SavedAnalysis[],
  riskLevels: RiskLevel[]
): SavedAnalysis[] {
  if (riskLevels.length === 0) return matches;
  
  return matches.filter(match => 
    riskLevels.includes(match.result.riskLevel)
  );
}

/**
 * Filtra partidas por status de aposta
 */
export function filterByBetStatus(
  matches: SavedAnalysis[],
  betStatus: BetStatusFilter
): SavedAnalysis[] {
  if (betStatus === 'all') return matches;
  
  return matches.filter(match => {
    if (betStatus === 'no-bet') {
      return !match.betInfo || match.betInfo.betAmount === 0;
    }
    
    return match.betInfo?.status === betStatus;
  });
}

/**
 * Filtra partidas por intervalo de datas
 */
export function filterByDateRange(
  matches: SavedAnalysis[],
  dateRange: DateRange
): SavedAnalysis[] {
  if (dateRange === 'all') return matches;
  
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  return matches.filter(match => {
    const matchDate = getMatchDateTime(match);
    if (!matchDate) return false;
    
    const matchDateOnly = new Date(matchDate);
    matchDateOnly.setHours(0, 0, 0, 0);
    
    switch (dateRange) {
      case 'today': {
        return matchDateOnly.getTime() === today.getTime();
      }
      
      case 'this-week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Domingo
        return matchDateOnly >= weekStart && matchDateOnly <= now;
      }
      
      case 'this-month': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return matchDateOnly >= monthStart && matchDateOnly <= now;
      }
      
      case 'last-7-days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return matchDateOnly >= sevenDaysAgo && matchDateOnly <= now;
      }
      
      case 'last-30-days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return matchDateOnly >= thirtyDaysAgo && matchDateOnly <= now;
      }
      
      default:
        return true;
    }
  });
}

/**
 * Aplica todos os filtros combinados
 */
export function applyAllFilters(
  matches: SavedAnalysis[],
  filterState: FilterState
): SavedAnalysis[] {
  let filtered = matches;
  
  filtered = filterByEV(filtered, filterState.ev);
  filtered = filterByProbability(filtered, filterState.probability);
  filtered = filterByRiskLevel(filtered, filterState.riskLevels);
  filtered = filterByBetStatus(filtered, filterState.betStatus);
  filtered = filterByDateRange(filtered, filterState.dateRange);
  
  return filtered;
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
 * Conta quantos filtros estão ativos
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
 * Ordena partidas por data
 */
export function sortByDate(
  matches: SavedAnalysis[],
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  const sorted = [...matches].sort((a, b) => {
    const dateA = getMatchDateTime(a);
    const dateB = getMatchDateTime(b);
    
    // Fallback para timestamp se não houver data
    const timeA = dateA ? dateA.getTime() : a.timestamp;
    const timeB = dateB ? dateB.getTime() : b.timestamp;
    
    return order === 'asc' ? timeA - timeB : timeB - timeA;
  });
  
  return sorted;
}

/**
 * Ordena partidas por EV
 */
export function sortByEV(
  matches: SavedAnalysis[],
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  const sorted = [...matches].sort((a, b) => {
    const evA = a.result.ev;
    const evB = b.result.ev;
    return order === 'asc' ? evA - evB : evB - evA;
  });
  
  return sorted;
}

/**
 * Ordena partidas por probabilidade
 */
export function sortByProbability(
  matches: SavedAnalysis[],
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  const sorted = [...matches].sort((a, b) => {
    const probA = getPrimaryProbability(a.result);
    const probB = getPrimaryProbability(b.result);
    return order === 'asc' ? probA - probB : probB - probA;
  });
  
  return sorted;
}

/**
 * Ordena partidas por nível de risco
 */
export function sortByRiskLevel(
  matches: SavedAnalysis[],
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  const riskOrder: Record<RiskLevel, number> = {
    'Baixo': 1,
    'Moderado': 2,
    'Alto': 3,
    'Muito Alto': 4
  };
  
  const sorted = [...matches].sort((a, b) => {
    const riskA = riskOrder[a.result.riskLevel] || 0;
    const riskB = riskOrder[b.result.riskLevel] || 0;
    return order === 'asc' ? riskA - riskB : riskB - riskA;
  });
  
  return sorted;
}

/**
 * Ordena partidas por timestamp
 */
export function sortByTimestamp(
  matches: SavedAnalysis[],
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  const sorted = [...matches].sort((a, b) => {
    return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });
  
  return sorted;
}

/**
 * Ordena partidas baseado no campo e ordem especificados
 */
export function sortMatches(
  matches: SavedAnalysis[],
  sortBy: SortField,
  order: SortOrder = 'desc'
): SavedAnalysis[] {
  switch (sortBy) {
    case 'date':
      return sortByDate(matches, order);
    case 'ev':
      return sortByEV(matches, order);
    case 'probability':
      return sortByProbability(matches, order);
    case 'risk':
      return sortByRiskLevel(matches, order);
    case 'timestamp':
      return sortByTimestamp(matches, order);
    default:
      return matches;
  }
}

