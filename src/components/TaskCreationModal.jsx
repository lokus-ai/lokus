import React, { useState, useEffect, useRef } from 'react'
import { X, CheckSquare, ChevronRight, Kanban } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

const TaskCreationModal = ({ isOpen, onClose, onCreateTask }) => {
  const [taskName, setTaskName] = useState('')
  const [boards, setBoards] = useState([])
  const [selectedBoardIndex, setSelectedBoardIndex] = useState(0)
  const [showingColumns, setShowingColumns] = useState(false)
  const [columns, setColumns] = useState([])
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  const taskInputRef = useRef(null)
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      loadBoards()
      setTaskName('')
      setShowingColumns(false)
      setSelectedBoardIndex(0)
      setSelectedColumnIndex(0)

      // Focus modal container for keyboard events, then focus task input
      setTimeout(() => {
        modalRef.current?.focus()
        taskInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const loadBoards = async () => {
    try {
      const workspacePath = globalThis.__LOKUS_WORKSPACE_PATH__ || localStorage.getItem('workspace_path')
      if (!workspacePath) {
        return
      }
      const boardInfos = await invoke('list_kanban_boards', { workspacePath })
      setBoards(boardInfos || [])
    } catch { }
  }

  const loadColumns = async (boardInfo) => {
    try {
      const board = await invoke('open_kanban_board', { filePath: boardInfo.path })
      if (board && board.columns) {
        // Convert HashMap to array of {id, name} objects, sorted by order
        const columnsArray = Object.entries(board.columns)
          .map(([id, col]) => ({ id, name: col.name, order: col.order }))
          .sort((a, b) => a.order - b.order)

        setColumns(columnsArray)

        // Find "To-Do" column or default to first
        const todoIndex = columnsArray.findIndex(col =>
          col.name.toLowerCase() === 'to-do' || col.name.toLowerCase() === 'todo' || col.name.toLowerCase() === 'to do'
        )
        setSelectedColumnIndex(todoIndex >= 0 ? todoIndex : 0)
      }
    } catch { }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    // If focus is on task input, arrow keys navigate to board list
    if (document.activeElement === taskInputRef.current) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        taskInputRef.current?.blur()
        return
      }
      return
    }

    // Navigation in board/column list
    if (!showingColumns) {
      // Board selection mode
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedBoardIndex(prev => (prev - 1 + boards.length) % boards.length)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedBoardIndex(prev => (prev + 1) % boards.length)
      } else if (e.key === 'Tab' && boards.length > 0) {
        e.preventDefault()
        // Load columns for selected board
        loadColumns(boards[selectedBoardIndex])
        setShowingColumns(true)
      } else if (e.key === 'Enter' && boards.length > 0) {
        e.preventDefault()
        // Create task in default "To-Do" column
        handleCreateTask(boards[selectedBoardIndex], null)
      }
    } else {
      // Column selection mode
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedColumnIndex(prev => (prev - 1 + columns.length) % columns.length)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedColumnIndex(prev => (prev + 1) % columns.length)
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        setShowingColumns(false)
      } else if (e.key === 'Enter' && columns.length > 0) {
        e.preventDefault()
        handleCreateTask(boards[selectedBoardIndex], columns[selectedColumnIndex])
      }
    }
  }

  const handleCreateTask = async (boardInfo, column) => {
    if (!taskName.trim()) {
      taskInputRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      // Load board to find default column if not specified
      const board = await invoke('open_kanban_board', { filePath: boardInfo.path })
      let targetColumnId = column?.id
      let targetColumnName = column?.name

      if (!targetColumnId) {
        // Find "To-Do" column or use first column
        const columnsArray = Object.entries(board.columns)
          .map(([id, col]) => ({ id, name: col.name, order: col.order }))
          .sort((a, b) => a.order - b.order)

        const todoCol = columnsArray.find(col =>
          col.name.toLowerCase() === 'to-do' || col.name.toLowerCase() === 'todo' || col.name.toLowerCase() === 'to do'
        )
        const defaultCol = todoCol || columnsArray[0]
        targetColumnId = defaultCol?.id
        targetColumnName = defaultCol?.name
      }

      // Create the task using add_card_to_board
      await invoke('add_card_to_board', {
        boardPath: boardInfo.path,
        columnId: targetColumnId,
        title: taskName.trim(),
        description: null,
        tags: [],
        priority: 'normal',
      })

      onCreateTask({
        boardName: boardInfo.name,
        columnName: targetColumnName,
        taskName: taskName.trim()
      })
      onClose()
    } catch { } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[2147483647]"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="rounded-lg shadow-xl border flex flex-col outline-none"
        style={{
          background: 'rgb(var(--panel))',
          borderColor: 'rgb(var(--border))',
          width: '500px',
          maxHeight: '600px',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" style={{ color: 'rgb(var(--accent))' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text))' }}>
              Create New Task
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-opacity-10"
            style={{ color: 'rgb(var(--muted))' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Name Input */}
        <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <input
            ref={taskInputRef}
            type="text"
            placeholder="Task name..."
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="w-full px-3 py-2 rounded border outline-none"
            style={{
              background: 'rgb(var(--background))',
              borderColor: 'rgb(var(--border))',
              color: 'rgb(var(--text))',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && taskName.trim()) {
                e.preventDefault()
                taskInputRef.current?.blur()
              }
            }}
          />
        </div>

        {/* Board/Column List */}
        <div className="flex-1 overflow-y-auto p-2">
          {!showingColumns ? (
            <>
              <div className="px-2 py-1 text-xs font-medium" style={{ color: 'rgb(var(--muted))' }}>
                Select Board {boards.length > 0 && '(↑↓ Navigate • Tab for columns • Enter for To-Do)'}
              </div>
              {boards.length === 0 ? (
                <div className="p-4 text-center text-sm" style={{ color: 'rgb(var(--muted))' }}>
                  No kanban boards found
                </div>
              ) : (
                <div className="flex flex-col gap-1 mt-1">
                  {boards.map((board, index) => (
                    <button
                      key={board.path}
                      onClick={() => {
                        setSelectedBoardIndex(index)
                        handleCreateTask(board, null)
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded text-left transition-colors"
                      style={{
                        background: index === selectedBoardIndex ? 'rgb(var(--accent) / 0.15)' : 'transparent',
                        borderLeft: index === selectedBoardIndex ? '2px solid rgb(var(--accent))' : '2px solid transparent',
                        color: index === selectedBoardIndex ? 'rgb(var(--accent))' : 'rgb(var(--text))',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Kanban className="w-4 h-4" />
                        <span>{board.name}</span>
                      </div>
                      {index === selectedBoardIndex && (
                        <ChevronRight className="w-4 h-4 opacity-70" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="px-2 py-1 text-xs font-medium flex items-center gap-2" style={{ color: 'rgb(var(--muted))' }}>
                <button
                  onClick={() => setShowingColumns(false)}
                  className="hover:underline"
                >
                  ← Back
                </button>
                <span>Select Column (↑↓ Navigate • Enter to confirm)</span>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {columns.map((column, index) => (
                  <button
                    key={column.id}
                    onClick={() => {
                      setSelectedColumnIndex(index)
                      handleCreateTask(boards[selectedBoardIndex], column)
                    }}
                    className="flex items-center px-3 py-2 rounded text-left transition-colors"
                    style={{
                      background: index === selectedColumnIndex ? 'rgb(var(--accent) / 0.15)' : 'transparent',
                      borderLeft: index === selectedColumnIndex ? '2px solid rgb(var(--accent))' : '2px solid transparent',
                      color: index === selectedColumnIndex ? 'rgb(var(--accent))' : 'rgb(var(--text))',
                    }}
                  >
                    {column.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 border-t text-xs flex items-center justify-between"
          style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--muted))' }}
        >
          <span>Esc to cancel</span>
          {loading && <span>Creating...</span>}
        </div>
      </div>
    </div>
  )
}

export default TaskCreationModal
