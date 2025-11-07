/**
 * @fileoverview Base plugin class with common functionality
 */

import type { Plugin, PluginContext, LokusAPI, Disposable } from '../types/index.js'
import { DisposableStore } from './disposable-store.js'
import { PluginLogger } from './plugin-logger.js'
import { ConfigManager } from './config-manager.js'
// import { EventBus } from './event-bus.js' // TODO: Implement EventBus

/**
 * Abstract base plugin class with common functionality
 */
export abstract class BasePlugin implements Plugin {
  protected context?: PluginContext
  protected api?: LokusAPI
  protected logger?: PluginLogger
  protected config?: ConfigManager
  // protected events?: EventBus // TODO: Implement EventBus
  private disposables = new DisposableStore()
  private isActivated = false

  /**
   * Plugin activation method - must be implemented by subclasses
   */
  abstract activate(context: PluginContext): void | Promise<void>

  /**
   * Plugin deactivation - can be overridden by subclasses
   */
  async deactivate(): Promise<void> {
    this.isActivated = false
    this.disposables.dispose()
    this.logger?.info('Plugin deactivated')
  }

  /**
   * Initialize common services
   */
  protected async initialize(context: PluginContext): Promise<void> {
    this.context = context
    this.api = context.api
    this.isActivated = true

    // Initialize logger
    this.logger = new PluginLogger(context.pluginId, context.api)
    this.addDisposable(this.logger)

    // Initialize config manager
    this.config = new ConfigManager(context.pluginId, context.api)
    this.addDisposable(this.config)

    // Initialize event bus
    // TODO: Implement EventBus
    // this.events = new EventBus()
    // this.addDisposable(this.events)

    this.logger.info('Plugin services initialized')
  }

  /**
   * Register a disposable for automatic cleanup
   */
  protected addDisposable(disposable: Disposable): void {
    this.disposables.add(disposable)
  }

  /**
   * Get plugin context
   */
  protected getContext(): PluginContext {
    if (!this.context) {
      throw new Error('Plugin not activated')
    }
    return this.context
  }

  /**
   * Get Lokus API
   */
  protected getAPI(): LokusAPI {
    if (!this.api) {
      throw new Error('Plugin not activated')
    }
    return this.api
  }

  /**
   * Get plugin logger
   */
  protected getLogger(): PluginLogger {
    if (!this.logger) {
      throw new Error('Plugin not initialized')
    }
    return this.logger
  }

  /**
   * Get config manager
   */
  protected getConfig(): ConfigManager {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }
    return this.config
  }

  /**
   * Get event bus
   * TODO: Implement EventBus
   */
  // protected getEvents(): EventBus {
  //   if (!this.events) {
  //     throw new Error('Plugin not initialized')
  //   }
  //   return this.events
  // }

  /**
   * Check if plugin is activated
   */
  protected isActive(): boolean {
    return this.isActivated
  }

  /**
   * Register command with automatic cleanup
   */
  protected registerCommand(id: string, handler: (...args: unknown[]) => unknown, options?: {
    title?: string
    category?: string
    when?: string
  }): void {
    const api = this.getAPI()
    const commandDef: any = {
      id,
      title: options?.title || id,
      handler
    }
    if (options?.category !== undefined) {
      commandDef.category = options.category
    }
    if (options?.when !== undefined) {
      commandDef.when = options.when
    }
    const disposable = api.commands.register(commandDef)
    this.addDisposable(disposable)
  }

  /**
   * Show notification with plugin context
   */
  protected showNotification(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
    const api = this.getAPI()
    api.ui.showNotification(`[${this.context?.pluginId}] ${message}`, type as any)
  }

  /**
   * Watch configuration changes
   */
  protected watchConfig<T>(key: string, callback: (newValue: T, oldValue: T) => void): void {
    const config = this.getConfig()
    const disposable = config.onDidChange(key, callback)
    this.addDisposable(disposable)
  }

  /**
   * Create output channel
   */
  protected createOutputChannel(name?: string): any {
    const api = this.getAPI()
    const channelName = name || this.context?.pluginId || 'Plugin'
    const channel = api.ui.createOutputChannel(channelName)
    this.addDisposable(channel)
    return channel
  }

  /**
   * Safe error handling with logging
   */
  protected async safeExecute<T>(
    operation: () => T | Promise<T>,
    errorMessage?: string
  ): Promise<T | undefined> {
    try {
      return await operation()
    } catch (error) {
      const message = errorMessage || 'Operation failed'
      this.logger?.error(message, error)
      this.showNotification(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      return undefined
    }
  }

  /**
   * Debounced function execution
   */
  protected debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  /**
   * Throttled function execution
   */
  protected throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0
    return (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        func.apply(this, args)
      }
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === maxAttempts) {
          throw lastError
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1)
        this.logger?.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, error)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }

  /**
   * Create cancellable operation
   */
  protected createCancellableOperation<T>(
    operation: (signal: AbortSignal) => Promise<T>
  ): { promise: Promise<T>; cancel: () => void } {
    const controller = new AbortController()
    
    const promise = operation(controller.signal).finally(() => {
      // Clean up
    })
    
    return {
      promise,
      cancel: () => controller.abort()
    }
  }

  /**
   * Performance measurement
   */
  protected async measurePerformance<T>(
    operation: () => T | Promise<T>,
    name?: string
  ): Promise<T> {
    const operationName = name || 'operation'
    const start = performance.now()
    
    try {
      const result = await operation()
      const duration = performance.now() - start
      this.logger?.debug(`${operationName} completed in ${duration.toFixed(2)}ms`)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.logger?.error(`${operationName} failed after ${duration.toFixed(2)}ms`, error)
      throw error
    }
  }

  /**
   * Validate plugin state
   */
  protected validateState(): boolean {
    if (!this.isActivated) {
      this.logger?.warn('Plugin operation attempted while not activated')
      return false
    }
    
    if (!this.api || !this.context) {
      this.logger?.error('Plugin API or context not available')
      return false
    }
    
    return true
  }

  /**
   * Get plugin statistics
   */
  protected getStats(): BasePluginStats {
    return {
      pluginId: this.context?.pluginId || 'unknown',
      isActive: this.isActivated,
      disposablesCount: this.disposables.size,
      memoryUsage: process.memoryUsage?.().heapUsed || 0,
      uptime: this.isActivated ? Date.now() - (this.activationTime || 0) : 0
    }
  }

  private activationTime?: number

  /**
   * Mark activation time for statistics
   */
  protected markActivationTime(): void {
    this.activationTime = Date.now()
  }
}

/**
 * Plugin statistics interface
 */
export interface BasePluginStats {
  pluginId: string
  isActive: boolean
  disposablesCount: number
  memoryUsage: number
  uptime: number
}

/**
 * Enhanced base plugin with additional features
 */
export abstract class EnhancedBasePlugin extends BasePlugin {
  private commandPalette = new Map<string, CommandPaletteEntry>()
  private statusBarItems = new Map<string, any>()
  private quickPicks = new Map<string, QuickPickDefinition>()

  /**
   * Register command with palette integration
   */
  protected registerCommandWithPalette(definition: CommandPaletteEntry): void {
    const options: any = {
      title: definition.title
    }
    if (definition.category !== undefined) {
      options.category = definition.category
    }
    if (definition.when !== undefined) {
      options.when = definition.when
    }
    this.registerCommand(definition.id, definition.handler, options)

    this.commandPalette.set(definition.id, definition)
  }

  /**
   * Create persistent status bar item
   */
  protected createStatusBarItem(
    id: string,
    text: string,
    options?: {
      tooltip?: string
      command?: string
      alignment?: 'left' | 'right'
      priority?: number
    }
  ): any {
    const api = this.getAPI()
    const itemDef: any = {
      id,
      text,
      alignment: (options?.alignment === 'right' ? 2 : 1),
      priority: options?.priority || 100
    }
    if (options?.tooltip !== undefined) {
      itemDef.tooltip = options.tooltip
    }
    if (options?.command !== undefined) {
      itemDef.command = options.command
    }
    const item = api.ui.registerStatusBarItem(itemDef)

    this.statusBarItems.set(id, item)
    this.addDisposable(item)
    return item
  }

  /**
   * Show quick pick with custom options
   */
  protected async showQuickPick<T extends import('../types/api/ui.js').QuickPickItem>(
    items: T[],
    options?: {
      placeholder?: string
      canPickMany?: boolean
      ignoreFocusOut?: boolean
    }
  ): Promise<T | T[] | undefined> {
    const api = this.getAPI()
    return api.ui.showQuickPick(items, options)
  }

  /**
   * Register file system watcher
   */
  protected watchFiles(
    pattern: string,
    handler: (uri: string, type: 'created' | 'changed' | 'deleted') => void
  ): void {
    // Implementation would depend on the actual file system API
    this.logger?.info(`Watching files with pattern: ${pattern}`)
  }

  /**
   * Get all registered commands
   */
  protected getRegisteredCommands(): CommandPaletteEntry[] {
    return Array.from(this.commandPalette.values())
  }

  /**
   * Update status bar item
   */
  protected updateStatusBarItem(id: string, text: string, tooltip?: string): void {
    const item = this.statusBarItems.get(id)
    if (item) {
      item.text = text
      if (tooltip) item.tooltip = tooltip
    }
  }
}

/**
 * Command palette entry
 */
export interface CommandPaletteEntry {
  id: string
  title: string
  category?: string
  description?: string
  when?: string
  icon?: string
  handler: (...args: unknown[]) => unknown
  shortcut?: string
}

/**
 * Quick pick definition
 * Note: QuickPickItem is imported from types/api/ui.ts
 */
export interface QuickPickDefinition {
  id: string
  title: string
  items: import('../types/api/ui.js').QuickPickItem[]
  options?: {
    canPickMany?: boolean
    ignoreFocusOut?: boolean
  }
}