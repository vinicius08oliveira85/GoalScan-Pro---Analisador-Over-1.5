import { safeJsonParse } from './safeJsonParse';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cria utilitários de cache genéricos no localStorage com TTL.
 *
 * @param prefix - Prefixo das chaves para evitar colisões
 *
 * @example
 * ```ts
 * const { getCache, setCache } = createLocalStorageCache('goalscan_weather_');
 * setCache('geo_london', { lat: 51.5 }, 14 * 86400_000);
 * const geo = getCache<{ lat: number }>('geo_london');
 * ```
 */
export function createLocalStorageCache<T>(prefix: string) {
  return {
    getCache(key: string): T | null {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const raw = localStorage.getItem(`${prefix}${key}`);
        if (!raw) return null;
        const entry = safeJsonParse<CacheEntry<T>>(raw);
        if (!entry?.expiresAt || Date.now() > entry.expiresAt) {
          localStorage.removeItem(`${prefix}${key}`);
          return null;
        }
        return entry.value ?? null;
      } catch {
        return null;
      }
    },

    setCache(key: string, value: T, ttlMs: number): void {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
        localStorage.setItem(`${prefix}${key}`, JSON.stringify(entry));
      } catch {
        // ignore quota or private-mode errors
      }
    },

    removeCache(key: string): void {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        localStorage.removeItem(`${prefix}${key}`);
      } catch {
        // ignore
      }
    },
  };
}
