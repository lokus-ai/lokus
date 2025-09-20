/**
 * Security Configuration Manager for MCP Server
 * 
 * Provides centralized configuration management for all security components
 * including authentication, authorization, rate limiting, CORS, and headers.
 */

import { EventEmitter } from 'events'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

class SecurityConfigManager extends EventEmitter {
  constructor(configPath = null) {
    super()
    
    try {
      this.configPath = configPath
      this.config = this.getDefaultConfig()
      this.watchers = new Map()
      this.validateConfig = true
      
      // Environment-based overrides
      this.applyEnvironmentOverrides()
    } catch (error) {
      console.error('SecurityConfigManager constructor error:', error)
      // Provide minimal fallback config
      this.configPath = null
      this.config = this.getMinimalConfig()
      this.watchers = new Map()
      this.validateConfig = false
    }
  }
  
  /**
   * Minimal fallback configuration for browser environments
   */
  getMinimalConfig() {
    return {
      environment: 'development',
      debug: false,
      auth: {
        enabled: true,
        jwt: { enabled: false },
        apiKey: { enabled: true },
        middleware: { enableAuditLog: false }
      },
      rateLimit: { enabled: true, defaultLimits: { requestsPerMinute: 60 } },
      cors: { enabled: true, allowedOrigins: ['*'] },
      headers: { enabled: true },
      validation: { enabled: true },
      logging: { level: 'info' }
    }
  }

  /**
   * Get default security configuration
   */
  getDefaultConfig() {
    try {
      const isNode = typeof process !== 'undefined' && process.env
      
      return {
        // Environment settings
        environment: (isNode ? process.env.NODE_ENV : null) || 'development',
        debug: (isNode ? process.env.DEBUG : null) === 'true',
        
        // Authentication settings
        auth: {
          enabled: true,
          jwt: {
            enabled: true,
            accessTokenSecret: (isNode ? process.env.JWT_ACCESS_SECRET : null) || this.generateSecret(),
            refreshTokenSecret: (isNode ? process.env.JWT_REFRESH_SECRET : null) || this.generateSecret(),
            accessTokenExpiry: (isNode ? process.env.JWT_ACCESS_EXPIRY : null) || '15m',
            refreshTokenExpiry: (isNode ? process.env.JWT_REFRESH_EXPIRY : null) || '7d',
            issuer: (isNode ? process.env.JWT_ISSUER : null) || 'lokus-mcp-server',
            audience: (isNode ? process.env.JWT_AUDIENCE : null) || 'lokus-client',
            algorithm: 'HS256'
          },
        
        apiKey: {
          enabled: true,
          keyLength: 32,
          keyPrefix: 'mcp_',
          defaultExpiry: '365d',
          maxKeysPerClient: 10,
          enableAuditLog: true
        },
        
        middleware: {
          enableJWT: true,
          enableAPIKeys: true,
          enableRateLimit: true,
          enableValidation: true,
          enableAuditLog: true,
          bypassPaths: ['/health', '/metrics', '/docs', '/api/docs'],
          adminPaths: ['/admin', '/api/admin'],
          requireAuthPaths: ['/api'],
          jwtRequired: false,
          apiKeyRequired: true,
          defaultScopes: ['read']
        }
      },
      
      // Rate limiting settings
      rateLimit: {
        enabled: true,
        algorithm: 'sliding_window', // 'token_bucket', 'fixed_window', 'sliding_window'
        defaultLimits: {
          requestsPerMinute: parseInt((isNode ? process.env.RATE_LIMIT_PER_MINUTE : null)) || 60,
          requestsPerHour: parseInt((isNode ? process.env.RATE_LIMIT_PER_HOUR : null)) || 1000,
          requestsPerDay: parseInt((isNode ? process.env.RATE_LIMIT_PER_DAY : null)) || 10000,
          burstLimit: parseInt((isNode ? process.env.RATE_LIMIT_BURST : null)) || 10
        },
        enableBurstProtection: true,
        enableAdaptiveRateLimit: false,
        cleanupInterval: 60000,
        maxMemoryUsage: 100000
      },
      
      // CORS settings
      cors: {
        enabled: true,
        allowedOrigins: this.parseArray(process.env.CORS_ORIGINS) || [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:8080'
        ],
        allowCredentials: true,
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'X-API-Key',
          'X-Request-ID',
          'X-Client-Version'
        ],
        exposedHeaders: [
          'X-Request-ID',
          'X-RateLimit-Limit-Minute',
          'X-RateLimit-Remaining-Minute',
          'X-RateLimit-Reset'
        ],
        maxAge: 86400,
        enableOriginValidation: true,
        enableSecurityChecks: true,
        allowPrivateNetworks: process.env.NODE_ENV === 'development',
        strictMode: process.env.NODE_ENV === 'production'
      },
      
      // Security headers settings
      headers: {
        enabled: true,
        csp: {
          enabled: true,
          directives: this.getCSPDirectives(),
          reportOnly: process.env.NODE_ENV === 'development',
          reportUri: process.env.CSP_REPORT_URI || null,
          nonce: true
        },
        hsts: {
          enabled: process.env.NODE_ENV === 'production',
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: false
        },
        frameOptions: {
          enabled: true,
          policy: 'DENY'
        },
        contentTypeOptions: {
          enabled: true,
          nosniff: true
        },
        xssProtection: {
          enabled: true,
          mode: '1; mode=block'
        },
        referrerPolicy: {
          enabled: true,
          policy: 'strict-origin-when-cross-origin'
        },
        permissionsPolicy: {
          enabled: true,
          directives: {
            camera: [],
            microphone: [],
            geolocation: [],
            payment: []
          }
        },
        removeServerHeader: true,
        customServerHeader: 'Lokus-MCP-Server'
      },
      
      // Request validation settings
      validation: {
        enabled: true,
        maxPayloadSize: 10 * 1024 * 1024, // 10MB
        maxStringLength: 10000,
        maxArrayLength: 1000,
        maxObjectDepth: 10,
        maxHeaderSize: 8192,
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedContentTypes: [
          'application/json',
          'application/x-www-form-urlencoded',
          'multipart/form-data',
          'text/plain'
        ],
        enableStrictValidation: true,
        enableSanitization: true,
        enableSecurityChecks: true
      },
      
      // Logging and monitoring
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableAuditLog: true,
        enableSecurityLog: true,
        maxLogEntries: 10000,
        logRotation: {
          enabled: true,
          maxFiles: 10,
          maxSize: '10m'
        }
      },
      
      // Development overrides
      development: {
        relaxedCORS: true,
        extendedCSP: true,
        verboseLogging: true,
        disableHSTS: true,
        allowInsecureConnections: true
      },
      
      // Production hardening
      production: {
        strictCORS: true,
        strictCSP: true,
        enableHSTS: true,
        requireHTTPS: true,
        enableAllSecurityHeaders: true
      }
    }
    } catch (error) {
      console.error('getDefaultConfig error:', error)
      // Return minimal config as fallback
      return this.getMinimalConfig()
    }
  }

  /**
   * Get CSP directives based on environment
   */
  getCSPDirectives() {
    try {
      const isDevelopment = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') || false
    
    if (isDevelopment) {
      return {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*'],
        'style-src': ["'self'", "'unsafe-inline'", 'localhost:*'],
        'img-src': ["'self'", 'data:', 'blob:', 'localhost:*', 'https:'],
        'connect-src': ["'self'", 'ws:', 'wss:', 'localhost:*'],
        'font-src': ["'self'", 'data:', 'localhost:*'],
        'media-src': ["'self'", 'localhost:*'],
        'object-src': ["'none'"],
        'frame-src': ["'self'", 'localhost:*'],
        'worker-src': ["'self'", 'blob:', 'localhost:*']
      }
    }
    
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'child-src': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': []
    }
    } catch (error) {
      console.error('getCSPDirectives error:', error)
      // Return minimal CSP as fallback
      return {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'object-src': ["'none'"]
      }
    }
  }

  /**
   * Apply environment-based configuration overrides
   */
  applyEnvironmentOverrides() {
    const env = this.config.environment
    
    if (env === 'development') {
      this.applyDevelopmentOverrides()
    } else if (env === 'production') {
      this.applyProductionOverrides()
    }
  }

  /**
   * Apply development-specific overrides
   */
  applyDevelopmentOverrides() {
    const devConfig = this.config.development
    
    if (devConfig.relaxedCORS) {
      this.config.cors.allowedOrigins.push('http://localhost:*')
      this.config.cors.strictMode = false
    }
    
    if (devConfig.extendedCSP) {
      this.config.headers.csp.directives = this.getCSPDirectives()
    }
    
    if (devConfig.disableHSTS) {
      this.config.headers.hsts.enabled = false
    }
    
    if (devConfig.verboseLogging) {
      this.config.logging.level = 'debug'
    }
    
    // Relax rate limits for development
    this.config.rateLimit.defaultLimits.requestsPerMinute *= 2
    this.config.rateLimit.defaultLimits.requestsPerHour *= 2
  }

  /**
   * Apply production-specific overrides
   */
  applyProductionOverrides() {
    const prodConfig = this.config.production
    
    if (prodConfig.strictCORS) {
      this.config.cors.strictMode = true
      this.config.cors.enableSecurityChecks = true
    }
    
    if (prodConfig.strictCSP) {
      this.config.headers.csp.reportOnly = false
    }
    
    if (prodConfig.enableHSTS) {
      this.config.headers.hsts.enabled = true
      this.config.headers.hsts.includeSubDomains = true
    }
    
    if (prodConfig.enableAllSecurityHeaders) {
      this.config.headers.crossOriginEmbedderPolicy = 'require-corp'
      this.config.headers.crossOriginOpenerPolicy = 'same-origin'
      this.config.headers.crossOriginResourcePolicy = 'same-origin'
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig(configPath = null) {
    const filePath = configPath || this.configPath
    
    if (!filePath) {
      throw new Error('No configuration file path provided')
    }

    try {
      const configData = await fs.readFile(filePath, 'utf8')
      const loadedConfig = JSON.parse(configData)
      
      // Merge with default config
      this.config = this.deepMerge(this.config, loadedConfig)
      
      // Validate configuration
      if (this.validateConfig) {
        this.validateConfiguration()
      }
      
      // Apply environment overrides after loading
      this.applyEnvironmentOverrides()
      
      this.emit('configLoaded', { path: filePath, config: this.config })
      
      return this.config
    } catch (error) {
      this.emit('configLoadError', { path: filePath, error: error.message })
      throw new Error(`Failed to load configuration: ${error.message}`)
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(configPath = null) {
    const filePath = configPath || this.configPath
    
    if (!filePath) {
      throw new Error('No configuration file path provided')
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
      
      // Save configuration
      const configData = JSON.stringify(this.config, null, 2)
      await fs.writeFile(filePath, configData, 'utf8')
      
      this.emit('configSaved', { path: filePath })
      
      return true
    } catch (error) {
      this.emit('configSaveError', { path: filePath, error: error.message })
      throw new Error(`Failed to save configuration: ${error.message}`)
    }
  }

  /**
   * Watch configuration file for changes
   */
  async watchConfig(configPath = null) {
    const filePath = configPath || this.configPath
    
    if (!filePath) {
      throw new Error('No configuration file path provided')
    }

    try {
      const watcher = fs.watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          try {
            await this.loadConfig(filePath)
            this.emit('configReloaded', { path: filePath })
          } catch (error) {
            this.emit('configReloadError', { path: filePath, error: error.message })
          }
        }
      })
      
      this.watchers.set(filePath, watcher)
      this.emit('configWatchStarted', { path: filePath })
      
      return watcher
    } catch (error) {
      this.emit('configWatchError', { path: filePath, error: error.message })
      throw new Error(`Failed to watch configuration: ${error.message}`)
    }
  }

  /**
   * Stop watching configuration file
   */
  stopWatching(configPath = null) {
    const filePath = configPath || this.configPath
    const watcher = this.watchers.get(filePath)
    
    if (watcher) {
      watcher.close()
      this.watchers.delete(filePath)
      this.emit('configWatchStopped', { path: filePath })
    }
  }

  /**
   * Update configuration section
   */
  updateConfig(section, updates) {
    if (!this.config[section]) {
      throw new Error(`Configuration section '${section}' does not exist`)
    }
    
    const oldConfig = this.deepClone(this.config[section])
    this.config[section] = this.deepMerge(this.config[section], updates)
    
    // Validate updated configuration
    if (this.validateConfig) {
      this.validateConfigSection(section, this.config[section])
    }
    
    this.emit('configUpdated', { 
      section, 
      oldConfig, 
      newConfig: this.config[section],
      updates 
    })
    
    return this.config[section]
  }

  /**
   * Get configuration section
   */
  getConfig(section = null) {
    if (section) {
      return this.deepClone(this.config[section])
    }
    return this.deepClone(this.config)
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const errors = []
    
    // Validate auth configuration
    if (this.config.auth.enabled) {
      if (this.config.auth.jwt.enabled && !this.config.auth.jwt.accessTokenSecret) {
        errors.push('JWT access token secret is required when JWT is enabled')
      }
      
      if (this.config.auth.apiKey.enabled && this.config.auth.apiKey.keyLength < 16) {
        errors.push('API key length must be at least 16 characters')
      }
    }
    
    // Validate rate limit configuration
    if (this.config.rateLimit.enabled) {
      const limits = this.config.rateLimit.defaultLimits
      if (limits.requestsPerMinute <= 0 || limits.requestsPerHour <= 0) {
        errors.push('Rate limit values must be positive numbers')
      }
    }
    
    // Validate CORS configuration
    if (this.config.cors.enabled) {
      if (!Array.isArray(this.config.cors.allowedOrigins)) {
        errors.push('CORS allowed origins must be an array')
      }
    }
    
    // Validate headers configuration
    if (this.config.headers.enabled) {
      if (this.config.headers.hsts.enabled && this.config.headers.hsts.maxAge <= 0) {
        errors.push('HSTS max-age must be a positive number')
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
    }
  }

  /**
   * Validate specific configuration section
   */
  validateConfigSection(section, config) {
    // Section-specific validation logic
    switch (section) {
      case 'auth':
        if (config.enabled && config.jwt.enabled && !config.jwt.accessTokenSecret) {
          throw new Error('JWT access token secret is required')
        }
        break
      case 'rateLimit':
        if (config.enabled && config.defaultLimits.requestsPerMinute <= 0) {
          throw new Error('Rate limit must be positive')
        }
        break
      case 'cors':
        if (config.enabled && !Array.isArray(config.allowedOrigins)) {
          throw new Error('CORS origins must be an array')
        }
        break
    }
  }

  /**
   * Generate secure configuration for production
   */
  generateProductionConfig() {
    const prodConfig = this.deepClone(this.config)
    
    // Set environment to production
    prodConfig.environment = 'production'
    
    // Generate new secrets
    prodConfig.auth.jwt.accessTokenSecret = this.generateSecret()
    prodConfig.auth.jwt.refreshTokenSecret = this.generateSecret()
    
    // Harden security settings
    prodConfig.cors.strictMode = true
    prodConfig.cors.allowPrivateNetworks = false
    prodConfig.headers.hsts.enabled = true
    prodConfig.headers.csp.reportOnly = false
    prodConfig.validation.enableStrictValidation = true
    
    // Restrict CORS origins (remove localhost)
    prodConfig.cors.allowedOrigins = prodConfig.cors.allowedOrigins.filter(
      origin => !origin.includes('localhost') && !origin.includes('127.0.0.1')
    )
    
    return prodConfig
  }

  /**
   * Export configuration template
   */
  exportTemplate() {
    const template = this.deepClone(this.getDefaultConfig())
    
    // Remove sensitive data
    delete template.auth.jwt.accessTokenSecret
    delete template.auth.jwt.refreshTokenSecret
    
    // Add comments as properties
    template._comments = {
      environment: 'Set to "development" or "production"',
      'auth.jwt.accessTokenSecret': 'Generate with: openssl rand -hex 32',
      'auth.jwt.refreshTokenSecret': 'Generate with: openssl rand -hex 32',
      'cors.allowedOrigins': 'Add your frontend URLs',
      'rateLimit.defaultLimits': 'Adjust based on your needs'
    }
    
    return template
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }

  /**
   * Deep clone object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Generate cryptographic secret
   */
  generateSecret() {
    try {
      return crypto.randomBytes(32).toString('hex')
    } catch (error) {
      console.warn('Crypto module not available, using fallback secret generation')
      // Fallback for browser environments
      return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
    }
  }

  /**
   * Parse array from environment variable
   */
  parseArray(envVar) {
    if (!envVar) return null
    try {
      return envVar.split(',').map(item => item.trim())
    } catch {
      return null
    }
  }

  /**
   * Get environment-specific config
   */
  getEnvironmentConfig(environment) {
    const envConfig = this.deepClone(this.getDefaultConfig())
    envConfig.environment = environment
    
    if (environment === 'development') {
      this.config = envConfig
      this.applyDevelopmentOverrides()
    } else if (environment === 'production') {
      this.config = envConfig
      this.applyProductionOverrides()
    }
    
    return this.config
  }

  /**
   * Reset to default configuration
   */
  resetToDefault() {
    this.config = this.getDefaultConfig()
    this.applyEnvironmentOverrides()
    this.emit('configReset')
    return this.config
  }

  /**
   * Get configuration statistics
   */
  getStats() {
    return {
      environment: this.config.environment,
      authEnabled: this.config.auth.enabled,
      jwtEnabled: this.config.auth.jwt.enabled,
      apiKeyEnabled: this.config.auth.apiKey.enabled,
      rateLimitEnabled: this.config.rateLimit.enabled,
      corsEnabled: this.config.cors.enabled,
      headersEnabled: this.config.headers.enabled,
      validationEnabled: this.config.validation.enabled,
      watchers: this.watchers.size,
      configSections: Object.keys(this.config).length
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    // Stop all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    
    this.removeAllListeners()
  }
}

export { SecurityConfigManager }
export default SecurityConfigManager