import { invoke } from '@tauri-apps/api/core'
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs'
import { EventEmitter } from '../utils/EventEmitter.js'
import { logger } from '../utils/logger.js'

/**
 * Plugin API - Provides standardized interface for plugins to interact with Lokus
 * This class exposes safe, controlled access to editor, UI, filesystem, and other core features
 */
export class PluginAPI extends EventEmitter {
  constructor(pluginId, editorAPI) {
    super()
    this.pluginId = pluginId
    this.editorAPI = editorAPI
    this.registrations = new Map() // Track what the plugin has registered
    this.permissions = new Set() // Plugin permissions
    // COMPLETED TODO: Replaced console with proper plugin-scoped logger
    this.logger = logger.createScoped(`Plugin:${pluginId}`)
  }

  /**
   * EDITOR API
   * Methods for interacting with the editor
   */

  /**
   * Add a custom extension to the editor
   */
  addExtension(extension, options = {}) {
    try {
      if (!this.editorAPI || !this.editorAPI.addExtension) {
        throw new Error('Editor API not available')
      }

      const extensionId = `${this.pluginId}_${extension.name || Date.now()}`
      this.editorAPI.addExtension(extension, { ...options, pluginId: this.pluginId })

      // Track registration for cleanup
      if (!this.registrations.has('extensions')) {
        this.registrations.set('extensions', new Set())
      }
      this.registrations.get('extensions').add(extensionId)

      return extensionId
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to add extension:`, error)
      throw error
    }
  }

  /**
   * Add a slash command to the editor
   */
  addSlashCommand(command) {
    try {
      if (!this.editorAPI || !this.editorAPI.addSlashCommand) {
        throw new Error('Editor API not available')
      }

      const commandId = `${this.pluginId}_${command.name}`
      this.editorAPI.addSlashCommand({
        ...command,
        id: commandId,
        pluginId: this.pluginId
      })

      // Track registration
      if (!this.registrations.has('slashCommands')) {
        this.registrations.set('slashCommands', new Set())
      }
      this.registrations.get('slashCommands').add(commandId)

      return commandId
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to add slash command:`, error)
      throw error
    }
  }

  /**
   * Add a toolbar button to the editor
   */
  addToolbarButton(button) {
    try {
      if (!this.editorAPI || !this.editorAPI.addToolbarButton) {
        throw new Error('Editor API not available')
      }

      const buttonId = `${this.pluginId}_${button.name}`
      this.editorAPI.addToolbarButton({
        ...button,
        id: buttonId,
        pluginId: this.pluginId
      })

      // Track registration
      if (!this.registrations.has('toolbarButtons')) {
        this.registrations.set('toolbarButtons', new Set())
      }
      this.registrations.get('toolbarButtons').add(buttonId)

      return buttonId
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to add toolbar button:`, error)
      throw error
    }
  }

  /**
   * Get current editor content
   */
  getEditorContent() {
    try {
      if (!this.editorAPI || !this.editorAPI.getContent) {
        throw new Error('Editor API not available')
      }
      return this.editorAPI.getContent()
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to get editor content:`, error)
      throw error
    }
  }

  /**
   * Set editor content
   */
  setEditorContent(content) {
    try {
      if (!this.editorAPI || !this.editorAPI.setContent) {
        throw new Error('Editor API not available')
      }
      this.editorAPI.setContent(content)
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to set editor content:`, error)
      throw error
    }
  }

  /**
   * Insert content at current cursor position
   */
  insertContent(content) {
    try {
      if (!this.editorAPI || !this.editorAPI.insertContent) {
        throw new Error('Editor API not available')
      }
      this.editorAPI.insertContent(content)
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to insert content:`, error)
      throw error
    }
  }

  /**
   * Get current editor selection
   */
  getSelection() {
    try {
      if (!this.editorAPI || !this.editorAPI.getSelection) {
        throw new Error('Editor API not available')
      }
      return this.editorAPI.getSelection()
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to get selection:`, error)
      throw error
    }
  }

  /**
   * UI API
   * Methods for interacting with the user interface
   */

  /**
   * Register a custom panel in the UI
   */
  registerPanel(panel) {
    try {
      const panelId = `${this.pluginId}_${panel.name}`

      this.emit('panel_registered', {
        id: panelId,
        pluginId: this.pluginId,
        ...panel
      })

      // Track registration
      if (!this.registrations.has('panels')) {
        this.registrations.set('panels', new Set())
      }
      this.registrations.get('panels').add(panelId)

      return panelId
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to register panel:`, error)
      throw error
    }
  }

  /**
   * Add a menu item to the application menu
   */
  addMenuItem(menuItem) {
    try {
      const menuId = `${this.pluginId}_${menuItem.name}`

      this.emit('menu_item_added', {
        id: menuId,
        pluginId: this.pluginId,
        ...menuItem
      })

      // Track registration
      if (!this.registrations.has('menuItems')) {
        this.registrations.set('menuItems', new Set())
      }
      this.registrations.get('menuItems').add(menuId)

      return menuId
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to add menu item:`, error)
      throw error
    }
  }

  /**
   * Show a notification to the user
   */
  showNotification(notification) {
    try {
      const notificationData = {
        ...notification,
        pluginId: this.pluginId,
        timestamp: Date.now()
      }

      this.emit('notification', notificationData)
      this.logger.info(`Notification from ${this.pluginId}:`, notification.message)
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to show notification:`, error)
      throw error
    }
  }

  /**
   * Show a dialog to the user
   */
  async showDialog(dialog) {
    try {
      return new Promise((resolve) => {
        this.emit('dialog', {
          ...dialog,
          pluginId: this.pluginId,
          onClose: resolve
        })
      })
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to show dialog:`, error)
      throw error
    }
  }

  /**
   * FILESYSTEM API
   * Safe filesystem operations with permission checking
   */

  /**
   * Read a file (with permission check)
   */
  async readFile(filePath) {
    try {
      // Check permissions
      if (!this.hasPermission('read_files')) {
        throw new Error('Plugin does not have file read permission')
      }

      // Validate path (prevent directory traversal)
      if (!this.isValidPath(filePath)) {
        throw new Error('Invalid file path: Access denied')
      }

      const content = await readTextFile(filePath)
      return content
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to read file:`, error)
      throw error
    }
  }

  /**
   * Write a file (with permission check)
   */
  async writeFile(filePath, content) {
    try {
      // Check permissions
      if (!this.hasPermission('write_files')) {
        throw new Error('Plugin does not have file write permission')
      }

      // Validate path
      if (!this.isValidPath(filePath)) {
        throw new Error('Invalid file path: Access denied')
      }

      await writeTextFile(filePath, content)
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to write file:`, error)
      throw error
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath) {
    try {
      if (!this.hasPermission('read_files')) {
        throw new Error('Plugin does not have file read permission')
      }

      if (!this.isValidPath(filePath)) {
        throw new Error('Invalid file path: Access denied')
      }

      return await exists(filePath)
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to check file existence:`, error)
      throw error
    }
  }

  /**
   * SETTINGS API
   * Plugin-specific settings management
   */

  /**
   * Get a plugin setting
   */
  async getSetting(key, defaultValue = null) {
    try {
      const settings = await this.getAllSettings()
      return settings[key] !== undefined ? settings[key] : defaultValue
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to get setting:`, error)
      return defaultValue
    }
  }

  /**
   * Set a plugin setting
   */
  async setSetting(key, value) {
    try {
      const settings = await this.getAllSettings()
      settings[key] = value
      await this.saveAllSettings(settings)

      this.emit('setting_changed', { key, value, pluginId: this.pluginId })
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to set setting:`, error)
      throw error
    }
  }

  /**
   * Get all plugin settings
   */
  async getAllSettings() {
    try {
      const settings = await invoke('get_plugin_settings', { pluginId: this.pluginId })
      return settings || {}
    } catch (error) {
      // Settings don't exist yet
      return {}
    }
  }

  /**
   * Save all plugin settings
   */
  async saveAllSettings(settings) {
    try {
      await invoke('save_plugin_settings', {
        pluginId: this.pluginId,
        settings
      })
    } catch (error) {
      this.logger.error(`Plugin ${this.pluginId} failed to save settings:`, error)
      throw error
    }
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Check if plugin has a specific permission
   */
  hasPermission(permission) {
    return this.permissions.has(permission) || this.permissions.has('all')
  }

  /**
   * Grant a permission to the plugin
   */
  grantPermission(permission) {
    this.permissions.add(permission)
  }

  /**
   * Revoke a permission from the plugin
   */
  revokePermission(permission) {
    this.permissions.delete(permission)
  }

  /**
   * Validate file path for security
   */
  isValidPath(filePath) {
    // Prevent directory traversal
    if (filePath.includes('..')) {
      return false
    }

    // In a real implementation, we would check against allowed roots
    // For now, we just ensure it's not trying to go up the tree
    // and ideally it should be within the workspace or plugin dir

    // TODO: Get actual allowed roots from configuration
    return true
  }

  /**
   * Get plugin registration information
   */
  getRegistrations() {
    const registrations = {}
    for (const [type, ids] of this.registrations) {
      registrations[type] = Array.from(ids)
    }
    return registrations
  }

  /**
   * Cleanup all plugin registrations
   */
  async cleanup() {
    try {
      // Remove extensions
      if (this.registrations.has('extensions')) {
        for (const extensionId of this.registrations.get('extensions')) {
          if (this.editorAPI && this.editorAPI.removeExtension) {
            this.editorAPI.removeExtension(extensionId)
          }
        }
      }

      // Remove slash commands
      if (this.registrations.has('slashCommands')) {
        for (const commandId of this.registrations.get('slashCommands')) {
          if (this.editorAPI && this.editorAPI.removeSlashCommand) {
            this.editorAPI.removeSlashCommand(commandId)
          }
        }
      }

      // Remove toolbar buttons
      if (this.registrations.has('toolbarButtons')) {
        for (const buttonId of this.registrations.get('toolbarButtons')) {
          if (this.editorAPI && this.editorAPI.removeToolbarButton) {
            this.editorAPI.removeToolbarButton(buttonId)
          }
        }
      }

      // TODO: Cleanup panels, menu items, etc.

      // Clear registrations
      this.registrations.clear()

      // Remove all listeners
      this.removeAllListeners()

      this.logger.info(`Cleaned up plugin API for ${this.pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to cleanup plugin API for ${this.pluginId}:`, error)
      throw error
    }
  }

  /**
   * Log a message with plugin context
   */
  log(level, ...args) {
    this.logger[level](`[${this.pluginId}]`, ...args)
  }
}

/**
 * Plugin API Factory
 * Creates plugin API instances with appropriate permissions and context
 */
export class PluginAPIFactory {
  constructor(editorAPI) {
    this.editorAPI = editorAPI
    this.apis = new Map()
  }

  /**
   * Create a plugin API instance
   */
  createAPI(pluginId, manifest = {}) {
    if (this.apis.has(pluginId)) {
      return this.apis.get(pluginId)
    }

    const api = new PluginAPI(pluginId, this.editorAPI)

    // Grant permissions based on manifest
    const permissions = manifest.permissions || []
    for (const permission of permissions) {
      api.grantPermission(permission)
    }

    this.apis.set(pluginId, api)
    return api
  }

  /**
   * Get existing API instance
   */
  getAPI(pluginId) {
    return this.apis.get(pluginId)
  }

  /**
   * Cleanup API instance
   */
  async cleanupAPI(pluginId) {
    const api = this.apis.get(pluginId)
    if (api) {
      await api.cleanup()
      this.apis.delete(pluginId)
    }
  }

  /**
   * Cleanup all API instances
   */
  async cleanupAll() {
    for (const [pluginId, api] of this.apis) {
      try {
        await api.cleanup()
      } catch { }
    }
    this.apis.clear()
  }
}

export default PluginAPI