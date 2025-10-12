import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { CheckSquare, Search } from 'lucide-react'

const TaskMentionList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const { items = [], command } = props

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const selectItem = (index) => {
    const item = items[index]
    if (item) {
      command(item)
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + items.length - 1) % items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        downHandler()
        return true
      }

      return false
    }
  }))

  if (items.length === 0) {
    return (
      <div
        className="flex flex-col gap-2 p-3 rounded-lg border shadow-lg"
        style={{
          background: 'rgb(var(--panel))',
          borderColor: 'rgb(var(--border))',
          minWidth: '350px',
        }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--muted))' }}>
          <CheckSquare className="w-4 h-4" />
          <span>No tasks found</span>
        </div>
        <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
          Use !task to create a new task
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-1 p-2 rounded-lg border shadow-lg max-h-96 overflow-y-auto"
      style={{
        background: 'rgb(var(--panel))',
        borderColor: 'rgb(var(--border))',
        minWidth: '400px',
      }}
    >
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium" style={{ color: 'rgb(var(--muted))' }}>
        <CheckSquare className="w-3 h-3" />
        <span>Mention Task</span>
        <span className="ml-auto">↑↓ Navigate • Enter to select</span>
      </div>
      <div className="h-px" style={{ background: 'rgb(var(--border))' }} />

      {items.map((item, index) => (
        <button
          key={`${item.boardName}-${item.id}`}
          onClick={() => selectItem(index)}
          className="flex flex-col gap-1 px-3 py-2 rounded text-left transition-colors"
          style={{
            background: index === selectedIndex ? 'rgb(var(--accent) / 0.15)' : 'transparent',
            borderLeft: index === selectedIndex ? '2px solid rgb(var(--accent))' : '2px solid transparent',
          }}
        >
          <div
            className="text-sm font-medium truncate"
            style={{ color: index === selectedIndex ? 'rgb(var(--accent))' : 'rgb(var(--text))' }}
          >
            {item.title}
          </div>
          <div
            className="text-xs flex items-center gap-2"
            style={{ color: 'rgb(var(--muted))' }}
          >
            <span>{item.boardName}</span>
            <span>•</span>
            <span>{item.columnName}</span>
          </div>
        </button>
      ))}
    </div>
  )
})

TaskMentionList.displayName = 'TaskMentionList'

export default TaskMentionList
