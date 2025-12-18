/**
 * Plugin Completion Extension
 * Wires plugin-registered completion providers to TipTap editor
 */

import { Extension } from '@tiptap/core';
import * as suggestionMod from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { editorAPI } from '../../plugins/api/EditorAPI.js';
import PluginCompletionList from '../components/PluginCompletionList.jsx';

const suggestion = suggestionMod.default ?? suggestionMod;
const PLUGIN_COMPLETION_KEY = new PluginKey('pluginCompletion');

const PluginCompletion = Extension.create({
  name: 'pluginCompletion',

  addProseMirrorPlugins() {
    return [
      suggestion({
        pluginKey: PLUGIN_COMPLETION_KEY,
        editor: this.editor,

        // Dynamic trigger character detection
        char: '', // We'll handle triggers manually
        allowSpaces: true,
        startOfLine: false,

        // Check if we should show completions
        allow: ({ state, range }) => {
          // Get all completion providers
          const providers = editorAPI.getProviders('completion');
          if (providers.length === 0) return false;

          // Get text before cursor
          const $from = state.doc.resolve(range.from);
          const textBefore = state.doc.textBetween(
            Math.max(0, range.from - 50),
            range.from
          );

          // Check if any provider's trigger characters match
          for (const reg of providers) {
            if (!reg.triggerCharacters || reg.triggerCharacters.length === 0) {
              continue;
            }

            // Check if text before cursor ends with a trigger character
            for (const char of reg.triggerCharacters) {
              if (textBefore.endsWith(char)) {
                return true;
              }
            }
          }

          return false;
        },

        // Get completion items from all registered providers
        items: async ({ query, editor }) => {
          const providers = editorAPI.getProviders('completion');
          if (providers.length === 0) return [];

          const { state } = editor;
          const $from = state.selection.$from;

          // Create TextDocument adapter
          const document = editorAPI._createDocumentAdapter(state);

          // Get cursor position
          const position = editorAPI._offsetToPosition(state.selection.from);

          // Collect items from all providers
          let allItems = [];

          for (const reg of providers) {
            try {
              // Check if provider matches current document selector
              if (reg.selector && typeof reg.selector === 'string') {
                // Simple language ID check
                if (reg.selector !== 'markdown' && reg.selector !== '*') {
                  continue;
                }
              }

              // Call provider's provideCompletionItems
              const items = await reg.provider.provideCompletionItems(
                document,
                position,
                { triggerKind: 1, triggerCharacter: undefined }
              );

              if (items && Array.isArray(items)) {
                // Add provider ID to each item for tracking
                const itemsWithProvider = items.map(item => ({
                  ...item,
                  _providerId: reg.id,
                  _pluginId: reg.pluginId
                }));
                allItems.push(...itemsWithProvider);
              }
            } catch (error) {
              console.error('Plugin completion provider error:', error);
            }
          }

          // Filter by query if provided
          if (query) {
            const queryLower = query.toLowerCase();
            allItems = allItems.filter(item => {
              const label = typeof item.label === 'string' ? item.label : item.label?.label || '';
              const filterText = item.filterText || label;
              return filterText.toLowerCase().includes(queryLower);
            });
          }

          // Sort by sortText or label
          allItems.sort((a, b) => {
            const aSort = a.sortText || (typeof a.label === 'string' ? a.label : a.label?.label || '');
            const bSort = b.sortText || (typeof b.label === 'string' ? b.label : b.label?.label || '');
            return aSort.localeCompare(bSort);
          });

          return allItems;
        },

        // Handle completion item selection
        command: ({ editor, range, props }) => {
          // Get the completion item
          const item = props;

          // Get insert text
          let insertText = '';
          if (item.insertText) {
            insertText = typeof item.insertText === 'string'
              ? item.insertText
              : item.insertText.value;
          } else {
            insertText = typeof item.label === 'string' ? item.label : item.label?.label || '';
          }

          // Delete the trigger character and query
          editor
            .chain()
            .focus()
            .deleteRange({
              from: range.from,
              to: range.to
            })
            .insertContent(insertText)
            .run();
        },

        // Render suggestion dropdown
        render: () => {
          let component;
          let container;

          const place = (rect) => {
            if (!container || !rect) return;

            const dialogWidth = 350;
            const padding = 16;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate initial position
            let left = rect.left;
            let top = rect.bottom + 6;

            // Check right edge overflow
            if (left + dialogWidth + padding > viewportWidth) {
              left = viewportWidth - dialogWidth - padding;
            }

            // Check left edge
            if (left < padding) {
              left = padding;
            }

            // Get container height for bottom edge check
            const containerHeight = container.offsetHeight || 300;

            // Check bottom edge overflow - position above cursor if needed
            if (top + containerHeight + padding > viewportHeight) {
              top = rect.top - containerHeight - 6;
              if (top < padding) {
                top = padding;
              }
            }

            container.style.left = `${left}px`;
            container.style.top = `${top}px`;
            container.style.width = `${dialogWidth}px`;
          };

          return {
            onStart: (props) => {
              // Create React component
              component = new ReactRenderer(PluginCompletionList, {
                props,
                editor: props.editor
              });

              // Create container
              container = document.createElement('div');
              container.style.position = 'fixed';
              container.style.zIndex = '2147483647';
              container.style.pointerEvents = 'auto';
              container.style.maxHeight = '60vh';
              container.style.overflow = 'hidden';
              container.appendChild(component.element);
              document.body.appendChild(container);

              // Position it
              if (props.clientRect) {
                place(props.clientRect());
              }
            },

            onUpdate: (props) => {
              if (component) {
                component.updateProps(props);
              }

              if (props.clientRect) {
                place(props.clientRect());
              }
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                if (container?.parentNode) {
                  container.parentNode.removeChild(container);
                }
                container = null;
                return true;
              }

              // Guard against null component
              if (!component || !component.ref) {
                return false;
              }

              return component.ref.onKeyDown(props);
            },

            onExit: () => {
              try {
                if (container?.parentNode) {
                  container.parentNode.removeChild(container);
                }
              } catch (e) {
                // Ignore cleanup errors
              }

              container = null;

              // Only destroy component if it exists
              if (component?.destroy) {
                component.destroy();
              }
              component = null;
            }
          };
        }
      })
    ];
  }
});

export default PluginCompletion;
