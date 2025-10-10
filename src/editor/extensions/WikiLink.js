import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { resolveWikiTarget } from '../../core/wiki/resolve.js'
import markdownSyntaxConfig from '../../core/markdown/syntax-config.js'

// Escape special regex characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build dynamic regex pattern for wiki links
function buildWikiLinkPattern(imageEmbed = false) {
  const config = markdownSyntaxConfig.get('link', 'wikiLink')
  const open = config?.open || '[['
  const close = config?.close || ']]'
  const imageMarker = markdownSyntaxConfig.get('image', 'marker') || '!'

  console.log('[WikiLink] Building pattern with:', { open, close, imageMarker, imageEmbed })

  const escapedOpen = escapeRegex(open)
  const escapedClose = escapeRegex(close)
  const escapedImage = escapeRegex(imageMarker)

  // Build character class for what's NOT allowed inside (everything except close markers)
  const notClose = close.split('').map(c => escapeRegex(c)).join('')

  const pattern = imageEmbed
    ? new RegExp(`${escapedImage}${escapedOpen}([^${notClose}]+?)${escapedClose}$`)
    : new RegExp(`${escapedOpen}([^${notClose}]+?)${escapedClose}$`)

  console.log('[WikiLink] Created pattern:', pattern)

  return pattern
}

function parseParts(raw) {
  // [[path#hash|alt]] or [[path|alt]] or [[path]]
  const m = /^(?<path>[^#|]+)(?:#(?<hash>[^|]+))?(?:\|(?<alt>.*))?$/.exec(raw || '')
  return {
    path: m?.groups?.path?.trim() || raw,
    hash: m?.groups?.hash?.trim() || '',
    alt: (m?.groups?.alt ?? '').trim(),
  }
}

function toHref({ path, hash }) {
  return hash ? `${path}#${hash}` : path
}

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  onCreate() {
    console.log('[WikiLink] Extension created, registering config listener');
    // Listen for markdown syntax config changes and reload editor
    this.configListener = markdownSyntaxConfig.onChange((category, key, value) => {
      console.log('[WikiLink] Config changed detected:', { category, key, value });
      console.log('[WikiLink] Current editor instance:', this.editor ? 'exists' : 'null');

      // Recreate the extension by destroying and recreating the editor
      if (this.editor) {
        console.log('[WikiLink] Dispatching markdown-config-changed event');
        // Trigger a full reload by emitting a custom event
        window.dispatchEvent(new CustomEvent('markdown-config-changed', {
          detail: { category, key, value }
        }));
      } else {
        console.warn('[WikiLink] Editor instance not available for reload');
      }
    });
    console.log('[WikiLink] Config listener registered successfully');
  },

  onDestroy() {
    // Clean up listener
    if (this.configListener) {
      this.configListener()
    }
  },

  addAttributes() {
    return {
      id: { default: '' },
      target: { default: '' },
      alt: { default: '' },
      embed: { default: false },
      href: { default: '' },
      src: { default: '' },
    }
  },
  parseHTML() { return [{ tag: 'span[data-type="wiki-link"]' }] },
  renderHTML({ HTMLAttributes }) {
    const { embed, alt, target, href, src } = HTMLAttributes
    if (embed && src) {
      return ['img', mergeAttributes(HTMLAttributes, { 'data-type': 'wiki-link', class: 'wiki-image', alt: alt || target, src })]
    }
    const label = alt || target
    return ['a', mergeAttributes(HTMLAttributes, { 'data-type': 'wiki-link', class: 'wiki-link', href: href || target }), label]
  },
  addCommands() {
    return {
      setWikiLink: (raw, { embed = false } = {}) => async ({ chain }) => {
        const parts = parseParts(raw)
        const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
        const baseAttrs = {
          id,
          target: raw,
          alt: parts.alt,
          embed,
          href: toHref(parts),
          src: '',
        }
        const ok = chain().insertContent({ type: this.name, attrs: baseAttrs }).run()
        // Resolve asynchronously (supports local files via Tauri)
        resolveWikiTarget(parts.path).then(resolved => {
          this.editor.commands.command(({ tr, state, dispatch }) => {
            let pos = -1
            state.doc.descendants((node, position) => {
              if (pos !== -1) return false
              if (node.type.name === this.name && node.attrs.id === id) { pos = position; return false }
              return true
            })
            if (pos !== -1) {
              const newAttrs = { ...baseAttrs, embed: embed || resolved.isImage, href: resolved.href || baseAttrs.href, src: resolved.src || '' }
              tr.setNodeMarkup(pos, undefined, newAttrs)
              dispatch(tr)
            }
            return true
          })
        })
        return ok
      },
    }
  },
  addInputRules() {
    const currentConfig = markdownSyntaxConfig.get('link', 'wikiLink');
    console.log('[WikiLink] Creating input rules with config:', currentConfig);
    return [
      // ![[...]] image embed (dynamic pattern)
      new InputRule({
        find: buildWikiLinkPattern(true),
        handler: ({ range, match, chain }) => {
          const raw = match[1]
          const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
          const parts = parseParts(raw)
          const baseAttrs = { id, target: raw, alt: parts.alt, embed: true, href: toHref(parts), src: '' }
          chain().deleteRange(range).insertContent({ type: this.name, attrs: baseAttrs }).run()
          // Resolve asynchronously
          resolveWikiTarget(parts.path).then(resolved => {
            this.editor.commands.command(({ tr, state, dispatch }) => {
              let pos = -1
              state.doc.descendants((node, position) => {
                if (pos !== -1) return false
                if (node.type.name === this.name && node.attrs.id === id) { pos = position; return false }
                return true
              })
              if (pos !== -1) {
                const newAttrs = { ...baseAttrs, href: resolved.href || baseAttrs.href, src: resolved.src || '' }
                tr.setNodeMarkup(pos, undefined, newAttrs)
                dispatch(tr)
              }
              return true
            })
          })
        },
      }),
      // [[...]] file/note link (dynamic pattern)
      new InputRule({
        find: buildWikiLinkPattern(false),
        handler: ({ range, match, chain }) => {
          const raw = match[1]
          const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
          const parts = parseParts(raw)
          const baseAttrs = { id, target: raw, alt: parts.alt, embed: false, href: toHref(parts), src: '' }
          chain().deleteRange(range).insertContent({ type: this.name, attrs: baseAttrs }).run()
          resolveWikiTarget(parts.path).then(resolved => {
            this.editor.commands.command(({ tr, state, dispatch }) => {
              let pos = -1
              state.doc.descendants((node, position) => {
                if (pos !== -1) return false
                if (node.type.name === this.name && node.attrs.id === id) { pos = position; return false }
                return true
              })
              if (pos !== -1) {
                const newAttrs = { ...baseAttrs, href: resolved.href || baseAttrs.href, src: resolved.src || '' }
                tr.setNodeMarkup(pos, undefined, newAttrs)
                dispatch(tr)
              }
              return true
            })
          })
        },
      }),
    ]
  },
})

export default WikiLink