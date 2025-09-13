/**
 * Base Plugin Class
 * Provides a foundation for plugin development with common patterns and utilities
 */

export class BasePlugin {
  constructor() {
    this.id = null          // Set by plugin manager
    this.manifest = null    // Set by plugin manager  
    this.api = null         // Set by plugin manager
    this.context = null     // Set by plugin manager
    this.isActive = false
    this.disposables = []   // Track disposable resources
    this.logger = null      // Set during initialization
  }

  /**
   * Initialize the plugin
   * Called after plugin is loaded but before activation
   */
  async initialize(api) {
    this.api = api
    this.logger = {
      info: (...args) => api.log('info', ...args),
      warn: (...args) => api.log('warn', ...args),
      error: (...args) => api.log('error', ...args),
      debug: (...args) => api.log('debug', ...args)
    }
  }

  /**
   * Activate the plugin
   * Override this method to implement plugin activation logic
   */
  async activate() {
    this.isActive = true
    this.logger?.info(`Plugin ${this.id} activated`)
  }

  /**
   * Deactivate the plugin
   * Override this method to implement plugin deactivation logic
   */
  async deactivate() {
    this.isActive = false
    this.logger?.info(`Plugin ${this.id} deactivated`)
  }

  /**
   * Cleanup plugin resources
   * Called when plugin is being unloaded
   */
  async cleanup() {
    // Dispose of all tracked resources
    for (const disposable of this.disposables) {
      try {
        if (typeof disposable === 'function') {
          disposable()
        } else if (disposable && typeof disposable.dispose === 'function') {
          disposable.dispose()
        }
      } catch (error) {
        this.logger?.error('Error disposing resource:', error)
      }
    }
    
    this.disposables = []
    this.isActive = false
    this.logger?.info(`Plugin ${this.id} cleaned up`)
  }

  /**
   * Track a disposable resource
   */
  addDisposable(disposable) {
    this.disposables.push(disposable)
    return disposable
  }

  /**
   * Remove a disposable resource
   */
  removeDisposable(disposable) {
    const index = this.disposables.indexOf(disposable)
    if (index !== -1) {
      this.disposables.splice(index, 1)
    }
  }

  /**
   * Register a command
   */
  registerCommand(command) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    const commandId = this.api.addSlashCommand({
      name: command.name,
      description: command.description || `Command from ${this.id}`,
      icon: command.icon,
      action: command.action,
      shortcut: command.shortcut
    })

    this.addDisposable(() => {
      if (this.api.removeSlashCommand) {
        this.api.removeSlashCommand(commandId)
      }
    })

    return commandId
  }

  /**
   * Register an editor extension
   */
  registerExtension(extension, options = {}) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    const extensionId = this.api.addExtension(extension, options)

    this.addDisposable(() => {
      if (this.api.removeExtension) {
        this.api.removeExtension(extensionId)
      }
    })

    return extensionId
  }

  /**
   * Register a toolbar button
   */
  registerToolbarButton(button) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    const buttonId = this.api.addToolbarButton(button)

    this.addDisposable(() => {
      if (this.api.removeToolbarButton) {
        this.api.removeToolbarButton(buttonId)
      }
    })

    return buttonId
  }

  /**
   * Register a UI panel
   */
  registerPanel(panel) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    const panelId = this.api.registerPanel(panel)

    this.addDisposable(() => {
      if (this.api.unregisterPanel) {
        this.api.unregisterPanel(panelId)
      }
    })

    return panelId
  }

  /**
   * Show a notification
   */
  showNotification(message, type = 'info', duration = 5000) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    this.api.showNotification({
      message,
      type,
      duration,
      source: this.id
    })
  }

  /**
   * Show a dialog
   */
  async showDialog(options) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return await this.api.showDialog({
      ...options,
      source: this.id
    })
  }

  /**
   * Get plugin setting
   */
  async getSetting(key, defaultValue) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return await this.api.getSetting(key, defaultValue)
  }

  /**
   * Set plugin setting
   */
  async setSetting(key, value) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return await this.api.setSetting(key, value)
  }

  /**
   * Listen to events
   */
  addEventListener(event, listener) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    const unsubscribe = this.api.on(event, listener)
    this.addDisposable(unsubscribe)
    return unsubscribe
  }

  /**
   * Emit events
   */
  emitEvent(event, data) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    this.api.emit(event, data)
  }

  /**
   * Read file with plugin permissions
   */
  async readFile(filePath) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return await this.api.readFile(filePath)
  }

  /**
   * Write file with plugin permissions
   */
  async writeFile(filePath, content) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return await this.api.writeFile(filePath, content)
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return await this.api.fileExists(filePath)
  }

  /**
   * Get current editor content
   */
  getEditorContent() {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return this.api.getEditorContent()
  }

  /**
   * Set editor content
   */
  setEditorContent(content) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    this.api.setEditorContent(content)
  }

  /**
   * Insert content at cursor
   */
  insertContent(content) {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    this.api.insertContent(content)
  }

  /**
   * Get current selection
   */
  getSelection() {
    if (!this.api) {
      throw new Error('Plugin API not available')
    }

    return this.api.getSelection()
  }

  /**
   * Schedule a task to run later
   */
  setTimeout(callback, delay) {
    const timeoutId = setTimeout(callback, delay)
    this.addDisposable(() => clearTimeout(timeoutId))
    return timeoutId
  }

  /**
   * Schedule a recurring task
   */
  setInterval(callback, interval) {
    const intervalId = setInterval(callback, interval)
    this.addDisposable(() => clearInterval(intervalId))
    return intervalId
  }

  /**
   * Create a debounced function
   */
  debounce(func, delay) {
    let timeoutId = null
    
    const debouncedFunc = (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => func(...args), delay)
    }

    // Track cleanup
    this.addDisposable(() => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    })

    return debouncedFunc
  }

  /**
   * Create a throttled function
   */
  throttle(func, limit) {
    let inThrottle = false
    
    const throttledFunc = (...args) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }

    return throttledFunc
  }

  /**
   * Get plugin information
   */
  getPluginInfo() {
    return {
      id: this.id,
      name: this.manifest?.name || this.id,
      version: this.manifest?.version || '1.0.0',
      description: this.manifest?.description || '',
      author: this.manifest?.author || 'Unknown',
      isActive: this.isActive,
      permissions: this.manifest?.permissions || [],
      dependencies: this.manifest?.dependencies || {}
    }
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(permission) {
    if (!this.api) {
      return false
    }

    return this.api.hasPermission(permission)
  }

  /**
   * Validate that plugin is ready
   */
  validateReady() {
    if (!this.api) {
      throw new Error('Plugin API not available - ensure plugin is properly initialized')
    }

    if (!this.id) {
      throw new Error('Plugin ID not set - ensure plugin is loaded by plugin manager')
    }

    if (!this.manifest) {
      throw new Error('Plugin manifest not available - ensure plugin has valid plugin.json')
    }
  }

  /**
   * Safe async operation wrapper
   */
  async safeAsync(operation, fallback = null) {
    try {
      return await operation()
    } catch (error) {
      this.logger?.error(`Safe async operation failed:`, error)
      return fallback
    }
  }

  /**
   * Plugin lifecycle status
   */
  getStatus() {
    return {
      initialized: this.api !== null,
      active: this.isActive,
      disposableCount: this.disposables.length
    }
  }
}

/**
 * Plugin development utilities
 */
export class PluginUtils {
  /**
   * Create a simple plugin template
   */
  static createSimplePlugin(options = {}) {
    return class SimplePlugin extends BasePlugin {
      async activate() {
        await super.activate()
        
        if (options.onActivate) {
          await options.onActivate.call(this)
        }
      }

      async deactivate() {
        if (options.onDeactivate) {
          await options.onDeactivate.call(this)
        }
        
        await super.deactivate()
      }
    }
  }

  /**
   * Create a command-only plugin
   */
  static createCommandPlugin(commands = []) {
    return class CommandPlugin extends BasePlugin {
      async activate() {
        await super.activate()
        
        for (const command of commands) {
          this.registerCommand(command)
        }
      }
    }
  }

  /**
   * Create an extension-only plugin
   */
  static createExtensionPlugin(extensions = []) {
    return class ExtensionPlugin extends BasePlugin {
      async activate() {
        await super.activate()
        
        for (const extension of extensions) {
          this.registerExtension(extension.extension, extension.options)
        }
      }
    }
  }
}

export default BasePlugin