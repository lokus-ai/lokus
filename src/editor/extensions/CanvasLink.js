/**
 * CanvasLink Extension (raw ProseMirror)
 *
 * Inline atom node for canvas file links.
 * Schema is defined in lokus-schema.js.
 *
 * This module provides:
 *   - insertCanvasLink command
 *   - Node view factory (hover / click behaviour)
 *
 * No input rules -- canvas links are created via WikiLinkSuggest autocomplete.
 */

import { Plugin, PluginKey } from 'prosemirror-state'

// ---------------------------------------------------------------------------
// Canvas path resolution
// ---------------------------------------------------------------------------

async function resolveCanvasPath(canvasName) {
  if (typeof window.__LOKUS_FILE_INDEX__ === 'undefined') {
    return { exists: false, path: '', name: canvasName }
  }

  const fileIndex = window.__LOKUS_FILE_INDEX__
  const canvasFileName = `${canvasName}.canvas`

  const matchedFile = fileIndex.find(file => {
    const fileName = file.name || file.path.split('/').pop()
    return fileName === canvasFileName || fileName === canvasName
  })

  if (matchedFile) {
    return { exists: true, path: matchedFile.path, name: canvasName }
  }

  return { exists: false, path: '', name: canvasName }
}

function parseCanvasLink(raw) {
  // Simple parse: just use the raw text as the canvas name
  return { name: raw.trim() }
}

function genId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Insert a canvas-link node at the current selection.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} raw - The raw canvas name
 * @returns {boolean}
 */
export function insertCanvasLink(view, raw) {
  const { state } = view
  const canvasLinkType = state.schema.nodes.canvasLink
  if (!canvasLinkType) return false

  const parts = parseCanvasLink(raw)
  const id = genId()
  const baseAttrs = {
    id,
    canvasName: parts.name,
    canvasPath: '',
    thumbnailUrl: '',
    exists: false,
  }

  const node = canvasLinkType.create(baseAttrs)
  const { from, to } = state.selection
  const tr = state.tr.replaceWith(from, to, node)
  view.dispatch(tr)

  // Resolve canvas path asynchronously
  resolveCanvasPath(parts.name).then(resolved => {
    const currentState = view.state
    let pos = -1
    currentState.doc.descendants((n, position) => {
      if (pos !== -1) return false
      if (n.type.name === 'canvasLink' && n.attrs.id === id) {
        pos = position
        return false
      }
      return true
    })

    if (pos !== -1) {
      const newAttrs = {
        ...baseAttrs,
        canvasPath: resolved.path || '',
        exists: resolved.exists,
      }
      const updateTr = view.state.tr.setNodeMarkup(pos, undefined, newAttrs)
      view.dispatch(updateTr)
    }
  })

  return true
}

// ---------------------------------------------------------------------------
// Node view factory
//
// Attach via `new EditorView(el, { ..., nodeViews: { canvasLink: createCanvasLinkNodeView } })`.
// ---------------------------------------------------------------------------

/**
 * ProseMirror node-view factory for canvasLink nodes.
 *
 * @param {import('prosemirror-model').Node} node
 * @param {import('prosemirror-view').EditorView} view
 * @param {() => number} getPos
 * @returns {{ dom: HTMLElement, destroy?: () => void }}
 */
export function createCanvasLinkNodeView(node, view, getPos) {
  const dom = document.createElement('span')
  dom.classList.add('canvas-link')
  dom.setAttribute('data-type', 'canvas-link')
  dom.setAttribute('href', node.attrs.canvasPath || node.attrs.canvasName)
  dom.style.cursor = 'pointer'

  if (!node.attrs.exists) {
    dom.classList.add('canvas-link-broken')
  }

  dom.textContent = node.attrs.canvasName

  let hoverTimeout = null

  dom.addEventListener('mouseenter', (event) => {
    hoverTimeout = setTimeout(() => {
      const pathForPreview = node.attrs.canvasPath || node.attrs.canvasName
      window.dispatchEvent(new CustomEvent('canvas-link-hover', {
        detail: {
          canvasName: node.attrs.canvasName,
          canvasPath: pathForPreview,
          exists: node.attrs.exists,
          thumbnailUrl: node.attrs.thumbnailUrl,
          position: { x: event.clientX + 10, y: event.clientY + 10 },
        },
      }))
    }, 500)
  })

  dom.addEventListener('mouseleave', () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
    window.dispatchEvent(new CustomEvent('canvas-link-hover-end'))
  })

  dom.addEventListener('click', () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
    window.dispatchEvent(new CustomEvent('canvas-link-hover-end'))
    // Click handling is done in Editor.jsx handleDOMEvents
  })

  return {
    dom,
    destroy() {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    },
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create all CanvasLink-related ProseMirror plugins.
 * Currently empty (no input rules or plugins needed beyond the node view),
 * but provided for consistency with other extensions.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createCanvasLinkPlugins(schema) {
  // No PM plugins needed -- canvas links have no input rules.
  // The node view is registered separately via the nodeViews option.
  return []
}

export default createCanvasLinkPlugins
