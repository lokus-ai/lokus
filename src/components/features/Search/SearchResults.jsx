import React, { useCallback, useMemo } from 'react';
import { File, Folder, Calendar, Hash, ChevronRight } from 'lucide-react';
import { highlightMatches } from '../../../core/search/query-parser';

/**
 * SearchResults - Display search results with highlighting and snippets
 */
const SearchResults = ({ results, query, onResultClick, loading, error }) => {
  // Group results by folder
  const groupedResults = useMemo(() => {
    const groups = new Map();

    for (const result of results) {
      const folder = result.folder || '/';
      if (!groups.has(folder)) {
        groups.set(folder, []);
      }
      groups.get(folder).push(result);
    }

    return Array.from(groups.entries()).map(([folder, items]) => ({
      folder,
      items,
      count: items.length
    }));
  }, [results]);

  const handleResultClick = useCallback((result) => {
    if (onResultClick) {
      onResultClick(result);
    }
  }, [onResultClick]);

  const handleKeyDown = useCallback((e, result) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleResultClick(result);
    }
  }, [handleResultClick]);

  // Loading state
  if (loading) {
    return (
      <div className="search-results-loading">
        <div className="spinner"></div>
        <p>Searching...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="search-results-error">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!results || results.length === 0) {
    return (
      <div className="search-results-empty">
        <File size={48} className="empty-icon" />
        <h3>No results found</h3>
        <p>Try different keywords or remove filters</p>
      </div>
    );
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <span className="results-count">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="search-results-list">
        {groupedResults.map(({ folder, items, count }) => (
          <div key={folder} className="search-results-group">
            <div className="group-header">
              <Folder size={16} />
              <span className="group-folder">{folder}</span>
              <span className="group-count">({count})</span>
            </div>

            <div className="group-items">
              {items.map((result) => (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  query={query}
                  onClick={handleResultClick}
                  onKeyDown={handleKeyDown}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Individual search result item
 */
const SearchResultItem = ({ result, query, onClick, onKeyDown }) => {
  const { title, path, snippet, highlights, tags, modified, score } = result;

  const formattedDate = useMemo(() => {
    if (!modified) return '';
    const date = new Date(modified);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [modified]);

  const tagList = useMemo(() => {
    if (!tags) return [];
    return typeof tags === 'string' ? tags.split(' ').filter(Boolean) : tags;
  }, [tags]);

  const handleClick = useCallback(() => {
    onClick(result);
  }, [result, onClick]);

  const handleKeyPress = useCallback((e) => {
    onKeyDown(e, result);
  }, [result, onKeyDown]);

  return (
    <div
      className="search-result-item"
      onClick={handleClick}
      onKeyDown={handleKeyPress}
      tabIndex={0}
      role="button"
      aria-label={`Open ${title}`}
    >
      <div className="result-header">
        <div className="result-title-row">
          <File size={16} className="result-icon" />
          <h3
            className="result-title"
            dangerouslySetInnerHTML={{
              __html: highlightMatches(title, query)
            }}
          />
          <ChevronRight size={16} className="result-chevron" />
        </div>
        {score && (
          <span className="result-score" title="Relevance score">
            {Math.round(score * 100) / 100}
          </span>
        )}
      </div>

      <div className="result-path">
        <span className="path-text">{path}</span>
      </div>

      {snippet && (
        <div
          className="result-snippet"
          dangerouslySetInnerHTML={{
            __html: highlightMatches(snippet, query)
          }}
        />
      )}

      <div className="result-metadata">
        {formattedDate && (
          <span className="metadata-item">
            <Calendar size={14} />
            <span>{formattedDate}</span>
          </span>
        )}

        {tagList.length > 0 && (
          <div className="metadata-tags">
            <Hash size={14} />
            {tagList.slice(0, 3).map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
            {tagList.length > 3 && (
              <span className="tag-more">+{tagList.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {highlights && highlights.length > 0 && (
        <div className="result-highlights">
          {highlights.slice(0, 3).map((highlight, index) => (
            <span key={index} className="highlight-badge">
              {highlight.field}
              {highlight.count && <span className="highlight-count">×{highlight.count}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
