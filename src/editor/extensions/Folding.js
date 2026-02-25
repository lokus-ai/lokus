import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { keymap } from 'prosemirror-keymap'

const FoldingPluginKey = new PluginKey('folding')

/**
 * Creates the Folding ProseMirror plugins.
 *
 * Features:
 * - Fold/unfold heading sections with visual indicators (fold/unfold arrows)
 * - Keyboard shortcuts: Cmd+Option+[ fold, Cmd+Option+] unfold, Cmd+Option+0 unfold all
 * - Persistent fold state per note (localStorage)
 * - Smooth animations via CSS transitions
 *
 * @param {object} [options]
 * @param {string} [options.storageKey='lokus-fold-state'] - localStorage key prefix
 * @returns {Plugin[]}
 */
export function createFoldingPlugins(options = {}) {
  const storageKey = options.storageKey ?? 'lokus-fold-state'

  // Mutable fold state shared across the plugin's closures
  const foldedSections = new Set()

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function saveFoldState() {
    const filePath = globalThis.__LOKUS_ACTIVE_FILE__
    if (filePath) {
      const key = `${storageKey}:${filePath}`
      const positions = Array.from(foldedSections)
      localStorage.setItem(key, JSON.stringify(positions))
    }
  }

  function loadFoldState() {
    const filePath = globalThis.__LOKUS_ACTIVE_FILE__
    if (filePath) {
      const key = `${storageKey}:${filePath}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          const positions = JSON.parse(stored)
          foldedSections.clear()
          for (const p of positions) foldedSections.add(p)
        } catch { /* ignore malformed stored state */ }
      }
    }
  }

  function toggleFold(view, headingPos) {
    if (foldedSections.has(headingPos)) {
      foldedSections.delete(headingPos)
    } else {
      foldedSections.add(headingPos)
    }
    saveFoldState()
    const tr = view.state.tr.setMeta('foldingChanged', true)
    view.dispatch(tr)
  }

  function unfoldAll(view) {
    foldedSections.clear()
    saveFoldState()
    const tr = view.state.tr.setMeta('foldingChanged', true)
    view.dispatch(tr)
  }

  /**
   * Find the position of the innermost heading at or before `pos`.
   *
   * @param {import('prosemirror-model').Node} doc
   * @param {number} pos
   * @returns {number|null}
   */
  function findHeadingAt(doc, pos) {
    let headingPos = null
    doc.nodesBetween(0, pos, (node, nodePos) => {
      if (node.type.name === 'heading') {
        headingPos = nodePos
      }
    })
    return headingPos
  }

  // ---------------------------------------------------------------------------
  // Decoration builder
  // ---------------------------------------------------------------------------

  function buildDecorations(state) {
    const decorations = []
    const { doc } = state

    // Find all headings
    const headings = []
    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({ level: node.attrs.level, pos, node })
      }
    })

    // Build decorations for each heading
    headings.forEach((heading, index) => {
      const { level, pos, node } = heading
      const isFolded = foldedSections.has(pos)

      // Find the range of content to fold
      let endPos = doc.content.size
      for (let i = index + 1; i < headings.length; i++) {
        if (headings[i].level <= level) {
          endPos = headings[i].pos
          break
        }
      }

      // Add data attribute to heading for fold indicator via CSS
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: `foldable-heading ${isFolded ? 'folded' : 'unfolded'}`,
          'data-fold-pos': pos,
        })
      )

      // If folded, hide the content between this heading and the next
      if (isFolded && endPos > pos + node.nodeSize) {
        const foldStart = pos + node.nodeSize
        const foldEnd = endPos

        if (foldEnd > foldStart) {
          // Apply decoration to each node in range
          doc.nodesBetween(foldStart, foldEnd, (node, nodePos) => {
            if (nodePos >= foldStart && nodePos < foldEnd) {
              decorations.push(
                Decoration.node(nodePos, nodePos + node.nodeSize, {
                  class: 'folded-content',
                  style: 'display: none;',
                })
              )
            }
          })
        }
      }
    })

    return DecorationSet.create(doc, decorations)
  }

  // ---------------------------------------------------------------------------
  // Main folding plugin
  // ---------------------------------------------------------------------------

  const foldingPlugin = new Plugin({
    key: FoldingPluginKey,

    state: {
      init(_, state) {
        loadFoldState()
        return buildDecorations(state)
      },

      apply(tr, decorationSet, oldState, newState) {
        // Rebuild decorations on document changes or fold state changes
        if (tr.docChanged || tr.getMeta('foldingChanged')) {
          return buildDecorations(newState)
        }
        // Map decorations through selection changes
        return decorationSet.map(tr.mapping, tr.doc)
      },
    },

    props: {
      decorations(state) {
        return this.getState(state)
      },

      handleDOMEvents: {
        click(view, event) {
          const target = event.target

          // Check if clicked on a heading with foldable class
          // The click might be on the heading itself or the ::before pseudo-element
          let heading = null
          if (target.classList?.contains('foldable-heading')) {
            heading = target
          } else if (target.closest('.foldable-heading')) {
            heading = target.closest('.foldable-heading')
          }

          if (!heading) {
            return false
          }

          // Check if click is on the fold indicator (LEFT of heading)
          const rect = heading.getBoundingClientRect()
          const clickX = event.clientX
          const clickY = event.clientY

          // Check vertical bounds first
          if (clickY < rect.top || clickY > rect.bottom) {
            return false
          }

          // Indicator is at left: -22px, width: 18px (from CSS)
          // So it's at positions -22px to -4px from heading's left edge
          // Add 5px padding on each side for easier clicking
          const indicatorLeft = rect.left - 27   // -22px - 5px padding
          const indicatorRight = rect.left + 1   // -22px + 18px + 5px padding

          // Only handle clicks in the indicator area (to the LEFT of heading)
          if (clickX < indicatorLeft || clickX > indicatorRight) {
            return false
          }

          event.preventDefault()
          event.stopPropagation()

          const pos = parseInt(heading.dataset.foldPos, 10)
          if (!isNaN(pos)) {
            toggleFold(view, pos)
          }

          return true
        },
      },
    },
  })

  // ---------------------------------------------------------------------------
  // Keyboard shortcut plugin
  // ---------------------------------------------------------------------------

  const foldingKeymapPlugin = keymap({
    // Fold current section: Cmd/Ctrl+Option+[
    'Mod-Alt-[': (state, dispatch, view) => {
      const { from } = state.selection
      const headingPos = findHeadingAt(state.doc, from)
      if (headingPos !== null) {
        toggleFold(view, headingPos)
        return true
      }
      return false
    },

    // Unfold current section: Cmd/Ctrl+Option+]
    'Mod-Alt-]': (state, dispatch, view) => {
      const { from } = state.selection
      const headingPos = findHeadingAt(state.doc, from)
      if (headingPos !== null && foldedSections.has(headingPos)) {
        toggleFold(view, headingPos)
        return true
      }
      return false
    },

    // Unfold all: Cmd/Ctrl+Option+0
    'Mod-Alt-0': (state, dispatch, view) => {
      unfoldAll(view)
      return true
    },
  })

  return [foldingPlugin, foldingKeymapPlugin]
}

export default createFoldingPlugins
