/**
 * Lokus Plugin API - The runtime API that plugins use to interact with Lokus
 * This is what gets imported as '@lokus/plugin-api' in plugins
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

import { createBridgedEditorAPI } from './PluginBridge.js';
import { LanguagesAPI } from './LanguagesAPI.js';
import { ConfigurationAPI } from './ConfigurationAPI.js';
import { TerminalAPI } from './TerminalAPI.js';
import { WorkspaceAPI } from './WorkspaceAPI.js';
import { Disposable } from '../../utils/Disposable.js';

/**
 * Editor API - Provides access to TipTap editor functionality
 * This is a simple wrapper around the sophisticated EditorAPI
 */
export class EditorAPI extends EventEmitter {
  constructor() {
    super();
    this.bridgedAPI = null;
    this.currentPluginId = null;
  }

  /**
   * Initialize with plugin context
   */
  _initializeForPlugin(pluginId) {
    if (this.currentPluginId !== pluginId) {
      this.currentPluginId = pluginId;
      this.bridgedAPI = createBridgedEditorAPI(pluginId);
    }
  }

  /**
   * Add a TipTap extension to the editor
   */
  async addExtension({ name, type = 'extension', schema, view, commands, inputRules, keyboardShortcuts }) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const extensionId = await this.bridgedAPI.addExtension({
        name,
        type,
        schema,
        view,
        commands,
        inputRules,
        keyboardShortcuts
      });

      this.emit('extension_added', { name, extensionId, type });
      return extensionId;
    } catch (error) {
      this.emit('extension_error', { name, error });
      throw error;
    }
  }

  /**
   * Remove an extension
   */
  removeExtension(extensionId) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const result = this.bridgedAPI.removeExtension(extensionId);
      this.emit('extension_removed', { extensionId });
      return result;
    } catch (error) {
      this.emit('extension_error', { extensionId, error });
      throw error;
    }
  }

  /**
   * Add a slash command
   */
  async addSlashCommand({ name, description, icon, aliases = [], execute }) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const commandId = await this.bridgedAPI.addSlashCommand({
        name,
        description,
        icon,
        aliases,
        execute
      });

      this.emit('slash_command_added', { name, commandId });
      return commandId;
    } catch (error) {
      this.emit('slash_command_error', { name, error });
      throw error;
    }
  }

  /**
   * Add context menu item
   */
  addContextMenuItem({ id, name, icon, condition, execute }) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const itemId = this.bridgedAPI.addContextMenuItem({
        id,
        name,
        icon,
        condition,
        execute
      });

      this.emit('context_menu_item_added', { id, itemId });
      return itemId;
    } catch (error) {
      this.emit('context_menu_item_error', { id, error });
      throw error;
    }
  }

  /**
   * Add drag & drop handler
   */
  addDropHandler({ accept, handler }) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const handlerId = this.bridgedAPI.addDropHandler({
        accept: Array.isArray(accept) ? accept : [accept],
        handler
      });

      this.emit('drop_handler_added', { handlerId });
      return handlerId;
    } catch (error) {
      this.emit('drop_handler_error', { error });
      throw error;
    }
  }

  /**
   * Insert a node at current position
   */
  async insertNode(type, attrs = {}, content = '') {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      return await this.bridgedAPI.insertNode(type, attrs, content);
    } catch (error) {
      this.emit('insert_node_error', { type, error });
      throw error;
    }
  }

  /**
   * Get current selection
   */
  async getSelection() {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      return await this.bridgedAPI.getSelection();
    } catch (error) {
      this.emit('get_selection_error', { error });
      return null;
    }
  }

  /**
   * Replace selection with content
   */
  async replaceSelection(content) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      return await this.bridgedAPI.replaceSelection(content);
    } catch (error) {
      this.emit('replace_selection_error', { error });
      throw error;
    }
  }

  /**
   * Add keyboard shortcut
   */
  addKeyboardShortcut({ key, handler, description }) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const shortcutId = this.bridgedAPI.addKeyboardShortcut({
        key,
        handler,
        description
      });

      this.emit('keyboard_shortcut_added', { key, shortcutId });
      return shortcutId;
    } catch (error) {
      this.emit('keyboard_shortcut_error', { key, error });
      throw error;
    }
  }

  /**
   * Add toolbar item
   */
  addToolbarItem({ id, title, icon, group = 'plugin', handler, isActive, isDisabled }) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }

    try {
      const itemId = this.bridgedAPI.addToolbarItem({
        id,
        title,
        icon,
        group,
        handler,
        isActive,
        isDisabled
      });

      this.emit('toolbar_item_added', { id, itemId });
      return itemId;
    } catch (error) {
      this.emit('toolbar_item_error', { id, error });
      throw error;
    }
  }

  /**
   * Get editor text content
   */
  async getText() {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }
    return this.bridgedAPI.getText();
  }

  /**
   * Subscribe to editor updates
   */
  onUpdate(callback) {
    if (!this.bridgedAPI) {
      throw new Error('EditorAPI not initialized. Plugin context required.');
    }
    return this.bridgedAPI.onUpdate(callback);
  }

  // Cleanup methods for plugin deactivation
  async removeAllExtensions(pluginId) {
    if (!this.bridgedAPI) {
      return;
    }

    try {
      await this.bridgedAPI.cleanup();
      this.emit('extensions_cleaned_up', { pluginId });
    } catch (error) {
      console.error('Error cleaning up extensions:', error);
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    if (!this.bridgedAPI) {
      return { pluginId: this.currentPluginId, extensions: 0, commands: 0, shortcuts: 0 };
    }

    return this.bridgedAPI.getStats();
  }
}

/**
 * UI API - Provides access to UI components and panels
 */
export class UIAPI extends EventEmitter {
  constructor(uiManager) {
    super();
    this.uiManager = uiManager;
    this.panels = new Map();
    this.dialogs = new Map();
    this.toolbars = new Map();
  }

  /**
   * Add a UI panel
   */
  addPanel({ id, title, position, icon, component, props = {} }) {
    if (this.panels.has(id)) {
      throw new Error(`Panel '${id}' already exists`);
    }

    const panel = {
      id,
      title,
      position, // 'sidebar-left', 'sidebar-right', 'bottom', 'modal'
      icon,
      component,
      props,
      pluginId: this.currentPluginId,
      visible: false
    };

    this.panels.set(id, panel);

    if (this.uiManager) {
      this.uiManager.addPanel(panel);
    }

    this.emit('panel_added', { id, panel });
    return panel;
  }

  /**
   * Remove a panel
   */
  removePanel(id) {
    const panel = this.panels.get(id);
    if (!panel) return false;

    this.panels.delete(id);

    if (this.uiManager) {
      this.uiManager.removePanel(id);
    }

    this.emit('panel_removed', { id, panel });
    return true;
  }

  /**
   * Update panel props
   */
  updatePanel(id, props) {
    const panel = this.panels.get(id);
    if (!panel) {
      throw new Error(`Panel '${id}' not found`);
    }

    Object.assign(panel.props, props);

    if (this.uiManager) {
      this.uiManager.updatePanel(id, props);
    }

    this.emit('panel_updated', { id, props });
    return panel;
  }

  /**
   * Show a prompt dialog
   */
  async showPrompt({ title, message, placeholder, validate, defaultValue }) {
    const id = `prompt_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const dialog = {
        id,
        type: 'prompt',
        title,
        message,
        placeholder,
        validate,
        defaultValue,
        onConfirm: (value) => {
          this.dialogs.delete(id);
          resolve(value);
        },
        onCancel: () => {
          this.dialogs.delete(id);
          resolve(null);
        }
      };

      this.dialogs.set(id, dialog);

      if (this.uiManager) {
        this.uiManager.showDialog(dialog);
      }
    });
  }

  /**
   * Show a confirmation dialog
   */
  async showConfirm({ title, message, confirmText = 'OK', cancelText = 'Cancel' }) {
    const id = `confirm_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const dialog = {
        id,
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          this.dialogs.delete(id);
          resolve(true);
        },
        onCancel: () => {
          this.dialogs.delete(id);
          resolve(false);
        }
      };

      this.dialogs.set(id, dialog);

      if (this.uiManager) {
        this.uiManager.showDialog(dialog);
      }
    });
  }

  // Cleanup methods
  removeAllPanels(pluginId) {
    for (const [id, panel] of this.panels) {
      if (panel.pluginId === pluginId) {
        this.removePanel(id);
      }
    }
  }
}

/**
 * Filesystem API - Provides safe file system access
 */
export class FilesystemAPI extends EventEmitter {
  constructor(fsManager) {
    super();
    this.fsManager = fsManager;
  }

  /**
   * Open file dialog
   */
  async openFileDialog({ accept, multiple = false, title }) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    return this.fsManager.openFileDialog({
      accept,
      multiple,
      title
    });
  }

  /**
   * Write file to plugin directory
   */
  async writeFile(relativePath, content) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    // Ensure path is within plugin directory
    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.writeFile(safePath, content);
  }

  /**
   * Read file from plugin directory
   */
  async readFile(relativePath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.readFile(safePath);
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(relativePath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.ensureDir(safePath);
  }

  /**
   * Check if file exists
   */
  async exists(relativePath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.exists(safePath);
  }
}

/**
 * Commands API - Register and manage commands
 */
export class CommandsAPI extends EventEmitter {
  constructor(commandManager) {
    super();
    this.commandManager = commandManager;
    this.commands = new Map();
  }

  /**
   * Register a command
   */
  register(arg1, arg2) {
    let commands = arg1;

    // Handle register(id, options) signature
    if (typeof arg1 === 'string' && arg2 && typeof arg2 === 'object') {
      commands = [{ ...arg2, id: arg1 }];
      // Map 'callback' to 'execute' if present (template uses callback)
      if (commands[0].callback && !commands[0].execute) {
        commands[0].execute = commands[0].callback;
      }
    }

    const commandList = Array.isArray(commands) ? commands : [commands];
    const registered = [];

    for (const command of commandList) {
      const { id, name, shortcut, execute, description } = command;

      if (this.commands.has(id)) {
        throw new Error(`Command '${id}' already exists`);
      }

      const fullCommand = {
        id,
        name,
        shortcut,
        execute,
        description,
        pluginId: this.currentPluginId
      };

      this.commands.set(id, fullCommand);

      if (this.commandManager) {
        this.commandManager.registerCommand(fullCommand);
      }

      registered.push(fullCommand);
      this.emit('command_registered', { id, command: fullCommand });
    }

    return new Disposable(() => {
      this.unregister(registered.map(c => c.id));
    });
  }

  /**
   * Unregister commands
   */
  unregister(commandIds) {
    const idList = Array.isArray(commandIds) ? commandIds : [commandIds];
    const unregistered = [];

    for (const id of idList) {
      const command = this.commands.get(id);
      if (!command) continue;

      this.commands.delete(id);

      if (this.commandManager) {
        this.commandManager.unregisterCommand(id);
      }

      unregistered.push(command);
      this.emit('command_unregistered', { id, command });
    }

    return unregistered;
  }

  // Cleanup methods
  unregisterAll(pluginId) {
    for (const [id, command] of this.commands) {
      if (command.pluginId === pluginId) {
        this.unregister(id);
      }
    }
  }
}

/**
 * Network API - Safe network access
 */
export class NetworkAPI extends EventEmitter {
  constructor(networkManager, apiInstance) {
    super();
    this.networkManager = networkManager;
    this.apiInstance = apiInstance; // Reference to main API for permission checking
  }

  /**
   * Make HTTP request (with permission checking)
   */
  async fetch(url, options = {}) {
    if (!this.networkManager) {
      throw new Error('Network access not available');
    }

    // Check permissions - COMPLETED TODO: Use proper permission checking
    if (!this.hasPermission('network')) {
      throw new Error(`Network permission required for plugin ${this.currentPluginId}`);
    }

    return this.networkManager.fetch(url, {
      ...options,
      pluginId: this.currentPluginId
    });
  }

  hasPermission(permission) {
    // Use the main API's permission checking
    return this.apiInstance && this.apiInstance.hasPermission(this.currentPluginId, permission);
  }
}

/**
 * Clipboard API - Access to clipboard
 */
export class ClipboardAPI extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Read from clipboard
   */
  async read() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      throw new Error('Clipboard API not available');
    }

    return navigator.clipboard.read();
  }

  /**
   * Write to clipboard
   */
  async writeText(text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard API not available');
    }

    return navigator.clipboard.writeText(text);
  }
}

/**
 * Notifications API - Show notifications
 */
export class NotificationsAPI extends EventEmitter {
  constructor(notificationManager) {
    super();
    this.notificationManager = notificationManager;
    this.notifications = new Map();
  }

  /**
   * Show a notification
   */
  show({ type, message, title, duration, persistent = false, progress }) {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const notification = {
      id,
      type, // 'info', 'success', 'warning', 'error', 'loading', 'progress'
      message,
      title,
      duration,
      persistent,
      progress,
      pluginId: this.currentPluginId,
      createdAt: Date.now()
    };

    this.notifications.set(id, notification);

    if (this.notificationManager) {
      this.notificationManager.show(notification);
    }

    this.emit('notification_shown', { id, notification });
    return id;
  }

  /**
   * Update a notification
   */
  update(id, updates) {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error(`Notification '${id}' not found`);
    }

    Object.assign(notification, updates);

    if (this.notificationManager) {
      this.notificationManager.update(id, updates);
    }

    this.emit('notification_updated', { id, updates });
    return notification;
  }

  /**
   * Hide a notification
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    this.notifications.delete(id);

    if (this.notificationManager) {
      this.notificationManager.hide(id);
    }

    this.emit('notification_hidden', { id });
    return true;
  }

  // Cleanup methods
  hideAll(pluginId) {
    for (const [id, notification] of this.notifications) {
      if (notification.pluginId === pluginId) {
        this.hide(id);
      }
    }
  }
}

/**
 * Data API - Database and storage access
 */
export class DataAPI extends EventEmitter {
  constructor(dataManager) {
    super();
    this.dataManager = dataManager;
    this.databases = new Map();
  }

  /**
   * Get a database for the plugin
   */
  async getDatabase(name) {
    const dbKey = `${this.currentPluginId}_${name}`;

    if (this.databases.has(dbKey)) {
      return this.databases.get(dbKey);
    }

    if (!this.dataManager) {
      throw new Error('Data access not available');
    }

    const database = await this.dataManager.getPluginDatabase(this.currentPluginId, name);
    this.databases.set(dbKey, database);

    return database;
  }
}

/**
 * Main Plugin API Class
 * This is what gets passed to plugin constructors
 */
/**
 * Main Plugin API Class
 * This is what gets passed to plugin constructors
 */
export class LokusPluginAPI extends EventEmitter {
  constructor(managers = {}) {
    super();

    // Store references to managers
    this.managers = managers;

    // Initialize sub-APIs (pass 'this' to APIs that need permission checking)
    this.editor = new EditorAPI();
    this.ui = new UIAPI(managers.ui);
    this.fs = new FilesystemAPI(managers.filesystem); // Renamed from filesystem
    this.commands = new CommandsAPI(managers.commands);
    this.network = new NetworkAPI(managers.network, this);
    this.storage = new DataAPI(managers.data); // Renamed from data

    // New APIs (Placeholders/TODOs)
    this.workspace = new WorkspaceAPI(managers.workspace); // TODO: Implement WorkspaceAPI
    this.tasks = {}; // TODO: Implement TaskAPI
    this.debug = {}; // TODO: Implement DebugAPI
    this.languages = new LanguagesAPI(managers.languages); // TODO: Implement LanguageAPI
    this.themes = {}; // TODO: Implement ThemeAPI
    this.config = new ConfigurationAPI(managers.configuration); // TODO: Implement ConfigurationAPI
    this.terminal = new TerminalAPI(managers.terminal); // TODO: Implement TerminalAPI

    // Legacy/Runtime-specific APIs (kept for backward compat or internal use)
    this.clipboard = new ClipboardAPI();
    this.notifications = new NotificationsAPI(managers.notifications); // TODO: Move to UI API

    // Plugin context and permissions
    this.currentPluginId = null;
    this.currentPlugin = null;
    this.pluginPermissions = new Map(); // pluginId -> Set of permissions

    // Bind plugin context to sub-APIs
    this.bindPluginContext();
  }

  /**
   * Set the current plugin context
   * Called by PluginManager when activating a plugin
   */
  setPluginContext(pluginId, plugin) {
    this.currentPluginId = pluginId;
    this.currentPlugin = plugin;

    // Register plugin permissions from manifest
    if (plugin && plugin.manifest && plugin.manifest.permissions) {
      this.registerPluginPermissions(pluginId, plugin.manifest.permissions);
    }

    // Set context for all sub-APIs
    this.bindPluginContext();
  }

  /**
   * Register permissions for a plugin
   */
  registerPluginPermissions(pluginId, permissions) {
    if (!Array.isArray(permissions)) {
      permissions = [permissions];
    }
    this.pluginPermissions.set(pluginId, new Set(permissions));
  }

  /**
   * Check if a plugin has a specific permission
   */
  hasPermission(pluginId, permission) {
    // If no pluginId provided, use current plugin
    const checkPluginId = pluginId || this.currentPluginId;

    if (!checkPluginId) {
      return false;
    }

    const permissions = this.pluginPermissions.get(checkPluginId);
    if (!permissions) {
      return false;
    }

    // Check if plugin has the specific permission or 'all' permission
    return permissions.has(permission) || permissions.has('all');
  }

  /**
   * Get all permissions for a plugin
   */
  getPluginPermissions(pluginId) {
    const checkPluginId = pluginId || this.currentPluginId;
    return this.pluginPermissions.get(checkPluginId) || new Set();
  }

  /**
   * Bind plugin context to all sub-APIs
   */
  bindPluginContext() {
    const apis = [
      this.editor, this.ui, this.fs, this.commands,
      this.network, this.notifications, this.storage,
      this.clipboard, this.languages, this.config, this.terminal,
      this.workspace
    ];

    for (const api of apis) {
      if (api && typeof api === 'object') {
        api.currentPluginId = this.currentPluginId;
        api.currentPlugin = this.currentPlugin;
      }
    }

    // Initialize editor API with plugin context
    if (this.editor && this.currentPluginId) {
      this.editor._initializeForPlugin(this.currentPluginId);
    }
  }

  /**
   * Clean up all plugin resources
   * Called when a plugin is deactivated
   */
  async cleanup(pluginId) {
    await this.editor.removeAllExtensions(pluginId);
    this.ui.removeAllPanels(pluginId);
    this.commands.unregisterAll(pluginId);
    this.notifications.hideAll(pluginId);

    this.emit('plugin_cleanup', { pluginId });
  }

  /**
   * Get plugin information
   */
  getPluginInfo() {
    return {
      id: this.currentPluginId,
      plugin: this.currentPlugin
    };
  }
}

// Export the main API class
export default LokusPluginAPI;