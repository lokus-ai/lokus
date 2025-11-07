/**
 * Plugin Bridge - Connects plugin API calls to the actual TipTap editor
 *
 * This bridge provides a secure, sandboxed interface for plugins to interact
 * with the TipTap editor without direct access to the editor instance.
 */

import { editorAPI } from './EditorAPI.js';

/**
 * Create a bridged editor API for a specific plugin
 *
 * This API is passed to plugins running in sandboxed workers and provides
 * safe access to editor functionality through the EditorPluginAPI.
 *
 * @param {string} pluginId - The unique identifier for the plugin
 * @returns {BridgedEditorAPI} - A bridged API object for the plugin
 */
export function createBridgedEditorAPI(pluginId) {
  return new BridgedEditorAPI(pluginId);
}

/**
 * BridgedEditorAPI - Safe editor API for plugin use
 *
 * This class wraps EditorPluginAPI methods to provide plugin-specific context
 * and ensure proper isolation between plugins.
 */
class BridgedEditorAPI {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.registeredExtensions = new Set();
    this.registeredCommands = new Set();
    this.registeredShortcuts = new Set();
    this.registeredToolbarItems = new Set();
  }

  // === EXTENSION MANAGEMENT ===

  /**
   * Add a TipTap extension (node, mark, or extension)
   *
   * @param {Object} config - Extension configuration
   * @param {string} config.name - Extension name
   * @param {string} config.type - Extension type ('node', 'mark', or 'extension')
   * @param {Object} config.schema - Extension schema definition
   * @param {Object} config.commands - Editor commands
   * @param {Object} config.inputRules - Input rules
   * @param {Object} config.keyboardShortcuts - Keyboard shortcuts
   * @returns {Promise<string>} - Extension ID
   */
  async addExtension(config) {
    try {
      const { name, type, ...extensionConfig } = config;

      if (!name || !type) {
        throw new Error('Extension name and type are required');
      }

      let extensionId;

      switch (type) {
        case 'node':
          extensionId = editorAPI.registerNode(this.pluginId, {
            name,
            ...extensionConfig
          });
          break;

        case 'mark':
          extensionId = editorAPI.registerMark(this.pluginId, {
            name,
            ...extensionConfig
          });
          break;

        case 'extension':
        default:
          extensionId = editorAPI.registerExtension(this.pluginId, {
            name,
            ...extensionConfig
          });
          break;
      }

      this.registeredExtensions.add(extensionId);
      return extensionId;
    } catch (error) {
      console.error(`[PluginBridge] Failed to add extension for ${this.pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Remove an extension
   *
   * @param {string} extensionId - ID of the extension to remove
   * @returns {boolean} - Success status
   */
  removeExtension(extensionId) {
    try {
      // Extensions are removed when the plugin is unregistered
      // Individual extension removal would require additional EditorAPI methods
      this.registeredExtensions.delete(extensionId);
      return true;
    } catch (error) {
      console.error(`[PluginBridge] Failed to remove extension ${extensionId}:`, error);
      return false;
    }
  }

  // === SLASH COMMANDS ===

  /**
   * Add a slash command
   *
   * @param {Object} config - Slash command configuration
   * @param {string} config.name - Command name
   * @param {string} config.description - Command description
   * @param {string} config.icon - Command icon
   * @param {string[]} config.aliases - Command aliases
   * @param {Function} config.execute - Command execution function
   * @returns {Promise<string>} - Command ID
   */
  async addSlashCommand(config) {
    try {
      const commandId = editorAPI.registerSlashCommand(this.pluginId, {
        id: config.name,
        title: config.name,
        description: config.description,
        icon: config.icon,
        keywords: config.aliases || [],
        handler: config.execute
      });

      this.registeredCommands.add(commandId);
      return commandId;
    } catch (error) {
      console.error(`[PluginBridge] Failed to add slash command for ${this.pluginId}:`, error);
      throw error;
    }
  }

  // === CONTEXT MENU ===

  /**
   * Add a context menu item
   *
   * @param {Object} config - Context menu item configuration
   * @returns {string} - Item ID
   */
  addContextMenuItem(config) {
    try {
      // Context menu items would need additional implementation in EditorAPI
      // For now, we'll store the configuration and emit an event
      const itemId = `${this.pluginId}.${config.id}`;

      editorAPI.emit('context-menu-item-registered', {
        pluginId: this.pluginId,
        itemId,
        config
      });

      return itemId;
    } catch (error) {
      console.error(`[PluginBridge] Failed to add context menu item for ${this.pluginId}:`, error);
      throw error;
    }
  }

  // === DRAG & DROP ===

  /**
   * Add a drag & drop handler
   *
   * @param {Object} config - Drop handler configuration
   * @param {string[]} config.accept - Accepted MIME types
   * @param {Function} config.handler - Drop handler function
   * @returns {string} - Handler ID
   */
  addDropHandler(config) {
    try {
      // Drop handlers would need additional implementation in EditorAPI
      const handlerId = `${this.pluginId}.drop.${Date.now()}`;

      editorAPI.emit('drop-handler-registered', {
        pluginId: this.pluginId,
        handlerId,
        config
      });

      return handlerId;
    } catch (error) {
      console.error(`[PluginBridge] Failed to add drop handler for ${this.pluginId}:`, error);
      throw error;
    }
  }

  // === EDITOR OPERATIONS ===

  /**
   * Insert a node at the current cursor position
   *
   * @param {string} type - Node type
   * @param {Object} attrs - Node attributes
   * @param {string} content - Node content
   * @returns {Promise<boolean>} - Success status
   */
  async insertNode(type, attrs = {}, content = '') {
    try {
      const editor = editorAPI.editorInstance;
      if (!editor) {
        throw new Error('Editor instance not available');
      }

      // Insert the node using TipTap's chain commands
      const result = editor
        .chain()
        .focus()
        .insertContent({
          type,
          attrs,
          content: content ? [{ type: 'text', text: content }] : undefined
        })
        .run();

      return result;
    } catch (error) {
      console.error(`[PluginBridge] Failed to insert node for ${this.pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get the current selection
   *
   * @returns {Promise<Object|null>} - Selection object with from, to, and text
   */
  async getSelection() {
    try {
      const editor = editorAPI.editorInstance;
      if (!editor) {
        throw new Error('Editor instance not available');
      }

      const { selection } = editor.state;
      const { from, to } = selection;
      const text = editor.state.doc.textBetween(from, to);

      return {
        from,
        to,
        text,
        empty: selection.empty
      };
    } catch (error) {
      console.error(`[PluginBridge] Failed to get selection for ${this.pluginId}:`, error);
      return null;
    }
  }

  /**
   * Replace the current selection with content
   *
   * @param {string|Object} content - Content to insert (string or ProseMirror node)
   * @returns {Promise<boolean>} - Success status
   */
  async replaceSelection(content) {
    try {
      const editor = editorAPI.editorInstance;
      if (!editor) {
        throw new Error('Editor instance not available');
      }

      const result = editor
        .chain()
        .focus()
        .insertContent(content)
        .run();

      return result;
    } catch (error) {
      console.error(`[PluginBridge] Failed to replace selection for ${this.pluginId}:`, error);
      throw error;
    }
  }

  // === KEYBOARD SHORTCUTS ===

  /**
   * Add a keyboard shortcut
   *
   * @param {Object} config - Shortcut configuration
   * @param {string} config.key - Keyboard shortcut (e.g., 'Mod-b')
   * @param {Function} config.handler - Shortcut handler function
   * @param {string} config.description - Shortcut description
   * @returns {string} - Shortcut ID
   */
  addKeyboardShortcut(config) {
    try {
      const shortcutId = editorAPI.registerKeyboardShortcut(this.pluginId, {
        key: config.key,
        handler: config.handler,
        description: config.description
      });

      this.registeredShortcuts.add(shortcutId);
      return shortcutId;
    } catch (error) {
      console.error(`[PluginBridge] Failed to add keyboard shortcut for ${this.pluginId}:`, error);
      throw error;
    }
  }

  // === TOOLBAR ===

  /**
   * Add a toolbar item
   *
   * @param {Object} config - Toolbar item configuration
   * @param {string} config.id - Item ID
   * @param {string} config.title - Item title
   * @param {string} config.icon - Item icon
   * @param {string} config.group - Item group
   * @param {Function} config.handler - Click handler
   * @param {Function} config.isActive - Active state checker
   * @param {Function} config.isDisabled - Disabled state checker
   * @returns {string} - Item ID
   */
  addToolbarItem(config) {
    try {
      const itemId = editorAPI.registerToolbarItem(this.pluginId, {
        id: config.id,
        title: config.title,
        icon: config.icon,
        group: config.group || 'plugin',
        handler: config.handler,
        isActive: config.isActive,
        isDisabled: config.isDisabled
      });

      this.registeredToolbarItems.add(itemId);
      return itemId;
    } catch (error) {
      console.error(`[PluginBridge] Failed to add toolbar item for ${this.pluginId}:`, error);
      throw error;
    }
  }

  // === CLEANUP ===

  /**
   * Clean up all registrations for this plugin
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Unregister the plugin from EditorAPI
      // This will remove all its contributions
      editorAPI.unregisterPlugin(this.pluginId);

      // Clear local tracking
      this.registeredExtensions.clear();
      this.registeredCommands.clear();
      this.registeredShortcuts.clear();
      this.registeredToolbarItems.clear();
    } catch (error) {
      console.error(`[PluginBridge] Failed to cleanup for ${this.pluginId}:`, error);
    }
  }

  // === STATS ===

  /**
   * Get statistics about this plugin's registrations
   *
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      pluginId: this.pluginId,
      extensions: this.registeredExtensions.size,
      commands: this.registeredCommands.size,
      shortcuts: this.registeredShortcuts.size,
      toolbarItems: this.registeredToolbarItems.size
    };
  }
}

// Export for testing and direct use
export { BridgedEditorAPI };

export default {
  createBridgedEditorAPI,
  BridgedEditorAPI
};
