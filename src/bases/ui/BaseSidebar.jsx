import React, { useState, useCallback, useRef } from 'react'
import {
  Database,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  Copy,
  TableProperties,
  Grid3X3,
  List,
  Calendar,
  BarChart3,
  Search,
  Settings,
  Folder,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useFolderScope } from '../../contexts/FolderScopeContext.jsx'

// Base view type icons
const viewTypeIcons = {
  table: TableProperties,
  grid: Grid3X3,
  list: List,
  calendar: Calendar,
  chart: BarChart3
}

// Base item context menu
const BaseContextMenu = ({ base, onEdit, onDuplicate, onDelete, onClose, position }) => {
  const menuRef = useRef(null)

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-rgb(var(--panel)) border border-rgb(var(--border)) rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        onClick={() => { onEdit(base); onClose() }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-rgb(var(--panel-secondary)) flex items-center gap-2"
      >
        <Edit2 className="w-4 h-4" />
        Rename
      </button>

      <button
        onClick={() => { onDuplicate(base); onClose() }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-rgb(var(--panel-secondary)) flex items-center gap-2"
      >
        <Copy className="w-4 h-4" />
        Duplicate
      </button>

      <hr className="my-1 border-rgb(var(--border))" />

      <button
        onClick={() => { onDelete(base); onClose() }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-rgb(var(--panel-secondary)) text-rgb(var(--danger)) flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  )
}

// Base item component
const BaseItem = ({
  base,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpanded,
  onEdit,
  onDuplicate,
  onDelete,
  onViewSelect
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }, [])

  const handleMoreClick = useCallback((e) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenuPosition({ x: rect.left, y: rect.bottom + 4 })
    setShowContextMenu(true)
  }, [])

  const views = base.views || [
    { id: 'table', name: 'Table', type: 'table' },
    { id: 'grid', name: 'Grid', type: 'grid' },
    { id: 'list', name: 'List', type: 'list' }
  ]

  return (
    <div className="relative">
      {/* Base header */}
      <div
        className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer group transition-colors ${
          isActive
            ? 'bg-rgb(var(--accent)/0.15) text-rgb(var(--accent))'
            : 'hover:bg-rgb(var(--panel-secondary)/0.6) text-rgb(var(--text))'
        }`}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpanded()
          }}
          className="p-1 rounded hover:bg-rgb(var(--panel-secondary)) flex-shrink-0"
        >
          {isExpanded ?
            <ChevronDown className="w-3 h-3" /> :
            <ChevronRight className="w-3 h-3" />
          }
        </button>

        <Database className="w-4 h-4 flex-shrink-0 opacity-70" />

        <span className="flex-1 text-sm font-medium truncate">
          {base.name}
        </span>

        <span className="text-xs text-rgb(var(--muted)) flex-shrink-0">
          {base.noteCount || 0}
        </span>

        <button
          onClick={handleMoreClick}
          className="p-1 rounded hover:bg-rgb(var(--panel-secondary)) opacity-0 group-hover:opacity-100 flex-shrink-0"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Base views */}
      {isExpanded && (
        <div className="ml-4 mt-1 space-y-1">
          {views.map((view) => {
            const ViewIcon = viewTypeIcons[view.type] || TableProperties
            return (
              <div
                key={view.id}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-rgb(var(--panel-secondary)/0.4) text-rgb(var(--text-secondary)) hover:text-rgb(var(--text))"
                onClick={() => onViewSelect(base, view)}
              >
                <ViewIcon className="w-3 h-3" />
                <span className="text-xs">{view.name}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Context menu */}
      {showContextMenu && (
        <BaseContextMenu
          base={base}
          position={contextMenuPosition}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </div>
  )
}

// New base modal
const NewBaseModal = ({ isOpen, onClose, onCreateBase, workspacePath }) => {
  const [baseName, setBaseName] = useState('')
  const [sourceFolder, setSourceFolder] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!baseName.trim()) return

    setIsCreating(true)
    try {
      await onCreateBase({
        name: baseName.trim(),
        sourceFolder: sourceFolder || workspacePath,
        columns: [
          { key: 'title', label: 'Title', type: 'text', width: 300 },
          { key: 'created', label: 'Created', type: 'date', width: 180 },
          { key: 'tags', label: 'Tags', type: 'tags', width: 200 }
        ]
      })
      setBaseName('')
      setSourceFolder('')
      onClose()
    } catch { } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-rgb(var(--panel)) border border-rgb(var(--border)) rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-rgb(var(--text)) mb-4">
            Create New Base
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
                Base Name
              </label>
              <input
                type="text"
                value={baseName}
                onChange={(e) => setBaseName(e.target.value)}
                className="obsidian-input w-full"
                placeholder="My Base"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
                Source Folder
              </label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rgb(var(--muted))" />
                <input
                  type="text"
                  value={sourceFolder}
                  onChange={(e) => setSourceFolder(e.target.value)}
                  className="obsidian-input w-full pl-10"
                  placeholder={workspacePath || "Select folder..."}
                />
              </div>
              <p className="text-xs text-rgb(var(--muted)) mt-1">
                Notes from this folder will be included in the base
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="obsidian-button flex-1"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="obsidian-button primary flex-1"
                disabled={isCreating || !baseName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Base'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Main BaseSidebar component
export default function BaseSidebar({
  bases = [],
  activeBase,
  activeView,
  onBaseSelect,
  onViewSelect,
  onCreateBase,
  onUpdateBase,
  onDeleteBase,
  className = ''
}) {
  const { workspacePath, getScopeStatus } = useFolderScope()
  const [expandedBases, setExpandedBases] = useState(new Set())
  const [showNewBaseModal, setShowNewBaseModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter bases by search query
  const filteredBases = React.useMemo(() => {
    if (!searchQuery.trim()) return bases
    return bases.filter(base =>
      base.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [bases, searchQuery])

  const handleToggleExpanded = useCallback((baseId) => {
    setExpandedBases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(baseId)) {
        newSet.delete(baseId)
      } else {
        newSet.add(baseId)
      }
      return newSet
    })
  }, [])

  const handleBaseEdit = useCallback((base) => {
    const newName = prompt('Enter new name:', base.name)
    if (newName && newName !== base.name) {
      onUpdateBase(base.id, { name: newName })
    }
  }, [onUpdateBase])

  const handleBaseDuplicate = useCallback((base) => {
    onCreateBase({
      ...base,
      name: `${base.name} Copy`,
      id: undefined
    })
  }, [onCreateBase])

  const handleBaseDelete = useCallback((base) => {
    if (confirm(`Are you sure you want to delete "${base.name}"?`)) {
      onDeleteBase(base.id)
    }
  }, [onDeleteBase])

  const scopeStatus = getScopeStatus()

  return (
    <div className={`flex flex-col bg-rgb(var(--panel)) border-r border-rgb(var(--border)) ${className}`}>
      {/* Sidebar header */}
      <div className="p-4 border-b border-rgb(var(--border))">
        <div className="flex items-center justify-between mb-3 w-full">
          <h2 className="text-sm font-semibold text-rgb(var(--text))">Bases</h2>
          <button
            onClick={() => setShowNewBaseModal(true)}
            className="flex-shrink-0 p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            title="Create new base"
            style={{ backgroundColor: '#4CAF50', color: 'white' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rgb(var(--muted))" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="obsidian-input w-full pl-10 text-sm"
            placeholder="Search bases..."
          />
        </div>

        {/* Scope indicator */}
        {scopeStatus.mode === 'local' && (
          <div className="mt-2 p-2 bg-rgb(var(--accent)/0.1) border border-rgb(var(--accent)/0.2) rounded text-xs text-rgb(var(--accent))">
            📁 {scopeStatus.description}
          </div>
        )}
      </div>

      {/* Bases list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredBases.length > 0 ? (
          <div className="space-y-1">
            {filteredBases.map((base) => (
              <BaseItem
                key={base.id}
                base={base}
                isActive={activeBase?.id === base.id}
                isExpanded={expandedBases.has(base.id)}
                onSelect={() => {
                  onBaseSelect(base.path);
                }}
                onToggleExpanded={() => handleToggleExpanded(base.id)}
                onEdit={handleBaseEdit}
                onDuplicate={handleBaseDuplicate}
                onDelete={handleBaseDelete}
                onViewSelect={onViewSelect}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="flex flex-col items-center justify-center h-32 text-rgb(var(--muted))">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No bases match your search</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-rgb(var(--muted))">
            <Database className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm mb-2">No bases yet</p>
            <button
              onClick={() => setShowNewBaseModal(true)}
              className="obsidian-button primary small"
            >
              Create your first base
            </button>
          </div>
        )}
      </div>

      {/* Sidebar footer */}
      <div className="p-3 border-t border-rgb(var(--border))">
        <button className="obsidian-button w-full text-left">
          <Settings className="w-4 h-4 mr-2" />
          Base Settings
        </button>
      </div>

      {/* New base modal */}
      <NewBaseModal
        isOpen={showNewBaseModal}
        onClose={() => setShowNewBaseModal(false)}
        onCreateBase={onCreateBase}
        workspacePath={workspacePath}
      />
    </div>
  )
}