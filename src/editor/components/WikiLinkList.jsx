import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Command, CommandList, CommandItem, CommandEmpty, CommandSeparator } from '../../components/ui/command'
import { Link2 } from 'lucide-react'

const IMPORT_URL_KEY = '__import_url__'

const WikiLinkList = forwardRef((props, ref) => {
  const [value, setValue] = useState('')
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

  const select = (path) => {
    if (path === IMPORT_URL_KEY) {
      // Store editor reference and current position for later use
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

      // Open URL input modal with callback that handles insertion directly
      window.dispatchEvent(new CustomEvent('lokus:open-image-url-modal', {
        detail: {
          onSubmit: (url) => {
            // Insert wikiLink node directly with the URL
            const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
            editor.chain()
              .focus()
              .deleteRange({ from, to })
              .insertContent({
                type: 'wikiLink',
                attrs: {
                  id,
                  target: url,
                  alt: '',
                  embed: true,
                  href: url,
                  src: url
                }
              })
              .run()
          }
        }
      }))
      return
    }
    const item = allItems.find(i => i.path === path)
    if (item) props.command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
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

  const getEmptyMessage = () => {
    if (isImageMode) return 'No images found • Select "Import from URL" below'
    if (isBlockMode) return 'No blocks found'
    return 'No files'
  }

  const getHelpText = () => {
    if (isImageMode) return 'Enter select • ↑↓ navigate'
    if (isBlockMode) return 'Enter select • ↑↓ navigate'
    return 'Enter select • ↑↓ navigate • Type | to set display'
  }

  // Separate regular items from the import URL option
  const regularItems = allItems.filter(i => i.type !== 'import_url')
  const importUrlItem = allItems.find(i => i.type === 'import_url')

  return (
    <Command value={value} onValueChange={setValue} className="w-96 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text">
      <CommandList className="max-h-[60vh] overflow-auto">
        <CommandEmpty>{getEmptyMessage()}</CommandEmpty>
        {regularItems.map(item => {
          const active = value === item.path
          const isBlock = item.type === 'block'
          const isUrl = item.type === 'url'
          const isImage = item.type === 'image'

          return (
            <CommandItem
              key={`${item.path}`}
              value={item.path}
              onSelect={select}
              aria-selected={active}
              className={active ? 'bg-app-accent/20 text-app-text' : ''}
            >
              {isUrl ? (
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
                    ^{item.blockId} • Line {item.line}
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
      </CommandList>
      <div className="px-3 py-2 text-xs text-app-muted border-t border-app-border">
        {getHelpText()}
      </div>
    </Command>
  )
})

WikiLinkList.displayName = 'WikiLinkList'

export default WikiLinkList