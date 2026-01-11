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
      const { embed, src, alt, target, href } = node.attrs;

      // If this is an image embed with a src, render as <img>
      if (embed && src) {
        const isExternalUrl = /^https?:\/\//i.test(src);

        const dom = document.createElement('img');
        dom.classList.add('wiki-image');
        dom.setAttribute('data-type', 'wiki-link');
        dom.setAttribute('src', src);
        dom.setAttribute('alt', alt || target);

        // For external URLs, set crossorigin to help with CORS
        if (isExternalUrl) {
          dom.setAttribute('crossorigin', 'anonymous');
          dom.setAttribute('referrerpolicy', 'no-referrer');
        }

        // Handle load errors for external images
        dom.onerror = () => {
          if (isExternalUrl) {
            // Replace with error placeholder
            dom.style.display = 'none';

            const errorContainer = document.createElement('div');
            errorContainer.className = 'wiki-image-error';
            errorContainer.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary, #f5f5f5); border: 1px solid var(--border-primary, #e0e0e0); border-radius: 6px; color: var(--text-secondary, #666); font-size: 12px;';

            const icon = document.createElement('span');
            icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

            const text = document.createElement('span');
            text.textContent = 'Image failed to load';

            const link = document.createElement('a');
            link.href = src;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Open URL';
            link.style.cssText = 'color: var(--text-accent, #0066cc); text-decoration: underline;';

            errorContainer.appendChild(icon);
            errorContainer.appendChild(text);
            errorContainer.appendChild(link);

            dom.parentNode?.insertBefore(errorContainer, dom.nextSibling);
          }
        };

        return { dom };
      }

      // Otherwise render as link
      const dom = document.createElement('a');
      dom.classList.add('wiki-link');
      dom.setAttribute('data-type', 'wiki-link');
      dom.setAttribute('href', href || target);

      // Format display text
      // Priority: alt attribute, or alias from target (after |), or target itself
      let displayText = alt
      if (!displayText && target) {
        // Extract alias from target if format is "path|alias"
        const parts = target.split('|')
        displayText = parts.length > 1 ? parts[parts.length - 1] : target
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

      dom.textContent = displayText || target

      let hoverTimeout = null;

      // Hover event handlers
      dom.addEventListener('mouseenter', (event) => {
        hoverTimeout = setTimeout(() => {
          // Dispatch custom event with wiki link details
          window.dispatchEvent(new CustomEvent('wiki-link-hover', {
            detail: {
              target: target,
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