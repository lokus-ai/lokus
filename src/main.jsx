import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { ErrorBoundary, ErrorFallback } from './components/error/ErrorBoundary'
import App from './App'
import { ThemeProvider } from './hooks/theme'
import './styles/globals.css'
import { logger } from './utils/logger.js'

// Initialize Sentry SDK before rendering
if (import.meta.env.VITE_ENABLE_CRASH_REPORTS === 'true') {
  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in dev
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      // Additional options
      beforeSend(event, hint) {
        // Filter out known noisy errors
        if (event.exception) {
          const errorMessage = event.exception.values?.[0]?.value || '';
          // Filter out WebView2 cleanup warnings
          if (errorMessage.includes('WebView2')) {
            return null;
          }
        }
        return event;
      },
    });

    logger.info('Main', 'Sentry SDK initialized successfully');
  } catch (error) {
    logger.error('Main', 'Failed to initialize Sentry SDK:', error);
  }
} else {
  logger.info('Main', 'Crash reporting disabled');
}

import { RemoteConfigProvider } from './contexts/RemoteConfigContext'

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={ErrorFallback}
      showDialog={false}
      onError={(error, errorInfo) => {
        logger.error('ErrorBoundary', 'React Error Boundary caught:', error, errorInfo);
      }}
    >
      <RemoteConfigProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </RemoteConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);