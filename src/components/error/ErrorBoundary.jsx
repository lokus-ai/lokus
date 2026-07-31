import React from 'react';
import { captureException } from '../../services/telemetry.js';

/**
 * Fallback UI shown when a component crashes
 */
function ErrorFallback({ error, componentStack, resetError }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      padding: '2rem',
      backgroundColor: 'var(--app-bg, #1e1e1e)',
      color: 'var(--app-text, #ffffff)',
    }}>
      <div style={{ maxWidth: '600px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
        <p style={{ color: 'var(--app-muted, #888)', marginBottom: '2rem' }}>
          The application encountered an unexpected error. This has been automatically reported.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details style={{
            textAlign: 'left',
            backgroundColor: 'var(--app-panel, #2a2a2a)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            maxHeight: '300px',
            overflow: 'auto',
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Error Details (Development Only)
            </summary>
            <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error.toString()}
              {componentStack}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={resetError}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'rgb(var(--accent, 88, 101, 242))',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--app-panel, #2a2a2a)',
              color: 'var(--app-text, #ffffff)',
              border: '1px solid var(--app-border, #444)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            Reload Application
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Application error boundary.
 *
 * Was `Sentry.ErrorBoundary`, which pinned the whole reporting SDK into the
 * boot chunk for a feature that ships disabled. This keeps the same contract
 * the one call site relies on — a `fallback` component receiving
 * `{ error, componentStack, resetError }`, plus `onError` — and reports
 * through the telemetry shim, which is a no-op unless crash reports are on.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ componentStack: errorInfo?.componentStack ?? null });
    captureException(error, {
      extra: { componentStack: errorInfo?.componentStack },
    });
    this.props.onError?.(error, errorInfo);
  }

  resetError() {
    this.setState({ error: null, componentStack: null });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const Fallback = this.props.fallback;
    if (typeof Fallback === 'function') {
      return <Fallback error={error} componentStack={componentStack} resetError={this.resetError} />;
    }
    return Fallback ?? null;
  }
}

export { ErrorBoundary, ErrorFallback };
export default ErrorBoundary;
