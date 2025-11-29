/**
 * Registry Configuration System
 * Manages registry endpoints, authentication, policies, and settings
 */

import { invoke } from '@tauri-apps/api/core'
import { join, homeDir } from '@tauri-apps/api/path'
import { exists, readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { EventEmitter } from '../../utils/EventEmitter.js'
import { logger } from '../../utils/Logger.js'

/**
 * Registry Environments
 */
export const REGISTRY_ENV = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  LOCAL: 'local'
}

/**
 * Update Policies
 */
export const UPDATE_POLICY = {
  AUTOMATIC: 'automatic',
  NOTIFY_ONLY: 'notify_only',
  MANUAL: 'manual',
  DISABLED: 'disabled'
}

/**
 * Security Levels
 */
export const SECURITY_LEVEL = {
  STRICT: 'strict',
  STANDARD: 'standard',
  PERMISSIVE: 'permissive'
}

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG = {
  // Registry endpoints
  registries: {
    primary: {
      name: 'Lokus Official Registry',
      url: 'https://registry.lokus.dev',
      enabled: true,
      priority: 1,
      verified: true,
      mirrors: [
        'https://registry-eu.lokus.dev',
        'https://registry-asia.lokus.dev'
      ]
    }
  },

  // Authentication settings
  authentication: {
    method: 'api_key', // api_key, oauth, jwt
    autoRefresh: true,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    rememberCredentials: true
  },

  // Update policies
  updates: {
    policy: UPDATE_POLICY.NOTIFY_ONLY,
    checkInterval: 24 * 60 * 60 * 1000, // Daily
    autoInstallSecurity: true,
    preReleaseChannels: false,
    notificationSettings: {
      major: true,
      minor: true,
      patch: false,
      security: true
    }
  },

  // Security settings
  security: {
    level: SECURITY_LEVEL.STANDARD,
    verifySignatures: true,
    allowUntrustedPublishers: false,
    sandboxMode: true,
    permissionPrompts: true,
    trustedPublishers: [
      'lokus-official',
      'lokus-community'
    ],
    blockedPublishers: [],
    maxPackageSize: 100 * 1024 * 1024, // 100MB
    allowedFileTypes: [
      '.js', '.jsx', '.ts', '.tsx',
      '.json', '.md', '.txt',
      '.css', '.scss', '.less',
      '.png', '.jpg', '.jpeg', '.gif', '.svg',
      '.wasm'
    ]
  },

  // Network settings
  network: {
    timeout: 30000,
    // Performance optimization: Reduced from 3 retries to 1
    // Faster failure when registry is offline/unavailable
    retryAttempts: 1,
    retryDelay: 500,
    maxConcurrentDownloads: 3,
    useProxy: false,
    proxyUrl: null,
    userAgent: 'Lokus-Plugin-Client/1.0'
  },

  // Cache settings
  cache: {
    enabled: true,
    maxSize: 500 * 1024 * 1024, // 500MB
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    compressionEnabled: true,
    persistOffline: true
  },

  // Installation settings
  installation: {
    autoResolveDependencies: true,
    dependencyStrategy: 'auto',
    backupBeforeUpdate: true,
    cleanupOnFailure: true,
    parallelInstalls: false,
    installLocation: null // Will be set to default plugin directory
  },

  // Analytics and telemetry
  analytics: {
    enabled: true,
    collectUsageStats: true,
    collectErrorReports: true,
    collectPerformanceMetrics: false,
    shareWithPublishers: false
  },

  // UI preferences
  ui: {
    theme: 'auto', // auto, light, dark
    showPreviewPlugins: false,
    defaultSortBy: 'popularity',
    itemsPerPage: 20,
    showDetailedProgress: true,
    confirmBeforeInstall: true
  },

  // Developer settings
  developer: {
    enableDeveloperMode: false,
    showDebugInfo: false,
    allowLocalPackages: false,
    localRegistryPath: null,
    publishSettings: {
      autoPublish: false,
      defaultLicense: 'MIT',
      includeSourceMaps: false,
      minifyCode: true
    }
  }
}

/**
 * Registry Configuration Class
 */
export class RegistryConfig extends EventEmitter {
  constructor(configPath = null) {
    super()

    this.configPath = configPath
    this.config = this.deepClone(DEFAULT_CONFIG)
    this.watchers = new Set()
    this.isInitialized = false

    // COMPLETED TODO: Replaced console with proper logger
    this.logger = logger.createScoped('RegistryConfig')
  }

  /**
   * Initialize configuration system
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      await this.setupConfigPath()
      await this.loadConfig()
      await this.validateConfig()
      await this.migrateConfig()

      this.isInitialized = true
      this.emit('initialized', this.config)
      this.logger.info('Registry configuration initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize registry configuration:', error)
      throw error
    }
  }

  /**
   * Configuration management
   */
  async loadConfig() {
    try {
      if (await exists(this.configPath)) {
        const content = await readTextFile(this.configPath)
        const userConfig = JSON.parse(content)

        // Merge with defaults
        this.config = this.deepMerge(DEFAULT_CONFIG, userConfig)

        this.emit('config_loaded', this.config)
        this.logger.info('Configuration loaded from file')
      } else {
        // Use defaults and save
        await this.saveConfig()
        this.logger.info('Configuration initialized with defaults')
      }
    } catch (error) {
      this.logger.error('Failed to load configuration:', error)
      // Fallback to defaults
      this.config = this.deepClone(DEFAULT_CONFIG)
    }
  }

  async saveConfig() {
    try {
      const content = JSON.stringify(this.config, null, 2)
      await writeTextFile(this.configPath, content)

      this.emit('config_saved', this.config)
      this.logger.info('Configuration saved to file')
    } catch (error) {
      this.logger.error('Failed to save configuration:', error)
      throw error
    }
  }

  async validateConfig() {
    const errors = []
    const warnings = []

    // Validate registry URLs
    for (const [id, registry] of Object.entries(this.config.registries)) {
      try {
        new URL(registry.url)
      } catch (error) {
        errors.push(`Invalid registry URL for ${id}: ${registry.url}`)
      }
    }

    // Validate timeouts and intervals
    if (this.config.network.timeout < 1000) {
      warnings.push('Network timeout is very low, may cause request failures')
    }

    if (this.config.updates.checkInterval < 60000) {
      warnings.push('Update check interval is very frequent, may impact performance')
    }

    // Validate cache size
    if (this.config.cache.maxSize > 1024 * 1024 * 1024) {
      warnings.push('Cache size is very large, may use significant disk space')
    }

    // Validate security settings
    if (this.config.security.level === SECURITY_LEVEL.PERMISSIVE) {
      warnings.push('Permissive security level may allow unsafe plugins')
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
    }

    if (warnings.length > 0) {
      this.logger.warn('Configuration warnings:', warnings)
    }

    return { errors, warnings }
  }

  async migrateConfig() {
    // Handle configuration schema migrations
    const currentVersion = this.config.version || '1.0'
    let migrated = false

    // Migration logic would go here
    // For now, just ensure version is set
    if (!this.config.version) {
      this.config.version = '1.0'
      migrated = true
    }

    if (migrated) {
      await this.saveConfig()
      this.emit('config_migrated', { from: currentVersion, to: this.config.version })
    }
  }

  /**
   * Configuration getters and setters
   */
  get(key, defaultValue = null) {
    const keys = key.split('.')
    let value = this.config

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue
      }
    }

    return value
  }

  async set(key, value, save = true) {
    const keys = key.split('.')
    const lastKey = keys.pop()
    let target = this.config

    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {}
      }
      target = target[k]
    }

    const oldValue = target[lastKey]
    target[lastKey] = value

    if (save) {
      await this.saveConfig()
    }

    this.emit('config_changed', { key, oldValue, newValue: value })

    return true
  }

  async update(updates, save = true) {
    const changes = []

    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this.get(key)
      await this.set(key, value, false)
      changes.push({ key, oldValue, newValue: value })
    }

    if (save) {
      await this.saveConfig()
    }

    this.emit('config_updated', changes)

    return changes
  }

  /**
   * Registry management
   */
  getActiveRegistries() {
    return Object.entries(this.config.registries)
      .filter(([_, registry]) => registry.enabled)
      .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999))
      .map(([id, registry]) => ({ id, ...registry }))
  }

  async addRegistry(id, registryConfig) {
    if (this.config.registries[id]) {
      throw new Error(`Registry already exists: ${id}`)
    }

    // Validate registry URL
    try {
      new URL(registryConfig.url)
    } catch (error) {
      throw new Error(`Invalid registry URL: ${registryConfig.url}`)
    }

    this.config.registries[id] = {
      name: registryConfig.name || id,
      url: registryConfig.url,
      enabled: registryConfig.enabled !== false,
      priority: registryConfig.priority || 999,
      verified: registryConfig.verified || false,
      mirrors: registryConfig.mirrors || []
    }

    await this.saveConfig()
    this.emit('registry_added', { id, registry: this.config.registries[id] })

    return true
  }

  async removeRegistry(id) {
    if (!this.config.registries[id]) {
      throw new Error(`Registry not found: ${id}`)
    }

    if (id === 'primary') {
      throw new Error('Cannot remove primary registry')
    }

    delete this.config.registries[id]
    await this.saveConfig()
    this.emit('registry_removed', { id })

    return true
  }

  async updateRegistry(id, updates) {
    if (!this.config.registries[id]) {
      throw new Error(`Registry not found: ${id}`)
    }

    const registry = this.config.registries[id]
    Object.assign(registry, updates)

    await this.saveConfig()
    this.emit('registry_updated', { id, registry })

    return true
  }

  /**
   * Security management
   */
  isTrustedPublisher(publisherId) {
    return this.config.security.trustedPublishers.includes(publisherId)
  }

  isBlockedPublisher(publisherId) {
    return this.config.security.blockedPublishers.includes(publisherId)
  }

  async addTrustedPublisher(publisherId) {
    if (!this.isTrustedPublisher(publisherId)) {
      this.config.security.trustedPublishers.push(publisherId)
      await this.saveConfig()
      this.emit('publisher_trusted', { publisherId })
    }
  }

  async removeTrustedPublisher(publisherId) {
    const index = this.config.security.trustedPublishers.indexOf(publisherId)
    if (index !== -1) {
      this.config.security.trustedPublishers.splice(index, 1)
      await this.saveConfig()
      this.emit('publisher_untrusted', { publisherId })
    }
  }

  async blockPublisher(publisherId) {
    if (!this.isBlockedPublisher(publisherId)) {
      this.config.security.blockedPublishers.push(publisherId)
      await this.saveConfig()
      this.emit('publisher_blocked', { publisherId })
    }
  }

  async unblockPublisher(publisherId) {
    const index = this.config.security.blockedPublishers.indexOf(publisherId)
    if (index !== -1) {
      this.config.security.blockedPublishers.splice(index, 1)
      await this.saveConfig()
      this.emit('publisher_unblocked', { publisherId })
    }
  }

  /**
   * Environment-specific configurations
   */
  async switchEnvironment(env) {
    const environments = {
      [REGISTRY_ENV.PRODUCTION]: {
        'registries.primary.url': 'https://registry.lokus.dev',
        'security.level': SECURITY_LEVEL.STANDARD,
        'analytics.enabled': true
      },
      [REGISTRY_ENV.STAGING]: {
        'registries.primary.url': 'https://staging-registry.lokus.dev',
        'security.level': SECURITY_LEVEL.STANDARD,
        'analytics.enabled': false
      },
      [REGISTRY_ENV.DEVELOPMENT]: {
        'registries.primary.url': 'https://dev-registry.lokus.dev',
        'security.level': SECURITY_LEVEL.PERMISSIVE,
        'analytics.enabled': false,
        'developer.enableDeveloperMode': true
      },
      [REGISTRY_ENV.LOCAL]: {
        'registries.primary.url': 'http://localhost:3000',
        'security.level': SECURITY_LEVEL.PERMISSIVE,
        'analytics.enabled': false,
        'developer.enableDeveloperMode': true,
        'developer.allowLocalPackages': true
      }
    }

    const envConfig = environments[env]
    if (!envConfig) {
      throw new Error(`Unknown environment: ${env}`)
    }

    await this.update(envConfig)
    await this.set('environment', env)

    this.emit('environment_changed', { environment: env })
    this.logger.info(`Switched to ${env} environment`)
  }

  /**
   * Import/Export configuration
   */
  exportConfig() {
    return {
      version: this.config.version,
      timestamp: new Date().toISOString(),
      config: this.deepClone(this.config)
    }
  }

  async importConfig(configData, merge = true) {
    try {
      if (merge) {
        this.config = this.deepMerge(this.config, configData.config)
      } else {
        this.config = this.deepClone(configData.config)
      }

      await this.validateConfig()
      await this.saveConfig()

      this.emit('config_imported', { merge, version: configData.version })
      this.logger.info('Configuration imported successfully')

      return true
    } catch (error) {
      this.logger.error('Failed to import configuration:', error)
      throw error
    }
  }

  /**
   * Configuration watching
   */
  async watchConfig() {
    // TODO: Implement file watching for external config changes
    // This would use file system watchers to detect changes
    this.logger.info('Configuration watching enabled')
  }

  async unwatchConfig() {
    for (const watcher of this.watchers) {
      if (typeof watcher.close === 'function') {
        watcher.close()
      }
    }
    this.watchers.clear()
    this.logger.info('Configuration watching disabled')
  }

  /**
   * Utility methods
   */

  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj)
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item))

    const cloned = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key])
      }
    }
    return cloned
  }

  deepMerge(target, source) {
    const result = this.deepClone(target)

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          result[key] &&
          typeof result[key] === 'object' &&
          !Array.isArray(result[key]) &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key], source[key])
        } else {
          result[key] = this.deepClone(source[key])
        }
      }
    }

    return result
  }

  async setupConfigPath() {
    if (!this.configPath) {
      const home = await homeDir()
      this.configPath = await join(home, '.lokus', 'registry-config.json')
    }
  }

  /**
   * Preset configurations
   */
  getPresets() {
    return {
      'secure': {
        'security.level': SECURITY_LEVEL.STRICT,
        'security.verifySignatures': true,
        'security.allowUntrustedPublishers': false,
        'security.sandboxMode': true,
        'security.permissionPrompts': true,
        'updates.autoInstallSecurity': true
      },
      'developer': {
        'security.level': SECURITY_LEVEL.PERMISSIVE,
        'developer.enableDeveloperMode': true,
        'developer.showDebugInfo': true,
        'developer.allowLocalPackages': true,
        'ui.showPreviewPlugins': true
      },
      'enterprise': {
        'security.level': SECURITY_LEVEL.STRICT,
        'updates.policy': UPDATE_POLICY.MANUAL,
        'analytics.enabled': false,
        'analytics.collectUsageStats': false,
        'analytics.collectErrorReports': false
      }
    }
  }

  async applyPreset(presetName) {
    const presets = this.getPresets()
    const preset = presets[presetName]

    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`)
    }

    await this.update(preset)
    this.emit('preset_applied', { preset: presetName })
    this.logger.info(`Applied ${presetName} preset`)
  }

  /**
   * Configuration validation schemas
   */
  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        registries: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z0-9_-]+$': {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                enabled: { type: 'boolean' },
                priority: { type: 'number' },
                verified: { type: 'boolean' },
                mirrors: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' }
                }
              },
              required: ['name', 'url']
            }
          }
        },
        security: {
          type: 'object',
          properties: {
            level: { enum: Object.values(SECURITY_LEVEL) },
            verifySignatures: { type: 'boolean' },
            allowUntrustedPublishers: { type: 'boolean' }
          }
        }
        // Add more schema definitions as needed
      }
    }
  }

  /**
   * Reset and restore
   */
  async resetToDefaults() {
    this.config = this.deepClone(DEFAULT_CONFIG)
    await this.saveConfig()
    this.emit('config_reset')
    this.logger.info('Configuration reset to defaults')
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    await this.unwatchConfig()
    await this.saveConfig()

    this.emit('shutdown')
    this.removeAllListeners()
  }
}

// Create singleton instance
export const registryConfig = new RegistryConfig()

export default RegistryConfig