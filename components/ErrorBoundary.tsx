import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignorar erros de lazy loading de módulos (404 esperados em caso de cache/build)
    const isLazyLoadError = 
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('404');
    
    if (isLazyLoadError) {
      // Tentar recarregar a página automaticamente para resolver problema de cache
      if (typeof window !== 'undefined' && !window.location.href.includes('reload=true')) {
        // Log apenas em dev
        if (import.meta.env.DEV) {
          logger.warn('ErrorBoundary: Erro de lazy loading detectado, recarregando página...');
        }
        // Recarregar página para resolver problema de cache
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      }
    }

    // Log do erro para serviço de tracking (quando implementado)
    // Apenas logar em dev ou se não for erro de lazy loading
    if (import.meta.env.DEV || !isLazyLoadError) {
      logger.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });

    // Aqui podemos enviar para serviço de error tracking
    // Ex: errorTrackingService.logError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-base-100">
          <div className="custom-card p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-16 h-16 text-error" />
            </div>
            <h1 className="text-2xl font-black mb-4">Ops! Algo deu errado</h1>
            <p className="text-sm opacity-70 mb-6">
              Ocorreu um erro inesperado. Por favor, tente recarregar a página.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-xs opacity-60 mb-2">
                  Detalhes do erro (modo desenvolvimento)
                </summary>
                <pre className="text-xs bg-base-300 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button onClick={this.handleReset} className="btn btn-primary gap-2">
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-outline btn-secondary mt-2 w-full"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
