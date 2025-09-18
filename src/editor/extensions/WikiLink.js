import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { resolveWikiTarget } from '../../core/wiki/resolve.js'

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
    return [
      // ![[...]] image embed
      new InputRule({
        find: /!\[\[([^\]]+)\]\]$/,
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
      // [[...]] file/note link
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
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