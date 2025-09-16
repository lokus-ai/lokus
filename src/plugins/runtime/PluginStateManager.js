/**
 * Plugin State Management System
 * Handles plugin state persistence, configuration management, and data storage
 */

import { invoke } from '@tauri-apps/api/core'
import { EventEmitter } from '../../utils/EventEmitter.js'

export class PluginStateManager extends EventEmitter {
  constructor() {
    super()
    this.pluginStates = new Map() // pluginId -> PluginState
    this.globalState = new Map() // global state shared across plugins
    this.stateHistory = new Map() // pluginId -> state history
    this.pendingOperations = new Map() // pluginId -> pending async operations
    this.isInitialized = false
    this.logger = console // TODO: Replace with proper logger
    
    this.setupAutoSave()
  }

  /**
   * Initialize the state manager
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Load global state
      await this.loadGlobalState()
      
      this.isInitialized = true
      this.emit('state_manager_initialized')
      this.logger.info('Plugin state manager initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize state manager:', error)
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
   * Get plugin state
   */
  getPluginState(pluginId) {
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
   * Export plugin state
   */
  async exportPluginState(pluginId) {
    const pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      throw new Error(`Plugin state not found: ${pluginId}`)
    }
    
    return {
      pluginId,
      manifest: pluginState.manifest,
      state: pluginState.serialize(),
      history: this.getStateHistory(pluginId),
      exportedAt: Date.now()
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
   * Reset plugin state
   */
  async resetPluginState(pluginId) {
    const pluginState = this.pluginStates.get(pluginId)
    if (!pluginState) {
      throw new Error(`Plugin state not found: ${pluginId}`)
    }
    
    pluginState.reset()
    await this.savePluginState(pluginId)
    this.clearStateHistory(pluginId)
    
    this.emit('state_reset', { pluginId })
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
   * Get state manager statistics
   */
  getStats() {
    const states = Array.from(this.pluginStates.values())
    
    return {
      totalPlugins: states.length,
      dirtyStates: states.filter(state => state.isDirty()).length,
      globalStateSize: this.globalState.size,
      totalHistoryEntries: Array.from(this.stateHistory.values())
        .reduce((total, history) => total + history.length, 0),
      pendingOperations: this.pendingOperations.size,
      statesByPlugin: states.map(state => ({
        pluginId: state.pluginId,
        dirty: state.isDirty(),
        size: state.getSize(),
        lastModified: state.getLastModified()
      }))
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
 * Plugin State - Represents the state for a single plugin
 */
class PluginState extends EventEmitter {
  constructor(pluginId, manifest, initialState = {}) {
    super()
    this.pluginId = pluginId
    this.manifest = manifest
    this.data = new Map()
    this.metadata = {
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null,
      version: 1
    }
    this.isDirtyFlag = false
    
    // Load initial state
    this.deserialize(initialState)
  }

  /**
   * Get state value
   */
  get(key, defaultValue = null) {
    return this.data.get(key) ?? defaultValue
  }

  /**
   * Set state value
   */
  set(key, value, options = {}) {
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
      autoSave: options.autoSave
    })
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
    return this.isDirtyFlag
  }

  /**
   * Get last modified timestamp
   */
  getLastModified() {
    return this.metadata.lastModified
  }

  /**
   * Get state size
   */
  getSize() {
    return this.data.size
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
   * Deserialize state from plain object
   */
  deserialize(serializedState) {
    if (serializedState.data) {
      this.data = new Map(Object.entries(serializedState.data))
    }
    
    if (serializedState.metadata) {
      this.metadata = { ...this.metadata, ...serializedState.metadata }
    }
    
    this.isDirtyFlag = false
  }

  /**
   * Reset state to default
   */
  reset() {
    this.data.clear()
    this.metadata = {
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null,
      version: 1
    }
    this.isDirtyFlag = true
    this.emit('state_changed', { reset: true })
  }

  /**
   * Get state snapshot
   */
  getSnapshot() {
    return {
      pluginId: this.pluginId,
      data: Object.fromEntries(this.data),
      metadata: { ...this.metadata },
      isDirty: this.isDirtyFlag
    }
  }
}

export { PluginState }
export default PluginStateManager