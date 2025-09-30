import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Columns,
  Plus,
  GripVertical,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Type,
  Hash,
  Calendar,
  Tag,
  CheckSquare,
  Link,
  FileText,
  Palette,
  Users,
  Calculator,
  X,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Settings
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../components/ui/dialog.jsx'

// Property type icons
const propertyTypeIcons = {
  text: Type,
  multitext: FileText,
  number: Hash,
  date: Calendar,
  tags: Tag,
  checkbox: CheckSquare,
  url: Link,
  color: Palette,
  person: Users,
  formula: Calculator
}

// Draggable column item
const DraggableColumn = ({
  column,
  index,
  onToggleVisibility,
  onEdit,
  onDelete,
  onReorder,
  isDragging,
  onDragStart,
  onDragEnd
}) => {
  const dragRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const TypeIcon = propertyTypeIcons[column.type] || Type

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', index.toString())
    onDragStart(index)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
    if (fromIndex !== index) {
      onReorder(fromIndex, index)
    }
    onDragEnd()
  }

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isDragging === index
          ? 'border-rgb(var(--accent)) bg-rgb(var(--accent)/0.1) opacity-50'
          : dragOver
            ? 'border-rgb(var(--accent)) bg-rgb(var(--accent)/0.05)'
            : 'border-rgb(var(--border)) hover:border-rgb(var(--border-hover)) hover:bg-rgb(var(--panel-secondary)/0.3)'
      }`}
    >
      {/* Drag handle */}
      <div className="cursor-grab hover:cursor-grabbing text-rgb(var(--muted))">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Column icon and info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <TypeIcon className="w-4 h-4 text-rgb(var(--muted)) flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-rgb(var(--text)) truncate">
            {column.label || column.key}
          </div>
          <div className="text-xs text-rgb(var(--muted)) capitalize">
            {column.type}
            {column.width && ` • ${column.width}px`}
          </div>
        </div>
      </div>

      {/* Column controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggleVisibility(column)}
          className={`obsidian-button icon-only small ${
            column.visible === false ? 'text-rgb(var(--muted))' : ''
          }`}
          title={column.visible === false ? 'Show column' : 'Hide column'}
        >
          {column.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onEdit(column)}
          className="obsidian-button icon-only small"
          title="Edit column"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => onDelete(column)}
          className="obsidian-button icon-only small text-rgb(var(--danger))"
          title="Delete column"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Available properties panel
const AvailableProperties = ({ properties, existingColumns, onAddColumn }) => {
  const [expandedSections, setExpandedSections] = useState(new Set(['available']))

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const existingColumnKeys = new Set(existingColumns.map(col => col.key))
  const availableProperties = properties.filter(prop => !existingColumnKeys.has(prop.key))

  const propertyGroups = {
    available: availableProperties,
    system: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'created', label: 'Created Date', type: 'date' },
      { key: 'modified', label: 'Modified Date', type: 'date' },
      { key: 'path', label: 'File Path', type: 'text' },
      { key: 'size', label: 'File Size', type: 'number' }
    ].filter(prop => !existingColumnKeys.has(prop.key))
  }

  return (
    <div className="space-y-2">
      {Object.entries(propertyGroups).map(([groupName, groupProperties]) => {
        const isExpanded = expandedSections.has(groupName)

        if (groupProperties.length === 0) return null

        return (
          <div key={groupName} className="border border-rgb(var(--border)) rounded-lg">
            <button
              onClick={() => toggleSection(groupName)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-rgb(var(--panel-secondary)/0.3)"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-sm font-medium capitalize">
                  {groupName === 'available' ? 'Custom Properties' : 'System Properties'}
                </span>
                <span className="text-xs text-rgb(var(--muted)) bg-rgb(var(--panel-secondary)) px-2 py-0.5 rounded">
                  {groupProperties.length}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-rgb(var(--border)) p-2 space-y-1">
                {groupProperties.map((property) => {
                  const TypeIcon = propertyTypeIcons[property.type] || Type

                  return (
                    <div
                      key={property.key}
                      className="flex items-center justify-between p-2 rounded hover:bg-rgb(var(--panel-secondary)/0.3) group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <TypeIcon className="w-4 h-4 text-rgb(var(--muted)) flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-rgb(var(--text)) truncate">
                            {property.label || property.key}
                          </div>
                          <div className="text-xs text-rgb(var(--muted)) capitalize">
                            {property.type}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onAddColumn(property)}
                        className="obsidian-button icon-only small opacity-0 group-hover:opacity-100"
                        title="Add as column"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {Object.values(propertyGroups).every(group => group.length === 0) && (
        <div className="text-center p-6 text-rgb(var(--muted))">
          <Columns className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">All available properties are already added as columns</p>
        </div>
      )}
    </div>
  )
}

// Column settings editor
const ColumnSettingsEditor = ({ column, onSave, onCancel }) => {
  const [settings, setSettings] = useState({
    label: column.label || column.key,
    width: column.width || 200,
    visible: column.visible !== false,
    sortable: column.sortable !== false,
    resizable: column.resizable !== false,
    ...column.settings
  })

  const handleSave = () => {
    onSave({
      ...column,
      ...settings,
      settings: {
        ...column.settings,
        ...settings
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
          Column Label
        </label>
        <input
          type="text"
          value={settings.label}
          onChange={(e) => setSettings(prev => ({ ...prev, label: e.target.value }))}
          className="obsidian-input w-full"
          placeholder="Column name..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
          Width (pixels)
        </label>
        <input
          type="number"
          value={settings.width}
          onChange={(e) => setSettings(prev => ({ ...prev, width: Number(e.target.value) }))}
          className="obsidian-input w-full"
          min="100"
          max="1000"
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-rgb(var(--text))">
          Column Options
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.visible}
            onChange={(e) => setSettings(prev => ({ ...prev, visible: e.target.checked }))}
            className="rounded border-rgb(var(--border)) focus:ring-rgb(var(--accent))"
          />
          <span className="text-sm">Visible in table</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.sortable}
            onChange={(e) => setSettings(prev => ({ ...prev, sortable: e.target.checked }))}
            className="rounded border-rgb(var(--border)) focus:ring-rgb(var(--accent))"
          />
          <span className="text-sm">Allow sorting</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.resizable}
            onChange={(e) => setSettings(prev => ({ ...prev, resizable: e.target.checked }))}
            className="rounded border-rgb(var(--border)) focus:ring-rgb(var(--accent))"
          />
          <span className="text-sm">Allow resizing</span>
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="obsidian-button flex-1"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="obsidian-button primary flex-1"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}

// Main ColumnManager component
export default function ColumnManager({
  isOpen,
  onClose,
  columns = [],
  availableProperties = [],
  onUpdateColumns,
  onCreateProperty
}) {
  const [localColumns, setLocalColumns] = useState(columns)
  const [editingColumn, setEditingColumn] = useState(null)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Sync local columns with prop changes
  useEffect(() => {
    setLocalColumns(columns)
    setHasChanges(false)
  }, [columns])

  // Mark changes when local columns change
  useEffect(() => {
    const columnsChanged = JSON.stringify(localColumns) !== JSON.stringify(columns)
    setHasChanges(columnsChanged)
  }, [localColumns, columns])

  const handleReorderColumns = useCallback((fromIndex, toIndex) => {
    setLocalColumns(prev => {
      const newColumns = [...prev]
      const [removed] = newColumns.splice(fromIndex, 1)
      newColumns.splice(toIndex, 0, removed)
      return newColumns
    })
  }, [])

  const handleToggleVisibility = useCallback((column) => {
    setLocalColumns(prev => prev.map(col =>
      col.key === column.key ? { ...col, visible: !col.visible } : col
    ))
  }, [])

  const handleEditColumn = useCallback((column) => {
    setEditingColumn(column)
  }, [])

  const handleDeleteColumn = useCallback((column) => {
    if (confirm(`Are you sure you want to remove the "${column.label || column.key}" column?`)) {
      setLocalColumns(prev => prev.filter(col => col.key !== column.key))
    }
  }, [])

  const handleAddColumn = useCallback((property) => {
    const newColumn = {
      key: property.key,
      label: property.label || property.key,
      type: property.type,
      width: 200,
      visible: true,
      sortable: true,
      resizable: true
    }
    setLocalColumns(prev => [...prev, newColumn])
  }, [])

  const handleSaveColumnSettings = useCallback((updatedColumn) => {
    setLocalColumns(prev => prev.map(col =>
      col.key === updatedColumn.key ? updatedColumn : col
    ))
    setEditingColumn(null)
  }, [])

  const handleSaveChanges = useCallback(async () => {
    setIsSaving(true)
    try {
      await onUpdateColumns(localColumns)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save column changes:', error)
    } finally {
      setIsSaving(false)
    }
  }, [localColumns, onUpdateColumns])

  const handleResetChanges = useCallback(() => {
    setLocalColumns(columns)
    setHasChanges(false)
  }, [columns])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Manage Columns</DialogTitle>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-xs text-rgb(var(--warning)) bg-rgb(var(--warning)/0.1) px-2 py-1 rounded">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={() => onCreateProperty?.()}
                className="obsidian-button small"
                title="Create new property"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Property
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Current columns */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-rgb(var(--text))">
                Current Columns ({localColumns.length})
              </h3>
              <div className="flex items-center gap-2 text-xs text-rgb(var(--muted))">
                <GripVertical className="w-4 h-4" />
                Drag to reorder
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {localColumns.length > 0 ? (
                localColumns.map((column, index) => (
                  <DraggableColumn
                    key={column.key}
                    column={column}
                    index={index}
                    onToggleVisibility={handleToggleVisibility}
                    onEdit={handleEditColumn}
                    onDelete={handleDeleteColumn}
                    onReorder={handleReorderColumns}
                    isDragging={draggingIndex}
                    onDragStart={setDraggingIndex}
                    onDragEnd={() => setDraggingIndex(null)}
                  />
                ))
              ) : (
                <div className="text-center p-8 text-rgb(var(--muted))">
                  <Columns className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No columns added yet</p>
                  <p className="text-xs mt-1">Add properties from the right panel</p>
                </div>
              )}
            </div>
          </div>

          {/* Available properties */}
          <div className="w-80 border-l border-rgb(var(--border)) pl-6">
            <h3 className="font-medium text-rgb(var(--text)) mb-4">
              Available Properties
            </h3>
            <div className="max-h-96 overflow-y-auto">
              <AvailableProperties
                properties={availableProperties}
                existingColumns={localColumns}
                onAddColumn={handleAddColumn}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              {hasChanges && (
                <button
                  onClick={handleResetChanges}
                  className="obsidian-button"
                  disabled={isSaving}
                >
                  Reset Changes
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="obsidian-button"
                disabled={isSaving}
              >
                {hasChanges ? 'Cancel' : 'Close'}
              </button>
              {hasChanges && (
                <button
                  onClick={handleSaveChanges}
                  className="obsidian-button primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Column settings modal */}
      {editingColumn && (
        <Dialog open={!!editingColumn} onOpenChange={() => setEditingColumn(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Column Settings</DialogTitle>
            </DialogHeader>
            <ColumnSettingsEditor
              column={editingColumn}
              onSave={handleSaveColumnSettings}
              onCancel={() => setEditingColumn(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}