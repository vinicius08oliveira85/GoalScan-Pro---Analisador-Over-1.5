import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    const isLazyLoadError =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('404') ||
      error.message?.includes('dynamically imported module');

    if (isLazyLoadError && typeof window !== 'undefined' && !window.location.href.includes('reload=true')) {
      setTimeout(() => {
        window.location.href = window.location.href.split('?')[0] + '?reload=true';
        window.location.reload();
      }, 100);
      return { hasError: false, error: null };
    }

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isLazyLoadError =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('404') ||
      error.message?.includes('dynamically imported module');

    if (isLazyLoadError) return;

    if (import.meta.env.DEV || !isLazyLoadError) {
      logger.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

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
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-xs opacity-60 mb-2">
                  Detalhes do erro (modo desenvolvimento)
                </summary>
                <pre className="text-xs bg-base-300 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
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