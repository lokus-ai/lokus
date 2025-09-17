import React, { useState, useCallback, useRef, useEffect } from 'react';
import './GraphControls.css';

/**
 * GraphControls - Modern control panel for graph visualization
 * 
 * Features:
 * - Glass morphism design matching Obsidian aesthetics
 * - Real-time search with autocomplete
 * - Layout controls with smooth animations
 * - Performance monitoring and optimization
 * - Color scheme and styling controls
 * - Export and view options
 */
export function GraphControls({ 
  onLayoutStart, 
  onLayoutStop, 
  onReset, 
  onSearch, 
  onColorSchemeChange,
  onZoomIn,
  onZoomOut,
  onCenter,
  onExport,
  performanceMode = false, 
  nodeCount = 0,
  edgeCount = 0,
  isLayoutRunning = false,
  searchResults = [],
  className = ''
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeColorScheme, setActiveColorScheme] = useState('default');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const searchInputRef = useRef(null);

  // Color schemes matching Obsidian's aesthetic
  const colorSchemes = [
    { id: 'default', name: 'Default', primary: '#7c3aed', secondary: '#a855f7' },
    { id: 'ocean', name: 'Ocean', primary: '#0ea5e9', secondary: '#38bdf8' },
    { id: 'forest', name: 'Forest', primary: '#10b981', secondary: '#34d399' },
    { id: 'sunset', name: 'Sunset', primary: '#f59e0b', secondary: '#fbbf24' },
    { id: 'crimson', name: 'Crimson', primary: '#ef4444', secondary: '#f87171' },
    { id: 'mono', name: 'Monochrome', primary: '#6b7280', secondary: '#9ca3af' }
  ];

  // Handle search input with debouncing
  const handleSearchChange = useCallback((event) => {
    const query = event.target.value;
    setSearchQuery(query);
    
    // Debounced search
    const timeoutId = setTimeout(() => {
      if (onSearch) {
        onSearch(query);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [onSearch]);

  // Handle color scheme change
  const handleColorSchemeChange = useCallback((schemeId) => {
    setActiveColorScheme(schemeId);
    if (onColorSchemeChange) {
      onColorSchemeChange(schemeId);
    }
  }, [onColorSchemeChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'f':
            event.preventDefault();
            searchInputRef.current?.focus();
            break;
          case 'r':
            event.preventDefault();
            onReset && onReset();
            break;
          case ' ':
            event.preventDefault();
            if (isLayoutRunning) {
              onLayoutStop && onLayoutStop();
            } else {
              onLayoutStart && onLayoutStart();
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLayoutRunning, onLayoutStart, onLayoutStop, onReset]);

  return (
    <div className={`graph-controls-modern ${className} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header with collapse toggle */}
      <div className="controls-header">
        <div className="controls-title">
          <div className="title-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="m9 9 3-3 3 3" />
              <path d="m9 15 3 3 3-3" />
            </svg>
          </div>
          <span>Graph Controls</span>
        </div>
        <button 
          className="collapse-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse controls' : 'Expand controls'}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            className={isExpanded ? 'rotated' : ''}
          >
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="controls-content">
          {/* Search Section */}
          <div className="control-section">
            <div className="section-header">
              <h4>Search & Filter</h4>
              <kbd className="keyboard-shortcut">⌘F</kbd>
            </div>
            <div className="search-container">
              <div className="search-input-wrapper">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search nodes..."
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    className="clear-search"
                    onClick={() => {
                      setSearchQuery('');
                      onSearch && onSearch('');
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.slice(0, 5).map((result, index) => (
                    <div key={index} className="search-result-item">
                      <span className="result-icon" data-type={result.type}>
                        {result.type === 'file' ? '📄' : result.type === 'folder' ? '📁' : '🏷️'}
                      </span>
                      <span className="result-label">{result.label}</span>
                    </div>
                  ))}
                  {searchResults.length > 5 && (
                    <div className="search-more">+{searchResults.length - 5} more</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Layout Controls */}
          <div className="control-section">
            <div className="section-header">
              <h4>Layout Controls</h4>
              <kbd className="keyboard-shortcut">⌘Space</kbd>
            </div>
            <div className="control-grid">
              <button 
                className={`control-button primary ${isLayoutRunning ? 'running' : ''}`}
                onClick={isLayoutRunning ? onLayoutStop : onLayoutStart}
              >
                <div className="button-icon">
                  {isLayoutRunning ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </div>
                <span>{isLayoutRunning ? 'Pause' : 'Play'}</span>
              </button>
              
              <button className="control-button secondary" onClick={onReset}>
                <div className="button-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23,4 23,10 17,10" />
                    <polyline points="1,20 1,14 7,14" />
                    <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10" />
                    <path d="M3.51,15A9,9,0,0,0,18.36,18.36L23,14" />
                  </svg>
                </div>
                <span>Reset</span>
              </button>
              
              <button className="control-button secondary" onClick={onCenter}>
                <div className="button-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                </div>
                <span>Center</span>
              </button>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="control-section">
            <div className="section-header">
              <h4>View Controls</h4>
            </div>
            <div className="zoom-controls">
              <button className="zoom-button" onClick={onZoomOut}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <div className="zoom-level">100%</div>
              <button className="zoom-button" onClick={onZoomIn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
            </div>
          </div>

          {/* Color Schemes */}
          <div className="control-section">
            <div className="section-header">
              <h4>Color Scheme</h4>
            </div>
            <div className="color-schemes">
              {colorSchemes.map((scheme) => (
                <button
                  key={scheme.id}
                  className={`color-scheme-button ${activeColorScheme === scheme.id ? 'active' : ''}`}
                  onClick={() => handleColorSchemeChange(scheme.id)}
                  title={scheme.name}
                >
                  <div 
                    className="color-preview"
                    style={{
                      background: `linear-gradient(45deg, ${scheme.primary}, ${scheme.secondary})`
                    }}
                  />
                  <span className="scheme-name">{scheme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Performance & Stats */}
          <div className="control-section">
            <div className="section-header">
              <h4>Performance</h4>
              <div className={`performance-indicator ${performanceMode ? 'performance-mode' : ''}`}>
                <div className="indicator-dot" />
                {performanceMode ? 'Performance' : 'Quality'}
              </div>
            </div>
            <div className="stats-compact">
              <div className="stat-pill">
                <span className="stat-label">Nodes</span>
                <span className="stat-value">{nodeCount.toLocaleString()}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Edges</span>
                <span className="stat-value">{edgeCount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Advanced Controls Toggle */}
          <div className="control-section">
            <button 
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Advanced Options</span>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={showAdvanced ? 'rotated' : ''}
              >
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </button>
          </div>

          {/* Advanced Controls */}
          {showAdvanced && (
            <div className="control-section advanced-controls">
              <div className="section-header">
                <h4>Export & Share</h4>
              </div>
              <div className="control-grid">
                <button className="control-button tertiary" onClick={onExport}>
                  <div className="button-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <span>Export PNG</span>
                </button>
                
                <button className="control-button tertiary">
                  <div className="button-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </div>
                  <span>Share Link</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GraphControls;