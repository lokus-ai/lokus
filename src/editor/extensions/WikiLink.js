/**
 * WikiLink Extension (raw ProseMirror)
 *
 * Inline atom node for [[wiki links]] and ![[image embeds]].
 * Schema is defined in lokus-schema.js.
 *
 * This module provides:
 *   - Input rules for [[...]], ![[...]], and ![[file^blockid]]
 *   - insertWikiLink command
 *   - Node view factory (hover / click behaviour)
 *   - Config-change listener plugin
 */

import { InputRule, inputRules } from 'prosemirror-inputrules'
import { Plugin, PluginKey } from 'prosemirror-state'
import { resolveWikiTarget } from '../../core/wiki/resolve.js'
import markdownSyntaxConfig from '../../core/markdown/syntax-config.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildWikiLinkPattern(imageEmbed = false) {
  const config = markdownSyntaxConfig.get('link', 'wikiLink')
  const open = config?.open || '[['
  const close = config?.close || ']]'
  const imageMarker = markdownSyntaxConfig.get('image', 'marker') || '!'
  const escapedOpen = escapeRegex(open)
  const escapedClose = escapeRegex(close)
  const escapedImage = escapeRegex(imageMarker)
  const notClose = close.split('').map(c => escapeRegex(c)).join('')

  return imageEmbed
    ? new RegExp(`${escapedImage}${escapedOpen}([^${notClose}]+?)${escapedClose}$`)
    : new RegExp(`${escapedOpen}([^${notClose}]+?)${escapedClose}$`)
}

function parseParts(raw) {
  const m = /^(?<path>[^#^|]+)(?:(?<separator>[#^])(?<hash>[^|]+))?(?:\|(?<alt>.*))?$/.exec(raw || '')
  return {
    path: m?.groups?.path?.trim() || raw,
    hash: m?.groups?.hash?.trim() || '',
    separator: m?.groups?.separator || '',
    alt: (m?.groups?.alt ?? '').trim(),
  }
}

function toHref({ path, hash, separator }) {
  return hash ? `${path}${separator}${hash}` : path
}

function genId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Insert a wiki link node at the current selection.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} raw  - The raw link target text (e.g. "My Page|alias")
 * @param {Object} [opts]
 * @param {boolean} [opts.embed=false]
 * @returns {boolean}
 */
export function insertWikiLink(view, raw, opts = {}) {
  const { embed = false } = opts
  const { state } = view
  const wikiLinkType = state.schema.nodes.wikiLink
  if (!wikiLinkType) return false

  const parts = parseParts(raw)
  const id = genId()
  const baseAttrs = {
    id,
    target: raw,
    alt: parts.alt,
    embed,
    href: toHref(parts),
    src: '',
  }

  const node = wikiLinkType.create(baseAttrs)
  const { from, to } = state.selection
  let tr = state.tr.replaceWith(from, to, node)
  view.dispatch(tr)

  // Resolve asynchronously (supports local files via Tauri)
  resolveWikiTarget(parts.path).then(resolved => {
    const currentState = view.state
    let pos = -1
    currentState.doc.descendants((n, position) => {
      if (pos !== -1) return false
      if (n.type.name === 'wikiLink' && n.attrs.id === id) { pos = position; return false }
      return true
    })
    if (pos !== -1) {
      const newAttrs = {
        ...baseAttrs,
        embed: embed || resolved.isImage,
        href: resolved.href || baseAttrs.href,
        src: resolved.src || '',
      }
      const updateTr = view.state.tr.setNodeMarkup(pos, undefined, newAttrs)
      view.dispatch(updateTr)
    }
  })

  return true
}

// ---------------------------------------------------------------------------
// Input rules
// ---------------------------------------------------------------------------

function blockEmbedInputRule(schema) {
  // ![[File^blockid]] - block embed (must come BEFORE image embed)
  return new InputRule(
    /!\[\[([^\]]+)\^([^\]]+)\]\]$/,
    (state, match, start, end) => {
      const fileName = match[1].trim()
      const blockId = match[2].trim()

      // We insert a wikiLinkEmbed node via a transaction.
      // The async content resolution is handled by the WikiLinkEmbed module.
      const embedType = schema.nodes.wikiLinkEmbed
      if (!embedType) return null

      const id = genId()
      const embedNode = embedType.create({
        id,
        fileName,
        blockId,
        filePath: fileName,
        content: '',
        loading: true,
        error: null,
      })

      // Replace the matched text with the embed node
      const tr = state.tr.replaceWith(start, end, embedNode)
      return tr
    }
  )
}

function imageEmbedInputRule(schema) {
  // ![[...]] image embed (dynamic pattern)
  return new InputRule(
    buildWikiLinkPattern(true),
    (state, match, start, end) => {
      const raw = match[1]

      // Skip if this is a block reference (contains ^) -- handled by blockEmbedInputRule
      if (raw.includes('^')) return null

      const id = genId()
      const parts = parseParts(raw)
      const wikiLinkType = schema.nodes.wikiLink
      if (!wikiLinkType) return null

      const baseAttrs = { id, target: raw, alt: parts.alt, embed: true, href: toHref(parts), src: '' }
      const node = wikiLinkType.create(baseAttrs)
      const tr = state.tr.replaceWith(start, end, node)

      // Schedule async resolution outside the InputRule handler.
      // We need to capture the view in a plugin to do this properly.
      // Store a marker on the transaction metadata so the async-resolve
      // plugin can pick it up.
      tr.setMeta('wikilink-resolve', { id, parts, baseAttrs, embed: true })

      return tr
    }
  )
}

function fileLinkInputRule(schema) {
  // [[...]] file/note link (dynamic pattern)
  return new InputRule(
    buildWikiLinkPattern(false),
    (state, match, start, end) => {
      const raw = match[1]
      const id = genId()
      const parts = parseParts(raw)
      const wikiLinkType = schema.nodes.wikiLink
      if (!wikiLinkType) return null

      const baseAttrs = { id, target: raw, alt: parts.alt, embed: false, href: toHref(parts), src: '' }
      const node = wikiLinkType.create(baseAttrs)
      const tr = state.tr.replaceWith(start, end, node)

      tr.setMeta('wikilink-resolve', { id, parts, baseAttrs, embed: false })

      return tr
    }
  )
}

// ---------------------------------------------------------------------------
// Async-resolve plugin
//
// Watches for transactions with 'wikilink-resolve' metadata and kicks off
// the asynchronous target resolution, dispatching an update when done.
// ---------------------------------------------------------------------------

const wikiLinkResolveKey = new PluginKey('wikilink-async-resolve')

function asyncResolvePlugin() {
  return new Plugin({
    key: wikiLinkResolveKey,
    appendTransaction(transactions, _oldState, newState) {
      // No-op here; we use filterTransaction for side-effects.
      return null
    },
    view() {
      return {
        update(view, prevState) {
          // Check latest transaction for wikilink-resolve meta
          const meta = view.state.tr && null // can't read meta from state.tr
          // Instead we watch in appendTransaction below
        },
      }
    },
    // Use state.init + apply to watch for the meta
    state: {
      init() { return null },
      apply(tr, _value, _oldState, newState) {
        const meta = tr.getMeta('wikilink-resolve')
        if (!meta) return null

        const { id, parts, baseAttrs, embed } = meta

        // Fire-and-forget async resolution
        // We need the view, but we can get it later via the plugin's view spec.
        // Instead, use a microtask that finds the node by id.
        Promise.resolve().then(async () => {
          try {
            const resolved = await resolveWikiTarget(parts.path)
            // We need the view. Use the global __LOKUS_EDITOR_VIEW__ or fall back.
            // A better pattern is to set it from outside.
            // For now, we store a reference captured during plugin view init.
            const editorView = asyncResolvePlugin._viewRef
            if (!editorView) return

            let pos = -1
            editorView.state.doc.descendants((node, position) => {
              if (pos !== -1) return false
              if (node.type.name === 'wikiLink' && node.attrs.id === id) {
                pos = position
                return false
              }
              return true
            })

            if (pos !== -1) {
              const newAttrs = {
                ...baseAttrs,
                embed: embed || resolved.isImage,
                href: resolved.href || baseAttrs.href,
                src: resolved.src || '',
              }
              const updateTr = editorView.state.tr.setNodeMarkup(pos, undefined, newAttrs)
              editorView.dispatch(updateTr)
            }
          } catch {
            // Resolution failed silently
          }
        })

        return null
      },
    },
  })
}

// A small wrapper that captures the view reference for the async plugin.
function wikiLinkAsyncPlugin() {
  const plugin = asyncResolvePlugin()
  // Monkey-patch view init to capture view ref
  const origSpec = plugin.spec.view
  plugin.spec.view = (editorView) => {
    asyncResolvePlugin._viewRef = editorView
    return {
      update(view) {
        asyncResolvePlugin._viewRef = view
      },
      destroy() {
        asyncResolvePlugin._viewRef = null
      },
    }
  }
  return plugin
}

// ---------------------------------------------------------------------------
// Node view factory
//
// Returns a function compatible with EditorView's nodeViews option:
//   nodeViews: { wikiLink: createWikiLinkNodeView }
// ---------------------------------------------------------------------------

/**
 * ProseMirror node-view factory for wikiLink nodes.
 * Attach via `new EditorView(el, { ..., nodeViews: { wikiLink: createWikiLinkNodeView } })`.
 *
 * @param {import('prosemirror-model').Node} node
 * @param {import('prosemirror-view').EditorView} view
 * @param {() => number} getPos
 * @returns {{ dom: HTMLElement, destroy?: () => void }}
 */
export function createWikiLinkNodeView(node, view, getPos) {
  const { embed, src, alt, target, href } = node.attrs

  // Image embed
  if (embed && src) {
    const isExternalUrl = /^https?:\/\//i.test(src)
    const dom = document.createElement('img')
    dom.classList.add('wiki-image')
    dom.setAttribute('data-type', 'wiki-link')
    dom.setAttribute('src', src)
    dom.setAttribute('alt', alt || target)

    if (isExternalUrl) {
      dom.setAttribute('crossorigin', 'anonymous')
      dom.setAttribute('referrerpolicy', 'no-referrer')
    }

    dom.onerror = () => {
      if (isExternalUrl) {
        dom.style.display = 'none'
        const errorContainer = document.createElement('div')
        errorContainer.className = 'wiki-image-error'
        errorContainer.style.cssText =
          'display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; ' +
          'background: var(--bg-secondary, #f5f5f5); border: 1px solid var(--border-primary, #e0e0e0); ' +
          'border-radius: 6px; color: var(--text-secondary, #666); font-size: 12px;'

        const icon = document.createElement('span')
        icon.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
          '<circle cx="8.5" cy="8.5" r="1.5"/>' +
          '<path d="m21 15-5-5L5 21"/></svg>'

        const text = document.createElement('span')
        text.textContent = 'Image failed to load'

        const link = document.createElement('a')
        link.href = src
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.textContent = 'Open URL'
        link.style.cssText = 'color: var(--text-accent, #0066cc); text-decoration: underline;'

        errorContainer.appendChild(icon)
        errorContainer.appendChild(text)
        errorContainer.appendChild(link)
        dom.parentNode?.insertBefore(errorContainer, dom.nextSibling)
      }
    }

    return { dom }
  }

  // Link
  const dom = document.createElement('a')
  dom.classList.add('wiki-link')
  dom.setAttribute('data-type', 'wiki-link')
  dom.setAttribute('href', href || target)

  let displayText = alt
  if (!displayText && target) {
    const parts = target.split('|')
    displayText = parts.length > 1 ? parts[parts.length - 1] : target
  }

  if (displayText && displayText.includes('^')) {
    const [filename, blockId] = displayText.split('^')
    const cleanFilename = filename.replace('.md', '').trim()
    const blockText = blockId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    displayText = `${cleanFilename} > ${blockText}`
  }

  dom.textContent = displayText || target

  let hoverTimeout = null

  dom.addEventListener('mouseenter', (event) => {
    hoverTimeout = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('wiki-link-hover', {
        detail: {
          target: target,
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
    window.dispatchEvent(new CustomEvent('wiki-link-hover-end'))
  })

  dom.addEventListener('click', () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
    window.dispatchEvent(new CustomEvent('wiki-link-hover-end'))
    // Click bubbles up to Editor.jsx's handleDOMEvents
  })

  return {
    dom,
    destroy() {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    },
  }
}

// ---------------------------------------------------------------------------
// Config-change listener plugin
// ---------------------------------------------------------------------------

const configChangeKey = new PluginKey('wikilink-config-change')

function configChangePlugin() {
  let cleanupFn = null

  return new Plugin({
    key: configChangeKey,
    view() {
      // Listen for markdown syntax config changes and dispatch a reload event
      cleanupFn = markdownSyntaxConfig.onChange((category, key, value) => {
        window.dispatchEvent(new CustomEvent('markdown-config-changed', {
          detail: { category, key, value },
        }))
      })

      return {
        destroy() {
          if (cleanupFn) cleanupFn()
        },
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create all WikiLink-related ProseMirror plugins.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createWikiLinkPlugins(schema) {
  return [
    inputRules({
      rules: [
        blockEmbedInputRule(schema),
        imageEmbedInputRule(schema),
        fileLinkInputRule(schema),
      ],
    }),
    wikiLinkAsyncPlugin(),
    configChangePlugin(),
  ]
}

export { parseParts, toHref, buildWikiLinkPattern }
export default createWikiLinkPlugins
