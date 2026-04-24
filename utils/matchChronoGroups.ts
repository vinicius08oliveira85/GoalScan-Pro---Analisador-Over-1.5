import { SavedAnalysis } from '../types';

const BR_TZ = 'America/Sao_Paulo';

/** YYYY-MM-DD no calendário de Brasília */
export function getBrasiliaDayKeyFromMillis(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** Chave de dia para agrupar: data do jogo se existir; senão dia do salvamento */
export function getMatchDayKeyForGrouping(match: SavedAnalysis): string {
  if (match.data.matchDate) return match.data.matchDate;
  return getBrasiliaDayKeyFromMillis(match.timestamp);
}

function shiftCalendarDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const shifted = new Date(utc + deltaDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

/** Dias entre dayKey e hoje (Brasília); positivo = dayKey no passado */
export function calendarDaysBeforeToday(dayKey: string, todayKey: string): number {
  const [y1, m1, d1] = dayKey.split('-').map(Number);
  const [y2, m2, d2] = todayKey.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export interface ChronoSection {
  id: string;
  label: string;
  matches: SavedAnalysis[];
}

/**
 * Agrupa partidas já ordenadas em seções Hoje / Ontem / Esta semana (2–6 dias atrás) / demais datas.
 */
export function groupMatchesByChronoSections(matches: SavedAnalysis[]): ChronoSection[] {
  const todayKey = getBrasiliaDayKeyFromMillis(Date.now());
  const yesterdayKey = shiftCalendarDayKey(todayKey, -1);

  const sectionMap = new Map<string, SavedAnalysis[]>();
  const sectionOrder: string[] = [];

  const add = (id: string, m: SavedAnalysis) => {
    if (!sectionMap.has(id)) {
      sectionMap.set(id, []);
      sectionOrder.push(id);
    }
    sectionMap.get(id)!.push(m);
  };

  for (const match of matches) {
    const dayKey = getMatchDayKeyForGrouping(match);
    const diff = calendarDaysBeforeToday(dayKey, todayKey);

    if (dayKey === todayKey) {
      add('hoje', match);
    } else if (dayKey === yesterdayKey) {
      add('ontem', match);
    } else if (diff >= 2 && diff <= 6) {
      add('semana', match);
    } else {
      add(`day:${dayKey}`, match);
    }
  }

  const dayKeysSorted = [...sectionMap.keys()]
    .filter((k) => k.startsWith('day:'))
    .sort((a, b) => b.slice(4).localeCompare(a.slice(4)));

  const orderedIds: string[] = [];
  if (sectionMap.has('hoje')) orderedIds.push('hoje');
  if (sectionMap.has('ontem')) orderedIds.push('ontem');
  if (sectionMap.has('semana')) orderedIds.push('semana');
  orderedIds.push(...dayKeysSorted);

  const labelForId = (id: string): string => {
    if (id === 'hoje') return 'Hoje';
    if (id === 'ontem') return 'Ontem';
    if (id === 'semana') return 'Esta semana';
    const key = id.slice(4);
    const [Y, M, D] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(Y, M - 1, D, 12, 0, 0));
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dt);
  };

  return orderedIds
    .filter((id) => sectionMap.has(id))
    .map((id) => ({
      id,
      label: labelForId(id),
      matches: sectionMap.get(id)!,
    }));
}
