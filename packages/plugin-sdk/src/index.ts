/**
 * @fileoverview Lokus Plugin SDK - Main Entry Point
 * 
 * This is the main entry point for the Lokus Plugin SDK, providing everything
 * developers need to create powerful plugins for Lokus.
 * 
 * @version 1.0.0
 * @author Lokus Team
 * @license MIT
 */

// Export all types
export * from './types/index.js'

// Export utilities
export * from './utils/index.js'

// Export templates
export * from './templates/index.js'

// Export testing utilities
export * from './testing/index.js'

// Re-export commonly used types for convenience
export type {
  Plugin,
  PluginContext,
  PluginManifest,
  LokusAPI,
  Disposable,
  Permission,
  CommandAPI,
  EditorAPI,
  UIAPI,
  WorkspaceAPI
} from './types/index.js'

// Re-export base classes
export {
  BasePlugin,
  EnhancedBasePlugin
} from './utils/base-plugin.js'

// Re-export utilities
export {
  PluginLogger,
  ConfigManager,
  DisposableStore
} from './utils/index.js'

/**
 * SDK version information
 */
export const SDK_VERSION = '1.0.0'

/**
 * Supported Lokus API version
 */
export const SUPPORTED_API_VERSION = '1.0.0'

/**
 * SDK metadata
 */
export const SDK_INFO = {
  name: '@lokus/plugin-sdk',
  version: SDK_VERSION,
  description: 'Official Plugin Development Kit for Lokus',
  homepage: 'https://lokus.dev/docs/plugin-development',
  repository: 'https://github.com/lokus/lokus',
  license: 'MIT',
  supportedApiVersion: SUPPORTED_API_VERSION
} as const

/**
 * Quick start helper for creating basic plugins
 */
export function createPlugin(definition: {
  activate: (context: PluginContext) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}): Plugin {
  const plugin: Plugin = {
    activate: definition.activate
  }
  if (definition.deactivate) {
    plugin.deactivate = definition.deactivate
  }
  return plugin
}

/**
 * Plugin development utilities namespace
 */
export namespace PluginSDK {
  /**
   * Validate plugin manifest
   */
  export function validateManifest(manifest: unknown): manifest is PluginManifest {
    // Basic validation - in real implementation would be more thorough
    return (
      typeof manifest === 'object' &&
      manifest !== null &&
      'id' in manifest &&
      'version' in manifest &&
      'name' in manifest
    )
  }

  /**
   * Get SDK information
   */
  export function getInfo() {
    return SDK_INFO
  }

  /**
   * Check API compatibility
   */
  export function isApiCompatible(apiVersion: string): boolean {
    // Simplified compatibility check
    return apiVersion === SUPPORTED_API_VERSION
  }

  /**
   * Create plugin template
   */
  export async function createFromTemplate(
    template: PluginTemplate,
    config: TemplateConfig
  ): Promise<void> {
    const { BasicPluginTemplate, UIExtensionPluginTemplate } = await import('./templates/index.js')
    // Implementation would create appropriate template generator
    // For now, just log the request
    console.log(`Creating plugin from template: ${template}`, config)
    // TODO: Implement template selection and generation logic
  }
}

/**
 * Plugin development decorators (if using TypeScript with decorators)
 */
export namespace Decorators {
  /**
   * Command decorator for automatic command registration
   */
  export function command(id: string, title: string, category?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      // Store command metadata for later registration
      if (!target.constructor._commands) {
        target.constructor._commands = []
      }
      target.constructor._commands.push({
        id,
        title,
        category,
        handler: descriptor.value
      })
      return descriptor
    }
  }

  /**
   * Configuration decorator for automatic config binding
   */
  export function config(key: string, defaultValue?: unknown) {
    return function (target: any, propertyKey: string) {
      // Store config metadata
      if (!target.constructor._configs) {
        target.constructor._configs = []
      }
      target.constructor._configs.push({
        key,
        propertyKey,
        defaultValue
      })
    }
  }

  /**
   * Disposable decorator for automatic cleanup
   */
  export function disposable(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Mark method result as disposable
    const originalMethod = descriptor.value
    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args)
      if (result && typeof result.dispose === 'function') {
        // Type assertion to access addDisposable method
        const self = this as any
        if (typeof self.addDisposable === 'function') {
          self.addDisposable(result)
        }
      }
      return result
    }
    return descriptor
  }
}

/**
 * Development mode helpers
 */
export namespace DevMode {
  /**
   * Check if running in development mode
   */
  export function isEnabled(): boolean {
    return process.env['NODE_ENV'] === 'development' || process.env['LOKUS_DEV'] === 'true'
  }

  /**
   * Development logger with enhanced features
   */
  export function createLogger(pluginId: string): PluginLogger | null {
    if (!isEnabled()) {
      return null
    }

    const logger: PluginLogger = new PluginLogger(pluginId, {} as any, { level: LogLevel.DEBUG })
    // Add development logging method
    const devLog = (message: string, ...args: unknown[]) => {
      if (isEnabled()) {
        logger.debug(`[DEV] ${message}`, ...args)
      }
    }
    (logger as any).devLog = devLog
    return logger
  }

  /**
   * Hot reload support
   */
  export function enableHotReload(plugin: Plugin): void {
    if (isEnabled()) {
      console.log('Hot reload enabled for plugin')
      // Implementation would set up file watchers and reload mechanisms
    }
  }
}

// Forward declarations for imports
import type { PluginContext, Plugin, PluginManifest, TemplateConfig, PluginTemplate } from './types/index.js'
import { PluginLogger, LogLevel } from './utils/plugin-logger.js'