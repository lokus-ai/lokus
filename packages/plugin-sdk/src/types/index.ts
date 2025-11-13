/**
 * @fileoverview Comprehensive TypeScript type definitions for Lokus Plugin SDK
 *
 * This file exports all the type definitions needed for plugin development,
 * providing type safety and IntelliSense support for the entire plugin API.
 */

// Core plugin types
export * from './plugin.js'
export * from './manifest.js'
export * from './permissions.js'
export * from './lifecycle.js'

// API types
// Note: We re-export from individual API modules to avoid the duplicate PluginContext
// (lifecycle.js already exports the canonical PluginContext interface)
export * from './api/commands.js'
export * from './api/editor.js'
export * from './api/ui.js'
export * from './api/workspace.js'
export * from './api/filesystem.js'
export * from './api/network.js'
export * from './api/storage.js'
export * from './api/configuration.js'
export * from './api/tasks.js'
export * from './api/debug.js'
export * from './api/languages.js'
export * from './api/themes.js'
export * from './api/terminal.js'

// Export main API types from api/index.js (excluding PluginContext which conflicts)
export type {
  LokusAPI,
  APIVersion,
  APICompatibility,
  APIRequestOptions,
  APIResponse,
  PaginatedRequestOptions,
  ProgressCallback,
  CancellationToken,
  ProgressReporter,
  LongRunningOperationOptions
} from './api/index.js'
// Export enums and classes as values
export { LogLevel, APIErrorCode, APIError } from './api/index.js'

// Event system
export * from './events.js'

// Configuration - already exported from ./api/configuration.js above
// export * from './configuration.js' // Duplicate - commented out to avoid conflict

// Utilities
export * from './utilities.js'

// Template types (re-exported from templates module for convenience)
export type { TemplateConfig, TemplateGenerator } from '../templates/index.js'
export { PluginTemplate } from '../templates/index.js'