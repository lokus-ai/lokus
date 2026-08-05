/**
 * SelectionLayer — draws the text selection as a tinted highlight layer,
 * replacing patchy native ::selection painting.
 *
 * Why: native selection paints one box per text run, sized to the font's
 * content box. With line-height 1.7 that leaves unpainted leading between
 * lines, and under white-space: pre-wrap a selected paragraph-end newline
 * paints to the full container width — together the result looks striped
 * and broken. CodeMirror solves this with its drawSelection extension
 * (hide native selection, draw merged rectangles in a layer); this is the
 * same technique for ProseMirror, extended with per-block-type rendering.
 *
 * Rendering rules (Notion-style):
 *  - Plain text lines → one merged rectangle per visual line, with the
 *    leading between wrapped lines of the same block filled in.
 *  - A fully-selected "boxy" block (table, callout, code block, mermaid,
 *    blockquote, hr) → one rounded rectangle over the whole block.
 *  - A partially-selected boxy block → descends to its inner text so only
 *    the selected text is highlighted.
 *  - The layer paints ABOVE the content with a translucent tint, so blocks
 *    with opaque backgrounds (code, table cells) highlight correctly too.
 *  - CellSelection (prosemirror-tables) and NodeSelection keep their own
 *    rendering (.selectedCell / .ProseMirror-selectednode).
 *  - Bails out to native selection above MAX_CHUNKS so select-all on a huge
 *    document can't hurt interaction latency.
 */

import { Plugin, PluginKey, TextSelection, AllSelection } from 'prosemirror-state'

export const selectionLayerKey = new PluginKey('selectionLayer')

/** Above this many drawn chunks we fall back to native selection painting. */
const MAX_CHUNKS = 1500

/** Vertical gaps between adjacent line rows smaller than this are closed. */
const MAX_GAP_FILL_PX = 16

/** Block types drawn as one whole-block rectangle when fully selected. */
const BOXY_BLOCKS = new Set([
  'table',
  'callout',
  'codeBlock',
  'mermaid',
  'blockquote',
  'horizontalRule',
  'wikiLinkEmbed',
])

/**
 * Merge the raw client rects of a Range into one rectangle per visual line,
 * then stretch rows vertically so consecutive lines of the block touch.
 */
function mergeRectsIntoRows(rects) {
  const rows = []
  for (const r of rects) {
    if (r.width === 0 || r.height === 0) continue
    let row = null
    for (const candidate of rows) {
      const overlap = Math.min(candidate.bottom, r.bottom) - Math.max(candidate.top, r.top)
      if (overlap > Math.min(r.height, candidate.bottom - candidate.top) * 0.5) {
        row = candidate
        break
      }
    }
    if (row) {
      row.left = Math.min(row.left, r.left)
      row.right = Math.max(row.right, r.right)
      row.top = Math.min(row.top, r.top)
      row.bottom = Math.max(row.bottom, r.bottom)
    } else {
      rows.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
    }
  }
  rows.sort((a, b) => a.top - b.top)
  // Close the leading gap between consecutive lines of the same block.
  // The extra 0.5px overlap prevents antialiasing hairlines between rects.
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i].top - rows[i - 1].bottom
    if (gap > 0 && gap < MAX_GAP_FILL_PX) rows[i - 1].bottom = rows[i].top + 0.5
  }
  return rows
}

class SelectionLayerView {
  constructor(view) {
    this.view = view
    this.layer = null
    this.drawing = false

    const parent = view.dom.parentNode
    if (!parent) return
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative'
    }
    this.layer = document.createElement('div')
    this.layer.className = 'pm-selection-layer'
    this.layer.setAttribute('aria-hidden', 'true')
    // After view.dom + z-index in CSS → paints above content as a tint.
    parent.appendChild(this.layer)

    this.redraw = this.redraw.bind(this)
    window.addEventListener('resize', this.redraw)
    // Font/size live-settings changes resize the editor without a window resize.
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.redraw) : null
    this.resizeObserver?.observe(view.dom)

    this.update(view, null)
  }

  update(view, prevState) {
    this.view = view
    if (prevState && prevState.selection.eq(view.state.selection) && prevState.doc.eq(view.state.doc)) {
      return
    }
    this.redraw()
  }

  /** Client rects (merged rows) for the text between doc positions f..t. */
  rowsForTextRange(f, t) {
    if (t <= f) return []
    try {
      const start = this.view.domAtPos(f)
      const end = this.view.domAtPos(t)
      const range = document.createRange()
      range.setStart(start.node, start.offset)
      range.setEnd(end.node, end.offset)
      return mergeRectsIntoRows(range.getClientRects())
    } catch {
      return null // signals bail-out
    }
  }

  redraw() {
    if (!this.layer) return
    const { state } = this.view
    const sel = state.selection
    const drawable =
      !sel.empty && (sel instanceof TextSelection || sel instanceof AllSelection)

    if (!drawable) {
      this.clear()
      return
    }

    const { from, to } = sel
    const chunks = [] // {left, top, right, bottom, kind: 'row'|'block'}
    let bail = false

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (bail || chunks.length > MAX_CHUNKS) { bail = true; return false }
      const start = pos
      const end = pos + node.nodeSize

      // Fully-selected boxy block → one rectangle over its whole DOM box.
      if (BOXY_BLOCKS.has(node.type.name) && start >= from && end <= to) {
        const dom = this.view.nodeDOM(pos)
        if (dom && dom.getBoundingClientRect) {
          const r = dom.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            chunks.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, kind: 'block' })
          }
        }
        return false // don't descend
      }

      // A text selection sweeping through a partially-selected table:
      // highlight every touched CELL whole (Excel/Notion style) instead of
      // painting ragged per-line chips inside cells.
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        const dom = this.view.nodeDOM(pos)
        if (dom && dom.getBoundingClientRect) {
          const r = dom.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            chunks.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, kind: 'cell' })
          }
        }
        return false // whole cell is tinted; don't draw its inner text
      }

      if (node.isTextblock) {
        const f = Math.max(from, start + 1)
        const t = Math.min(to, end - 1)
        const rows = this.rowsForTextRange(f, t)
        if (rows === null) { bail = true; return false }
        for (const row of rows) chunks.push({ ...row, kind: 'row' })
        return false // rows cover the whole textblock; don't descend
      }

      return true // container node (list, partially-selected callout…): descend
    })

    if (bail || chunks.length === 0 || chunks.length > MAX_CHUNKS) {
      // jsdom (no layout), a huge selection, or DOM mapping failure:
      // let native painting handle it.
      this.clear()
      return
    }

    const layerRect = this.layer.getBoundingClientRect()
    const frag = document.createDocumentFragment()
    for (const c of chunks) {
      const el = document.createElement('div')
      el.className =
        c.kind === 'block' ? 'pm-selection-chunk pm-selection-block'
        : c.kind === 'cell' ? 'pm-selection-chunk pm-selection-cell'
        : 'pm-selection-chunk'
      el.style.left = `${c.left - layerRect.left}px`
      el.style.top = `${c.top - layerRect.top}px`
      el.style.width = `${c.right - c.left}px`
      el.style.height = `${c.bottom - c.top}px`
      frag.appendChild(el)
    }
    this.layer.replaceChildren(frag)

    if (!this.drawing) {
      this.drawing = true
      this.view.dom.classList.add('pm-native-selection-hidden')
    }
  }

  clear() {
    if (!this.layer) return
    this.layer.replaceChildren()
    if (this.drawing) {
      this.drawing = false
      this.view.dom.classList.remove('pm-native-selection-hidden')
    }
  }

  destroy() {
    window.removeEventListener('resize', this.redraw)
    this.resizeObserver?.disconnect()
    this.view.dom.classList.remove('pm-native-selection-hidden')
    this.layer?.remove()
    this.layer = null
  }
}

export function createSelectionLayerPlugin() {
  return new Plugin({
    key: selectionLayerKey,
    view(editorView) {
      return new SelectionLayerView(editorView)
    },
  })
}
