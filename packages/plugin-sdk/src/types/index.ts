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
export * from './api/index.js'

// Extension points
export * from './extension-points/index.js'

// Communication protocol
export * from './protocol.js'

// Event system
export * from './events.js'

// Configuration
export * from './configuration.js'

// Security
export * from './security.js'

// Utilities
export * from './utilities.js'