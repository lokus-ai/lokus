import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  X,
  Save,
  AlertCircle,
  Type,
  Hash,
  Calendar,
  Tag,
  CheckSquare,
  Link,
  FileText,
  Palette,
  Users,
  RefreshCw,
  Plus,
  Minus,
  Eye,
  EyeOff
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../components/ui/dialog.jsx'

// Property type configurations
const PROPERTY_TYPES = {
  text: {
    icon: Type,
    label: 'Text',
    description: 'Single line of text',
    defaultValue: '',
    validation: (value) => typeof value === 'string'
  },
  multitext: {
    icon: FileText,
    label: 'Multi-line Text',
    description: 'Multiple lines of text',
    defaultValue: '',
    validation: (value) => typeof value === 'string'
  },
  number: {
    icon: Hash,
    label: 'Number',
    description: 'Numeric value',
    defaultValue: 0,
    validation: (value) => !isNaN(Number(value))
  },
  date: {
    icon: Calendar,
    label: 'Date',
    description: 'Date and time',
    defaultValue: () => new Date().toISOString(),
    validation: (value) => !isNaN(new Date(value).getTime())
  },
  tags: {
    icon: Tag,
    label: 'Tags',
    description: 'Multiple tags/labels',
    defaultValue: [],
    validation: (value) => Array.isArray(value)
  },
  checkbox: {
    icon: CheckSquare,
    label: 'Checkbox',
    description: 'True/false value',
    defaultValue: false,
    validation: (value) => typeof value === 'boolean'
  },
  url: {
    icon: Link,
    label: 'URL',
    description: 'Web address',
    defaultValue: '',
    validation: (value) => {
      try {
        new URL(value)
        return true
      } catch {
        return !value || value === ''
      }
    }
  },
  color: {
    icon: Palette,
    label: 'Color',
    description: 'Color picker',
    defaultValue: '#3B82F6',
    validation: (value) => /^#[0-9A-F]{6}$/i.test(value)
  },
  person: {
    icon: Users,
    label: 'Person',
    description: 'Person or user reference',
    defaultValue: '',
    validation: (value) => typeof value === 'string'
  }
}

// Property type selector
const PropertyTypeSelector = ({ selectedType, onTypeChange }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(PROPERTY_TYPES).map(([type, config]) => {
        const Icon = config.icon
        const isSelected = selectedType === type

        return (
          <button
            key={type}
            type="button"
            onClick={() => onTypeChange(type)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              isSelected
                ? 'border-rgb(var(--accent)) bg-rgb(var(--accent)/0.1) text-rgb(var(--accent))'
                : 'border-rgb(var(--border)) hover:border-rgb(var(--border-hover)) hover:bg-rgb(var(--panel-secondary))'
            }`}
          >
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-medium text-sm">{config.label}</div>
                <div className="text-xs text-rgb(var(--muted)) mt-1 line-clamp-2">
                  {config.description}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// Property value editor based on type
const PropertyValueEditor = ({ type, value, onChange, property, error }) => {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((newValue) => {
    setLocalValue(newValue)
    onChange(newValue)
  }, [onChange])

  switch (type) {
    case 'multitext':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Value
          </label>
          <textarea
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={`obsidian-input min-h-[100px] ${error ? 'border-rgb(var(--danger))' : ''}`}
            placeholder="Enter text..."
            rows={4}
          />
        </div>
      )

    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Value
          </label>
          <input
            type="number"
            value={localValue || ''}
            onChange={(e) => handleChange(Number(e.target.value))}
            className={`obsidian-input ${error ? 'border-rgb(var(--danger))' : ''}`}
            placeholder="Enter number..."
          />
        </div>
      )

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Value
          </label>
          <input
            type="datetime-local"
            value={localValue ? new Date(localValue).toISOString().slice(0, 16) : ''}
            onChange={(e) => handleChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className={`obsidian-input ${error ? 'border-rgb(var(--danger))' : ''}`}
          />
        </div>
      )

    case 'tags':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Tags
          </label>
          <div className="space-y-2">
            {(localValue || []).map((tag, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => {
                    const newTags = [...(localValue || [])]
                    newTags[index] = e.target.value
                    handleChange(newTags)
                  }}
                  className="obsidian-input flex-1"
                  placeholder="Tag name..."
                />
                <button
                  type="button"
                  onClick={() => {
                    const newTags = (localValue || []).filter((_, i) => i !== index)
                    handleChange(newTags)
                  }}
                  className="obsidian-button icon-only small text-rgb(var(--danger))"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => handleChange([...(localValue || []), ''])}
              className="obsidian-button text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tag
            </button>
          </div>
        </div>
      )

    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(localValue)}
              onChange={(e) => handleChange(e.target.checked)}
              className="rounded border-rgb(var(--border)) focus:ring-rgb(var(--accent))"
            />
            <span className="text-sm font-medium text-rgb(var(--text))">
              Enabled
            </span>
          </label>
        </div>
      )

    case 'url':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            URL
          </label>
          <input
            type="url"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={`obsidian-input ${error ? 'border-rgb(var(--danger))' : ''}`}
            placeholder="https://example.com"
          />
        </div>
      )

    case 'color':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localValue || '#3B82F6'}
              onChange={(e) => handleChange(e.target.value)}
              className="w-12 h-10 rounded border border-rgb(var(--border)) cursor-pointer"
            />
            <input
              type="text"
              value={localValue || '#3B82F6'}
              onChange={(e) => handleChange(e.target.value)}
              className={`obsidian-input flex-1 ${error ? 'border-rgb(var(--danger))' : ''}`}
              placeholder="#3B82F6"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>
      )

    case 'person':
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Person
          </label>
          <input
            type="text"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={`obsidian-input ${error ? 'border-rgb(var(--danger))' : ''}`}
            placeholder="Enter name or email..."
          />
        </div>
      )

    default: // text
      return (
        <div>
          <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
            Value
          </label>
          <input
            type="text"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={`obsidian-input ${error ? 'border-rgb(var(--danger))' : ''}`}
            placeholder="Enter text..."
          />
        </div>
      )
  }
}

// Bulk editor for multiple properties
const BulkPropertyEditor = ({ properties, notes, onUpdateNotes, onClose }) => {
  const [selectedProperty, setSelectedProperty] = useState('')
  const [newValue, setNewValue] = useState('')
  const [operation, setOperation] = useState('replace') // replace, append, clear

  const property = properties.find(p => p.key === selectedProperty)
  const affectedNotes = notes.filter(note => selectedProperty in (note.properties || {}))

  const handleBulkUpdate = useCallback(() => {
    if (!selectedProperty) return

    const updates = {}
    notes.forEach(note => {
      const noteId = note.id
      const currentValue = note.properties?.[selectedProperty]

      let updatedValue
      switch (operation) {
        case 'replace':
          updatedValue = newValue
          break
        case 'append':
          if (property?.type === 'tags') {
            const currentTags = Array.isArray(currentValue) ? currentValue : []
            const newTags = newValue.split(',').map(t => t.trim()).filter(Boolean)
            updatedValue = [...currentTags, ...newTags]
          } else {
            updatedValue = (currentValue || '') + ' ' + newValue
          }
          break
        case 'clear':
          updatedValue = property?.type === 'tags' ? [] : ''
          break
        default:
          updatedValue = newValue
      }

      updates[noteId] = { [selectedProperty]: updatedValue }
    })

    onUpdateNotes(updates)
    onClose()
  }, [selectedProperty, newValue, operation, notes, property, onUpdateNotes, onClose])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
          Property to Update
        </label>
        <select
          value={selectedProperty}
          onChange={(e) => setSelectedProperty(e.target.value)}
          className="obsidian-input"
        >
          <option value="">Select property...</option>
          {properties.map(prop => (
            <option key={prop.key} value={prop.key}>
              {prop.label || prop.key} ({prop.type})
            </option>
          ))}
        </select>
      </div>

      {selectedProperty && (
        <>
          <div>
            <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
              Operation
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOperation('replace')}
                className={`p-2 text-sm rounded border ${
                  operation === 'replace'
                    ? 'border-rgb(var(--accent)) bg-rgb(var(--accent)/0.1)'
                    : 'border-rgb(var(--border)) hover:border-rgb(var(--border-hover))'
                }`}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setOperation('append')}
                className={`p-2 text-sm rounded border ${
                  operation === 'append'
                    ? 'border-rgb(var(--accent)) bg-rgb(var(--accent)/0.1)'
                    : 'border-rgb(var(--border)) hover:border-rgb(var(--border-hover))'
                }`}
              >
                Append
              </button>
              <button
                type="button"
                onClick={() => setOperation('clear')}
                className={`p-2 text-sm rounded border ${
                  operation === 'clear'
                    ? 'border-rgb(var(--danger)) bg-rgb(var(--danger)/0.1)'
                    : 'border-rgb(var(--border)) hover:border-rgb(var(--border-hover))'
                }`}
              >
                Clear
              </button>
            </div>
          </div>

          {operation !== 'clear' && (
            <PropertyValueEditor
              type={property?.type || 'text'}
              value={newValue}
              onChange={setNewValue}
              property={property}
            />
          )}

          <div className="p-3 bg-rgb(var(--panel-secondary)) rounded">
            <div className="text-sm font-medium text-rgb(var(--text)) mb-1">
              Preview
            </div>
            <div className="text-xs text-rgb(var(--muted))">
              This will update {notes.length} notes.
              {affectedNotes.length < notes.length && (
                <span className="text-rgb(var(--warning))">
                  {' '}({notes.length - affectedNotes.length} notes don't have this property)
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="obsidian-button flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkUpdate}
              className="obsidian-button primary flex-1"
              disabled={!selectedProperty || (operation !== 'clear' && !newValue)}
            >
              Update {notes.length} Notes
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Main PropertyEditor component
export default function PropertyEditor({
  isOpen,
  onClose,
  property = null,
  notes = [],
  mode = 'single', // 'single' or 'bulk'
  onSave,
  onUpdate,
  availableProperties = []
}) {
  const [editedProperty, setEditedProperty] = useState(property || {
    key: '',
    label: '',
    type: 'text',
    value: '',
    required: false,
    visible: true
  })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when property changes
  useEffect(() => {
    if (property) {
      setEditedProperty({ ...property })
    } else {
      setEditedProperty({
        key: '',
        label: '',
        type: 'text',
        value: PROPERTY_TYPES.text.defaultValue,
        required: false,
        visible: true
      })
    }
    setErrors({})
  }, [property])

  const validateProperty = useCallback((prop) => {
    const newErrors = {}

    if (!prop.key) {
      newErrors.key = 'Property key is required'
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(prop.key)) {
      newErrors.key = 'Key must start with a letter and contain only letters, numbers, and underscores'
    }

    if (!prop.label) {
      newErrors.label = 'Property label is required'
    }

    const typeConfig = PROPERTY_TYPES[prop.type]
    if (typeConfig && !typeConfig.validation(prop.value)) {
      newErrors.value = `Invalid ${typeConfig.label.toLowerCase()} value`
    }

    return newErrors
  }, [])

  const handleSave = useCallback(async () => {
    const validationErrors = validateProperty(editedProperty)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSaving(true)
    try {
      if (property) {
        await onUpdate(editedProperty)
      } else {
        await onSave(editedProperty)
      }
      onClose()
    } catch (error) {
      console.error('Failed to save property:', error)
      setErrors({ general: 'Failed to save property' })
    } finally {
      setIsSaving(false)
    }
  }, [editedProperty, property, onSave, onUpdate, onClose, validateProperty])

  const updateProperty = useCallback((updates) => {
    setEditedProperty(prev => ({ ...prev, ...updates }))
    // Clear related errors when updating
    if (updates.key) setErrors(prev => ({ ...prev, key: undefined }))
    if (updates.label) setErrors(prev => ({ ...prev, label: undefined }))
    if (updates.value !== undefined) setErrors(prev => ({ ...prev, value: undefined }))
  }, [])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'bulk'
              ? `Bulk Edit Properties (${notes.length} notes)`
              : property
                ? 'Edit Property'
                : 'Create Property'
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {errors.general && (
            <div className="flex items-center gap-2 p-3 bg-rgb(var(--danger)/0.1) border border-rgb(var(--danger)/0.2) rounded text-rgb(var(--danger))">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{errors.general}</span>
            </div>
          )}

          {mode === 'bulk' ? (
            <BulkPropertyEditor
              properties={availableProperties}
              notes={notes}
              onUpdateNotes={onUpdate}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Property basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
                    Property Key *
                  </label>
                  <input
                    type="text"
                    value={editedProperty.key}
                    onChange={(e) => updateProperty({ key: e.target.value })}
                    className={`obsidian-input ${errors.key ? 'border-rgb(var(--danger))' : ''}`}
                    placeholder="my_property"
                    disabled={!!property} // Can't change key when editing
                  />
                  {errors.key && (
                    <p className="text-xs text-rgb(var(--danger)) mt-1">{errors.key}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-rgb(var(--text)) mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={editedProperty.label}
                    onChange={(e) => updateProperty({ label: e.target.value })}
                    className={`obsidian-input ${errors.label ? 'border-rgb(var(--danger))' : ''}`}
                    placeholder="My Property"
                  />
                  {errors.label && (
                    <p className="text-xs text-rgb(var(--danger)) mt-1">{errors.label}</p>
                  )}
                </div>
              </div>

              {/* Property type */}
              <div>
                <label className="block text-sm font-medium text-rgb(var(--text)) mb-3">
                  Property Type
                </label>
                <PropertyTypeSelector
                  selectedType={editedProperty.type}
                  onTypeChange={(type) => {
                    const typeConfig = PROPERTY_TYPES[type]
                    const defaultValue = typeof typeConfig.defaultValue === 'function'
                      ? typeConfig.defaultValue()
                      : typeConfig.defaultValue
                    updateProperty({ type, value: defaultValue })
                  }}
                />
              </div>

              {/* Property value */}
              <PropertyValueEditor
                type={editedProperty.type}
                value={editedProperty.value}
                onChange={(value) => updateProperty({ value })}
                property={editedProperty}
                error={errors.value}
              />
              {errors.value && (
                <p className="text-xs text-rgb(var(--danger))">{errors.value}</p>
              )}

              {/* Property options */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedProperty.required}
                    onChange={(e) => updateProperty({ required: e.target.checked })}
                    className="rounded border-rgb(var(--border)) focus:ring-rgb(var(--accent))"
                  />
                  <span className="text-sm">Required</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedProperty.visible}
                    onChange={(e) => updateProperty({ visible: e.target.checked })}
                    className="rounded border-rgb(var(--border)) focus:ring-rgb(var(--accent))"
                  />
                  <div className="flex items-center gap-1">
                    {editedProperty.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span className="text-sm">Visible in table</span>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {mode !== 'bulk' && (
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="obsidian-button"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="obsidian-button primary"
              disabled={isSaving || Object.keys(errors).length > 0}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {property ? 'Update' : 'Create'} Property
                </>
              )}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}