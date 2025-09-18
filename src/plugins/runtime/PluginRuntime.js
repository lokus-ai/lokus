/**
 * Plugin Runtime System
 * Manages plugin execution in a sandboxed environment
 */

// Import Tauri API directly
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'
import { pluginLoader } from '../PluginLoader.js'

export class PluginRuntime {
  constructor() {
    this.loadedPlugins = new Map()
    this.activePlugins = new Map()
    this.pluginWorkers = new Map()
    this.eventListeners = new Map()
    this.commandRegistry = new Map()
    this.statusBarItems = new Map()
    
    // Use the PluginLoader for actual plugin execution
    this.pluginLoader = pluginLoader
    
    this.initializeEventSystem()
  }

  async initializeEventSystem() {
    // Listen for plugin lifecycle events from backend
    await listen('plugin-activated', (event) => {
      this.activatePlugin(event.payload.pluginId)
    })
    
    await listen('plugin-deactivated', (event) => {
      this.deactivatePlugin(event.payload.pluginId)
    })
    
    await listen('plugin-uninstalled', (event) => {
      this.unloadPlugin(event.payload.pluginId)
    })
  }

  /**
   * Load a plugin into the runtime (delegates to PluginLoader)
   */
  async loadPlugin(pluginInfo) {
    try {
      // Delegate to the PluginLoader for actual loading
      await this.pluginLoader.loadPlugin(pluginInfo)
      
      // Keep track in this runtime too for compatibility
      const pluginId = pluginInfo.id || pluginInfo.name
      this.loadedPlugins.set(pluginId, {
        info: pluginInfo,
        loaded: true
      })
      
      
    } catch (error) {
      throw error
    }
  }

  /**
   * Activate a plugin (delegates to PluginLoader)
   */
  async activatePlugin(pluginId) {
    try {
      // Delegate to the PluginLoader for actual activation
      await this.pluginLoader.activatePlugin(pluginId)
      
      // Keep track in this runtime too for compatibility
      const plugin = this.loadedPlugins.get(pluginId)
      if (plugin) {
        this.activePlugins.set(pluginId, plugin)
      }
      
      // Register status bar components for this plugin
      await this.registerPluginStatusBarComponents(pluginId)
      
      // Emit activation event
      try {
        await emit('plugin-runtime-activated', { pluginId })
      } catch (error) {
      }
      
      
    } catch (error) {
      throw error
    }
  }

  /**
   * Deactivate a plugin (delegates to PluginLoader)
   */
  async deactivatePlugin(pluginId) {
    try {
      // Delegate to the PluginLoader for actual deactivation
      await this.pluginLoader.deactivatePlugin(pluginId)
      
      // Remove from active plugins in this runtime
      this.activePlugins.delete(pluginId)
      
      // Cleanup plugin resources
      this.cleanupPluginResources(pluginId)
      
      // Emit deactivation event
      try {
        await emit('plugin-runtime-deactivated', { pluginId })
      } catch (error) {
      }
      
      
    } catch (error) {
    }
  }

  /**
   * Unload a plugin from runtime (delegates to PluginLoader)
   */
  async unloadPlugin(pluginId) {
    try {
      // Delegate to the PluginLoader for actual unloading
      await this.pluginLoader.unloadPlugin(pluginId)
      
      // Remove from this runtime's tracking
      this.activePlugins.delete(pluginId)
      this.loadedPlugins.delete(pluginId)
      
      // Terminate worker if exists
      const worker = this.pluginWorkers.get(pluginId)
      if (worker) {
        worker.terminate()
        this.pluginWorkers.delete(pluginId)
      }
      
      
    } catch (error) {
    }
  }

  /**
   * Create sandboxed worker for plugin execution
   */
  createPluginWorker(pluginInfo) {
    // Create worker with plugin sandbox script
    const workerBlob = new Blob([this.getWorkerScript()], {
      type: 'application/javascript'
    })
    
    const worker = new Worker(URL.createObjectURL(workerBlob))
    
    // Handle messages from worker
    worker.onmessage = (event) => {
      this.handleWorkerMessage(pluginInfo.id, event.data)
    }
    
    worker.onerror = (error) => {
    }
    
    return worker
  }

  /**
   * Handle messages from plugin workers
   */
  async handleWorkerMessage(pluginId, message) {
    const { type, data } = message
    
    switch (type) {
      case 'api-call':
        await this.handlePluginApiCall(pluginId, data)
        break
        
      case 'command-register':
        this.registerPluginCommand(pluginId, data)
        break
        
      case 'status-bar-item':
        this.handleStatusBarItem(pluginId, data)
        break
        
      case 'event-emit':
        await emit(data.event, data.payload)
        break
        
      case 'log':
        break
        
      case 'error':
        break
        
      default:
    }
  }

  /**
   * Handle plugin API calls
   */
  async handlePluginApiCall(pluginId, apiCall) {
    const { method, args, callId } = apiCall
    
    try {
      let result
      
      switch (method) {
        case 'workspace.getWorkspaceFolders':
          result = await invoke('get_workspace_folders')
          break
          
        case 'workspace.openTextDocument':
          result = await invoke('open_text_document', { path: args[0] })
          break
          
        case 'window.showInformationMessage':
          result = await this.showMessage('info', args[0], args[1])
          break
          
        case 'window.showWarningMessage':
          result = await this.showMessage('warning', args[0], args[1])
          break
          
        case 'window.showErrorMessage':
          result = await this.showMessage('error', args[0], args[1])
          break
          
        case 'commands.executeCommand':
          result = await this.executeCommand(args[0], args.slice(1))
          break
          
        default:
          throw new Error(`Unknown API method: ${method}`)
      }
      
      // Send result back to worker
      const worker = this.pluginWorkers.get(pluginId)
      if (worker) {
        worker.postMessage({
          type: 'api-response',
          callId,
          result
        })
      }
      
    } catch (error) {
      // Send error back to worker
      const worker = this.pluginWorkers.get(pluginId)
      if (worker) {
        worker.postMessage({
          type: 'api-error',
          callId,
          error: error.message
        })
      }
    }
  }

  /**
   * Create plugin execution context
   */
  createPluginContext(pluginId, manifest) {
    return {
      pluginId,
      manifest,
      subscriptions: [],
      commands: new Map(),
      statusBarItems: new Map(),
      configuration: {},
      extensionPath: `~/.lokus/plugins/${pluginId}`,
      globalState: new Map(),
      workspaceState: new Map()
    }
  }

  /**
   * Register a command from a plugin
   */
  registerPluginCommand(pluginId, commandData) {
    const { command, title } = commandData
    const fullCommand = `${pluginId}.${command}`
    
    this.commandRegistry.set(fullCommand, {
      pluginId,
      command,
      title
    })
    
  }

  /**
   * Execute a registered command
   */
  async executeCommand(command, args = []) {
    if (this.commandRegistry.has(command)) {
      const commandInfo = this.commandRegistry.get(command)
      const worker = this.pluginWorkers.get(commandInfo.pluginId)
      
      if (worker) {
        worker.postMessage({
          type: 'execute-command',
          command: commandInfo.command,
          args
        })
      }
    } else {
      // Try to execute built-in command
      await invoke('execute_command', { command, args })
    }
  }

  /**
   * Handle status bar items from plugins
   */
  handleStatusBarItem(pluginId, itemData) {
    const { action, itemId, text, tooltip, command } = itemData
    
    if (action === 'create') {
      this.statusBarItems.set(`${pluginId}.${itemId}`, {
        pluginId,
        text,
        tooltip,
        command
      })
      
      // Emit event to update status bar in UI
      emit('status-bar-item-created', {
        id: `${pluginId}.${itemId}`,
        text,
        tooltip,
        command
      })
    } else if (action === 'dispose') {
      this.statusBarItems.delete(`${pluginId}.${itemId}`)
      
      emit('status-bar-item-disposed', {
        id: `${pluginId}.${itemId}`
      })
    }
  }

  /**
   * Show message to user
   */
  async showMessage(type, message, items = []) {
    return new Promise((resolve) => {
      // Emit event to show message in UI
      emit('show-message', {
        type,
        message,
        items,
        callback: (result) => resolve(result)
      })
    })
  }

  /**
   * Cleanup resources for a plugin
   */
  cleanupPluginResources(pluginId) {
    // Remove registered commands
    for (const [command, info] of this.commandRegistry.entries()) {
      if (info.pluginId === pluginId) {
        this.commandRegistry.delete(command)
      }
    }
    
    // Remove status bar items
    for (const [itemId, item] of this.statusBarItems.entries()) {
      if (item.pluginId === pluginId) {
        this.statusBarItems.delete(itemId)
        emit('status-bar-item-disposed', { id: itemId })
      }
    }
    
    // Remove event listeners
    if (this.eventListeners.has(pluginId)) {
      const listeners = this.eventListeners.get(pluginId)
      listeners.forEach(unlisten => unlisten())
      this.eventListeners.delete(pluginId)
    }
  }

  /**
   * Register status bar components for a plugin
   */
  async registerPluginStatusBarComponents(pluginId) {
    try {
      const plugin = this.loadedPlugins.get(pluginId);
      if (!plugin || !plugin.info) {
        return;
      }

      const manifest = plugin.info;
      const statusBarConfig = manifest.contributes?.statusBar;
      
      if (statusBarConfig) {
        // Get the plugin instance to access its components
        const pluginInstance = this.pluginLoader.getPluginInstance(pluginId);
        
        if (pluginInstance) {
          await this.registerStatusBarComponent(pluginId, statusBarConfig, pluginInstance);
        } else {
          // Try to get plugin from global window object (for TimeTracker style plugins)
          if (typeof window !== 'undefined' && window.lokus && window.lokus.plugins) {
            const windowPlugin = window.lokus.plugins.get(pluginId);
            if (windowPlugin) {
              await this.registerStatusBarComponent(pluginId, statusBarConfig, windowPlugin);
            }
          }
          
          // Also check lokusPluginComponents for registered components
          if (typeof window !== 'undefined' && window.lokusPluginComponents && window.lokusPluginComponents[pluginId]) {
            await this.registerStatusBarComponent(pluginId, statusBarConfig, null);
          }
        }
      }
    } catch (error) {
    }
  }

  /**
   * Register a specific status bar component
   */
  async registerStatusBarComponent(pluginId, config, pluginInstance) {
    try {
      const { component, position = 'right', priority = 0 } = config;
      
      // For TimeTracker plugin, we need to import the component dynamically
      if (pluginId === 'TimeTracker' && component === 'TimeTrackerStatus') {
        // Dynamic import of the TimeTracker component
        try {
          // We'll use a different approach since the plugin is already loaded
          // and the component should be available through the plugin instance
          const componentId = `${pluginId}-status-bar`;
          
          // Emit event to register the component
          await emit('status-bar-item-created', {
            id: componentId,
            position,
            priority,
            pluginId,
            componentType: 'react',
            componentName: component,
            tooltip: 'Time Tracker'
          });
          
        } catch (error) {
        }
      } else {
        // Generic component registration
        const componentId = `${pluginId}-status-bar`;
        
        await emit('status-bar-item-created', {
          id: componentId,
          position,
          priority,
          pluginId,
          componentType: 'react',
          componentName: component,
          tooltip: `${pluginId} status`
        });
      }
    } catch (error) {
    }
  }

  /**
   * Get the worker script for plugin sandbox
   */
  getWorkerScript() {
    return `
      // Plugin Worker Sandbox
      let pluginContext = null;
      let pluginExports = null;
      let apiCallId = 0;
      const pendingApiCalls = new Map();

      // Sandboxed globals
      const console = {
        log: (...args) => postMessage({ type: 'log', data: { message: args.join(' ') } }),
        error: (...args) => postMessage({ type: 'error', data: { error: args.join(' ') } }),
        warn: (...args) => postMessage({ type: 'log', data: { message: '[WARN] ' + args.join(' ') } }),
        info: (...args) => postMessage({ type: 'log', data: { message: '[INFO] ' + args.join(' ') } })
      };

      // Mock lokus API for plugins
      const lokus = {
        workspace: {
          getWorkspaceFolders: () => callApi('workspace.getWorkspaceFolders'),
          openTextDocument: (path) => callApi('workspace.openTextDocument', [path]),
          onDidOpenTextDocument: (callback) => {
            // Register event listener
            addEventListener('document-opened', callback);
          }
        },
        
        window: {
          showInformationMessage: (message, ...items) => 
            callApi('window.showInformationMessage', [message, items]),
          showWarningMessage: (message, ...items) => 
            callApi('window.showWarningMessage', [message, items]),
          showErrorMessage: (message, ...items) => 
            callApi('window.showErrorMessage', [message, items]),
          createStatusBarItem: (alignment, priority) => {
            const itemId = Math.random().toString(36).substr(2, 9);
            return {
              text: '',
              tooltip: '',
              command: null,
              show: () => {
                postMessage({
                  type: 'status-bar-item',
                  data: {
                    action: 'create',
                    itemId,
                    text: this.text,
                    tooltip: this.tooltip,
                    command: this.command
                  }
                });
              },
              dispose: () => {
                postMessage({
                  type: 'status-bar-item',
                  data: { action: 'dispose', itemId }
                });
              }
            };
          }
        },
        
        commands: {
          registerCommand: (command, callback) => {
            postMessage({
              type: 'command-register',
              data: { command, title: command }
            });
            
            // Store command handler
            if (!pluginContext.commands) pluginContext.commands = new Map();
            pluginContext.commands.set(command, callback);
          },
          
          executeCommand: (command, ...args) => 
            callApi('commands.executeCommand', [command, ...args])
        },
        
        events: {
          emit: (event, payload) => {
            postMessage({
              type: 'event-emit',
              data: { event, payload }
            });
          }
        }
      };

      // API call helper
      function callApi(method, args = []) {
        return new Promise((resolve, reject) => {
          const callId = ++apiCallId;
          pendingApiCalls.set(callId, { resolve, reject });
          
          postMessage({
            type: 'api-call',
            data: { method, args, callId }
          });
        });
      }

      // Handle messages from main thread
      onmessage = function(e) {
        const { type, pluginId, code, manifest, context } = e.data;
        
        switch (type) {
          case 'init':
            pluginContext = context;
            try {
              // Execute plugin code
              eval(code);
            } catch (error) {
              postMessage({ 
                type: 'error', 
                data: { error: error.message, stack: error.stack } 
              });
            }
            break;
            
          case 'activate':
            if (pluginExports && typeof pluginExports.activate === 'function') {
              try {
                pluginExports.activate(pluginContext);
              } catch (error) {
                postMessage({ 
                  type: 'error', 
                  data: { error: 'Activation failed: ' + error.message } 
                });
              }
            }
            break;
            
          case 'deactivate':
            if (pluginExports && typeof pluginExports.deactivate === 'function') {
              try {
                pluginExports.deactivate();
              } catch (error) {
                postMessage({ 
                  type: 'error', 
                  data: { error: 'Deactivation failed: ' + error.message } 
                });
              }
            }
            break;
            
          case 'execute-command':
            if (pluginContext.commands && pluginContext.commands.has(e.data.command)) {
              const handler = pluginContext.commands.get(e.data.command);
              try {
                handler(...(e.data.args || []));
              } catch (error) {
                postMessage({ 
                  type: 'error', 
                  data: { error: 'Command execution failed: ' + error.message } 
                });
              }
            }
            break;
            
          case 'api-response':
            const responseCall = pendingApiCalls.get(e.data.callId);
            if (responseCall) {
              responseCall.resolve(e.data.result);
              pendingApiCalls.delete(e.data.callId);
            }
            break;
            
          case 'api-error':
            const errorCall = pendingApiCalls.get(e.data.callId);
            if (errorCall) {
              errorCall.reject(new Error(e.data.error));
              pendingApiCalls.delete(e.data.callId);
            }
            break;
        }
      };

      // Module system for plugins
      const module = { exports: {} };
      const exports = module.exports;
      
      // After plugin code execution, store exports
      setTimeout(() => {
        pluginExports = module.exports;
      }, 0);
    `;
  }

  /**
   * Get list of loaded plugins (delegates to PluginLoader)
   */
  getLoadedPlugins() {
    return this.pluginLoader.getLoadedPlugins()
  }

  /**
   * Get list of active plugins (delegates to PluginLoader)
   */
  getActivePlugins() {
    return this.pluginLoader.getActivePlugins()
  }

  /**
   * Get plugin info (delegates to PluginLoader)
   */
  getPluginInfo(pluginId) {
    return this.pluginLoader.getPluginInfo(pluginId)
  }
}

// Global plugin runtime instance
export const pluginRuntime = new PluginRuntime()
export default pluginRuntime