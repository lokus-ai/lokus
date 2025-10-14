import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  ArrowUpDown,
  Plus,
  MoreHorizontal,
  Settings,
  Clock,
  FileText,
  GripVertical,
  Pin,
  Archive,
  Check
} from 'lucide-react'
import { useFolderScope } from '../../contexts/FolderScopeContext.jsx'
import { useBases } from '../BasesContext.jsx'
import CustomSelect from './CustomSelect.jsx'
import FilterDropdown from './FilterDropdown.jsx'
import { FrontmatterWriter } from '../data/FrontmatterWriter.js'
import { formatProperty } from '../data/FrontmatterParser.js'
import { invoke } from '@tauri-apps/api/core'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table.jsx'

// Helper functions (same as original)
const getFileName = (filePath) => {
  if (!filePath) return 'Untitled';
  const name = filePath.split('/').pop() || filePath;
  return name.replace(/\.md$/, '').replace(/\.markdown$/, '');
};

const formatCellValue = (value, column) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (column === 'created' || column === 'modified') {
    return formatProperty(value, 'date');
  }
  return formatProperty(value);
};

const evaluateFilter = (item, rule) => {
  const { property, operator, value } = rule;
  let itemValue = item.properties?.[property] || item[property];

  if (property === 'name') {
    itemValue = getFileName(item.path);
  }

  if (operator === 'is_empty') {
    return !itemValue || itemValue === '' || (Array.isArray(itemValue) && itemValue.length === 0);
  }

  if (!value || value === '') return false;
  if (itemValue === null || itemValue === undefined) return false;

  // Text operators
  const itemStr = String(itemValue).toLowerCase();
  const filterStr = String(value).toLowerCase();

  switch (operator) {
    case 'equals': return itemStr === filterStr;
    case 'contains': return itemStr.includes(filterStr);
    case 'starts_with': return itemStr.startsWith(filterStr);
    case 'ends_with': return itemStr.endsWith(filterStr);
    case 'gt': return Number(itemValue) > Number(value);
    case 'lt': return Number(itemValue) < Number(value);
    case 'gte': return Number(itemValue) >= Number(value);
    case 'lte': return Number(itemValue) <= Number(value);
    default: return false;
  }
};

export default function BaseTableViewShadcn({
  data = [],
  base,
  onFileOpen,
  searchQuery = '',
  isLoading = false,
  showSortDropdown = false,
  setShowSortDropdown = () => {},
  showPropertiesDropdown = false,
  setShowPropertiesDropdown = () => {},
  showFilterDropdown = false,
  setShowFilterDropdown = () => {},
  onFilterRulesChange = () => {},
  ignoreScope = false,
  folderScope = 'all',
  onFolderScopeChange
}) {
  const { isFileInScope } = useFolderScope()
  const { configManager } = useBases()

  // State declarations
  const [enabledColumns, setEnabledColumns] = useState({
    name: true,
    created: false,
    modified: false,
    tags: false
  })
  const [sortRules, setSortRules] = useState([])
  const [filterRules, setFilterRules] = useState([])
  const [filterLogicOperator, setFilterLogicOperator] = useState('AND')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const editInputRef = useRef(null)

  const items = data?.length > 0 ? data : []

  // Get display columns
  const displayColumns = useMemo(() => {
    return ['name', ...Object.keys(enabledColumns).filter(col => col !== 'name' && enabledColumns[col])]
  }, [enabledColumns])

  // Filter and sort items
  const scopedItems = useMemo(() => {
    let filtered = ignoreScope ? items : items.filter(item => isFileInScope(item.path));

    // Apply search
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const fileName = getFileName(item.path).toLowerCase();
        if (fileName.includes(query)) return true;
        if (item.properties) {
          return Object.values(item.properties).some(value => {
            if (Array.isArray(value)) {
              return value.some(v => String(v).toLowerCase().includes(query));
            }
            return String(value).toLowerCase().includes(query);
          });
        }
        return false;
      });
    }

    // Apply filters
    if (filterRules.length > 0) {
      filtered = filtered.filter(item => {
        if (filterLogicOperator === 'AND') {
          return filterRules.every(rule => evaluateFilter(item, rule));
        } else {
          return filterRules.some(rule => evaluateFilter(item, rule));
        }
      });
    }

    // Apply sorting
    if (sortRules.length > 0) {
      return filtered.sort((a, b) => {
        for (const rule of sortRules) {
          const { property, order } = rule;
          let aValue = a.properties?.[property] || a[property] || '';
          let bValue = b.properties?.[property] || b[property] || '';

          if (property === 'name') {
            aValue = getFileName(a.path);
            bValue = getFileName(b.path);
          }

          if (typeof aValue !== 'number' && !(aValue instanceof Date)) {
            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();
          }

          let comparison = 0;
          if (aValue < bValue) comparison = -1;
          else if (aValue > bValue) comparison = 1;

          if (order === 'desc') comparison *= -1;
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    }

    return filtered;
  }, [items, isFileInScope, sortRules, filterRules, filterLogicOperator, ignoreScope, searchQuery])

  // Column toggle
  const handleColumnToggle = (column) => {
    if (column === 'name') return;
    setEnabledColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  }

  // Sort handlers
  const handleAddSort = () => {
    setSortRules(prev => [...prev, { property: 'name', order: 'asc' }]);
  }

  const handleRemoveSort = (index) => {
    setSortRules(prev => prev.filter((_, i) => i !== index));
  }

  const handleSortChange = (index, field, value) => {
    setSortRules(prev => prev.map((rule, i) =>
      i === index ? { ...rule, [field]: value } : rule
    ));
  }

  // Filter handlers
  const handleFilterChange = (newRules, newLogicOperator) => {
    setFilterRules(newRules);
    setFilterLogicOperator(newLogicOperator);
    onFilterRulesChange(newRules);
  }

  // Selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(new Set(scopedItems.map(item => item.path)));
    } else {
      setSelectedRows(new Set());
    }
  }

  const handleSelectRow = (path, event) => {
    const newSelection = new Set(selectedRows);
    if (event.metaKey || event.ctrlKey) {
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
    } else {
      if (newSelection.has(path) && newSelection.size === 1) {
        newSelection.clear();
      } else {
        newSelection.clear();
        newSelection.add(path);
      }
    }
    setSelectedRows(newSelection);
  }

  // Cell editing
  const handleCellClick = (item, column) => {
    if (['name', 'created', 'modified', 'size', 'path'].includes(column)) return;
    const currentValue = item.properties?.[column] || item[column] || '';
    const formattedValue = Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue);
    setEditingCell({ rowPath: item.path, column });
    setEditValue(formattedValue);
    setSaveStatus(null);
  }

  const handleCellSave = async () => {
    if (!editingCell) return;
    try {
      setSaveStatus('saving');
      const fileContent = await invoke('read_file_content', { path: editingCell.rowPath });
      let newValue = editValue.trim();
      if (editingCell.column === 'tags') {
        newValue = FrontmatterWriter.parseCommaSeparated(editValue);
      }
      const updatedContent = FrontmatterWriter.updateProperty(fileContent, editingCell.column, newValue);
      await invoke('write_file_content', { path: editingCell.rowPath, content: updatedContent });
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus(null);
        setEditingCell(null);
      }, 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') handleCellSave();
    else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
      setSaveStatus(null);
    }
  }

  // File click handler
  const handleFileClick = (filePath, event) => {
    event.preventDefault();
    if (!onFileOpen) return;
    const fileName = filePath.split('/').pop();
    onFileOpen({ path: filePath, name: fileName, is_directory: false });
  };

  // Column sections for properties dropdown
  const columnSections = {
    'File Properties': [
      { key: 'name', label: 'File Name', icon: FileText, alwaysEnabled: true },
      { key: 'created', label: 'Created', icon: Clock },
      { key: 'modified', label: 'Modified', icon: Clock },
      { key: 'tags', label: 'Tags', icon: Settings },
    ]
  };

  const sortableProperties = [
    { value: 'name', label: 'File Name' },
    { value: 'created', label: 'Created' },
    { value: 'modified', label: 'Modified' },
  ];

  if (!base) {
    return (
      <div className="flex-1 flex items-center justify-center text-app-muted">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium mb-2">No Base Selected</h3>
          <p>Select a base to view your notes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Bulk actions */}
      {selectedRows.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-app-accent/10 border-b border-app-accent/30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-app-text">{selectedRows.size} selected</span>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-xs text-app-muted hover:text-app-text"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={scopedItems.length > 0 && selectedRows.size === scopedItems.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-app-border cursor-pointer"
                />
              </TableHead>
              {displayColumns.map(column => (
                <TableHead key={column}>
                  <div className="flex items-center gap-2">
                    <span>{column === 'name' ? 'File Name' : column.charAt(0).toUpperCase() + column.slice(1)}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {scopedItems.map((item, index) => (
              <TableRow
                key={item.path}
                data-state={selectedRows.has(item.path) ? 'selected' : undefined}
              >
                <TableCell className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(item.path)}
                    onChange={(e) => handleSelectRow(item.path, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-app-border cursor-pointer"
                  />
                </TableCell>
                {displayColumns.map(column => {
                  const cellValue = column === 'name'
                    ? getFileName(item.path)
                    : item.properties?.[column] || item[column];

                  return (
                    <TableCell key={`${item.path}-${column}`}>
                      {column === 'name' ? (
                        <button
                          onClick={(e) => handleFileClick(item.path, e)}
                          className="text-app-accent font-medium hover:underline cursor-pointer text-left w-full"
                        >
                          {getFileName(item.path) || 'Untitled'}
                        </button>
                      ) : editingCell?.rowPath === item.path && editingCell?.column === column ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleCellKeyDown}
                            onBlur={() => setTimeout(() => setEditingCell(null), 200)}
                            className="flex-1 px-2 py-1 text-sm bg-app-bg border border-app-accent rounded"
                            autoFocus
                          />
                          {saveStatus && (
                            <span className={`text-xs ${
                              saveStatus === 'saved' ? 'text-green-500' : 
                              saveStatus === 'error' ? 'text-red-500' : 'text-app-muted'
                            }`}>
                              {saveStatus}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          onClick={() => handleCellClick(item, column)}
                          className={`${
                            ['created', 'modified', 'size', 'path'].includes(column)
                              ? 'cursor-default'
                              : 'cursor-pointer hover:bg-app-accent/10 px-2 py-1 -mx-2 -my-1 rounded'
                          }`}
                        >
                          {column === 'tags' && Array.isArray(cellValue) ? (
                            <div className="flex flex-wrap gap-1">
                              {cellValue.map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 text-xs rounded-full bg-app-accent/10 text-app-accent border border-app-accent/20"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            formatCellValue(cellValue, column) || (
                              <span className="text-app-muted italic">—</span>
                            )
                          )}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {scopedItems.length === 0 && (
          <div className="flex items-center justify-center h-64 text-app-muted">
            <div className="text-center">
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm">No items found</p>
            </div>
          </div>
        )}
      </div>

      {/* Sort Dropdown */}
      {showSortDropdown && createPortal(
        <div className="fixed top-16 right-[280px] w-80 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999] p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-app-text">Sort</span>
            <button onClick={() => setShowSortDropdown(false)} className="text-app-muted hover:text-app-text">×</button>
          </div>
          <div className="space-y-2 mb-4">
            {sortRules.map((rule, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border border-app-border rounded">
                <CustomSelect
                  value={rule.property}
                  onChange={(value) => handleSortChange(index, 'property', value)}
                  options={sortableProperties}
                  className="flex-1"
                />
                <CustomSelect
                  value={rule.order}
                  onChange={(value) => handleSortChange(index, 'order', value)}
                  options={[
                    { value: 'asc', label: 'A → Z' },
                    { value: 'desc', label: 'Z → A' }
                  ]}
                  className="w-28"
                />
                <button onClick={() => handleRemoveSort(index)} className="p-1 text-app-muted hover:text-red-500">
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={handleAddSort} className="flex items-center gap-2 w-full px-2 py-2 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded">
            <Plus className="w-4 h-4" />
            Add sort
          </button>
        </div>,
        document.body
      )}

      {/* Properties Dropdown */}
      {showPropertiesDropdown && createPortal(
        <div className="fixed top-16 right-8 w-80 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999] p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-app-text">Properties</span>
            <button onClick={() => setShowPropertiesDropdown(false)} className="text-app-muted hover:text-app-text">×</button>
          </div>
          {Object.entries(columnSections).map(([sectionName, columns]) => (
            <div key={sectionName} className="mb-4">
              <h4 className="text-xs font-semibold text-app-muted uppercase mb-2">{sectionName}</h4>
              <div className="space-y-1">
                {columns.map(column => (
                  <label
                    key={column.key}
                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer ${
                      column.alwaysEnabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-app-accent/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabledColumns[column.key] || column.alwaysEnabled}
                      onChange={() => handleColumnToggle(column.key)}
                      disabled={column.alwaysEnabled}
                      className="w-4 h-4 rounded border-app-border"
                    />
                    <column.icon className="w-4 h-4 text-app-muted" />
                    <span className="text-sm text-app-text">{column.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Filter Dropdown */}
      {showFilterDropdown && createPortal(
        <div className="fixed top-16 right-[420px] w-96 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999]">
          <FilterDropdown
            filterRules={filterRules}
            onChange={handleFilterChange}
            onClose={() => setShowFilterDropdown(false)}
            availableProperties={sortableProperties}
            logicOperator={filterLogicOperator}
            folderScope={folderScope}
            onFolderScopeChange={onFolderScopeChange}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
