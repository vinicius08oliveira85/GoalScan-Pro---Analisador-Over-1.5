import { logger } from '../utils/logger';
import type { SavedAnalysis, BankSettings } from '../types';

export interface WidgetSyncPlugin {
  syncData(options: {
    savedMatches?: string;
    bankSettings?: string;
  }): Promise<{ success: boolean }>;
}

// Verificar se estamos em ambiente web (build Vercel) ou nativo
const isWebBuild = typeof window === 'undefined' || !(window as Window & { Capacitor?: unknown }).Capacitor;

// Importação condicional do Capacitor (apenas disponível no ambiente nativo)
let Capacitor: typeof import('@capacitor/core') | null = null;
let WidgetSync: WidgetSyncPlugin | null = null;

// Função para inicializar Capacitor de forma segura
async function initCapacitor() {
  // Se for build web, não tentar importar Capacitor
  if (isWebBuild) {
    Capacitor = { getPlatform: () => 'web' };
    return;
  }

  try {
    // Importação dinâmica apenas no runtime, não durante o build
    const capacitorModule = await import('@capacitor/core');
    Capacitor = capacitorModule.Capacitor;
    const { registerPlugin } = capacitorModule;

    WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync', {
      web: () => import('./widgetSyncService.web').then((m) => new m.WidgetSyncWeb()),
    });
  } catch {
    // Capacitor não disponível - usar fallback
    Capacitor = { getPlatform: () => 'web' };
  }
}

// Inicializar na primeira chamada
let initPromise: Promise<void> | null = null;

/**
 * Sincroniza dados com os widgets Android
 * Deve ser chamado sempre que os dados forem salvos/atualizados
 */
export const syncDataToWidgets = async (savedMatches?: SavedAnalysis[], bankSettings?: BankSettings) => {
  // Inicializar Capacitor se ainda não foi inicializado
  if (!initPromise) {
    initPromise = initCapacitor();
  }
  await initPromise;

  // Apenas sincronizar no Android
  if (!Capacitor || Capacitor.getPlatform() !== 'android') {
    return;
  }

  // Se plugin não estiver disponível, retornar silenciosamente
  if (!WidgetSync) {
    return;
  }

  try {
    const options: { savedMatches?: string; bankSettings?: string } = {};

    if (savedMatches) {
      options.savedMatches = JSON.stringify(savedMatches);
    }

    if (bankSettings) {
      options.bankSettings = JSON.stringify(bankSettings);
    }

    await WidgetSync.syncData(options);
  } catch (error) {
    logger.error('Erro ao sincronizar dados com widgets:', error);
    // Não lançar erro - widgets podem funcionar com dados antigos
  }
};

/**
 * Sincroniza apenas partidas salvas
 */
export const syncMatchesToWidgets = async (savedMatches: SavedAnalysis[]) => {
  await syncDataToWidgets(savedMatches, undefined);
};

/**
 * Sincroniza apenas configurações de banca
 */
export const syncBankToWidgets = async (bankSettings: BankSettings) => {
  await syncDataToWidgets(undefined, bankSettings);
};
