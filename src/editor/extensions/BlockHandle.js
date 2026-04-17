/**
 * BlockHandle — Notion-style drag handle plugin for the Lokus ProseMirror editor.
 *
 * Renders a floating handle element (outside PM content) to the left of the
 * hovered block. The handle contains:
 *   - A 6-dot grip icon (drag handle)
 *   - A + button (insert new block via slash command)
 *
 * Design decisions:
 * - ONE persistent DOM node repositioned on mousemove (not one per block)
 * - Listens for pointer events on the editor wrapper, not PM props
 * - Drag delegates to ProseMirror's native DnD via NodeSelection + startDragging
 * - Which blocks get handles: direct children of doc, listItem, taskItem
 *   NOT inner paragraphs of callouts/blockquotes (drag the container instead)
 *   NOT tableCell/tableRow (table has its own UI)
 */

import { Plugin, PluginKey, NodeSelection } from 'prosemirror-state'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Node types that should receive a drag handle. */
const HANDLEABLE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'table',
  'callout',
  'mermaid',
  'wikiLinkEmbed',
  'horizontalRule',
])

/** Node types that are inner containers — their direct-child paragraphs should
 *  NOT get a handle (drag the container itself instead). */
const SKIP_INNER_PARAGRAPH_PARENTS = new Set([
  'blockquote',
  'callout',
])

const HIDE_DELAY_MS = 150

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

export const blockHandleKey = new PluginKey('blockHandle')

// ---------------------------------------------------------------------------
// DOM factory
// ---------------------------------------------------------------------------

function createHandleDOM() {
  const wrap = document.createElement('div')
  wrap.className = 'block-handle'
  wrap.setAttribute('aria-hidden', 'true')

  // ---- Grip (drag icon: 2 cols × 3 rows of dots) -------------------------
  const grip = document.createElement('div')
  grip.className = 'block-handle__grip'
  grip.setAttribute('draggable', 'true')
  grip.title = 'Drag to move'

  // 6 dots
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('span')
    dot.className = 'block-handle__dot'
    grip.appendChild(dot)
  }

  // ---- Plus button -------------------------------------------------------
  const plus = document.createElement('button')
  plus.className = 'block-handle__plus'
  plus.type = 'button'
  plus.title = 'Insert block'
  plus.textContent = '+'

  wrap.appendChild(plus)
  wrap.appendChild(grip)

  return { wrap, grip, plus }
}

// ---------------------------------------------------------------------------
// Block resolution helpers
// ---------------------------------------------------------------------------

/**
 * Given a resolved position in the doc, walk up to find the outermost
 * handleable block ancestor that should receive the drag handle.
 *
 * Rules:
 *  1. Direct child of doc  → always handleable (if its type is in HANDLEABLE_TYPES)
 *  2. listItem / taskItem  → handleable regardless of nesting depth
 *  3. Inner paragraph of callout/blockquote → skip (drag the container)
 *  4. tableCell / tableRow / tableHeader    → skip
 */
function resolveHandleTarget(view, $pos) {
  const doc = view.state.doc

  // Walk from depth 1 (direct child of doc) downward to find the deepest
  // handleable node that is NOT a skip target.
  let bestPos = null
  let bestNode = null

  for (let depth = 1; depth <= $pos.depth; depth++) {
    const node = $pos.node(depth)
    const typeName = node.type.name

    // Skip wrapper lists — the listItem inside is the handleable unit
    if (typeName === 'bulletList' || typeName === 'orderedList' || typeName === 'taskList') {
      continue
    }

    // Skip table inner cells/rows
    if (typeName === 'tableRow' || typeName === 'tableCell' || typeName === 'tableHeader') {
      return null
    }

    if (!HANDLEABLE_TYPES.has(typeName)) continue

    // Inner paragraph of callout/blockquote → skip, parent container handles it
    if (typeName === 'paragraph' && depth > 1) {
      const parentType = $pos.node(depth - 1).type.name
      if (SKIP_INNER_PARAGRAPH_PARENTS.has(parentType)) continue
    }

    bestPos = $pos.before(depth)
    bestNode = node
  }

  if (bestNode === null) return null

  return { pos: bestPos, node: bestNode }
}

/**
 * Given a DOM position from view.posAtCoords(), resolve the target block.
 * Returns { pos, node } or null.
 */
function blockAtCoords(view, coords) {
  const posResult = view.posAtCoords(coords)
  if (!posResult) return null

  const { pos } = posResult
  if (pos < 0) return null

  let $pos
  try {
    $pos = view.state.doc.resolve(pos)
  } catch {
    return null
  }

  return resolveHandleTarget(view, $pos)
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the BlockHandle plugin.
 *
 * @returns {import('prosemirror-state').Plugin}
 */
export function createBlockHandlePlugin() {
  return new Plugin({
    key: blockHandleKey,

    view(editorView) {
      return new BlockHandleView(editorView)
    },
  })
}

// ---------------------------------------------------------------------------
// Plugin view — manages the handle DOM node lifecycle
// ---------------------------------------------------------------------------

class BlockHandleView {
  constructor(view) {
    this.view = view

    // Create handle DOM
    const { wrap, grip, plus } = createHandleDOM()
    this.handle = wrap
    this.grip = grip
    this.plus = plus

    // State
    this.currentPos = null          // PM position of hovered block
    this.currentBlockDOM = null     // DOM element of hovered block
    this.visible = false
    this._hideTimer = null
    this._isOverHandle = false
    this._rafPending = false        // rAF throttle guard for mousemove

    // Append handle to document.body so it's never clipped by editor overflow.
    // Fixed positioning means we use viewport coords directly.
    document.body.appendChild(this.handle)

    // Bind handlers
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseLeave = this._onMouseLeave.bind(this)
    this._onHandleMouseEnter = this._onHandleMouseEnter.bind(this)
    this._onHandleMouseLeave = this._onHandleMouseLeave.bind(this)
    this._onGripDragStart = this._onGripDragStart.bind(this)
    this._onGripDragEnd = this._onGripDragEnd.bind(this)
    this._onGripClick = this._onGripClick.bind(this)
    this._onPlusClick = this._onPlusClick.bind(this)

    // Scroll listener — reposition handle when editor scrolls (fixed positioning)
    this._scrollParent = view.dom.closest('.ProseMirror')?.parentElement || view.dom.parentElement
    this._onScroll = () => {
      if (this.visible && this.currentBlockDOM) {
        this._positionHandle(this.currentBlockDOM)
      }
    }
    if (this._scrollParent) {
      this._scrollParent.addEventListener('scroll', this._onScroll, { passive: true })
    }

    // Editor DOM listeners
    view.dom.addEventListener('mousemove', this._onMouseMove)
    view.dom.addEventListener('mouseleave', this._onMouseLeave)

    // Handle DOM listeners
    this.handle.addEventListener('mouseenter', this._onHandleMouseEnter)
    this.handle.addEventListener('mouseleave', this._onHandleMouseLeave)
    this.grip.addEventListener('dragstart', this._onGripDragStart)
    this.grip.addEventListener('dragend', this._onGripDragEnd)
    this.grip.addEventListener('click', this._onGripClick)
    this.plus.addEventListener('click', this._onPlusClick)

    // Initially hidden
    this._hide()
  }

  // ---- Positioning ---------------------------------------------------------

  _positionHandle(blockDOM) {
    if (!blockDOM) return

    const blockRect = blockDOM.getBoundingClientRect()
    // Fixed position: use viewport coordinates directly.
    // Place handle 40px to the left of the block's left edge.
    const left = Math.max(0, blockRect.left - 40)
    this.handle.style.top = `${blockRect.top}px`
    this.handle.style.left = `${left}px`
  }

  // ---- Visibility ----------------------------------------------------------

  _show(blockDOM) {
    clearTimeout(this._hideTimer)
    this._positionHandle(blockDOM)
    this.handle.classList.add('block-handle--visible')
    this.visible = true
  }

  _hide() {
    this.handle.classList.remove('block-handle--visible')
    this.visible = false
    this._clearBlockHover()
  }

  _scheduleHide() {
    clearTimeout(this._hideTimer)
    this._hideTimer = setTimeout(() => {
      if (!this._isOverHandle) {
        this._hide()
      }
    }, HIDE_DELAY_MS)
  }

  // ---- Block hover class ---------------------------------------------------

  _applyBlockHover(dom) {
    if (this.currentBlockDOM === dom) return
    this._clearBlockHover()
    dom.classList.add('block-hover')
    this.currentBlockDOM = dom
  }

  _clearBlockHover() {
    if (this.currentBlockDOM) {
      this.currentBlockDOM.classList.remove('block-hover')
      this.currentBlockDOM = null
    }
  }

  // ---- Mouse events --------------------------------------------------------

  _onMouseMove(event) {
    // Throttle via rAF to prevent 60+ calls/sec from hanging the UI
    if (this._rafPending) return
    this._rafPending = true
    const clientX = event.clientX
    const clientY = event.clientY
    requestAnimationFrame(() => {
      this._rafPending = false
      this._handleMouseAt(clientX, clientY)
    })
  }

  _handleMouseAt(clientX, clientY) {
    try {
      const coords = { left: clientX, top: clientY }
      const target = blockAtCoords(this.view, coords)

      if (!target) {
        this._scheduleHide()
        return
      }

      let blockDOM
      try {
        blockDOM = this.view.nodeDOM(target.pos)
      } catch {
        blockDOM = null
      }

      if (!blockDOM || !(blockDOM instanceof Element)) {
        this._scheduleHide()
        return
      }

      this.currentPos = target.pos
      this._applyBlockHover(blockDOM)
      clearTimeout(this._hideTimer)
      this._show(blockDOM)
    } catch {
      // Never let the handler crash and freeze the editor
      this._scheduleHide()
    }
  }

  _onMouseLeave() {
    this._scheduleHide()
  }

  _onHandleMouseEnter() {
    this._isOverHandle = true
    clearTimeout(this._hideTimer)
  }

  _onHandleMouseLeave() {
    this._isOverHandle = false
    this._scheduleHide()
  }

  // ---- Drag ----------------------------------------------------------------

  _onGripDragStart(event) {
    const view = this.view
    const pos = this.currentPos
    if (pos === null) return

    let node
    try {
      node = view.state.doc.nodeAt(pos)
    } catch {
      return
    }
    if (!node) return

    // Create a NodeSelection for this block
    let sel
    try {
      sel = NodeSelection.create(view.state.doc, pos)
    } catch {
      return
    }

    // Dispatch the selection so PM knows what's being dragged
    view.dispatch(view.state.tr.setSelection(sel))

    // Set PM dragging state (needed for PM drop cursor & drop handling)
    // ProseMirror checks view.dragging; we set the slice it will use
    const slice = sel.content()
    view.dragging = { slice, move: true }

    // Set drag data
    event.dataTransfer.effectAllowed = 'move'
    try {
      event.dataTransfer.setData('text/html', '')
    } catch { /* safari may throw */ }

    // Visual feedback on the block DOM element
    if (this.currentBlockDOM) {
      this.currentBlockDOM.classList.add('block-dragging')
    }
  }

  _onGripDragEnd() {
    // Remove dragging visual
    if (this.currentBlockDOM) {
      this.currentBlockDOM.classList.remove('block-dragging')
    }
    // Clear PM dragging state if it's still set
    if (this.view.dragging) {
      this.view.dragging = null
    }
  }

  // ---- Click on grip: select the block ------------------------------------

  _onGripClick(event) {
    event.preventDefault()
    const view = this.view
    const pos = this.currentPos
    if (pos === null) return

    let sel
    try {
      sel = NodeSelection.create(view.state.doc, pos)
    } catch {
      return
    }
    view.dispatch(view.state.tr.setSelection(sel))
    view.focus()

    // Dispatch event for BlockMenu (React portal listens on document)
    const blockNode = view.state.doc.nodeAt(pos)
    const menuEvent = new CustomEvent('lokus:open-block-menu', {
      bubbles: true,
      detail: {
        pos,
        blockNode,
        view,
        handleEl: this.handle,
        clientX: event.clientX,
        clientY: event.clientY,
      },
    })
    document.dispatchEvent(menuEvent)
  }

  // ---- Plus click: open slash menu ----------------------------------------

  _onPlusClick(event) {
    event.preventDefault()
    const pos = this.currentPos

    // Dispatch custom event that Editor.jsx / SlashCommand listens for
    const customEvent = new CustomEvent('lokus:open-slash-menu', {
      bubbles: true,
      detail: { pos },
    })
    this.view.dom.dispatchEvent(customEvent)
  }

  // ---- ProseMirror view lifecycle -----------------------------------------

  update(_view, _prevState) {
    // Re-position when doc changes (content reflow may move blocks)
    if (this.currentBlockDOM && this.visible) {
      this._show(this.currentBlockDOM)
    }
  }

  destroy() {
    clearTimeout(this._hideTimer)

    // Remove DOM listeners
    if (this._scrollParent) {
      this._scrollParent.removeEventListener('scroll', this._onScroll)
    }
    this.view.dom.removeEventListener('mousemove', this._onMouseMove)
    this.view.dom.removeEventListener('mouseleave', this._onMouseLeave)

    this.handle.removeEventListener('mouseenter', this._onHandleMouseEnter)
    this.handle.removeEventListener('mouseleave', this._onHandleMouseLeave)
    this.grip.removeEventListener('dragstart', this._onGripDragStart)
    this.grip.removeEventListener('dragend', this._onGripDragEnd)
    this.grip.removeEventListener('click', this._onGripClick)
    this.plus.removeEventListener('click', this._onPlusClick)

    // Remove handle from DOM (appended to document.body)
    if (this.handle.parentElement) {
      this.handle.parentElement.removeChild(this.handle)
    }

    this._clearBlockHover()
  }
}

export default createBlockHandlePlugin
