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
    // Log do erro para serviço de tracking (quando implementado)
    logger.error('ErrorBoundary capturou um erro:', error, errorInfo);

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
