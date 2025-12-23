import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface WidgetSyncPlugin {
  syncData(options: { savedMatches?: string; bankSettings?: string }): Promise<{ success: boolean }>;
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync', {
  web: () => import('./widgetSyncService.web').then(m => new m.WidgetSyncWeb()),
});

/**
 * Sincroniza dados com os widgets Android
 * Deve ser chamado sempre que os dados forem salvos/atualizados
 */
export const syncDataToWidgets = async (savedMatches?: any[], bankSettings?: any) => {
  // Apenas sincronizar no Android
  if (Capacitor.getPlatform() !== 'android') {
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
    console.error('Erro ao sincronizar dados com widgets:', error);
    // Não lançar erro - widgets podem funcionar com dados antigos
  }
};

/**
 * Sincroniza apenas partidas salvas
 */
export const syncMatchesToWidgets = async (savedMatches: any[]) => {
  await syncDataToWidgets(savedMatches, undefined);
};

/**
 * Sincroniza apenas configurações de banca
 */
export const syncBankToWidgets = async (bankSettings: any) => {
  await syncDataToWidgets(undefined, bankSettings);
};

