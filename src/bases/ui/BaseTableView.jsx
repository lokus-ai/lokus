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
  Check,
  GripVertical,
  Pin
} from 'lucide-react'
import { useFolderScope } from '../../contexts/FolderScopeContext.jsx'
import { useBases } from '../BasesContext.jsx'
import CustomSelect from './CustomSelect.jsx'
import FilterDropdown from './FilterDropdown.jsx'
import { FrontmatterWriter } from '../data/FrontmatterWriter.js'
import { formatProperty } from '../data/FrontmatterParser.js'
import { invoke } from '@tauri-apps/api/core'


// Helper function to get filename from path
const getFileName = (filePath) => {
  if (!filePath) return 'Untitled';
  const name = filePath.split('/').pop() || filePath;
  return name.replace(/\.md$/, '').replace(/\.markdown$/, '');
};

// Helper function to format cell values
const formatCellValue = (value, column) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // Use formatProperty for standard file properties with type hints
  if (column === 'created' || column === 'modified') {
    return formatProperty(value, 'date');
  }

  // For all other values, use formatProperty
  return formatProperty(value);
};


// Helper function to evaluate a single filter rule
const evaluateFilter = (item, rule) => {
  const { property, operator, value } = rule;

  // Get the item's value for this property
  let itemValue = item.properties?.[property] || item[property];

  // Special handling for name property
  if (property === 'name') {
    itemValue = getFileName(item.path);
  }

  // Handle is_empty operator
  if (operator === 'is_empty') {
    return !itemValue || itemValue === '' || (Array.isArray(itemValue) && itemValue.length === 0);
  }

  // If no value specified for filter, don't match
  if (!value || value === '') {
    return false;
  }

  // Handle null/undefined item values
  if (itemValue === null || itemValue === undefined) {
    return false;
  }

  // Text operators
  if (operator === 'equals') {
    const itemStr = String(itemValue).toLowerCase();
    const filterStr = String(value).toLowerCase();
    return itemStr === filterStr;
  }

  if (operator === 'contains') {
    const itemStr = String(itemValue).toLowerCase();
    const filterStr = String(value).toLowerCase();
    return itemStr.includes(filterStr);
  }

  if (operator === 'starts_with') {
    const itemStr = String(itemValue).toLowerCase();
    const filterStr = String(value).toLowerCase();
    return itemStr.startsWith(filterStr);
  }

  if (operator === 'ends_with') {
    const itemStr = String(itemValue).toLowerCase();
    const filterStr = String(value).toLowerCase();
    return itemStr.endsWith(filterStr);
  }

  // Number operators
  if (operator === 'gt') {
    return Number(itemValue) > Number(value);
  }

  if (operator === 'lt') {
    return Number(itemValue) < Number(value);
  }

  if (operator === 'gte') {
    return Number(itemValue) >= Number(value);
  }

  if (operator === 'lte') {
    return Number(itemValue) <= Number(value);
  }

  if (operator === 'between') {
    const [min, max] = value.split(',').map(v => Number(v.trim()));
    const numValue = Number(itemValue);
    return numValue >= min && numValue <= max;
  }

  // Date operators
  if (operator === 'before') {
    const itemDate = new Date(itemValue);
    const filterDate = new Date(value);
    return itemDate < filterDate;
  }

  if (operator === 'after') {
    const itemDate = new Date(itemValue);
    const filterDate = new Date(value);
    return itemDate > filterDate;
  }

  // Tags operators
  if (operator === 'contains_any') {
    if (!Array.isArray(itemValue)) return false;
    const filterTags = value.split(',').map(t => t.trim().toLowerCase());
    return itemValue.some(tag => filterTags.includes(String(tag).toLowerCase()));
  }

  if (operator === 'contains_all') {
    if (!Array.isArray(itemValue)) return false;
    const filterTags = value.split(',').map(t => t.trim().toLowerCase());
    return filterTags.every(filterTag =>
      itemValue.some(tag => String(tag).toLowerCase() === filterTag)
    );
  }

  // Select operators
  if (operator === 'in') {
    const filterValues = value.split(',').map(v => v.trim().toLowerCase());
    return filterValues.includes(String(itemValue).toLowerCase());
  }

  return false;
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
  showFilterDropdown = false,
  setShowFilterDropdown = () => {},
  onFilterRulesChange = () => {},
  ignoreScope = false,
  onFileOpen,
  searchQuery = '',
  folderScope = 'all',
  onFolderScopeChange
}) {

  const { isFileInScope } = useFolderScope()
  const { configManager } = useBases()

  // Load saved configuration on mount
  const [configLoaded, setConfigLoaded] = useState(false)

  // ALL STATE DECLARATIONS FIRST
  const [availableProperties, setAvailableProperties] = useState([])
  const [sortRules, setSortRules] = useState([])
  const [filterRules, setFilterRules] = useState([])
  const [filterLogicOperator, setFilterLogicOperator] = useState('AND')
  const [groupBy, setGroupBy] = useState(null) // Column to group by
  const [collapsedGroups, setCollapsedGroups] = useState(new Set()) // Set of collapsed group keys
  const [enabledColumns, setEnabledColumns] = useState({
    name: true, // Always enabled
    title: false,
    created: false,
    modified: false,
    size: false,
    path: false,
    extension: false,
    tags: false,
    links: false,
    embeds: false,
    aliases: false
  })

  const [columnWidths, setColumnWidths] = useState({})
  const [columnOrder, setColumnOrder] = useState(null)
  const [pinnedColumns, setPinnedColumns] = useState({ name: true })

  // Drag and resize state
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const resizeRef = useRef(null)

  // Cell editing state
  const [editingCell, setEditingCell] = useState(null) // { rowPath, column }
  const [editValue, setEditValue] = useState('')
  const [saveStatus, setSaveStatus] = useState(null) // 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null)
  const editInputRef = useRef(null)

  // Row selection state
  const [selectedRows, setSelectedRows] = useState(new Set()) // Set of selected row paths
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null) // For shift-click selection

  // Path expansion state
  const [expandedPaths, setExpandedPaths] = useState(new Set()) // Set of expanded path cells (format: "rowPath:column")

  // COMPUTED VALUES AFTER STATE
  // Use data prop if available, otherwise fall back to notes prop, or empty array
  const items = data?.length > 0 ? data : notes?.length > 0 ? notes : [];

  // Get columns based on enabled state and custom order
  const displayColumns = useMemo(() => {
    const defaultOrder = ['name', ...Object.keys(enabledColumns).filter(col => col !== 'name' && enabledColumns[col])]

    console.log('[BaseTableView] Enabled columns:', enabledColumns)
    console.log('[BaseTableView] Default order:', defaultOrder)
    console.log('[BaseTableView] Saved column order:', columnOrder)

    if (!columnOrder) {
      return defaultOrder
    }

    // Filter columnOrder to only include enabled columns
    const orderedColumns = columnOrder.filter(col =>
      col === 'name' || enabledColumns[col]
    )

    // Add any new enabled columns that aren't in the saved order
    const newColumns = defaultOrder.filter(col => !orderedColumns.includes(col))

    const finalColumns = [...orderedColumns, ...newColumns]
    console.log('[BaseTableView] Final display columns:', finalColumns)

    return finalColumns
  }, [enabledColumns, columnOrder])

  // Calculate total table width based on column widths
  const totalTableWidth = useMemo(() => {
    const checkboxWidth = 48
    const columnsWidth = displayColumns.reduce((sum, col) => sum + (columnWidths[col] || 200), 0)
    return checkboxWidth + columnsWidth
  }, [displayColumns, columnWidths])

  // Filter items based on folder scope and apply sorting
  const scopedItems = useMemo(() => {
    // If ignoreScope is true, don't filter by folder scope
    let filtered = ignoreScope ? items : items.filter(item => isFileInScope(item.path));

    // Apply search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        // Search in file name
        const fileName = getFileName(item.path).toLowerCase();
        if (fileName.includes(query)) return true;

        // Search in all property values
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

    // Apply filters if filter rules exist
    if (filterRules.length > 0) {
      filtered = filtered.filter(item => {
        if (filterLogicOperator === 'AND') {
          // All filters must pass (AND logic)
          return filterRules.every(rule => evaluateFilter(item, rule));
        } else {
          // At least one filter must pass (OR logic)
          return filterRules.some(rule => evaluateFilter(item, rule));
        }
      });
    }

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
  }, [items, isFileInScope, sortRules, filterRules, filterLogicOperator, ignoreScope, searchQuery])

  // Group items if groupBy is set
  const groupedItems = useMemo(() => {
    if (!groupBy) {
      return null; // No grouping
    }

    const groups = new Map();

    scopedItems.forEach(item => {
      let groupValue = item.properties?.[groupBy] || item[groupBy];

      // Handle special cases
      if (groupBy === 'name') {
        groupValue = getFileName(item.path);
      }

      // Handle arrays (like tags) - create a group for each tag
      if (Array.isArray(groupValue)) {
        groupValue.forEach(val => {
          const key = String(val || '(empty)');
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key).push(item);
        });
        return;
      }

      // Handle empty values
      const key = groupValue ? String(groupValue) : '(empty)';

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });

    // Sort groups by key
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [scopedItems, groupBy])

  // Toggle group collapse
  const handleToggleGroup = (groupKey) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }

  // Load saved configuration when base changes
  useEffect(() => {
    if (!configManager || !base?.name) return

    const loadConfig = async () => {
      const settings = configManager.getBaseSettings(base.name)

      // Merge saved enabledColumns with defaults to ensure all columns are present
      if (settings.enabledColumns) {
        setEnabledColumns(prev => ({
          ...prev, // Keep defaults
          ...settings.enabledColumns // Override with saved settings
        }))
      }
      if (settings.pinnedColumns) setPinnedColumns(settings.pinnedColumns)
      if (settings.columnWidths) setColumnWidths(settings.columnWidths)
      if (settings.columnOrder) setColumnOrder(settings.columnOrder)
      if (settings.sortRules) setSortRules(settings.sortRules)
      if (settings.filterRules) setFilterRules(settings.filterRules)
      if (settings.filterLogicOperator) setFilterLogicOperator(settings.filterLogicOperator)

      setConfigLoaded(true)
    }

    loadConfig()
  }, [base?.name, configManager])

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

  const handleFilterChange = (newRules, newLogicOperator) => {
    setFilterRules(newRules);
    setFilterLogicOperator(newLogicOperator);
    // Notify parent component of filter rules change
    onFilterRulesChange(newRules);
  }

  // Selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      const allPaths = new Set(scopedItems.map(item => item.path));
      setSelectedRows(allPaths);
    } else {
      setSelectedRows(new Set());
    }
  }

  const handleSelectRow = (path, index, event) => {
    const newSelection = new Set(selectedRows);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift-click: select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        if (scopedItems[i]) {
          newSelection.add(scopedItems[i].path);
        }
      }
    } else if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl-click: toggle selection
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
    } else {
      // Regular click: single selection
      if (newSelection.has(path) && newSelection.size === 1) {
        newSelection.clear();
      } else {
        newSelection.clear();
        newSelection.add(path);
      }
    }

    setSelectedRows(newSelection);
    setLastSelectedIndex(index);
  }

  // Keyboard shortcuts and click-outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl+A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const allPaths = new Set(scopedItems.map(item => item.path));
        setSelectedRows(allPaths);
      }
      // Escape: Clear selection and close dropdowns
      if (e.key === 'Escape') {
        setSelectedRows(new Set());
        setShowSortDropdown(false);
        setShowPropertiesDropdown(false);
        setShowFilterDropdown(false);
      }
      // Delete: Delete selected files
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
      }
    };

    const handleClickOutside = (e) => {
      // Close dropdowns when clicking outside
      const target = e.target;
      const isInsideDropdown = target.closest('.dropdown-portal') || target.closest('button[title="Sort"]') || target.closest('button[title="Properties"]') || target.closest('button');
      if (!isInsideDropdown) {
        setShowSortDropdown(false);
        setShowPropertiesDropdown(false);
        setShowFilterDropdown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [scopedItems, selectedRows]);

  // Bulk operation handlers
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;

    const confirmed = confirm(`Delete ${selectedRows.size} file${selectedRows.size > 1 ? 's' : ''}?`);
    if (!confirmed) return;

    try {
      for (const path of selectedRows) {
        await invoke('delete_file', { path });
      }
      setSelectedRows(new Set());
      // Trigger refresh
      window.location.reload();
    } catch (err) {
      alert('Failed to delete some files');
    }
  };

  const handleBulkEditProperty = async (property, value) => {
    if (selectedRows.size === 0) return;

    try {
      for (const path of selectedRows) {
        const content = await invoke('read_file_content', { path });
        const writer = new FrontmatterWriter(content);
        writer.setProperty(property, value);
        const newContent = writer.toString();
        await invoke('write_file_content', { path, content: newContent });
      }
      setSelectedRows(new Set());
      // Trigger refresh
      window.location.reload();
    } catch (err) {
      alert('Failed to edit some files');
    }
  };

  // Auto-save configuration changes
  useEffect(() => {
    if (!configManager || !base?.name || !configLoaded) return
    configManager.saveColumnWidths(base.name, columnWidths)
  }, [columnWidths, base?.name, configManager, configLoaded])

  useEffect(() => {
    if (!configManager || !base?.name || !displayColumns.length || !configLoaded) return
    configManager.saveColumnOrder(base.name, displayColumns)
  }, [displayColumns, base?.name, configManager, configLoaded])

  useEffect(() => {
    if (!configManager || !base?.name || !configLoaded) return
    configManager.savePinnedColumns(base.name, pinnedColumns)
  }, [pinnedColumns, base?.name, configManager, configLoaded])

  useEffect(() => {
    if (!configManager || !base?.name || !configLoaded) return
    configManager.saveEnabledColumns(base.name, enabledColumns)
  }, [enabledColumns, base?.name, configManager, configLoaded])

  useEffect(() => {
    if (!configManager || !base?.name || !configLoaded) return
    configManager.saveSortRules(base.name, sortRules)
  }, [sortRules, base?.name, configManager, configLoaded])

  useEffect(() => {
    if (!configManager || !base?.name || !configLoaded) return
    configManager.saveFilterRules(base.name, filterRules, filterLogicOperator)
  }, [filterRules, filterLogicOperator, base?.name, configManager, configLoaded])

  // Column drag handlers with snap zones
  const [dropSide, setDropSide] = useState(null) // 'left' or 'right'

  const handleDragStart = (e, column) => {
    if (column === 'name') {
      e.preventDefault()
      return
    }
    setDraggedColumn(column)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.currentTarget)
  }

  const handleDragOver = (e, column) => {
    e.preventDefault()
    if (column === 'name' || !draggedColumn) return

    // Calculate which side of the column we're on
    const rect = e.currentTarget.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    const side = e.clientX < midpoint ? 'left' : 'right'

    setDragOverColumn(column)
    setDropSide(side)
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDragOverColumn(null)
    setDropSide(null)
  }

  const handleDrop = (e, targetColumn) => {
    e.preventDefault()

    if (!draggedColumn || draggedColumn === targetColumn || targetColumn === 'name') {
      return
    }

    const newOrder = [...displayColumns]
    const draggedIndex = newOrder.indexOf(draggedColumn)
    const targetIndex = newOrder.indexOf(targetColumn)

    // Remove dragged column
    newOrder.splice(draggedIndex, 1)

    // Insert based on drop side
    let insertIndex = targetIndex
    if (dropSide === 'right') {
      insertIndex = targetIndex + 1
    }
    // Adjust if we removed from before the target
    if (draggedIndex < targetIndex) {
      insertIndex -= 1
    }

    newOrder.splice(insertIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
    setDragOverColumn(null)
    setDropSide(null)
  }

  // Column resize handlers
  const handleResizeStart = (e, column) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(column)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnWidths[column] || 200)
  }

  const handleResizeMove = useCallback((e) => {
    if (!resizingColumn) return

    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(80, Math.min(600, resizeStartWidth + diff))

    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }))
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null)
  }, [])

  // Attach resize listeners
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd])

  // Pin/unpin column handler
  const handleTogglePin = (column) => {
    setPinnedColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

  // Path expansion handler
  const handleTogglePathExpansion = (rowPath, column) => {
    const key = `${rowPath}:${column}`;
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }

  // Cell editing handlers
  const handleCellClick = (item, column) => {
    // Path column has special click behavior (expand/collapse)
    if (column === 'path') {
      handleTogglePathExpansion(item.path, column);
      return;
    }

    // Don't allow editing name column or computed columns
    if (column === 'name' || column === 'created' || column === 'modified' || column === 'size' || column === 'extension') {
      return
    }

    // Get current value
    const currentValue = item.properties?.[column] || item[column] || ''
    const formattedValue = Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue)

    setEditingCell({ rowPath: item.path, column })
    setEditValue(formattedValue)
    setSaveStatus(null)
  }

  const handleCellInputChange = (e) => {
    setEditValue(e.target.value)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (300ms debounce)
    saveTimeoutRef.current = setTimeout(() => {
      handleCellSave()
    }, 300)
  }

  const handleCellSave = async () => {
    if (!editingCell) return

    try {
      setSaveStatus('saving')

      // Read current file content
      const fileContent = await invoke('read_file_content', { path: editingCell.rowPath })

      // Parse value based on column type
      let newValue = editValue.trim()

      // Handle array values (comma-separated)
      if (editingCell.column === 'tags' || editingCell.column === 'aliases') {
        newValue = FrontmatterWriter.parseCommaSeparated(editValue)
      } else if (!isNaN(newValue) && newValue !== '') {
        // Handle numbers
        newValue = Number(newValue)
      } else if (newValue === 'true' || newValue === 'false') {
        // Handle booleans
        newValue = newValue === 'true'
      }

      // Update frontmatter
      const updatedContent = FrontmatterWriter.updateProperty(fileContent, editingCell.column, newValue)

      // Write back to file
      await invoke('write_file_content', {
        path: editingCell.rowPath,
        content: updatedContent
      })

      setSaveStatus('saved')

      // Call onNoteUpdate if provided to refresh data
      if (onNoteUpdate) {
        onNoteUpdate()
      }

      // Clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus(null)
        setEditingCell(null)
      }, 2000)

    } catch (error) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Save immediately on Enter
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      handleCellSave()
    } else if (e.key === 'Escape') {
      // Cancel editing on Escape
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      setEditingCell(null)
      setEditValue('')
      setSaveStatus(null)
    }
  }

  const handleCellBlur = () => {
    // Don't close immediately on blur, let the save complete
    setTimeout(() => {
      if (saveStatus !== 'saving') {
        setEditingCell(null)
        setEditValue('')
      }
    }, 200)
  }

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingCell])

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
      onFileOpen(fileObject);
    } else {
      // Normal click = same tab
      onFileOpen(fileObject);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-app-bg ${className}`}>
      {/* Bulk Actions Toolbar */}
      {selectedRows.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-app-accent/10 border-b border-app-accent/30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-app-text">
              {selectedRows.size} selected
            </span>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-xs text-app-muted hover:text-app-text transition-colors"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => {
                const property = prompt('Property name:');
                if (property) {
                  const value = prompt('Property value:');
                  if (value !== null) {
                    handleBulkEditProperty(property, value);
                  }
                }
              }}
              className="px-3 py-1.5 text-sm text-app-text hover:bg-app-accent/10 rounded transition-colors"
            >
              Edit property
            </button>
          </div>
        </div>
      )}

      {/* Modern clean table with Notion/Linear aesthetic */}
      <div className="flex-1 bg-app-bg relative overflow-auto">
        <div style={{ width: 'max-content', minWidth: '100%' }}>
          <table className="border-separate" style={{
            borderSpacing: 0,
            width: `${totalTableWidth}px`,
            tableLayout: 'fixed'
          }}>
          {/* Table header */}
          <thead className="sticky top-0 z-10 bg-app-bg border-b-2 border-app-border">
            <tr>
              {/* Selection checkbox column */}
              <th
                className="px-4 py-3 w-12 text-left align-middle font-semibold text-xs text-app-muted uppercase tracking-wide border-r border-app-border/50 sticky left-0 z-30 bg-app-bg"
                style={{
                  width: 48,
                  backgroundColor: 'var(--app-bg)',
                  boxShadow: '2px 0 8px 0 rgba(0,0,0,0.15)'
                }}
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={scopedItems.length > 0 && selectedRows.size === scopedItems.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="appearance-none w-4 h-4 border-2 border-app-border rounded bg-transparent checked:bg-app-accent checked:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20 transition-all cursor-pointer"
                  />
                  {scopedItems.length > 0 && selectedRows.size === scopedItems.length && (
                    <Check className="w-3 h-3 text-white absolute pointer-events-none" />
                  )}
                </div>
              </th>

              {displayColumns.map((column, index) => (
                <th
                  key={column}
                  draggable={column !== 'name'}
                  onDragStart={(e) => handleDragStart(e, column)}
                  onDragOver={(e) => handleDragOver(e, column)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, column)}
                  className={`group px-4 py-3 text-left text-xs font-semibold text-app-muted uppercase tracking-wide border-r border-app-border/50 last:border-r-0 relative bg-app-bg transition-all ${
                    draggedColumn === column ? 'opacity-50' : ''
                  } ${
                    column !== 'name' ? 'cursor-move' : ''
                  }`}
                  style={{
                    width: columnWidths[column] || 200,
                    position: pinnedColumns[column] ? 'sticky' : 'relative',
                    left: pinnedColumns[column] ? (index === 0 ? 0 : columnWidths['name'] || 300) : 'auto',
                    zIndex: pinnedColumns[column] ? 30 : 10,
                    backgroundColor: 'var(--app-bg)',
                    ...(pinnedColumns[column] ? {
                      boxShadow: '2px 0 8px 0 rgba(0,0,0,0.15)',
                    } : {}),
                  }}
                >
                  {/* Drop indicator */}
                  {dragOverColumn === column && dropSide && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-app-accent z-50 pointer-events-none"
                      style={{
                        [dropSide === 'left' ? 'left' : 'right']: 0,
                      }}
                    />
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Drag handle - always visible to indicate draggability */}
                      {column !== 'name' && (
                        <GripVertical
                          className="w-3 h-3 text-app-muted/40 group-hover:text-app-muted flex-shrink-0"
                          style={{ cursor: 'grab' }}
                          title="Drag to reorder column"
                        />
                      )}
                      <span className="truncate">{column === 'name' ? 'File Name' : column.charAt(0).toUpperCase() + column.slice(1)}</span>
                    </div>

                    {/* Pin button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTogglePin(column)
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-accent/10 transition-all flex-shrink-0 ${
                        pinnedColumns[column] ? 'opacity-100 text-app-accent' : 'text-app-muted'
                      }`}
                      title={pinnedColumns[column] ? 'Unpin column' : 'Pin column'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Resize handle - wider hit area with visible indicator */}
                  <div
                    onMouseDown={(e) => handleResizeStart(e, column)}
                    className="absolute right-0 top-0 bottom-0 w-1 bg-app-border/30 hover:bg-app-accent hover:w-1.5 cursor-col-resize transition-all"
                    style={{
                      marginRight: '-2px',
                      zIndex: 40
                    }}
                    title="Drag to resize column"
                  />
                </th>
              ))}
            </tr>
          </thead>

          {/* Table body with clickable files */}
          <tbody>
            {groupedItems ? (
              // Render grouped items
              Array.from(groupedItems.entries()).map(([groupKey, groupItems]) => (
                <React.Fragment key={groupKey}>
                  {/* Group Header Row */}
                  <tr className="bg-app-surface sticky top-[41px] z-[5]">
                    <td colSpan={displayColumns.length + 1} className="px-4 py-2">
                      <button
                        onClick={() => handleToggleGroup(groupKey)}
                        className="flex items-center gap-2 w-full text-left hover:text-app-accent transition-colors"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            collapsedGroups.has(groupKey) ? '-rotate-90' : ''
                          }`}
                        />
                        <span className="font-medium text-app-text">{groupKey}</span>
                        <span className="text-xs text-app-muted">({groupItems.length})</span>
                      </button>
                    </td>
                  </tr>
                  {/* Group Items - only show if not collapsed */}
                  {!collapsedGroups.has(groupKey) && groupItems.map((item, itemIndex) => {
                    const globalIndex = scopedItems.findIndex(i => i.path === item.path);
                    return (
                    <tr
                      key={item.id || item.path || itemIndex}
                      className={`border-b border-app-border/50 group transition-all hover:bg-app-surface ${
                        selectedRows.has(item.path) ? 'bg-app-accent/10' : itemIndex % 2 === 0 ? 'bg-app-bg' : 'bg-app-surface/30'
                      }`}
                    >
                      {/* Selection checkbox */}
                      <td
                        className={`px-4 py-3 w-12 border-r border-app-border/30 sticky left-0 z-25 ${
                          selectedRows.has(item.path) ? 'bg-app-accent/10' : itemIndex % 2 === 0 ? 'bg-app-bg' : 'bg-app-surface/30'
                        }`}
                        style={{
                          width: 48,
                          boxShadow: '2px 0 8px 0 rgba(0,0,0,0.15)'
                        }}
                      >
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(item.path)}
                            onChange={(e) => handleSelectRow(item.path, globalIndex, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="appearance-none w-4 h-4 border-2 border-app-border rounded bg-transparent checked:bg-app-accent checked:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20 transition-all cursor-pointer"
                          />
                          {selectedRows.has(item.path) && (
                            <Check className="w-3 h-3 text-white absolute pointer-events-none" />
                          )}
                        </div>
                      </td>

                      {displayColumns.map((column, colIndex) => {
                        const cellValue = column === 'name'
                          ? getFileName(item.path)
                          : item.properties?.[column] || item[column];

                        return (
                        <td
                          key={`${item.id || item.path}-${column}`}
                          className={`px-4 py-3 text-sm text-app-text align-middle border-r border-app-border/30 last:border-r-0 group/cell ${
                            selectedRows.has(item.path) ? 'bg-app-accent/10' : itemIndex % 2 === 0 ? 'bg-app-bg' : 'bg-app-surface/30'
                          }`}
                          style={{
                            width: columnWidths[column] || 200,
                            position: pinnedColumns[column] ? 'sticky' : 'relative',
                            left: pinnedColumns[column] ? (colIndex === 0 ? 0 : columnWidths['name'] || 300) : 'auto',
                            zIndex: pinnedColumns[column] ? 25 : 'auto',
                            ...(pinnedColumns[column] ? {
                              boxShadow: '2px 0 8px 0 rgba(0,0,0,0.15)',
                            } : {}),
                          }}
                        >
                          {column === 'name' ? (
                            <button
                              onClick={(e) => handleFileClick(item.path, e)}
                              className="text-app-accent font-medium hover:underline cursor-pointer text-left w-full hover:text-app-accent/80 transition-colors"
                            >
                              {getFileName(item.path) || 'Untitled'}
                            </button>
                          ) : editingCell?.rowPath === item.path && editingCell?.column === column ? (
                            <div className="flex items-center gap-2">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editValue}
                                onChange={handleCellInputChange}
                                onKeyDown={handleCellKeyDown}
                                onBlur={handleCellBlur}
                                className="flex-1 px-2 py-1 text-sm bg-app-bg border border-app-accent rounded focus:outline-none focus:ring-2 focus:ring-app-accent/20 text-app-text"
                                placeholder="Enter value..."
                              />
                              {saveStatus && (
                                <span className={`text-xs ${
                                  saveStatus === 'saving' ? 'text-app-muted' :
                                  saveStatus === 'saved' ? 'text-green-500' :
                                  'text-red-500'
                                }`}>
                                  {saveStatus === 'saving' ? 'Saving...' :
                                   saveStatus === 'saved' ? 'Saved' :
                                   'Error'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => handleCellClick(item, column)}
                              className={`text-app-text px-2 py-1 -mx-2 -my-1 rounded transition-colors ${
                                // Path column: clickable to expand
                                column === 'path'
                                  ? 'cursor-pointer hover:bg-app-accent/10 group-hover:border group-hover:border-app-border/30'
                                  // Other read-only columns: no cursor pointer, no hover effects
                                  : column === 'created' || column === 'modified' || column === 'size' || column === 'extension'
                                  ? 'cursor-default'
                                  : 'cursor-pointer hover:bg-app-accent/10 group-hover:border group-hover:border-app-border/30'
                              }`}
                            >
                              {column === 'path' ? (
                                <div className="flex items-center gap-1">
                                  <span className={expandedPaths.has(`${item.path}:${column}`) ? 'whitespace-normal break-all' : 'truncate'}>
                                    {cellValue || '—'}
                                  </span>
                                  <span className="text-xs text-app-muted flex-shrink-0">
                                    {expandedPaths.has(`${item.path}:${column}`) ? '▼' : '▶'}
                                  </span>
                                </div>
                              ) : column === 'tags' && Array.isArray(cellValue) ? (
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
                        </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </React.Fragment>
              ))
            ) : (
              // Render ungrouped items
              scopedItems.map((item, index) => (
              <tr
                key={item.id || item.path || index}
                className={`border-b border-app-border/50 group transition-all hover:bg-app-surface ${
                  selectedRows.has(item.path) ? 'bg-app-accent/10' : index % 2 === 0 ? 'bg-app-bg' : 'bg-app-surface/30'
                }`}
              >
                {/* Selection checkbox */}
                <td
                  className={`px-4 py-3 w-12 border-r border-app-border/30 sticky left-0 z-25 ${
                    selectedRows.has(item.path) ? 'bg-app-accent/10' : index % 2 === 0 ? 'bg-app-bg' : 'bg-app-surface/30'
                  }`}
                  style={{
                    width: 48,
                    boxShadow: '2px 0 8px 0 rgba(0,0,0,0.15)'
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(item.path)}
                      onChange={(e) => handleSelectRow(item.path, index, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="appearance-none w-4 h-4 border-2 border-app-border rounded bg-transparent checked:bg-app-accent checked:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20 transition-all cursor-pointer"
                    />
                    {selectedRows.has(item.path) && (
                      <Check className="w-3 h-3 text-white absolute pointer-events-none" />
                    )}
                  </div>
                </td>

                {displayColumns.map((column, colIndex) => {
                  const cellValue = column === 'name'
                    ? getFileName(item.path)
                    : item.properties?.[column] || item[column];

                  return (
                  <td
                    key={`${item.id || item.path}-${column}`}
                    className={`px-4 py-3 text-sm text-app-text align-middle border-r border-app-border/30 last:border-r-0 group/cell ${
                      selectedRows.has(item.path) ? 'bg-app-accent/10' : index % 2 === 0 ? 'bg-app-bg' : 'bg-app-surface/30'
                    }`}
                    style={{
                      width: columnWidths[column] || 200,
                      position: pinnedColumns[column] ? 'sticky' : 'relative',
                      left: pinnedColumns[column] ? (colIndex === 0 ? 0 : columnWidths['name'] || 300) : 'auto',
                      zIndex: pinnedColumns[column] ? 25 : 'auto',
                      ...(pinnedColumns[column] ? {
                        boxShadow: '2px 0 8px 0 rgba(0,0,0,0.15)',
                      } : {}),
                    }}
                  >
                    {column === 'name' ? (
                      <button
                        onClick={(e) => handleFileClick(item.path, e)}
                        className="text-app-accent font-medium hover:underline cursor-pointer text-left w-full hover:text-app-accent/80 transition-colors"
                      >
                        {getFileName(item.path) || 'Untitled'}
                      </button>
                    ) : editingCell?.rowPath === item.path && editingCell?.column === column ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editValue}
                          onChange={handleCellInputChange}
                          onKeyDown={handleCellKeyDown}
                          onBlur={handleCellBlur}
                          className="flex-1 px-2 py-1 text-sm bg-app-bg border border-app-accent rounded focus:outline-none focus:ring-2 focus:ring-app-accent/20 text-app-text"
                          placeholder="Enter value..."
                        />
                        {saveStatus && (
                          <span className={`text-xs ${
                            saveStatus === 'saving' ? 'text-app-muted' :
                            saveStatus === 'saved' ? 'text-green-500' :
                            'text-red-500'
                          }`}>
                            {saveStatus === 'saving' ? 'Saving...' :
                             saveStatus === 'saved' ? 'Saved' :
                             'Error'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => handleCellClick(item, column)}
                        className={`text-app-text px-2 py-1 -mx-2 -my-1 rounded transition-colors ${
                          // Path column: clickable to expand
                          column === 'path'
                            ? 'cursor-pointer hover:bg-app-accent/10 group-hover:border group-hover:border-app-border/30'
                            // Other read-only columns: no cursor pointer, no hover effects
                            : column === 'created' || column === 'modified' || column === 'size' || column === 'extension'
                            ? 'cursor-default'
                            : 'cursor-pointer hover:bg-app-accent/10 group-hover:border group-hover:border-app-border/30'
                        }`}
                      >
                        {column === 'path' ? (
                          <div className="flex items-center gap-1">
                            <span className={expandedPaths.has(`${item.path}:${column}`) ? 'whitespace-normal break-all' : 'truncate'}>
                              {cellValue || '—'}
                            </span>
                            <span className="text-xs text-app-muted flex-shrink-0">
                              {expandedPaths.has(`${item.path}:${column}`) ? '▼' : '▶'}
                            </span>
                          </div>
                        ) : column === 'tags' && Array.isArray(cellValue) ? (
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
                  </td>
                  );
                })}
              </tr>
            ))
            )}
          </tbody>
        </table>
        </div>

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
          className="dropdown-portal fixed top-16 right-[280px] w-80 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 max-h-96 overflow-y-auto overflow-x-visible">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-app-text">Sort & Group</span>
              <button
                onClick={() => setShowSortDropdown(false)}
                className="text-app-muted hover:text-app-text"
              >
                ×
              </button>
            </div>

            {/* Group By Section */}
            <div className="mb-4 pb-3 border-b border-app-border">
              <span className="text-xs font-medium text-app-muted uppercase tracking-wide mb-2 block">Group By</span>
              <CustomSelect
                value={groupBy || 'none'}
                onChange={(value) => setGroupBy(value === 'none' ? null : value)}
                options={[
                  { value: 'none', label: 'No grouping' },
                  ...sortableProperties
                ]}
                className="w-full"
              />
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
          className="dropdown-portal fixed top-16 right-8 w-80 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999]"
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

      {/* Filter Dropdown Portal */}
      {showFilterDropdown && createPortal(
        <div
          className="dropdown-portal fixed top-16 right-[420px] w-96 bg-app-bg border border-app-border rounded-lg shadow-2xl z-[9999]"
          onClick={(e) => e.stopPropagation()}
        >
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