import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Search, X, ChevronDown, ChevronRight, Settings, Clock, Zap, Cloud, Filter, SortAsc } from 'lucide-react'
import { sanitizeSearchHighlight, isValidSearchQuery } from '../core/security/index.js'
import { providerManager } from '../plugins/data/ProviderRegistry.js'

// Enhanced search result highlighting with provider-specific features
const highlightText = (text, query, options, providerFeatures = {}) => {
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
    let highlighted = text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$&</mark>')
    
    // Add provider-specific highlighting (semantic matches, related terms, etc.)
    if (providerFeatures.semanticMatches) {
      providerFeatures.semanticMatches.forEach(match => {
        const semanticRegex = new RegExp(match.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        highlighted = highlighted.replace(semanticRegex, 
          `<mark class="bg-blue-200 dark:bg-blue-800" title="Semantic match (${match.score})">${match.term}</mark>`
        )
      })
    }
    
    return sanitizeSearchHighlight(highlighted)
  } catch (error) {
    return text
  }
}

// Enhanced search result component
function SearchResult({ result, query, onFileOpen, searchOptions, providerInfo }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = () => {
    if (result.external_url) {
      window.open(result.external_url, '_blank')
    } else {
      onFileOpen({
        path: result.file,
        lineNumber: result.line,
        column: result.column || 0
      })
    }
  }

  return (
    <div className="border border-app-border rounded mb-2">
      {/* Result header */}
      <div 
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-app-hover"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 
          <ChevronDown className="w-4 h-4" /> : 
          <ChevronRight className="w-4 h-4" />
        }
        
        {/* Provider indicator */}
        {result.provider_id && (
          <Cloud className="w-4 h-4 text-blue-500" title={`From ${result.provider_id}`} />
        )}
        
        {/* Search type indicator */}
        {result.searchType === 'semantic' && (
          <Zap className="w-4 h-4 text-purple-500" title="Semantic search result" />
        )}
        
        <span className="font-medium flex-1">{result.fileName}</span>
        
        {/* Score and metadata */}
        <div className="flex items-center gap-2 text-xs text-app-muted">
          {result.score && (
            <span className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
              {Math.round(result.score * 100)}%
            </span>
          )}
          <span>
            {result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}
          </span>
          {result.external_url && (
            <span className="text-blue-500">External</span>
          )}
        </div>
        
        <span className="text-xs text-app-muted">
          {result.file}
        </span>
      </div>

      {/* Expanded matches */}
      {isExpanded && (
        <div className="border-t border-app-border">
          {result.matches.map((match, matchIndex) => (
            <div 
              key={matchIndex}
              className="p-2 hover:bg-app-hover cursor-pointer border-l-2 border-transparent hover:border-app-primary"
              onClick={handleClick}
            >
              <div className="text-xs text-app-muted mb-1">
                Line {match.line}:{match.column}
                {match.confidence && (
                  <span className="ml-2 text-purple-600">
                    Confidence: {Math.round(match.confidence * 100)}%
                  </span>
                )}
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
                          searchOptions,
                          match.providerFeatures
                        )
                      }}
                    />
                  </div>
                ))}
              </div>
              
              {/* Provider-specific metadata */}
              {match.providerMetadata && (
                <div className="mt-2 text-xs text-app-muted">
                  {match.providerMetadata.tags && (
                    <div className="flex gap-1">
                      {match.providerMetadata.tags.map(tag => (
                        <span key={tag} className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {match.providerMetadata.lastModified && (
                    <div className="mt-1">
                      Modified: {new Date(match.providerMetadata.lastModified).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Enhanced search panel component
export default function EnhancedSearchPanel({ 
  isOpen, 
  onClose, 
  onFileOpen, 
  workspacePath,
  enableProviderSearch = true,
  defaultProvider = null 
}) {
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
    semantic: false,
    fileTypes: ['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'],
    maxResults: 100,
    contextLines: 1,
    searchType: 'keyword', // keyword, semantic, fuzzy
    sortBy: 'relevance', // relevance, date, name
    includeProviders: true
  })

  // Provider state
  const [currentProvider, setCurrentProvider] = useState(null)
  const [availableProviders, setAvailableProviders] = useState([])
  const [providerStatus, setProviderStatus] = useState('disconnected')
  const [searchCapabilities, setSearchCapabilities] = useState({})

  // Initialize search providers
  useEffect(() => {
    const initializeProviders = async () => {
      if (!enableProviderSearch) return

      try {
        await providerManager.initialize()
        
        const providers = providerManager.registry.getProvidersByType('search')
        setAvailableProviders(providers)

        if (defaultProvider) {
          const provider = providerManager.registry.getProvider(defaultProvider)
          if (provider) {
            await setActiveProvider(provider)
          }
        } else {
          const activeProvider = providerManager.registry.getActiveProvider('search')
          if (activeProvider) {
            await setActiveProvider(activeProvider)
          }
        }

      } catch (error) {
        console.error('Failed to initialize search providers:', error)
      }
    }

    initializeProviders()
  }, [enableProviderSearch, defaultProvider])

  // Set active search provider
  const setActiveProvider = async (provider) => {
    try {
      setCurrentProvider(provider)
      setProviderStatus('connecting')

      if (provider.isConnected) {
        setProviderStatus('connected')
      } else {
        await provider.connect()
        setProviderStatus('connected')
      }

      // Get provider capabilities
      const capabilities = provider.getCapabilities()
      setSearchCapabilities({
        semantic: capabilities.includes('semantic-search'),
        fuzzy: capabilities.includes('fuzzy-search'),
        external: capabilities.includes('external-indexing'),
        suggestions: capabilities.includes('suggestions')
      })

      // Update search options based on capabilities
      setSearchOptions(prev => ({
        ...prev,
        semantic: capabilities.includes('semantic-search')
      }))

    } catch (error) {
      console.error('Failed to set active search provider:', error)
      setProviderStatus('error')
    }
  }

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lokus-recent-searches-enhanced')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading recent searches:', error)
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((searchQuery, searchType, resultCount) => {
    if (!searchQuery.trim()) return
    
    const searchEntry = {
      query: searchQuery,
      type: searchType,
      resultCount,
      timestamp: Date.now(),
      provider: currentProvider?.id || 'local'
    }
    
    const updated = [
      searchEntry, 
      ...recentSearches.filter(s => s.query !== searchQuery)
    ].slice(0, 10)
    
    setRecentSearches(updated)
    localStorage.setItem('lokus-recent-searches-enhanced', JSON.stringify(updated))
  }, [recentSearches, currentProvider])

  // Enhanced search function with provider support
  const performSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim() || (!workspacePath && !currentProvider)) {
      setResults([])
      return
    }

    setIsSearching(true)
    let allResults = []

    try {
      // Search with provider if available
      if (currentProvider && currentProvider.isConnected && searchOptions.includeProviders) {
        try {
          const providerResults = await providerManager.executeSearchOperation(
            async (searchProvider) => {
              return await searchProvider.search(searchQuery, {
                type: searchOptions.searchType,
                caseSensitive: searchOptions.caseSensitive,
                wholeWord: searchOptions.wholeWord,
                regex: searchOptions.regex,
                maxResults: Math.floor(searchOptions.maxResults / 2), // Split between provider and local
                context: searchOptions.contextLines
              })
            }
          )

          if (providerResults && providerResults.length > 0) {
            // Transform provider results to match local format
            const transformedResults = providerResults.map(result => ({
              file: result.file || result.path || result.url,
              fileName: result.fileName || result.title || result.name,
              matches: result.matches || [{
                line: result.line || 1,
                column: result.column || 0,
                text: result.text || result.content,
                context: result.context || [],
                confidence: result.confidence,
                providerFeatures: result.features,
                providerMetadata: result.metadata
              }],
              matchCount: result.matchCount || 1,
              score: result.score,
              provider_id: currentProvider.id,
              searchType: searchOptions.searchType,
              external_url: result.external_url
            }))

            allResults = allResults.concat(transformedResults)
          }

        } catch (providerError) {
        }
      }

      // Local search
      if (workspacePath) {
        try {
          const localResults = await invoke('search_in_files', {
            query: searchQuery,
            workspacePath: workspacePath,
            options: {
              ...searchOptions,
              maxResults: searchOptions.maxResults - allResults.length // Remaining results
            }
          })

          if (localResults && localResults.length > 0) {
            allResults = allResults.concat(localResults.map(result => ({
              ...result,
              provider_id: null,
              searchType: 'keyword'
            })))
          }

        } catch (localError) {
          console.error('Local search failed:', localError)
        }
      }

      // Sort results by relevance/score
      if (searchOptions.sortBy === 'relevance') {
        allResults.sort((a, b) => (b.score || 0) - (a.score || 0))
      } else if (searchOptions.sortBy === 'date') {
        allResults.sort((a, b) => {
          const dateA = new Date(a.matches[0]?.providerMetadata?.lastModified || 0)
          const dateB = new Date(b.matches[0]?.providerMetadata?.lastModified || 0)
          return dateB - dateA
        })
      } else if (searchOptions.sortBy === 'name') {
        allResults.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || ''))
      }

      setResults(allResults)
      saveRecentSearch(searchQuery, searchOptions.searchType, allResults.length)
      
      // Auto-expand files if there are few results
      if (allResults && allResults.length <= 5) {
        setExpandedFiles(new Set(allResults.map(result => result.file)))
      }

    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query, workspacePath, searchOptions, currentProvider, saveRecentSearch])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timeoutId = setTimeout(() => performSearch(), 500)
    return () => clearTimeout(timeoutId)
  }, [performSearch])

  // Get search suggestions from provider
  const getSuggestions = useCallback(async (partialQuery) => {
    if (!currentProvider || !partialQuery.trim() || !searchCapabilities.suggestions) {
      return []
    }

    try {
      const suggestions = await providerManager.executeSearchOperation(
        async (searchProvider) => {
          return await searchProvider.getSuggestions(partialQuery, 5)
        }
      )
      return suggestions || []
    } catch (error) {
      return []
    }
  }, [currentProvider, searchCapabilities])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      performSearch()
    }
  }, [onClose, performSearch])

  // Switch search provider
  const switchProvider = useCallback(async (providerId) => {
    try {
      const provider = providerManager.registry.getProvider(providerId)
      if (provider) {
        await setActiveProvider(provider)
      } else {
        setCurrentProvider(null)
        setProviderStatus('disconnected')
        setSearchCapabilities({})
      }
    } catch (error) {
      console.error('Failed to switch search provider:', error)
    }
  }, [])

  // Handle recent search click
  const handleRecentSearchClick = useCallback((searchEntry) => {
    setQuery(searchEntry.query)
    setSearchOptions(prev => ({
      ...prev,
      searchType: searchEntry.type
    }))
    performSearch(searchEntry.query)
  }, [performSearch])

  // Update search option
  const updateSearchOption = useCallback((key, value) => {
    setSearchOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-black bg-opacity-50 flex">
      <div className="bg-app-bg w-full max-w-5xl mx-auto mt-8 mb-8 rounded-lg shadow-xl flex flex-col">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Enhanced Search</h2>
            {currentProvider && (
              <div className="flex items-center gap-1 text-sm text-app-muted">
                <Cloud className="w-4 h-4 text-blue-500" />
                <span>{currentProvider.config.name || currentProvider.id}</span>
                <div className={`w-2 h-2 rounded-full ${
                  providerStatus === 'connected' ? 'bg-green-500' : 
                  providerStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close search"
            className="p-1 rounded hover:bg-app-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input and controls */}
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
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Enhanced filters */}
          {showFilters && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-app-hover rounded">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Search Options</h4>
                <div className="grid grid-cols-2 gap-2">
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

                  {searchCapabilities.semantic && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={searchOptions.searchType === 'semantic'}
                        onChange={(e) => updateSearchOption('searchType', e.target.checked ? 'semantic' : 'keyword')}
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Zap className="w-3 h-3 text-purple-500" />
                        Semantic
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Provider Settings</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-app-muted mb-1">Search Provider</label>
                    <select
                      value={currentProvider?.id || ''}
                      onChange={(e) => switchProvider(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="">Local only</option>
                      {availableProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.config.name || provider.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-app-muted mb-1">Sort by</label>
                    <select
                      value={searchOptions.sortBy}
                      onChange={(e) => updateSearchOption('sortBy', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date">Date modified</option>
                      <option value="name">File name</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={searchOptions.includeProviders}
                      onChange={(e) => updateSearchOption('includeProviders', e.target.checked)}
                    />
                    <span className="text-sm">Include provider results</span>
                  </label>
                </div>
              </div>
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
                    className="w-full text-left p-2 text-sm rounded hover:bg-app-hover"
                  >
                    <div className="font-medium truncate">{search.query}</div>
                    <div className="text-xs text-app-muted flex items-center gap-2">
                      <span>{search.resultCount} results</span>
                      <span>•</span>
                      <span>{search.type}</span>
                      {search.provider !== 'local' && (
                        <>
                          <span>•</span>
                          <Cloud className="w-3 h-3" />
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced results area */}
          <div className="flex-1 overflow-y-auto">
            {isSearching && (
              <div className="p-4 text-center text-app-muted">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-app-primary"></div>
                  <span>Searching...</span>
                  {currentProvider && (
                    <span className="text-xs">({currentProvider.config.name})</span>
                  )}
                </div>
              </div>
            )}

            {!isSearching && query && results.length === 0 && (
              <div className="p-4 text-center text-app-muted">
                <div>No results found</div>
                {currentProvider && (
                  <div className="text-xs mt-1">
                    Searched local files and {currentProvider.config.name}
                  </div>
                )}
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="p-4">
                <div className="mb-4 text-sm text-app-muted flex items-center justify-between">
                  <span>
                    {results.length} files found
                    {currentProvider && (
                      <span className="ml-2 text-blue-600">
                        (including {results.filter(r => r.provider_id).length} from provider)
                      </span>
                    )}
                  </span>
                  <SortAsc className="w-4 h-4" />
                </div>
                
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <SearchResult
                      key={`${result.file}-${index}`}
                      result={result}
                      query={query}
                      onFileOpen={onClose}
                      searchOptions={searchOptions}
                      providerInfo={currentProvider ? {
                        id: currentProvider.id,
                        name: currentProvider.config.name || currentProvider.id
                      } : null}
                    />
                  ))}
                </div>
              </div>
            )}

            {!query && recentSearches.length === 0 && (
              <div className="p-8 text-center text-app-muted">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start typing to search across your files</p>
                {currentProvider && (
                  <p className="text-sm mt-1">
                    Enhanced search with {currentProvider.config.name || currentProvider.id}
                  </p>
                )}
                <p className="text-sm mt-1">Press Ctrl+Shift+F to open search</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}