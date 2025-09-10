import { Extension } from '@tiptap/core'
import * as suggestionMod from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
const suggestion = suggestionMod.default ?? suggestionMod
const WIKI_SUGGESTION_KEY = new PluginKey('wikiLinkSuggestion')
import { ReactRenderer } from '@tiptap/react'
// Use a simple fixed-position portal instead of tippy to avoid overlay issues
import WikiLinkList from '../components/WikiLinkList.jsx'

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

const WikiLinkSuggest = Extension.create({
  name: 'wikiLinkSuggest',
  addProseMirrorPlugins() {
    const dbg = (...args) => {
      try {
        if (globalThis.__LOKUS_SUGGEST_DEBUG__ !== false) {
          console.log('[wikiSuggest]', ...args)
        }
      } catch {}
    }
    return [
      suggestion({
        pluginKey: WIKI_SUGGESTION_KEY,
        editor: this.editor,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        // Be permissive so dropdown always opens on '[' then we adjust UI in onStart
        allow: ({ state, range }) => {
          dbg('allow: true', { from: range.from })
          return true
        },
        items: ({ query }) => {
          const idx = getIndex()
          const active = (globalThis.__LOKUS_ACTIVE_FILE__ || '')
          const filtered = idx.filter(f => !query || f.title.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()))
          const sorted = filtered.sort((a,b) => scoreItem(b, query, active) - scoreItem(a, query, active))
          const out = sorted.slice(0, 30)
          dbg('items', { query, idx: idx.length, out: out.length, sample: out.slice(0,3) })
          return out
        },
        command: ({ editor, range, props }) => {
          // Range covers second '[' and query; include previous '[' as well
          const from = Math.max(range.from - 1, 1)
          const to = range.to
          // Store the full path for resolution, but show the short title.
          const raw = `${props.path || props.title}|${props.title}`
          dbg('command select', { raw, from, to })
          editor.chain().focus().deleteRange({ from, to }).run()
          // Insert our wiki node directly
          editor.commands.setWikiLink(raw, { embed: false })
          // Remove trailing ]] if present right after the cursor
          editor.commands.command(({ state, tr, dispatch }) => {
            const { from: pos } = state.selection
            const next = state.doc.textBetween(pos, pos + 2)
            if (next === ']]') {
              tr.delete(pos, pos + 2)
              dispatch(tr)
            }
            return true
          })
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
              // Auto-pair closing ']]' and keep cursor inside on start
              try {
                const pos = props.range.to
                const next = props.editor.state.doc.textBetween(pos, pos + 2)
                if (next !== ']]') {
                  props.editor.chain().focus().insertContent(']]').setTextSelection(pos).run()
                } else {
                  props.editor.chain().focus().setTextSelection(pos).run()
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
              return component.ref?.onKeyDown(props)
            },
            onExit: () => {
              try { if (container?.parentNode) container.parentNode.removeChild(container) } catch {}
              container = null
              component.destroy()
            },
          }
        },
      }),
    ]
  },
})

export default WikiLinkSuggest
