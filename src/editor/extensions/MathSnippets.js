/**
 * MathSnippets Extension
 *
 * Provides math snippet insertion with tab-stop placeholders.
 * Uses :shortcode: syntax (e.g., :mat2: for 2x2 matrix)
 *
 * Features:
 * - Tab-stop placeholders like VS Code snippets
 * - Tab/Shift+Tab to navigate between placeholders
 * - Escape to exit snippet mode
 * - Auto-wraps in $ for inline math
 */

import { Extension } from '@tiptap/core';
import { InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { mathSnippets } from '../lib/math-snippets-data';

export const MathSnippetsPluginKey = new PluginKey('mathSnippets');

/**
 * Parse template string for placeholders
 * Format: ${n:default} where n is the tab order
 * Returns { text: string, placeholders: [{index, start, end, defaultText}] }
 */
function parseTemplate(template) {
  const placeholders = [];
  let result = '';
  let i = 0;
  let offset = 0;

  // Regex to match ${n:text} or ${n}
  const placeholderRegex = /\$\{(\d+)(?::([^}]*))?\}/g;
  let match;
  let lastEnd = 0;

  while ((match = placeholderRegex.exec(template)) !== null) {
    // Add text before this placeholder
    result += template.substring(lastEnd, match.index);

    const index = parseInt(match[1], 10);
    const defaultText = match[2] || '';
    const start = result.length;

    result += defaultText;
    const end = result.length;

    placeholders.push({
      index,
      start,
      end,
      defaultText,
    });

    lastEnd = match.index + match[0].length;
  }

  // Add remaining text
  result += template.substring(lastEnd);

  // Sort placeholders by index
  placeholders.sort((a, b) => a.index - b.index);

  return { text: result, placeholders };
}

/**
 * Create decorations for placeholders
 */
function createPlaceholderDecorations(placeholders, basePos, activeIndex) {
  const decorations = [];

  placeholders.forEach((p, i) => {
    const from = basePos + p.start;
    const to = basePos + p.end;

    // Different style for active placeholder
    const className = i === activeIndex
      ? 'math-snippet-placeholder math-snippet-placeholder-active'
      : 'math-snippet-placeholder';

    decorations.push(
      Decoration.inline(from, to, {
        class: className,
        'data-placeholder-index': String(i),
      })
    );
  });

  return decorations;
}

export const MathSnippets = Extension.create({
  name: 'mathSnippets',

  addOptions() {
    return {
      // Custom snippets can be added here
      customSnippets: {},
    };
  },

  addStorage() {
    return {
      // Active snippet state
      active: false,
      placeholders: [],
      currentIndex: 0,
      basePos: 0,
    };
  },

  addCommands() {
    return {
      // Navigate to next placeholder
      nextPlaceholder: () => ({ editor, tr, dispatch }) => {
        const storage = this.storage;
        if (!storage.active || storage.placeholders.length === 0) {
          return false;
        }

        const nextIndex = (storage.currentIndex + 1) % storage.placeholders.length;

        // If we've cycled through all placeholders, exit snippet mode
        if (nextIndex === 0 && storage.currentIndex === storage.placeholders.length - 1) {
          storage.active = false;
          storage.placeholders = [];
          storage.currentIndex = 0;
          // Move cursor to end of snippet
          const lastP = storage.placeholders[storage.placeholders.length - 1];
          if (lastP) {
            const endPos = storage.basePos + lastP.end;
            editor.commands.setTextSelection(endPos);
          }
          return true;
        }

        storage.currentIndex = nextIndex;
        const placeholder = storage.placeholders[nextIndex];

        if (placeholder) {
          const from = storage.basePos + placeholder.start;
          const to = storage.basePos + placeholder.end;
          editor.commands.setTextSelection({ from, to });
        }

        return true;
      },

      // Navigate to previous placeholder
      prevPlaceholder: () => ({ editor }) => {
        const storage = this.storage;
        if (!storage.active || storage.placeholders.length === 0) {
          return false;
        }

        const prevIndex = storage.currentIndex === 0
          ? storage.placeholders.length - 1
          : storage.currentIndex - 1;

        storage.currentIndex = prevIndex;
        const placeholder = storage.placeholders[prevIndex];

        if (placeholder) {
          const from = storage.basePos + placeholder.start;
          const to = storage.basePos + placeholder.end;
          editor.commands.setTextSelection({ from, to });
        }

        return true;
      },

      // Exit snippet mode
      exitSnippetMode: () => ({ editor }) => {
        const storage = this.storage;
        storage.active = false;
        storage.placeholders = [];
        storage.currentIndex = 0;
        return true;
      },

      // Insert a math snippet by name
      insertMathSnippet: (snippetName) => ({ editor, chain }) => {
        const allSnippets = { ...mathSnippets, ...this.options.customSnippets };
        const snippet = allSnippets[snippetName];

        if (!snippet) {
          return false;
        }

        const { text, placeholders } = parseTemplate(snippet.template);
        const pos = editor.state.selection.from;

        // Insert the snippet text
        chain().insertContent(text).run();

        // Set up placeholder tracking
        if (placeholders.length > 0) {
          const storage = this.storage;
          storage.active = true;
          storage.placeholders = placeholders;
          storage.currentIndex = 0;
          storage.basePos = pos;

          // Select first placeholder
          const firstP = placeholders[0];
          editor.commands.setTextSelection({
            from: pos + firstP.start,
            to: pos + firstP.end,
          });
        }

        return true;
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        // Match :word: pattern - same as SymbolShortcuts but check math snippets first
        find: /:([a-zA-Z][a-zA-Z0-9]*):$/,
        handler: ({ range, match, chain, state }) => {
          const word = match[1];
          const allSnippets = { ...mathSnippets, ...this.options.customSnippets };
          const snippet = allSnippets[word];

          if (!snippet) {
            // Not a math snippet, let SymbolShortcuts handle it
            return false;
          }

          // Check if we're inside a math context - either in a math node or typing after an unmatched $
          let template = snippet.template;
          const $pos = state.selection.$from;
          let insideMath = false;

          // Walk up the node tree to check if we're inside a math node
          for (let d = $pos.depth; d >= 0; d--) {
            const node = $pos.node(d);
            if (node.type.name === 'inlineMath' || node.type.name === 'math') {
              insideMath = true;
              break;
            }
          }

          // Also check if the parent node indicates math context
          if (!insideMath) {
            const parent = $pos.parent;
            if (parent && (parent.type.name === 'inlineMath' || parent.type.name === 'math')) {
              insideMath = true;
            }
          }

          // Check for unmatched $ in the current text node (user is typing inside $...$)
          if (!insideMath) {
            const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, null, '\ufffc');
            // Count $ signs - odd number means we're inside a math expression
            const dollarCount = (textBefore.match(/\$/g) || []).length;
            if (dollarCount % 2 === 1) {
              insideMath = true;
            }
          }

          // If inside math, strip the outer $ or $$ delimiters from the template
          if (insideMath) {
            // Remove leading $$ or $
            if (template.startsWith('$$')) {
              template = template.slice(2);
            } else if (template.startsWith('$')) {
              template = template.slice(1);
            }
            // Remove trailing $$ or $
            if (template.endsWith('$$')) {
              template = template.slice(0, -2);
            } else if (template.endsWith('$')) {
              template = template.slice(0, -1);
            }
          }

          const { text, placeholders } = parseTemplate(template);
          const insertPos = range.from;

          // Delete the trigger text and insert snippet
          chain()
            .deleteRange(range)
            .insertContent(text)
            .run();

          // Set up placeholder tracking
          if (placeholders.length > 0) {
            const storage = this.storage;
            storage.active = true;
            storage.placeholders = placeholders;
            storage.currentIndex = 0;
            storage.basePos = insertPos;

            // We need to select the first placeholder after the transaction
            // Use setTimeout to ensure the content is inserted first
            setTimeout(() => {
              const firstP = placeholders[0];
              const editor = this.editor;
              if (editor && firstP) {
                editor.commands.setTextSelection({
                  from: insertPos + firstP.start,
                  to: insertPos + firstP.end,
                });
              }
            }, 0);
          }

          return true;
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Tab: next placeholder (only when snippet is active)
      Tab: ({ editor }) => {
        if (!this.storage.active) {
          return false; // Let default Tab behavior happen
        }
        return editor.commands.nextPlaceholder();
      },

      // Shift+Tab: previous placeholder
      'Shift-Tab': ({ editor }) => {
        if (!this.storage.active) {
          return false;
        }
        return editor.commands.prevPlaceholder();
      },

      // Escape: exit snippet mode
      Escape: ({ editor }) => {
        if (!this.storage.active) {
          return false;
        }
        return editor.commands.exitSnippetMode();
      },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: MathSnippetsPluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, oldDecorations) {
            const storage = extension.storage;

            // If no active snippet, clear decorations
            if (!storage.active || storage.placeholders.length === 0) {
              return DecorationSet.empty;
            }

            // Create decorations for placeholders
            const decorations = createPlaceholderDecorations(
              storage.placeholders,
              storage.basePos,
              storage.currentIndex
            );

            return DecorationSet.create(tr.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },

  // Watch for cursor movement outside placeholders to exit snippet mode
  onSelectionUpdate({ editor }) {
    const storage = this.storage;
    if (!storage.active) return;

    const { from, to } = editor.state.selection;

    // Check if cursor is still within any placeholder
    const inPlaceholder = storage.placeholders.some(p => {
      const pFrom = storage.basePos + p.start;
      const pTo = storage.basePos + p.end;
      return from >= pFrom && to <= pTo;
    });

    // Also check if cursor is near the snippet (within reasonable bounds)
    const firstP = storage.placeholders[0];
    const lastP = storage.placeholders[storage.placeholders.length - 1];
    if (firstP && lastP) {
      const snippetStart = storage.basePos + firstP.start;
      const snippetEnd = storage.basePos + lastP.end;
      const nearSnippet = from >= snippetStart - 5 && to <= snippetEnd + 5;

      if (!nearSnippet && !inPlaceholder) {
        // Cursor moved outside snippet area, exit snippet mode
        storage.active = false;
        storage.placeholders = [];
        storage.currentIndex = 0;
      }
    }
  },

  // Update placeholder positions when content changes
  onUpdate({ editor, transaction }) {
    const storage = this.storage;
    if (!storage.active) return;

    // If there was a text change, update placeholder positions
    if (transaction.docChanged) {
      // For simplicity, we'll recalculate based on document changes
      // This handles the case where user types to replace placeholder text

      // Get the mapping from old positions to new
      const mapping = transaction.mapping;

      // Update basePos
      storage.basePos = mapping.map(storage.basePos);

      // Check if the snippet area is still valid
      const firstP = storage.placeholders[0];
      if (firstP) {
        const newStart = mapping.map(storage.basePos + firstP.start);
        // If mapping failed significantly, exit snippet mode
        if (Math.abs(newStart - (storage.basePos + firstP.start)) > 100) {
          storage.active = false;
          storage.placeholders = [];
          storage.currentIndex = 0;
        }
      }
    }
  },
});

// Export for use in other components
export { mathSnippets };

export default MathSnippets;
