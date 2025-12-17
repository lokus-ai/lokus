/**
 * Production Logger Utility
 *
 * Provides structured logging with different severity levels.
 * - DEBUG: Development only, detailed diagnostic information
 * - INFO: Development only, informational messages
 * - WARN: Always logged, warning messages
 * - ERROR: Always logged, error messages with Sentry integration
 *
 * Format: [timestamp] [LEVEL] [context] message
 */

const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || process.env.NODE_ENV === 'development';
const isProduction = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) || process.env.NODE_ENV === 'production';

/**
 * Get formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with context
 */
function formatMessage(level, context, args) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level}] [${context}]`;
  return [prefix, ...args];
}

/**
 * Send error to Sentry if available and enabled
 */
async function sendToSentry(context, error, extraData) {
  if (!isProduction) return;

  try {
    // Dynamically import Sentry to avoid loading in dev
    const { captureException, captureMessage } = await import('@sentry/react');

    const extra = {
      context,
      timestamp: getTimestamp(),
      ...extraData
    };

    if (error instanceof Error) {
      captureException(error, {
        tags: { context },
        extra
      });
    } else {
      captureMessage(String(error), {
        level: 'error',
        tags: { context },
        extra
      });
    }
  } catch (err) {
    // Sentry not available or failed, silently ignore
  }
}

/**
 * Logger instance with severity levels
 * All console output disabled for production
 */
export const logger = {
  /**
   * Debug level - disabled
   */
  debug: () => {},

  /**
   * Info level - disabled
   */
  info: () => {},

  /**
   * Log level - disabled
   */
  log: () => {},

  /**
   * Warning level - disabled
   */
  warn: () => {},

  /**
   * Error level - Sentry only, no console output
   */
  error: (context, ...args) => {
    // Send to Sentry in production (no console output)
    if (isProduction && args.length > 0) {
      const firstArg = args[0];
      const extraData = args.length > 1 ? { additionalInfo: args.slice(1) } : {};

      // Send to Sentry asynchronously (don't block)
      sendToSentry(context, firstArg, extraData).catch(() => {
        // Silently ignore Sentry failures
      });
    }
  },

  /**
   * Check if debug logging is enabled
   */
  isDebugEnabled: () => isDev,

  /**
   * Check if running in production
   */
  isProduction: () => isProduction,

  /**
   * Create a scoped logger with a specific context
   */
  createScoped: (scopeContext) => ({
    debug: (...args) => logger.debug(scopeContext, ...args),
    info: (...args) => logger.info(scopeContext, ...args),
    log: (...args) => logger.log(scopeContext, ...args),
    warn: (...args) => logger.warn(scopeContext, ...args),
    error: (...args) => logger.error(scopeContext, ...args),
  }),
};

export default logger;
