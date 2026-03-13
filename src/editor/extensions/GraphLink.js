/**
 * GraphLink Extension (raw ProseMirror)
 *
 * Inline atom node for .graph file links.
 * Schema is defined in lokus-schema.js.
 *
 * Provides:
 *   - insertGraphLink command
 *   - createGraphLinkNodeView factory (hover / click)
 *   - createGraphLinkPlugins (input rule for <<expressions>>@filename.graph)
 */

import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { createExpression, DEFAULT_COLORS } from '../../core/mathgraph/schema.js'
import { createNewGraphFile, saveGraphFile } from '../../core/mathgraph/GraphFileManager.js'
import katex from 'katex'

// ---------------------------------------------------------------------------
// Graph path resolution
// ---------------------------------------------------------------------------

async function resolveGraphPath(graphName) {
  if (typeof window.__LOKUS_FILE_INDEX__ === 'undefined') {
    return { exists: false, path: '', name: graphName }
  }

  const fileIndex = window.__LOKUS_FILE_INDEX__
  const graphFileName = graphName.endsWith('.graph') ? graphName : `${graphName}.graph`

  const matched = fileIndex.find(file => {
    const fileName = file.name || file.path.split('/').pop()
    return fileName === graphFileName || fileName === graphName
  })

  if (matched) {
    return { exists: true, path: matched.path, name: graphName }
  }

  return { exists: false, path: '', name: graphName }
}

function genId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Insert a graph-link node at the current selection.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} graphName - The graph file name (without extension)
 * @param {string} [graphPath] - Optional resolved path
 * @returns {boolean}
 */
export function insertGraphLink(view, graphName, graphPath) {
  const { state } = view
  const graphLinkType = state.schema.nodes.graphLink
  if (!graphLinkType) return false

  const id = genId()
  const cleanName = graphName.replace(/\.graph$/, '')
  const baseAttrs = {
    id,
    graphName: cleanName,
    graphPath: graphPath || '',
    exists: !!graphPath,
  }

  const node = graphLinkType.create(baseAttrs)
  const { from, to } = state.selection
  const tr = state.tr.replaceWith(from, to, node)
  view.dispatch(tr)

  // Resolve path asynchronously if not provided
  if (!graphPath) {
    resolveGraphPath(graphName).then(resolved => {
      const currentState = view.state
      let pos = -1
      currentState.doc.descendants((n, position) => {
        if (pos !== -1) return false
        if (n.type.name === 'graphLink' && n.attrs.id === id) {
          pos = position
          return false
        }
        return true
      })

      if (pos !== -1) {
        const newAttrs = {
          ...baseAttrs,
          graphPath: resolved.path || '',
          exists: resolved.exists,
        }
        const updateTr = view.state.tr.setNodeMarkup(pos, undefined, newAttrs)
        view.dispatch(updateTr)
      }
    })
  }

  return true
}

// ---------------------------------------------------------------------------
// Node view factory
// ---------------------------------------------------------------------------

/**
 * ProseMirror node-view factory for graphLink nodes.
 *
 * @param {import('prosemirror-model').Node} node
 * @param {import('prosemirror-view').EditorView} view
 * @param {() => number} getPos
 * @returns {{ dom: HTMLElement, destroy?: () => void }}
 */
export function createGraphLinkNodeView(initialNode, view, getPos) {
  const dom = document.createElement('span')
  dom.classList.add('graph-link')
  dom.setAttribute('data-type', 'graph-link')
  dom.style.cursor = 'pointer'

  // Mutable ref so event handlers always see latest attrs
  let currentNode = initialNode

  function renderContent(n) {
    dom.innerHTML = ''
    dom.className = 'graph-link'
    if (!n.attrs.exists) dom.classList.add('graph-link-broken')
    dom.setAttribute('href', n.attrs.graphPath || n.attrs.graphName)

    const exprs = n.attrs.expressions
    if (exprs) {
      const exprList = exprs.split(',').map(s => s.trim()).filter(Boolean)
      if (exprList.length > 0) {
        const icon = document.createElement('span')
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(20,184,166)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:3px"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
        dom.appendChild(icon)

        exprList.forEach((latex, i) => {
          if (i > 0) {
            const sep = document.createElement('span')
            sep.textContent = ', '
            sep.style.cssText = 'opacity:0.4'
            dom.appendChild(sep)
          }
          const mathSpan = document.createElement('span')
          try {
            mathSpan.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: false })
          } catch {
            mathSpan.textContent = latex
          }
          dom.appendChild(mathSpan)
        })
        return
      }
    }
    dom.textContent = n.attrs.graphName || 'Untitled Graph'
  }

  renderContent(currentNode)

  let hoverTimeout = null

  dom.addEventListener('mouseenter', (event) => {
    hoverTimeout = setTimeout(() => {
      const n = currentNode
      const pathForPreview = n.attrs.graphPath || n.attrs.graphName
      window.dispatchEvent(new CustomEvent('graph-link-hover', {
        detail: {
          graphName: n.attrs.graphName,
          graphPath: pathForPreview,
          exists: n.attrs.exists,
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
    window.dispatchEvent(new CustomEvent('graph-link-hover-end'))
  })

  dom.addEventListener('click', () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
    window.dispatchEvent(new CustomEvent('graph-link-hover-end'))

    const n = currentNode
    let path = n.attrs.graphPath
    if (!path && n.attrs.graphName) {
      path = n.attrs.graphName.endsWith('.graph') ? n.attrs.graphName : `${n.attrs.graphName}.graph`
    }
    if (path) {
      if (!path.startsWith('/')) {
        const ws = globalThis.__LOKUS_WORKSPACE_PATH__ || window.__WORKSPACE_PATH__ || ''
        if (ws) path = `${ws}/${path}`
      }
      window.dispatchEvent(new CustomEvent('lokus:open-file', {
        detail: path,
      }))
    }
  })

  return {
    dom,
    update(newNode) {
      if (newNode.type.name !== 'graphLink') return false
      currentNode = newNode
      renderContent(newNode)
      return true
    },
    destroy() {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    },
  }
}

// ---------------------------------------------------------------------------
// Input rule plugin: <<expressions>>@filename.graph
// ---------------------------------------------------------------------------

/**
 * Plugin that watches for the pattern <<expr1, expr2>>@filename.graph
 * and converts it to a graphLink node, creating the .graph file.
 *
 * The InputRule callback must return a transaction synchronously.
 * Async file creation and path resolution happen as side effects after
 * the transaction is dispatched.
 */
function createGraphInputPlugin(schema) {
  const graphLinkType = schema.nodes.graphLink
  if (!graphLinkType) return null

  const GRAPH_PATTERN = /<<([^>]+)>>@(\S+?)(?:\.graph)?$/

  return new Plugin({
    key: new PluginKey('graphLinkInput'),
    props: {
      handleTextInput(view, from, to, text) {
        if (text !== ' ' && text !== '\n') return false

        const { state } = view
        const $pos = state.selection.$from
        const lineStart = $pos.start()
        const lineText = state.doc.textBetween(lineStart, from) + text.slice(0, -1)

        const match = GRAPH_PATTERN.exec(lineText)
        if (!match) return false

        const expressionsRaw = match[1]
        const fileName = match[2].replace(/\.graph$/, '')

        // Parse comma-separated expressions
        const exprStrings = expressionsRaw.split(',').map(s => s.trim()).filter(Boolean)
        const expressions = exprStrings.map((latex, i) => {
          const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length]
          return createExpression('explicit', latex, color)
        })

        // Calculate positions to replace (matched text + trailing space/newline)
        const matchStart = lineStart + match.index
        const matchEnd = from + 1 // include the triggering whitespace character

        // Create graph link node synchronously
        const id = genId()
        const node = graphLinkType.create({
          id,
          graphName: fileName,
          graphPath: '',
          exists: false,
          expressions: exprStrings.join(', '),
        })

        // Replace the typed text with the graphLink node
        const tr = state.tr.replaceWith(matchStart, matchEnd, node)
        view.dispatch(tr)

        // Create the .graph file asynchronously as a side effect
        const graphFilePath = `${fileName}.graph`
        createNewGraphFile(graphFilePath, fileName).then(graphData => {
          const updatedData = { ...graphData, expressions }
          return saveGraphFile(graphFilePath, updatedData)
        }).then(() => {
          // Update node with resolved path once file is written
          resolveGraphPath(fileName).then(resolved => {
            try {
              let pos = -1
              view.state.doc.descendants((n, position) => {
                if (pos !== -1) return false
                if (n.type.name === 'graphLink' && n.attrs.id === id) {
                  pos = position
                  return false
                }
                return true
              })
              if (pos !== -1) {
                const updateTr = view.state.tr.setNodeMarkup(pos, undefined, {
                  id,
                  graphName: fileName,
                  graphPath: resolved.path || graphFilePath,
                  exists: true,
                  expressions: exprStrings.join(', '),
                })
                view.dispatch(updateTr)
              }
            } catch { /* view may be gone */ }
          })
        }).catch(err => {
          console.warn('[GraphLink] Failed to create graph file:', err)
        })

        return true
      },
    },
  })
}

// ---------------------------------------------------------------------------
// << hint decoration plugin
// ---------------------------------------------------------------------------

/**
 * Shows inline ghost-text hints when the user types `<<`.
 *
 * Hint text adapts based on what's been typed so far:
 *   <<|           →  "y=expression>>@file.graph ⇥"
 *   <<x^2|        →  ">>@file.graph ⇥"
 *   <<x^2>>|      →  "@file.graph ⇥"
 *
 * Disappears once `>>@` is fully typed (suggestion dropdown takes over).
 *
 * Tab key advances through the template:
 *   <<|           →  inserts "y=" and places cursor after "="
 *   <<y=x^2|      →  inserts ">>@" so the file dropdown opens
 *   <<x^2>>|      →  inserts "@" so the file dropdown opens
 */
function createGraphHintPlugin() {
  /**
   * Extract the text after the last unclosed `<<` on the current line.
   * Returns null when there is no unclosed `<<` or `>>@` is already present.
   *
   * @param {import('prosemirror-state').EditorState} state
   * @returns {string | null}
   */
  function getAfterOpen(state) {
    if (!state.selection.empty) return null

    const $pos = state.selection.$from
    let textBefore
    try {
      textBefore = state.doc.textBetween($pos.start(), $pos.pos)
    } catch { return null }

    const lastOpen = textBefore.lastIndexOf('<<')
    if (lastOpen === -1) return null

    const afterOpen = textBefore.slice(lastOpen + 2)

    // Once >>@ is present the suggestion dropdown is in control
    if (afterOpen.includes('>>@')) return null

    return afterOpen
  }

  return new Plugin({
    key: new PluginKey('graphLinkHint'),
    state: {
      init() { return DecorationSet.empty },
      apply(tr, old, oldState, newState) {
        const afterOpen = getAfterOpen(newState)
        if (afterOpen === null) return DecorationSet.empty

        // Determine hint text
        let hint
        if (afterOpen.includes('>>')) {
          hint = '@file.graph \u21e5'
        } else if (afterOpen.length === 0) {
          hint = 'y=expression>>@file.graph \u21e5'
        } else {
          hint = '>>@file.graph \u21e5'
        }

        const $pos = newState.selection.$from
        const widget = Decoration.widget($pos.pos, () => {
          const span = document.createElement('span')
          span.textContent = hint
          span.style.cssText = 'color:rgb(var(--text) / 0.2);pointer-events:none;user-select:none;font-style:italic;'
          span.contentEditable = 'false'
          return span
        }, { side: 1, key: 'graph-hint' })

        return DecorationSet.create(newState.doc, [widget])
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },

      handleKeyDown(view, event) {
        if (event.key !== 'Tab') return false

        const afterOpen = getAfterOpen(view.state)
        if (afterOpen === null) return false

        const { state } = view
        const cursorPos = state.selection.$from.pos

        let insert
        let placeCursorOffset // offset from the start of the inserted text where cursor should land

        if (afterOpen.length === 0) {
          // <<|  →  insert "y=" and place cursor after "="
          insert = 'y='
          placeCursorOffset = insert.length
        } else if (!afterOpen.includes('>>')) {
          // <<y=x^2|  →  insert ">>@" so the file dropdown opens
          insert = '>>@'
          placeCursorOffset = insert.length
        } else {
          // <<x^2>>|  →  insert "@" so the file dropdown opens
          insert = '@'
          placeCursorOffset = insert.length
        }

        const tr = state.tr.insertText(insert, cursorPos)
        tr.setSelection(
          state.selection.constructor.near(
            tr.doc.resolve(cursorPos + placeCursorOffset)
          )
        )
        view.dispatch(tr)

        event.preventDefault()
        return true
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create all GraphLink-related ProseMirror plugins.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createGraphLinkPlugins(schema) {
  const plugins = []
  const inputPlugin = createGraphInputPlugin(schema)
  if (inputPlugin) plugins.push(inputPlugin)
  plugins.push(createGraphHintPlugin())
  return plugins
}

export default createGraphLinkPlugins
