import React, { useState, useEffect } from 'react';
import { useBases } from './BasesContext.jsx';
import { useFolderScope } from '../contexts/FolderScopeContext.jsx';
import BaseTableView from './ui/BaseTableView.jsx';
import BaseListView from './ui/BaseListView.jsx';
import BaseGridView from './ui/BaseGridView.jsx';
import BaseSidebar from './ui/BaseSidebar.jsx';
import PropertyEditor from './ui/PropertyEditor.jsx';
import ColumnManager from './ui/ColumnManager.jsx';
import FilterBuilder from './ui/FilterBuilder.jsx';
import CustomSelect from './ui/CustomSelect.jsx';
import { Settings, Filter, Columns, Download, RefreshCw, AlertCircle, Table, ArrowUpDown, ChevronDown, Folder, FolderOpen, Search, List, Grid, MoreVertical } from 'lucide-react';

export default function BasesView({ isVisible, onFileOpen }) {
  const {
    activeBase,
    activeView,
    executeQuery,
    getAvailableProperties,
    switchView,
    isLoading,
    error,
    bases,
    createBase,
    loadBase,
    saveBase,
    deleteBase
  } = useBases();


  const { filterFileTree, scopeMode, setGlobalScope, setLocalScope } = useFolderScope();

  const [viewData, setViewData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [availableProperties, setAvailableProperties] = useState([]);
  const [showPropertyEditor, setShowPropertyEditor] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentColumns, setCurrentColumns] = useState([]);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showPropertiesDropdown, setShowPropertiesDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterRules, setFilterRules] = useState([]);
  const [baseScopeMode, setBaseScopeMode] = useState('all'); // 'all' or 'current'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState('table'); // 'table', 'list', 'grid'
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Load data when view changes
  useEffect(() => {
    if (!isVisible || !activeBase || !activeView) return;

    const loadData = async () => {
      const result = await executeQuery();
      if (result.success) {
        setViewData(result.data || []);
        setTotalCount(result.totalCount || 0);
        setFilteredCount(result.filteredCount || 0);
      }
    };

    loadData();
  }, [isVisible, activeBase, activeView, executeQuery, refreshKey]);

  // Load available properties
  useEffect(() => {
    const loadProperties = async () => {
      const result = await getAvailableProperties();
      if (result.success) {
        setAvailableProperties(result.properties || []);
      }
    };

    loadProperties();
  }, [getAvailableProperties]);

  // Handle property editing
  const handlePropertyEdit = (property) => {
    setSelectedProperty(property);
    setShowPropertyEditor(true);
  };

  // Handle data refresh
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Handle filter rules update from BaseTableView
  const handleFilterRulesChange = (rules) => {
    setFilterRules(rules);
  };

  // Handle adding columns
  const handleAddColumn = (property) => {
    setCurrentColumns(prev => [...prev, property]);
  };

  // Handle removing/reordering columns
  const handleColumnsChange = (newColumns) => {
    setCurrentColumns(newColumns);
  };

  // Handle export
  const handleExport = () => {
    if (viewData.length === 0) return;

    const headers = activeView.columns || ['name', 'created', 'modified'];
    const csvContent = [
      headers.join(','),
      ...viewData.map(row => {
        return headers.map(col => {
          let value = row[col] || row.properties?.[col] || '';

          // Handle special columns
          if (col === 'name' && row.path) {
            const parts = row.path.split('/');
            value = parts[parts.length - 1].replace(/\.md$/, '');
          }

          // Handle arrays (like tags)
          if (Array.isArray(value)) {
            value = value.join('; ');
          }

          // Handle dates
          if (col === 'created' || col === 'modified') {
            if (typeof value === 'number') {
              value = new Date(value * 1000).toISOString();
            }
          }

          // Escape CSV values
          const stringValue = String(value);
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBase.name}-${activeView.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) return null;

  if (!activeBase) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-app-bg flex items-center justify-center">
            <Settings className="w-8 h-8 text-app-muted" />
          </div>
          <h3 className="text-lg font-medium text-app-text mb-2">
            No Base Selected
          </h3>
          <p className="text-app-muted">
            Select or create a base from the sidebar to get started
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-medium text-app-text mb-2">
            Error Loading Base
          </h3>
          <p className="text-app-muted mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-app-accent text-white rounded-lg hover:bg-app-accent/80 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Consolidated Header - Single Line */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-app-border/50 bg-app-bg">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-app-text">
            {activeBase.name}
          </h1>

          {/* View switcher with custom dropdown */}
          {activeBase.views && activeBase.views.length > 1 && (
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-app-muted" />
              <CustomSelect
                value={activeView?.name || ''}
                onChange={(viewName) => switchView(viewName)}
                options={activeBase.views.map(view => ({
                  value: view.name,
                  label: view.name
                }))}
                className="min-w-[150px]"
              />
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 text-xs bg-app-bg border border-app-border rounded text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent transition-colors w-48"
            />
          </div>

          <span className="text-xs text-app-muted border-l border-app-border pl-3 ml-1">
            {filteredCount} of {totalCount} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Type Switcher - Always visible */}
          <div className="flex items-center bg-app-surface border border-app-border rounded">
            <button
              onClick={() => setViewType('table')}
              className={`p-1.5 transition-colors ${
                viewType === 'table'
                  ? 'bg-app-accent text-white'
                  : 'text-app-muted hover:text-app-text hover:bg-app-accent/10'
              }`}
              title="Table view"
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`p-1.5 transition-colors ${
                viewType === 'list'
                  ? 'bg-app-accent text-white'
                  : 'text-app-muted hover:text-app-text hover:bg-app-accent/10'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType('grid')}
              className={`p-1.5 transition-colors ${
                viewType === 'grid'
                  ? 'bg-app-accent text-white'
                  : 'text-app-muted hover:text-app-text hover:bg-app-accent/10'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop buttons - hidden on small screens */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="w-px h-4 bg-app-border" />

            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
              title="Sort"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort
              <ChevronDown className={`w-3 h-3 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => setShowPropertiesDropdown(!showPropertiesDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
              title="Properties"
            >
              <Settings className="w-3.5 h-3.5" />
              Properties
              <ChevronDown className={`w-3 h-3 transition-transform ${showPropertiesDropdown ? 'rotate-180' : ''}`} />
            </button>

            <div className="w-px h-4 bg-app-border mx-1" />

            <button
              onClick={() => setShowFilterDropdown(prev => !prev)}
              className="p-2 text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors relative"
              title={filterRules.length > 0 ? `${filterRules.length} filter${filterRules.length !== 1 ? 's' : ''} active` : "Filter"}
            >
              <Filter className="w-4 h-4" />
              {filterRules.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-app-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {filterRules.length}
                </span>
              )}
            </button>

            <button
              onClick={handleRefresh}
              className="p-2 text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExport}
              className="p-2 text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
              title="Export CSV"
              disabled={viewData.length === 0}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile overflow menu - shown on small screens */}
          <div className="lg:hidden relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-app-bg border border-app-border rounded-lg shadow-2xl z-50">
                <div className="py-1">
                  <button
                    onClick={() => { setShowSortDropdown(!showSortDropdown); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app-text hover:bg-app-accent/10 transition-colors"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    Sort
                  </button>
                  <button
                    onClick={() => { setShowPropertiesDropdown(!showPropertiesDropdown); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app-text hover:bg-app-accent/10 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Properties
                  </button>
                  <button
                    onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app-text hover:bg-app-accent/10 transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    Filter {filterRules.length > 0 && `(${filterRules.length})`}
                  </button>
                  <div className="border-t border-app-border my-1" />
                  <button
                    onClick={() => { handleRefresh(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app-text hover:bg-app-accent/10 transition-colors"
                    disabled={isLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => { handleExport(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app-text hover:bg-app-accent/10 transition-colors"
                    disabled={viewData.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content - Conditional rendering based on view type */}
      <div className="flex-1 overflow-auto">
        {/* Always render BaseTableView for dropdown functionality */}
        <div style={{ display: viewType === 'table' ? 'flex' : 'none' }} className="flex-1 h-full">
          <BaseTableView
            data={viewData}
            base={activeBase}
            columns={currentColumns}
            onPropertyEdit={handlePropertyEdit}
            onAddColumn={handleAddColumn}
            onColumnResize={handleColumnsChange}
            isLoading={isLoading}
            showSortDropdown={showSortDropdown}
            setShowSortDropdown={setShowSortDropdown}
            showPropertiesDropdown={showPropertiesDropdown}
            setShowPropertiesDropdown={setShowPropertiesDropdown}
            showFilterDropdown={showFilterDropdown}
            setShowFilterDropdown={setShowFilterDropdown}
            onFilterRulesChange={handleFilterRulesChange}
            ignoreScope={baseScopeMode === 'all'}
            onFileOpen={onFileOpen}
            searchQuery={searchQuery}
            folderScope={baseScopeMode}
            onFolderScopeChange={(newScope) => {
              setBaseScopeMode(newScope);
              if (newScope === 'all') {
                setGlobalScope();
              }
              handleRefresh();
            }}
          />
        </div>

        {viewType === 'list' && (
          <BaseListView
            data={viewData}
            onFileOpen={onFileOpen}
            searchQuery={searchQuery}
          />
        )}

        {viewType === 'grid' && (
          <BaseGridView
            data={viewData}
            onFileOpen={onFileOpen}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Modals */}
      {showPropertyEditor && (
        <PropertyEditor
          property={selectedProperty}
          availableProperties={availableProperties}
          onClose={() => {
            setShowPropertyEditor(false);
            setSelectedProperty(null);
          }}
          onSave={(updatedProperty) => {
            // Handle property update
            handleRefresh();
            setShowPropertyEditor(false);
            setSelectedProperty(null);
          }}
        />
      )}

      {showColumnManager && (
        <ColumnManager
          currentColumns={activeView?.columns || []}
          availableProperties={availableProperties}
          onClose={() => setShowColumnManager(false)}
          onSave={(updatedColumns) => {
            // Update active view columns
            // This would normally update through the context
            setShowColumnManager(false);
            handleRefresh();
          }}
        />
      )}

      {showFilterBuilder && (
        <FilterBuilder
          currentFilters={activeView?.filters || []}
          availableProperties={availableProperties}
          onClose={() => setShowFilterBuilder(false)}
          onSave={(updatedFilters) => {
            // Update active view filters
            // This would normally update through the context
            setShowFilterBuilder(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}