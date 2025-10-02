/**
 * Data Provider Registry
 * 
 * Central registry for managing all data providers in Lokus.
 * Handles provider registration, discovery, selection, and lifecycle management.
 * Provides fallback mechanisms and error handling for robust data operations.
 */

import { EventEmitter } from '../utils/EventEmitter.js'
import { BaseDataProvider, DataProviderFactory } from '../api/DataAPI.js'

/**
 * Provider Registry - Manages all data providers
 */
export class ProviderRegistry extends EventEmitter {
  constructor() {
    super()
    this.providers = new Map() // id -> provider instance
    this.providersByType = new Map() // type -> Set<provider>
    this.activeProviders = new Map() // type -> active provider id
    this.fallbackProviders = new Map() // type -> fallback provider id
    this.providerConfigs = new Map() // id -> config
    this.healthStatus = new Map() // id -> health status
    this.metrics = {
      totalProviders: 0,
      activeProviders: 0,
      healthyProviders: 0,
      errors: 0,
      lastHealthCheck: null
    }
    this.healthCheckInterval = null
    this.isInitialized = false
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.isInitialized) return

    // Load provider configurations from storage
    await this._loadConfigurations()
    
    // Start health monitoring
    this._startHealthMonitoring()
    
    this.isInitialized = true
    this.emit('initialized')
  }

  /**
   * Register a data provider
   */
  async registerProvider(type, provider, config = {}) {
    if (!(provider instanceof BaseDataProvider)) {
      throw new Error('Provider must extend BaseDataProvider')
    }

    const providerId = provider.id
    if (this.providers.has(providerId)) {
      throw new Error(`Provider with id '${providerId}' already registered`)
    }

    try {
      // Store provider and configuration
      this.providers.set(providerId, provider)
      this.providerConfigs.set(providerId, config)

      // Group by type
      if (!this.providersByType.has(type)) {
        this.providersByType.set(type, new Set())
      }
      this.providersByType.get(type).add(provider)

      // Set up event listeners
      this._setupProviderEventListeners(provider)

      // Initialize the provider
      await provider.initialize()
      
      // Set as active if it's the first provider of this type
      if (!this.activeProviders.has(type)) {
        await this.setActiveProvider(type, providerId)
      }

      this.metrics.totalProviders++
      this.emit('providerRegistered', { type, providerId, provider })
      
      return providerId

    } catch (error) {
      console.error(`❌ Failed to register provider ${providerId}:`, error)
      this.metrics.errors++
      throw error
    }
  }

  /**
   * Unregister a data provider
   */
  async unregisterProvider(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`)
    }

    try {
      // Disconnect and cleanup
      await provider.disconnect()
      await provider.cleanup?.()

      // Remove from active providers if it was active
      for (const [type, activeId] of this.activeProviders.entries()) {
        if (activeId === providerId) {
          this.activeProviders.delete(type)
          // Try to set a fallback as active
          await this._activateFallbackProvider(type)
        }
      }

      // Remove from type grouping
      for (const [type, providers] of this.providersByType.entries()) {
        if (providers.has(provider)) {
          providers.delete(provider)
          if (providers.size === 0) {
            this.providersByType.delete(type)
          }
          break
        }
      }

      // Remove from registry
      this.providers.delete(providerId)
      this.providerConfigs.delete(providerId)
      this.healthStatus.delete(providerId)
      this.fallbackProviders.delete(providerId)

      this.metrics.totalProviders--
      this.emit('providerUnregistered', { providerId, provider })
      

    } catch (error) {
      console.error(`❌ Failed to unregister provider ${providerId}:`, error)
      this.metrics.errors++
      throw error
    }
  }

  /**
   * Set a provider as active for a specific type
   */
  async setActiveProvider(type, providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`)
    }

    // Verify provider supports the type
    const typeProviders = this.providersByType.get(type)
    if (!typeProviders || !typeProviders.has(provider)) {
      throw new Error(`Provider '${providerId}' does not support type '${type}'`)
    }

    try {
      // Deactivate current active provider
      const currentActiveId = this.activeProviders.get(type)
      if (currentActiveId && currentActiveId !== providerId) {
        const currentProvider = this.providers.get(currentActiveId)
        if (currentProvider) {
          await currentProvider.disconnect()
          currentProvider.isEnabled = false
        }
      }

      // Activate new provider
      await provider.connect()
      provider.isEnabled = true
      this.activeProviders.set(type, providerId)

      this.emit('activeProviderChanged', { type, providerId, provider })

    } catch (error) {
      console.error(`❌ Failed to set active provider ${providerId}:`, error)
      this.metrics.errors++
      
      // Try to activate fallback
      await this._activateFallbackProvider(type)
      throw error
    }
  }

  /**
   * Get the active provider for a type
   */
  getActiveProvider(type) {
    const providerId = this.activeProviders.get(type)
    if (!providerId) return null
    
    return this.providers.get(providerId)
  }

  /**
   * Get all providers of a specific type
   */
  getProvidersByType(type) {
    const providers = this.providersByType.get(type)
    return providers ? Array.from(providers) : []
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId) {
    return this.providers.get(providerId)
  }

  /**
   * Set fallback provider for a type
   */
  setFallbackProvider(type, providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`)
    }

    this.fallbackProviders.set(type, providerId)
    this.emit('fallbackProviderSet', { type, providerId })
  }

  /**
   * Get all registered providers
   */
  getAllProviders() {
    return Array.from(this.providers.values())
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) return null

    const config = this.providerConfigs.get(providerId)
    const health = this.healthStatus.get(providerId)
    
    return {
      ...provider.getMetadata(),
      config,
      health,
      isActive: Array.from(this.activeProviders.values()).includes(providerId),
      isFallback: Array.from(this.fallbackProviders.values()).includes(providerId)
    }
  }

  /**
   * Execute operation with automatic fallback
   */
  async executeWithFallback(type, operation, ...args) {
    const provider = this.getActiveProvider(type)
    if (!provider) {
      throw new Error(`No active provider found for type '${type}'`)
    }

    try {
      // Try with active provider
      return await operation(provider, ...args)
    } catch (error) {
      
      // Try with fallback provider
      const fallbackProviderId = this.fallbackProviders.get(type)
      if (fallbackProviderId) {
        const fallbackProvider = this.providers.get(fallbackProviderId)
        if (fallbackProvider && fallbackProvider.isConnected) {
          try {
            return await operation(fallbackProvider, ...args)
          } catch (fallbackError) {
            console.error(`Fallback ${type} provider also failed:`, fallbackError)
          }
        }
      }

      // If all else fails, throw the original error
      throw error
    }
  }

  /**
   * Perform health check on all providers
   */
  async performHealthCheck() {
    const results = new Map()
    let healthyCount = 0
    let activeCount = 0

    for (const [providerId, provider] of this.providers.entries()) {
      try {
        const health = await provider.healthCheck()
        results.set(providerId, {
          ...health,
          timestamp: Date.now(),
          status: health.connected ? 'healthy' : 'unhealthy'
        })

        if (health.connected) healthyCount++
        if (provider.isEnabled) activeCount++

      } catch (error) {
        results.set(providerId, {
          status: 'error',
          error: error.message,
          timestamp: Date.now(),
          connected: false,
          enabled: false
        })
      }
    }

    this.healthStatus = results
    this.metrics.healthyProviders = healthyCount
    this.metrics.activeProviders = activeCount
    this.metrics.lastHealthCheck = Date.now()

    this.emit('healthCheckCompleted', {
      results: Object.fromEntries(results),
      metrics: this.metrics
    })

    return results
  }

  /**
   * Get registry metrics and statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      providersByType: Object.fromEntries(
        Array.from(this.providersByType.entries()).map(([type, providers]) => [
          type,
          providers.size
        ])
      ),
      activeProviders: Object.fromEntries(this.activeProviders),
      fallbackProviders: Object.fromEntries(this.fallbackProviders)
    }
  }

  /**
   * Start automatic health monitoring
   */
  _startHealthMonitoring(intervalMs = 60000) { // 1 minute
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, intervalMs)
  }

  /**
   * Stop health monitoring
   */
  _stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /**
   * Set up event listeners for a provider
   */
  _setupProviderEventListeners(provider) {
    // Forward provider events
    provider.on('connected', () => {
      this.emit('providerConnected', { providerId: provider.id })
    })

    provider.on('disconnected', () => {
      this.emit('providerDisconnected', { providerId: provider.id })
    })

    provider.on('error', (error) => {
      this.metrics.errors++
      this.emit('providerError', { providerId: provider.id, error })
    })

    provider.on('configUpdated', (config) => {
      this.providerConfigs.set(provider.id, config)
      this.emit('providerConfigUpdated', { providerId: provider.id, config })
    })
  }

  /**
   * Try to activate a fallback provider
   */
  async _activateFallbackProvider(type) {
    const fallbackProviderId = this.fallbackProviders.get(type)
    if (fallbackProviderId) {
      try {
        await this.setActiveProvider(type, fallbackProviderId)
      } catch (error) {
        console.error(`❌ Failed to activate fallback ${type} provider:`, error)
      }
    } else {
      // Try to find any available provider of this type
      const availableProviders = this.getProvidersByType(type)
      for (const provider of availableProviders) {
        if (provider.isConnected) {
          try {
            await this.setActiveProvider(type, provider.id)
            break
          } catch (error) {
            console.error(`❌ Failed to activate ${type} provider ${provider.id}:`, error)
          }
        }
      }
    }
  }

  /**
   * Load provider configurations from storage
   */
  async _loadConfigurations() {
    try {
      // In a real implementation, this would load from persistent storage
      // For now, we'll use a placeholder
      const savedConfigs = {}
      
      for (const [providerId, config] of Object.entries(savedConfigs)) {
        this.providerConfigs.set(providerId, config)
      }

    } catch (error) {
    }
  }

  /**
   * Save provider configurations to storage
   */
  async _saveConfigurations() {
    try {
      const configs = Object.fromEntries(this.providerConfigs)
      // In a real implementation, this would save to persistent storage
      // localStorage.setItem('lokus-provider-configs', JSON.stringify(configs))
      
    } catch (error) {
      console.error('❌ Failed to save provider configurations:', error)
    }
  }

  /**
   * Create and register a provider from configuration
   */
  async createProvider(type, id, config = {}) {
    try {
      const provider = DataProviderFactory.create(type, id, config)
      await this.registerProvider(type, provider, config)
      return provider
    } catch (error) {
      console.error(`❌ Failed to create ${type} provider ${id}:`, error)
      throw error
    }
  }

  /**
   * Batch register multiple providers
   */
  async registerProviders(providerConfigs) {
    const results = []
    
    for (const { type, id, config } of providerConfigs) {
      try {
        const provider = await this.createProvider(type, id, config)
        results.push({ success: true, type, id, provider })
      } catch (error) {
        results.push({ success: false, type, id, error: error.message })
      }
    }

    return results
  }

  /**
   * Get provider selection UI data
   */
  getProviderSelectionData() {
    const data = {}
    
    for (const [type, providers] of this.providersByType.entries()) {
      data[type] = {
        providers: Array.from(providers).map(provider => ({
          id: provider.id,
          name: provider.config.name || provider.id,
          description: provider.config.description || '',
          isActive: this.activeProviders.get(type) === provider.id,
          isFallback: this.fallbackProviders.get(type) === provider.id,
          health: this.healthStatus.get(provider.id) || { status: 'unknown' }
        })),
        activeId: this.activeProviders.get(type),
        fallbackId: this.fallbackProviders.get(type)
      }
    }

    return data
  }

  /**
   * Cleanup and destroy the registry
   */
  async destroy() {
    this._stopHealthMonitoring()

    // Disconnect and cleanup all providers
    for (const provider of this.providers.values()) {
      try {
        await provider.disconnect()
        await provider.cleanup?.()
      } catch (error) {
        console.error('Error cleaning up provider:', error)
      }
    }

    // Save configurations before destroying
    await this._saveConfigurations()

    // Clear all data
    this.providers.clear()
    this.providersByType.clear()
    this.activeProviders.clear()
    this.fallbackProviders.clear()
    this.providerConfigs.clear()
    this.healthStatus.clear()

    this.isInitialized = false
    this.emit('destroyed')
  }
}

/**
 * Global provider registry instance
 */
export const providerRegistry = new ProviderRegistry()

/**
 * Provider Manager - High-level interface for provider operations
 */
export class ProviderManager {
  constructor(registry = providerRegistry) {
    this.registry = registry
  }

  /**
   * Initialize the provider system
   */
  async initialize() {
    await this.registry.initialize()
  }

  /**
   * Execute a graph operation with automatic fallback
   */
  async executeGraphOperation(operation, ...args) {
    return this.registry.executeWithFallback('graph', operation, ...args)
  }

  /**
   * Execute a kanban operation with automatic fallback
   */
  async executeKanbanOperation(operation, ...args) {
    return this.registry.executeWithFallback('kanban', operation, ...args)
  }

  /**
   * Execute a search operation with automatic fallback
   */
  async executeSearchOperation(operation, ...args) {
    return this.registry.executeWithFallback('search', operation, ...args)
  }

  /**
   * Execute a filesystem operation with automatic fallback
   */
  async executeFileSystemOperation(operation, ...args) {
    return this.registry.executeWithFallback('filesystem', operation, ...args)
  }

  /**
   * Execute a transform operation with automatic fallback
   */
  async executeTransformOperation(operation, ...args) {
    return this.registry.executeWithFallback('transform', operation, ...args)
  }

  /**
   * Get active providers for all types
   */
  getActiveProviders() {
    return {
      graph: this.registry.getActiveProvider('graph'),
      kanban: this.registry.getActiveProvider('kanban'),
      search: this.registry.getActiveProvider('search'),
      filesystem: this.registry.getActiveProvider('filesystem'),
      transform: this.registry.getActiveProvider('transform')
    }
  }

  /**
   * Get provider status summary
   */
  getProviderStatus() {
    const metrics = this.registry.getMetrics()
    const activeProviders = this.getActiveProviders()
    
    return {
      metrics,
      activeProviders: Object.fromEntries(
        Object.entries(activeProviders).map(([type, provider]) => [
          type,
          provider ? {
            id: provider.id,
            connected: provider.isConnected,
            enabled: provider.isEnabled
          } : null
        ])
      ),
      healthCheck: this.registry.healthStatus
    }
  }
}

// Export the global provider manager
export const providerManager = new ProviderManager()

export default ProviderRegistry