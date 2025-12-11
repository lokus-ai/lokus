import { Logger as SDKLogger } from 'lokus-plugin-sdk';

/**
 * Enhanced logger utility for {{pluginName}}
 */
export class {{ pluginNamePascalCase }}Logger {
  private logger: SDKLogger;
  private prefix: string;

  constructor(logger: SDKLogger, prefix = '{{pluginName}}') {
    this.logger = logger;
    this.prefix = prefix;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    this.logger.debug(`[${this.prefix}] ${message}`, ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    this.logger.info(`[${this.prefix}] ${message}`, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    this.logger.warn(`[${this.prefix}] ${message}`, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, error ?: Error, ...args: any[]): void {
    if(error) {
      this.logger.error(`[${this.prefix}] ${message}`, error, ...args);
    } else {
      this.logger.error(`[${this.prefix}] ${message}`, ...args);
    }
  }

  /**
   * Create a child logger with additional prefix
   */
  child(childPrefix: string): { { pluginNamePascalCase } }Logger {
    return new {{ pluginNamePascalCase }
  } Logger(this.logger, `${this.prefix}:${childPrefix}`);
}

  /**
   * Time a function execution
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise < T > {
  const start = Date.now();
  this.debug(`Starting ${label}...`);

  try {
    const result = await fn();
    const duration = Date.now() - start;
    this.debug(`Completed ${label} in ${duration}ms`);
    return result;
  } catch(error) {
    const duration = Date.now() - start;
    this.error(`Failed ${label} after ${duration}ms`, error as Error);
    throw error;
  }
}

/**
 * Log with performance timing
 */
perf(message: string, startTime: number): void {
  const duration = Date.now() - startTime;
  this.debug(`${message} (${duration}ms)`);
}
}