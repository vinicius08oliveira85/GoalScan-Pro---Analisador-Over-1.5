import { logger } from './logger';

const STORAGE_KEY = 'goalscan_refresh_metadata';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RefreshMetadata {
  lastRefresh: number;
  nextScheduledRefresh: number;
  lastError?: string;
}

function loadMetadata(): RefreshMetadata {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.lastRefresh === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { lastRefresh: 0, nextScheduledRefresh: 0 };
}

function saveMetadata(meta: RefreshMetadata): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // storage full or unavailable
  }
}

export function getLastRefreshTime(): number {
  return loadMetadata().lastRefresh;
}

export function getNextRefreshTime(): number {
  return loadMetadata().nextScheduledRefresh;
}

export function isDataStale(): boolean {
  const meta = loadMetadata();
  if (meta.lastRefresh === 0) return true;
  return Date.now() - meta.lastRefresh > REFRESH_INTERVAL_MS;
}

export function getTimeUntilNextRefresh(): number {
  const meta = loadMetadata();
  if (meta.nextScheduledRefresh === 0) return 0;
  return Math.max(0, meta.nextScheduledRefresh - Date.now());
}

function getMillisecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let onRefreshCallback: (() => Promise<void>) | null = null;

function scheduleNextRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const msUntilMidnight = getMillisecondsUntilMidnight();
  const meta = loadMetadata();
  meta.nextScheduledRefresh = Date.now() + msUntilMidnight;
  saveMetadata(meta);

  if (import.meta.env.DEV) {
    const mins = Math.round(msUntilMidnight / 60000);
    logger.log(`[AutoRefresh] Próximo refresh em ${mins} minutos (meia-noite)`);
  }

  refreshTimer = setTimeout(async () => {
    if (import.meta.env.DEV) {
      logger.log('[AutoRefresh] Hora do refresh programado (00:00)');
    }

    if (onRefreshCallback) {
      try {
        await onRefreshCallback();
        markRefreshed();
      } catch (err) {
        const meta = loadMetadata();
        meta.lastError = err instanceof Error ? err.message : 'Erro desconhecido';
        saveMetadata(meta);
        logger.error('[AutoRefresh] Erro no refresh programado:', err);
      }
    }

    scheduleNextRefresh();
  }, msUntilMidnight);
}

export function markRefreshed(): void {
  const meta = loadMetadata();
  meta.lastRefresh = Date.now();
  meta.lastError = undefined;
  saveMetadata(meta);
}

export function markRefreshError(error: string): void {
  const meta = loadMetadata();
  meta.lastError = error;
  saveMetadata(meta);
}

export function getLastError(): string | undefined {
  return loadMetadata().lastError;
}

export function startAutoRefresh(callback: () => Promise<void>): () => void {
  onRefreshCallback = callback;

  if (import.meta.env.DEV) {
    logger.log('[AutoRefresh] Iniciando scheduler de refresh diário');
  }

  scheduleNextRefresh();

  if (isDataStale()) {
    if (import.meta.env.DEV) {
      logger.log('[AutoRefresh] Dados desatualizados, disparando refresh imediato');
    }
    setTimeout(() => {
      if (onRefreshCallback) {
        onRefreshCallback()
          .then(() => markRefreshed())
          .catch((err) => {
            markRefreshError(err instanceof Error ? err.message : 'Erro desconhecido');
          });
      }
    }, 3000);
  }

  return () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    onRefreshCallback = null;
  };
}
