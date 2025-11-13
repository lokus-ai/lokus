/**
 * @fileoverview Configuration manager utility
 */

import type { LokusAPI, Disposable, Event } from '../types/index.js'
import { DisposableStore } from './disposable-store.js'

/**
 * Configuration manager for plugin settings
 */
export class ConfigManager implements Disposable {
  private disposables = new DisposableStore()
  private changeListeners = new Map<string, Array<(newValue: unknown, oldValue: unknown) => void>>()

  constructor(
    private pluginId: string,
    private api: LokusAPI
  ) {
    // Listen to configuration changes
    const configDisposable = this.api.config.onDidChange((event) => {
      this.handleConfigChange(event)
    })
    this.disposables.add(configDisposable)
  }

  /**
   * Get configuration value
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    const fullKey = `${this.pluginId}.${key}`
    return this.api.config.get<T>(fullKey, defaultValue)
  }

  /**
   * Set configuration value
   */
  async set(key: string, value: unknown): Promise<void> {
    const fullKey = `${this.pluginId}.${key}`
    await this.api.config.set(fullKey, value)
  }

  /**
   * Update configuration value
   */
  async update(key: string, value: unknown): Promise<void> {
    await this.set(key, value)
  }

  /**
   * Check if configuration key exists
   */
  has(key: string): boolean {
    const fullKey = `${this.pluginId}.${key}`
    return this.api.config.has(fullKey)
  }

  /**
   * Get all plugin configuration
   */
  getAll(): Record<string, unknown> {
    // Get configuration section for this plugin
    const config = this.api.config.getConfiguration(this.pluginId)
    // Return empty object for now - this would need proper implementation
    // based on how the configuration API exposes all keys
    return {}
  }

  /**
   * Watch for configuration changes
   */
  onDidChange<T>(key: string, listener: (newValue: T, oldValue: T) => void): Disposable {
    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, [])
    }
    
    this.changeListeners.get(key)!.push(listener as any)
    
    return {
      dispose: () => {
        const listeners = this.changeListeners.get(key)
        if (listeners) {
          const index = listeners.indexOf(listener as any)
          if (index >= 0) {
            listeners.splice(index, 1)
          }
        }
      }
    }
  }

  /**
   * Get configuration with validation
   */
  getValidated<T>(
    key: string,
    validator: (value: unknown) => value is T,
    defaultValue?: T
  ): T | undefined {
    const value = this.get(key)
    
    if (value === undefined) {
      return defaultValue
    }
    
    if (validator(value)) {
      return value
    }
    
    console.warn(`Invalid configuration value for ${key}:`, value)
    return defaultValue
  }

  /**
   * Set configuration with validation
   */
  async setValidated<T>(
    key: string,
    value: T,
    validator: (value: unknown) => value is T
  ): Promise<void> {
    if (!validator(value)) {
      throw new Error(`Invalid configuration value for ${key}`)
    }
    
    await this.set(key, value)
  }

  /**
   * Reset configuration to defaults
   */
  async reset(key?: string): Promise<void> {
    if (key) {
      // Reset specific key
      const fullKey = `${this.pluginId}.${key}`
      await this.api.config.set(fullKey, undefined)
    } else {
      // Reset all plugin configuration
      const allConfig = this.getAll()
      for (const configKey of Object.keys(allConfig)) {
        await this.set(configKey, undefined)
      }
    }
  }

  /**
   * Import configuration from object
   */
  async import(config: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.set(key, value)
    }
  }

  /**
   * Export configuration to object
   */
  export(): Record<string, unknown> {
    return this.getAll()
  }

  /**
   * Handle configuration change event
   */
  private handleConfigChange(event: any): void {
    const prefix = `${this.pluginId}.`
    
    // Check if the change affects our plugin
    if (!event.affectsConfiguration || !event.affectsConfiguration(prefix)) {
      return
    }
    
    // Notify listeners for each key
    for (const [key, listeners] of this.changeListeners) {
      const fullKey = `${this.pluginId}.${key}`
      if (event.affectsConfiguration(fullKey)) {
        const newValue = this.get(key)
        // Note: We don't have access to old value from the event
        for (const listener of listeners) {
          try {
            listener(newValue, undefined)
          } catch (error) {
            console.warn('Error in configuration change listener:', error)
          }
        }
      }
    }
  }

  /**
   * Dispose configuration manager
   */
  dispose(): void {
    this.disposables.dispose()
    this.changeListeners.clear()
  }
}

/**
 * Configuration validator utilities
 */
export class ConfigValidators {
  /**
   * Validate string value
   */
  static string(value: unknown): value is string {
    return typeof value === 'string'
  }

  /**
   * Validate number value
   */
  static number(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value)
  }

  /**
   * Validate boolean value
   */
  static boolean(value: unknown): value is boolean {
    return typeof value === 'boolean'
  }

  /**
   * Validate array value
   */
  static array<T>(itemValidator: (item: unknown) => item is T) {
    return (value: unknown): value is T[] => {
      return Array.isArray(value) && value.every(itemValidator)
    }
  }

  /**
   * Validate object value
   */
  static object(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  /**
   * Validate enum value
   */
  static enum<T extends string>(...allowedValues: T[]) {
    return (value: unknown): value is T => {
      return typeof value === 'string' && allowedValues.includes(value as T)
    }
  }

  /**
   * Validate range (for numbers)
   */
  static range(min: number, max: number) {
    return (value: unknown): value is number => {
      return ConfigValidators.number(value) && value >= min && value <= max
    }
  }

  /**
   * Validate pattern (for strings)
   */
  static pattern(regex: RegExp) {
    return (value: unknown): value is string => {
      return ConfigValidators.string(value) && regex.test(value)
    }
  }

  /**
   * Optional validator
   */
  static optional<T>(validator: (value: unknown) => value is T) {
    return (value: unknown): value is T | undefined => {
      return value === undefined || validator(value)
    }
  }
}