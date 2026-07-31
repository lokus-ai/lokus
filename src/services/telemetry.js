/**
 * Crash reporting, loaded only if it is switched on.
 *
 * Sentry is ~390 KB — 19% of the boot payload — and it was reaching the entry
 * chunk through half a dozen static `import * as Sentry` statements even
 * though `Sentry.init()` is gated behind VITE_ENABLE_CRASH_REPORTS. With no
 * .env that flag is unset, so every launch of a local-first, no-telemetry app
 * downloaded and parsed a reporting SDK that never reported anything.
 *
 * Callers use these wrappers instead of importing Sentry directly. When the
 * flag is off they are no-ops and the bundler drops the SDK from the graph
 * entirely; when it is on, the SDK is fetched once, off the critical path,
 * and everything queued in the meantime is flushed to it.
 */

export const CRASH_REPORTS_ENABLED =
  import.meta.env.VITE_ENABLE_CRASH_REPORTS === 'true';

let sdk = null;
let loading = null;

/** Calls made before the SDK finishes loading, replayed once it does. */
const pending = [];

function withSdk(fn) {
  if (!CRASH_REPORTS_ENABLED) return;
  if (sdk) { fn(sdk); return; }
  pending.push(fn);
}

/**
 * Load and initialise the SDK. Safe to call when disabled — it does nothing.
 * Returns a promise so startup can choose not to await it.
 */
export function initTelemetry(options) {
  if (!CRASH_REPORTS_ENABLED) return Promise.resolve(null);
  if (loading) return loading;

  loading = import('@sentry/react')
    .then((mod) => {
      mod.init({
        ...options,
        integrations: [
          mod.browserTracingIntegration(),
          mod.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
      });
      sdk = mod;
      for (const fn of pending.splice(0)) {
        try { fn(mod); } catch { /* a breadcrumb must never break the app */ }
      }
      return mod;
    })
    .catch(() => null);

  return loading;
}

export function addBreadcrumb(breadcrumb) {
  withSdk((s) => s.addBreadcrumb(breadcrumb));
}

export function captureException(error, context) {
  withSdk((s) => s.captureException(error, context));
}

export function captureMessage(message, context) {
  withSdk((s) => s.captureMessage(message, context));
}
