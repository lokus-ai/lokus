import { Extension } from '@tiptap/core'
import * as suggestionMod from '@tiptap/suggestion'
import { PluginKey, Plugin } from '@tiptap/pm/state'
const suggestion = suggestionMod.default ?? suggestionMod
const WIKI_SUGGESTION_KEY = new PluginKey('wikiLinkSuggestion')
import { ReactRenderer } from '@tiptap/react'
// Use a simple fixed-position portal instead of tippy to avoid overlay issues
import WikiLinkList from '../components/WikiLinkList.jsx'
import { debounce } from '../../core/search/index.js'
import blockIdManager from '../../core/blocks/block-id-manager.js'

function getIndex() {
  const list = (globalThis.__LOKUS_FILE_INDEX__ || [])
  return Array.isArray(list) ? list : []
}

async function getFileBlocks(fileName) {
  try {

    // Find the file in the index
    const fileIndex = getIndex()

    const fileEntry = fileIndex.find(f =>
      f.title === fileName ||
      f.title === fileName.replace('.md', '') ||
      f.path.endsWith(fileName) ||
      f.path.endsWith(fileName.replace('.md', ''))
    )

    if (!fileEntry) {
      return []
    }

    // Check if blocks are already cached
    let blocks = blockIdManager.getFileBlocks(fileEntry.path)

    if (blocks.length === 0) {
      // Need to parse the file
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const { parseBlocks } = await import('../../core/blocks/block-parser.js')

      const content = await readTextFile(fileEntry.path)

      blocks = parseBlocks(content, fileEntry.path)
    }

    return blocks
  } catch (error) {
    return []
  }
}

function dirname(p) {
  if (!p) return ''
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''
}

function scoreItem(item, query, activePath) {
  const name = item.title.toLowerCase()
  const path = item.path.toLowerCase()
  const q = query.toLowerCase()
  let score = 0
  // same folder boost
  try {
    const same = dirname(activePath) === dirname(item.path)
    if (same) score += 100
  } catch {}
  // prefix match on name
  if (name.startsWith(q)) score += 50
  // substring in name or path
  if (name.includes(q)) score += 20
  if (path.includes(q)) score += 10
  // shorter names slightly preferred
  score -= Math.min(name.length, 20) * 0.1
  return score
}

// Cache for debounced filter results
let cachedResults = []
let lastQuery = ''

// Pre-cache for instant first-character results
let firstCharCache = new Map()

function rebuildFirstCharCache() {
  firstCharCache.clear()
  const idx = getIndex()

  for (const file of idx) {
    const firstChar = file.title[0]?.toLowerCase()
    if (!firstChar) continue

    if (!firstCharCache.has(firstChar)) {
      firstCharCache.set(firstChar, [])
    }
    firstCharCache.get(firstChar).push(file)
  }
}

function filterAndScoreItems(query, activePath) {
  const idx = getIndex()
  const filtered = idx.filter(f => !query || f.title.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()))
  const sorted = filtered.sort((a,b) => scoreItem(b, query, activePath) - scoreItem(a, query, activePath))
  return sorted.slice(0, 30)
}

// Debounced version for performance with large file counts
const debouncedFilter = debounce((query, activePath, callback) => {
  const results = filterAndScoreItems(query, activePath)
  cachedResults = results
  lastQuery = query
  if (callback) callback(results)
}, 100)

const WikiLinkSuggest = Extension.create({
  name: 'wikiLinkSuggest',
  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      // Plugin 0: Handle paste of URLs inside ![[ ]] - intercept and insert as image directly
      new Plugin({
        key: new PluginKey('imageUrlPasteHandler'),
        props: {
          handlePaste: (view, event, slice) => {
            // Get pasted text first - if not a URL, bail early
            const pastedText = event.clipboardData?.getData('text/plain')?.trim()
            if (!pastedText) return false

            // Check if it's a URL
            if (!/^https?:\/\//i.test(pastedText) && !pastedText.startsWith('data:')) {
              return false
            }

            const { state } = view
            const { selection } = state
            const $pos = selection.$from

            // Get text before cursor - look in current paragraph first
            let textBefore = state.doc.textBetween($pos.start(), $pos.pos)
            let lastOpen = textBefore.lastIndexOf('![[')

            // If not found in current paragraph, search further back
            if (lastOpen === -1) {
              const searchStart = Math.max(0, $pos.pos - 100)
              textBefore = state.doc.textBetween(searchStart, $pos.pos)
              lastOpen = textBefore.lastIndexOf('![[')
            }

            if (lastOpen === -1) return false

            // Make sure there's no ]] between ![[ and cursor
            const afterOpen = textBefore.slice(lastOpen + 3)
            if (afterOpen.includes(']]')) return false

            // It's a URL pasted inside ![[ - handle it specially
            event.preventDefault()

            // Find the ![[ position
            const from = $pos.pos - (textBefore.length - lastOpen)

            // Check if ]] exists after cursor - search across paragraph boundaries
            let to = $pos.pos
            try {
              const searchEnd = Math.min($pos.pos + 50, state.doc.content.size)
              const textAfter = state.doc.textBetween($pos.pos, searchEnd)
              const closingIdx = textAfter.indexOf(']]')
              if (closingIdx !== -1) {
                to = $pos.pos + closingIdx + 2
              }
            } catch (e) {}

            // Delete ![[ ... ]] and insert wikiLink node with the URL
            const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

            editor.chain()
              .focus()
              .deleteRange({ from, to })
              .insertContent({
                type: 'wikiLink',
                attrs: {
                  id,
                  target: pastedText,
                  alt: '',
                  embed: true,
                  href: pastedText,
                  src: pastedText
                }
              })
              .run()

            return true // We handled the paste
          }
        }
      }),

      // Plugin 1: Handle [[ for file suggestions
      suggestion({
        pluginKey: WIKI_SUGGESTION_KEY,
        editor: this.editor,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        allowedPrefixes: [' ', '!', '[', null],  // Allow after space, !, [, or start of line
        // Allow after [[ for files OR after ^ for blocks OR after ![ for canvas
        allow: ({ state, range }) => {
          const $pos = state.selection.$from

          const pos = state.selection.from
          const parentStart = $pos.start()

          // Use textBetween with absolute positions to properly handle inline nodes like WikiLinks
          // (parentOffset doesn't align with textContent when WikiLinks are present)
          const textBefore = state.doc.textBetween(Math.max(parentStart, pos - 2), pos)
          const fullTextBefore = state.doc.textBetween(parentStart, pos)

          // Check for [[ pattern (file linking)
          const isAfterDoubleBracket = textBefore.endsWith('[[')

          // Check for ^ pattern within [[ ]] (block linking)
          // Look for pattern: [[Filename^ or [[Filename.md^
          const wikiLinkPattern = /\[\[([^\]]+)\^$/
          const isAfterCaret = wikiLinkPattern.test(fullTextBefore)

          // Use ProseMirror node types for more reliable list detection
          const parentNode = $pos.node($pos.depth)
          const isInListItem = parentNode.type.name === 'listItem'
          const isInTaskItem = parentNode.type.name === 'taskItem'

          // Additional check for parent's parent (nested lists)
          let isInNestedList = false
          if ($pos.depth > 1) {
            const grandParent = $pos.node($pos.depth - 1)
            isInNestedList = grandParent.type.name === 'listItem' || grandParent.type.name === 'taskItem'
          }

          const isInList = isInListItem || isInTaskItem || isInNestedList

          // Note: ![ for canvas is handled by Plugin 2
          const shouldAllow = (isAfterDoubleBracket || isAfterCaret) && !isInList
          return shouldAllow
        },
        items: async ({ query, editor }) => {
          const active = (globalThis.__LOKUS_ACTIVE_FILE__ || '')

          // Clean query: remove leading [ if present (happens when typing [[)
          const cleanQuery = query.startsWith('[') ? query.slice(1) : query

          // Check if we're in block reference mode by looking at editor content
          // Pattern: [[Filename^query
          const { state } = editor
          const $pos = state.selection.$from
          // Use textBetween for proper handling when WikiLinks exist on the line
          const textBefore = state.doc.textBetween($pos.start(), $pos.pos)

          // Check if we have [[...^ pattern
          const blockRefMatch = /\[\[([^\]^]+)\^(.*)$/.exec(textBefore)

          if (blockRefMatch) {
            // BLOCK MODE: Show blocks from the specified file
            const fileName = blockRefMatch[1].trim()
            const blockQuery = blockRefMatch[2]

            // Load real blocks from file
            const blocks = await getFileBlocks(fileName)

            // Format blocks for WikiLinkList
            const formattedBlocks = blocks.map(block => ({
              type: 'block',
              blockId: block.blockId,
              title: block.text || block.blockId,
              path: `${fileName}^${block.blockId}`,
              text: block.text,
              line: block.line,
              fileName,
              blockType: block.type,
              level: block.level
            }))

            // Filter by query if provided
            const filtered = blockQuery
              ? formattedBlocks.filter(b =>
                  b.title.toLowerCase().includes(blockQuery.toLowerCase()) ||
                  b.blockId.toLowerCase().includes(blockQuery.toLowerCase())
                )
              : formattedBlocks

            return filtered
          }

          // FILE MODE: Show files with instant results
          // Note: Canvas mode (![ pattern) is handled by Plugin 2

          // For empty query, show all files (sorted by recency)
          if (!cleanQuery) {
            const results = filterAndScoreItems('', active)
            cachedResults = results
            lastQuery = ''
            return results
          }

          // For single character, use first-char cache for instant results
          if (cleanQuery.length === 1) {
            const idx = getIndex()

            // Rebuild cache if empty OR if file index size changed (files added/removed)
            if (firstCharCache.size === 0 || Array.from(firstCharCache.values()).reduce((sum, arr) => sum + arr.length, 0) !== idx.length) {
              rebuildFirstCharCache()
            }

            const firstChar = cleanQuery.toLowerCase()
            const cached = firstCharCache.get(firstChar) || []

            // If cache is empty for this character, fall back to full search
            if (cached.length === 0) {
              const results = filterAndScoreItems(cleanQuery, active)
              cachedResults = results
              lastQuery = cleanQuery
              return results
            }

            const sorted = cached.sort((a,b) => scoreItem(b, cleanQuery, active) - scoreItem(a, cleanQuery, active))
            const results = sorted.slice(0, 30)

            cachedResults = results
            lastQuery = cleanQuery
            return results
          }

          // Use cached results while debouncing for longer queries
          if (cleanQuery.startsWith(lastQuery) && cachedResults.length > 0) {
            // If query extends last query, filter cached results for instant feedback
            const quickFiltered = cachedResults.filter(f =>
              f.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
              f.path.toLowerCase().includes(cleanQuery.toLowerCase())
            )

            // Trigger debounced update in background
            debouncedFilter(cleanQuery, active, null)

            return quickFiltered.length > 0 ? quickFiltered : cachedResults
          }

          // For new queries, return immediate results but trigger debounced update
          const immediateResults = filterAndScoreItems(cleanQuery, active)
          return immediateResults
        },
        command: async ({ editor, range, props }) => {
          if (props.type === 'block') {
            // BLOCK MODE: Insert block reference
            let blockId = props.blockId

            // Check if this block has an auto-generated ID or no ID
            // Auto-generated = slug from heading text, or virtual ID from content
            const needsExplicitId = !blockId || props.auto === true || props.virtual === true

            if (needsExplicitId) {
              // Import block writer dynamically
              const { queueBlockIdWrite } = await import('../../core/blocks/block-writer.js')
              const blockIdManager = (await import('../../core/blocks/block-id-manager.js')).default

              // Generate new random ID
              const newBlockId = blockIdManager.generateId()

              // Write ID back to source file
              const fileIndex = getIndex()
              const fileEntry = fileIndex.find(f =>
                f.title === props.fileName || f.path.endsWith(props.fileName)
              )

              if (fileEntry && props.line) {
                queueBlockIdWrite(fileEntry.path, props.line, newBlockId)
                  .then((success) => {
                    if (success) {
                      // Invalidate cache for this file
                      blockIdManager.invalidateFile(fileEntry.path)
                    }
                  })
                  .catch(err => {
                  })
              }

              // Use the new ID in the link
              blockId = newBlockId
            }

            // Find the position of ^ in the document
            // Use textBetween for proper handling when WikiLinks exist on the line
            const { state } = editor
            const $pos = state.selection.$from
            const textBefore = state.doc.textBetween($pos.start(), $pos.pos)

            // Find where ^ starts
            const caretMatch = /\[\[([^\]^]+)\^(.*)$/.exec(textBefore)
            if (!caretMatch) {
              return
            }

            const fileName = caretMatch[1].trim()
            const caretPos = textBefore.lastIndexOf('^')
            const absoluteCaretPos = $pos.pos - (textBefore.length - caretPos)

            // Check if ]] already exists after cursor
            const textAfter = state.doc.textBetween($pos.pos, $pos.end())
            const closingBracketsPos = textAfter.indexOf(']]')
            const hasClosingBrackets = closingBracketsPos !== -1

            // Calculate absolute position of ]]
            const absoluteClosingPos = hasClosingBrackets
              ? state.selection.from + closingBracketsPos
              : state.selection.to

            // Delete entire [[...]] and insert as WikiLink node
            try {
              // Find the [[ start
              const openBracketPos = textBefore.lastIndexOf('[[')
              const absoluteOpenPos = $pos.pos - (textBefore.length - openBracketPos)

              const deleteEnd = hasClosingBrackets ? absoluteClosingPos + 2 : state.selection.to
              const wikiLinkText = `${fileName}^${blockId}`

              // Delete [[Filename^...]] and insert WikiLink node
              editor.chain()
                .focus()
                .deleteRange({ from: absoluteOpenPos, to: deleteEnd })
                .setWikiLink(wikiLinkText)
                .run()
            } catch (e) {
              // Silent fail
            }
          } else {
            // FILE MODE: Insert file reference
            // Use textBetween for proper handling when WikiLinks exist on the line
            const { state } = editor
            const $pos = state.selection.$from
            const textBefore = state.doc.textBetween($pos.start(), $pos.pos)

            // Find where [[ starts
            const openBracketPos = textBefore.lastIndexOf('[[')
            if (openBracketPos === -1) {
              return
            }

            const from = $pos.pos - (textBefore.length - openBracketPos)
            const to = range?.to ?? state.selection.to
            // Get display name: just the filename without extension
            const rawName = props.title || props.path
            const fileName = rawName.replace(/\.[^.]+$/, '')  // Remove any extension (.md, etc.)
            const fullPath = props.path || ''

            // Build relative path from workspace for the link text
            const wsPath = globalThis.__LOKUS_WORKSPACE_PATH__ || ''
            let relativePath = fullPath
            if (wsPath && fullPath.startsWith(wsPath)) {
              relativePath = fullPath.slice(wsPath.length).replace(/^[/\\]/, '')
            }
            // Remove .md extension for cleaner display
            relativePath = relativePath.replace(/\.md$/, '')

            // Check if there are duplicate filenames - if this is a root file with duplicates, use ./name
            const idx = getIndex()
            const duplicates = idx.filter(f => f.title === rawName)
            const isRootFile = !relativePath.includes('/') && !relativePath.includes('\\')
            if (duplicates.length > 1 && isRootFile) {
              // Prefix with ./ to explicitly indicate root (prevents same-folder preference)
              relativePath = `./${relativePath}`
            }

            // Format: [[path|displayName]] - path for resolution, displayName for viewing
            const wikiLinkTarget = `${relativePath}|${fileName}`

            // Delete the ![ or [[ and query
            try { editor.chain().focus().deleteRange({ from, to }).run() } catch (e) { /* silent */ }

            // Check if this is a canvas file
            const isCanvasFile = fullPath.endsWith('.canvas')

            if (isCanvasFile) {
              // Create CanvasLink node
              const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
              editor.chain()
                .focus()
                .insertContent({
                  type: 'canvasLink',
                  attrs: {
                    id,
                    canvasName: fileName,
                    canvasPath: fullPath,
                    thumbnailUrl: '',
                    exists: true
                  }
                })
                .run()
            } else {
              // Create WikiLink node with path|alias format
              const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
              editor.chain()
                .focus()
                .insertContent({
                  type: 'wikiLink',
                  attrs: {
                    id,
                    target: wikiLinkTarget,  // Full format: path|displayName
                    alt: fileName,           // Display name only
                    embed: false,
                    href: fullPath,          // Full path for navigation
                    src: '',
                  }
                })
                .run()
            }
          }
        },
        render: () => {
          let component
          let container
          const place = (rect) => {
            if (!container || !rect) return
            const dialogWidth = 384
            const padding = 16
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            // Calculate initial position
            let left = rect.left
            let top = rect.bottom + 6

            // Check right edge overflow
            if (left + dialogWidth + padding > viewportWidth) {
              left = viewportWidth - dialogWidth - padding
            }

            // Check left edge
            if (left < padding) {
              left = padding
            }

            // Get container height for bottom edge check
            const containerHeight = container.offsetHeight || 300 // fallback estimate

            // Check bottom edge overflow - position above cursor if needed
            if (top + containerHeight + padding > viewportHeight) {
              top = rect.top - containerHeight - 6
              // If still goes beyond top edge, align to top with padding
              if (top < padding) {
                top = padding
              }
            }

            container.style.left = `${left}px`
            container.style.top = `${top}px`
            container.style.width = `${dialogWidth}px`
          }
          return {
            onStart: (props) => {
              // Only auto-pair if this is actually a wiki link (after [[), NOT canvas link (after ![)
              try {
                const range = props.range
                const textBefore = props.editor.state.doc.textBetween(Math.max(0, range.from - 2), range.from)
                const isWikiLink = textBefore === '[[' // Must be exactly [[, not ![

                if (isWikiLink) {
                  const pos = Math.max(0, Math.min(props.editor.state.doc.content.size, (props.range?.to ?? props.editor.state.selection.to)))
                  const next = props.editor.state.doc.textBetween(pos, Math.min(props.editor.state.doc.content.size, pos + 2))
                  if (next !== ']]') {
                    props.editor.chain().focus().insertContent(']]').setTextSelection(pos).run()
                  } else {
                    props.editor.chain().focus().setTextSelection(pos).run()
                  }
                }
              } catch {}
              component = new ReactRenderer(WikiLinkList, { props, editor: props.editor })
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '2147483647'
              container.style.pointerEvents = 'auto'
              container.style.maxHeight = '60vh'
              container.style.overflow = 'hidden'
              container.appendChild(component.element)
              document.body.appendChild(container)
              if (props.clientRect) place(props.clientRect())
            },
            onUpdate: (props) => {
              component.updateProps(props)
              if (props.clientRect) place(props.clientRect())
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                if (container?.parentNode) container.parentNode.removeChild(container)
                container = null
                return true
              }
              // Guard against null component
              if (!component || !component.ref) {
                return false;
              }
              return component.ref.onKeyDown(props)
            },
            onExit: () => {
              try { if (container?.parentNode) container.parentNode.removeChild(container) } catch {}
              container = null
              if (component) component.destroy()
            },
          }
        },
      }),

      // Plugin 2: Handle ![[ for image embed suggestions
      suggestion({
        pluginKey: new PluginKey('imageEmbedSuggestion'),
        editor: this.editor,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        allowedPrefixes: ['!'],  // Only trigger after !
        allow: ({ state, range, query }) => {
          const $pos = state.selection.$from
          const pos = state.selection.from

          // First check: Did we just type ![[ (initial trigger)?
          const parentStart = $pos.start()
          const textBefore3 = state.doc.textBetween(Math.max(parentStart, pos - 3), pos)
          const isAfterImageBracket = textBefore3.endsWith('![[')

          if (isAfterImageBracket) {
            const parentNode = $pos.node($pos.depth)
            const isInList = parentNode.type.name === 'listItem' || parentNode.type.name === 'taskItem'
            return !isInList
          }

          // Second check: Are we in the middle of typing/pasting in an existing ![[...]] context?
          // Look back further to find ![[ (for long URLs that were pasted)
          if (query && query.length > 0) {
            const searchStart = Math.max(0, pos - 600)
            const textBeforeLong = state.doc.textBetween(searchStart, pos)
            // Check if there's an unclosed ![[ before us
            const lastOpen = textBeforeLong.lastIndexOf('![[')
            if (lastOpen !== -1) {
              // Make sure there's no ]] between ![[ and cursor
              const afterOpen = textBeforeLong.slice(lastOpen + 3)
              if (!afterOpen.includes(']]')) {
                return true
              }
            }
          }

          return false
        },
        items: async ({ query }) => {
          const active = (globalThis.__LOKUS_ACTIVE_FILE__ || '')
          const idx = getIndex()

          // Image file extensions
          const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif']
          const imageFiles = idx.filter(f => imageExts.some(ext => f.path.toLowerCase().endsWith(ext)))

          // Clean query - remove leading [ if present, and trim whitespace/newlines
          let cleanQuery = query.startsWith('[') ? query.slice(1) : query
          cleanQuery = cleanQuery.replace(/[\n\r]/g, '').trim()

          // Check if query looks like a URL (be more lenient with URL detection)
          const isUrl = /^https?:\/\//i.test(cleanQuery) || cleanQuery.startsWith('data:')

          let results = []

          // If it's a URL, add URL insert option first (and make it prominent)
          if (isUrl) {
            results.push({
              type: 'url',
              title: 'Insert image from URL',
              path: cleanQuery.length > 50 ? cleanQuery.slice(0, 50) + '...' : cleanQuery,
              url: cleanQuery
            })
          }

          // Filter and score image files (only if not a URL)
          if (!isUrl) {
            const q = cleanQuery.toLowerCase()
            const scored = imageFiles.map(f => {
              const fileName = f.title.toLowerCase()
              let score = 0

              if (!q) score = 100
              else if (fileName.startsWith(q)) score = 1000
              else if (fileName.includes(q)) score = 100
              else if (f.path.toLowerCase().includes(q)) score = 10
              else score = -1

              // Boost same folder
              try {
                if (dirname(active) === dirname(f.path)) score += 50
              } catch {}

              return { ...f, type: 'image', score }
            })

            const filtered = scored.filter(f => f.score >= 0).sort((a, b) => b.score - a.score).slice(0, 20)
            results = results.concat(filtered)
          }

          return results
        },
        command: async ({ editor, range, props }) => {
          const { state } = editor
          const $pos = state.selection.$from

          // Look for ![[ - try current paragraph first, then expand search
          let textBefore = state.doc.textBetween($pos.start(), $pos.pos)
          let openBracketPos = textBefore.lastIndexOf('![[')
          let from

          if (openBracketPos !== -1) {
            from = $pos.pos - (textBefore.length - openBracketPos)
          } else {
            // Try looking further back (up to 500 chars) for ![[ in case of multi-line paste
            const searchStart = Math.max(0, $pos.pos - 500)
            textBefore = state.doc.textBetween(searchStart, $pos.pos)
            openBracketPos = textBefore.lastIndexOf('![[')
            if (openBracketPos === -1) return
            from = $pos.pos - (textBefore.length - openBracketPos)
          }

          const to = range?.to ?? state.selection.to

          // Check if ]] already exists after cursor (look a bit further for multi-line)
          const textAfter = state.doc.textBetween($pos.pos, Math.min($pos.pos + 20, state.doc.content.size))
          const closingMatch = textAfter.match(/^\s*\]\]/)
          const hasClosingBrackets = closingMatch !== null
          const deleteEnd = hasClosingBrackets ? $pos.pos + closingMatch[0].length : to

          if (props.type === 'url') {
            // URL mode - insert image with URL as src
            const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
            editor.chain()
              .focus()
              .deleteRange({ from, to: deleteEnd })
              .insertContent({
                type: 'wikiLink',
                attrs: {
                  id,
                  target: props.url,
                  alt: '',
                  embed: true,
                  href: props.url,
                  src: props.url
                }
              })
              .run()
          } else {
            // Image file mode - read file and insert with data URL
            const fileName = props.title || props.path.split('/').pop()
            const fullPath = props.path || ''

            // Read image as data URL
            let src = ''
            try {
              const { readFile } = await import('@tauri-apps/plugin-fs')
              const data = await readFile(fullPath)
              const ext = fileName.split('.').pop()?.toLowerCase()
              const mimeMap = {
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
                bmp: 'image/bmp', avif: 'image/avif'
              }
              const mime = mimeMap[ext] || 'application/octet-stream'
              let binary = ''
              for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
              src = `data:${mime};base64,${btoa(binary)}`
            } catch {}

            const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
            editor.chain()
              .focus()
              .deleteRange({ from, to: deleteEnd })
              .insertContent({
                type: 'wikiLink',
                attrs: {
                  id,
                  target: fileName,
                  alt: '',
                  embed: true,
                  href: fullPath,
                  src: src
                }
              })
              .run()
          }
        },
        render: () => {
          let component
          let container
          const place = (rect) => {
            if (!container || !rect) return
            const dialogWidth = 384
            const padding = 16
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            let left = rect.left
            let top = rect.bottom + 6

            if (left + dialogWidth + padding > viewportWidth) {
              left = viewportWidth - dialogWidth - padding
            }
            if (left < padding) left = padding

            const containerHeight = container.offsetHeight || 300
            if (top + containerHeight + padding > viewportHeight) {
              top = rect.top - containerHeight - 6
              if (top < padding) top = padding
            }

            container.style.left = `${left}px`
            container.style.top = `${top}px`
            container.style.width = `${dialogWidth}px`
          }
          return {
            onStart: (props) => {
              // Auto-insert ]] after ![[
              try {
                const pos = props.editor.state.selection.from
                const textAfter = props.editor.state.doc.textBetween(pos, Math.min(pos + 2, props.editor.state.doc.content.size))
                if (textAfter !== ']]') {
                  props.editor.chain().focus().insertContent(']]').setTextSelection(pos).run()
                }
              } catch {}

              component = new ReactRenderer(WikiLinkList, { props: { ...props, isImageMode: true }, editor: props.editor })
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '2147483647'
              container.style.pointerEvents = 'auto'
              container.style.maxHeight = '60vh'
              container.style.overflow = 'hidden'
              container.appendChild(component.element)
              document.body.appendChild(container)
              if (props.clientRect) place(props.clientRect())
            },
            onUpdate: (props) => {
              component.updateProps({ ...props, isImageMode: true })
              if (props.clientRect) place(props.clientRect())
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                if (container?.parentNode) container.parentNode.removeChild(container)
                container = null
                return true
              }
              if (!component || !component.ref) return false
              return component.ref.onKeyDown(props)
            },
            onExit: () => {
              try { if (container?.parentNode) container.parentNode.removeChild(container) } catch {}
              container = null
              if (component) component.destroy()
            },
          }
        },
      }),

      // Plugin 3: Handle ![ for canvas suggestions (single bracket - NOT double ![[)
      suggestion({
        pluginKey: new PluginKey('canvasSuggestion'),
        editor: this.editor,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        allowedPrefixes: ['!'],  // Only trigger after !
        allow: ({ state, range, query }) => {
          // If query starts with [, user typed ![[ not ![ - let image plugin handle it
          if (query && query.startsWith('[')) {
            return false
          }

          const $pos = state.selection.$from
          const pos = state.selection.from
          const parentStart = $pos.start()

          // Check for ![ pattern (canvas) but NOT ![[ (image embed)
          const textBefore = state.doc.textBetween(Math.max(parentStart, pos - 3), pos)

          // Must be ![ but NOT ![[
          const isAfterCanvasBracket = textBefore.endsWith('![') && !textBefore.endsWith('![[')

          const parentNode = $pos.node($pos.depth)
          const isInList = parentNode.type.name === 'listItem' || parentNode.type.name === 'taskItem'

          return isAfterCanvasBracket && !isInList
        },
        items: async ({ query }) => {
          const active = (globalThis.__LOKUS_ACTIVE_FILE__ || '')
          const idx = getIndex()

          // Filter to only canvas files
          const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))

          // Clean query
          const cleanQuery = query.toLowerCase()

          // Score and filter
          const scored = canvasFiles.map(f => {
            const name = f.title.toLowerCase()
            let score = 0

            if (!cleanQuery) score = 100
            else if (name.startsWith(cleanQuery)) score = 1000
            else if (name.includes(cleanQuery)) score = 100
            else if (f.path.toLowerCase().includes(cleanQuery)) score = 10
            else score = -1

            // Boost same folder
            try {
              if (dirname(active) === dirname(f.path)) score += 50
            } catch {}

            return { ...f, score }
          })

          return scored.filter(f => f.score >= 0).sort((a, b) => b.score - a.score).slice(0, 20)
        },
        command: async ({ editor, range, props }) => {
          const { state } = editor
          const $pos = state.selection.$from
          const textBefore = state.doc.textBetween($pos.start(), $pos.pos)

          // Find where ![ starts
          const openBracketPos = textBefore.lastIndexOf('![')
          if (openBracketPos === -1) return

          const from = $pos.pos - (textBefore.length - openBracketPos)
          const to = range?.to ?? state.selection.to

          // Check if ] already exists after cursor
          const textAfter = state.doc.textBetween($pos.pos, Math.min($pos.pos + 2, state.doc.content.size))
          const hasClosingBracket = textAfter.startsWith(']')
          const deleteEnd = hasClosingBracket ? to + 1 : to

          const fileName = props.title || props.path.split('/').pop()?.replace('.canvas', '')
          const fullPath = props.path || ''

          // Delete ![...] and insert CanvasLink node
          const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
          editor.chain()
            .focus()
            .deleteRange({ from, to: deleteEnd })
            .insertContent({
              type: 'canvasLink',
              attrs: {
                id,
                canvasName: fileName,
                canvasPath: fullPath,
                thumbnailUrl: '',
                exists: true
              }
            })
            .run()
        },
        render: () => {
          let component
          let container
          const place = (rect) => {
            if (!container || !rect) return
            const dialogWidth = 384
            const padding = 16
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            let left = rect.left
            let top = rect.bottom + 6

            if (left + dialogWidth + padding > viewportWidth) {
              left = viewportWidth - dialogWidth - padding
            }
            if (left < padding) left = padding

            const containerHeight = container.offsetHeight || 300
            if (top + containerHeight + padding > viewportHeight) {
              top = rect.top - containerHeight - 6
              if (top < padding) top = padding
            }

            container.style.left = `${left}px`
            container.style.top = `${top}px`
            container.style.width = `${dialogWidth}px`
          }
          return {
            onStart: (props) => {
              // Don't auto-insert ] for canvas - user might be typing ![[ for image embed
              // The ] will be handled in the command when user selects a canvas

              component = new ReactRenderer(WikiLinkList, { props, editor: props.editor })
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '2147483647'
              container.style.pointerEvents = 'auto'
              container.style.maxHeight = '60vh'
              container.style.overflow = 'hidden'
              container.appendChild(component.element)
              document.body.appendChild(container)
              if (props.clientRect) place(props.clientRect())
            },
            onUpdate: (props) => {
              component.updateProps(props)
              if (props.clientRect) place(props.clientRect())
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                if (container?.parentNode) container.parentNode.removeChild(container)
                container = null
                return true
              }
              if (!component || !component.ref) return false
              return component.ref.onKeyDown(props)
            },
            onExit: () => {
              try { if (container?.parentNode) container.parentNode.removeChild(container) } catch {}
              container = null
              if (component) component.destroy()
            },
          }
        },
      }),

      // Plugin 4: Handle ^ for block suggestions
      suggestion({
        pluginKey: new PluginKey('blockSuggestion'),
        editor: this.editor,
        char: '^',
        allowSpaces: true,
        startOfLine: false,
        // Only allow ^ inside [[...^
        allow: ({ state }) => {
          const $pos = state.selection.$from
          // Use textBetween for proper handling when WikiLinks exist on the line
          const textBefore = state.doc.textBetween($pos.start(), $pos.pos)

          // Check if we have [[Filename pattern before ^
          const hasWikiLink = /\[\[([^\]]+)$/.test(textBefore)

          return hasWikiLink
        },
        items: async ({ query, editor }) => {
          // Extract filename from [[Filename^
          const { state } = editor
          const $pos = state.selection.$from
          // Use textBetween for proper handling when WikiLinks exist on the line
          const textBefore = state.doc.textBetween($pos.start(), $pos.pos)

          const match = /\[\[([^\]^]+)\^(.*)$/.exec(textBefore)
          if (!match) {
            return []
          }

          const fileName = match[1].trim()
          const blockQuery = match[2] || query

          // Load real blocks from the file using getFileBlocks
          const blocks = await getFileBlocks(fileName)

          // Format blocks for WikiLinkList (title/path format)
          const formattedBlocks = blocks.map(block => ({
            type: 'block',
            blockId: block.id,
            title: block.id,
            path: `${fileName}^${block.id}`,
            text: block.text,
            line: block.line,
            fileName
          }))

          // Filter blocks based on query
          const filtered = blockQuery
            ? formattedBlocks.filter(b =>
                b.blockId.toLowerCase().includes(blockQuery.toLowerCase()) ||
                b.text.toLowerCase().includes(blockQuery.toLowerCase())
              )
            : formattedBlocks

          return filtered
        },
        command: ({ editor, range, props }) => {
          const from = range?.from ?? editor.state.selection.from
          const to = range?.to ?? editor.state.selection.to
          const blockId = props.blockId

          // Delete the ^ and query, insert blockid]]
          try {
            editor.chain()
              .focus()
              .deleteRange({ from: from - 1, to }) // Include the ^
              .insertContent(`^${blockId}]]`)
              .run()
          } catch (e) {
            // Silent fail
          }
        },
        // Reuse the same render logic
        render: () => {
          let component
          let container
          const place = (rect) => {
            if (!container || !rect) return
            const dialogWidth = 384
            const padding = 16
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            // Calculate initial position
            let left = rect.left
            let top = rect.bottom + 6

            // Check right edge overflow
            if (left + dialogWidth + padding > viewportWidth) {
              left = viewportWidth - dialogWidth - padding
            }

            // Check left edge
            if (left < padding) {
              left = padding
            }

            // Get container height for bottom edge check
            const containerHeight = container.offsetHeight || 300 // fallback estimate

            // Check bottom edge overflow - position above cursor if needed
            if (top + containerHeight + padding > viewportHeight) {
              top = rect.top - containerHeight - 6
              // If still goes beyond top edge, align to top with padding
              if (top < padding) {
                top = padding
              }
            }

            container.style.left = `${left}px`
            container.style.top = `${top}px`
            container.style.width = `${dialogWidth}px`
          }
          return {
            onStart: (props) => {
              component = new ReactRenderer(WikiLinkList, { props, editor: props.editor })
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '2147483647'
              container.style.pointerEvents = 'auto'
              container.style.maxHeight = '60vh'
              container.style.overflow = 'hidden'
              container.appendChild(component.element)
              document.body.appendChild(container)
              if (props.clientRect) place(props.clientRect())
            },
            onUpdate: (props) => {
              component.updateProps(props)
              if (props.clientRect) place(props.clientRect())
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                if (container?.parentNode) container.parentNode.removeChild(container)
                container = null
                return true
              }
              if (!component || !component.ref) {
                return false;
              }
              return component.ref.onKeyDown(props)
            },
            onExit: () => {
              try { if (container?.parentNode) container.parentNode.removeChild(container) } catch {}
              container = null
              if (component) component.destroy()
            },
          }
        },
      }),
    ]
  },
})

export default WikiLinkSuggest
