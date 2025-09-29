import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Edit2,
  Filter,
  Plus,
  MoreHorizontal,
  Hash,
  Calendar,
  Type,
  Tag,
  Settings,
  Clock,
  FileText,
  Folder,
  Archive,
  Calculator,
  Eye,
  Check
} from 'lucide-react'
import { useFolderScope } from '../../contexts/FolderScopeContext.jsx'
import CustomSelect from './CustomSelect.jsx'


// Helper function to get filename from path
const getFileName = (filePath) => {
  if (!filePath) return 'Untitled';
  const name = filePath.split('/').pop() || filePath;
  return name.replace(/\.md$/, '').replace(/\.markdown$/, '');
};

// Helper function to format cell values
const formatCellValue = (value, column) => {
  if (!value) return '';

  if (column === 'created' || column === 'modified') {
    const date = new Date(value);
    return date.toLocaleDateString();
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
};

// Main BaseTableView component
export default function BaseTableView({
  data = [],
  notes = [],
  base,
  columns = [],
  onNoteUpdate,
  onColumnResize,
  onColumnReorder,
  onSort,
  onFilter,
  onAddNote,
  onAddColumn,
  sortConfig,
  filterConfig,
  isLoading = false,
  onPropertyEdit,
  className = '',
  showSortDropdown = false,
  setShowSortDropdown = () => {},
  showPropertiesDropdown = false,
  setShowPropertiesDropdown = () => {},
  ignoreScope = false,
  onFileOpen
}) {

  const { isFileInScope } = useFolderScope()

  // ALL STATE DECLARATIONS FIRST
  const [availableProperties, setAvailableProperties] = useState([])
  const [sortRules, setSortRules] = useState([])
  const [enabledColumns, setEnabledColumns] = useState({
    name: true, // Always enabled
    title: false,
    created: false,
    modified: false,
    size: false,
    path: false,
    tags: false
  })

  const [columnWidths, setColumnWidths] = useState(() => {
    // Initialize with default columns
    const widths = {}
    const defaultColumns = ['name', 'title', 'created', 'modified']
    defaultColumns.forEach(col => {
      widths[col] = col === 'name' ? 300 : 200
    })
    return widths
  })

  // COMPUTED VALUES AFTER STATE
  // Use data prop if available, otherwise fall back to notes prop, or use test data
  const items = data?.length > 0 ? data : notes?.length > 0 ? notes : [
    {
      path: '/Users/pratham/Desktop/My Knowledge Base/Test File 1.md',
      properties: { status: 'published', priority: 'high' },
      name: 'Test File 1.md',
      title: 'Test File 1',
      created: new Date(),
      modified: new Date()
    },
    {
      path: '/Users/pratham/Desktop/My Knowledge Base/Test File 2.md',
      properties: { status: 'draft', priority: 'medium' },
      name: 'Test File 2.md',
      title: 'Test File 2',
      created: new Date(),
      modified: new Date()
    },
    {
      path: '/Users/pratham/Desktop/My Knowledge Base/Marketing Plan.md',
      properties: { status: 'review', priority: 'low', tags: ['business', 'strategy'] },
      name: 'Marketing Plan.md',
      title: 'Marketing Plan',
      created: new Date(),
      modified: new Date()
    }
  ];

  // Get columns based on enabled state, always include 'name' first
  const displayColumns = ['name', ...Object.keys(enabledColumns).filter(col => col !== 'name' && enabledColumns[col])];

  // Filter items based on folder scope and apply sorting
  const scopedItems = useMemo(() => {
    // If ignoreScope is true, don't filter by folder scope
    const filtered = ignoreScope ? items : items.filter(item => isFileInScope(item.path));

    // Apply sorting if sort rules exist
    if (sortRules.length === 0) {
      return filtered;
    }

    return filtered.sort((a, b) => {
      for (const rule of sortRules) {
        const { property, order } = rule;

        // Get values to compare
        let aValue = a.properties?.[property] || a[property] || '';
        let bValue = b.properties?.[property] || b[property] || '';

        // Handle special cases
        if (property === 'name') {
          aValue = getFileName(a.path);
          bValue = getFileName(b.path);
        } else if (property === 'extension') {
          aValue = a.path?.split('.').pop() || '';
          bValue = b.path?.split('.').pop() || '';
        } else if (property === 'size') {
          // For now, use file path length as proxy for size
          aValue = a.path?.length || 0;
          bValue = b.path?.length || 0;
        } else if (property === 'created' || property === 'modified') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        // Convert to strings for comparison if needed
        if (typeof aValue !== 'number' && !(aValue instanceof Date)) {
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
        }

        // Compare values
        let comparison = 0;
        if (aValue < bValue) {
          comparison = -1;
        } else if (aValue > bValue) {
          comparison = 1;
        }

        // Apply sort order
        if (order === 'desc') {
          comparison *= -1;
        }

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }

        // If equal, continue to next sort rule
      }

      // If all sort rules result in equality, maintain original order
      return 0;
    });
  }, [items, isFileInScope, sortRules, ignoreScope])

  // Extract all available properties from the data
  useEffect(() => {
    const allProps = new Set()
    scopedItems.forEach(item => {
      if (item.properties) {
        Object.keys(item.properties).forEach(key => allProps.add(key))
      }
      // Also add common file properties
      Object.keys(item).forEach(key => {
        if (!['path', 'properties', 'created', 'modified'].includes(key)) {
          allProps.add(key)
        }
      })
    })
    setAvailableProperties(Array.from(allProps).sort())
  }, [scopedItems.length])

  const handleRemoveColumn = (column) => {
    if (onColumnResize) {
      // Remove from columns through parent component
      const newColumns = displayColumns.filter(col => col !== column)
      onColumnResize(newColumns)
    }
  }

  const handleColumnToggle = (column) => {
    if (column === 'name') return; // Name column is always enabled
    setEnabledColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  }

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

  // Available column options organized by sections with more common properties
  const columnSections = {
    'File Properties': [
      { key: 'name', label: 'File Name', icon: FileText, alwaysEnabled: true },
      { key: 'title', label: 'Title', icon: Type },
      { key: 'size', label: 'File Size', icon: Archive },
      { key: 'path', label: 'File Path', icon: Folder },
      { key: 'extension', label: 'File Extension', icon: Hash },
    ],
    'Timestamps': [
      { key: 'created', label: 'Created Time', icon: Clock },
      { key: 'modified', label: 'Modified Time', icon: Clock },
    ],
    'Content': [
      { key: 'tags', label: 'Tags', icon: Tag },
      { key: 'links', label: 'Links', icon: Plus },
      { key: 'embeds', label: 'Embeds', icon: MoreHorizontal },
      { key: 'aliases', label: 'Aliases', icon: Type },
    ]
  };

  // All sortable properties
  const sortableProperties = [
    { value: 'name', label: 'File Name' },
    { value: 'title', label: 'Title' },
    { value: 'size', label: 'File Size' },
    { value: 'created', label: 'Created Time' },
    { value: 'modified', label: 'Modified Time' },
    { value: 'extension', label: 'File Extension' },
    { value: 'path', label: 'File Path' },
  ];


  if (!base) {
    return (
      <div className="flex-1 flex items-center justify-center text-rgb(var(--muted))">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium mb-2">No Base Selected</h3>
          <p>Select a base to view your notes as a table</p>
        </div>
      </div>
    )
  }

  // Handle file click - open file in editor
  const handleFileClick = (filePath, event) => {
    event.preventDefault();

    if (!onFileOpen) {
      console.warn('onFileOpen prop not provided');
      return;
    }

    const fileName = filePath.split('/').pop();
    const fileObject = {
      path: filePath,
      name: fileName,
      is_directory: false
    };

    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl + click = new tab
      // For now, just open in same tab (we can implement new tab later)
      console.log('Opening file (cmd+click):', filePath);
      onFileOpen(fileObject);
    } else {
      // Normal click = same tab
      console.log('Opening file:', filePath);
      onFileOpen(fileObject);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-app-bg ${className}`}>
      {/* Clean table with proper dark theme colors */}
      <div className="flex-1 overflow-auto bg-app-bg" style={{ maxHeight: '100%' }}>
        <table className="w-full">
          {/* Table header */}
          <thead className="sticky top-0 z-10 bg-app-bg">
            <tr className="border-b border-app-border">
              {displayColumns.map((column) => (
                <th
                  key={column}
                  className="group px-4 py-2 text-left text-xs font-medium text-app-muted uppercase tracking-wide border-r border-app-border/30 last:border-r-0 relative bg-app-bg"
                  style={{ width: columnWidths[column] || 200 }}
                >
                  <div className="flex items-center justify-between">
                    <span>{column === 'name' ? 'File Name' : column.charAt(0).toUpperCase() + column.slice(1)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table body with clickable files */}
          <tbody>
            {scopedItems.map((item, index) => (
              <tr
                key={item.id || item.path || index}
                className="border-b border-app-border/20 hover:bg-app-accent/5 group transition-colors"
              >
                {displayColumns.map((column) => (
                  <td
                    key={`${item.id || item.path}-${column}`}
                    className="px-4 py-3 text-sm text-app-text border-r border-app-border/10 last:border-r-0"
                    style={{ width: columnWidths[column] || 200 }}
                  >
                    {column === 'name' ? (
                      <button
                        onClick={(e) => handleFileClick(item.path, e)}
                        className="text-app-accent font-medium hover:underline cursor-pointer text-left w-full hover:text-app-accent/80 transition-colors"
                      >
                        {getFileName(item.path) || 'Untitled'}
                      </button>
                    ) : (
                      <span className="text-app-text">
                        {formatCellValue(item.properties?.[column] || item[column], column) || (
                          <span className="text-app-muted italic">—</span>
                        )}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {scopedItems.length === 0 && (
          <div className="flex items-center justify-center h-64 text-app-muted">
            <div className="text-center">
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm">No items found</p>
            </div>
          </div>
        )}
      </div>

      {/* Sort Dropdown Portal */}
      {showSortDropdown && createPortal(
        <div
          className="fixed top-16 right-[280px] w-80 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 max-h-96 overflow-y-auto overflow-x-visible">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-app-text">Sort</span>
              <button
                onClick={() => setShowSortDropdown(false)}
                className="text-app-muted hover:text-app-text"
              >
                ×
              </button>
            </div>

            {/* Sort Rules */}
            <div className="space-y-2 mb-4">
              {sortRules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border border-app-border rounded">
                  <MoreHorizontal className="w-4 h-4 text-app-muted cursor-grab" />

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

                  <button
                    onClick={() => handleRemoveSort(index)}
                    className="p-1 text-app-muted hover:text-red-500 transition-colors"
                    title="Remove sort"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddSort}
              className="flex items-center gap-2 w-full px-2 py-2 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add sort
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Properties Dropdown Portal */}
      {showPropertiesDropdown && createPortal(
        <div
          className="fixed top-16 right-8 w-80 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 max-h-[500px] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-app-text">Properties</span>
              <button
                onClick={() => setShowPropertiesDropdown(false)}
                className="text-app-muted hover:text-app-text transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="relative mb-5">
              <input
                type="text"
                placeholder="Find or create..."
                className="w-full px-3 py-2.5 text-sm bg-app-bg border border-app-border rounded-md focus:border-app-accent focus:outline-none text-app-text placeholder-app-muted"
              />
            </div>

            {Object.entries(columnSections).map(([sectionName, columns]) => (
              <div key={sectionName} className="mb-5 last:mb-0">
                <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wider mb-3 px-1">
                  {sectionName}
                </h4>
                <div className="space-y-0.5">
                  {columns.map(column => (
                    <label
                      key={column.key}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all group ${
                        column.alwaysEnabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-app-accent/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={enabledColumns[column.key] || column.alwaysEnabled}
                            onChange={() => handleColumnToggle(column.key)}
                            disabled={column.alwaysEnabled}
                            className="appearance-none w-4 h-4 border-2 border-app-border rounded bg-transparent checked:bg-app-accent checked:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                          />
                          {(enabledColumns[column.key] || column.alwaysEnabled) && (
                            <Check className="w-3 h-3 text-white absolute pointer-events-none" />
                          )}
                        </div>
                        <column.icon className="w-4 h-4 text-app-muted flex-shrink-0" />
                        <span className="text-sm text-app-text font-medium">{column.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-app-border pt-3 mt-4 space-y-0.5">
              <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded-md transition-all">
                <Calculator className="w-4 h-4" />
                <span className="font-medium">Add formula</span>
              </button>
              <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded-md transition-all">
                <Eye className="w-4 h-4" />
                <span className="font-medium">Hide all</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}