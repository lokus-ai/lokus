/**
 * Extended Plugin API - Comprehensive VS Code-like API for plugins
 * Provides extensive functionality for commands, UI, workspace, window management, and more
 */

import { invoke } from '@tauri-apps/api/core'
import { readTextFile, writeTextFile, exists, readDir } from '@tauri-apps/api/fs'
import { EventEmitter } from '../utils/EventEmitter.js'

export class ExtendedPluginAPI extends EventEmitter {
  constructor(pluginId, editorAPI, securityManager) {
    super()
    this.pluginId = pluginId
    this.editorAPI = editorAPI
    this.securityManager = securityManager
    this.registrations = new Map()
    this.disposables = []
    this.logger = console // TODO: Replace with proper plugin-scoped logger
    
    // Initialize API namespaces
    this.commands = new CommandsAPI(this)
    this.ui = new UIAPI(this)
    this.workspace = new WorkspaceAPI(this)
    this.window = new WindowAPI(this)
    this.files = new FilesAPI(this)
    this.settings = new SettingsAPI(this)
    this.editor = new EditorAPI(this)
    this.env = new EnvironmentAPI(this)
    this.debug = new DebugAPI(this)
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(permission) {
    return this.securityManager?.hasPermission(this.pluginId, permission) || false
  }

  /**
   * Enforce permission check
   */
  enforcePermission(permission, ...args) {
    if (this.securityManager) {
      return this.securityManager.enforcePermission(this.pluginId, permission, ...args)
    }
    return true
  }

  /**
   * Add disposable resource for cleanup
   */
  addDisposable(disposable) {
    this.disposables.push(disposable)
    return disposable
  }

  /**
   * Track registration for cleanup
   */
  trackRegistration(type, id) {
    if (!this.registrations.has(type)) {
      this.registrations.set(type, new Set())
    }
    this.registrations.get(type).add(id)
  }

  /**
   * Cleanup all registrations and disposables
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
        this.logger.error('Error disposing resource:', error)
      }
    }
    
    this.disposables = []
    this.registrations.clear()
    this.removeAllListeners()
  }

  /**
   * Create a disposable that calls a function when disposed
   */
  createDisposable(disposeFunction) {
    return {
      dispose: disposeFunction
    }
  }
}

/**
 * Commands API - Register and execute commands
 */
class CommandsAPI {
  constructor(api) {
    this.api = api
    this.commands = new Map()
  }

  /**
   * Register a command
   */
  registerCommand(commandId, handler) {
    this.api.enforcePermission('execute:commands')
    
    const fullCommandId = `${this.api.pluginId}.${commandId}`
    
    if (this.commands.has(fullCommandId)) {
      throw new Error(`Command ${fullCommandId} is already registered`)
    }
    
    this.commands.set(fullCommandId, handler)
    this.api.trackRegistration('commands', fullCommandId)
    
    // Register with global command registry
    this.api.emit('command_registered', { commandId: fullCommandId, handler })
    
    return this.api.createDisposable(() => {
      this.commands.delete(fullCommandId)
      this.api.emit('command_unregistered', { commandId: fullCommandId })
    })
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId, ...args) {
    this.api.enforcePermission('execute:commands')
    
    const handler = this.commands.get(commandId)
    if (!handler) {
      // Try global command registry
      this.api.emit('command_execute', { commandId, args })
      return
    }
    
    try {
      return await handler(...args)
    } catch (error) {
      this.api.logger.error(`Error executing command ${commandId}:`, error)
      throw error
    }
  }

  /**
   * Get all commands registered by this plugin
   */
  getCommands() {
    return Array.from(this.commands.keys())
  }
}

/**
 * UI API - Create status bar items, panels, and notifications
 */
class UIAPI {
  constructor(api) {
    this.api = api
    this.statusBarItems = new Map()
    this.panels = new Map()
  }

  /**
   * Create a status bar item
   */
  createStatusBarItem(alignment = 'left', priority = 0) {
    this.api.enforcePermission('ui:statusbar')
    
    const id = `${this.api.pluginId}_statusbar_${Date.now()}`
    
    const statusBarItem = {
      id,
      alignment,
      priority,
      text: '',
      tooltip: '',
      command: null,
      show() {
        this.api.emit('statusbar_show', { id, item: this })
      },
      hide() {
        this.api.emit('statusbar_hide', { id })
      },
      dispose() {
        this.api.emit('statusbar_dispose', { id })
        statusBarItems.delete(id)
      }
    }
    
    this.statusBarItems.set(id, statusBarItem)
    this.api.trackRegistration('statusBarItems', id)
    
    return statusBarItem
  }

  /**
   * Show information message
   */
  async showInformationMessage(message, ...items) {
    this.api.enforcePermission('ui:notifications')
    
    return new Promise((resolve) => {
      this.api.emit('show_message', {
        type: 'information',
        message,
        items,
        resolve
      })
    })
  }

  /**
   * Show warning message
   */
  async showWarningMessage(message, ...items) {
    this.api.enforcePermission('ui:notifications')
    
    return new Promise((resolve) => {
      this.api.emit('show_message', {
        type: 'warning',
        message,
        items,
        resolve
      })
    })
  }

  /**
   * Show error message
   */
  async showErrorMessage(message, ...items) {
    this.api.enforcePermission('ui:notifications')
    
    return new Promise((resolve) => {
      this.api.emit('show_message', {
        type: 'error',
        message,
        items,
        resolve
      })
    })
  }

  /**
   * Show input box
   */
  async showInputBox(options = {}) {
    this.api.enforcePermission('ui:input')
    
    return new Promise((resolve) => {
      this.api.emit('show_input_box', {
        options,
        resolve
      })
    })
  }

  /**
   * Show quick pick
   */
  async showQuickPick(items, options = {}) {
    this.api.enforcePermission('ui:input')
    
    return new Promise((resolve) => {
      this.api.emit('show_quick_pick', {
        items,
        options,
        resolve
      })
    })
  }

  /**
   * Create a webview panel
   */
  createWebviewPanel(viewType, title, showOptions, options = {}) {
    this.api.enforcePermission('ui:webview')
    
    const id = `${this.api.pluginId}_webview_${Date.now()}`
    
    const panel = {
      id,
      viewType,
      title,
      webview: {
        html: '',
        options: options.webviewOptions || {},
        postMessage: (message) => {
          this.api.emit('webview_post_message', { id, message })
        },
        onDidReceiveMessage: (handler) => {
          this.api.on(`webview_message_${id}`, handler)
          return this.api.createDisposable(() => {
            this.api.off(`webview_message_${id}`, handler)
          })
        }
      },
      reveal: (column) => {
        this.api.emit('webview_reveal', { id, column })
      },
      dispose: () => {
        this.api.emit('webview_dispose', { id })
        this.panels.delete(id)
      }
    }
    
    this.panels.set(id, panel)
    this.api.trackRegistration('webviewPanels', id)
    
    this.api.emit('webview_create', { id, panel })
    
    return panel
  }
}

/**
 * Workspace API - Access workspace files and configuration
 */
class WorkspaceAPI {
  constructor(api) {
    this.api = api
    this.workspaceFolders = []
    this.onDidChangeWorkspaceFoldersCallbacks = new Set()
    this.onDidOpenTextDocumentCallbacks = new Set()
    this.onDidCloseTextDocumentCallbacks = new Set()
    this.onDidChangeTextDocumentCallbacks = new Set()
  }

  /**
   * Get workspace folders
   */
  get workspaceFolders() {
    this.api.enforcePermission('read:workspace')
    return this._workspaceFolders
  }

  /**
   * Register callback for workspace folder changes
   */
  onDidChangeWorkspaceFolders(callback) {
    this.api.enforcePermission('read:workspace')
    
    this.onDidChangeWorkspaceFoldersCallbacks.add(callback)
    
    return this.api.createDisposable(() => {
      this.onDidChangeWorkspaceFoldersCallbacks.delete(callback)
    })
  }

  /**
   * Register callback for when text document is opened
   */
  onDidOpenTextDocument(callback) {
    this.api.enforcePermission('read:workspace')
    
    this.onDidOpenTextDocumentCallbacks.add(callback)
    
    return this.api.createDisposable(() => {
      this.onDidOpenTextDocumentCallbacks.delete(callback)
    })
  }

  /**
   * Register callback for when text document is closed
   */
  onDidCloseTextDocument(callback) {
    this.api.enforcePermission('read:workspace')
    
    this.onDidCloseTextDocumentCallbacks.add(callback)
    
    return this.api.createDisposable(() => {
      this.onDidCloseTextDocumentCallbacks.delete(callback)
    })
  }

  /**
   * Register callback for when text document is changed
   */
  onDidChangeTextDocument(callback) {
    this.api.enforcePermission('read:workspace')
    
    this.onDidChangeTextDocumentCallbacks.add(callback)
    
    return this.api.createDisposable(() => {
      this.onDidChangeTextDocumentCallbacks.delete(callback)
    })
  }

  /**
   * Find files in workspace
   */
  async findFiles(include, exclude, maxResults) {
    this.api.enforcePermission('read:workspace')
    
    // Use Tauri to find files
    try {
      const result = await invoke('find_workspace_files', {
        include: include || '**/*',
        exclude: exclude || '',
        maxResults: maxResults || 1000
      })
      return result
    } catch (error) {
      throw new Error(`Failed to find files: ${error.message}`)
    }
  }

  /**
   * Open text document
   */
  async openTextDocument(uri) {
    this.api.enforcePermission('read:workspace')
    
    try {
      const content = await readTextFile(uri)
      
      const document = {
        uri,
        fileName: uri,
        languageId: this.getLanguageId(uri),
        getText: () => content,
        lineCount: content.split('\n').length,
        save: async () => {
          this.api.enforcePermission('write:workspace')
          await writeTextFile(uri, content)
        }
      }
      
      // Notify callbacks
      for (const callback of this.onDidOpenTextDocumentCallbacks) {
        try {
          callback(document)
        } catch (error) {
          this.api.logger.error('Error in onDidOpenTextDocument callback:', error)
        }
      }
      
      return document
    } catch (error) {
      throw new Error(`Failed to open document: ${error.message}`)
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(section) {
    this.api.enforcePermission('read:workspace')
    
    // Return configuration proxy
    return {
      get: (key, defaultValue) => {
        return this.api.settings.getSetting(`${section}.${key}`, defaultValue)
      },
      update: (key, value, configurationTarget) => {
        this.api.enforcePermission('write:workspace')
        return this.api.settings.setSetting(`${section}.${key}`, value)
      },
      has: (key) => {
        return this.api.settings.getSetting(`${section}.${key}`) !== undefined
      }
    }
  }

  /**
   * Get language ID from file path
   */
  getLanguageId(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase()
    
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'md': 'markdown',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp'
    }
    
    return languageMap[extension] || 'plaintext'
  }
}

/**
 * Window API - Manage editor windows and panels
 */
class WindowAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Show information message
   */
  async showInformationMessage(message, ...items) {
    return this.api.ui.showInformationMessage(message, ...items)
  }

  /**
   * Show warning message
   */
  async showWarningMessage(message, ...items) {
    return this.api.ui.showWarningMessage(message, ...items)
  }

  /**
   * Show error message
   */
  async showErrorMessage(message, ...items) {
    return this.api.ui.showErrorMessage(message, ...items)
  }

  /**
   * Show input box
   */
  async showInputBox(options) {
    return this.api.ui.showInputBox(options)
  }

  /**
   * Show quick pick
   */
  async showQuickPick(items, options) {
    return this.api.ui.showQuickPick(items, options)
  }

  /**
   * Create output channel
   */
  createOutputChannel(name) {
    this.api.enforcePermission('ui:output')
    
    const id = `${this.api.pluginId}_output_${Date.now()}`
    
    const channel = {
      id,
      name,
      append: (value) => {
        this.api.emit('output_append', { id, value })
      },
      appendLine: (value) => {
        this.api.emit('output_append_line', { id, value })
      },
      clear: () => {
        this.api.emit('output_clear', { id })
      },
      show: (preserveFocus) => {
        this.api.emit('output_show', { id, preserveFocus })
      },
      hide: () => {
        this.api.emit('output_hide', { id })
      },
      dispose: () => {
        this.api.emit('output_dispose', { id })
      }
    }
    
    this.api.trackRegistration('outputChannels', id)
    this.api.emit('output_create', { id, channel })
    
    return channel
  }
}

/**
 * Files API - File system operations
 */
class FilesAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Read file
   */
  async readFile(filePath) {
    this.api.enforcePermission('read:files', filePath)
    
    try {
      return await readTextFile(filePath)
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`)
    }
  }

  /**
   * Write file
   */
  async writeFile(filePath, content) {
    this.api.enforcePermission('write:files', filePath)
    
    try {
      await writeTextFile(filePath, content)
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`)
    }
  }

  /**
   * Check if file exists
   */
  async exists(filePath) {
    this.api.enforcePermission('read:files', filePath)
    
    try {
      return await exists(filePath)
    } catch (error) {
      return false
    }
  }

  /**
   * Read directory
   */
  async readDirectory(dirPath) {
    this.api.enforcePermission('read:files', dirPath)
    
    try {
      const entries = await readDir(dirPath)
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.children !== undefined,
        isFile: entry.children === undefined
      }))
    } catch (error) {
      throw new Error(`Failed to read directory ${dirPath}: ${error.message}`)
    }
  }
}

/**
 * Settings API - Plugin-specific settings
 */
class SettingsAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get setting
   */
  async getSetting(key, defaultValue) {
    try {
      const value = await invoke('get_plugin_setting', {
        pluginId: this.api.pluginId,
        key
      })
      return value !== null ? value : defaultValue
    } catch (error) {
      return defaultValue
    }
  }

  /**
   * Set setting
   */
  async setSetting(key, value) {
    try {
      await invoke('set_plugin_setting', {
        pluginId: this.api.pluginId,
        key,
        value
      })
      
      this.api.emit('setting_changed', { key, value })
    } catch (error) {
      throw new Error(`Failed to set setting ${key}: ${error.message}`)
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings() {
    try {
      return await invoke('get_plugin_settings', {
        pluginId: this.api.pluginId
      })
    } catch (error) {
      return {}
    }
  }
}

/**
 * Editor API - Direct editor manipulation
 */
class EditorAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get active editor
   */
  get activeTextEditor() {
    this.api.enforcePermission('ui:editor')
    
    return {
      document: {
        fileName: 'current-document',
        getText: () => this.api.editorAPI?.getContent() || '',
        lineCount: (this.api.editorAPI?.getContent() || '').split('\n').length
      },
      selection: this.api.editorAPI?.getSelection() || { from: 0, to: 0 },
      edit: (callback) => {
        this.api.enforcePermission('write:workspace')
        
        const editBuilder = {
          insert: (position, text) => {
            // Implementation would depend on editor API
            this.api.editorAPI?.insertContent(text)
          },
          replace: (range, text) => {
            // Implementation would depend on editor API
            this.api.editorAPI?.replaceContent(range, text)
          },
          delete: (range) => {
            // Implementation would depend on editor API
            this.api.editorAPI?.deleteContent(range)
          }
        }
        
        callback(editBuilder)
      }
    }
  }

  /**
   * Register text editor command
   */
  registerTextEditorCommand(commandId, callback) {
    this.api.enforcePermission('ui:editor')
    
    return this.api.commands.registerCommand(commandId, (editor, edit, ...args) => {
      return callback(editor || this.activeTextEditor, edit, ...args)
    })
  }
}

/**
 * Environment API - Access environment information
 */
class EnvironmentAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Get environment variable
   */
  get(key) {
    // Limited access to environment variables for security
    const allowedVars = ['NODE_ENV', 'PATH', 'HOME', 'USER']
    
    if (!allowedVars.includes(key)) {
      throw new Error(`Access to environment variable ${key} is not allowed`)
    }
    
    return process.env[key]
  }

  /**
   * Get platform information
   */
  get platform() {
    return {
      os: navigator.platform,
      arch: 'unknown', // Would need to be provided by Tauri
      shell: 'unknown' // Would need to be provided by Tauri
    }
  }
}

/**
 * Debug API - Debugging utilities
 */
class DebugAPI {
  constructor(api) {
    this.api = api
  }

  /**
   * Create debug console
   */
  createDebugConsole(name) {
    return {
      log: (...args) => this.api.logger.log(`[Debug ${name}]`, ...args),
      warn: (...args) => this.api.logger.warn(`[Debug ${name}]`, ...args),
      error: (...args) => this.api.logger.error(`[Debug ${name}]`, ...args)
    }
  }

  /**
   * Start debugging session
   */
  async startDebugging(folder, nameOrConfiguration) {
    this.api.enforcePermission('debug:session')
    
    // This would integrate with Lokus debugging capabilities
    throw new Error('Debug sessions not yet implemented')
  }
}

export { ExtendedPluginAPI }
export default ExtendedPluginAPI