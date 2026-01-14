import { ExternalWeatherSignal } from '../types';
import { logger } from '../utils/logger';

type CacheEntry<T> = { value: T; expiresAt: number };

const LS_PREFIX = 'goalscan_openmeteo_cache_';
const TTL_GEO_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias
const TTL_FORECAST_MS = 60 * 60 * 1000; // 1 hora

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

async function fetchJson<T>(url: string, timeoutMs: number = 8000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

type OpenMeteoGeoResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    timezone?: string;
  }>;
};

type OpenMeteoForecastResponse = {
  hourly?: {
    time: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
  };
};

async function geocode(query: string): Promise<{ latitude: number; longitude: number; label?: string } | null> {
  const q = query.trim();
  if (!q) return null;

  const cacheKey = `geo_${normalizeText(q)}`;
  const cached = getCache<{ latitude: number; longitude: number; label?: string } | null>(cacheKey);
  if (cached) return cached;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=pt&format=json`;
  const json = await fetchJson<OpenMeteoGeoResponse>(url);
  const first = json.results?.[0];
  const result = first
    ? { latitude: first.latitude, longitude: first.longitude, label: `${first.name}${first.admin1 ? `, ${first.admin1}` : ''}` }
    : null;
  setCache(cacheKey, result, TTL_GEO_MS);
  return result;
}

function parseMatchHour(matchTime?: string): number | null {
  if (!matchTime) return null;
  const m = matchTime.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  return h;
}

function pickNearestHourIndex(times: string[], matchDate: string, targetHour: number | null): number | null {
  if (!times.length) return null;
  const baseHour = targetHour ?? 12; // fallback meio-dia
  const targetPrefix = `${matchDate}T${String(baseHour).padStart(2, '0')}:`;

  // match exato por prefixo
  const exactIdx = times.findIndex((t) => t.startsWith(targetPrefix));
  if (exactIdx >= 0) return exactIdx;

  // fallback: menor diferença absoluta por hora
  const targetDate = new Date(`${matchDate}T${String(baseHour).padStart(2, '0')}:00:00`);
  let bestIdx: number | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i]);
    const diff = Math.abs(dt.getTime() - targetDate.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function computePitchCondition(precipMm: number | null, windKph: number | null): ExternalWeatherSignal['pitchCondition'] {
  const p = precipMm ?? 0;
  const w = windKph ?? 0;
  if (w >= 35) return 'windy';
  if (p >= 6) return 'very_wet';
  if (p >= 2) return 'wet';
  if (p >= 0.2) return 'wet';
  return 'dry';
}

function computeSuggestedDeltaPp(precipMm: number | null, windKph: number | null): number {
  // Heurística simples e conservadora:
  // - chuva e vento tendem a reduzir volume/qualidade (mais bolas longas, menos fluidez)
  const p = precipMm ?? 0;
  const w = windKph ?? 0;
  let delta = 0;
  if (p >= 6) delta -= 8;
  else if (p >= 2) delta -= 5;
  else if (p >= 0.2) delta -= 2;

  if (w >= 45) delta -= 6;
  else if (w >= 35) delta -= 4;
  else if (w >= 25) delta -= 2;

  // clamp
  if (delta < -15) delta = -15;
  if (delta > 0) delta = 0;
  return delta;
}

/**
 * Busca um snapshot de clima (Open-Meteo) para a data/hora da partida.
 * \n * Observações:\n * - Requer `matchDate`.\n * - `query` deve ser algo como cidade/estádio (quanto melhor, melhor o geocode).\n */
export async function fetchWeatherForMatch(input: {
  query: string;
  matchDate?: string;
  matchTime?: string;
}): Promise<ExternalWeatherSignal> {
  if (!input.matchDate) {
    return {
      status: 'missing_match_date',
      provider: 'open-meteo',
      matchDate: null,
      matchTime: input.matchTime ?? null,
      pitchCondition: 'unknown',
      suggestedProbabilityDeltaPp: null,
      lastUpdatedAt: Date.now(),
      error: 'matchDate ausente (necessário para forecast).',
    };
  }

  const q = input.query.trim();
  if (!q) {
    return {
      status: 'not_found',
      provider: 'open-meteo',
      matchDate: input.matchDate,
      matchTime: input.matchTime ?? null,
      pitchCondition: 'unknown',
      suggestedProbabilityDeltaPp: null,
      lastUpdatedAt: Date.now(),
      error: 'Local/venue não informado para geocoding.',
    };
  }

  try {
    const geo = await geocode(q);
    if (!geo) {
      return {
        status: 'not_found',
        provider: 'open-meteo',
        matchDate: input.matchDate,
        matchTime: input.matchTime ?? null,
        pitchCondition: 'unknown',
        suggestedProbabilityDeltaPp: null,
        lastUpdatedAt: Date.now(),
        error: 'Geocoding não encontrou coordenadas.',
      };
    }

    const cacheKey = `forecast_${geo.latitude.toFixed(4)}_${geo.longitude.toFixed(4)}_${input.matchDate}`;
    const cached = getCache<ExternalWeatherSignal>(cacheKey);
    if (cached) return cached;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(geo.latitude))}` +
      `&longitude=${encodeURIComponent(String(geo.longitude))}` +
      `&hourly=temperature_2m,precipitation,wind_speed_10m` +
      `&timezone=auto&start_date=${encodeURIComponent(input.matchDate)}&end_date=${encodeURIComponent(input.matchDate)}`;

    const forecast = await fetchJson<OpenMeteoForecastResponse>(url);
    const hourly = forecast.hourly;
    const times = hourly?.time ?? [];

    const idx = pickNearestHourIndex(times, input.matchDate, parseMatchHour(input.matchTime));
    const temp = idx != null ? hourly?.temperature_2m?.[idx] ?? null : null;
    const precip = idx != null ? hourly?.precipitation?.[idx] ?? null : null;
    const wind = idx != null ? hourly?.wind_speed_10m?.[idx] ?? null : null;

    const signal: ExternalWeatherSignal = {
      status: idx != null ? 'ok' : 'not_available',
      provider: 'open-meteo',
      latitude: geo.latitude,
      longitude: geo.longitude,
      matchDate: input.matchDate,
      matchTime: input.matchTime ?? null,
      temperatureC: temp,
      precipitationMm: precip,
      windKph: wind,
      pitchCondition: computePitchCondition(precip, wind),
      suggestedProbabilityDeltaPp: computeSuggestedDeltaPp(precip, wind),
      lastUpdatedAt: Date.now(),
      error: null,
    };

    setCache(cacheKey, signal, TTL_FORECAST_MS);
    return signal;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro desconhecido';
    logger.warn('[OpenMeteo] Falha ao buscar forecast:', message);
    return {
      status: 'error',
      provider: 'open-meteo',
      matchDate: input.matchDate,
      matchTime: input.matchTime ?? null,
      pitchCondition: 'unknown',
      suggestedProbabilityDeltaPp: null,
      lastUpdatedAt: Date.now(),
      error: message,
    };
  }
}


