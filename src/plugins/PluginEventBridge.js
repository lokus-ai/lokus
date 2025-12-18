/**
 * PluginEventBridge - Centralized Event Routing for Plugin System
 *
 * Routes plugin API events to their appropriate handlers throughout the app.
 * This bridge connects plugin-emitted events to UI components and managers.
 *
 * Architecture:
 * - Plugin APIs emit events (e.g., 'show-notification', 'webview-registered')
 * - PluginEventBridge subscribes to these events during initialization
 * - Events are forwarded to appropriate handlers (UIManager, toast, etc.)
 * - Provides a single point of event management for debugging and logging
 *
 * @class PluginEventBridge
 */

import { EventEmitter } from '../utils/EventEmitter.js';

class PluginEventBridge extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
    this.initialized = false;
    this.pluginAPI = null;
  }

  /**
   * Initialize with plugin API reference
   * Call this after plugin system is ready
   * @param {LokusPluginAPI} pluginAPI - The main plugin API instance
   */
  initialize(pluginAPI) {
    if (this.initialized) {
      return;
    }

    this.pluginAPI = pluginAPI;

    // Subscribe to plugin events and route them
    this.setupNotificationEvents(pluginAPI);
    this.setupWebviewEvents(pluginAPI);
    this.setupMenuEvents(pluginAPI);
    this.setupToolbarEvents(pluginAPI);
    this.setupStatusBarEvents(pluginAPI);
    this.setupEditorEvents(pluginAPI);
    this.setupDialogEvents(pluginAPI);
    this.setupTerminalEvents(pluginAPI);
    this.setupOutputChannelEvents(pluginAPI);

    this.initialized = true;
  }

  /**
   * Setup notification event routing
   * Routes notification events to toast system via notificationsAPI
   */
  setupNotificationEvents(api) {
    // The NotificationsAPI.show() method already handles showing toasts
    // But we also listen for the deprecated 'show-notification' event
    if (api.ui) {
      api.ui.on('show-notification', ({ message, type, actions }) => {
        // Forward to notificationsAPI which will trigger toast
        if (api.notifications) {
          api.notifications.show({
            type: type || 'info',
            message,
            title: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Info'
          });
        }

        // Emit for other listeners that might want to handle actions
        if (actions && actions.length > 0) {
          this.emit('notification-with-actions', { message, type, actions });
        }
      });

      // Also listen for notification-with-actions variant
      api.ui.on('show-notification-with-actions', (data) => {
        this.emit('notification-with-actions', data);
      });
    }
  }

  /**
   * Setup webview event routing
   * Stores webview registrations for future rendering
   */
  setupWebviewEvents(api) {
    if (!api.ui) return;

    api.ui.on('webview-registered', (data) => {
      console.log('[PluginEventBridge] Webview registered:', data.panelId);
      this.emit('webview-registered', data);
      // Future: render in dedicated webview container
      // For now, just store and forward the event
    });

    api.ui.on('webview-disposed', (data) => {
      console.log('[PluginEventBridge] Webview disposed:', data.panelId);
      this.emit('webview-disposed', data);
    });

    api.ui.on('webview-post-message', (data) => {
      this.emit('webview-post-message', data);
    });
  }

  /**
   * Setup menu event routing
   * Stores menu registrations for future dynamic menu system
   */
  setupMenuEvents(api) {
    if (!api.ui) return;

    api.ui.on('menu-registered', (data) => {
      console.log('[PluginEventBridge] Menu registered:', data.menuId);
      this.emit('menu-registered', data);
      // Future: integrate with app menu system
    });

    api.ui.on('menu-unregistered', (data) => {
      console.log('[PluginEventBridge] Menu unregistered:', data.menuId);
      this.emit('menu-unregistered', data);
    });
  }

  /**
   * Setup toolbar event routing
   * Stores toolbar registrations for future toolbar system
   */
  setupToolbarEvents(api) {
    if (!api.ui) return;

    api.ui.on('toolbar-registered', (data) => {
      console.log('[PluginEventBridge] Toolbar registered:', data.toolbarId);
      this.emit('toolbar-registered', data);
      // Future: render toolbar items in editor or app toolbar
    });

    api.ui.on('toolbar-unregistered', (data) => {
      console.log('[PluginEventBridge] Toolbar unregistered:', data.toolbarId);
      this.emit('toolbar-unregistered', data);
    });
  }

  /**
   * Setup status bar event routing
   * Already handled by usePluginStatusItems, but we log for debugging
   */
  setupStatusBarEvents(api) {
    if (!api.ui) return;

    // These events are already handled by usePluginStatusItems.js
    // We just forward them for any additional listeners
    api.ui.on('status-bar-item-created', (data) => {
      this.emit('status-bar-item-created', data);
    });

    api.ui.on('status-bar-item-updated', (data) => {
      this.emit('status-bar-item-updated', data);
    });

    api.ui.on('status-bar-item-removed', (data) => {
      this.emit('status-bar-item-removed', data);
    });
  }

  /**
   * Setup editor event routing
   * Routes editor extension registration events
   */
  setupEditorEvents(api) {
    if (!api.editor) return;

    api.editor.on('extension_added', (data) => {
      console.log('[PluginEventBridge] Editor extension added:', data.name);
      this.emit('editor-extension-registered', data);
    });

    api.editor.on('extension_removed', (data) => {
      console.log('[PluginEventBridge] Editor extension removed:', data.extensionId);
      this.emit('editor-extension-removed', data);
    });

    api.editor.on('slash_command_added', (data) => {
      console.log('[PluginEventBridge] Slash command added:', data.name);
      this.emit('editor-slash-command-added', data);
    });

    api.editor.on('toolbar_item_added', (data) => {
      console.log('[PluginEventBridge] Editor toolbar item added:', data.id);
      this.emit('editor-toolbar-item-added', data);
    });

    api.editor.on('context_menu_item_added', (data) => {
      console.log('[PluginEventBridge] Context menu item added:', data.id);
      this.emit('editor-context-menu-item-added', data);
    });
  }

  /**
   * Setup dialog event routing
   * Dialogs are already handled by UIManager.showDialog()
   */
  setupDialogEvents(api) {
    if (!api.ui) return;

    // Forward dialog events for any additional listeners
    api.ui.on('show-dialog', (data) => {
      this.emit('show-dialog', data);
    });

    api.ui.on('show-quick-pick', (data) => {
      this.emit('show-quick-pick', data);
    });
  }

  /**
   * Setup terminal event routing
   * Routes terminal events for future terminal integration
   */
  setupTerminalEvents(api) {
    if (!api.ui) return;

    api.ui.on('terminal-created', (data) => {
      console.log('[PluginEventBridge] Terminal created:', data.terminal.id);
      this.emit('terminal-created', data);
    });

    api.ui.on('terminal-send-text', (data) => {
      this.emit('terminal-send-text', data);
    });

    api.ui.on('terminal-show', (data) => {
      this.emit('terminal-show', data);
    });

    api.ui.on('terminal-hide', (data) => {
      this.emit('terminal-hide', data);
    });

    api.ui.on('terminal-dispose', (data) => {
      this.emit('terminal-dispose', data);
    });
  }

  /**
   * Setup output channel event routing
   * Routes output channel events for future output panel
   */
  setupOutputChannelEvents(api) {
    if (!api.ui) return;

    api.ui.on('output-channel-update', (data) => {
      this.emit('output-channel-update', data);
    });

    api.ui.on('output-channel-show', (data) => {
      console.log('[PluginEventBridge] Output channel show:', data.name);
      this.emit('output-channel-show', data);
    });

    api.ui.on('output-channel-hide', (data) => {
      this.emit('output-channel-hide', data);
    });

    api.ui.on('output-channel-dispose', (data) => {
      this.emit('output-channel-dispose', data);
    });
  }

  /**
   * Get event statistics for debugging
   * @returns {Object} Statistics about registered events and listeners
   */
  getStats() {
    const stats = {
      initialized: this.initialized,
      totalEventTypes: this.eventNames().length,
      events: {}
    };

    for (const eventName of this.eventNames()) {
      stats.events[eventName] = this.listenerCount(eventName);
    }

    return stats;
  }

  /**
   * Cleanup and reset the bridge
   */
  cleanup() {
    this.removeAllListeners();
    this.handlers.clear();
    this.initialized = false;
    this.pluginAPI = null;
  }
}

// Export singleton instance
export const pluginEventBridge = new PluginEventBridge();
