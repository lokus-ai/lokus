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
  const escapedOpen = escapeRegex(open)
  const escapedClose = escapeRegex(close)
  const escapedImage = escapeRegex(imageMarker)

  // Build character class for what's NOT allowed inside (everything except close markers)
  // Allow ^ for block references
  const notClose = close.split('').map(c => escapeRegex(c)).join('')

  const pattern = imageEmbed
    ? new RegExp(`${escapedImage}${escapedOpen}([^${notClose}]+?)${escapedClose}$`)
    : new RegExp(`${escapedOpen}([^${notClose}]+?)${escapedClose}$`)

  return pattern
}

function parseParts(raw) {
  // [[path^blockid|alt]] or [[path#hash|alt]] or [[path|alt]] or [[path]]
  // Support both # (heading hash) and ^ (block reference)
  const m = /^(?<path>[^#^|]+)(?:(?<separator>[#^])(?<hash>[^|]+))?(?:\|(?<alt>.*))?$/.exec(raw || '')
  return {
    path: m?.groups?.path?.trim() || raw,
    hash: m?.groups?.hash?.trim() || '',
    separator: m?.groups?.separator || '', // Keep track of # vs ^
    alt: (m?.groups?.alt ?? '').trim(),
  }
}

function toHref({ path, hash, separator }) {
  // Preserve the separator (# or ^) when building href
  return hash ? `${path}${separator}${hash}` : path
}

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  onCreate() {    // Listen for markdown syntax config changes and reload editor
    this.configListener = markdownSyntaxConfig.onChange((category, key, value) => {      // Recreate the extension by destroying and recreating the editor
      if (this.editor) {        // Trigger a full reload by emitting a custom event
        window.dispatchEvent(new CustomEvent('markdown-config-changed', {
          detail: { category, key, value }
        }));
      } else {
      }
    });  },

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
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('a');
      dom.classList.add('wiki-link');
      dom.setAttribute('data-type', 'wiki-link');
      dom.setAttribute('href', node.attrs.href || node.attrs.target);

      // Format display text
      // Priority: alt attribute, or alias from target (after |), or target itself
      let displayText = node.attrs.alt
      if (!displayText && node.attrs.target) {
        // Extract alias from target if format is "path|alias"
        const parts = node.attrs.target.split('|')
        displayText = parts.length > 1 ? parts[parts.length - 1] : node.attrs.target
      }

      // Check if this is a block reference (contains ^)
      if (displayText && displayText.includes('^')) {
        const [filename, blockId] = displayText.split('^')
        const cleanFilename = filename.replace('.md', '').trim()

        // Convert block ID slug to readable text
        const blockText = blockId
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        displayText = `${cleanFilename} › ${blockText}`
      }

      dom.textContent = displayText || node.attrs.target

      let hoverTimeout = null;

      // Hover event handlers
      dom.addEventListener('mouseenter', (event) => {
        hoverTimeout = setTimeout(() => {
          // Dispatch custom event with wiki link details
          window.dispatchEvent(new CustomEvent('wiki-link-hover', {
            detail: {
              target: node.attrs.target,
              position: {
                x: event.clientX + 10, // Offset from cursor
                y: event.clientY + 10
              }
            }
          }));
        }, 500); // 500ms delay as per requirements
      });

      dom.addEventListener('mouseleave', () => {
        // Clear timeout if user moves away before delay
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }

        // Dispatch event to close preview
        window.dispatchEvent(new CustomEvent('wiki-link-hover-end'));
      });

      dom.addEventListener('click', () => {
        // Clear timeout if link is clicked
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }

        // Close preview when link is clicked
        window.dispatchEvent(new CustomEvent('wiki-link-hover-end'));

        // Let the click bubble up to Editor.jsx's handleDOMEvents
        // The editor already has a working click handler for wiki links at line 453
        // that dispatches 'lokus:open-file' event which Workspace listens to
      });

      return {
        dom,
        destroy() {
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
          }
        }
      };
    };
  },

  addInputRules() {
    const currentConfig = markdownSyntaxConfig.get('link', 'wikiLink');    return [
      // ![[File^blockid]] block embed (must come BEFORE image embed)
      new InputRule({
        find: /!\[\[([^\]]+)\^([^\]]+)\]\]$/,
        handler: async ({ range, match, chain }) => {
          const fileName = match[1].trim()
          const blockId = match[2].trim()

          // Resolve file path
          const resolved = await resolveWikiTarget(fileName)
          const filePath = resolved.href || fileName

          // Delete the ![[...]] and insert embed
          chain().deleteRange(range).run()

          // Use the WikiLinkEmbed command
          this.editor.commands.setWikiLinkEmbed(fileName, blockId, filePath)
        }
      }),
      // ![[...]] image embed (dynamic pattern)
      new InputRule({
        find: buildWikiLinkPattern(true),
        handler: ({ range, match, chain }) => {
          const raw = match[1]

          // Skip if this is a block reference (contains ^)
          if (raw.includes('^')) {
            return
          }

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