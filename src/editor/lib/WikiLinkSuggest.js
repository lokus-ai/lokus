import { Extension } from '@tiptap/core'
import * as suggestionMod from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
const suggestion = suggestionMod.default ?? suggestionMod
const WIKI_SUGGESTION_KEY = new PluginKey('wikiLinkSuggestion')
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
    const dbg = (...args) => {
      try {
        console.log('[WikiLinkSuggest]', ...args);
      } catch {}
    }
    return [
      suggestion({
        pluginKey: WIKI_SUGGESTION_KEY,
        editor: this.editor,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        // Allow after [[ for files OR after ^ for blocks
        allow: ({ state, range }) => {
          const $pos = state.selection.$from
          const parentContent = $pos.parent.textContent
          const textBefore = parentContent.slice(Math.max(0, $pos.parentOffset - 2), $pos.parentOffset)

          // Check for [[ pattern (file linking)
          const isAfterDoubleBracket = textBefore.endsWith('[[')

          // Check for ^ pattern within [[ ]] (block linking)
          // Look for pattern: [[Filename^ or [[Filename.md^
          const wikiLinkPattern = /\[\[([^\]]+)\^$/
          const fullTextBefore = parentContent.slice(0, $pos.parentOffset)
          const isAfterCaret = wikiLinkPattern.test(fullTextBefore)

          dbg('textBefore check', {
            textBefore,
            fullTextBefore: fullTextBefore.slice(-20),
            parentOffset: $pos.parentOffset,
            rangeFrom: range.from,
            isAfterCaret
          })

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

          const shouldAllow = (isAfterDoubleBracket || isAfterCaret) && !isInList
          dbg('allow check', {
            textBefore,
            isAfterDoubleBracket,
            isAfterCaret,
            isInList,
            parentType: parentNode.type.name,
            shouldAllow,
            from: range.from
          })
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
          const parentContent = $pos.parent.textContent
          const textBefore = parentContent.slice(0, $pos.parentOffset)

          // Check if we have [[...^ pattern
          const blockRefMatch = /\[\[([^\]^]+)\^(.*)$/.exec(textBefore)

          if (blockRefMatch) {
            // BLOCK MODE: Show blocks from the specified file
            const fileName = blockRefMatch[1].trim()
            const blockQuery = blockRefMatch[2]

            dbg('items (block mode)', { fileName, blockQuery })

            // TODO: Load blocks from file and filter by blockQuery
            // For now, return mock blocks
            return [
              { type: 'block', blockId: 'intro', text: 'Introduction paragraph...', line: 5, fileName },
              { type: 'block', blockId: 'summary', text: 'Summary of key points...', line: 25, fileName },
              { type: 'block', blockId: 'conclusion', text: 'Final thoughts and conclusion...', line: 45, fileName }
            ]
          }

          // FILE MODE: Show files (existing behavior)
          // For empty query or very short queries, return immediately without debouncing
          if (!cleanQuery || cleanQuery.length < 2) {
            const results = filterAndScoreItems(cleanQuery, active)
            cachedResults = results
            lastQuery = cleanQuery
            dbg('items (immediate)', { query, cleanQuery, results: results.length })
            return results
          }

          // Use cached results while debouncing
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
        command: ({ editor, range, props }) => {
          const from = Math.max((range?.from ?? editor.state.selection.from) - 1, 1)
          const to = range?.to ?? editor.state.selection.to

          if (props.type === 'block') {
            // BLOCK MODE: Insert block reference
            const blockId = props.blockId
            dbg('command select (block)', { blockId, from, to })

            // Just insert the blockid (the [[filename^ is already there)
            try {
              editor.chain()
                .focus()
                .deleteRange({ from, to })
                .insertContent(blockId + ']]')
                .run()
            } catch (e) {
              dbg('insertContent error', e)
            }
          } else {
            // FILE MODE: Insert file reference
            const fileName = props.title || props.path
            dbg('command select (file)', { fileName, from, to })

            // Delete the [[ and query
            try { editor.chain().focus().deleteRange({ from, to }).run() } catch (e) { dbg('deleteRange error', e) }

            // Insert as plain text (not WikiLink node) so user can add ^blockid
            const wikiText = `[[${fileName}]]`
            editor.chain()
              .focus()
              .insertContent(wikiText)
              .run()

            // Position cursor before ]] so user can type ^
            const cursorPos = from + fileName.length + 2 // After [[ and fileName
            editor.chain()
              .focus()
              .setTextSelection(cursorPos)
              .run()

            dbg('inserted text', { wikiText, cursorPos })
          }
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
              // Only auto-pair if this is actually a wiki link (after [[)
              try {
                const range = props.range
                const textBefore = props.editor.state.doc.textBetween(Math.max(0, range.from - 2), range.from)
                const isWikiLink = textBefore.endsWith('[')
                
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

export default WikiLinkSuggest