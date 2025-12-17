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

    const buildDecorations = (state) => {
      const decorations = [];
      const { doc } = state;
      const foldedSections = extension.storage.foldedSections;

      // Find all headings
      const headings = [];
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({ level: node.attrs.level, pos, node });
        }
      });

      // Build decorations for each heading
      headings.forEach((heading, index) => {
        const { level, pos, node } = heading;
        const isFolded = foldedSections.has(pos);

        // Find the range of content to fold
        let endPos = doc.content.size;
        for (let i = index + 1; i < headings.length; i++) {
          if (headings[i].level <= level) {
            endPos = headings[i].pos;
            break;
          }
        }

        // Add data attribute to heading for fold indicator via CSS
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: `foldable-heading ${isFolded ? 'folded' : 'unfolded'}`,
            'data-fold-pos': pos,
          })
        );

        // If folded, hide the content between this heading and the next
        if (isFolded && endPos > pos + node.nodeSize) {
          const foldStart = pos + node.nodeSize;
          const foldEnd = endPos;

          if (foldEnd > foldStart) {
            // Try to apply decoration to each node in range
            doc.nodesBetween(foldStart, foldEnd, (node, nodePos) => {
              if (nodePos >= foldStart && nodePos < foldEnd) {
                decorations.push(
                  Decoration.node(nodePos, nodePos + node.nodeSize, {
                    class: 'folded-content',
                    style: 'display: none;',
                  })
                );
              }
            });
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
                } catch { }
              }
            }
            return buildDecorations(state);
          },

          apply(tr, decorationSet, oldState, newState) {
            // Rebuild decorations on document changes or fold state changes
            if (tr.docChanged || tr.getMeta('foldingChanged')) {
              return buildDecorations(newState);
            }

            // Map decorations through selection changes
            return decorationSet.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },

          handleDOMEvents: {
            click(view, event) {
              const target = event.target;

              // Check if clicked on a heading with foldable class
              // The click might be on the heading itself or the ::before pseudo-element
              let heading = null;
              if (target.classList?.contains('foldable-heading')) {
                heading = target;
              } else if (target.closest('.foldable-heading')) {
                heading = target.closest('.foldable-heading');
              }

              if (!heading) {
                return false;
              }

              // Check if click is on the fold indicator (LEFT of heading)
              const rect = heading.getBoundingClientRect();
              const clickX = event.clientX;
              const clickY = event.clientY;

              // Check vertical bounds first
              if (clickY < rect.top || clickY > rect.bottom) {
                return false;
              }

              // Indicator is at left: -22px, width: 18px (from CSS)
              // So it's at positions -22px to -4px from heading's left edge
              // Add 5px padding on each side for easier clicking
              const indicatorLeft = rect.left - 27;   // -22px - 5px padding
              const indicatorRight = rect.left + 1;    // -22px + 18px + 5px padding

              // Only handle clicks in the indicator area (to the LEFT of heading)
              if (clickX < indicatorLeft || clickX > indicatorRight) {
                return false;
              }

              event.preventDefault();
              event.stopPropagation();

              const pos = parseInt(heading.dataset.foldPos, 10);
              if (!isNaN(pos)) {
                // Toggle fold state directly (inline the toggleFold logic)
                const isFolded = extension.storage.foldedSections.has(pos);

                if (isFolded) {
                  extension.storage.foldedSections.delete(pos);
                } else {
                  extension.storage.foldedSections.add(pos);
                }

                // Save to localStorage
                const filePath = globalThis.__LOKUS_ACTIVE_FILE__;
                if (filePath) {
                  const storageKey = `${extension.options.storageKey}:${filePath}`;
                  const positions = Array.from(extension.storage.foldedSections);
                  localStorage.setItem(storageKey, JSON.stringify(positions));
                }

                // Trigger decoration update
                const tr = view.state.tr.setMeta('foldingChanged', true);
                view.dispatch(tr);
              }

              return true;
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
