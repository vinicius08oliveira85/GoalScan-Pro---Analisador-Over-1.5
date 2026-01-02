import React from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Analytics (opcional - requer consentimento do usuário)
// import { analyticsService } from './services/analyticsService';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
