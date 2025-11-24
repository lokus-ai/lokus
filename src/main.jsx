import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/theme.jsx";
import "./styles/globals.css";
import "./styles/kanban.css";
import "./styles/windows.css";

// Sentry crash reporting integration
import * as Sentry from "@sentry/react";
import { ErrorBoundary, ErrorFallback } from "./components/error/ErrorBoundary";

// Analytics integration
import analytics from "./services/analytics";

// Load KaTeX for math rendering
import katex from "katex";
import "katex/dist/katex.min.css";

// Track app startup time
const appStartTime = performance.now();

// Make KaTeX globally available for the math extension
if (typeof globalThis !== 'undefined') {
  globalThis.katex = katex;
} else if (typeof window !== 'undefined') {
  window.katex = katex;
}

// Make React globally available for plugins
if (typeof globalThis !== 'undefined') {
  globalThis.React = React;
} else if (typeof window !== 'undefined') {
  window.React = React;
}

// Initialize Sentry for crash reporting
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnabled = import.meta.env.VITE_ENABLE_CRASH_REPORTS === 'true';
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production';

if (sentryDsn && sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of errors
    // Release tracking
    release: `lokus@${import.meta.env.VITE_APP_VERSION || 'dev'}`,
    beforeSend(event) {
      // Don't send events in development unless explicitly enabled
      if (sentryEnvironment === 'development') {
        console.log('Sentry event (dev):', event);
      }
      return event;
    },
  });
  console.log('✅ Sentry initialized:', { environment: sentryEnvironment, dsn: sentryDsn.substring(0, 50) + '...' });
} else {
  console.log('⚠️ Sentry disabled:', { dsn: !!sentryDsn, enabled: sentryEnabled });
}

// Initialize analytics service
(async () => {
  try {
    await analytics.initialize();
    console.log('✅ Analytics initialized');

    // Track startup time after a brief delay to ensure app is fully loaded
    setTimeout(() => {
      const startupDuration = performance.now() - appStartTime;
      analytics.trackStartupTime(startupDuration);
    }, 1000);
  } catch (error) {
    console.error('⚠️ Analytics initialization failed:', error);
  }
})();

console.log('🚀 Main.jsx starting to render');
console.log('🚀 Window location:', window.location.href);
console.log('🚀 DOM root element:', document.getElementById("root"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={ErrorFallback}
      showDialog={false}
      onError={(error, errorInfo) => {
        console.error('React Error Boundary caught:', error, errorInfo);
      }}
    >
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);