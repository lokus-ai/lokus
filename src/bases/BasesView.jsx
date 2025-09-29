import React, { useState, useEffect } from 'react';
import { useBases } from './BasesContext.jsx';
import { useFolderScope } from '../contexts/FolderScopeContext.jsx';
import BaseTableView from './ui/BaseTableView.jsx';
import BaseSidebar from './ui/BaseSidebar.jsx';
import PropertyEditor from './ui/PropertyEditor.jsx';
import ColumnManager from './ui/ColumnManager.jsx';
import FilterBuilder from './ui/FilterBuilder.jsx';
import CustomSelect from './ui/CustomSelect.jsx';
import { Settings, Filter, Columns, Download, RefreshCw, AlertCircle, Table, ArrowUpDown, ChevronDown, Folder, FolderOpen } from 'lucide-react';

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

  console.log('🔥 BasesView render:', {
    isVisible,
    activeBase: activeBase?.name || 'none',
    activeView: activeView?.name || 'none',
    basesCount: bases?.length || 0,
    isLoading,
    error
  });

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
  const [baseScopeMode, setBaseScopeMode] = useState('all'); // 'all' or 'current'

  // Load data when view changes
  useEffect(() => {
    console.log('🔄 BasesView: Load data effect triggered:', {
      isVisible,
      activeBase: activeBase?.name || 'none',
      activeView: activeView?.name || 'none'
    });

    if (!isVisible || !activeBase || !activeView) {
      console.log('🔄 BasesView: Skipping data load - missing requirements');
      return;
    }

    const loadData = async () => {
      console.log('📊 BasesView: Starting data load... baseScopeMode:', baseScopeMode);
      const result = await executeQuery();
      console.log('📊 BasesView: Query result:', result);
      console.log('📊 BasesView: Raw data count from backend:', result.data?.length);

      if (result.success) {
        setViewData(result.data || []);
        setTotalCount(result.totalCount || 0);
        setFilteredCount(result.filteredCount || 0);
        console.log('✅ BasesView: Data loaded successfully:', {
          dataCount: result.data?.length || 0,
          totalCount: result.totalCount || 0,
          filteredCount: result.filteredCount || 0,
          baseScopeMode
        });
        console.log('📊 BasesView: First few items:', result.data?.slice(0, 3));
      } else {
        console.error('❌ BasesView: Data load failed:', result.error);
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

    const headers = activeView.columns || ['title', 'created', 'modified'];
    const csvContent = [
      headers.join(','),
      ...viewData.map(row =>
        headers.map(col => {
          const value = row[col] || '';
          return typeof value === 'string' && value.includes(',')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
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

          {/* Folder scope toggle */}
          <button
            onClick={() => {
              const newMode = baseScopeMode === 'all' ? 'current' : 'all';
              setBaseScopeMode(newMode);
              if (newMode === 'all') {
                setGlobalScope();
              }
              handleRefresh();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
            title={baseScopeMode === 'all' ? 'Showing all folders' : 'Showing current folder only'}
          >
            {baseScopeMode === 'all' ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
            {baseScopeMode === 'all' ? 'All Folders' : 'Current Folder'}
          </button>

          <span className="text-xs text-app-muted border-l border-app-border pl-3 ml-1">
            {filteredCount} of {totalCount} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Button */}
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
            title="Sort"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort
            <ChevronDown className={`w-3 h-3 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Properties Button */}
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
            onClick={() => setShowFilterBuilder(true)}
            className="p-2 text-app-muted hover:text-app-text hover:bg-app-accent/10 rounded transition-colors"
            title="Filter"
          >
            <Filter className="w-4 h-4" />
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
      </div>

      {/* Main content - Full width table */}
      <div className="flex-1 overflow-hidden">
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
          ignoreScope={baseScopeMode === 'all'}
          onFileOpen={onFileOpen}
        />
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