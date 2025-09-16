/**
 * Runtime Plugin State Management System (DEPRECATED)
 * This file has been superseded by /src/core/PluginStateManager.js
 * 
 * @deprecated Use pluginStateManager from /src/core/PluginStateManager.js instead
 * This file is kept for backward compatibility during migration
 */

import { invoke } from '@tauri-apps/api/core'
import { EventEmitter } from '../../utils/EventEmitter.js'
import { pluginStateManager } from '../../core/PluginStateManager.js'

export class PluginStateManager extends EventEmitter {
  constructor() {
    super()
    
    // Log deprecation warning
    console.warn('⚠️ DEPRECATED: plugins/runtime/PluginStateManager is deprecated. Use core/PluginStateManager instead.');
    
    this.pluginStates = new Map() // pluginId -> PluginState
    this.globalState = new Map() // global state shared across plugins
    this.stateHistory = new Map() // pluginId -> state history
    this.pendingOperations = new Map() // pluginId -> pending async operations
    this.isInitialized = false
    this.logger = console
    
    // Delegate to unified state manager when available
    this.unifiedManager = pluginStateManager
    
    this.setupAutoSave()
  }

  /**
   * Initialize the state manager (delegates to unified manager)
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Initialize unified manager
      await this.unifiedManager.initialize()
      
      // Load global state
      await this.loadGlobalState()
      
      this.isInitialized = true
      this.emit('state_manager_initialized')
      this.logger.info('Runtime plugin state manager initialized (delegating to unified manager)')
    } catch (error) {
      this.logger.error('Failed to initialize runtime state manager:', error)
      throw error
    }
  }

  /**
   * Create plugin state
   */
  async createPluginState(pluginId, manifest) {
    if (this.pluginStates.has(pluginId)) {
      return this.pluginStates.get(pluginId)
    }

    try {
      // Load existing state from storage
      const persistedState = await this.loadPluginState(pluginId)
      
      const pluginState = new PluginState(pluginId, manifest, persistedState)
      
      // Set up state event handlers
      this.setupStateEventHandlers(pluginState)
      
      this.pluginStates.set(pluginId, pluginState)
      this.emit('plugin_state_created', { pluginId })
      
      return pluginState
    } catch (error) {
      this.logger.error(`Failed to create state for plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Get plugin state (delegates to unified manager when available)
   */
  getPluginState(pluginId) {
    // Try unified manager first
    if (this.unifiedManager && this.unifiedManager.isInitialized) {
      const plugin = this.unifiedManager.getPlugin(pluginId)
      if (plugin) {
        // Convert to legacy format for backward compatibility
        return {
          pluginId,
          get: (key, defaultValue) => plugin[key] ?? defaultValue,
          set: async (key, value) => {
            await this.unifiedManager.updatePluginSettings(pluginId, { [key]: value })
          },
          getData: () => plugin
        }
      }
    }
    
    // Fallback to local state
    return this.pluginStates.get(pluginId)
  }

  /**
   * Set up state event handlers
   */
  setupStateEventHandlers(pluginState) {
    pluginState.on('state_changed', (data) => {
      this.handleStateChange(pluginState.pluginId, data)
    })
    
    pluginState.on('settings_changed', (data) => {
      this.handleSettingsChange(pluginState.pluginId, data)
    })
    
    pluginState.on('save_requested', () => {
      this.savePluginState(pluginState.pluginId)
    })
  }

  /**
   * Handle state changes
   */
  async handleStateChange(pluginId, data) {
    try {
      // Add to history
      this.addToStateHistory(pluginId, data)
      
      // Emit global state change event
      this.emit('state_changed', { pluginId, ...data })
      
      // Auto-save if enabled
      if (data.autoSave !== false) {
        await this.savePluginState(pluginId)
      }
    } catch (error) {
      this.logger.error(`Error handling state change for plugin ${pluginId}:`, error)
    }
  }

  /**
   * Handle settings changes
   */
  async handleSettingsChange(pluginId, data) {
    try {
      // Save settings to backend
      await invoke('set_plugin_setting', {
        pluginId,
        key: data.key,
        value: data.value
      })
      
      this.emit('settings_changed', { pluginId, ...data })
    } catch (error) {
      this.logger.error(`Error saving setting for plugin ${pluginId}:`, error)
    }
  }

  /**
   * Load plugin state from storage
   */
  async loadPluginState(pluginId) {
    try {
      const state = await invoke('get_plugin_state', { pluginId })
      return state || {}
    } catch (error) {
      this.logger.debug(`No existing state for plugin ${pluginId}`)
      return {}
    }
  }

  /**
   * Save plugin state to storage
   */
  async savePluginState(pluginId) {
    const pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      return
    }

    try {
      // Prevent concurrent saves
      if (this.pendingOperations.has(pluginId)) {
        return this.pendingOperations.get(pluginId)
      }

      const savePromise = this.performStateSave(pluginId, pluginState)
      this.pendingOperations.set(pluginId, savePromise)
      
      await savePromise
      this.pendingOperations.delete(pluginId)
      
      this.emit('state_saved', { pluginId })
    } catch (error) {
      this.logger.error(`Failed to save state for plugin ${pluginId}:`, error)
      this.pendingOperations.delete(pluginId)
      throw error
    }
  }

  /**
   * Perform actual state save
   */
  async performStateSave(pluginId, pluginState) {
    const stateData = pluginState.serialize()
    
    await invoke('save_plugin_state', {
      pluginId,
      state: stateData
    })
    
    pluginState.markSaved()
  }

  /**
   * Load global state
   */
  async loadGlobalState() {
    try {
      const globalState = await invoke('get_global_plugin_state')
      if (globalState) {
        for (const [key, value] of Object.entries(globalState)) {
          this.globalState.set(key, value)
        }
      }
    } catch (error) {
      this.logger.debug('No existing global state found')
    }
  }

  /**
   * Save global state
   */
  async saveGlobalState() {
    try {
      const stateObject = Object.fromEntries(this.globalState)
      await invoke('save_global_plugin_state', { state: stateObject })
      this.emit('global_state_saved')
    } catch (error) {
      this.logger.error('Failed to save global state:', error)
      throw error
    }
  }

  /**
   * Get global state value
   */
  getGlobalState(key, defaultValue = null) {
    return this.globalState.get(key) ?? defaultValue
  }

  /**
   * Set global state value
   */
  async setGlobalState(key, value) {
    this.globalState.set(key, value)
    await this.saveGlobalState()
    this.emit('global_state_changed', { key, value })
  }

  /**
   * Delete global state value
   */
  async deleteGlobalState(key) {
    if (this.globalState.delete(key)) {
      await this.saveGlobalState()
      this.emit('global_state_deleted', { key })
    }
  }

  /**
   * Add to state history
   */
  addToStateHistory(pluginId, stateChange) {
    if (!this.stateHistory.has(pluginId)) {
      this.stateHistory.set(pluginId, [])
    }
    
    const history = this.stateHistory.get(pluginId)
    history.push({
      ...stateChange,
      timestamp: Date.now()
    })
    
    // Limit history size
    if (history.length > 100) {
      history.splice(0, history.length - 80)
    }
  }

  /**
   * Get state history for plugin
   */
  getStateHistory(pluginId, limit = 50) {
    const history = this.stateHistory.get(pluginId) || []
    return history.slice(-limit)
  }

  /**
   * Clear state history for plugin
   */
  clearStateHistory(pluginId) {
    this.stateHistory.delete(pluginId)
  }

  /**
   * Export plugin state (with validation)
   */
  async exportPluginState(pluginId) {
    // Validate input
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error(`Invalid plugin ID: ${pluginId}`)
    }
    
    const pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      throw new Error(`Plugin state not found: ${pluginId}`)
    }
    
    try {
      return {
        pluginId,
        manifest: pluginState.manifest || {},
        state: pluginState.serialize(),
        history: this.getStateHistory(pluginId),
        exportedAt: Date.now()
      }
    } catch (error) {
      this.logger.error(`Failed to export state for plugin ${pluginId}:`, error)
      throw new Error(`Export failed for ${pluginId}: ${error.message}`)
    }
  }

  /**
   * Import plugin state
   */
  async importPluginState(stateData) {
    const { pluginId, state, manifest } = stateData
    
    // Create or update plugin state
    let pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      pluginState = await this.createPluginState(pluginId, manifest)
    }
    
    // Import state data
    pluginState.deserialize(state)
    
    // Save imported state
    await this.savePluginState(pluginId)
    
    this.emit('state_imported', { pluginId })
  }

  /**
   * Reset plugin state (with validation)
   */
  async resetPluginState(pluginId) {
    // Validate input
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error(`Invalid plugin ID: ${pluginId}`)
    }
    
    const pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      throw new Error(`Plugin state not found: ${pluginId}`)
    }
    
    try {
      pluginState.reset()
      await this.savePluginState(pluginId)
      this.clearStateHistory(pluginId)
      
      this.emit('state_reset', { pluginId })
      this.logger.info(`Reset state for plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to reset state for plugin ${pluginId}:`, error)
      throw new Error(`Reset failed for ${pluginId}: ${error.message}`)
    }
  }

  /**
   * Setup auto-save functionality
   */
  setupAutoSave() {
    // Auto-save every 30 seconds
    setInterval(async () => {
      await this.performAutoSave()
    }, 30000)
    
    // Save on application beforeunload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.performAutoSave()
      })
    }
  }

  /**
   * Perform auto-save for dirty states
   */
  async performAutoSave() {
    const dirtyPlugins = []
    
    for (const [pluginId, pluginState] of this.pluginStates) {
      if (pluginState.isDirty()) {
        dirtyPlugins.push(pluginId)
      }
    }
    
    if (dirtyPlugins.length > 0) {
      this.logger.debug(`Auto-saving state for ${dirtyPlugins.length} plugins`)
      
      for (const pluginId of dirtyPlugins) {
        try {
          await this.savePluginState(pluginId)
        } catch (error) {
          this.logger.error(`Auto-save failed for plugin ${pluginId}:`, error)
        }
      }
    }
  }

  /**
   * Cleanup plugin state
   */
  async cleanupPluginState(pluginId) {
    const pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      return
    }
    
    try {
      // Save final state
      if (pluginState.isDirty()) {
        await this.savePluginState(pluginId)
      }
      
      // Cleanup event listeners
      pluginState.removeAllListeners()
      
      // Remove from maps
      this.pluginStates.delete(pluginId)
      this.stateHistory.delete(pluginId)
      this.pendingOperations.delete(pluginId)
      
      this.emit('state_cleanup', { pluginId })
    } catch (error) {
      this.logger.error(`Error cleaning up state for plugin ${pluginId}:`, error)
    }
  }

  /**
   * Get state manager statistics (enhanced with validation)
   */
  getStats() {
    try {
      const states = Array.from(this.pluginStates.values())
      
      const stats = {
        totalPlugins: states.length,
        dirtyStates: states.filter(state => state && typeof state.isDirty === 'function' && state.isDirty()).length,
        globalStateSize: this.globalState.size,
        totalHistoryEntries: Array.from(this.stateHistory.values())
          .reduce((total, history) => total + (Array.isArray(history) ? history.length : 0), 0),
        pendingOperations: this.pendingOperations.size,
        isInitialized: this.isInitialized,
        unifiedManagerAvailable: this.unifiedManager && this.unifiedManager.isInitialized,
        statesByPlugin: states
          .filter(state => state && state.pluginId)
          .map(state => {
            try {
              return {
                pluginId: state.pluginId,
                dirty: typeof state.isDirty === 'function' ? state.isDirty() : false,
                size: typeof state.getSize === 'function' ? state.getSize() : 0,
                lastModified: typeof state.getLastModified === 'function' ? state.getLastModified() : null,
                valid: true
              }
            } catch (error) {
              this.logger.warn(`Invalid state for plugin ${state.pluginId}:`, error)
              return {
                pluginId: state.pluginId,
                dirty: false,
                size: 0,
                lastModified: null,
                valid: false,
                error: error.message
              }
            }
          })
      }
      
      // Include unified manager stats if available
      if (this.unifiedManager && this.unifiedManager.isInitialized) {
        stats.unifiedManagerStats = this.unifiedManager.getStats()
      }
      
      return stats
    } catch (error) {
      this.logger.error('Failed to get stats:', error)
      return {
        totalPlugins: 0,
        dirtyStates: 0,
        globalStateSize: 0,
        totalHistoryEntries: 0,
        pendingOperations: 0,
        isInitialized: this.isInitialized,
        unifiedManagerAvailable: false,
        statesByPlugin: [],
        error: error.message
      }
    }
  }

  /**
   * Shutdown state manager
   */
  async shutdown() {
    try {
      // Save all dirty states
      const savePromises = []
      for (const [pluginId, pluginState] of this.pluginStates) {
        if (pluginState.isDirty()) {
          savePromises.push(this.savePluginState(pluginId))
        }
      }
      
      await Promise.all(savePromises)
      
      // Save global state
      await this.saveGlobalState()
      
      // Cleanup all plugin states
      const pluginIds = Array.from(this.pluginStates.keys())
      for (const pluginId of pluginIds) {
        await this.cleanupPluginState(pluginId)
      }
      
      this.isInitialized = false
      this.emit('state_manager_shutdown')
      this.removeAllListeners()
      
    } catch (error) {
      this.logger.error('Error during state manager shutdown:', error)
      throw error
    }
  }
}

/**
 * Plugin State - Represents the state for a single plugin (Enhanced with validation)
 */
class PluginState extends EventEmitter {
  constructor(pluginId, manifest, initialState = {}) {
    super()
    
    // Validate inputs
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error(`Invalid plugin ID: ${pluginId}`)
    }
    
    if (!manifest || typeof manifest !== 'object') {
      console.warn(`No manifest provided for plugin ${pluginId}, using default`)
    }
    
    this.pluginId = pluginId
    this.manifest = manifest || { name: pluginId, version: '0.0.0' }
    this.data = new Map()
    this.metadata = {
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null,
      version: 1
    }
    this.isDirtyFlag = false
    this._isValid = true
    
    // Load initial state with error handling
    try {
      this.deserialize(initialState)
    } catch (error) {
      console.error(`Failed to initialize state for plugin ${pluginId}:`, error)
      this._isValid = false
    }
  }

  /**
   * Get state value
   */
  get(key, defaultValue = null) {
    return this.data.get(key) ?? defaultValue
  }

  /**
   * Set state value (with validation)
   */
  set(key, value, options = {}) {
    // Validate inputs
    if (!key || typeof key !== 'string') {
      throw new Error(`Invalid state key: ${key}`)
    }
    
    if (!this._isValid) {
      throw new Error(`Cannot set state on invalid plugin state: ${this.pluginId}`)
    }
    
    try {
      const oldValue = this.data.get(key)
      
      if (oldValue === value) {
        return // No change
      }
      
      this.data.set(key, value)
      this.markDirty()
      
      this.emit('state_changed', {
        key,
        oldValue,
        newValue: value,
        autoSave: options.autoSave !== false,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error(`Failed to set state ${key} for plugin ${this.pluginId}:`, error)
      throw error
    }
  }

  /**
   * Delete state value
   */
  delete(key) {
    if (this.data.delete(key)) {
      this.markDirty()
      this.emit('state_changed', {
        key,
        oldValue: undefined,
        newValue: undefined,
        deleted: true
      })
    }
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.data.has(key)
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.data.keys())
  }

  /**
   * Get all values
   */
  values() {
    return Array.from(this.data.values())
  }

  /**
   * Get all entries
   */
  entries() {
    return Array.from(this.data.entries())
  }

  /**
   * Clear all state
   */
  clear() {
    this.data.clear()
    this.markDirty()
    this.emit('state_changed', { cleared: true })
  }

  /**
   * Update multiple values
   */
  update(updates) {
    const changes = []
    
    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this.data.get(key)
      if (oldValue !== value) {
        this.data.set(key, value)
        changes.push({ key, oldValue, newValue: value })
      }
    }
    
    if (changes.length > 0) {
      this.markDirty()
      this.emit('state_changed', { changes })
    }
  }

  /**
   * Mark state as dirty
   */
  markDirty() {
    this.isDirtyFlag = true
    this.metadata.lastModified = Date.now()
  }

  /**
   * Mark state as saved
   */
  markSaved() {
    this.isDirtyFlag = false
    this.metadata.lastSaved = Date.now()
  }

  /**
   * Check if state is dirty
   */
  isDirty() {
    return this._isValid && this.isDirtyFlag
  }

  /**
   * Get last modified timestamp
   */
  getLastModified() {
    return this.metadata.lastModified
  }

  /**
   * Get state size (with validation)
   */
  getSize() {
    try {
      return this._isValid ? this.data.size : 0
    } catch (error) {
      console.error(`Failed to get size for plugin ${this.pluginId}:`, error)
      return 0
    }
  }

  /**
   * Serialize state to plain object
   */
  serialize() {
    return {
      data: Object.fromEntries(this.data),
      metadata: { ...this.metadata }
    }
  }

  /**
   * Deserialize state from plain object (with validation)
   */
  deserialize(serializedState) {
    try {
      if (!serializedState || typeof serializedState !== 'object') {
        console.warn(`Invalid serialized state for plugin ${this.pluginId}, using defaults`)
        return
      }
      
      if (serializedState.data && typeof serializedState.data === 'object') {
        this.data = new Map(Object.entries(serializedState.data))
      }
      
      if (serializedState.metadata && typeof serializedState.metadata === 'object') {
        this.metadata = { ...this.metadata, ...serializedState.metadata }
      }
      
      this.isDirtyFlag = false
      this._isValid = true
    } catch (error) {
      console.error(`Failed to deserialize state for plugin ${this.pluginId}:`, error)
      this._isValid = false
      throw error
    }
  }

  /**
   * Reset state to default (with validation)
   */
  reset() {
    try {
      this.data.clear()
      this.metadata = {
        createdAt: Date.now(),
        lastModified: Date.now(),
        lastSaved: null,
        version: 1
      }
      this.isDirtyFlag = true
      this._isValid = true
      this.emit('state_changed', { reset: true, timestamp: Date.now() })
    } catch (error) {
      console.error(`Failed to reset state for plugin ${this.pluginId}:`, error)
      this._isValid = false
      throw error
    }
  }

  /**
   * Get state snapshot (with validation)
   */
  getSnapshot() {
    try {
      return {
        pluginId: this.pluginId,
        data: Object.fromEntries(this.data),
        metadata: { ...this.metadata },
        isDirty: this.isDirtyFlag,
        isValid: this._isValid,
        snapshotAt: Date.now()
      }
    } catch (error) {
      console.error(`Failed to get snapshot for plugin ${this.pluginId}:`, error)
      return {
        pluginId: this.pluginId,
        data: {},
        metadata: this.metadata || {},
        isDirty: false,
        isValid: false,
        error: error.message,
        snapshotAt: Date.now()
      }
    }
  }
}

export { PluginState }
export default PluginStateManager