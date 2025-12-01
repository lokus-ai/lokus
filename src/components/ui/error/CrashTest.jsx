import React, { useState } from 'react';
import * as Sentry from '@sentry/react';

/**
 * Development-only crash testing component
 * Provides buttons to test various error scenarios
 * Only renders in development mode
 */
function CrashTest() {
  const [shouldThrow, setShouldThrow] = useState(false);

  // Only show in development
  if (import.meta.env.MODE !== 'development' && import.meta.env.VITE_SENTRY_ENVIRONMENT !== 'development') {
    return null;
  }

  // Test React error boundary
  if (shouldThrow) {
    throw new Error('Test React Error Boundary - This is intentional for testing crash reporting');
  }

  // Test async error
  const testAsyncError = async () => {
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'User triggered async error test',
      level: 'debug',
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    throw new Error('Test Async Error - This is intentional for testing crash reporting');
  };

  // Test handled error (captured manually)
  const testHandledError = () => {
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'User triggered handled error test',
      level: 'debug',
    });

    try {
      throw new Error('Test Handled Error - This is intentional for testing crash reporting');
    } catch (error) {
      Sentry.captureException(error);
      console.error('Captured error:', error);
      alert('Error captured and sent to GlitchTip! Check the dashboard at crash.lokusmd.com');
    }
  };

  // Test breadcrumb trail
  const testBreadcrumbs = () => {
    Sentry.addBreadcrumb({ category: 'test', message: 'Step 1: User clicked button', level: 'info' });
    setTimeout(() => {
      Sentry.addBreadcrumb({ category: 'test', message: 'Step 2: Delayed operation', level: 'info' });
      setTimeout(() => {
        Sentry.addBreadcrumb({ category: 'test', message: 'Step 3: About to throw error', level: 'warning' });
        testHandledError();
      }, 500);
    }, 500);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '15px',
      backgroundColor: '#ff6b6b',
      color: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
        🧪 Crash Reporting Tests (Dev Only)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={() => setShouldThrow(true)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#fff',
            color: '#ff6b6b',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Test React Error Boundary
        </button>

        <button
          onClick={() => testAsyncError().catch(err => Sentry.captureException(err))}
          style={{
            padding: '8px 12px',
            backgroundColor: '#fff',
            color: '#ff6b6b',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Test Async Error
        </button>

        <button
          onClick={testHandledError}
          style={{
            padding: '8px 12px',
            backgroundColor: '#fff',
            color: '#ff6b6b',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Test Handled Error
        </button>

        <button
          onClick={testBreadcrumbs}
          style={{
            padding: '8px 12px',
            backgroundColor: '#fff',
            color: '#ff6b6b',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Test Breadcrumb Trail
        </button>
      </div>

      <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.9 }}>
        Check crash.lokusmd.com for reports
      </div>
    </div>
  );
}

export default CrashTest;
