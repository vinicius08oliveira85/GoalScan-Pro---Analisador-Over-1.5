import { logger } from './logger';

const STORAGE_KEY_SERVICE_STATUS = 'goalscan_supabase_status';
const SERVICE_STATUS_CACHE_DURATION = 60000; // 1 minuto

interface ServiceStatus {
  isUnavailable: boolean;
  lastCheck: number;
  retryAfter: number;
}

/**
 * Verifica se um erro é um erro HTTP temporário (503, 502, 504, 429, 408).
 */
export function isTemporaryError(error: unknown): boolean {
  if (!error) return false;

  const err = error as {
    message?: string;
    code?: string | number;
    status?: number;
    statusCode?: number;
    error?: string;
  };

  if (err.error && typeof err.error === 'string') {
    const errorStr = err.error.toLowerCase();
    if (
      errorStr.includes('service unavailable') ||
      errorStr.includes('503') ||
      errorStr.includes('502') ||
      errorStr.includes('504')
    ) {
      return true;
    }
  }

  const statusCode =
    err.status || err.statusCode || (typeof err.code === 'number' ? err.code : null);

  const temporaryStatusCodes = [503, 502, 504, 429, 408];
  if (statusCode && temporaryStatusCodes.includes(statusCode)) {
    return true;
  }

  const message = (err.message || '').toLowerCase();
  return (
    message.includes('503') ||
    message.includes('service unavailable') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('gateway timeout') ||
    message.includes('insufficient resources')
  );
}

/**
 * Verifica se o serviço Supabase está marcado como indisponível
 * (circuit-breaker baseado em localStorage).
 */
export function isServiceUnavailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    const stored = localStorage.getItem(STORAGE_KEY_SERVICE_STATUS);
    if (!stored) return false;

    const status = JSON.parse(stored) as ServiceStatus;
    const now = Date.now();

    if (
      status.isUnavailable &&
      now < status.retryAfter &&
      now - status.lastCheck < SERVICE_STATUS_CACHE_DURATION
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Marca o serviço Supabase como indisponível por SERVICE_STATUS_CACHE_DURATION.
 */
export function setServiceUnavailable(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const status: ServiceStatus = {
      isUnavailable: true,
      lastCheck: Date.now(),
      retryAfter: Date.now() + SERVICE_STATUS_CACHE_DURATION,
    };
    localStorage.setItem(STORAGE_KEY_SERVICE_STATUS, JSON.stringify(status));
  } catch {
    // ignore
  }
}

export { SERVICE_STATUS_CACHE_DURATION };
