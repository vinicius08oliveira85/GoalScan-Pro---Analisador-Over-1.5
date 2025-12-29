import { SavedAnalysis } from '../types';

/**
 * Utilitários para classificação e filtragem de partidas
 */

/**
 * Obtém a data/hora da partida como Date object
 */
function getMatchDateTime(match: SavedAnalysis): Date | null {
  if (match.data.matchDate) {
    const dateStr = match.data.matchDate;
    const timeStr = match.data.matchTime || '00:00';
    
    try {
      // Formato: YYYY-MM-DD HH:mm
      const dateTimeStr = `${dateStr} ${timeStr}`;
      const date = new Date(dateTimeStr);
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date;
    } catch {
      return null;
    }
  }
  
  // Fallback: usar timestamp da análise
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
  category: 'todas' | 'hoje' | 'futuras' | 'finalizadas' | 'pendentes'
): SavedAnalysis[] {
  switch (category) {
    case 'hoje':
      return matches.filter(isMatchToday);
    
    case 'futuras':
      return matches.filter(isMatchFuture);
    
    case 'finalizadas':
      return matches.filter(isMatchFinalized);
    
    case 'pendentes':
      return matches.filter(isMatchPending);
    
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
  category: 'todas' | 'hoje' | 'futuras' | 'finalizadas' | 'pendentes'
): number {
  return filterMatchesByCategory(matches, category).length;
}

/**
 * Obtém contadores para todas as categorias
 */
export function getCategoryCounts(matches: SavedAnalysis[]) {
  return {
    todas: countMatchesByCategory(matches, 'todas'),
    hoje: countMatchesByCategory(matches, 'hoje'),
    futuras: countMatchesByCategory(matches, 'futuras'),
    finalizadas: countMatchesByCategory(matches, 'finalizadas'),
    pendentes: countMatchesByCategory(matches, 'pendentes')
  };
}

