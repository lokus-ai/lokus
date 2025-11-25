import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Filter, Clock, Tag, Folder, Calendar, HelpCircle } from 'lucide-react';
import { getSearchEngine } from '../core/search/search-engine';
import { getQueryParser, formatFilters } from '../core/search/query-parser';
import SearchResults from './SearchResults';

/**
 * FullTextSearchPanel - Advanced search with filters and operators
 * Keyboard shortcut: Cmd/Ctrl+Shift+F
 */
const FullTextSearchPanel = ({ isOpen, onClose, onResultClick, workspacePath }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [filters, setFilters] = useState({
    tag: '',
    folder: '',
    modified: ''
  });
  const [options, setOptions] = useState({
    fuzzy: true,
    prefix: true,
    combineWith: 'AND'
  });

  const searchEngine = useMemo(() => getSearchEngine(), []);
  const queryParser = useMemo(() => getQueryParser(), []);

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lokus-search-history');
    if (saved) {
      try {
        const history = JSON.parse(saved);
        setSearchHistory(history);
      } catch (err) {
        console.error('Failed to load search history:', err);
      }
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = useCallback((searchQuery) => {
    if (!searchQuery.trim()) return;

    const updated = [
      { query: searchQuery, timestamp: Date.now() },
      ...searchHistory.filter(h => h.query !== searchQuery)
    ].slice(0, 20);

    setSearchHistory(updated);
    localStorage.setItem('lokus-search-history', JSON.stringify(updated));
  }, [searchHistory]);

  // Perform search
  const performSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Validate query
      const validation = queryParser.validate(searchQuery);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        setIsSearching(false);
        return;
      }

      // Parse query
      const parsed = queryParser.parse(searchQuery);

      // Merge parsed filters with UI filters
      const mergedFilters = {
        ...parsed.filters,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v)
        )
      };

      // Build search query
      const searchTerm = queryParser.toSearchQuery(parsed);

      // Perform search
      const searchResults = searchEngine.search(searchTerm, {
        filters: mergedFilters,
        fuzzy: options.fuzzy,
        prefix: options.prefix,
        combineWith: parsed.combineWith || options.combineWith,
        limit: 100
      });

      setResults(searchResults.results);
      saveSearchHistory(searchQuery);

      // Log performance
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, filters, options, searchEngine, queryParser, saveSearchHistory]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(() => performSearch(), 300);
    return () => clearTimeout(timeoutId);
  }, [query, filters, options]); // Only re-search when these change

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performSearch();
    }
  }, [onClose, performSearch]);

  // Handle history item click
  const handleHistoryClick = useCallback((historyQuery) => {
    setQuery(historyQuery);
    performSearch(historyQuery);
  }, [performSearch]);

  // Handle filter change
  const handleFilterChange = useCallback((filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  }, []);

  // Handle option change
  const handleOptionChange = useCallback((optionName, value) => {
    setOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      tag: '',
      folder: '',
      modified: ''
    });
  }, []);

  // Format active filters for display
  const activeFiltersText = useMemo(() => {
    return formatFilters(filters);
  }, [filters]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-app-bg w-full max-w-5xl max-h-[80vh] rounded-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-app-muted" />
            <h2 className="text-lg font-semibold">Full-Text Search</h2>
            {activeFiltersText && (
              <span className="text-xs text-app-muted bg-app-hover px-2 py-1 rounded">
                {activeFiltersText}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded hover:bg-app-hover"
              title="Search help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-app-hover"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-app-border">
          <div className="relative">
            <input
              type="text"
              placeholder='Search... (try "exact phrase", tag:name, folder:path, modified:today)'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 pr-10 bg-app-bg border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-primary text-base"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-app-hover"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search options */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${
                showFilters ? 'bg-app-primary text-white' : 'bg-app-hover'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.fuzzy}
                onChange={(e) => handleOptionChange('fuzzy', e.target.checked)}
                className="rounded"
              />
              Fuzzy
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.prefix}
                onChange={(e) => handleOptionChange('prefix', e.target.checked)}
                className="rounded"
              />
              Prefix
            </label>

            <select
              value={options.combineWith}
              onChange={(e) => handleOptionChange('combineWith', e.target.value)}
              className="px-2 py-1 rounded text-sm bg-app-hover border border-app-border"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="mt-3 p-3 bg-app-hover rounded-lg space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <Tag className="w-4 h-4" />
                    Tag
                  </label>
                  <input
                    type="text"
                    placeholder="important"
                    value={filters.tag}
                    onChange={(e) => handleFilterChange('tag', e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded bg-app-bg border border-app-border"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <Folder className="w-4 h-4" />
                    Folder
                  </label>
                  <input
                    type="text"
                    placeholder="notes"
                    value={filters.folder}
                    onChange={(e) => handleFilterChange('folder', e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded bg-app-bg border border-app-border"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    Modified
                  </label>
                  <select
                    value={filters.modified}
                    onChange={(e) => handleFilterChange('modified', e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded bg-app-bg border border-app-border"
                  >
                    <option value="">Any time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7days">Last 7 days</option>
                    <option value="last30days">Last 30 days</option>
                  </select>
                </div>
              </div>

              <button
                onClick={clearFilters}
                className="text-xs text-app-muted hover:text-app-text"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Help panel */}
          {showHelp && (
            <div className="mt-3 p-3 bg-app-hover rounded-lg text-sm space-y-2">
              <div><strong>Operators:</strong> AND, OR, NOT</div>
              <div><strong>Exact phrase:</strong> "hello world"</div>
              <div><strong>Filters:</strong> tag:name, folder:path, modified:today</div>
              <div><strong>Examples:</strong></div>
              <ul className="ml-4 text-xs space-y-1 text-app-muted">
                <li>hello AND world - both terms required</li>
                <li>"exact phrase" - exact match</li>
                <li>tag:important folder:notes - filter by tag and folder</li>
                <li>hello NOT world - hello but not world</li>
              </ul>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Search history sidebar */}
          {!query && searchHistory.length > 0 && (
            <div className="w-64 border-r border-app-border p-4 overflow-y-auto">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Recent Searches
              </h3>
              <div className="space-y-1">
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistoryClick(item.query)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-app-hover truncate"
                    title={item.query}
                  >
                    {item.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results area */}
          <div className="flex-1 overflow-y-auto">
            {!query && searchHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-app-muted p-8">
                <Search className="w-16 h-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">Full-Text Search</h3>
                <p className="text-sm max-w-md">
                  Search across all your notes with advanced filters and operators.
                  Try "exact phrases", tag:name, folder:path, or modified:today
                </p>
              </div>
            )}

            {query && (
              <SearchResults
                results={results}
                query={query}
                onResultClick={onResultClick}
                loading={isSearching}
                error={error}
              />
            )}
          </div>
        </div>

        {/* Footer with stats */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-app-border text-xs text-app-muted">
            Found {results.length} results ·
            {searchEngine.getStats().documentCount} documents indexed
          </div>
        )}
      </div>
    </div>
  );
};

export default FullTextSearchPanel;
