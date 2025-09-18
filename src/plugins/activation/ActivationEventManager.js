/**
 * Plugin Activation Event Manager
 * Handles when and how plugins are activated based on various events and conditions
 */

import { ACTIVATION_EVENTS_V2 } from '../manifest/ManifestV2.js'

/**
 * Activation Event Types
 */
export const ACTIVATION_EVENT_TYPES = {
  IMMEDIATE: 'immediate',
  COMMAND: 'command',
  LANGUAGE: 'language',
  FILE_SYSTEM: 'filesystem',
  WORKSPACE: 'workspace',
  VIEW: 'view',
  DEBUG: 'debug',
  URI: 'uri',
  WEBVIEW: 'webview',
  CUSTOM_EDITOR: 'customEditor',
  AUTHENTICATION: 'authentication',
  TERMINAL: 'terminal',
  SEARCH: 'search'
}

/**
 * Activation Context Information
 */
export class ActivationContext {
  constructor(type, data = {}) {
    this.type = type
    this.data = data
    this.timestamp = Date.now()
    this.requestId = this.generateRequestId()
  }

  generateRequestId() {
    return `${this.type}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`
  }

  getData(key) {
    return this.data[key]
  }

  setData(key, value) {
    this.data[key] = value
  }

  toString() {
    return `ActivationContext(${this.type}, ${JSON.stringify(this.data)})`
  }
}

/**
 * Activation Event Matcher
 * Determines if an activation event pattern matches a given context
 */
export class ActivationEventMatcher {
  constructor() {
    this.matchers = new Map()
    this.setupDefaultMatchers()
  }

  /**
   * Setup default event matchers
   */
  setupDefaultMatchers() {
    // Immediate activation events
    this.matchers.set('*', () => true)
    this.matchers.set('onStartupFinished', (context) => 
      context.type === ACTIVATION_EVENT_TYPES.IMMEDIATE && context.getData('event') === 'startupFinished'
    )

    // Command-based activation
    this.matchers.set('onCommand:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.COMMAND) return false
      const commandPattern = pattern.replace('onCommand:', '')
      const commandId = context.getData('commandId')
      return commandPattern === '*' || commandId === commandPattern
    })

    // Language-based activation
    this.matchers.set('onLanguage:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.LANGUAGE) return false
      const languagePattern = pattern.replace('onLanguage:', '')
      const languageId = context.getData('languageId')
      return languagePattern === '*' || languageId === languagePattern
    })

    // Workspace-based activation
    this.matchers.set('workspaceContains:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.WORKSPACE) return false
      const filePattern = pattern.replace('workspaceContains:', '')
      const files = context.getData('files') || []
      return files.some(file => this.matchesGlob(file, filePattern))
    })

    // File system activation
    this.matchers.set('onFileSystem:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.FILE_SYSTEM) return false
      const schemePattern = pattern.replace('onFileSystem:', '')
      const scheme = context.getData('scheme')
      return scheme === schemePattern
    })

    // Debug activation
    this.matchers.set('onDebug:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.DEBUG) return false
      const debugType = pattern.replace('onDebug:', '')
      const activeDebugType = context.getData('debugType')
      return debugType === '*' || activeDebugType === debugType
    })

    // View activation
    this.matchers.set('onView:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.VIEW) return false
      const viewPattern = pattern.replace('onView:', '')
      const viewId = context.getData('viewId')
      return viewPattern === '*' || viewId === viewPattern
    })

    // URI activation
    this.matchers.set('onUri', (context) => 
      context.type === ACTIVATION_EVENT_TYPES.URI
    )

    // Webview activation
    this.matchers.set('onWebviewPanel:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.WEBVIEW) return false
      const webviewType = pattern.replace('onWebviewPanel:', '')
      const activeWebviewType = context.getData('webviewType')
      return webviewType === '*' || activeWebviewType === webviewType
    })

    // Custom editor activation
    this.matchers.set('onCustomEditor:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.CUSTOM_EDITOR) return false
      const editorType = pattern.replace('onCustomEditor:', '')
      const activeEditorType = context.getData('editorType')
      return editorType === '*' || activeEditorType === editorType
    })

    // Authentication activation
    this.matchers.set('onAuthenticationRequest:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.AUTHENTICATION) return false
      const providerId = pattern.replace('onAuthenticationRequest:', '')
      const requestProviderId = context.getData('providerId')
      return providerId === '*' || requestProviderId === providerId
    })

    // Terminal activation
    this.matchers.set('onTerminalProfile:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.TERMINAL) return false
      const profileId = pattern.replace('onTerminalProfile:', '')
      const activeProfileId = context.getData('profileId')
      return profileId === '*' || activeProfileId === profileId
    })

    // Search activation
    this.matchers.set('onSearch:', (context, pattern) => {
      if (context.type !== ACTIVATION_EVENT_TYPES.SEARCH) return false
      const searchType = pattern.replace('onSearch:', '')
      const activeSearchType = context.getData('searchType')
      return searchType === '*' || activeSearchType === searchType
    })
  }

  /**
   * Check if activation event matches context
   */
  matches(activationEvent, context) {
    // Find matching pattern
    for (const [pattern, matcher] of this.matchers) {
      if (activationEvent === pattern || activationEvent.startsWith(pattern)) {
        try {
          return matcher(context, activationEvent)
        } catch (error) {
          return false
        }
      }
    }

    // No matcher found
    return false
  }

  /**
   * Simple glob matching
   */
  matchesGlob(text, pattern) {
    if (pattern === '*') return true
    if (pattern === text) return true
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(text)
  }

  /**
   * Add custom matcher
   */
  addMatcher(pattern, matcher) {
    this.matchers.set(pattern, matcher)
  }

  /**
   * Remove matcher
   */
  removeMatcher(pattern) {
    this.matchers.delete(pattern)
  }
}

/**
 * Plugin Activation Registry
 * Tracks which plugins should be activated for which events
 */
export class PluginActivationRegistry {
  constructor() {
    this.registrations = new Map() // event -> Set<pluginId>
    this.pluginEvents = new Map()  // pluginId -> Set<event>
    this.activatedPlugins = new Set()
    this.activationHistory = []
    this.matcher = new ActivationEventMatcher()
  }

  /**
   * Register plugin for activation events
   */
  register(pluginId, activationEvents) {
    if (!Array.isArray(activationEvents)) {
      throw new Error('Activation events must be an array')
    }

    // Clear previous registrations for this plugin
    this.unregister(pluginId)

    // Register each activation event
    activationEvents.forEach(event => {
      if (!this.registrations.has(event)) {
        this.registrations.set(event, new Set())
      }
      this.registrations.get(event).add(pluginId)

      if (!this.pluginEvents.has(pluginId)) {
        this.pluginEvents.set(pluginId, new Set())
      }
      this.pluginEvents.get(pluginId).add(event)
    })

  }

  /**
   * Unregister plugin from all activation events
   */
  unregister(pluginId) {
    // Remove from all event registrations
    for (const [event, plugins] of this.registrations) {
      plugins.delete(pluginId)
      if (plugins.size === 0) {
        this.registrations.delete(event)
      }
    }

    // Clear plugin events
    this.pluginEvents.delete(pluginId)
    this.activatedPlugins.delete(pluginId)

  }

  /**
   * Get plugins that should be activated for a given context
   */
  getPluginsToActivate(context) {
    const pluginsToActivate = new Set()

    // Check all registered events against the context
    for (const [event, plugins] of this.registrations) {
      if (this.matcher.matches(event, context)) {
        plugins.forEach(pluginId => {
          if (!this.activatedPlugins.has(pluginId)) {
            pluginsToActivate.add(pluginId)
          }
        })
      }
    }

    return Array.from(pluginsToActivate)
  }

  /**
   * Mark plugin as activated
   */
  markActivated(pluginId, context) {
    this.activatedPlugins.add(pluginId)
    this.activationHistory.push({
      pluginId,
      context: context.toString(),
      timestamp: Date.now(),
      requestId: context.requestId
    })

  }

  /**
   * Mark plugin as deactivated
   */
  markDeactivated(pluginId) {
    this.activatedPlugins.delete(pluginId)
  }

  /**
   * Check if plugin is activated
   */
  isActivated(pluginId) {
    return this.activatedPlugins.has(pluginId)
  }

  /**
   * Get activation events for plugin
   */
  getActivationEvents(pluginId) {
    return Array.from(this.pluginEvents.get(pluginId) || [])
  }

  /**
   * Get all activated plugins
   */
  getActivatedPlugins() {
    return Array.from(this.activatedPlugins)
  }

  /**
   * Get activation history
   */
  getActivationHistory(limit = 100) {
    return this.activationHistory.slice(-limit)
  }

  /**
   * Clear activation history
   */
  clearHistory() {
    this.activationHistory = []
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      totalRegistrations: this.registrations.size,
      totalPlugins: this.pluginEvents.size,
      activatedPlugins: this.activatedPlugins.size,
      activationHistory: this.activationHistory.length,
      eventBreakdown: Array.from(this.registrations.entries()).map(([event, plugins]) => ({
        event,
        pluginCount: plugins.size
      }))
    }
  }
}

/**
 * Main Activation Event Manager
 * Coordinates plugin activation based on events
 */
export class ActivationEventManager {
  constructor(pluginManager) {
    this.pluginManager = pluginManager
    this.registry = new PluginActivationRegistry()
    this.eventQueue = []
    this.processing = false
    this.listeners = new Map()
    this.activationTimeout = 30000 // 30 seconds
  }

  /**
   * Initialize the activation manager
   */
  async initialize() {
    
    // Process any queued events
    await this.processEventQueue()
    
  }

  /**
   * Register plugin for activation
   */
  registerPlugin(pluginManifest) {
    const pluginId = pluginManifest.getId() || pluginManifest.id
    const activationEvents = pluginManifest.getActivationEvents() || pluginManifest.activationEvents || []

    this.registry.register(pluginId, activationEvents)

    // Check for immediate activation events
    const immediateEvents = activationEvents.filter(event => 
      event === '*' || event === 'onStartupFinished'
    )

    if (immediateEvents.length > 0) {
      const context = new ActivationContext(ACTIVATION_EVENT_TYPES.IMMEDIATE, {
        event: 'startupFinished'
      })
      this.queueActivation(context)
    }
  }

  /**
   * Unregister plugin
   */
  unregisterPlugin(pluginId) {
    this.registry.unregister(pluginId)
  }

  /**
   * Fire activation event
   */
  async fireEvent(type, data = {}) {
    const context = new ActivationContext(type, data)
    
    if (this.processing) {
      this.eventQueue.push(context)
      return
    }

    await this.processActivation(context)
  }

  /**
   * Queue activation for later processing
   */
  queueActivation(context) {
    this.eventQueue.push(context)
    if (!this.processing) {
      // Process queue on next tick
      setTimeout(() => this.processEventQueue(), 0)
    }
  }

  /**
   * Process activation event queue
   */
  async processEventQueue() {
    if (this.processing) return
    
    this.processing = true
    try {
      while (this.eventQueue.length > 0) {
        const context = this.eventQueue.shift()
        await this.processActivation(context)
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Process single activation
   */
  async processActivation(context) {
    try {
      const pluginsToActivate = this.registry.getPluginsToActivate(context)
      
      if (pluginsToActivate.length === 0) {
        return
      }


      // Activate plugins in parallel with timeout
      const activationPromises = pluginsToActivate.map(pluginId => 
        this.activatePlugin(pluginId, context)
      )

      await Promise.allSettled(activationPromises)
    } catch (error) {
    }
  }

  /**
   * Activate single plugin
   */
  async activatePlugin(pluginId, context) {
    try {
      
      // Set timeout for activation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Activation timeout')), this.activationTimeout)
      })

      // Activate plugin through plugin manager
      const activationPromise = this.pluginManager.activatePlugin(pluginId, context)
      
      await Promise.race([activationPromise, timeoutPromise])
      
      // Mark as activated
      this.registry.markActivated(pluginId, context)
      
      // Notify listeners
      this.notifyListeners('pluginActivated', { pluginId, context })
      
    } catch (error) {
      this.notifyListeners('pluginActivationFailed', { pluginId, context, error })
    }
  }

  /**
   * Deactivate plugin
   */
  async deactivatePlugin(pluginId) {
    try {
      
      await this.pluginManager.deactivatePlugin(pluginId)
      this.registry.markDeactivated(pluginId)
      
      this.notifyListeners('pluginDeactivated', { pluginId })
      
    } catch (error) {
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(listener)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, listener) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(listener)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(listener => {
        try {
          listener(data)
        } catch (error) {
        }
      })
    }
  }

  /**
   * Event helper methods
   */
  
  /**
   * Fire command activation event
   */
  async onCommand(commandId) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.COMMAND, { commandId })
  }

  /**
   * Fire language activation event
   */
  async onLanguage(languageId) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.LANGUAGE, { languageId })
  }

  /**
   * Fire workspace activation event
   */
  async onWorkspaceContains(files) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.WORKSPACE, { files })
  }

  /**
   * Fire file system activation event
   */
  async onFileSystem(scheme) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.FILE_SYSTEM, { scheme })
  }

  /**
   * Fire view activation event
   */
  async onView(viewId) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.VIEW, { viewId })
  }

  /**
   * Fire debug activation event
   */
  async onDebug(debugType) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.DEBUG, { debugType })
  }

  /**
   * Fire URI activation event
   */
  async onUri(uri) {
    await this.fireEvent(ACTIVATION_EVENT_TYPES.URI, { uri })
  }

  /**
   * Get activation statistics
   */
  getStatistics() {
    return {
      registry: this.registry.getStatistics(),
      eventQueue: this.eventQueue.length,
      processing: this.processing,
      listeners: Array.from(this.listeners.entries()).map(([event, listeners]) => ({
        event,
        listenerCount: listeners.size
      }))
    }
  }

  /**
   * Get activation history
   */
  getActivationHistory(limit) {
    return this.registry.getActivationHistory(limit)
  }

  /**
   * Cleanup
   */
  dispose() {
    this.eventQueue = []
    this.listeners.clear()
    this.processing = false
  }
}

export default ActivationEventManager