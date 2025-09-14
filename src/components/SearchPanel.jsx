import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Search, X, ChevronDown, ChevronRight, Settings, Clock } from 'lucide-react'
import { sanitizeSearchHighlight, isValidSearchQuery } from '../core/security/index.js'

// Utility function to highlight search matches in text (XSS-safe)
const highlightText = (text, query, options) => {
  if (!query.trim() || !isValidSearchQuery(query)) {
    return text
  }
  
  try {
    let flags = 'gi'
    if (options.caseSensitive) flags = 'g'
    
    let pattern = query
    if (!options.regex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`
    }
    
    const regex = new RegExp(pattern, flags)
    const highlighted = text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$&</mark>')
    
    // Sanitize the result to prevent XSS
    return sanitizeSearchHighlight(highlighted)
  } catch (error) {
    return text
  }
}

export default function SearchPanel({ isOpen, onClose, onFileOpen, workspacePath }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState(new Set())
  const [recentSearches, setRecentSearches] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [searchOptions, setSearchOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    fileTypes: ['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'],
    maxResults: 100,
    contextLines: 1
  })

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lokus-recent-searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading recent searches:', error)
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((searchQuery) => {
    if (!searchQuery.trim()) return
    
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('lokus-recent-searches', JSON.stringify(updated))
  }, [recentSearches])

  // Perform search
  const performSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim() || !workspacePath) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await invoke('search_in_files', {
        query: searchQuery,
        workspacePath: workspacePath,
        options: searchOptions
      })

      setResults(searchResults || [])
      saveRecentSearch(searchQuery)
      
      // Auto-expand files if there are few results
      if (searchResults && searchResults.length <= 5) {
        setExpandedFiles(new Set(searchResults.map(result => result.file)))
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query, workspacePath, searchOptions, saveRecentSearch])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timeoutId = setTimeout(() => performSearch(), 500)
    return () => clearTimeout(timeoutId)
  }, [performSearch])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      performSearch()
    }
  }, [onClose, performSearch])

  // Toggle file expansion
  const toggleFileExpansion = useCallback((filePath) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filePath)) {
        newSet.delete(filePath)
      } else {
        newSet.add(filePath)
      }
      return newSet
    })
  }, [])

  // Handle file click to open
  const handleFileOpen = useCallback((filePath, lineNumber, column) => {
    onFileOpen({ 
      path: filePath, 
      lineNumber: lineNumber,
      column: column || 0
    })
    onClose()
  }, [onFileOpen, onClose])

  // Handle recent search click
  const handleRecentSearchClick = useCallback((searchQuery) => {
    setQuery(searchQuery)
    performSearch(searchQuery)
  }, [performSearch])

  // Update search option
  const updateSearchOption = useCallback((key, value) => {
    setSearchOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-black bg-opacity-50 flex">
      <div className="bg-app-bg w-full max-w-4xl mx-auto mt-8 mb-8 rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <h2 className="text-lg font-semibold">Search Files</h2>
          <button
            onClick={onClose}
            title="Close search"
            className="p-1 rounded hover:bg-app-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input and options */}
        <div className="p-4 border-b border-app-border">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
              <input
                type="text"
                placeholder="Search in files..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2 bg-app-bg border border-app-border rounded-lg focus:outline-none focus:ring-1 focus:ring-app-primary"
                autoFocus
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              title="Search filters"
              className={`p-2 rounded hover:bg-app-hover ${showFilters ? 'bg-app-hover' : ''}`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Search filters */}
          {showFilters && (
            <div className="grid grid-cols-3 gap-4 p-3 bg-app-hover rounded">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={searchOptions.caseSensitive}
                  onChange={(e) => updateSearchOption('caseSensitive', e.target.checked)}
                />
                <span className="text-sm">Case sensitive</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={searchOptions.wholeWord}
                  onChange={(e) => updateSearchOption('wholeWord', e.target.checked)}
                />
                <span className="text-sm">Whole word</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={searchOptions.regex}
                  onChange={(e) => updateSearchOption('regex', e.target.checked)}
                />
                <span className="text-sm">Regular expression</span>
              </label>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Recent searches sidebar */}
          {!query && recentSearches.length > 0 && (
            <div className="w-64 border-r border-app-border p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Searches
              </h3>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentSearchClick(search)}
                    className="w-full text-left px-2 py-1 text-sm rounded hover:bg-app-hover truncate"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results area */}
          <div className="flex-1 overflow-y-auto">
            {isSearching && (
              <div className="p-4 text-center text-app-muted">
                Searching...
              </div>
            )}

            {!isSearching && query && results.length === 0 && (
              <div className="p-4 text-center text-app-muted">
                No results found
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="p-4">
                <div className="mb-4 text-sm text-app-muted">
                  {results.length} files found
                </div>
                
                <div className="space-y-2">
                  {results.map((result) => (
                    <div key={result.file} className="border border-app-border rounded">
                      {/* File header */}
                      <div 
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-app-hover"
                        onClick={() => toggleFileExpansion(result.file)}
                      >
                        {expandedFiles.has(result.file) ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                        <span className="font-medium">{result.fileName}</span>
                        <span className="text-xs text-app-muted">
                          {result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}
                        </span>
                        <span className="text-xs text-app-muted ml-auto">
                          {result.file}
                        </span>
                      </div>

                      {/* File matches */}
                      {expandedFiles.has(result.file) && (
                        <div className="border-t border-app-border">
                          {result.matches.map((match, matchIndex) => (
                            <div 
                              key={matchIndex}
                              className="p-2 hover:bg-app-hover cursor-pointer border-l-2 border-transparent hover:border-app-primary"
                              onClick={() => handleFileOpen(result.file, match.line, match.column)}
                            >
                              <div className="text-xs text-app-muted mb-1">
                                Line {match.line}:{match.column}
                              </div>
                              <div className="text-sm font-mono whitespace-pre-wrap">
                                {match.context.map((contextLine, contextIndex) => (
                                  <div 
                                    key={contextIndex}
                                    className={contextLine.isMatch ? 'bg-yellow-100 dark:bg-yellow-900 px-1 rounded' : ''}
                                  >
                                    <span className="text-app-muted mr-2 select-none">
                                      {contextLine.lineNumber}:
                                    </span>
                                    <span 
                                      dangerouslySetInnerHTML={{
                                        __html: highlightText(
                                          contextLine.text.length > 80 ? 
                                            contextLine.text.slice(0, 80) + '...' : 
                                            contextLine.text, 
                                          query, 
                                          searchOptions
                                        )
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!query && recentSearches.length === 0 && (
              <div className="p-8 text-center text-app-muted">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start typing to search across your files</p>
                <p className="text-sm mt-1">Press Ctrl+Shift+F to open search</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}