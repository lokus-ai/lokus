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

const isDev = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

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
 */
export const logger = {
  /**
   * Debug level - development only
   * Use for detailed diagnostic information
   */
  debug: (context, ...args) => {
    if (isDev) {
      console.log(...formatMessage('DEBUG', context, args));
    }
  },

  /**
   * Info level - development only
   * Use for informational messages
   */
  info: (context, ...args) => {
    if (isDev) {
      console.log(...formatMessage('INFO', context, args));
    }
  },

  /**
   * Log level - alias for info (for console.log compatibility)
   */
  log: (context, ...args) => {
    if (isDev) {
      console.log(...formatMessage('INFO', context, args));
    }
  },

  /**
   * Warning level - always logged
   * Use for warning messages that don't prevent operation
   */
  warn: (context, ...args) => {
    console.warn(...formatMessage('WARN', context, args));
  },

  /**
   * Error level - always logged with Sentry integration
   * Use for error conditions that need attention
   */
  error: (context, ...args) => {
    console.error(...formatMessage('ERROR', context, args));

    // Send to Sentry in production
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
