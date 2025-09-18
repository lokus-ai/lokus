/**
 * Real Plugin Loader System
 * Dynamically loads and executes JavaScript plugins from the filesystem
 */

import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

export class PluginLoader {
  constructor() {
    this.loadedPlugins = new Map();
    this.activePlugins = new Map();
    this.pluginModules = new Map();
    this.pluginContexts = new Map();
    this.eventListeners = new Map();
    
    this.initializeEventSystem();
  }

  async initializeEventSystem() {
    try {
      // Listen for plugin lifecycle events from backend
      await listen('plugin-activated', (event) => {
        this.activatePlugin(event.payload.pluginId);
      });
      
      await listen('plugin-deactivated', (event) => {
        this.deactivatePlugin(event.payload.pluginId);
      });
      
      await listen('plugin-uninstalled', (event) => {
        this.unloadPlugin(event.payload.pluginId);
      });
    } catch (error) {
    }
  }

  /**
   * Load a plugin's JavaScript code and execute it
   */
  async loadPlugin(pluginInfo) {
    try {
      const pluginId = pluginInfo.id || pluginInfo.name;
      
      if (this.loadedPlugins.has(pluginId)) {
        return;
      }


      // Create plugin context
      const context = this.createPluginContext(pluginId, pluginInfo);
      this.pluginContexts.set(pluginId, context);

      // Load plugin code from filesystem
      const pluginCode = await this.loadPluginCode(pluginInfo);
      if (!pluginCode) {
        throw new Error(`Failed to load plugin code for ${pluginId}`);
      }

      // Execute plugin code in a controlled environment
      const pluginModule = await this.executePluginCode(pluginId, pluginCode, context);
      
      this.pluginModules.set(pluginId, pluginModule);
      this.loadedPlugins.set(pluginId, {
        info: pluginInfo,
        module: pluginModule,
        context,
        loaded: true
      });

      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load plugin JavaScript code from filesystem
   */
  async loadPluginCode(pluginInfo) {
    try {
      // Check if we're in Tauri environment
      const isTauri = this.isTauriEnvironment();
      
      if (isTauri) {
        // Use Tauri backend to read plugin file
        const pluginPath = pluginInfo.path;
        const mainFile = pluginInfo.main || 'index.js';
        const fullPath = `${pluginPath}/${mainFile}`;
        
        const code = await invoke('read_plugin_file', { path: fullPath });
        return code;
      } else {
        // Browser mode - try to load from local storage or mock
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Execute plugin code in a sandboxed environment
   */
  async executePluginCode(pluginId, code, context) {
    try {
      
      // Transform ES6 import/export syntax to CommonJS
      const transformedCode = this.transformES6Modules(code, pluginId);
      
      // Create a module environment for the plugin
      const module = { exports: {} };
      const exports = module.exports;
      
      // Create safe global context for plugin
      const pluginGlobals = {
        console: {
          log: (...args) => {},
          error: (...args) => {},
          warn: (...args) => {},
          info: (...args) => {}
        },
        // Provide Lokus API access
        lokus: this.createLokusAPI(pluginId, context),
        module,
        exports,
        require: this.createRequireFunction(pluginId),
        // Make context available
        context,
        // Add window for plugins that expect it
        window: typeof window !== 'undefined' ? window : {},
        // Add global for plugins that use it
        global: typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {}),
        // ES6 module support
        __esModule: true
      };

      // Execute the transformed plugin code with controlled globals
      const func = new Function(...Object.keys(pluginGlobals), transformedCode);
      func(...Object.values(pluginGlobals));

      // Check if we have a default export (ES6 modules)
      let pluginExports = module.exports;
      if (pluginExports && typeof pluginExports === 'object' && pluginExports.default) {
        // Use the default export if it exists
        pluginExports = pluginExports.default;
      }


      // Return the module exports (should contain activate, deactivate, getAPI methods)
      return pluginExports;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transform ES6 import/export syntax to CommonJS
   */
  transformES6Modules(code, pluginId) {
    // Simple transformation for the most common ES6 patterns
    let transformedCode = code;
    
    // Transform import statements
    transformedCode = transformedCode.replace(
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
      (match, identifier, modulePath) => {
        if (modulePath.startsWith('./')) {
          // Local component imports - create mock
          return `const ${identifier} = { default: () => null };`;
        } else {
          // External imports
          return `const ${identifier} = require('${modulePath}');`;
        }
      }
    );
    
    // Transform named imports
    transformedCode = transformedCode.replace(
      /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?/g,
      (match, namedImports, modulePath) => {
        if (modulePath.startsWith('./')) {
          // Local component imports - create mocks
          const imports = namedImports.split(',').map(imp => imp.trim());
          const mocks = imports.map(imp => `const ${imp} = () => null;`).join('\n');
          return mocks;
        } else {
          // External imports
          return `const { ${namedImports} } = require('${modulePath}');`;
        }
      }
    );
    
    // Transform export default
    transformedCode = transformedCode.replace(
      /export\s+default\s+/g,
      'module.exports = '
    );
    
    // Transform named exports
    transformedCode = transformedCode.replace(
      /export\s+\{\s*([^}]+)\s*\};?/g,
      (match, namedExports) => {
        const exports = namedExports.split(',').map(exp => {
          const trimmed = exp.trim();
          return `exports.${trimmed} = ${trimmed};`;
        }).join('\n');
        return exports;
      }
    );
    
    // Transform export class/function
    transformedCode = transformedCode.replace(
      /export\s+(class|function)\s+(\w+)/g,
      (match, type, name) => {
        return `${type} ${name}`;
      }
    );
    
    // Add exports assignment for classes/functions at the end
    const classMatches = code.match(/export\s+class\s+(\w+)/g);
    const functionMatches = code.match(/export\s+function\s+(\w+)/g);
    
    if (classMatches || functionMatches) {
      const classNames = classMatches ? classMatches.map(m => m.match(/export\s+class\s+(\w+)/)[1]) : [];
      const functionNames = functionMatches ? functionMatches.map(m => m.match(/export\s+function\s+(\w+)/)[1]) : [];
      const allNames = [...classNames, ...functionNames];
      
      if (allNames.length > 0) {
        transformedCode += '\n' + allNames.map(name => `exports.${name} = ${name};`).join('\n');
      }
    }
    
    return transformedCode;
  }

  /**
   * Create a plugin execution context
   */
  createPluginContext(pluginId, pluginInfo) {
    return {
      pluginId,
      manifest: pluginInfo,
      subscriptions: [],
      commands: new Map(),
      statusBarItems: new Map(),
      panels: new Map(),
      configuration: pluginInfo.settings || {},
      extensionPath: pluginInfo.path || `~/.lokus/plugins/${pluginId}`,
      globalState: new Map(),
      workspaceState: new Map(),
      isActive: false
    };
  }

  /**
   * Create Lokus API for plugins
   */
  createLokusAPI(pluginId, context) {
    return {
      workspace: {
        getWorkspaceFolders: async () => {
          try {
            return await invoke('get_workspace_folders');
          } catch (error) {
            return [];
          }
        },
        
        onDidOpenNote: (callback) => {
          // Register event listener
          this.addEventListener(pluginId, 'note-opened', callback);
        },
        
        onDidCloseNote: (callback) => {
          this.addEventListener(pluginId, 'note-closed', callback);
        }
      },

      window: {
        showInformationMessage: async (message, ...items) => {
          return null;
        },
        
        showWarningMessage: async (message, ...items) => {
          return null;
        },
        
        showErrorMessage: async (message, ...items) => {
          return null;
        },

        createStatusBarItem: (alignment, priority) => {
          const itemId = `${pluginId}-${Math.random().toString(36).substr(2, 9)}`;
          const item = {
            id: itemId,
            text: '',
            tooltip: '',
            command: null,
            show: () => {
              context.statusBarItems.set(itemId, item);
              this.emitStatusBarItemUpdate(pluginId, 'create', item);
            },
            hide: () => {
              context.statusBarItems.delete(itemId);
              this.emitStatusBarItemUpdate(pluginId, 'hide', item);
            },
            dispose: () => {
              context.statusBarItems.delete(itemId);
              this.emitStatusBarItemUpdate(pluginId, 'dispose', item);
            }
          };
          return item;
        }
      },

      commands: {
        registerCommand: (command, callback) => {
          const fullCommand = `${pluginId}.${command}`;
          context.commands.set(command, callback);
          
          // Emit command registration event
          this.emitCommandRegistered(pluginId, command, callback);
        },
        
        executeCommand: async (command, ...args) => {
          // Try to execute local command first
          if (context.commands.has(command)) {
            const handler = context.commands.get(command);
            return await handler(...args);
          }
          
          // Try to execute global command
          try {
            return await invoke('execute_command', { command, args });
          } catch (error) {
            return null;
          }
        }
      },

      events: {
        emit: (event, payload) => {
          emit(`plugin-${pluginId}-${event}`, payload).catch(() => {});
        },
        
        on: (event, callback) => {
          this.addEventListener(pluginId, event, callback);
        }
      },

      storage: {
        get: (key, defaultValue = null) => {
          try {
            const data = localStorage.getItem(`plugin-${pluginId}-${key}`);
            return data ? JSON.parse(data) : defaultValue;
          } catch (error) {
            return defaultValue;
          }
        },
        
        set: (key, value) => {
          try {
            localStorage.setItem(`plugin-${pluginId}-${key}`, JSON.stringify(value));
            return true;
          } catch (error) {
            return false;
          }
        },
        
        delete: (key) => {
          localStorage.removeItem(`plugin-${pluginId}-${key}`);
        }
      }
    };
  }

  /**
   * Create a require function for plugins (limited)
   */
  createRequireFunction(pluginId) {
    return (module) => {
      // Only allow specific modules for security
      const allowedModules = {
        // React components can be imported from global window
        'react': typeof window !== 'undefined' ? window.React : null,
        'react-dom': typeof window !== 'undefined' ? window.ReactDOM : null,
      };
      
      if (allowedModules.hasOwnProperty(module)) {
        return allowedModules[module];
      }
      
      // Handle relative imports for plugin components
      if (module.startsWith('./')) {
        // Return a mock object for component imports
        return {
          default: () => null, // Mock React component
          __esModule: true
        };
      }
      
      return {};
    };
  }

  /**
   * Activate a loaded plugin
   */
  async activatePlugin(pluginId) {
    try {
      const plugin = this.loadedPlugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not loaded`);
      }

      if (this.activePlugins.has(pluginId)) {
        return;
      }


      // Call plugin's activate method if it exists
      if (plugin.module && typeof plugin.module.activate === 'function') {
        await plugin.module.activate(plugin.context);
      }

      plugin.context.isActive = true;
      this.activePlugins.set(pluginId, plugin);

      // Emit activation event
      try {
        await emit('plugin-runtime-activated', { pluginId });
      } catch (error) {
      }

      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId) {
    try {
      const plugin = this.activePlugins.get(pluginId);
      if (!plugin) {
        return;
      }


      // Call plugin's deactivate method if it exists
      if (plugin.module && typeof plugin.module.deactivate === 'function') {
        await plugin.module.deactivate();
      }

      // Cleanup plugin resources
      this.cleanupPluginResources(pluginId);

      plugin.context.isActive = false;
      this.activePlugins.delete(pluginId);

      // Emit deactivation event
      try {
        await emit('plugin-runtime-deactivated', { pluginId });
      } catch (error) {
      }

      
    } catch (error) {
    }
  }

  /**
   * Unload a plugin from runtime
   */
  async unloadPlugin(pluginId) {
    try {

      // Deactivate if active
      if (this.activePlugins.has(pluginId)) {
        await this.deactivatePlugin(pluginId);
      }

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginId);
      this.pluginModules.delete(pluginId);
      this.pluginContexts.delete(pluginId);

      
    } catch (error) {
    }
  }

  /**
   * Cleanup resources for a plugin
   */
  cleanupPluginResources(pluginId) {
    const context = this.pluginContexts.get(pluginId);
    if (!context) return;

    // Cleanup status bar items
    for (const [itemId, item] of context.statusBarItems.entries()) {
      this.emitStatusBarItemUpdate(pluginId, 'dispose', item);
    }
    context.statusBarItems.clear();

    // Cleanup event listeners
    if (this.eventListeners.has(pluginId)) {
      this.eventListeners.delete(pluginId);
    }

    // Clear commands
    context.commands.clear();
  }

  /**
   * Add event listener for a plugin
   */
  addEventListener(pluginId, event, callback) {
    if (!this.eventListeners.has(pluginId)) {
      this.eventListeners.set(pluginId, new Map());
    }
    
    const pluginListeners = this.eventListeners.get(pluginId);
    if (!pluginListeners.has(event)) {
      pluginListeners.set(event, []);
    }
    
    pluginListeners.get(event).push(callback);
  }

  /**
   * Emit status bar item update
   */
  emitStatusBarItemUpdate(pluginId, action, item) {
    try {
      emit('status-bar-item-updated', {
        pluginId,
        action,
        item: {
          id: item.id,
          text: item.text,
          tooltip: item.tooltip,
          command: item.command
        }
      });
    } catch (error) {
    }
  }

  /**
   * Emit command registration
   */
  emitCommandRegistered(pluginId, command, callback) {
    try {
      emit('command-registered', {
        pluginId,
        command: `${pluginId}.${command}`,
        title: command
      });
    } catch (error) {
    }
  }

  /**
   * Check if running in Tauri environment
   */
  isTauriEnvironment() {
    try {
      const w = window;
      return !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {
      return false;
    }
  }

  /**
   * Get list of loaded plugins
   */
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.keys());
  }

  /**
   * Get list of active plugins
   */
  getActivePlugins() {
    return Array.from(this.activePlugins.keys());
  }

  /**
   * Get plugin info
   */
  getPluginInfo(pluginId) {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get plugin API (for external access)
   */
  getPluginAPI(pluginId) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (plugin && plugin.module && typeof plugin.module.getAPI === 'function') {
      return plugin.module.getAPI();
    }
    return null;
  }
}

// Create and export global instance
export const pluginLoader = new PluginLoader();
export default pluginLoader;