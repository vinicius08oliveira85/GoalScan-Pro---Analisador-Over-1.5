import { logger } from '../utils/logger';

const FOOTYSTATS_API_URL = '/api/footystats-extract';
const FOOTYSTATS_BRASILEIRAO_URL = 'https://footystats.org/brazil/serie-a';

export interface FootyStatsResult {
  success: boolean;
  data?: {
    tables?: Record<string, unknown[]>;
    missingTables?: string[];
  };
  error?: string;
}

/**
 * Extrai a tabela do footystats.org via API Python no Vercel
 */
export async function extractFootyStatsTable(url?: string): Promise<FootyStatsResult> {
  const targetUrl = url || FOOTYSTATS_BRASILEIRAO_URL;

  try {
    if (!targetUrl.includes('footystats.org')) {
      return {
        success: false,
        error: 'URL inválida. Apenas URLs do footystats.org são permitidas.',
      };
    }

    const response = await fetch(FOOTYSTATS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        extractTypes: ['table'],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      let errorMessage = `Erro HTTP ${response.status}`;
      try {
        const errorData = await response.json() as { error?: string };
        if (errorData?.error) errorMessage = errorData.error;
      } catch {}
      return { success: false, error: errorMessage };
    }

    const result = await response.json() as FootyStatsResult;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    logger.error('[FootyStatsService] Erro:', error);
    return { success: false, error: `Erro ao extrair do FootyStats: ${message}` };
  }
}
