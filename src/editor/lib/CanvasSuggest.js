import { Extension } from '@tiptap/core'
import * as suggestionMod from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
const suggestion = suggestionMod.default ?? suggestionMod
const CANVAS_SUGGESTION_KEY = new PluginKey('canvasLinkSuggestion')
import { ReactRenderer } from '@tiptap/react'
// Use a simple fixed-position portal instead of tippy to avoid overlay issues
import WikiLinkList from '../components/WikiLinkList.jsx'
import { debounce } from '../../core/search/index.js'

function getIndex() {
  const list = (globalThis.__LOKUS_FILE_INDEX__ || [])
  return Array.isArray(list) ? list : []
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

  // Filter for .canvas files only
  const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))

  for (const file of canvasFiles) {
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
  // Filter for .canvas files only
  const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))
  const filtered = canvasFiles.filter(f => !query || f.title.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()))
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

const CanvasSuggest = Extension.create({
  name: 'canvasSuggest',
  addProseMirrorPlugins() {
    const dbg = (...args) => {
      try {
      } catch {}
    }
    return [
      suggestion({
        pluginKey: CANVAS_SUGGESTION_KEY,
        editor: this.editor,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        // Allow after ![ for canvas embedding
        allow: ({ state, range }) => {
          const $pos = state.selection.$from
          const parentContent = $pos.parent.textContent

          // Get text before the trigger character
          // The trigger '[' is at position range.from, so we check the character before it
          const beforeTriggerPos = Math.max(0, range.from - $pos.start($pos.depth) - 1)
          const charBeforeTrigger = parentContent[beforeTriggerPos]

          // Check for ! character immediately before [ (image/canvas embedding syntax)
          const isAfterImageSyntax = charBeforeTrigger === '!'

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

          const shouldAllow = isAfterImageSyntax && !isInList
          dbg('allow check', {
            charBeforeTrigger,
            beforeTriggerPos,
            isAfterImageSyntax,
            isInList,
            parentType: parentNode.type.name,
            shouldAllow,
            from: range.from
          })
          return shouldAllow
        },
        items: async ({ query, editor }) => {
          const active = (globalThis.__LOKUS_ACTIVE_FILE__ || '')

          // Clean query: remove leading [ if present (happens when typing ![)
          const cleanQuery = query.startsWith('[') ? query.slice(1) : query

          // For empty query, show all canvas files (sorted by recency)
          if (!cleanQuery) {
            const results = filterAndScoreItems('', active)
            cachedResults = results
            lastQuery = ''
            dbg('items (empty query)', { results: results.length })
            return results
          }

          // For single character, use first-char cache for instant results
          if (cleanQuery.length === 1) {
            const idx = getIndex()
            const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))

            // Rebuild cache if empty OR if file index size changed (files added/removed)
            if (firstCharCache.size === 0 || Array.from(firstCharCache.values()).reduce((sum, arr) => sum + arr.length, 0) !== canvasFiles.length) {
              rebuildFirstCharCache()
              dbg('items (rebuilt cache)', { cacheSize: firstCharCache.size, fileCount: canvasFiles.length })
            }

            const firstChar = cleanQuery.toLowerCase()
            const cached = firstCharCache.get(firstChar) || []

            // If cache is empty for this character, fall back to full search
            if (cached.length === 0) {
              const results = filterAndScoreItems(cleanQuery, active)
              cachedResults = results
              lastQuery = cleanQuery
              dbg('items (cache miss, full search)', { query: cleanQuery, results: results.length })
              return results
            }

            const sorted = cached.sort((a,b) => scoreItem(b, cleanQuery, active) - scoreItem(a, cleanQuery, active))
            const results = sorted.slice(0, 30)

            cachedResults = results
            lastQuery = cleanQuery
            dbg('items (first char cache hit)', { query: cleanQuery, cached: cached.length, results: results.length })
            return results
          }

          // Use cached results while debouncing for longer queries
          if (cleanQuery.startsWith(lastQuery) && cachedResults.length > 0) {
            // If query extends last query, filter cached results for instant feedback
            const quickFiltered = cachedResults.filter(f =>
              f.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
              f.path.toLowerCase().includes(cleanQuery.toLowerCase())
            )
            dbg('items (cached)', { query, cleanQuery, lastQuery, cached: cachedResults.length, quickFiltered: quickFiltered.length })

            // Trigger debounced update in background
            debouncedFilter(cleanQuery, active, null)

            return quickFiltered.length > 0 ? quickFiltered : cachedResults
          }

          // For new queries, return immediate results but trigger debounced update
          const immediateResults = filterAndScoreItems(cleanQuery, active)
          dbg('items (new query)', { query, cleanQuery, results: immediateResults.length })
          return immediateResults
        },
        command: async ({ editor, range, props }) => {
          const from = Math.max((range?.from ?? editor.state.selection.from) - 1, 1)
          const to = range?.to ?? editor.state.selection.to
          // Get display name: just the filename without extension
          const rawName = props.title || props.path
          const fileName = rawName.replace(/\.[^.]+$/, '')  // Remove any extension (.canvas, etc.)
          const fullPath = props.path || ''

          // Build relative path from workspace for the link text
          const wsPath = globalThis.__LOKUS_WORKSPACE_PATH__ || ''
          let relativePath = fullPath
          if (wsPath && fullPath.startsWith(wsPath)) {
            relativePath = fullPath.slice(wsPath.length).replace(/^[/\\]/, '')
          }
          // Remove .canvas extension for cleaner display
          relativePath = relativePath.replace(/\.canvas$/, '')

          // Check if there are duplicate filenames - if this is a root file with duplicates, use ./name
          const idx = getIndex()
          const canvasFiles = idx.filter(f => f.path.endsWith('.canvas'))
          const duplicates = canvasFiles.filter(f => f.title === rawName)
          const isRootFile = !relativePath.includes('/') && !relativePath.includes('\\')
          if (duplicates.length > 1 && isRootFile) {
            // Prefix with ./ to explicitly indicate root (prevents same-folder preference)
            relativePath = `./${relativePath}`
          }

          // Format: [[path|displayName]] - path for resolution, displayName for viewing
          const canvasLinkTarget = `${relativePath}|${fileName}`

          dbg('command select (canvas)', { fileName, fullPath, relativePath, canvasLinkTarget, from, to })

          // Delete the ![ and query
          try { editor.chain().focus().deleteRange({ from, to }).run() } catch (e) { dbg('deleteRange error', e) }

          // Create CanvasLink node with path|alias format
          const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
          editor.chain()
            .focus()
            .insertContent({
              type: 'canvasLink',
              attrs: {
                id,
                target: canvasLinkTarget,  // Full format: path|displayName
                alt: fileName,             // Display name only
                embed: true,               // Canvas always embedded
                href: fullPath,            // Full path for navigation
                src: '',
              }
            })
            .run()

          dbg('inserted canvasLink node', { canvasLinkTarget, fullPath })
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
              dbg('onStart', { range: props.range, query: props.query })
              // Only auto-pair if this is actually a canvas link (after ![)
              try {
                const range = props.range
                const textBefore = props.editor.state.doc.textBetween(Math.max(0, range.from - 2), range.from)
                const isCanvasLink = textBefore.endsWith('!')

                if (isCanvasLink) {
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
              dbg('onUpdate', { query: props.query })
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
    ]
  },
})

export default CanvasSuggest
