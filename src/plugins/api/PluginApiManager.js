/**
 * Plugin API Manager
 * Manages plugin APIs and provides controlled access to Lokus functionality
 */

// Import Tauri API directly
import { invoke } from '@tauri-apps/api/tauri'
import { emit, listen } from '@tauri-apps/api/event'

export class PluginApiManager {
  constructor() {
    this.apiRegistry = new Map()
    this.eventListeners = new Map()
    this.statusBarItems = new Map()
    this.commandPalette = null
    this.notificationSystem = null
    
    this.initializeApis()
    this.setupEventListeners()
  }

  /**
   * Initialize core APIs
   */
  initializeApis() {
    // Workspace API
    this.registerApi('workspace', {
      getWorkspaceFolders: async () => {
        return await invoke('get_workspace_folders')
      },
      
      openTextDocument: async (path) => {
        return await invoke('open_text_document', { path })
      },
      
      onDidOpenTextDocument: (callback) => {
        return this.addEventListener('document-opened', callback)
      },
      
      onDidCloseTextDocument: (callback) => {
        return this.addEventListener('document-closed', callback)
      },
      
      onDidChangeTextDocument: (callback) => {
        return this.addEventListener('document-changed', callback)
      }
    })

    // Window API
    this.registerApi('window', {
      showInformationMessage: async (message, ...items) => {
        return await this.showMessage('info', message, items)
      },
      
      showWarningMessage: async (message, ...items) => {
        return await this.showMessage('warning', message, items)
      },
      
      showErrorMessage: async (message, ...items) => {
        return await this.showMessage('error', message, items)
      },
      
      createStatusBarItem: (alignment = 1, priority = 100) => {
        return this.createStatusBarItem(alignment, priority)
      },
      
      showQuickPick: async (items, options = {}) => {
        return await this.showQuickPick(items, options)
      },
      
      showInputBox: async (options = {}) => {
        return await this.showInputBox(options)
      }
    })

    // Commands API
    this.registerApi('commands', {
      registerCommand: (command, callback) => {
        return this.registerCommand(command, callback)
      },
      
      executeCommand: async (command, ...args) => {
        return await invoke('execute_command', { command, args })
      },
      
      getCommands: () => {
        return Array.from(this.commandRegistry.keys())
      }
    })

    // UI API
    this.registerApi('ui', {
      createWebviewPanel: (viewType, title, showOptions, options = {}) => {
        return this.createWebviewPanel(viewType, title, showOptions, options)
      },
      
      registerCustomEditorProvider: (viewType, provider) => {
        return this.registerCustomEditorProvider(viewType, provider)
      },
      
      registerTreeDataProvider: (viewId, provider) => {
        return this.registerTreeDataProvider(viewId, provider)
      }
    })

    // FileSystem API
    this.registerApi('fs', {
      readFile: async (path) => {
        try {
          return await invoke('read_file_content', { path })
        } catch (error) {
          throw new Error(`Failed to read file: ${error}`)
        }
      },
      
      writeFile: async (path, content) => {
        try {
          return await invoke('write_file_content', { path, content })
        } catch (error) {
          throw new Error(`Failed to write file: ${error}`)
        }
      },
      
      createFile: async (path) => {
        try {
          return await invoke('create_file_in_workspace', { path })
        } catch (error) {
          throw new Error(`Failed to create file: ${error}`)
        }
      },
      
      createFolder: async (path) => {
        try {
          return await invoke('create_folder_in_workspace', { path })
        } catch (error) {
          throw new Error(`Failed to create folder: ${error}`)
        }
      },
      
      deleteFile: async (path) => {
        try {
          return await invoke('delete_file', { path })
        } catch (error) {
          throw new Error(`Failed to delete file: ${error}`)
        }
      },
      
      renameFile: async (oldPath, newPath) => {
        try {
          return await invoke('rename_file', { old_path: oldPath, new_path: newPath })
        } catch (error) {
          throw new Error(`Failed to rename file: ${error}`)
        }
      }
    })

    // Configuration API
    this.registerApi('configuration', {
      get: async (section, pluginId = null) => {
        const key = pluginId ? `${pluginId}.${section}` : section
        return await invoke('get_plugin_setting', { plugin_name: pluginId || 'global', key: section })
      },
      
      update: async (section, value, pluginId = null) => {
        const key = pluginId ? `${pluginId}.${section}` : section
        return await invoke('set_plugin_setting', { 
          plugin_name: pluginId || 'global', 
          key: section, 
          value 
        })
      },
      
      onDidChange: (callback) => {
        return this.addEventListener('configuration-changed', callback)
      }
    })

    // Events API
    this.registerApi('events', {
      emit: async (event, data) => {
        return await emit(`plugin-event-${event}`, data)
      },
      
      listen: (event, callback) => {
        return this.addEventListener(`plugin-event-${event}`, callback)
      },
      
      once: (event, callback) => {
        return this.addEventListenerOnce(`plugin-event-${event}`, callback)
      }
    })
  }

  /**
   * Setup event listeners for plugin system
   */
  async setupEventListeners() {
    // Listen for status bar item events
    await listen('status-bar-item-created', (event) => {
      this.handleStatusBarItemCreated(event.payload)
    })
    
    await listen('status-bar-item-disposed', (event) => {
      this.handleStatusBarItemDisposed(event.payload)
    })
    
    // Listen for show message events
    await listen('show-message', (event) => {
      this.handleShowMessage(event.payload)
    })
    
    // Listen for command execution events
    await listen('command-execute', (event) => {
      this.handleCommandExecution(event.payload)
    })
  }

  /**
   * Register an API namespace
   */
  registerApi(namespace, api) {
    this.apiRegistry.set(namespace, api)
  }

  /**
   * Get API by namespace
   */
  getApi(namespace) {
    return this.apiRegistry.get(namespace)
  }

  /**
   * Get all APIs for plugin context
   */
  getAllApis() {
    const apis = {}
    for (const [namespace, api] of this.apiRegistry.entries()) {
      apis[namespace] = api
    }
    return apis
  }

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    
    this.eventListeners.get(event).add(callback)
    
    // Return unlisten function
    return () => {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.eventListeners.delete(event)
        }
      }
    }
  }

  /**
   * Add event listener that fires once
   */
  addEventListenerOnce(event, callback) {
    const unlisten = this.addEventListener(event, (...args) => {
      unlisten()
      callback(...args)
    })
    return unlisten
  }

  /**
   * Emit event to listeners
   */
  emitEvent(event, data) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data)
        } catch (error) {
        }
      }
    }
  }

  /**
   * Create status bar item
   */
  createStatusBarItem(alignment, priority) {
    const itemId = Math.random().toString(36).substr(2, 9)
    
    const statusBarItem = {
      id: itemId,
      text: '',
      tooltip: '',
      command: null,
      alignment,
      priority,
      
      show: () => {
        emit('status-bar-item-created', {
          id: itemId,
          text: statusBarItem.text,
          tooltip: statusBarItem.tooltip,
          command: statusBarItem.command,
          alignment,
          priority
        })
      },
      
      hide: () => {
        emit('status-bar-item-disposed', { id: itemId })
      },
      
      dispose: () => {
        emit('status-bar-item-disposed', { id: itemId })
        this.statusBarItems.delete(itemId)
      }
    }
    
    this.statusBarItems.set(itemId, statusBarItem)
    return statusBarItem
  }

  /**
   * Handle status bar item created
   */
  handleStatusBarItemCreated(payload) {
    // Emit to UI components
    this.emitEvent('status-bar-item-created', payload)
  }

  /**
   * Handle status bar item disposed
   */
  handleStatusBarItemDisposed(payload) {
    // Emit to UI components
    this.emitEvent('status-bar-item-disposed', payload)
  }

  /**
   * Show message dialog
   */
  async showMessage(type, message, items = []) {
    return await invoke('show_message_dialog', {
      message_type: type,
      message,
      items
    })
  }

  /**
   * Handle show message event
   */
  handleShowMessage(payload) {
    // This would integrate with the UI notification system
    if (this.notificationSystem) {
      this.notificationSystem.showMessage(payload)
    } else {
      // Fallback to console for now
    }
  }

  /**
   * Register command
   */
  registerCommand(command, callback) {
    if (!this.commandRegistry) {
      this.commandRegistry = new Map()
    }
    
    this.commandRegistry.set(command, callback)
    
    // Return disposable
    return {
      dispose: () => {
        this.commandRegistry.delete(command)
      }
    }
  }

  /**
   * Handle command execution
   */
  handleCommandExecution(payload) {
    const { command, args } = payload
    
    if (this.commandRegistry && this.commandRegistry.has(command)) {
      try {
        const handler = this.commandRegistry.get(command)
        handler(...(args || []))
      } catch (error) {
      }
    } else {
      // Emit to other systems (like command palette)
      this.emitEvent('command-execute', payload)
    }
  }

  /**
   * Show quick pick
   */
  async showQuickPick(items, options = {}) {
    return new Promise((resolve) => {
      if (this.commandPalette) {
        this.commandPalette.showQuickPick(items, options, resolve)
      } else {
        // Fallback - just resolve with first item or null
        resolve(items.length > 0 ? items[0] : null)
      }
    })
  }

  /**
   * Show input box
   */
  async showInputBox(options = {}) {
    return new Promise((resolve) => {
      // This would integrate with a UI input dialog
      const input = prompt(options.prompt || 'Enter value:', options.value || '')
      resolve(input)
    })
  }

  /**
   * Set command palette reference
   */
  setCommandPalette(commandPalette) {
    this.commandPalette = commandPalette
  }

  /**
   * Set notification system reference
   */
  setNotificationSystem(notificationSystem) {
    this.notificationSystem = notificationSystem
  }

  /**
   * Create webview panel
   */
  createWebviewPanel(viewType, title, showOptions, options = {}) {
    const panelId = Math.random().toString(36).substr(2, 9)
    
    // This would integrate with the webview system
    const webviewPanel = {
      id: panelId,
      viewType,
      title,
      webview: {
        html: '',
        options: options.webviewOptions || {},
        
        postMessage: (message) => {
          emit(`webview-message-${panelId}`, message)
        },
        
        onDidReceiveMessage: (callback) => {
          return listen(`webview-message-${panelId}`, callback)
        }
      },
      
      reveal: () => {
        emit('webview-panel-reveal', { id: panelId })
      },
      
      dispose: () => {
        emit('webview-panel-dispose', { id: panelId })
      }
    }
    
    emit('webview-panel-create', {
      id: panelId,
      viewType,
      title,
      showOptions,
      options
    })
    
    return webviewPanel
  }

  /**
   * Register custom editor provider
   */
  registerCustomEditorProvider(viewType, provider) {
    // This would register with the editor system
    emit('custom-editor-provider-register', {
      viewType,
      provider: {
        resolveCustomTextEditor: provider.resolveCustomTextEditor,
        resolveCustomDocument: provider.resolveCustomDocument
      }
    })
    
    return {
      dispose: () => {
        emit('custom-editor-provider-dispose', { viewType })
      }
    }
  }

  /**
   * Register tree data provider
   */
  registerTreeDataProvider(viewId, provider) {
    // This would register with the tree view system
    emit('tree-data-provider-register', {
      viewId,
      provider: {
        getTreeItem: provider.getTreeItem,
        getChildren: provider.getChildren,
        getParent: provider.getParent,
        onDidChangeTreeData: provider.onDidChangeTreeData
      }
    })
    
    return {
      dispose: () => {
        emit('tree-data-provider-dispose', { viewId })
      }
    }
  }

  /**
   * Dispose all resources
   */
  dispose() {
    // Clean up event listeners
    this.eventListeners.clear()
    
    // Dispose all status bar items
    for (const item of this.statusBarItems.values()) {
      item.dispose()
    }
    
    // Clear registries
    this.apiRegistry.clear()
    this.statusBarItems.clear()
    
    if (this.commandRegistry) {
      this.commandRegistry.clear()
    }
  }
}

// Global plugin API manager instance
export const pluginApiManager = new PluginApiManager()
export default pluginApiManager