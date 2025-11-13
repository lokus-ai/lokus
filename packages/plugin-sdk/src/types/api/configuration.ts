/**
 * @fileoverview Configuration API types
 */

import type { Disposable } from '../utilities.js'

/**
 * Configuration API interface
 */
export interface ConfigurationAPI {
  /**
   * Get configuration value
   */
  get<T>(key: string, defaultValue?: T): T | undefined

  /**
   * Set configuration value
   */
  set(key: string, value: unknown): Promise<void>

  /**
   * Update configuration value
   */
  update(key: string, value: unknown): Promise<void>

  /**
   * Has configuration key
   */
  has(key: string): boolean

  /**
   * Listen to configuration changes
   */
  onDidChange(callback: (event: ConfigurationChangeEvent) => void): Disposable

  /**
   * Get configuration section
   */
  getConfiguration(section?: string): Configuration
}

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string): boolean
}

/**
 * Configuration section
 */
export interface Configuration {
  /**
   * Get value
   */
  get<T>(key: string, defaultValue?: T): T | undefined

  /**
   * Has key
   */
  has(key: string): boolean

  /**
   * Update value
   */
  update(key: string, value: unknown): Promise<void>
}
