/**
 * Tag Autocomplete Extension
 * Provides tag suggestions when typing #
 */

import { Extension } from '@tiptap/core';
import * as suggestionMod from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import TagSuggestionList from '../components/TagSuggestionList.jsx';
import tagManager from '../../core/tags/tag-manager.js';

const suggestion = suggestionMod.default ?? suggestionMod;
const TAG_SUGGESTION_KEY = new PluginKey('tagSuggestion');

const TagAutocomplete = Extension.create({
  name: 'tagAutocomplete',

  addProseMirrorPlugins() {
    return [
      suggestion({
        pluginKey: TAG_SUGGESTION_KEY,
        editor: this.editor,
        char: '#',
        allowSpaces: false,
        startOfLine: false,

        // Allow tag suggestions anywhere except in code blocks
        allow: ({ state, range }) => {
          // Check if we're in a code block
          const $from = state.doc.resolve(range.from);
          const nodeType = $from.parent.type.name;

          // Don't show suggestions in code blocks or inline code
          if (nodeType === 'codeBlock' || nodeType === 'code') {
            return false;
          }

          // Check for backticks (inline code)
          const textBefore = state.doc.textBetween(
            Math.max(0, range.from - 20),
            range.from
          );

          // Count backticks - odd number means we're in inline code
          const backtickCount = (textBefore.match(/`/g) || []).length;
          if (backtickCount % 2 !== 0) {
            return false;
          }

          return true;
        },

        // Get tag suggestions based on query
        items: ({ query }) => {
          if (query.length === 0) {
            // Show most popular tags when no query
            return tagManager.getAllTags().slice(0, 10);
          }

          // Search tags matching query
          return tagManager.searchTags(query).slice(0, 15);
        },

        // Handle tag selection
        command: ({ editor, range, props }) => {
          // Delete the # and query text
          editor
            .chain()
            .focus()
            .deleteRange({
              from: range.from,
              to: range.to
            })
            .insertContent(`#${props.label}`)
            .run();
        },

        // Render suggestion dropdown
        render: () => {
          let component;
          let container;

          const place = (rect) => {
            if (!container || !rect) return;

            // Position below the cursor
            const left = Math.max(8, rect.left);
            const top = Math.min(
              window.innerHeight - 350,
              rect.bottom + 8
            );

            container.style.left = `${left}px`;
            container.style.top = `${top}px`;
          };

          return {
            onStart: (props) => {
              // Create React component
              component = new ReactRenderer(TagSuggestionList, {
                props,
                editor: props.editor
              });

              // Create container
              container = document.createElement('div');
              container.style.position = 'fixed';
              container.style.zIndex = '2147483647';
              container.style.pointerEvents = 'auto';
              container.appendChild(component.element);
              document.body.appendChild(container);

              // Position it
              if (props.clientRect) {
                place(props.clientRect());
              }
            },

            onUpdate: (props) => {
              component.updateProps(props);

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

              return component.ref?.onKeyDown(props);
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

export default TagAutocomplete;
