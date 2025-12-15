import { Node, mergeAttributes, InputRule } from '@tiptap/core'

// Parse canvas link to extract name
function parseCanvasLink(raw) {
  return {
    name: raw.trim()
  }
}

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
    return [{ tag: 'a[data-type="canvas-link"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { canvasName, canvasPath, exists } = HTMLAttributes
    const className = exists ? 'canvas-link' : 'canvas-link canvas-link-broken'

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'canvas-link',
        class: className,
        href: canvasPath || canvasName
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
      const dom = document.createElement('a')
      dom.classList.add('canvas-link')
      dom.setAttribute('data-type', 'canvas-link')
      dom.setAttribute('href', node.attrs.canvasPath || node.attrs.canvasName)

      // Mark broken links
      if (!node.attrs.exists) {
        dom.classList.add('canvas-link-broken')
      }

      // Create icon element
      const icon = document.createElement('span')
      icon.classList.add('canvas-link-icon')
      icon.textContent = '🎨' // Canvas icon

      // Create text element
      const text = document.createElement('span')
      text.classList.add('canvas-link-text')
      text.textContent = node.attrs.canvasName

      dom.appendChild(icon)
      dom.appendChild(text)

      let hoverTimeout = null

      // Hover event handlers
      dom.addEventListener('mouseenter', (event) => {
        hoverTimeout = setTimeout(() => {
          // Dispatch custom event with canvas link details
          window.dispatchEvent(new CustomEvent('canvas-link-hover', {
            detail: {
              canvasName: node.attrs.canvasName,
              canvasPath: node.attrs.canvasPath,
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
        event.preventDefault()

        // Clear timeout if link is clicked
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          hoverTimeout = null
        }

        // Close preview when link is clicked
        window.dispatchEvent(new CustomEvent('canvas-link-hover-end'))

        // Dispatch event to open canvas
        if (node.attrs.exists && node.attrs.canvasPath) {
          window.dispatchEvent(new CustomEvent('lokus:open-canvas', {
            detail: {
              canvasName: node.attrs.canvasName,
              canvasPath: node.attrs.canvasPath
            }
          }))
        }
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
  },

  addInputRules() {
    return [
      // ![Canvas Name] pattern
      new InputRule({
        find: /!\[([^\]]+)\]$/,
        handler: ({ range, match, chain }) => {
          const raw = match[1]
          const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
          const parts = parseCanvasLink(raw)

          const baseAttrs = {
            id,
            canvasName: parts.name,
            canvasPath: '',
            thumbnailUrl: '',
            exists: false
          }

          chain().deleteRange(range).insertContent({ type: this.name, attrs: baseAttrs }).run()

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
        }
      })
    ]
  }
})

export default CanvasLink
