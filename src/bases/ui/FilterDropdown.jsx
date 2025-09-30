import React, { useState } from 'react'
import { Plus, X, Folder, FolderOpen } from 'lucide-react'
import CustomSelect from './CustomSelect.jsx'

// Get operators based on property type
const getOperatorsForType = (type) => {
  switch (type) {
    case 'text':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'starts_with', label: 'Starts with' },
        { value: 'ends_with', label: 'Ends with' },
        { value: 'is_empty', label: 'Is empty' },
      ];
    case 'number':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'gt', label: 'Greater than' },
        { value: 'lt', label: 'Less than' },
        { value: 'gte', label: 'Greater or equal' },
        { value: 'lte', label: 'Less or equal' },
        { value: 'between', label: 'Between' },
      ];
    case 'date':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
        { value: 'between', label: 'Between' },
      ];
    case 'tags':
      return [
        { value: 'contains_any', label: 'Contains any' },
        { value: 'contains_all', label: 'Contains all' },
      ];
    case 'select':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'in', label: 'Is one of' },
      ];
    default:
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
      ];
  }
};

// Determine property type based on property name and value
const getPropertyType = (property, sampleValue) => {
  // Date properties
  if (property === 'created' || property === 'modified') {
    return 'date';
  }

  // Number properties
  if (property === 'size') {
    return 'number';
  }

  // Tags property
  if (property === 'tags') {
    return 'tags';
  }

  // Check value type if available
  if (sampleValue !== undefined && sampleValue !== null) {
    if (Array.isArray(sampleValue)) {
      return 'tags';
    }
    if (typeof sampleValue === 'number') {
      return 'number';
    }
    if (sampleValue instanceof Date || !isNaN(Date.parse(sampleValue))) {
      return 'date';
    }
  }

  // Default to text
  return 'text';
};

export default function FilterDropdown({
  filterRules = [],
  onChange,
  onClose,
  availableProperties = [],
  logicOperator = 'AND',
  folderScope = 'all',
  onFolderScopeChange,
  folders = []
}) {
  const [localRules, setLocalRules] = useState(filterRules);
  const [localLogicOperator, setLocalLogicOperator] = useState(logicOperator);

  // Handle adding a new filter rule
  const handleAddFilter = () => {
    const newRule = {
      property: availableProperties[0]?.value || 'name',
      operator: 'contains',
      value: '',
      type: 'text'
    };
    const newRules = [...localRules, newRule];
    setLocalRules(newRules);
    onChange(newRules, localLogicOperator);
  };

  // Handle removing a filter rule
  const handleRemoveFilter = (index) => {
    const newRules = localRules.filter((_, i) => i !== index);
    setLocalRules(newRules);
    onChange(newRules, localLogicOperator);
  };

  // Handle changing a filter rule field
  const handleRuleChange = (index, field, value) => {
    const newRules = localRules.map((rule, i) => {
      if (i === index) {
        const updatedRule = { ...rule, [field]: value };

        // If property changed, update type and reset operator
        if (field === 'property') {
          const type = getPropertyType(value);
          updatedRule.type = type;
          updatedRule.operator = getOperatorsForType(type)[0].value;
          updatedRule.value = '';
        }

        // If operator changed to is_empty, clear value
        if (field === 'operator' && value === 'is_empty') {
          updatedRule.value = '';
        }

        return updatedRule;
      }
      return rule;
    });
    setLocalRules(newRules);
    onChange(newRules, localLogicOperator);
  };

  // Handle logic operator toggle
  const handleLogicOperatorToggle = () => {
    const newOperator = localLogicOperator === 'AND' ? 'OR' : 'AND';
    setLocalLogicOperator(newOperator);
    onChange(localRules, newOperator);
  };

  // Render value input based on property type and operator
  const renderValueInput = (rule, index) => {
    // Don't show input for is_empty operator
    if (rule.operator === 'is_empty') {
      return null;
    }

    const type = rule.type || 'text';

    // For between operator, show two inputs
    if (rule.operator === 'between') {
      return (
        <div className="flex items-center gap-2 flex-1">
          <input
            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
            value={rule.value?.split(',')[0] || ''}
            onChange={(e) => {
              const secondValue = rule.value?.split(',')[1] || '';
              handleRuleChange(index, 'value', `${e.target.value},${secondValue}`);
            }}
            placeholder="Min"
            className="flex-1 px-2 py-1.5 text-sm bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
          />
          <span className="text-app-muted text-xs">to</span>
          <input
            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
            value={rule.value?.split(',')[1] || ''}
            onChange={(e) => {
              const firstValue = rule.value?.split(',')[0] || '';
              handleRuleChange(index, 'value', `${firstValue},${e.target.value}`);
            }}
            placeholder="Max"
            className="flex-1 px-2 py-1.5 text-sm bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
          />
        </div>
      );
    }

    // Regular input based on type
    return (
      <input
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        value={rule.value || ''}
        onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
        placeholder="Enter value..."
        className="flex-1 px-2 py-1.5 text-sm bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
      />
    );
  };

  return (
    <div className="p-3 max-h-[500px] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-app-text">Filter</span>
        <button
          onClick={onClose}
          className="text-app-muted hover:text-app-text"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Folder Scope Selection */}
      <div className="mb-4 pb-3 border-b border-app-border">
        <span className="text-xs font-medium text-app-muted uppercase tracking-wide mb-2 block">Folder Scope</span>
        <div className="space-y-1">
          <button
            onClick={() => onFolderScopeChange?.('all')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded transition-colors ${
              folderScope === 'all'
                ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                : 'text-app-text hover:bg-app-accent/5 border border-transparent'
            }`}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">All Folders</span>
          </button>
          <button
            onClick={() => onFolderScopeChange?.('current')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded transition-colors ${
              folderScope === 'current'
                ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                : 'text-app-text hover:bg-app-accent/5 border border-transparent'
            }`}
          >
            <Folder className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Current Folder</span>
          </button>
        </div>
      </div>

      {/* Logic operator toggle - only show if there are multiple rules */}
      {localRules.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-app-muted">Match:</span>
          <button
            onClick={handleLogicOperatorToggle}
            className="px-2 py-1 text-xs font-medium bg-app-accent/10 text-app-accent hover:bg-app-accent/20 rounded transition-colors"
          >
            {localLogicOperator === 'AND' ? 'All conditions' : 'Any condition'}
          </button>
        </div>
      )}

      {/* Filter Rules */}
      <div className="space-y-3 mb-4">
        {localRules.map((rule, index) => {
          const type = rule.type || getPropertyType(rule.property);
          const operators = getOperatorsForType(type);

          return (
            <div key={index} className="flex flex-col gap-2 p-2 border border-app-border rounded">
              {/* Property and Operator row */}
              <div className="flex items-center gap-2">
                <CustomSelect
                  value={rule.property}
                  onChange={(value) => handleRuleChange(index, 'property', value)}
                  options={availableProperties}
                  className="flex-1"
                />

                <CustomSelect
                  value={rule.operator}
                  onChange={(value) => handleRuleChange(index, 'operator', value)}
                  options={operators}
                  className="flex-1"
                />

                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="p-1.5 text-app-muted hover:text-red-500 transition-colors flex-shrink-0"
                  title="Remove filter"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Value input row */}
              <div className="flex items-center gap-2">
                {renderValueInput(rule, index)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add filter button */}
      <button
        onClick={handleAddFilter}
        className="flex items-center gap-2 w-full px-2 py-2 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add filter
      </button>

      {/* Clear all button - only show if there are rules */}
      {localRules.length > 0 && (
        <button
          onClick={() => {
            setLocalRules([]);
            onChange([], localLogicOperator);
          }}
          className="flex items-center gap-2 w-full px-2 py-2 mt-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
          Clear all filters
        </button>
      )}
    </div>
  );
}