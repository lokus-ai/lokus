import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Command, CommandList, CommandItem, CommandEmpty, CommandSeparator } from '../../components/ui/command'
import { Link2, Plus } from 'lucide-react'
import { exitSuggestion } from '../lib/suggestion-plugin.js'
import { IMAGE_EMBED_KEY } from '../lib/WikiLinkSuggest.js'
import katex from 'katex'

const IMPORT_URL_KEY = '__import_url__'
const CREATE_GRAPH_KEY = '__create_graph__'

function KatexExpressions({ expressions }) {
  if (!expressions || expressions.length === 0) return null

  const preview = expressions.slice(0, 3)
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 min-w-0 items-baseline">
      {preview.map((latex, i) => {
        try {
          const html = katex.renderToString(latex, { throwOnError: false, displayMode: false })
          return (
            <span
              key={i}
              className="text-xs"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        } catch {
          return <span key={i} className="text-xs text-app-muted font-mono">{latex}</span>
        }
      })}
      {expressions.length > 3 && (
        <span className="text-xs text-app-muted">+{expressions.length - 3} more</span>
      )}
    </div>
  )
}

const WikiLinkList = forwardRef((props, ref) => {
  const [value, setValue] = useState('')
  const [creatingGraph, setCreatingGraph] = useState(false)
  const [newGraphName, setNewGraphName] = useState('')
  const inputRef = useRef(null)
  const items = props.items || []
  const isImageMode = props.isImageMode || false

  // Add "Import from URL" option for image mode
  const allItems = useMemo(() => {
    if (isImageMode) {
      return [...items, { type: 'import_url', path: IMPORT_URL_KEY, title: 'Import from URL' }]
    }
    return items
  }, [items, isImageMode])

  const relPath = (p) => {
    try {
      const ws = globalThis.__LOKUS_WORKSPACE_PATH__ || ''
      if (ws && p.startsWith(ws)) {
        const rel = p.slice(ws.length)
        return rel.startsWith('/') ? rel.slice(1) : rel
      }
      return p
    } catch { return p }
  }

  useEffect(() => {
    if (allItems.length) setValue(allItems[0].path)
  }, [allItems])

  useEffect(() => {
    if (creatingGraph && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creatingGraph])

  const select = (path) => {
    if (path === CREATE_GRAPH_KEY) {
      setCreatingGraph(true)
      setNewGraphName('')
      return
    }

    if (path === IMPORT_URL_KEY) {
      const editor = props.editor
      const { state } = editor
      const $pos = state.selection.$from

      // Find where ![[ starts in current paragraph
      const textBefore = state.doc.textBetween($pos.start(), $pos.pos)
      const openBracketPos = textBefore.lastIndexOf('![[')
      const from = openBracketPos !== -1 ? $pos.pos - (textBefore.length - openBracketPos) : $pos.pos

      // Find ]] after cursor
      const textAfter = state.doc.textBetween($pos.pos, Math.min($pos.pos + 10, state.doc.content.size))
      const hasClosing = textAfter.startsWith(']]')
      const to = hasClosing ? $pos.pos + 2 : $pos.pos

      // Dismiss the image embed suggestion dropdown first
      try {
        exitSuggestion(editor, IMAGE_EMBED_KEY)
      } catch {}

      // Open URL modal with PM-based insertion callback
      window.dispatchEvent(new CustomEvent('lokus:open-image-url-modal', {
        detail: {
          onSubmit: (url) => {
            const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
            editor.dom.focus({ preventScroll: true })
            const tr = editor.state.tr.delete(from, to)
            const insertPos = tr.mapping.map(from)
            const node = editor.state.schema.nodeFromJSON({
              type: 'wikiLink',
              attrs: { id, target: url, alt: '', embed: true, href: url, src: url }
            })
            tr.insert(insertPos, node)
            tr.scrollIntoView()
            editor.dispatch(tr)
          }
        }
      }))
      return
    }
    const item = allItems.find(i => i.path === path)
    if (item) props.command(item)
  }

  const submitNewGraph = () => {
    const name = newGraphName.trim()
    if (!name) return

    setCreatingGraph(false)

    // Pass back as a create_graph command with the name embedded
    const createItem = allItems.find(i => i.type === 'create_graph')
    if (createItem && props.command) {
      props.command({ ...createItem, newFileName: name })
    }
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // When in create-graph input mode, let the input handle keys
      if (creatingGraph) {
        if (event.key === 'Enter') {
          event.preventDefault()
          submitNewGraph()
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setCreatingGraph(false)
          return true
        }
        // Let all other keys pass through to the input
        return true
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const idx = allItems.findIndex(i => i.path === value)
        if (idx !== -1) {
          const next = event.key === 'ArrowDown' ? (idx + 1) % allItems.length : (idx - 1 + allItems.length) % allItems.length
          setValue(allItems[next].path)
        }
        return true
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        select(value)
        return true
      }
      return false
    }
  }))

  const isBlockMode = items.length > 0 && items[0].type === 'block'
  const isGraphMode = props.isGraphMode || false

  const getEmptyMessage = () => {
    if (isGraphMode) return 'No .graph files found'
    if (isImageMode) return 'No images found \u2022 Select "Import from URL" below'
    if (isBlockMode) return 'No blocks found'
    return 'No files'
  }

  const getHelpText = () => {
    if (creatingGraph) return 'Enter create \u2022 Esc cancel'
    if (isGraphMode) return 'Enter select \u2022 \u2191\u2193 navigate'
    if (isImageMode) return 'Enter select \u2022 \u2191\u2193 navigate'
    if (isBlockMode) return 'Enter select \u2022 \u2191\u2193 navigate'
    return 'Enter select \u2022 \u2191\u2193 navigate \u2022 Type | to set display'
  }

  // Separate regular items from special options
  const regularItems = allItems.filter(i => i.type !== 'import_url' && i.type !== 'create_graph')
  const importUrlItem = allItems.find(i => i.type === 'import_url')
  const createGraphItem = allItems.find(i => i.type === 'create_graph')

  // When in create mode, show inline input instead of list
  if (creatingGraph) {
    return (
      <div className="w-96 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text">
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-teal-500 shrink-0" />
            <span className="font-medium text-sm">New graph file</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newGraphName}
              onChange={(e) => setNewGraphName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  submitNewGraph()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  setCreatingGraph(false)
                }
              }}
              placeholder="filename"
              className="flex-1 px-2 py-1.5 text-sm bg-app-bg border border-app-border rounded focus:outline-none focus:border-teal-500 text-app-text placeholder:text-app-muted/50"
              autoFocus
            />
            <span className="text-xs text-app-muted">.graph</span>
          </div>
        </div>
        <div className="px-3 py-2 text-xs text-app-muted border-t border-app-border">
          {getHelpText()}
        </div>
      </div>
    )
  }

  return (
    <Command value={value} onValueChange={setValue} className="w-96 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text">
      <CommandList className="max-h-[60vh] overflow-auto">
        <CommandEmpty>{getEmptyMessage()}</CommandEmpty>
        {regularItems.map(item => {
          const active = value === item.path
          const isBlock = item.type === 'block'
          const isUrl = item.type === 'url'
          const isImage = item.type === 'image'
          const isGraph = item.type === 'graph'

          return (
            <CommandItem
              key={`${item.path}`}
              value={item.path}
              onSelect={select}
              aria-selected={active}
              className={active ? 'bg-app-accent/20 text-app-text' : ''}
            >
              {isGraph ? (
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="rgb(20, 184, 166)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <div className="flex flex-col min-w-0 gap-0.5">
                    {item.expressions && item.expressions.length > 0 ? (
                      <>
                        <KatexExpressions expressions={item.expressions} />
                        <span className="text-xs text-app-muted truncate">{item.title}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium truncate">{item.title}</span>
                        <span className="text-xs text-app-muted truncate">{relPath(item.path)}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : isUrl ? (
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-app-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium">Insert from URL</span>
                    <span className="text-xs text-app-muted truncate">{item.url}</span>
                  </div>
                </div>
              ) : isBlock ? (
                <div className="flex flex-col min-w-0 gap-1">
                  <div className="flex items-center gap-2">
                    {item.blockType === 'heading' && (
                      <span className="text-app-muted text-xs">
                        {'#'.repeat(item.level || 1)}
                      </span>
                    )}
                    <span className="font-medium truncate">{item.title}</span>
                  </div>
                  {item.text && item.text !== item.title && (
                    <span className="text-xs text-app-muted truncate line-clamp-2">
                      {item.text}
                    </span>
                  )}
                  <span className="text-xs text-app-muted/60 truncate">
                    ^{item.blockId} &bull; Line {item.line}
                  </span>
                </div>
              ) : isImage ? (
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-app-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{item.title}</span>
                    <span className="text-xs text-app-muted truncate">{relPath(item.path)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{item.title}</span>
                  <span className="text-xs text-app-muted truncate">{relPath(item.path)}</span>
                </div>
              )}
            </CommandItem>
          )
        })}

        {/* Import from URL option - always at bottom for image mode */}
        {importUrlItem && (
          <>
            {regularItems.length > 0 && <CommandSeparator />}
            <CommandItem
              key={IMPORT_URL_KEY}
              value={IMPORT_URL_KEY}
              onSelect={select}
              aria-selected={value === IMPORT_URL_KEY}
              className={value === IMPORT_URL_KEY ? 'bg-app-accent/20 text-app-text' : ''}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium">Import from URL</span>
                  <span className="text-xs text-app-muted">Paste or type an image URL</span>
                </div>
              </div>
            </CommandItem>
          </>
        )}

        {/* Create new graph option - always at bottom for graph mode */}
        {createGraphItem && (
          <>
            {regularItems.length > 0 && <CommandSeparator />}
            <CommandItem
              key={CREATE_GRAPH_KEY}
              value={CREATE_GRAPH_KEY}
              onSelect={select}
              aria-selected={value === CREATE_GRAPH_KEY}
              className={value === CREATE_GRAPH_KEY ? 'bg-app-accent/20 text-app-text' : ''}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Plus className="w-4 h-4 text-teal-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium">Create new graph</span>
                  <span className="text-xs text-app-muted">Create a new .graph file</span>
                </div>
              </div>
            </CommandItem>
          </>
        )}
      </CommandList>
      <div className="px-3 py-2 text-xs text-app-muted border-t border-app-border">
        {getHelpText()}
      </div>
    </Command>
  )
})

WikiLinkList.displayName = 'WikiLinkList'

export default WikiLinkList
