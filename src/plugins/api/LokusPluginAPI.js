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
import { TaskAPI } from './TaskAPI.js';
import { DebugAPI } from './DebugAPI.js';
import { ThemeAPI } from './ThemeAPI.js';
import { Disposable } from '../../utils/Disposable.js';
import terminalManager from '../managers/TerminalManager.js';
import outputChannelManager from '../managers/OutputChannelManager.js';

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
    } catch { }
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
  constructor(uiManager, notificationsAPI, outputChannelManager) {
    super();
    this.uiManager = uiManager;
    this.notificationsAPI = notificationsAPI;
    this.outputChannelManager = outputChannelManager;
    this.panels = new Map();
    this.dialogs = new Map();
    this.toolbars = new Map();
    this.treeProviders = new Map();
    this.statusItems = new Map();
    this.webviews = new Map();
    this.menus = new Map();

    // Forward output channel manager events to UI events
    if (this.outputChannelManager) {
      this.outputChannelManager.on('channel-created', (data) => {
        this.emit('output-channel-created', data);
      });

      this.outputChannelManager.on('channel-updated', (data) => {
        this.emit('output-channel-update', data);
      });

      this.outputChannelManager.on('channel-shown', (data) => {
        this.emit('output-channel-show', data);
      });

      this.outputChannelManager.on('channel-hidden', (data) => {
        this.emit('output-channel-hide', data);
      });

      this.outputChannelManager.on('channel-cleared', (data) => {
        this.emit('output-channel-cleared', data);
      });

      this.outputChannelManager.on('channel-disposed', (data) => {
        this.emit('output-channel-dispose', data);
      });
    }
  }

  /**
   * Show information message
   */
  async showInformationMessage(message, ...items) {
    if (this.notificationsAPI) {
      this.notificationsAPI.show({ type: 'info', message, title: 'Info' });
    }
    // TODO: Handle items (actions)
    return undefined;
  }

  /**
   * Show warning message
   */
  async showWarningMessage(message, ...items) {
    if (this.notificationsAPI) {
      this.notificationsAPI.show({ type: 'warning', message, title: 'Warning' });
    }
    return undefined;
  }

  /**
   * Show error message
   */
  async showErrorMessage(message, ...items) {
    if (this.notificationsAPI) {
      this.notificationsAPI.show({ type: 'error', message, title: 'Error' });
    }
    return undefined;
  }

  /**
   * Create output channel
   */
  createOutputChannel(name) {
    // Use the OutputChannelManager if available
    if (this.outputChannelManager) {
      return this.outputChannelManager.createChannel(name, this.currentPluginId);
    }

    // Fallback to local implementation if manager not available
    const lines = [];
    let visible = false;

    const channel = {
      name,
      _lines: lines,
      append: (value) => {
        if (lines.length === 0) lines.push('');
        lines[lines.length - 1] += value;
        this.emit('output-channel-update', { name, lines: [...lines] });
      },
      appendLine: (value) => {
        lines.push(value);
        this.emit('output-channel-update', { name, lines: [...lines] });
      },
      replace: (value) => {
        lines.length = 0;
        lines.push(value);
        this.emit('output-channel-update', { name, lines: [...lines] });
      },
      clear: () => {
        lines.length = 0;
        this.emit('output-channel-update', { name, lines: [] });
      },
      show: (preserveFocus) => {
        visible = true;
        this.emit('output-channel-show', { name, preserveFocus });
      },
      hide: () => {
        visible = false;
        this.emit('output-channel-hide', { name });
      },
      dispose: () => {
        this.emit('output-channel-dispose', { name });
      }
    };

    if (!this.outputChannels) {
      this.outputChannels = new Map();
    }
    this.outputChannels.set(name, channel);

    return channel;
  }

  /**
   * Show input box
   */
  async showInputBox(options = {}) {
    return this.showPrompt({
      title: options.title || 'Input',
      message: options.prompt || '',
      placeholder: options.placeholder,
      defaultValue: options.value,
      validate: options.validateInput
    });
  }

  /**
   * Register custom panel (SDK alias for addPanel)
   */
  registerPanel(panel) {
    const addedPanel = this.addPanel({
      id: panel.id,
      title: panel.title,
      position: panel.location === 'sidebar' ? 'sidebar-left' : 'bottom',
      icon: panel.icon,
      component: panel.component, // Assuming component is passed in definition for now
      props: panel.initialState
    });

    return new Disposable(() => {
      this.removePanel(panel.id);
    });
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

  /**
   * Show quick pick dialog
   */
  async showQuickPick(items, options = {}) {
    const id = `quickpick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve) => {
      const dialog = {
        id,
        type: 'quickpick',
        items: Array.isArray(items) ? items : [],
        options,
        onSelect: (selected) => {
          resolve(selected);
        },
        onCancel: () => {
          resolve(undefined);
        }
      };

      // Show via UIManager
      if (this.uiManager) {
        this.uiManager.showDialog(dialog);
      }

      // Also emit event for backward compatibility
      this.emit('show-quick-pick', dialog);
    });
  }

  /**
   * Show open file/folder dialog
   */
  async showOpenDialog(options = {}) {
    try {
      // Use Tauri's dialog API
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: options.canSelectMany,
        directory: options.canSelectFolders,
        filters: options.filters ? Object.entries(options.filters).map(([name, extensions]) => ({
          name,
          extensions
        })) : undefined,
        defaultPath: options.defaultUri,
        title: options.title
      });
      return result ? (Array.isArray(result) ? result : [result]) : undefined;
    } catch (error) {
      console.error('showOpenDialog error:', error);
      return undefined;
    }
  }

  /**
   * Show save file dialog
   */
  async showSaveDialog(options = {}) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const result = await save({
        filters: options.filters ? Object.entries(options.filters).map(([name, extensions]) => ({
          name,
          extensions
        })) : undefined,
        defaultPath: options.defaultUri,
        title: options.title
      });
      return result || undefined;
    } catch (error) {
      console.error('showSaveDialog error:', error);
      return undefined;
    }
  }

  /**
   * Show progress indicator while executing a task
   */
  async withProgress(options, task) {
    const { location = 'notification', title, cancellable = false } = options;
    const progressId = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let isCancelled = false;
    const token = {
      isCancellationRequested: false,
      onCancellationRequested: (callback) => {
        this.once('progress-cancelled-' + progressId, callback);
      }
    };

    // Set up listener to update token when cancelled
    this.once('progress-cancelled-' + progressId, () => {
      isCancelled = true;
      token.isCancellationRequested = true;
    });

    const progress = {
      report: (value) => {
        const updateData = {
          id: progressId,
          title,
          message: value.message,
          percentage: value.increment,
          location,
          cancellable
        };
        this.emit('progress-update', updateData);

        // Forward to UIManager if available
        if (this.uiManager) {
          this.uiManager.updateProgress(updateData);
        }
      }
    };

    // Show progress
    const startData = {
      id: progressId,
      title,
      location,
      cancellable,
      onCancel: () => {
        this.emit('progress-cancelled-' + progressId);
      }
    };
    this.emit('progress-start', startData);

    // Forward to UIManager if available
    if (this.uiManager) {
      this.uiManager.startProgress(startData);
    }

    try {
      const result = await task(progress, token);
      return result;
    } finally {
      const endData = { id: progressId };
      this.emit('progress-end', endData);

      // Forward to UIManager if available
      if (this.uiManager) {
        this.uiManager.endProgress(endData);
      }
    }
  }

  /**
   * Register a tree data provider
   * @param {string} viewId - Unique identifier for the tree view
   * @param {Object} provider - Tree data provider implementation
   * @returns {Object} Disposable to unregister the provider
   */
  registerTreeDataProvider(viewId, provider, options = {}) {
    // Dynamic import to avoid circular deps
    import('./TreeDataProvider.js').then(({ TreeDataProviderAdapter }) => {
      import('../registry/TreeViewRegistry.js').then(({ treeViewRegistry }) => {
        const adapter = new TreeDataProviderAdapter(viewId, provider);
        this.treeProviders.set(viewId, adapter);

        // Register with the tree view registry for UI rendering
        treeViewRegistry.register({
          viewId,
          provider: adapter,
          title: options.title || viewId,
          pluginId: this.currentPluginId
        });

        this.emit('tree-provider-registered', { viewId, provider: adapter, options });
      }).catch(error => {
        console.error('Failed to load TreeViewRegistry:', error);
      });
    }).catch(error => {
      console.error('Failed to load TreeDataProvider:', error);
    });

    return new Disposable(() => {
      // Unregister from tree view registry
      import('../registry/TreeViewRegistry.js').then(({ treeViewRegistry }) => {
        treeViewRegistry.unregister(viewId);
      }).catch(() => {});

      this.treeProviders.delete(viewId);
      this.emit('tree-provider-unregistered', { viewId });
    });
  }

  /**
   * Register a status bar item
   * @param {Object} definition - Status bar item definition
   * @param {string} definition.id - Unique identifier
   * @param {string} definition.text - Display text
   * @param {string} [definition.tooltip] - Tooltip text
   * @param {Object|string} [definition.command] - Command to execute on click
   * @param {number} [definition.alignment=2] - Alignment (1=left, 2=right)
   * @param {number} [definition.priority=0] - Priority for ordering
   * @param {string} [definition.color] - Text color
   * @param {string} [definition.backgroundColor] - Background color
   * @returns {Object} Status bar item with show/hide/dispose methods
   */
  registerStatusBarItem(definition) {
    // Dynamic import to avoid circular deps
    import('../../hooks/usePluginStatusItems.js').then(({ registerStatusItem, unregisterStatusItem, updateStatusItem }) => {
      const item = {
        id: definition.id,
        text: definition.text,
        tooltip: definition.tooltip,
        command: definition.command,
        alignment: definition.alignment || 2, // Right by default
        priority: definition.priority || 0,
        color: definition.color,
        backgroundColor: definition.backgroundColor,
        _visible: true,
        pluginId: this.currentPluginId,

        show: () => {
          item._visible = true;
          updateStatusItem(definition.id, { _visible: true });
        },
        hide: () => {
          item._visible = false;
          updateStatusItem(definition.id, { _visible: false });
        },
        dispose: () => {
          unregisterStatusItem(definition.id);
          this.statusItems.delete(definition.id);
        }
      };

      // Update text property with getter/setter
      Object.defineProperty(item, 'text', {
        get: () => item._text,
        set: (value) => {
          item._text = value;
          updateStatusItem(definition.id, { text: value });
        }
      });
      item._text = definition.text;

      this.statusItems.set(definition.id, item);
      registerStatusItem(item);
    }).catch(error => {
      console.error('Failed to register status bar item:', error);
    });

    // Return a synchronous item object that will be populated
    const syncItem = {
      id: definition.id,
      text: definition.text,
      show: () => {},
      hide: () => {},
      dispose: () => {
        this.statusItems.delete(definition.id);
      }
    };

    return syncItem;
  }

  /**
   * Show notification with optional type and action buttons
   * @param {string} message - Notification message
   * @param {string} [type='info'] - Notification type (info, warning, error, success)
   * @param {Array} [actions=[]] - Action buttons
   * @returns {Promise<string|undefined>} Selected action ID or undefined
   */
  async showNotification(message, type = 'info', actions = []) {
    return new Promise((resolve) => {
      const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Show notification via notificationsAPI
      if (this.notificationsAPI) {
        this.notificationsAPI.show({
          type,
          message,
          title: type.charAt(0).toUpperCase() + type.slice(1)
        });
      }

      // If there are actions, emit event for app to handle
      if (actions && actions.length > 0) {
        this.emit('show-notification-with-actions', {
          id,
          message,
          type,
          actions,
          onAction: (actionId) => {
            resolve(actionId);
          },
          onClose: () => {
            resolve(undefined);
          }
        });
      } else {
        // No actions, resolve immediately
        resolve(undefined);
      }
    });
  }

  /**
   * Show modal dialog with buttons
   * @param {Object} options - Dialog options
   * @returns {Promise<Object>} Dialog result with buttonId and checkboxChecked
   */
  async showDialog(options) {
    return new Promise((resolve) => {
      const id = `dialog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const dialog = {
        id,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        buttons: options.buttons || [{ id: 'ok', label: 'OK', primary: true }],
        defaultButton: options.defaultButton,
        cancelButton: options.cancelButton,
        modal: options.modal !== false,
        detail: options.detail,
        checkboxLabel: options.checkboxLabel,
        checkboxChecked: options.checkboxChecked || false,
        onResult: (result) => {
          this.dialogs.delete(id);
          resolve(result);
        }
      };

      this.dialogs.set(id, dialog);

      // Emit event for app to handle
      this.emit('show-dialog', dialog);
    });
  }

  /**
   * Register webview panel with HTML content
   * @param {Object} panel - Webview panel definition
   * @returns {Object} WebviewPanel object with postMessage and onDidReceiveMessage
   */
  registerWebviewPanel(panel) {
    if (this.webviews.has(panel.id)) {
      throw new Error(`Webview panel '${panel.id}' already exists`);
    }

    const messageHandlers = [];
    const webviewPanel = {
      id: panel.id,
      title: panel.title,
      html: panel.html,
      pluginId: this.currentPluginId,

      /**
       * Post message to webview
       */
      postMessage: (message) => {
        this.emit('webview-post-message', {
          panelId: panel.id,
          message
        });
      },

      /**
       * Register message handler from webview
       */
      onDidReceiveMessage: (handler) => {
        messageHandlers.push(handler);
        return new Disposable(() => {
          const index = messageHandlers.indexOf(handler);
          if (index > -1) {
            messageHandlers.splice(index, 1);
          }
        });
      },

      /**
       * Internal method to handle incoming messages
       * @private
       */
      _handleMessage: (message) => {
        messageHandlers.forEach(handler => handler(message));
      },

      /**
       * Dispose webview
       */
      dispose: () => {
        this.webviews.delete(panel.id);
        this.emit('webview-disposed', { panelId: panel.id });
      }
    };

    this.webviews.set(panel.id, webviewPanel);
    this.emit('webview-registered', { panelId: panel.id, panel: webviewPanel });

    return webviewPanel;
  }

  /**
   * Register menu item contribution
   * @param {Object} menu - Menu definition
   * @returns {Object} Disposable
   */
  registerMenu(menu) {
    if (this.menus.has(menu.id)) {
      throw new Error(`Menu '${menu.id}' already exists`);
    }

    const menuItem = {
      id: menu.id,
      label: menu.label,
      group: menu.group,
      order: menu.order,
      when: menu.when,
      submenu: menu.submenu,
      command: menu.command,
      icon: menu.icon,
      pluginId: this.currentPluginId
    };

    this.menus.set(menu.id, menuItem);
    this.emit('menu-registered', { menuId: menu.id, menu: menuItem });

    return new Disposable(() => {
      this.menus.delete(menu.id);
      this.emit('menu-unregistered', { menuId: menu.id });
    });
  }

  /**
   * Register toolbar contribution
   * @param {Object} toolbar - Toolbar definition
   * @returns {Object} Disposable
   */
  registerToolbar(toolbar) {
    if (this.toolbars.has(toolbar.id)) {
      throw new Error(`Toolbar '${toolbar.id}' already exists`);
    }

    const toolbarDef = {
      id: toolbar.id,
      title: toolbar.title,
      location: toolbar.location,
      group: toolbar.group,
      order: toolbar.order,
      items: toolbar.items,
      when: toolbar.when,
      pluginId: this.currentPluginId
    };

    this.toolbars.set(toolbar.id, toolbarDef);
    this.emit('toolbar-registered', { toolbarId: toolbar.id, toolbar: toolbarDef });

    return new Disposable(() => {
      this.toolbars.delete(toolbar.id);
      this.emit('toolbar-unregistered', { toolbarId: toolbar.id });
    });
  }

  /**
   * Create terminal
   * @param {Object} [options={}] - Terminal options
   * @returns {Object} Terminal object
   */
  createTerminal(options = {}) {
    // Try to delegate to TerminalAPI if available
    if (this.terminalAPI) {
      return this.terminalAPI.createTerminal(options);
    }

    // Otherwise create a basic terminal object
    const terminalId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const terminal = {
      id: terminalId,
      name: options.name || 'Terminal',
      shellPath: options.shellPath,
      shellArgs: options.shellArgs,
      cwd: options.cwd,
      env: options.env,
      pluginId: this.currentPluginId,

      /**
       * Send text to terminal
       */
      sendText: (text, addNewLine = true) => {
        this.emit('terminal-send-text', {
          terminalId,
          text,
          addNewLine
        });
      },

      /**
       * Show terminal
       */
      show: (preserveFocus = false) => {
        this.emit('terminal-show', {
          terminalId,
          preserveFocus
        });
      },

      /**
       * Hide terminal
       */
      hide: () => {
        this.emit('terminal-hide', {
          terminalId
        });
      },

      /**
       * Dispose terminal
       */
      dispose: () => {
        this.emit('terminal-dispose', {
          terminalId
        });
      }
    };

    this.emit('terminal-created', { terminal });
    return terminal;
  }

  // Cleanup methods
  removeAllPanels(pluginId) {
    for (const [id, panel] of this.panels) {
      if (panel.pluginId === pluginId) {
        this.removePanel(id);
      }
    }
  }

  removeAllTreeProviders(pluginId) {
    // Unregister from tree view registry
    import('../registry/TreeViewRegistry.js').then(({ treeViewRegistry }) => {
      treeViewRegistry.clearPlugin(pluginId);
    }).catch(() => {});

    for (const [viewId, provider] of this.treeProviders) {
      if (provider.pluginId === pluginId) {
        this.treeProviders.delete(viewId);
        this.emit('tree-provider-unregistered', { viewId });
      }
    }
  }

  removeAllStatusItems(pluginId) {
    import('../../hooks/usePluginStatusItems.js').then(({ clearPluginStatusItems }) => {
      clearPluginStatusItems(pluginId);
      for (const [id, item] of this.statusItems) {
        if (item.pluginId === pluginId) {
          this.statusItems.delete(id);
        }
      }
    }).catch(() => {});
  }

  removeAllWebviews(pluginId) {
    for (const [id, webview] of this.webviews) {
      if (webview.pluginId === pluginId) {
        webview.dispose();
      }
    }
  }

  removeAllMenus(pluginId) {
    for (const [id, menu] of this.menus) {
      if (menu.pluginId === pluginId) {
        this.menus.delete(id);
        this.emit('menu-unregistered', { menuId: id });
      }
    }
  }

  removeAllToolbars(pluginId) {
    for (const [id, toolbar] of this.toolbars) {
      if (toolbar.pluginId === pluginId) {
        this.toolbars.delete(id);
        this.emit('toolbar-unregistered', { toolbarId: id });
      }
    }
  }

  removeAllOutputChannels(pluginId) {
    if (this.outputChannelManager && this.outputChannelManager.cleanupPlugin) {
      this.outputChannelManager.cleanupPlugin(pluginId);
    }

    // Also clean up local output channels if using fallback
    if (this.outputChannels) {
      const channelsToRemove = [];
      for (const [name, channel] of this.outputChannels) {
        if (channel.pluginId === pluginId) {
          channelsToRemove.push(name);
        }
      }
      for (const name of channelsToRemove) {
        this.outputChannels.delete(name);
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
    return this.fsManager.readFile(safePath, 'binary');
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

  /**
   * Read directory
   */
  async readdir(relativePath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.readDirectory(safePath);
  }

  /**
   * Create directory
   */
  async mkdir(relativePath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.createFolder(safePath);
  }

  /**
   * Delete file or directory
   */
  async delete(relativePath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, relativePath);
    return this.fsManager.deleteFile(safePath);
  }

  /**
   * Rename file or directory
   */
  async rename(oldPath, newPath) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safeOldPath = this.fsManager.getPluginFilePath(this.currentPluginId, oldPath);
    const safeNewPath = this.fsManager.getPluginFilePath(this.currentPluginId, newPath);
    return this.fsManager.renameFile(safeOldPath, safeNewPath);
  }

  /**
   * Copy file
   */
  async copy(source, destination) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safeSource = this.fsManager.getPluginFilePath(this.currentPluginId, source);
    const safeDest = this.fsManager.getPluginFilePath(this.currentPluginId, destination);
    return this.fsManager.copyFile(safeSource, safeDest);
  }

  /**
   * Get file stats
   */
  async stat(path) {
    if (!this.fsManager) {
      throw new Error('Filesystem not available');
    }

    const safePath = this.fsManager.getPluginFilePath(this.currentPluginId, path);
    return this.fsManager.stat(safePath);
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
    // Import the command registry singleton
    this._importCommandRegistry();
  }

  /**
   * Dynamically import the command registry
   */
  async _importCommandRegistry() {
    try {
      const { commandRegistry } = await import('../registry/CommandRegistry.js');
      this.commandRegistry = commandRegistry;
    } catch (error) {
      // Fallback if registry not available
      this.commandRegistry = null;
    }
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
      // Map 'execute' to 'handler' for command registry
      if (commands[0].execute && !commands[0].handler) {
        commands[0].handler = commands[0].execute;
      }
    }

    const commandList = Array.isArray(commands) ? commands : [commands];
    const registered = [];

    for (const command of commandList) {
      const { id, name, title, shortcut, execute, handler, description, category, icon, showInPalette, requiresEditor } = command;

      if (this.commands.has(id)) {
        throw new Error(`Command '${id}' already exists`);
      }

      // Map 'execute' to 'handler' if not present
      const commandHandler = handler || execute;
      if (!commandHandler) {
        throw new Error(`Command '${id}' must have a handler or execute function`);
      }

      const fullCommand = {
        id,
        name: name || title || id,
        title: title || name || id,
        shortcut,
        execute: commandHandler,
        handler: commandHandler,
        description,
        category,
        icon,
        showInPalette,
        requiresEditor,
        pluginId: this.currentPluginId
      };

      this.commands.set(id, fullCommand);

      // Register with legacy command manager
      if (this.commandManager) {
        this.commandManager.registerCommand(fullCommand);
      }

      // Register with new command registry
      if (this.commandRegistry) {
        this.commandRegistry.register(fullCommand);
      }

      registered.push(fullCommand);
      this.emit('command_registered', { id, command: fullCommand });
    }

    return new Disposable(() => {
      this.unregister(registered.map(c => c.id));
    });
  }

  /**
   * Execute a command by ID
   * @param {string} commandId - Command ID to execute
   * @param {...any} args - Arguments to pass to command
   * @returns {Promise<any>} Result of command execution
   */
  async execute(commandId, ...args) {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command '${commandId}' not found`);
    }
    try {
      const handler = command.handler || command.execute;
      return await handler(...args);
    } catch (error) {
      this.emit('command_error', { commandId, error });
      throw error;
    }
  }

  /**
   * Get all registered commands
   * @returns {Array} Array of all commands
   */
  getAll() {
    return Array.from(this.commands.values()).map(cmd => ({
      id: cmd.id,
      title: cmd.title || cmd.name,
      category: cmd.category,
      description: cmd.description,
      pluginId: cmd.pluginId,
      icon: cmd.icon,
      showInPalette: cmd.showInPalette
    }));
  }

  /**
   * Get commands by category
   * @param {string} category - Category to filter by
   * @returns {Array} Filtered commands
   */
  getByCategory(category) {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  /**
   * Check if a command exists
   * @param {string} commandId - Command ID to check
   * @returns {boolean} True if command exists
   */
  exists(commandId) {
    return this.commands.has(commandId);
  }

  /**
   * Register a command with palette visibility
   * @param {Object} command - Command definition
   * @returns {Object} Disposable
   */
  registerWithPalette(command) {
    return this.register({
      ...command,
      showInPalette: true
    });
  }

  /**
   * Register a text editor command
   * @param {Object} command - Command definition
   * @returns {Object} Disposable
   */
  registerTextEditorCommand(command) {
    return this.register({
      ...command,
      requiresEditor: true
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

      // Unregister from legacy command manager
      if (this.commandManager) {
        this.commandManager.unregisterCommand(id);
      }

      // Unregister from new command registry
      if (this.commandRegistry) {
        this.commandRegistry.unregister(id);
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
 * Implements StorageAPI interface with convenience methods
 */
export class DataAPI extends EventEmitter {
  constructor(dataManager) {
    super();
    this.dataManager = dataManager;
    this.databases = new Map();
    this._defaultDb = null;
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

  /**
   * Get the default database, creating if needed
   * Returns null if no dataManager available (triggers localStorage fallback)
   * @private
   */
  async _getDefaultDb() {
    if (this._defaultDb) {
      return this._defaultDb;
    }
    if (!this.dataManager) {
      return null; // Use localStorage fallback
    }
    try {
      this._defaultDb = await this.getDatabase('default');
      return this._defaultDb;
    } catch {
      return null; // Use localStorage fallback on error
    }
  }

  /**
   * Get a value from storage
   * @param {string} key - The key to retrieve
   * @returns {Promise<T | undefined>} The value or undefined if not found
   */
  async get(key) {
    const db = await this._getDefaultDb();
    if (db && typeof db.get === 'function') {
      return db.get(key);
    }
    // Fallback to localStorage for testing/simple cases
    try {
      const storageKey = `lokus_plugin_${this.currentPluginId}_${key}`;
      const value = localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Set a value in storage
   * @param {string} key - The key to set
   * @param {unknown} value - The value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const db = await this._getDefaultDb();
    if (db && typeof db.set === 'function') {
      return db.set(key, value);
    }
    // Fallback to localStorage for testing/simple cases
    const storageKey = `lokus_plugin_${this.currentPluginId}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  /**
   * Delete a value from storage
   * @param {string} key - The key to delete
   * @returns {Promise<void>}
   */
  async delete(key) {
    const db = await this._getDefaultDb();
    if (db && typeof db.delete === 'function') {
      return db.delete(key);
    }
    // Fallback to localStorage for testing/simple cases
    const storageKey = `lokus_plugin_${this.currentPluginId}_${key}`;
    localStorage.removeItem(storageKey);
  }

  /**
   * Get all keys in storage
   * @returns {Promise<string[]>} Array of all keys
   */
  async keys() {
    const db = await this._getDefaultDb();
    if (db && typeof db.keys === 'function') {
      return db.keys();
    }
    // Fallback to localStorage for testing/simple cases
    const prefix = `lokus_plugin_${this.currentPluginId}_`;
    const keys = [];
    // Use Object.keys for better test environment compatibility
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
    return keys;
  }

  /**
   * Clear all values from storage
   * @returns {Promise<void>}
   */
  async clear() {
    const db = await this._getDefaultDb();
    if (db && typeof db.clear === 'function') {
      return db.clear();
    }
    // Fallback to localStorage for testing/simple cases
    const prefix = `lokus_plugin_${this.currentPluginId}_`;
    // Use Object.keys for better test environment compatibility
    const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    keysToRemove.forEach(key => localStorage.removeItem(key));
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

    // Use singleton managers if not provided
    const terminalMgr = managers.terminal || terminalManager;
    const outputChannelMgr = managers.outputChannel || outputChannelManager;

    // Initialize sub-APIs (pass 'this' to APIs that need permission checking)
    this.editor = new EditorAPI();
    this.notifications = new NotificationsAPI(managers.notifications); // Moved up to be available for UI
    this.ui = new UIAPI(managers.ui, this.notifications, outputChannelMgr);
    this.fs = new FilesystemAPI(managers.filesystem); // Renamed from filesystem
    this.commands = new CommandsAPI(managers.commands);
    this.network = new NetworkAPI(managers.network, this);
    this.storage = new DataAPI(managers.data); // Renamed from data

    // New APIs (Placeholders/TODOs)
    this.workspace = new WorkspaceAPI(managers.workspace); // TODO: Implement WorkspaceAPI
    this.tasks = new TaskAPI(managers.tasks);
    this.debug = new DebugAPI(managers.debug);
    this.languages = new LanguagesAPI(managers.languages);
    this.themes = new ThemeAPI(managers.themes);
    this.config = new ConfigurationAPI(managers.configuration); // TODO: Implement ConfigurationAPI
    this.terminal = new TerminalAPI(terminalMgr);

    // Legacy/Runtime-specific APIs (kept for backward compat or internal use)
    this.clipboard = new ClipboardAPI();

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
      this.workspace, this.tasks, this.debug, this.themes
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
    this.ui.removeAllTreeProviders(pluginId);
    this.ui.removeAllStatusItems(pluginId);
    this.ui.removeAllWebviews(pluginId);
    this.ui.removeAllMenus(pluginId);
    this.ui.removeAllToolbars(pluginId);
    this.ui.removeAllOutputChannels(pluginId);
    this.commands.unregisterAll(pluginId);
    this.notifications.hideAll(pluginId);

    if (this.terminal && typeof this.terminal.cleanupPlugin === 'function') {
      this.terminal.cleanupPlugin(pluginId);
    }

    if (this.tasks && typeof this.tasks.cleanupPlugin === 'function') {
      this.tasks.cleanupPlugin(pluginId);
    }

    if (this.debug && typeof this.debug.cleanupPlugin === 'function') {
      this.debug.cleanupPlugin(pluginId);
    }

    if (this.languages && typeof this.languages.unregisterAll === 'function') {
      this.languages.unregisterAll(pluginId);
    }

    if (this.themes && typeof this.themes.unregisterAll === 'function') {
      this.themes.unregisterAll(pluginId);
    }

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