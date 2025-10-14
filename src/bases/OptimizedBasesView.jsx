/**
 * OptimizedBasesView.jsx
 *
 * Performance-optimized version of BasesView with quantum search integration
 * Uses streaming data, pagination, React.memo, and quantum search
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useBases } from './BasesContext.jsx';
import { useFolderScope } from '../contexts/FolderScopeContext.jsx';
import { StreamingDataLoader, useStreamingData } from '../quantum/StreamingDataLoader.js';
import { useQuantumSearch } from '../quantum/QuantumSearchSystem.js';
import { usePerformanceMonitor } from '../quantum/PerformanceMonitor.js';
import {
  OptimizedTabBar,
  VirtualList,
  DebouncedSearchInput,
  LoadingFallback
} from '../components/optimized/OptimizedComponents.jsx';

// Lazy load heavy components
const BaseTableView = React.lazy(() => import('./ui/BaseTableView.jsx'));
const BaseListView = React.lazy(() => import('./ui/BaseListView.jsx'));
const BaseGridView = React.lazy(() => import('./ui/BaseGridView.jsx'));

const OptimizedBasesView = React.memo(({ isVisible, onFileOpen }) => {
  const {
    activeBase,
    activeView,
    executeQuery,
    getAvailableProperties,
    isLoading: contextLoading,
    error
  } = useBases();

  const { filterFileTree, scopeMode } = useFolderScope();

  // Performance monitoring
  const { monitor, mark, measure, recordQuantum } = usePerformanceMonitor();

  // State management
  const [viewData, setViewData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState('table');
  const [isQuantumSearchEnabled, setIsQuantumSearchEnabled] = useState(true);

  // Quantum search integration
  const { search: quantumSearch, loading: quantumLoading, stats } = useQuantumSearch(
    activeBase?.path || '/'
  );

  // Streaming data loader
  const {
    data: streamedData,
    loading: streamLoading,
    error: streamError
  } = useStreamingData(activeBase?.path, {
    chunkSize: 50,
    includeContent: false,
    filter: (file) => {
      if (!searchQuery) return true;
      return file.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
  });

  // Memoized calculations
  const paginatedData = useMemo(() => {
    mark('pagination-start');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = (viewData || []).slice(start, end);
    measure('pagination', 'pagination-start', 'pagination-end');
    mark('pagination-end');
    return paginated;
  }, [viewData, currentPage, itemsPerPage, mark, measure]);

  const totalPages = useMemo(() =>
    Math.ceil((viewData?.length || 0) / itemsPerPage),
    [viewData, itemsPerPage]
  );

  // Handle search with quantum acceleration
  const handleSearch = useCallback(async (query) => {
    if (!query) {
      setViewData(streamedData || []);
      return;
    }

    mark('search-start');

    if (isQuantumSearchEnabled && quantumSearch) {
      // Use quantum search
      recordQuantum('quantumSearches', 1);
      const results = await quantumSearch(query, {
        limit: 100,
        semanticSearch: true,
        quantumBoost: true
      });

      if (results.results) {
        setViewData(results.results);
        console.log(`[OptimizedBasesView] Quantum search completed in ${results.latency}ms with ${results.speedup}x speedup`);
      }
    } else {
      // Fallback to traditional search
      const filtered = streamedData.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.path.toLowerCase().includes(query.toLowerCase())
      );
      setViewData(filtered);
    }

    measure('search-duration', 'search-start', 'search-end');
    mark('search-end');
  }, [streamedData, isQuantumSearchEnabled, quantumSearch, mark, measure, recordQuantum]);

  // Effect: Initialize data
  useEffect(() => {
    if (streamedData && !searchQuery) {
      setViewData(streamedData);
    }
  }, [streamedData, searchQuery]);

  // Effect: Reset page on data change
  useEffect(() => {
    setCurrentPage(1);
  }, [viewData]);

  // Render loading state
  if (contextLoading || streamLoading || quantumLoading) {
    return <LoadingFallback message="Loading bases..." />;
  }

  // Render error state
  if (error || streamError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">Error: {error || streamError}</p>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!activeBase) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-app-muted">No base selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-app-border/50 bg-app-bg">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-app-text">
            {activeBase.name}
          </h1>

          {/* Quantum search toggle */}
          <label className="flex items-center gap-2 text-sm text-app-muted">
            <input
              type="checkbox"
              checked={isQuantumSearchEnabled}
              onChange={(e) => setIsQuantumSearchEnabled(e.target.checked)}
              className="rounded"
            />
            Quantum Search
            {stats && (
              <span className="text-xs">
                ({stats.quantumSpeedup?.toFixed(1)}x faster)
              </span>
            )}
          </label>

          {/* Search input with debouncing */}
          <DebouncedSearchInput
            placeholder="Search with quantum boost..."
            onSearch={handleSearch}
            delay={300}
          />

          <span className="text-xs text-app-muted">
            {viewData.length} items
            {searchQuery && ` (filtered from ${streamedData?.length || 0})`}
          </span>
        </div>

        {/* View type selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewType('table')}
            className={`px-3 py-1 rounded ${
              viewType === 'table' ? 'bg-app-accent text-white' : 'bg-app-surface'
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewType('list')}
            className={`px-3 py-1 rounded ${
              viewType === 'list' ? 'bg-app-accent text-white' : 'bg-app-surface'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewType('grid')}
            className={`px-3 py-1 rounded ${
              viewType === 'grid' ? 'bg-app-accent text-white' : 'bg-app-surface'
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Content area with lazy loading */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<LoadingFallback />}>
          {viewType === 'table' && (
            <BaseTableView
              data={paginatedData}
              base={activeBase}
              columns={activeView?.columns || []}
              onFileOpen={onFileOpen}
              searchQuery={searchQuery}
            />
          )}
          {viewType === 'list' && (
            <VirtualList
              items={viewData}
              itemHeight={60}
              height={600}
              renderItem={(item) => (
                <BaseListView
                  data={[item]}
                  onFileOpen={onFileOpen}
                  searchQuery={searchQuery}
                />
              )}
            />
          )}
          {viewType === 'grid' && (
            <BaseGridView
              data={paginatedData}
              onFileOpen={onFileOpen}
              searchQuery={searchQuery}
            />
          )}
        </Suspense>
      </div>

      {/* Pagination controls */}
      {viewData.length > itemsPerPage && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={viewData.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(items) => {
            setItemsPerPage(items);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Performance stats overlay */}
      {process.env.NODE_ENV === 'development' && stats && (
        <div className="absolute bottom-20 right-4 bg-black/80 text-white text-xs p-2 rounded">
          <div>Quantum Searches: {stats.totalSearches}</div>
          <div>Cache Hits: {stats.cacheHits}</div>
          <div>Avg Latency: {stats.averageLatency?.toFixed(2)}ms</div>
          <div>Quantum Speedup: {stats.quantumSpeedup?.toFixed(1)}x</div>
        </div>
      )}
    </div>
  );
});

// Memoized pagination controls component
const PaginationControls = React.memo(({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-app-border/50 bg-app-bg">
      <div className="flex items-center gap-4">
        <span className="text-sm text-app-muted">
          Showing {startItem}-{endItem} of {totalItems} items
        </span>

        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="px-2 py-1 text-sm bg-app-bg border border-app-border rounded"
        >
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
          <option value={200}>200 per page</option>
          <option value={500}>500 per page</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-sm disabled:opacity-50"
        >
          First
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-sm disabled:opacity-50"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-sm disabled:opacity-50"
        >
          Last
        </button>
      </div>
    </div>
  );
});

PaginationControls.displayName = 'PaginationControls';
OptimizedBasesView.displayName = 'OptimizedBasesView';

export default OptimizedBasesView;