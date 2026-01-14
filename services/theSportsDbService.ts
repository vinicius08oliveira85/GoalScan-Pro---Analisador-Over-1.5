import { ExternalLineupsSignal } from '../types';
import { logger } from '../utils/logger';

type TheSportsDbTeam = {
  idTeam?: string;
  strTeam?: string;
  strAlternate?: string;
  strStadium?: string;
  strStadiumLocation?: string;
  strCountry?: string;
};

type TheSportsDbEvent = Record<string, unknown> & {
  idEvent?: string;
  strEvent?: string;
  dateEvent?: string;
  strTime?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strVenue?: string;
  strCountry?: string;
  strCity?: string;
  strHomeFormation?: string;
  strAwayFormation?: string;
  // Campos possíveis de lineup (variam conforme o endpoint/dados)
  strHomeLineup?: string;
  strAwayLineup?: string;
  strHomeLineupSubstitutes?: string;
  strAwayLineupSubstitutes?: string;
  strHomeLineupGoalkeeper?: string;
  strHomeLineupDefense?: string;
  strHomeLineupMidfield?: string;
  strHomeLineupForward?: string;
  strAwayLineupGoalkeeper?: string;
  strAwayLineupDefense?: string;
  strAwayLineupMidfield?: string;
  strAwayLineupForward?: string;
};

type CacheEntry<T> = { value: T; expiresAt: number };

const LS_PREFIX = 'goalscan_thesportsdb_cache_';
const TTL_TEAM_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias
const TTL_EVENT_MS = 6 * 60 * 60 * 1000; // 6 horas

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry?.expiresAt || Date.now() > entry.expiresAt) {
      localStorage.removeItem(`${LS_PREFIX}${key}`);
      return null;
    }
    return entry.value ?? null;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, value: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function getApiKey(): string | null {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const key = viteEnv.VITE_THESPORTSDB_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const apiKey = getApiKey();
  if (!apiKey) return '';
  const base = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/${path}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    params.set(k, s);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function fetchJson<T>(url: string, timeoutMs: number = 8000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function parseLineupList(raw: string | undefined): string[] | null {
  const text = (raw || '').trim();
  if (!text) return null;

  // TheSportsDB costuma separar por ';' ou por quebras de linha
  const parts = text
    .split(/[\n;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;
  // Normalizar removendo números/posições comuns “1. Player”, “GK: Player”
  return parts.map((p) => p.replace(/^\d+\.\s*/, '').replace(/^[A-Z]{1,3}\s*:\s*/i, '').trim()).filter(Boolean);
}

function mergeLineupParts(parts: Array<string | undefined>): string[] | null {
  const merged: string[] = [];
  for (const p of parts) {
    const list = parseLineupList(p);
    if (list && list.length) merged.push(...list);
  }
  const uniq = Array.from(new Set(merged));
  return uniq.length ? uniq : null;
}

function scoreTeamMatch(inputName: string, candidate: TheSportsDbTeam): number {
  const input = normalizeText(inputName);
  const name = normalizeText(candidate.strTeam || '');
  const alt = normalizeText(candidate.strAlternate || '');

  if (!input || !name) return 0;
  if (input === name) return 100;
  if (alt && input === alt) return 95;

  let score = 0;
  if (name.includes(input) || input.includes(name)) score += 60;
  if (alt && (alt.includes(input) || input.includes(alt))) score += 45;

  // Penalizar matches muito fracos
  if (score > 0) {
    const lenRatio = Math.min(input.length, name.length) / Math.max(input.length, name.length);
    score += Math.round(lenRatio * 10);
  }

  return score;
}

async function searchTeamsByName(teamName: string): Promise<TheSportsDbTeam[]> {
  const url = buildUrl('searchteams.php', { t: teamName });
  if (!url) return [];
  const cacheKey = `searchteams_${normalizeText(teamName)}`;
  const cached = getCache<TheSportsDbTeam[]>(cacheKey);
  if (cached) return cached;

  const json = await fetchJson<{ teams?: TheSportsDbTeam[] | null }>(url);
  const teams = Array.isArray(json.teams) ? json.teams : [];
  setCache(cacheKey, teams, TTL_TEAM_MS);
  return teams;
}

async function resolveBestTeam(teamName: string): Promise<TheSportsDbTeam | null> {
  const cacheKey = `team_${normalizeText(teamName)}`;
  const cached = getCache<TheSportsDbTeam | null>(cacheKey);
  if (cached) return cached;

  const teams = await searchTeamsByName(teamName);
  let best: TheSportsDbTeam | null = null;
  let bestScore = 0;
  for (const t of teams) {
    const s = scoreTeamMatch(teamName, t);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }

  // threshold simples para evitar falsos positivos
  const resolved = bestScore >= 55 ? best : null;
  setCache(cacheKey, resolved, TTL_TEAM_MS);
  return resolved;
}

async function searchEventsByName(query: string): Promise<TheSportsDbEvent[]> {
  const url = buildUrl('searchevents.php', { e: query });
  if (!url) return [];
  const cacheKey = `searchevents_${normalizeText(query)}`;
  const cached = getCache<TheSportsDbEvent[]>(cacheKey);
  if (cached) return cached;

  const json = await fetchJson<{ event?: TheSportsDbEvent[] | null }>(url);
  const events = Array.isArray(json.event) ? json.event : [];
  setCache(cacheKey, events, TTL_EVENT_MS);
  return events;
}

async function lookupEvent(eventId: string): Promise<TheSportsDbEvent | null> {
  const url = buildUrl('lookupevent.php', { id: eventId });
  if (!url) return null;
  const cacheKey = `lookupevent_${eventId}`;
  const cached = getCache<TheSportsDbEvent | null>(cacheKey);
  if (cached) return cached;

  const json = await fetchJson<{ events?: TheSportsDbEvent[] | null }>(url);
  const event = Array.isArray(json.events) && json.events[0] ? json.events[0] : null;
  setCache(cacheKey, event, TTL_EVENT_MS);
  return event;
}

function isSameTeams(home: string, away: string, evt: TheSportsDbEvent): boolean {
  const eh = normalizeText(evt.strHomeTeam || '');
  const ea = normalizeText(evt.strAwayTeam || '');
  return eh === normalizeText(home) && ea === normalizeText(away);
}

function matchesDate(matchDate: string, evt: TheSportsDbEvent): boolean {
  const d = (evt.dateEvent || '').trim();
  return d ? d === matchDate : false;
}

/**
 * Busca dados de escalações/venue via TheSportsDB.
 *
 * Observações:
 * - Lesões/suspensões não são garantidas no TheSportsDB; aqui usamos apenas lineup quando existir.
 * - Requer `matchDate` (YYYY-MM-DD) para reduzir ambiguidades.
 */
export async function fetchLineupsFromTheSportsDb(input: {
  homeTeam: string;
  awayTeam: string;
  matchDate?: string;
  matchTime?: string;
}): Promise<ExternalLineupsSignal> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      status: 'disabled',
      provider: 'thesportsdb',
      eventId: null,
      lastUpdatedAt: Date.now(),
      error: 'VITE_THESPORTSDB_API_KEY não configurada.',
    };
  }

  if (!input.matchDate) {
    return {
      status: 'missing_match_date',
      provider: 'thesportsdb',
      eventId: null,
      lastUpdatedAt: Date.now(),
      error: 'matchDate ausente (necessário para buscar evento/lineup).',
    };
  }

  try {
    // Resolver times (ajuda no mapeamento e também melhora mensagens/diagnóstico)
    const [homeTeam, awayTeam] = await Promise.all([
      resolveBestTeam(input.homeTeam),
      resolveBestTeam(input.awayTeam),
    ]);

    if (!homeTeam?.idTeam || !awayTeam?.idTeam) {
      return {
        status: 'not_mapped',
        provider: 'thesportsdb',
        eventId: null,
        venue: {
          name: homeTeam?.strStadium ?? null,
          city: homeTeam?.strStadiumLocation ?? null,
          country: homeTeam?.strCountry ?? null,
        },
        lastUpdatedAt: Date.now(),
        error: 'Não foi possível mapear um ou ambos os times no TheSportsDB.',
      };
    }

    // 1) buscar por nome do evento (mais leve) e filtrar por data/times
    const query = `${input.homeTeam} vs ${input.awayTeam}`;
    const candidates = await searchEventsByName(query);

    const sameDay = candidates.filter((e) => matchesDate(input.matchDate as string, e));
    const bestSameTeams = sameDay.find((e) => isSameTeams(input.homeTeam, input.awayTeam, e)) || null;
    const fallbackSameDay = sameDay[0] || null;
    const chosen = bestSameTeams || fallbackSameDay;

    if (!chosen?.idEvent) {
      return {
        status: 'not_found',
        provider: 'thesportsdb',
        eventId: null,
        lastUpdatedAt: Date.now(),
        error: 'Evento não encontrado no TheSportsDB para a data informada.',
      };
    }

    const detailed = (await lookupEvent(chosen.idEvent)) || chosen;

    const homeStarters = mergeLineupParts([
      detailed.strHomeLineup,
      detailed.strHomeLineupGoalkeeper,
      detailed.strHomeLineupDefense,
      detailed.strHomeLineupMidfield,
      detailed.strHomeLineupForward,
    ]);

    const awayStarters = mergeLineupParts([
      detailed.strAwayLineup,
      detailed.strAwayLineupGoalkeeper,
      detailed.strAwayLineupDefense,
      detailed.strAwayLineupMidfield,
      detailed.strAwayLineupForward,
    ]);

    const homeSubs = parseLineupList(detailed.strHomeLineupSubstitutes);
    const awaySubs = parseLineupList(detailed.strAwayLineupSubstitutes);

    const hasAnyLineup =
      (homeStarters && homeStarters.length > 0) ||
      (awayStarters && awayStarters.length > 0) ||
      (homeSubs && homeSubs.length > 0) ||
      (awaySubs && awaySubs.length > 0);

    return {
      status: hasAnyLineup ? 'ok' : 'not_available',
      provider: 'thesportsdb',
      eventId: detailed.idEvent ?? chosen.idEvent ?? null,
      homeStarters,
      awayStarters,
      homeSubs,
      awaySubs,
      homeFormation: detailed.strHomeFormation ?? null,
      awayFormation: detailed.strAwayFormation ?? null,
      venue: {
        name: (detailed.strVenue as string | undefined) ?? homeTeam.strStadium ?? null,
        city: (detailed.strCity as string | undefined) ?? homeTeam.strStadiumLocation ?? null,
        country: (detailed.strCountry as string | undefined) ?? homeTeam.strCountry ?? null,
      },
      lastUpdatedAt: Date.now(),
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro desconhecido';
    logger.warn('[TheSportsDB] Falha ao buscar lineups:', message);
    return {
      status: 'error',
      provider: 'thesportsdb',
      eventId: null,
      lastUpdatedAt: Date.now(),
      error: message,
    };
  }
}


