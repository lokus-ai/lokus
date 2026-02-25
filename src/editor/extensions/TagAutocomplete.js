/**
 * Tag Autocomplete Plugin
 * Provides tag suggestions when typing #
 */

import { createSuggestionPlugin, PluginKey } from '../lib/suggestion-plugin.js';
import { ReactPopup } from '../lib/react-pm-helpers.jsx';
import TagSuggestionList from '../components/TagSuggestionList.jsx';
import tagManager from '../../core/tags/tag-manager.js';

const TAG_SUGGESTION_KEY = new PluginKey('tagSuggestion');

/**
 * Create the tag autocomplete suggestion plugin.
 *
 * @param {import('prosemirror-view').EditorView} view - The ProseMirror EditorView
 * @returns {import('prosemirror-state').Plugin}
 */
export function createTagAutocompletePlugin(view) {
  return createSuggestionPlugin({
    pluginKey: TAG_SUGGESTION_KEY,
    editor: view,
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

      // Don't show tag suggestions in headings -- # is heading syntax
      if (nodeType === 'heading') {
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
    command: ({ editor: editorView, range, props }) => {
      // Delete the # and query text, then insert the tag
      const { state } = editorView;
      const { schema, tr } = state;

      tr.delete(range.from, range.to);
      const insertPos = tr.mapping.map(range.from);
      tr.insertText(`#${props.label}`, insertPos);
      tr.scrollIntoView();

      editorView.dom.focus({ preventScroll: true });
      editorView.dispatch(tr);
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
          component = new ReactPopup(TagSuggestionList, props);

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
  });
}

export default createTagAutocompletePlugin;
