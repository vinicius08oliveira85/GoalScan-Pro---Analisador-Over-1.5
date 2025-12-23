// Implementação web (mock) do plugin WidgetSync
export class WidgetSyncWeb {
  async syncData(options: { savedMatches?: string; bankSettings?: string }): Promise<{ success: boolean }> {
    // No web, não há widgets Android, então apenas retornar sucesso
    return { success: true };
  }
}

