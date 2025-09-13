import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Filter, MoreVertical, ExternalLink, Clock, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { debounce, highlightText } from '../core/search/index.js';

const SearchPanel = ({ 
  isOpen, 
  onClose, 
  onFileOpen,
  workspacePath,
  fileTree = [],
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchOptions, setSearchOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    includeContent: true,
    fileTypes: ['md', 'txt']
  });
  const [searchHistory, setSearchHistory] = useState([]);
  const [selectedResult, setSelectedResult] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState(new Set());
  
  const searchInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const history = localStorage.getItem('lokus-search-history');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = useCallback((searchQuery) => {
    if (!searchQuery.trim()) return;
    
    const newHistory = [
      searchQuery,
      ...searchHistory.filter(item => item !== searchQuery)
    ].slice(0, 10); // Keep only last 10 searches
    
    setSearchHistory(newHistory);
    localStorage.setItem('lokus-search-history', JSON.stringify(newHistory));
  }, [searchHistory]);

  // Perform search across files
  const performSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use Tauri command for fast searching
      const searchResults = await invoke('search_in_files', {
        query: searchQuery,
        workspacePath: workspacePath,
        options: {
          caseSensitive: searchOptions.caseSensitive,
          wholeWord: searchOptions.wholeWord,
          regex: searchOptions.regex,
          fileTypes: searchOptions.fileTypes,
          maxResults: 100,
          contextLines: 2
        }
      });
      
      setResults(searchResults || []);
      setSelectedResult(0);
      saveSearchHistory(searchQuery);
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to client-side search if Tauri command fails
      try {
        const clientResults = await searchInFilesClientSide(searchQuery);
        setResults(clientResults);
      } catch (clientError) {
        console.error('Client-side search also failed:', clientError);
        setResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, searchOptions, saveSearchHistory]);

  // Client-side fallback search
  const searchInFilesClientSide = useCallback(async (searchQuery) => {
    const results = [];
    const maxResults = 50;
    
    for (const file of fileTree) {
      if (results.length >= maxResults) break;
      if (file.is_directory) continue;
      
      // Check file extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!searchOptions.fileTypes.includes(extension)) continue;
      
      try {
        // Read file content (you'd need to implement this based on your file system)
        // const content = await invoke('read_file', { path: file.path });
        // For now, just search in file names
        const nameMatches = file.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (nameMatches) {
          results.push({
            file: file.path,
            fileName: file.name,
            matches: [{
              line: 1,
              column: 0,
              text: file.name,
              match: searchQuery,
              context: [{ lineNumber: 1, text: file.name, isMatch: true }]
            }],
            matchCount: 1
          });
        }
      } catch (error) {
        console.warn(`Failed to search in file ${file.path}:`, error);
      }
    }
    
    return results;
  }, [fileTree, searchOptions]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(performSearch, 300),
    [performSearch]
  );

  // Perform search when query changes
  useEffect(() => {
    if (query.trim()) {
      debouncedSearch(query);
    } else {
      setResults([]);
    }
  }, [query, debouncedSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event) => {
    if (!isOpen || results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedResult(prev => (prev + 1) % getTotalSelectableResults());
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedResult(prev => (prev - 1 + getTotalSelectableResults()) % getTotalSelectableResults());
        break;
      case 'Enter':
        event.preventDefault();
        handleResultSelect(getSelectedResult());
        break;
      case 'Escape':
        if (searchInputRef.current === document.activeElement && query) {
          setQuery('');
        } else {
          onClose();
        }
        break;
    }
  }, [isOpen, results, selectedResult, query, onClose]);

  // Get total number of selectable results
  const getTotalSelectableResults = useCallback(() => {
    return results.reduce((total, result) => total + result.matches.length, 0);
  }, [results]);

  // Get currently selected result
  const getSelectedResult = useCallback(() => {
    let currentIndex = 0;
    for (const result of results) {
      for (const match of result.matches) {
        if (currentIndex === selectedResult) {
          return { file: result.file, match, fileName: result.fileName };
        }
        currentIndex++;
      }
    }
    return null;
  }, [results, selectedResult]);

  // Handle result selection
  const handleResultSelect = useCallback((resultData) => {
    if (!resultData) return;
    
    onFileOpen({
      path: resultData.file,
      name: resultData.fileName,
      lineNumber: resultData.match.line,
      column: resultData.match.column
    });
  }, [onFileOpen]);

  // Toggle file collapse state
  const toggleFileCollapse = useCallback((filePath) => {
    setCollapsedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  }, []);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Clear results when panel closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedResult(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed left-0 top-0 bottom-0 w-96 bg-app-panel border-r border-app-border z-40 search-panel ${className}`}>
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-app-border bg-app-bg/50">
        <h2 className="font-semibold text-sm">Search Files</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-bg transition-colors ${
              showFilters ? 'bg-app-accent/10 text-app-accent' : ''
            }`}
            title="Search filters"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-bg transition-colors"
            title="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-app-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-app-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in files..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-app-accent border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        
        {/* Search Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-app-bg border border-app-border rounded-md">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={searchOptions.caseSensitive}
                  onChange={(e) => setSearchOptions(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                  className="rounded border-app-border text-app-accent focus:ring-app-accent focus:ring-1"
                />
                Case sensitive
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={searchOptions.wholeWord}
                  onChange={(e) => setSearchOptions(prev => ({ ...prev, wholeWord: e.target.checked }))}
                  className="rounded border-app-border text-app-accent focus:ring-app-accent focus:ring-1"
                />
                Whole word
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={searchOptions.regex}
                  onChange={(e) => setSearchOptions(prev => ({ ...prev, regex: e.target.checked }))}
                  className="rounded border-app-border text-app-accent focus:ring-app-accent focus:ring-1"
                />
                Regular expression
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Search History */}
      {!query && searchHistory.length > 0 && (
        <div className="p-4 border-b border-app-border">
          <h3 className="text-xs font-medium text-app-muted mb-2 flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Recent Searches
          </h3>
          <div className="space-y-1">
            {searchHistory.slice(0, 5).map((historyItem, index) => (
              <button
                key={index}
                onClick={() => setQuery(historyItem)}
                className="w-full text-left text-sm text-app-muted hover:text-app-text hover:bg-app-bg/50 px-2 py-1 rounded transition-colors"
              >
                {historyItem}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div ref={resultsRef} className="flex-1 overflow-y-auto">
        {query && !isLoading && results.length === 0 && (
          <div className="p-8 text-center text-app-muted">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No results found for "{query}"</p>
            <p className="text-xs mt-1">Try adjusting your search terms or filters</p>
          </div>
        )}

        {results.map((result, resultIndex) => {
          const isCollapsed = collapsedFiles.has(result.file);
          
          return (
            <div key={result.file} className="border-b border-app-border last:border-0">
              {/* File Header */}
              <div className="px-4 py-2 bg-app-bg/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => toggleFileCollapse(result.file)}
                    className="p-0.5 rounded text-app-muted hover:text-app-text hover:bg-app-bg/50 transition-colors"
                    title={isCollapsed ? "Expand matches" : "Collapse matches"}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  <FileText className="h-4 w-4 text-app-muted flex-shrink-0" />
                  <span className="text-sm font-medium truncate" title={result.file}>
                    {result.fileName}
                  </span>
                  <span className="text-xs text-app-muted bg-app-accent/10 px-1.5 py-0.5 rounded">
                    {result.matchCount}
                  </span>
                </div>
                <button
                  onClick={() => handleResultSelect({ file: result.file, match: result.matches[0], fileName: result.fileName })}
                  className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-bg transition-colors"
                  title="Open file"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              {/* Matches - only show if not collapsed */}
              {!isCollapsed && (
                <div className="pb-2">
                  {result.matches.map((match, matchIndex) => {
                    const globalIndex = results.slice(0, resultIndex).reduce((sum, r) => sum + r.matches.length, 0) + matchIndex;
                    const isSelected = globalIndex === selectedResult;
                    
                    return (
                      <button
                        key={matchIndex}
                        onClick={() => handleResultSelect({ file: result.file, match, fileName: result.fileName })}
                        className={`w-full text-left px-4 py-2 hover:bg-app-accent/5 transition-colors ${
                          isSelected ? 'bg-app-accent/10 border-r-2 border-app-accent' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-app-muted font-mono flex-shrink-0 mt-0.5">
                            L{match.line}
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Main match line - truncated to reasonable length */}
                            <div 
                              className="text-sm text-app-text search-context-line font-medium"
                              dangerouslySetInnerHTML={{
                                __html: highlightText(
                                  match.text.length > 80 ? match.text.slice(0, 80) + '...' : match.text, 
                                  query, 
                                  searchOptions
                                )
                              }}
                            />
                            {/* Only show 1-2 context lines around the match */}
                            {match.context && match.context.length > 1 && (
                              <div className="mt-1 text-xs text-app-muted">
                                {match.context
                                  .filter(contextLine => !contextLine.isMatch) // Only show non-match lines as context
                                  .slice(0, 1) // Show only 1 context line for brevity
                                  .map((contextLine, i) => (
                                    <div key={i} className="search-context-line opacity-60 truncate">
                                      <span className="text-xs font-mono mr-2">L{contextLine.lineNumber}:</span>
                                      {contextLine.text.trim().slice(0, 50)}
                                      {contextLine.text.trim().length > 50 && '...'}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results Summary */}
      {query && !isLoading && results.length > 0 && (
        <div className="p-3 border-t border-app-border bg-app-bg/30 text-xs text-app-muted">
          {results.reduce((total, result) => total + result.matchCount, 0)} matches 
          in {results.length} files
        </div>
      )}
    </div>
  );
};

export default SearchPanel;