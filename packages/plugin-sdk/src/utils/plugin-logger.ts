/**
 * @fileoverview Plugin logging utility
 */

import type { LokusAPI, Disposable, LogLevel } from '../types/index.js'

/**
 * Plugin logger with multiple output channels and levels
 */
export class PluginLogger implements Disposable {
  private outputChannel?: any
  private consoleEnabled = true
  private fileEnabled = false
  private logLevel: LogLevel = LogLevel.INFO
  private logHistory: LogEntry[] = []
  private maxHistorySize = 1000

  constructor(
    private pluginId: string,
    private api: LokusAPI,
    options?: LoggerOptions
  ) {
    this.logLevel = options?.level || LogLevel.INFO
    this.consoleEnabled = options?.console !== false
    this.fileEnabled = options?.file === true
    this.maxHistorySize = options?.maxHistorySize || 1000

    // Create output channel
    this.outputChannel = this.api.ui.createOutputChannel(`${pluginId} Log`)
  }

  /**
   * Log trace message
   */
  trace(message: string, ...args: unknown[]): void {
    this.log(LogLevel.TRACE, message, ...args)
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args)
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args)
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args)
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const errorDetails = error instanceof Error 
      ? `${error.message}\n${error.stack}`
      : String(error)
    
    this.log(LogLevel.ERROR, message, errorDetails, ...args)
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const errorDetails = error instanceof Error 
      ? `${error.message}\n${error.stack}`
      : String(error)
    
    this.log(LogLevel.FATAL, message, errorDetails, ...args)
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.logLevel) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      args,
      pluginId: this.pluginId
    }

    // Add to history
    this.addToHistory(entry)

    // Format message
    const formatted = this.formatLogEntry(entry)

    // Output to console
    if (this.consoleEnabled) {
      this.outputToConsole(level, formatted)
    }

    // Output to channel
    if (this.outputChannel) {
      this.outputChannel.appendLine(formatted)
    }

    // Output to file
    if (this.fileEnabled) {
      this.outputToFile(formatted)
    }
  }

  /**
   * Format log entry
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString()
    const level = LogLevel[entry.level].padEnd(5)
    const pluginId = entry.pluginId.padEnd(20)
    
    let formatted = `[${timestamp}] [${level}] [${pluginId}] ${entry.message}`
    
    if (entry.args.length > 0) {
      const argsString = entry.args
        .map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg))
        .join(' ')
      formatted += ` ${argsString}`
    }
    
    return formatted
  }

  /**
   * Output to console
   */
  private outputToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(message)
        break
      case LogLevel.INFO:
        console.log(message)
        break
      case LogLevel.WARN:
        console.warn(message)
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message)
        break
    }
  }

  /**
   * Output to file (placeholder)
   */
  private outputToFile(message: string): void {
    // In a real implementation, this would write to a log file
    // For now, we just store it in memory
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry)
    
    // Trim history if it exceeds max size
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get log history
   */
  getHistory(options?: {
    level?: LogLevel
    since?: Date
    limit?: number
  }): LogEntry[] {
    let filtered = this.logHistory

    if (options?.level !== undefined) {
      filtered = filtered.filter(entry => entry.level >= options.level!)
    }

    if (options?.since) {
      filtered = filtered.filter(entry => entry.timestamp >= options.since!)
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit)
    }

    return filtered
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = []
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.logLevel = level
    this.info(`Log level changed to ${LogLevel[level]}`)
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.logLevel
  }

  /**
   * Enable/disable console output
   */
  setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled
  }

  /**
   * Enable/disable file output
   */
  setFileEnabled(enabled: boolean): void {
    this.fileEnabled = enabled
  }

  /**
   * Show log output channel
   */
  show(): void {
    if (this.outputChannel) {
      this.outputChannel.show()
    }
  }

  /**
   * Hide log output channel
   */
  hide(): void {
    if (this.outputChannel) {
      this.outputChannel.hide()
    }
  }

  /**
   * Create child logger with prefix
   */
  createChild(prefix: string): ChildLogger {
    return new ChildLogger(this, prefix)
  }

  /**
   * Export logs as string
   */
  exportLogs(options?: {
    level?: LogLevel
    since?: Date
    format?: 'text' | 'json'
  }): string {
    const entries = this.getHistory(options)
    
    if (options?.format === 'json') {
      return JSON.stringify(entries, null, 2)
    }
    
    return entries
      .map(entry => this.formatLogEntry(entry))
      .join('\n')
  }

  /**
   * Dispose logger
   */
  dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose()
    }
    this.clearHistory()
  }
}

/**
 * Child logger with prefix
 */
export class ChildLogger {
  constructor(
    private parent: PluginLogger,
    private prefix: string
  ) {}

  trace(message: string, ...args: unknown[]): void {
    this.parent.trace(`[${this.prefix}] ${message}`, ...args)
  }

  debug(message: string, ...args: unknown[]): void {
    this.parent.debug(`[${this.prefix}] ${message}`, ...args)
  }

  info(message: string, ...args: unknown[]): void {
    this.parent.info(`[${this.prefix}] ${message}`, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    this.parent.warn(`[${this.prefix}] ${message}`, ...args)
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    this.parent.error(`[${this.prefix}] ${message}`, error, ...args)
  }

  fatal(message: string, error?: Error | unknown, ...args: unknown[]): void {
    this.parent.fatal(`[${this.prefix}] ${message}`, error, ...args)
  }
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Log level */
  level?: LogLevel
  
  /** Enable console output */
  console?: boolean
  
  /** Enable file output */
  file?: boolean
  
  /** Maximum history size */
  maxHistorySize?: number
  
  /** Log file path */
  filePath?: string
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  args: unknown[]
  pluginId: string
}

/**
 * Performance logger for measuring execution time
 */
export class PerformanceLogger {
  private timers = new Map<string, number>()

  constructor(private logger: PluginLogger) {}

  /**
   * Start timing an operation
   */
  start(name: string): void {
    this.timers.set(name, performance.now())
  }

  /**
   * End timing and log duration
   */
  end(name: string, message?: string): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      this.logger.warn(`No timer found for: ${name}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(name)

    const logMessage = message || `Operation '${name}' completed`
    this.logger.debug(`${logMessage} in ${duration.toFixed(2)}ms`)

    return duration
  }

  /**
   * Measure async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    message?: string
  ): Promise<T> {
    this.start(name)
    try {
      const result = await operation()
      this.end(name, message)
      return result
    } catch (error) {
      this.end(name, `${message || name} (failed)`)
      throw error
    }
  }

  /**
   * Measure sync operation
   */
  measureSync<T>(
    name: string,
    operation: () => T,
    message?: string
  ): T {
    this.start(name)
    try {
      const result = operation()
      this.end(name, message)
      return result
    } catch (error) {
      this.end(name, `${message || name} (failed)`)
      throw error
    }
  }
}