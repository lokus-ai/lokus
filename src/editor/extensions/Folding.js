import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const FoldingPluginKey = new PluginKey('folding');

/**
 * Folding Extension for TipTap Editor
 *
 * Features:
 * - Fold/unfold heading sections with visual indicators (▶/▼)
 * - Keyboard shortcuts: Cmd+Option+[ fold, Cmd+Option+] unfold, Cmd+Option+0 unfold all
 * - Persistent fold state per note (localStorage)
 * - Smooth animations via CSS transitions
 */
export const Folding = Extension.create({
  name: 'folding',

  addOptions() {
    return {
      storageKey: 'lokus-fold-state', // localStorage key prefix
    };
  },

  addStorage() {
    return {
      foldedSections: new Set(), // Set of heading positions that are folded
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    // Bind buildDecorations to the extension context
    const buildDecorations = (state) => {
      const decorations = [];
      const { doc } = state;
      const foldedSections = extension.storage.foldedSections;

      // Find all headings and add fold indicators
      const headings = [];
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({ level: node.attrs.level, pos });
        }
      });

      // Build fold decorations
      headings.forEach((heading, index) => {
        const { level, pos } = heading;
        const isFolded = foldedSections.has(pos);

        // Find the range of content to fold (until next heading of same or higher level)
        let endPos = doc.content.size;
        for (let i = index + 1; i < headings.length; i++) {
          if (headings[i].level <= level) {
            endPos = headings[i].pos;
            break;
          }
        }

        // Add fold indicator decoration
        const indicator = document.createElement('span');
        indicator.className = 'fold-indicator';
        indicator.dataset.pos = pos.toString();
        indicator.textContent = isFolded ? '▶' : '▼';
        indicator.style.cssText = `
          cursor: pointer;
          user-select: none;
          display: inline-block;
          width: 20px;
          height: 20px;
          margin-right: 4px;
          margin-left: -26px;
          color: rgb(var(--muted));
          font-size: 11px;
          line-height: 20px;
          text-align: center;
          transition: color 0.15s ease, transform 0.15s ease;
          pointer-events: auto;
          position: relative;
          z-index: 10;
        `;

        // Add direct click handler to the indicator
        indicator.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const clickPos = parseInt(indicator.dataset.pos, 10);
          if (!isNaN(clickPos) && extension.editor?.view) {
            extension.toggleFold(extension.editor.view, clickPos);
          }
        });

        // Add hover effect
        indicator.addEventListener('mouseenter', () => {
          indicator.style.color = 'rgb(var(--accent))';
          indicator.style.transform = 'scale(1.15)';
        });
        indicator.addEventListener('mouseleave', () => {
          indicator.style.color = 'rgb(var(--muted))';
          indicator.style.transform = 'scale(1)';
        });

        const indicatorDeco = Decoration.widget(pos, indicator, {
          side: -1,
          stopEvent: () => true, // Prevent ProseMirror from handling this event
        });
        decorations.push(indicatorDeco);

        // If folded, hide the content between this heading and the next
        if (isFolded && endPos > pos + 1) {
          const nodeAfterHeading = doc.nodeAt(pos);
          const headingSize = nodeAfterHeading ? nodeAfterHeading.nodeSize : 1;
          const foldStart = pos + headingSize;
          const foldEnd = endPos;

          if (foldEnd > foldStart) {
            // Add CSS class to hide folded content
            const foldDeco = Decoration.node(foldStart, foldEnd, {
              class: 'folded-content',
              style: 'display: none;',
            });
            decorations.push(foldDeco);
          }
        }
      });

      return DecorationSet.create(doc, decorations);
    };

    return [
      new Plugin({
        key: FoldingPluginKey,

        state: {
          init(_, state) {
            // Load folded sections from localStorage
            const filePath = globalThis.__LOKUS_ACTIVE_FILE__;
            if (filePath) {
              const storageKey = `${extension.options.storageKey}:${filePath}`;
              const stored = localStorage.getItem(storageKey);
              if (stored) {
                try {
                  const positions = JSON.parse(stored);
                  extension.storage.foldedSections = new Set(positions);
                } catch (e) {
                  console.error('Failed to load fold state:', e);
                }
              }
            }
            return DecorationSet.empty;
          },

          apply(tr, decorationSet, oldState, newState) {
            // Map decorations through document changes
            decorationSet = decorationSet.map(tr.mapping, tr.doc);

            // Rebuild decorations if meta indicates fold state changed
            if (tr.getMeta('foldingChanged')) {
              return buildDecorations(newState);
            }

            return decorationSet;
          },
        },

        props: {
          decorations(state) {
            return buildDecorations(state);
          },

          handleDOMEvents: {
            click(view, event) {
              const target = event.target;

              // Check if clicked on fold indicator
              if (target.classList?.contains('fold-indicator')) {
                event.preventDefault();
                event.stopPropagation();

                const pos = parseInt(target.dataset.pos, 10);
                if (!isNaN(pos)) {
                  extension.toggleFold(view, pos);
                }
                return true;
              }

              return false;
            },
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Fold current section: Cmd/Ctrl+Option+[
      'Mod-Alt-[': () => {
        const { state, view } = this.editor;
        const { from } = state.selection;
        const headingPos = this.findHeadingAt(state.doc, from);
        if (headingPos !== null) {
          this.toggleFold(view, headingPos);
          return true;
        }
        return false;
      },

      // Unfold current section: Cmd/Ctrl+Option+]
      'Mod-Alt-]': () => {
        const { state, view } = this.editor;
        const { from } = state.selection;
        const headingPos = this.findHeadingAt(state.doc, from);
        if (headingPos !== null && this.storage.foldedSections.has(headingPos)) {
          this.toggleFold(view, headingPos);
          return true;
        }
        return false;
      },

      // Unfold all: Cmd/Ctrl+Option+0
      'Mod-Alt-0': () => {
        this.unfoldAll(this.editor.view);
        return true;
      },
    };
  },

  addCommands() {
    return {
      toggleFold: (pos) => ({ view }) => {
        this.toggleFold(view, pos);
        return true;
      },

      unfoldAll: () => ({ view }) => {
        this.unfoldAll(view);
        return true;
      },
    };
  },

  // Helper methods
  findHeadingAt(doc, pos) {
    let headingPos = null;

    // Find heading at or before cursor position
    doc.nodesBetween(0, pos, (node, nodePos) => {
      if (node.type.name === 'heading') {
        headingPos = nodePos;
      }
    });

    return headingPos;
  },

  toggleFold(view, headingPos) {
    const isFolded = this.storage.foldedSections.has(headingPos);

    if (isFolded) {
      this.storage.foldedSections.delete(headingPos);
    } else {
      this.storage.foldedSections.add(headingPos);
    }

    // Save to localStorage
    this.saveFoldState();

    // Trigger decoration update
    const tr = view.state.tr.setMeta('foldingChanged', true);
    view.dispatch(tr);
  },

  unfoldAll(view) {
    this.storage.foldedSections.clear();
    this.saveFoldState();

    const tr = view.state.tr.setMeta('foldingChanged', true);
    view.dispatch(tr);
  },

  saveFoldState() {
    const filePath = globalThis.__LOKUS_ACTIVE_FILE__;
    if (filePath) {
      const storageKey = `${this.options.storageKey}:${filePath}`;
      const positions = Array.from(this.storage.foldedSections);
      localStorage.setItem(storageKey, JSON.stringify(positions));
    }
  },
});

export default Folding;
