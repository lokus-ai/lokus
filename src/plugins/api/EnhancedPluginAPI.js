/**
 * Enhanced Plugin API v2 - Professional plugin development interface
 * 
 * Provides rich, type-safe API for plugin development with:
 * - Comprehensive extension points
 * - Security and permissions
 * - Resource management
 * - Event system
 * - Configuration management
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import ExtensionPoints from './ExtensionPoints.js'

export class EnhancedPluginAPI extends EventEmitter {
  constructor(pluginId, manifest, securityManager, extensionPoints) {
    super()
    
    this.pluginId = pluginId
    this.manifest = manifest
    this.securityManager = securityManager
    this.extensionPoints = extensionPoints
    
    this.disposables = new Set()
    this.isActive = false
    
    // API surfaces
    this.commands = new CommandAPI(this)
    this.ui = new UIAPI(this)
    this.editor = new EditorAPI(this)
    this.workspace = new WorkspaceAPI(this)
    this.storage = new StorageAPI(this)
    this.network = new NetworkAPI(this)
    this.debug = new DebugAPI(this)
    this.tasks = new TaskAPI(this)
    this.languages = new LanguageAPI(this)
    this.themes = new ThemeAPI(this)
    this.fs = new FileSystemAPI(this)
    this.events = new EventAPI(this)
    this.configuration = new ConfigurationAPI(this)
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(permission) {
    const policy = this.securityManager.securityPolicies.get(this.pluginId)
    return policy && policy.permissions.has(permission)
  }

  /**
   * Add disposable for cleanup
   */
  addDisposable(disposable) {
    this.disposables.add(disposable)
    return disposable
  }

  /**
   * Dispose all resources
   */
  dispose() {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === 'function') {
        disposable.dispose()
      }
    }
    this.disposables.clear()
    this.isActive = false
  }

  /**
   * Get plugin manifest
   */
  getManifest() {
    return { ...this.manifest }
  }

  /**
   * Get plugin context information
   */
  getContext() {
    return {
      pluginId: this.pluginId,
      version: this.manifest.version,
      isActive: this.isActive,
      permissions: Array.from(this.securityManager.securityPolicies.get(this.pluginId)?.permissions || [])
    }
  }
}

/**
 * Commands API - Register and execute commands
 */
class CommandAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Register a command
   */
  register(command) {
    if (!this.api.hasPermission('commands:register')) {
      throw new Error('Permission denied: commands:register')
    }

    const commandId = this.api.extensionPoints.registerCommand(this.api.pluginId, command)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.commands.delete(commandId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Execute a command
   */
  async execute(commandId, ...args) {
    if (!this.api.hasPermission('commands:execute')) {
      throw new Error('Permission denied: commands:execute')
    }

    return this.api.extensionPoints.executeCommand(commandId, ...args)
  }

  /**
   * Get all available commands
   */
  getAll() {
    return this.api.extensionPoints.getCommands()
  }
}

/**
 * UI API - User interface extensions
 */
class UIAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info', actions = []) {
    if (!this.api.hasPermission('ui:notifications')) {
      throw new Error('Permission denied: ui:notifications')
    }

    this.api.emit('ui:notification', {
      pluginId: this.api.pluginId,
      message,
      type,
      actions
    })
  }

  /**
   * Show dialog to user
   */
  async showDialog(dialog) {
    if (!this.api.hasPermission('ui:dialogs')) {
      throw new Error('Permission denied: ui:dialogs')
    }

    return new Promise((resolve) => {
      this.api.emit('ui:dialog', {
        pluginId: this.api.pluginId,
        ...dialog,
        resolve
      })
    })
  }

  /**
   * Register a custom panel
   */
  registerPanel(panel) {
    if (!this.api.hasPermission('ui:panels')) {
      throw new Error('Permission denied: ui:panels')
    }

    const panelId = this.api.extensionPoints.registerPanel(this.api.pluginId, panel)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.panels.delete(panelId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Register menu item
   */
  registerMenu(menu) {
    if (!this.api.hasPermission('ui:menus')) {
      throw new Error('Permission denied: ui:menus')
    }

    const menuId = this.api.extensionPoints.registerMenu(this.api.pluginId, menu)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.menus.delete(menuId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Register toolbar
   */
  registerToolbar(toolbar) {
    if (!this.api.hasPermission('ui:toolbars')) {
      throw new Error('Permission denied: ui:toolbars')
    }

    const toolbarId = this.api.extensionPoints.registerToolbar(this.api.pluginId, toolbar)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.toolbars.delete(toolbarId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Register status bar item
   */
  registerStatusBarItem(statusItem) {
    if (!this.api.hasPermission('ui:statusbar')) {
      throw new Error('Permission denied: ui:statusbar')
    }

    const itemId = this.api.extensionPoints.registerStatusBarItem(this.api.pluginId, statusItem)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.statusBarItems.delete(itemId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }
}

/**
 * Editor API - Text editor operations
 */
class EditorAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get current editor content
   */
  async getContent() {
    if (!this.api.hasPermission('editor:read')) {
      throw new Error('Permission denied: editor:read')
    }

    return this.api.emit('editor:getContent')
  }

  /**
   * Set editor content
   */
  async setContent(content) {
    if (!this.api.hasPermission('editor:write')) {
      throw new Error('Permission denied: editor:write')
    }

    return this.api.emit('editor:setContent', { content })
  }

  /**
   * Insert content at cursor
   */
  async insertContent(content) {
    if (!this.api.hasPermission('editor:write')) {
      throw new Error('Permission denied: editor:write')
    }

    return this.api.emit('editor:insertContent', { content })
  }

  /**
   * Get current selection
   */
  async getSelection() {
    if (!this.api.hasPermission('editor:read')) {
      throw new Error('Permission denied: editor:read')
    }

    return this.api.emit('editor:getSelection')
  }

  /**
   * Set selection
   */
  async setSelection(selection) {
    if (!this.api.hasPermission('editor:write')) {
      throw new Error('Permission denied: editor:write')
    }

    return this.api.emit('editor:setSelection', { selection })
  }

  /**
   * Register formatter
   */
  registerFormatter(formatter) {
    if (!this.api.hasPermission('editor:formatters')) {
      throw new Error('Permission denied: editor:formatters')
    }

    const formatterId = this.api.extensionPoints.registerFormatter(this.api.pluginId, formatter)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.formatters.delete(formatterId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }
}

/**
 * Workspace API - Workspace and project operations
 */
class WorkspaceAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get workspace folders
   */
  async getFolders() {
    if (!this.api.hasPermission('workspace:read')) {
      throw new Error('Permission denied: workspace:read')
    }

    return this.api.emit('workspace:getFolders')
  }

  /**
   * Get workspace configuration
   */
  async getConfiguration(section) {
    if (!this.api.hasPermission('workspace:config')) {
      throw new Error('Permission denied: workspace:config')
    }

    return this.api.emit('workspace:getConfiguration', { section })
  }

  /**
   * Update workspace configuration
   */
  async updateConfiguration(section, value) {
    if (!this.api.hasPermission('workspace:config')) {
      throw new Error('Permission denied: workspace:config')
    }

    return this.api.emit('workspace:updateConfiguration', { section, value })
  }

  /**
   * Find files in workspace
   */
  async findFiles(include, exclude, maxResults) {
    if (!this.api.hasPermission('workspace:search')) {
      throw new Error('Permission denied: workspace:search')
    }

    return this.api.emit('workspace:findFiles', { include, exclude, maxResults })
  }
}

/**
 * Storage API - Plugin-scoped storage
 */
class StorageAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get stored value
   */
  async get(key, defaultValue = null) {
    if (!this.api.hasPermission('storage:read')) {
      throw new Error('Permission denied: storage:read')
    }

    return this.api.emit('storage:get', { 
      pluginId: this.api.pluginId, 
      key, 
      defaultValue 
    })
  }

  /**
   * Set stored value
   */
  async set(key, value) {
    if (!this.api.hasPermission('storage:write')) {
      throw new Error('Permission denied: storage:write')
    }

    return this.api.emit('storage:set', { 
      pluginId: this.api.pluginId, 
      key, 
      value 
    })
  }

  /**
   * Remove stored value
   */
  async remove(key) {
    if (!this.api.hasPermission('storage:write')) {
      throw new Error('Permission denied: storage:write')
    }

    return this.api.emit('storage:remove', { 
      pluginId: this.api.pluginId, 
      key 
    })
  }

  /**
   * Get all stored keys
   */
  async keys() {
    if (!this.api.hasPermission('storage:read')) {
      throw new Error('Permission denied: storage:read')
    }

    return this.api.emit('storage:keys', { 
      pluginId: this.api.pluginId 
    })
  }

  /**
   * Clear all stored data
   */
  async clear() {
    if (!this.api.hasPermission('storage:write')) {
      throw new Error('Permission denied: storage:write')
    }

    return this.api.emit('storage:clear', { 
      pluginId: this.api.pluginId 
    })
  }
}

/**
 * Network API - HTTP requests
 */
class NetworkAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Make HTTP request
   */
  async fetch(url, options = {}) {
    if (!this.api.hasPermission('network:http')) {
      throw new Error('Permission denied: network:http')
    }

    // URL validation
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed')
      }
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`)
    }

    return this.api.emit('network:fetch', { 
      pluginId: this.api.pluginId,
      url, 
      options 
    })
  }
}

/**
 * File System API - File operations
 */
class FileSystemAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Read file
   */
  async readFile(path) {
    if (!this.api.hasPermission('fs:read')) {
      throw new Error('Permission denied: fs:read')
    }

    return this.api.emit('fs:readFile', { path })
  }

  /**
   * Write file
   */
  async writeFile(path, content) {
    if (!this.api.hasPermission('fs:write')) {
      throw new Error('Permission denied: fs:write')
    }

    return this.api.emit('fs:writeFile', { path, content })
  }

  /**
   * Check if file exists
   */
  async exists(path) {
    if (!this.api.hasPermission('fs:read')) {
      throw new Error('Permission denied: fs:read')
    }

    return this.api.emit('fs:exists', { path })
  }

  /**
   * Register file system provider
   */
  registerProvider(provider) {
    if (!this.api.hasPermission('fs:providers')) {
      throw new Error('Permission denied: fs:providers')
    }

    const scheme = this.api.extensionPoints.registerFileSystemProvider(this.api.pluginId, provider)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.fileSystemProviders.delete(scheme)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }
}

/**
 * Task API - Task and build systems
 */
class TaskAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Register task provider
   */
  registerProvider(taskProvider) {
    if (!this.api.hasPermission('tasks:providers')) {
      throw new Error('Permission denied: tasks:providers')
    }

    const providerId = this.api.extensionPoints.registerTaskProvider(this.api.pluginId, taskProvider)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.taskProviders.delete(providerId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Execute task
   */
  async execute(task) {
    if (!this.api.hasPermission('tasks:execute')) {
      throw new Error('Permission denied: tasks:execute')
    }

    return this.api.emit('tasks:execute', { task })
  }
}

/**
 * Debug API - Debugging support
 */
class DebugAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Register debug adapter
   */
  registerAdapter(debugAdapter) {
    if (!this.api.hasPermission('debug:adapters')) {
      throw new Error('Permission denied: debug:adapters')
    }

    const adapterId = this.api.extensionPoints.registerDebugAdapter(this.api.pluginId, debugAdapter)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.debugAdapters.delete(adapterId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }
}

/**
 * Language API - Language support
 */
class LanguageAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Register language
   */
  register(language) {
    if (!this.api.hasPermission('languages:register')) {
      throw new Error('Permission denied: languages:register')
    }

    const languageId = this.api.extensionPoints.registerLanguage(this.api.pluginId, language)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.languages.delete(languageId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Get language by ID
   */
  get(languageId) {
    return this.api.extensionPoints.getLanguage(languageId)
  }

  /**
   * Get language by file extension
   */
  getByExtension(extension) {
    return this.api.extensionPoints.getLanguageByExtension(extension)
  }
}

/**
 * Theme API - Theme registration
 */
class ThemeAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Register theme
   */
  register(theme) {
    if (!this.api.hasPermission('themes:register')) {
      throw new Error('Permission denied: themes:register')
    }

    const themeId = this.api.extensionPoints.registerTheme(this.api.pluginId, theme)
    
    const disposable = {
      dispose: () => {
        this.api.extensionPoints.themes.delete(themeId)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Get all themes
   */
  getAll() {
    return this.api.extensionPoints.getThemes()
  }
}

/**
 * Event API - Plugin event system
 */
class EventAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Listen to events
   */
  on(event, handler) {
    if (!this.api.hasPermission('events:listen')) {
      throw new Error('Permission denied: events:listen')
    }

    this.api.on(event, handler)
    
    const disposable = {
      dispose: () => {
        this.api.off(event, handler)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (!this.api.hasPermission('events:emit')) {
      throw new Error('Permission denied: events:emit')
    }

    return this.api.emit(event, {
      ...data,
      pluginId: this.api.pluginId
    })
  }
}

/**
 * Configuration API - Plugin configuration
 */
class ConfigurationAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get configuration value
   */
  async get(key, defaultValue = null) {
    return this.api.emit('config:get', {
      pluginId: this.api.pluginId,
      key,
      defaultValue
    })
  }

  /**
   * Set configuration value
   */
  async set(key, value) {
    return this.api.emit('config:set', {
      pluginId: this.api.pluginId,
      key,
      value
    })
  }

  /**
   * Get all configuration
   */
  async getAll() {
    return this.api.emit('config:getAll', {
      pluginId: this.api.pluginId
    })
  }

  /**
   * Watch for configuration changes
   */
  onDidChange(callback) {
    const handler = (event) => {
      if (event.pluginId === this.api.pluginId) {
        callback(event)
      }
    }

    this.api.on('config:changed', handler)
    
    const disposable = {
      dispose: () => {
        this.api.off('config:changed', handler)
      }
    }
    
    this.api.addDisposable(disposable)
    return disposable
  }
}

export default EnhancedPluginAPI