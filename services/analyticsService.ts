/**
 * Serviço de Analytics respeitando LGPD
 * 
 * IMPORTANTE: Este serviço está preparado para integração futura.
 * Antes de ativar, certifique-se de:
 * 1. Obter consentimento explícito do usuário (LGPD)
 * 2. Implementar política de privacidade
 * 3. Configurar variáveis de ambiente para chaves de API
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

class AnalyticsService {
  private enabled: boolean = false;
  private consentGiven: boolean = false;
  private eventQueue: AnalyticsEvent[] = [];

  /**
   * Solicita consentimento do usuário para analytics
   * Deve ser chamado antes de qualquer tracking
   */
  requestConsent(): Promise<boolean> {
    return new Promise((resolve) => {
      // Em produção, mostrar modal de consentimento
      // Por enquanto, desabilitado por padrão
      const consent = localStorage.getItem('analytics_consent');
      if (consent === 'true') {
        this.consentGiven = true;
        this.enabled = true;
        this.flushQueue();
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Ativa analytics (após consentimento)
   */
  enable(): void {
    if (this.consentGiven) {
      this.enabled = true;
      this.flushQueue();
    }
  }

  /**
   * Desativa analytics
   */
  disable(): void {
    this.enabled = false;
    this.consentGiven = false;
    this.eventQueue = [];
    localStorage.removeItem('analytics_consent');
  }

  /**
   * Registra um evento (respeitando consentimento)
   */
  track(eventName: string, properties?: Record<string, unknown>): void {
    if (!this.enabled || !this.consentGiven) {
      // Adicionar à fila para enviar quando consentimento for dado
      this.eventQueue.push({
        name: eventName,
        properties,
        timestamp: Date.now()
      });
      return;
    }

    // Enviar evento
    this.sendEvent(eventName, properties);
  }

  /**
   * Envia evento para serviço de analytics
   * (Preparado para integração com Google Analytics, Plausible, etc.)
   */
  private sendEvent(eventName: string, properties?: Record<string, unknown>): void {
    // Google Analytics 4 (quando configurado)
    // @ts-ignore
    if (typeof window !== 'undefined' && window.gtag) {
      // @ts-ignore
      window.gtag('event', eventName, properties);
    }

    // Plausible Analytics (quando configurado)
    // @ts-ignore
    if (typeof window !== 'undefined' && window.plausible) {
      // @ts-ignore
      window.plausible(eventName, { props: properties });
    }

    // Log em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', eventName, properties);
    }
  }

  /**
   * Envia eventos da fila quando analytics é ativado
   */
  private flushQueue(): void {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        this.sendEvent(event.name, event.properties);
      }
    }
  }

  /**
   * Registra visualização de página
   */
  pageView(path: string): void {
    this.track('page_view', { path });
  }

  /**
   * Registra ação do usuário
   */
  userAction(action: string, details?: Record<string, unknown>): void {
    this.track('user_action', { action, ...details });
  }
}

// Singleton
export const analyticsService = new AnalyticsService();

/**
 * Hook para usar analytics em componentes React
 * 
 * Exemplo de uso:
 * const analytics = useAnalytics();
 * analytics.track('match_saved', { matchId: '123' });
 */
export const useAnalytics = () => {
  return {
    track: analyticsService.track.bind(analyticsService),
    pageView: analyticsService.pageView.bind(analyticsService),
    userAction: analyticsService.userAction.bind(analyticsService),
    requestConsent: analyticsService.requestConsent.bind(analyticsService),
    enable: analyticsService.enable.bind(analyticsService),
    disable: analyticsService.disable.bind(analyticsService)
  };
};

