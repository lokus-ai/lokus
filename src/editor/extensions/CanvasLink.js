import { Node, mergeAttributes } from '@tiptap/core'

// Resolve canvas file from the global file index
async function resolveCanvasPath(canvasName) {
  // Check if __LOKUS_FILE_INDEX__ is available
  if (typeof window.__LOKUS_FILE_INDEX__ === 'undefined') {
    return {
      exists: false,
      path: '',
      name: canvasName
    }
  }

  // Search for canvas file in the index
  const fileIndex = window.__LOKUS_FILE_INDEX__
  const canvasFileName = `${canvasName}.canvas`

  // Find exact match or partial match
  const matchedFile = fileIndex.find(file => {
    const fileName = file.name || file.path.split('/').pop()
    return fileName === canvasFileName || fileName === canvasName
  })

  if (matchedFile) {
    return {
      exists: true,
      path: matchedFile.path,
      name: canvasName
    }
  }

  return {
    exists: false,
    path: '',
    name: canvasName
  }
}

export const CanvasLink = Node.create({
  name: 'canvasLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: '' },
      canvasName: { default: '' },
      canvasPath: { default: '' },
      thumbnailUrl: { default: '' },
      exists: { default: false }
    }
  },

  parseHTML() {
    return [
      {
        // Match span (new format)
        tag: 'span[data-type="canvas-link"]',
        getAttrs: (node) => {
          const href = node.getAttribute('href') || ''
          const textContent = node.textContent || ''
          const className = node.getAttribute('class') || ''

          return {
            canvasName: textContent.trim(),
            canvasPath: href,
            exists: !className.includes('canvas-link-broken'),
            thumbnailUrl: '',
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
          }
        }
      },
      {
        // Also match <a> for backwards compatibility with existing files
        tag: 'a[data-type="canvas-link"]',
        getAttrs: (node) => {
          const href = node.getAttribute('href') || ''
          const textContent = node.textContent || ''
          const className = node.getAttribute('class') || ''

          return {
            canvasName: textContent.trim(),
            canvasPath: href,
            exists: !className.includes('canvas-link-broken'),
            thumbnailUrl: '',
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
          }
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { canvasName, canvasPath, exists } = HTMLAttributes
    const className = exists ? 'canvas-link' : 'canvas-link canvas-link-broken'

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'canvas-link',
        class: className,
        href: canvasPath || canvasName,
        style: 'cursor: pointer'
      }),
      canvasName
    ]
  },

  addCommands() {
    return {
      setCanvasLink: (raw) => async ({ chain }) => {
        const parts = parseCanvasLink(raw)
        const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)

        const baseAttrs = {
          id,
          canvasName: parts.name,
          canvasPath: '',
          thumbnailUrl: '',
          exists: false
        }

        const ok = chain().insertContent({ type: this.name, attrs: baseAttrs }).run()

        // Resolve canvas path asynchronously
        resolveCanvasPath(parts.name).then(resolved => {
          this.editor.commands.command(({ tr, state, dispatch }) => {
            let pos = -1
            state.doc.descendants((node, position) => {
              if (pos !== -1) return false
              if (node.type.name === this.name && node.attrs.id === id) {
                pos = position
                return false
              }
              return true
            })

            if (pos !== -1) {
              const newAttrs = {
                ...baseAttrs,
                canvasPath: resolved.path || '',
                exists: resolved.exists
              }
              tr.setNodeMarkup(pos, undefined, newAttrs)
              dispatch(tr)
            }
            return true
          })
        })

        return ok
      }
    }
  },

  addNodeView() {
    return ({ node }) => {
      // Use span instead of <a> to prevent browser navigation/shell.open
      const dom = document.createElement('span')
      dom.classList.add('canvas-link')
      dom.setAttribute('data-type', 'canvas-link')
      // Store path in data-href for click handler in Editor.jsx
      dom.setAttribute('href', node.attrs.canvasPath || node.attrs.canvasName)
      dom.style.cursor = 'pointer'

      // Mark broken links
      if (!node.attrs.exists) {
        dom.classList.add('canvas-link-broken')
      }

      // Just show the canvas name - no emoji
      dom.textContent = node.attrs.canvasName

      let hoverTimeout = null

      // Hover event handlers
      dom.addEventListener('mouseenter', (event) => {
        hoverTimeout = setTimeout(() => {
          // Use canvasPath if available, otherwise try to construct from canvasName
          const pathForPreview = node.attrs.canvasPath || node.attrs.canvasName

          // Dispatch custom event with canvas link details
          window.dispatchEvent(new CustomEvent('canvas-link-hover', {
            detail: {
              canvasName: node.attrs.canvasName,
              canvasPath: pathForPreview,
              exists: node.attrs.exists,
              thumbnailUrl: node.attrs.thumbnailUrl,
              position: {
                x: event.clientX + 10, // Offset from cursor
                y: event.clientY + 10
              }
            }
          }))
        }, 500) // 500ms delay
      })

      dom.addEventListener('mouseleave', () => {
        // Clear timeout if user moves away before delay
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          hoverTimeout = null
        }

        // Dispatch event to close preview
        window.dispatchEvent(new CustomEvent('canvas-link-hover-end'))
      })

      dom.addEventListener('click', (event) => {
        // Clear timeout if link is clicked
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          hoverTimeout = null
        }

        // Close preview when link is clicked
        window.dispatchEvent(new CustomEvent('canvas-link-hover-end'))

        // Click handling is done in Editor.jsx handleDOMEvents
        // which uses Tauri emit() for proper file opening
      })

      return {
        dom,
        destroy() {
          if (hoverTimeout) {
            clearTimeout(hoverTimeout)
          }
        }
      }
    }
  }
  // InputRule removed - canvas links are now created via WikiLinkSuggest autocomplete
})

export default CanvasLink
