import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { queryClient } from './lib/query-client';
import { initSentry } from './lib/sentry';
import i18n from './lib/i18n';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import App from './App.tsx';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>,
);
