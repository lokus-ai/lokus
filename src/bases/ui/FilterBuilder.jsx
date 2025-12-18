import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Filter,
  Plus,
  X,
  ChevronDown,
  Trash2,
  Save,
  RefreshCw,
  Eye,
  Code,
  Type,
  Hash,
  Calendar,
  Tag,
  CheckSquare,
  Link,
  Braces,
  Parentheses
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../components/ui/dialog.jsx'

// Filter operators for different property types
const OPERATORS = {
  text: [
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'not_contains', label: 'Does not contain', needsValue: true },
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'not_equals', label: 'Does not equal', needsValue: true },
    { value: 'starts_with', label: 'Starts with', needsValue: true },
    { value: 'ends_with', label: 'Ends with', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
    { value: 'regex', label: 'Matches regex', needsValue: true }
  ],
  number: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'not_equals', label: 'Does not equal', needsValue: true },
    { value: 'greater_than', label: 'Greater than', needsValue: true },
    { value: 'greater_than_or_equal', label: 'Greater than or equal', needsValue: true },
    { value: 'less_than', label: 'Less than', needsValue: true },
    { value: 'less_than_or_equal', label: 'Less than or equal', needsValue: true },
    { value: 'between', label: 'Between', needsValue: 'range' },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false }
  ],
  date: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'before', label: 'Before', needsValue: true },
    { value: 'after', label: 'After', needsValue: true },
    { value: 'between', label: 'Between', needsValue: 'range' },
    { value: 'today', label: 'Is today', needsValue: false },
    { value: 'yesterday', label: 'Is yesterday', needsValue: false },
    { value: 'this_week', label: 'This week', needsValue: false },
    { value: 'this_month', label: 'This month', needsValue: false },
    { value: 'this_year', label: 'This year', needsValue: false },
    { value: 'last_7_days', label: 'Last 7 days', needsValue: false },
    { value: 'last_30_days', label: 'Last 30 days', needsValue: false },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false }
  ],
  tags: [
    { value: 'contains', label: 'Contains tag', needsValue: true },
    { value: 'not_contains', label: 'Does not contain tag', needsValue: true },
    { value: 'contains_all', label: 'Contains all tags', needsValue: 'multiple' },
    { value: 'contains_any', label: 'Contains any tag', needsValue: 'multiple' },
    { value: 'is_empty', label: 'Has no tags', needsValue: false },
    { value: 'is_not_empty', label: 'Has tags', needsValue: false }
  ],
  checkbox: [
    { value: 'is_true', label: 'Is checked', needsValue: false },
    { value: 'is_false', label: 'Is unchecked', needsValue: false }
  ]
}

// Property type icons
const propertyTypeIcons = {
  text: Type,
  number: Hash,
  date: Calendar,
  tags: Tag,
  checkbox: CheckSquare,
  url: Link
}

// Filter condition component
const FilterCondition = ({
  condition,
  properties,
  onUpdate,
  onDelete,
  canDelete = true
}) => {
  const property = properties.find(p => p.key === condition.property)
  const propertyType = property?.type || 'text'
  const operators = OPERATORS[propertyType] || OPERATORS.text
  const selectedOperator = operators.find(op => op.value === condition.operator)

  const handlePropertyChange = (propertyKey) => {
    const newProperty = properties.find(p => p.key === propertyKey)
    const newType = newProperty?.type || 'text'
    const newOperators = OPERATORS[newType] || OPERATORS.text
    const defaultOperator = newOperators[0]

    onUpdate({
      ...condition,
      property: propertyKey,
      operator: defaultOperator.value,
      value: defaultOperator.needsValue ? (defaultOperator.needsValue === 'multiple' ? [] : '') : null
    })
  }

  const handleOperatorChange = (operatorValue) => {
    const operator = operators.find(op => op.value === operatorValue)
    let newValue = null

    if (operator.needsValue === true) {
      newValue = propertyType === 'number' ? 0 : ''
    } else if (operator.needsValue === 'multiple') {
      newValue = []
    } else if (operator.needsValue === 'range') {
      newValue = propertyType === 'number' ? [0, 100] : ['', '']
    }

    onUpdate({
      ...condition,
      operator: operatorValue,
      value: newValue
    })
  }

  const renderValueInput = () => {
    if (!selectedOperator?.needsValue) return null

    if (selectedOperator.needsValue === 'range') {
      if (propertyType === 'number') {
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={condition.value?.[0] || ''}
              onChange={(e) => onUpdate({
                ...condition,
                value: [Number(e.target.value), condition.value?.[1] || 0]
              })}
              className="obsidian-input flex-1"
              placeholder="Min"
            />
            <span className="text-rgb(var(--muted))">to</span>
            <input
              type="number"
              value={condition.value?.[1] || ''}
              onChange={(e) => onUpdate({
                ...condition,
                value: [condition.value?.[0] || 0, Number(e.target.value)]
              })}
              className="obsidian-input flex-1"
              placeholder="Max"
            />
          </div>
        )
      } else if (propertyType === 'date') {
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={condition.value?.[0] || ''}
              onChange={(e) => onUpdate({
                ...condition,
                value: [e.target.value, condition.value?.[1] || '']
              })}
              className="obsidian-input flex-1"
            />
            <span className="text-rgb(var(--muted))">to</span>
            <input
              type="date"
              value={condition.value?.[1] || ''}
              onChange={(e) => onUpdate({
                ...condition,
                value: [condition.value?.[0] || '', e.target.value]
              })}
              className="obsidian-input flex-1"
            />
          </div>
        )
      }
    }

    if (selectedOperator.needsValue === 'multiple') {
      return (
        <div className="space-y-2">
          {(condition.value || []).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const newValue = [...(condition.value || [])]
                  newValue[index] = e.target.value
                  onUpdate({ ...condition, value: newValue })
                }}
                className="obsidian-input flex-1"
                placeholder="Enter tag..."
              />
              <button
                onClick={() => {
                  const newValue = (condition.value || []).filter((_, i) => i !== index)
                  onUpdate({ ...condition, value: newValue })
                }}
                className="obsidian-button icon-only small text-rgb(var(--danger))"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newValue = [...(condition.value || []), '']
              onUpdate({ ...condition, value: newValue })
            }}
            className="obsidian-button text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Tag
          </button>
        </div>
      )
    }

    // Single value input
    switch (propertyType) {
      case 'number':
        return (
          <input
            type="number"
            value={condition.value || ''}
            onChange={(e) => onUpdate({ ...condition, value: Number(e.target.value) })}
            className="obsidian-input"
            placeholder="Enter number..."
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={condition.value || ''}
            onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
            className="obsidian-input"
          />
        )

      default:
        return (
          <input
            type="text"
            value={condition.value || ''}
            onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
            className="obsidian-input"
            placeholder="Enter value..."
          />
        )
    }
  }

  const TypeIcon = propertyTypeIcons[propertyType] || Type

  return (
    <div className="flex items-start gap-3 p-4 border border-rgb(var(--border)) rounded-lg">
      {/* Property selector */}
      <div className="min-w-[200px]">
        <label className="block text-xs font-medium text-rgb(var(--muted)) mb-2">Property</label>
        <select
          value={condition.property || ''}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className="obsidian-input w-full text-sm"
        >
          <option value="">Select property...</option>
          {properties.map(prop => (
            <option key={prop.key} value={prop.key}>
              {prop.label || prop.key}
            </option>
          ))}
        </select>
      </div>

      {/* Operator selector */}
      <div className="min-w-[180px]">
        <label className="block text-xs font-medium text-rgb(var(--muted)) mb-2">Operator</label>
        <select
          value={condition.operator || ''}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className="obsidian-input w-full text-sm"
          disabled={!condition.property}
        >
          {operators.map(op => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value input */}
      {selectedOperator?.needsValue && (
        <div className="flex-1">
          <label className="block text-xs font-medium text-rgb(var(--muted)) mb-2">Value</label>
          {renderValueInput()}
        </div>
      )}

      {/* Property type indicator */}
      {property && (
        <div className="flex items-center gap-1 mt-6 text-rgb(var(--muted))">
          <TypeIcon className="w-4 h-4" />
          <span className="text-xs capitalize">{propertyType}</span>
        </div>
      )}

      {/* Delete button */}
      {canDelete && (
        <button
          onClick={onDelete}
          className="obsidian-button icon-only small text-rgb(var(--danger)) mt-6"
          title="Delete condition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Filter group component (AND/OR grouping)
const FilterGroup = ({
  group,
  properties,
  onUpdate,
  onDelete,
  canDelete = true,
  isRoot = false
}) => {
  const addCondition = () => {
    const newCondition = {
      id: Date.now(),
      property: '',
      operator: 'contains',
      value: ''
    }
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition]
    })
  }

  const addGroup = () => {
    const newGroup = {
      id: Date.now(),
      operator: 'AND',
      conditions: [{
        id: Date.now() + 1,
        property: '',
        operator: 'contains',
        value: ''
      }]
    }
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup]
    })
  }

  const updateCondition = (index, updatedCondition) => {
    const newConditions = [...group.conditions]
    newConditions[index] = updatedCondition
    onUpdate({ ...group, conditions: newConditions })
  }

  const deleteCondition = (index) => {
    const newConditions = group.conditions.filter((_, i) => i !== index)
    onUpdate({ ...group, conditions: newConditions })
  }

  return (
    <div className={`border rounded-lg p-4 ${isRoot ? 'border-rgb(var(--accent))' : 'border-rgb(var(--border))'}`}>
      {/* Group header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Braces className="w-4 h-4 text-rgb(var(--muted))" />
            <select
              value={group.operator}
              onChange={(e) => onUpdate({ ...group, operator: e.target.value })}
              className="obsidian-input text-sm font-medium"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>
          <span className="text-xs text-rgb(var(--muted))">
            {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addCondition}
            className="obsidian-button small"
            title="Add condition"
          >
            <Plus className="w-4 h-4 mr-1" />
            Condition
          </button>

          <button
            onClick={addGroup}
            className="obsidian-button small"
            title="Add group"
          >
            <Parentheses className="w-4 h-4 mr-1" />
            Group
          </button>

          {canDelete && (
            <button
              onClick={onDelete}
              className="obsidian-button icon-only small text-rgb(var(--danger))"
              title="Delete group"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        {group.conditions.map((condition, index) => {
          const isLastCondition = index === group.conditions.length - 1

          return (
            <div key={condition.id} className="relative">
              {index > 0 && (
                <div className="absolute -top-2 left-4 bg-rgb(var(--bg)) px-2 text-xs font-medium text-rgb(var(--accent))">
                  {group.operator}
                </div>
              )}

              {condition.conditions ? (
                // Nested group
                <FilterGroup
                  group={condition}
                  properties={properties}
                  onUpdate={(updatedGroup) => updateCondition(index, updatedGroup)}
                  onDelete={() => deleteCondition(index)}
                  canDelete={group.conditions.length > 1}
                />
              ) : (
                // Single condition
                <FilterCondition
                  condition={condition}
                  properties={properties}
                  onUpdate={(updatedCondition) => updateCondition(index, updatedCondition)}
                  onDelete={() => deleteCondition(index)}
                  canDelete={group.conditions.length > 1}
                />
              )}
            </div>
          )
        })}
      </div>

      {group.conditions.length === 0 && (
        <div className="text-center py-8 text-rgb(var(--muted))">
          <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm mb-3">No conditions in this group</p>
          <button onClick={addCondition} className="obsidian-button primary small">
            Add First Condition
          </button>
        </div>
      )}
    </div>
  )
}

// Text filter input (alternative to visual builder)
const TextFilterInput = ({ value, onChange, placeholder, properties }) => {
  const [localValue, setLocalValue] = useState(value || '')

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  const handleChange = (newValue) => {
    setLocalValue(newValue)
    // Debounce the onChange
    const timeoutId = setTimeout(() => onChange(newValue), 300)
    return () => clearTimeout(timeoutId)
  }

  return (
    <div>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="obsidian-input w-full font-mono text-sm"
        rows={4}
        placeholder={placeholder}
      />
      <div className="mt-2 text-xs text-rgb(var(--muted))">
        <p className="mb-1">Syntax examples:</p>
        <ul className="space-y-1 ml-4">
          <li>• title:"My Note" AND tags:important</li>
          <li>• created:&gt;2024-01-01 OR modified:&lt;2023-12-31</li>
          <li>• (tags:work OR tags:personal) AND status:done</li>
        </ul>
      </div>
    </div>
  )
}

// Main FilterBuilder component
export default function FilterBuilder({
  isOpen,
  onClose,
  filter = null,
  properties = [],
  onSave,
  onApply,
  mode = 'dialog' // 'dialog' or 'inline'
}) {
  const [filterConfig, setFilterConfig] = useState(filter || {
    operator: 'AND',
    conditions: []
  })
  const [filterMode, setFilterMode] = useState('visual') // 'visual' or 'text'
  const [textFilter, setTextFilter] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Convert filter to text representation
  const filterToText = useMemo(() => {
    const conditionToText = (condition) => {
      if (condition.conditions) {
        // Nested group
        const conditionsText = condition.conditions.map(conditionToText).join(` ${condition.operator} `)
        return `(${conditionsText})`
      } else {
        // Single condition
        const property = condition.property
        const operator = condition.operator
        const value = condition.value

        if (!property) return ''

        switch (operator) {
          case 'contains':
            return `${property}:"${value}"`
          case 'equals':
            return `${property}=${value}`
          case 'greater_than':
            return `${property}>${value}`
          case 'less_than':
            return `${property}<${value}`
          case 'is_empty':
            return `${property}:empty`
          case 'is_not_empty':
            return `${property}:not_empty`
          default:
            return `${property}:${value}`
        }
      }
    }

    if (filterConfig.conditions.length === 0) return ''
    return filterConfig.conditions.map(conditionToText).join(` ${filterConfig.operator} `)
  }, [filterConfig])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const finalFilter = filterMode === 'text' ? { text: textFilter } : filterConfig
      await onSave?.(finalFilter)
      if (mode === 'dialog') onClose()
    } catch { } finally {
      setIsSaving(false)
    }
  }, [filterConfig, textFilter, filterMode, onSave, onClose, mode])

  const handleApply = useCallback(async () => {
    const finalFilter = filterMode === 'text' ? { text: textFilter } : filterConfig
    await onApply?.(finalFilter)
    if (mode === 'dialog') onClose()
  }, [filterConfig, textFilter, filterMode, onApply, onClose, mode])

  const content = (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode('visual')}
            className={`obsidian-button small ${filterMode === 'visual' ? 'primary' : ''}`}
          >
            <Filter className="w-4 h-4 mr-1" />
            Visual
          </button>
          <button
            onClick={() => setFilterMode('text')}
            className={`obsidian-button small ${filterMode === 'text' ? 'primary' : ''}`}
          >
            <Code className="w-4 h-4 mr-1" />
            Text
          </button>
        </div>

        {filterMode === 'visual' && (
          <button
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className="obsidian-button small"
            title="Preview filter as text"
          >
            {isPreviewOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Filter preview */}
      {isPreviewOpen && filterMode === 'visual' && (
        <div className="p-3 bg-rgb(var(--panel-secondary)) rounded border">
          <div className="text-xs font-medium text-rgb(var(--muted)) mb-2">Preview</div>
          <code className="text-sm font-mono text-rgb(var(--text))">
            {filterToText || 'No filter conditions'}
          </code>
        </div>
      )}

      {/* Filter builder */}
      {filterMode === 'visual' ? (
        <FilterGroup
          group={filterConfig}
          properties={properties}
          onUpdate={setFilterConfig}
          onDelete={() => {}}
          canDelete={false}
          isRoot={true}
        />
      ) : (
        <TextFilterInput
          value={textFilter}
          onChange={setTextFilter}
          placeholder="Enter filter expression..."
          properties={properties}
        />
      )}

      {/* Actions */}
      {mode === 'inline' && (
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleApply}
            className="obsidian-button primary"
            disabled={isSaving}
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setFilterConfig({ operator: 'AND', conditions: [] })
              setTextFilter('')
              onApply?.({})
            }}
            className="obsidian-button"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )

  if (mode === 'inline') {
    return content
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Builder</DialogTitle>
        </DialogHeader>

        {content}

        <DialogFooter>
          <button
            onClick={onClose}
            className="obsidian-button"
            disabled={isSaving}
          >
            Cancel
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              className="obsidian-button"
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
                  Save Filter
                </>
              )}
            </button>
          )}
          <button
            onClick={handleApply}
            className="obsidian-button primary"
            disabled={isSaving}
          >
            Apply Filter
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}