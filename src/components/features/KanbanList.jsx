import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Trello, Plus, ExternalLink, RefreshCw } from 'lucide-react'

export default function KanbanList({ workspacePath, onBoardOpen, onCreateBoard }) {
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)

  const loadBoards = useCallback(async () => {
    if (!workspacePath) return

    try {
      setLoading(true)
      const boardList = await invoke('list_kanban_boards', {
        workspacePath
      })
      setBoards(boardList || [])
    } catch (error) {
      console.error('Failed to load kanban boards:', error)
      setBoards([])
    } finally {
      setLoading(false)
    }
  }, [workspacePath])

  useEffect(() => {
    loadBoards()
  }, [loadBoards])

  const handleBoardClick = (board) => {
    if (onBoardOpen) {
      onBoardOpen({
        path: board.path,
        name: board.path.split('/').pop(),
        is_directory: false
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <RefreshCw className="w-4 h-4 animate-spin text-app-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-app-border">
        <div className="flex items-center gap-2">
          <Trello className="w-5 h-5 text-app-muted" />
          <h2 className="font-semibold text-sm text-app-text">Kanban Boards</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadBoards}
            className="p-1.5 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCreateBoard}
            className="p-1.5 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
            title="New Board"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Board List */}
      <div className="flex-1 overflow-y-auto p-2">
        {boards.length === 0 ? (
          <div className="p-4 text-center">
            <Trello className="w-8 h-8 mx-auto mb-2 text-app-muted opacity-50" />
            <p className="text-xs text-app-muted mb-3">No kanban boards yet</p>
            <button
              onClick={onCreateBoard}
              className="px-3 py-1.5 text-xs rounded bg-app-accent text-app-accent-fg hover:bg-app-accent/80"
            >
              Create First Board
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {boards.map((board) => (
              <button
                key={board.path}
                onClick={() => handleBoardClick(board)}
                className="w-full p-3 rounded-lg border border-app-border bg-app-panel/30 hover:bg-app-panel hover:border-app-accent/50 transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Trello className="w-4 h-4 text-app-muted group-hover:text-app-accent flex-shrink-0" />
                    <span className="font-medium text-sm text-app-text truncate">
                      {board.name}
                    </span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-app-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>

                <div className="flex items-center gap-3 text-xs text-app-muted">
                  <span>{board.card_count} {board.card_count === 1 ? 'card' : 'cards'}</span>
                  <span>•</span>
                  <span>{board.column_count} {board.column_count === 1 ? 'column' : 'columns'}</span>
                </div>

                {board.modified && (
                  <div className="mt-1 text-xs text-app-muted/70">
                    {new Date(board.modified).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: new Date(board.modified).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer with quick add */}
      {boards.length > 0 && (
        <div className="border-t border-app-border p-2">
          <button
            onClick={onCreateBoard}
            className="w-full p-2 rounded-lg border border-dashed border-app-border hover:border-app-accent hover:bg-app-accent/5 text-app-muted hover:text-app-accent transition-all text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Board
          </button>
        </div>
      )}
    </div>
  )
}
