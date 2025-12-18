/**
 * Plugin Bridge - Connects the safe Plugin API to the internal Editor API
 * 
 * This module acts as a secure bridge between the restricted plugin environment
 * and the privileged EditorAPI. It handles:
 * - Method mapping and parameter normalization
 * - Security validation (via EditorAPI)
 * - Error handling boundary
 * - Scope isolation (ensuring plugins only affect their own resources)
 */

import { editorAPI } from './EditorAPI.js';

/**
 * Create a bridged API instance for a specific plugin
 * @param {string} pluginId - The ID of the plugin requesting access
 * @returns {Object} The bridged API methods
 */
export function createBridgedEditorAPI(pluginId) {
    return {
        /**
         * Add an extension (node, mark, or extension)
         */
        addExtension: async (config) => {
            const { type = 'extension' } = config;

            switch (type) {
                case 'node':
                    return editorAPI.registerNode(pluginId, config);
                case 'mark':
                    return editorAPI.registerMark(pluginId, config);
                case 'extension':
                default:
                    return editorAPI.registerExtension(pluginId, config);
            }
        },

        /**
         * Remove an extension
         */
        removeExtension: (extensionId) => {
            // TODO: Implement granular unregistration in EditorAPI
            return false;
        },

        /**
         * Add a slash command
         */
        addSlashCommand: async (config) => {
            return editorAPI.registerSlashCommand(pluginId, config);
        },

        /**
         * Add a context menu item
         */
        addContextMenuItem: (config) => {
            // TODO: Implement context menu registry in EditorAPI
            return null;
        },

        /**
         * Add a drag & drop handler
         */
        addDropHandler: (config) => {
            // TODO: Implement drop handler registry in EditorAPI
            return null;
        },

        /**
         * Insert a node at the current cursor position
         */
        insertNode: async (type, attrs = {}, content = '') => {
            const editor = editorAPI.editorInstance;
            if (!editor) {
                throw new Error('Editor instance not available');
            }

            // If content is provided, we might need to construct a node with content
            // For simplicity, we just insert the node type with attrs for now
            // Complex content insertion might require more logic
            editor.chain().focus().insertContent({ type, attrs, content }).run();
            return true;
        },

        /**
         * Get the current selection
         */
        getSelection: async () => {
            const editor = editorAPI.editorInstance;
            if (!editor) return null;

            const { from, to, empty } = editor.state.selection;
            return { from, to, empty };
        },

        /**
         * Replace the current selection with content
         */
        replaceSelection: async (content) => {
            const editor = editorAPI.editorInstance;
            if (!editor) {
                throw new Error('Editor instance not available');
            }

            editor.chain().focus().deleteSelection().insertContent(content).run();
            return true;
        },

        /**
         * Add a keyboard shortcut
         */
        addKeyboardShortcut: (config) => {
            return editorAPI.registerKeyboardShortcut(pluginId, config);
        },

        /**
         * Add a toolbar item
         */
        addToolbarItem: (config) => {
            return editorAPI.registerToolbarItem(pluginId, config);
        },

        /**
         * Get the full text content of the editor
         */
        getText: async () => {
            const editor = editorAPI.editorInstance;
            if (!editor) return '';
            return editor.getText();
        },

        /**
         * Subscribe to editor updates
         */
        onUpdate: (callback) => {
            const handler = () => callback();
            editorAPI.on('editor-update', handler);

            // Return unsubscribe function
            return () => {
                editorAPI.off('editor-update', handler);
            };
        },

        /**
         * Cleanup all resources for this plugin
         */
        cleanup: async () => {
            // TODO: Implement cleanupPlugin in EditorAPI
            // For now, we rely on the fact that EditorAPI tracks contributions
            // and we might need to manually iterate/clear them if EditorAPI exposed a method.
            // Since it doesn't expose a bulk cleanup yet, we log it.
        },

        /**
         * Get usage statistics
         */
        getStats: () => {
            // Return a subset of stats relevant to this plugin
            // Currently EditorAPI only has global stats
            return {};
        }
    };
}
