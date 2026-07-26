import { createLocalStorageCache } from '../utils/localStorageCache';
import { logger } from '../utils/logger';

export interface MatchScore {
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  status: 'not_started' | 'live' | 'finished' | 'unknown';
  lastUpdated: number;
}

export interface GoogleMatchSyncResult {
  success: boolean;
  score?: MatchScore;
  error?: string;
}

const CACHE_KEY_PREFIX = 'goalscan_score_cache_';
const CACHE_TTL_LIVE = 2 * 60 * 1000;
const CACHE_TTL_FINISHED = 30 * 60 * 1000;
const RATE_LIMIT_MS = 30 * 1000;

const { getCache, setCache } = createLocalStorageCache<MatchScore>(CACHE_KEY_PREFIX);

function getCacheKey(homeTeam: string, awayTeam: string): string {
  return `${homeTeam.toLowerCase()}_${awayTeam.toLowerCase()}`.replace(/[^a-z0-9_]/g, '_');
}

function getCachedScore(homeTeam: string, awayTeam: string): MatchScore | null {
  try {
    const cacheKey = getCacheKey(homeTeam, awayTeam);
    const cached = getCache<MatchScore & { timestamp: number }>(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age < RATE_LIMIT_MS) {
      return cached;
    }

    return cached;
  } catch {
    return null;
  }
}

function setCachedScore(homeTeam: string, awayTeam: string, score: MatchScore): void {
  const cacheKey = getCacheKey(homeTeam, awayTeam);
  const ttl = score.status === 'live' ? CACHE_TTL_LIVE : CACHE_TTL_FINISHED;
  setCache(cacheKey, { ...score, timestamp: Date.now() } as MatchScore & { timestamp: number }, ttl);
}

/**
 * Busca placar ao vivo via API pública gratuita TheSportsDB
 */
async function fetchScoreFromApi(homeTeam: string, awayTeam: string): Promise<MatchScore | null> {
  try {
    const query = `${homeTeam} vs ${awayTeam}`;
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const events = data?.event;
    if (!Array.isArray(events) || events.length === 0) return null;

    const event = events[0];
    const homeScore = event.intHomeScore != null ? Number(event.intHomeScore) : null;
    const awayScore = event.intAwayScore != null ? Number(event.intAwayScore) : null;
    const status = event.strStatus?.toLowerCase() || 'unknown';

    let mappedStatus: MatchScore['status'] = 'unknown';
    if (status.includes('finished') || status.includes('final')) {
      mappedStatus = 'finished';
    } else if (status.includes('live') || status.includes('in progress')) {
      mappedStatus = 'live';
    } else if (status.includes('scheduled') || status.includes('not started')) {
      mappedStatus = 'not_started';
    }

    return {
      homeScore: homeScore != null && !isNaN(homeScore) ? homeScore : null,
      awayScore: awayScore != null && !isNaN(awayScore) ? awayScore : null,
      minute: null,
      status: mappedStatus,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    logger.warn('[googleMatchSync] TheSportsDB API falhou:', err);
    return null;
  }
}

export async function syncMatchScore(
  homeTeam: string,
  awayTeam: string,
  _matchDate?: string
): Promise<GoogleMatchSyncResult> {
  const cached = getCachedScore(homeTeam, awayTeam);
  if (cached) {
    return { success: true, score: cached };
  }

  const apiScore = await fetchScoreFromApi(homeTeam, awayTeam);
  if (apiScore) {
    setCachedScore(homeTeam, awayTeam, apiScore);
    return { success: true, score: apiScore };
  }

  return {
    success: false,
    error: 'Placar não encontrado. O navegador bloqueia scraping do Google (CORS). Para placares ao vivo, implemente um backend proxy ou use uma API de futebol com chave (ex: API-Football, TheSportsDB free key).',
  };
}

export function clearScoreCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    logger.warn('[GoogleMatchSync] Erro ao limpar cache:', e);
  }
}
