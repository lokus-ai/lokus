/**
 * @fileoverview Debug API types
 */

import type { Disposable } from '../utilities.js'

/**
 * Debug API interface
 */
export interface DebugAPI {
  // TODO: Add debug API methods
  startDebugging(config: DebugConfiguration): Promise<boolean>
  registerDebugAdapterProvider(type: string, provider: DebugAdapterProvider): Disposable
}

/**
 * Debug configuration
 */
export interface DebugConfiguration {
  type: string
  name: string
  request: 'launch' | 'attach'
  [key: string]: unknown
}

/**
 * Debug adapter provider
 */
export interface DebugAdapterProvider {
  provideDebugConfigurations?(): Promise<DebugConfiguration[]>
  resolveDebugConfiguration?(config: DebugConfiguration): Promise<DebugConfiguration | undefined>
}
