import type { BetInfo, SavedAnalysis } from '../types';

type ProgressiveBetRef = {
  matchId: string;
  ts: number;
  day: number;
  status: BetInfo['status'];
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.trunc(Math.min(max, Math.max(min, value)));
}

function getBetPlacedAt(match: SavedAnalysis): number {
  const placedAt = match.betInfo?.placedAt;
  if (typeof placedAt === 'number' && Number.isFinite(placedAt) && placedAt > 0) return placedAt;
  return match.timestamp;
}

function getProgressiveBets(savedMatches: SavedAnalysis[], maxDays: number): ProgressiveBetRef[] {
  const refs: ProgressiveBetRef[] = [];

  for (const match of savedMatches) {
    const bet = match.betInfo;
    if (!bet) continue;
    if (!bet.useLeverageProgression) continue;
    if (!(bet.betAmount > 0)) continue;
    if (bet.status === 'cancelled') continue;
    if (typeof bet.leverageProgressionDay !== 'number' || !Number.isFinite(bet.leverageProgressionDay))
      continue;

    const day = clampInt(bet.leverageProgressionDay, 1, maxDays);
    refs.push({
      matchId: match.id,
      ts: getBetPlacedAt(match),
      day,
      status: bet.status,
    });
  }

  refs.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.matchId.localeCompare(b.matchId);
  });

  return refs;
}

export type NextProgressionDayReason = 'none' | 'won' | 'lost' | 'pending' | 'wrap';

export type NextProgressionDayResult = {
  nextDay: number;
  reason: NextProgressionDayReason;
  lastDay?: number;
};

/**
 * Calcula o próximo dia de progressão baseado no histórico de apostas progressivas.
 * Regra: se a última aposta progressiva foi 'lost', reseta para o dia 1.
 */
export function computeNextProgressionDay(
  savedMatches: SavedAnalysis[] | undefined,
  days: number
): NextProgressionDayResult {
  const maxDays = clampInt(days, 1, 30);
  const matches = savedMatches ?? [];

  const refs = getProgressiveBets(matches, maxDays);
  if (refs.length === 0) return { nextDay: 1, reason: 'none' };

  const last = refs[refs.length - 1];

  if (last.status === 'lost') {
    return { nextDay: 1, reason: 'lost', lastDay: last.day };
  }

  if (last.status === 'pending') {
    // Não avança enquanto pendente (o reinvestimento depende do retorno)
    return { nextDay: last.day, reason: 'pending', lastDay: last.day };
  }

  if (last.status === 'won') {
    const candidate = last.day + 1;
    if (candidate > maxDays) return { nextDay: 1, reason: 'wrap', lastDay: last.day };
    return { nextDay: candidate, reason: 'won', lastDay: last.day };
  }

  return { nextDay: 1, reason: 'none', lastDay: last.day };
}

export type ProgressionDayStatus = {
  status: BetInfo['status'];
  matchId: string;
  ts: number;
};

/**
 * Retorna o status por dia do ciclo atual (após o último 'lost').
 * Útil para pintar a tabela e destacar o próximo dia.
 */
export function computeCurrentCycleDayStatuses(
  savedMatches: SavedAnalysis[] | undefined,
  days: number
): Record<number, ProgressionDayStatus> {
  const maxDays = clampInt(days, 1, 30);
  const matches = savedMatches ?? [];
  const refs = getProgressiveBets(matches, maxDays);

  // Encontrar o último 'lost' e considerar apenas bets após ele
  let lastLostIdx = -1;
  for (let i = refs.length - 1; i >= 0; i--) {
    if (refs[i].status === 'lost') {
      lastLostIdx = i;
      break;
    }
  }

  const cycleRefs = lastLostIdx >= 0 ? refs.slice(lastLostIdx + 1) : refs;

  const byDay: Record<number, ProgressionDayStatus> = {};
  for (const r of cycleRefs) {
    const existing = byDay[r.day];
    if (!existing || r.ts >= existing.ts) {
      byDay[r.day] = { status: r.status, matchId: r.matchId, ts: r.ts };
    }
  }

  return byDay;
}


