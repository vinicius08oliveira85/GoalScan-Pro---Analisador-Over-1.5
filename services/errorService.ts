/**
 * Serviço centralizado para tratamento de erros
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

class ErrorService {
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private maxQueueSize = 50;

  /**
   * Registra um erro com contexto
   */
  logError(error: Error, context: Partial<ErrorContext> = {}): void {
    const errorContext: ErrorContext = {
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...context
    };

    // Adicionar à fila
    this.errorQueue.push({ error, context: errorContext });

    // Limitar tamanho da fila
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Log no console em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Erro registrado:', error, errorContext);
    }

    // Aqui podemos enviar para serviço externo (Sentry, etc.)
    // this.sendToErrorTracking(error, errorContext);
  }

  /**
   * Registra um erro de validação
   */
  logValidationError(field: string, value: unknown, message: string): void {
    const error = new Error(`Validação falhou: ${message}`);
    error.name = 'ValidationError';
    this.logError(error, {
      component: 'Validation',
      action: `validate_${field}`,
      // @ts-ignore
      validationValue: value
    });
  }

  /**
   * Registra um erro de API
   */
  logApiError(endpoint: string, status: number, message: string): void {
    const error = new Error(`API Error: ${message}`);
    error.name = 'ApiError';
    this.logError(error, {
      component: 'API',
      action: endpoint,
      // @ts-ignore
      statusCode: status
    });
  }

  /**
   * Obtém a fila de erros (útil para debug)
   */
  getErrorQueue(): Array<{ error: Error; context: ErrorContext }> {
    return [...this.errorQueue];
  }

  /**
   * Limpa a fila de erros
   */
  clearErrorQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Envia erros para serviço de tracking externo
   * (Implementar quando integrar Sentry ou similar)
   * 
   * Para integrar Sentry:
   * 1. npm install @sentry/react
   * 2. Configurar em index.tsx:
   *    import * as Sentry from "@sentry/react";
   *    Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
   * 3. Descomentar código abaixo
   */
  private sendToErrorTracking(error: Error, context: ErrorContext): void {
    // Integração com Sentry (quando configurado)
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Sentry) {
      // @ts-ignore
      window.Sentry.captureException(error, { 
        extra: context,
        tags: {
          component: context.component,
          action: context.action
        }
      });
    }
    
    // Em produção, também pode enviar para endpoint próprio
    if (process.env.NODE_ENV === 'production' && typeof fetch !== 'undefined') {
      // Opcional: enviar para endpoint de logging próprio
      // fetch('/api/logs', { method: 'POST', body: JSON.stringify({ error, context }) })
      //   .catch(() => {}); // Falha silenciosa
    }
  }
}

// Singleton
export const errorService = new ErrorService();

