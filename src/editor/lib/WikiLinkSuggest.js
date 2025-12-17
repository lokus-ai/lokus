import { Extension } from '@tiptap/core'
import * as suggestionMod from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
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
    console.error('[WikiLinkSuggest] Error loading blocks:', error)
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
    return [
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

          const parentContent = $pos.parent.textContent
          const textBefore = parentContent.slice(Math.max(0, $pos.parentOffset - 2), $pos.parentOffset)
          const fullTextBefore = parentContent.slice(0, $pos.parentOffset)


          // Check for [[ pattern (file linking)
          const isAfterDoubleBracket = textBefore.endsWith('[[')

          // Check for ![ pattern (canvas linking) - use regex to match ![...] anywhere before cursor
          const isAfterImageSyntax = /!\[[^\]]*$/.test(fullTextBefore)

          // Check for ^ pattern within [[ ]] (block linking)
          // Look for pattern: [[Filename^ or [[Filename.md^
          const wikiLinkPattern = /\[\[([^\]]+)\^$/

          const fullTextBefore = state.doc.textBetween(parentStart, pos)
          const isAfterCaret = wikiLinkPattern.test(fullTextBefore)

          dbg('textBefore check', {
            textBefore,
            fullTextBefore: fullTextBefore.slice(-20),
            pos,
            parentStart,
            rangeFrom: range.from,
            isAfterCaret
          })

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

          const shouldAllow = (isAfterDoubleBracket || isAfterCaret || isAfterImageSyntax) && !isInList
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

          // Check if we're in canvas mode (![ pattern)
          const isCanvasMode = /!\[.*$/.test(textBefore)

          // CANVAS MODE: Show only .canvas files
          if (isCanvasMode) {
            const idx = getIndex()
            const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))

            // For empty query, show all canvas files (sorted by recency)
            if (!cleanQuery) {
              const results = canvasFiles.sort((a,b) => scoreItem(b, '', active) - scoreItem(a, '', active)).slice(0, 30)
              cachedResults = results
              lastQuery = ''
              return results
            }

            // Filter and score canvas files - prioritize prefix matches
            const q = cleanQuery.toLowerCase()
            const scored = canvasFiles.map(f => {
              const title = f.title.toLowerCase()
              const fileName = title.replace('.canvas', '')
              let score = 0

              // Highest priority: title starts with query
              if (fileName.startsWith(q)) {
                score = 1000
              }
              // Medium priority: title contains query
              else if (fileName.includes(q)) {
                score = 100
              }
              // Low priority: path contains query
              else if (f.path.toLowerCase().includes(q)) {
                score = 10
              }
              // No match
              else {
                score = -1
              }

              return { ...f, score }
            })

            // Only show matches (score >= 0)
            const filtered = scored.filter(f => f.score >= 0)
            const sorted = filtered.sort((a, b) => b.score - a.score)
            const results = sorted.slice(0, 30)
            cachedResults = results
            lastQuery = cleanQuery
            return results
          }

          // FILE MODE: Show files with instant results

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
                    console.error('[WikiLinkSuggest] Error writing block ID:', err)
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
              dbg('command: no [[ found in textBefore', { textBefore })
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

      // Plugin 2: Handle ![ for canvas file suggestions
      suggestion({
        pluginKey: new PluginKey('canvasLinkSuggestion'),
        editor: this.editor,
        char: '![',
        allowSpaces: true,
        startOfLine: false,
        allowedPrefixes: [' ', null],  // Allow after space or start of line
        allow: ({ state, range }) => {
          const $pos = state.selection.$from
          const parentNode = $pos.node($pos.depth)
          const isInList = parentNode.type.name === 'listItem' || parentNode.type.name === 'taskItem'
          return !isInList
        },
        items: async ({ query }) => {
          const active = (globalThis.__LOKUS_ACTIVE_FILE__ || '')
          const idx = getIndex()
          const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))

          // For empty query, show all canvas files
          if (!query) {
            return canvasFiles.sort((a,b) => scoreItem(b, '', active) - scoreItem(a, '', active)).slice(0, 30)
          }

          // Filter and score - prioritize prefix matches
          const q = query.toLowerCase()
          const scored = canvasFiles.map(f => {
            const fileName = f.title.toLowerCase().replace('.canvas', '')
            let score = -1

            if (fileName.startsWith(q)) score = 1000
            else if (fileName.includes(q)) score = 100
            else if (f.path.toLowerCase().includes(q)) score = 10

            return { ...f, score }
          })

          return scored.filter(f => f.score >= 0).sort((a, b) => b.score - a.score).slice(0, 30)
        },
        command: ({ editor, range, props }) => {
          const from = range.from
          const to = range.to
          const fileName = props.title?.replace('.canvas', '') || props.title
          const fullPath = props.path || ''

          // Delete ![ and query, insert canvasLink node
          editor.chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent({
              type: 'canvasLink',
              attrs: {
                id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
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
            container.style.left = `${Math.max(8, rect.left)}px`
            container.style.top = `${Math.min(window.innerHeight - 16, rect.bottom + 6)}px`
            container.style.width = '384px'
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

      // Plugin 3: Handle ^ for block suggestions
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
