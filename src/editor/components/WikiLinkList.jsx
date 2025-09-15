import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Command, CommandList, CommandItem, CommandEmpty } from '../../components/ui/command'

const WikiLinkList = forwardRef((props, ref) => {
  const [value, setValue] = useState('')
  const items = props.items || []

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
    if (items.length) setValue(items[0].path)
  }, [items])

  const select = (path) => {
    const item = items.find(i => i.path === path)
    if (item) props.command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const idx = items.findIndex(i => i.path === value)
        if (idx !== -1) {
          const next = event.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length
          setValue(items[next].path)
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

  return (
    <Command value={value} onValueChange={setValue} className="w-96 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text">
      <CommandList className="max-h-[60vh] overflow-auto">
        <CommandEmpty>No files</CommandEmpty>
        {items.map(item => {
          const active = value === item.path
          return (
            <CommandItem
              key={`${item.path}`}
              value={item.path}
              onSelect={select}
              aria-selected={active}
              className={active ? 'bg-app-accent/20 text-app-text' : ''}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{item.title}</span>
                <span className="text-xs text-app-muted truncate">{relPath(item.path)}</span>
              </div>
            </CommandItem>
          )
        })}
      </CommandList>
      <div className="px-3 py-2 text-xs text-app-muted border-t border-app-border">
        Enter select • ↑↓ navigate • Type | to set display
      </div>
    </Command>
  )
})

WikiLinkList.displayName = 'WikiLinkList'

export default WikiLinkList
