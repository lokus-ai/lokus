import React, { useState } from 'react';
import {
  PlayIcon,
  StopIcon,
  RefreshIcon,
  CenterIcon,
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  SearchIcon,
  ChartIcon,
  MapIcon,
  LayersIcon
} from '../components/icons/GraphIcons.jsx';

/**
 * Unified Graph Panel - Combines controls, stats, and minimap
 */
const GraphPanel = ({
  // Controls props
  onLayoutStart,
  onLayoutStop,
  onReset,
  onSearch,
  onColorSchemeChange,
  onZoomIn,
  onZoomOut,
  onCenter,
  onExport,
  searchResults = [],
  
  // Stats props
  graphEngine,
  nodeCount = 0,
  edgeCount = 0,
  isLayoutRunning = false,
  performanceMode = false,
  onPerformanceModeChange,
  
  // Minimap props
  graphData,
  viewportBounds,
  onViewportChange,
  
  // General props
  isVisible = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('controls');

  if (!isVisible) return null;

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <div className="graph-controls">
      {/* Tab Header */}
      <div className="flex border-b border-app-border mb-4">
        <button
          onClick={() => setActiveTab('controls')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'controls'
              ? 'text-app-accent border-b-2 border-app-accent'
              : 'text-app-muted hover:text-app-text'
          }`}
        >
          Controls
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-app-accent border-b-2 border-app-accent'
              : 'text-app-muted hover:text-app-text'
          }`}
        >
          Stats
        </button>
        <button
          onClick={() => setActiveTab('minimap')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'minimap'
              ? 'text-app-accent border-b-2 border-app-accent'
              : 'text-app-muted hover:text-app-text'
          }`}
        >
          Overview
        </button>
      </div>

      {/* Controls Tab */}
      {activeTab === 'controls' && (
        <div className="space-y-4">
          {/* Search Section */}
          <div className="control-section">
            <h4><SearchIcon size={14} className="inline mr-2" />Search & Filter</h4>
            <div className="search-container">
              <SearchIcon size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto bg-app-panel border border-app-border rounded-md">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 text-sm border-b border-app-border last:border-b-0 hover:bg-app-bg cursor-pointer"
                  >
                    <div className="font-medium text-app-text">{result.label}</div>
                    <div className="text-xs text-app-muted">{result.type}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Layout Controls */}
          <div className="control-section">
            <h4><LayersIcon size={14} className="inline mr-2" />Layout Controls</h4>
            <div className="button-group">
              <button
                onClick={isLayoutRunning ? onLayoutStop : onLayoutStart}
                className={`btn-icon ${isLayoutRunning ? 'btn-danger' : 'btn-primary'}`}
                disabled={nodeCount === 0}
                title={isLayoutRunning ? 'Stop Layout' : 'Start Layout'}
              >
                {isLayoutRunning ? (
                  <>
                    <StopIcon size={16} />
                    <span>Stop Layout</span>
                  </>
                ) : (
                  <>
                    <PlayIcon size={16} />
                    <span>Start Layout</span>
                  </>
                )}
              </button>
              <button onClick={onReset} className="btn-icon btn-secondary" title="Reset Layout">
                <RefreshIcon size={16} />
                <span>Reset</span>
              </button>
              <button onClick={onCenter} className="btn-icon btn-secondary" title="Center View">
                <CenterIcon size={16} />
                <span>Center</span>
              </button>
            </div>
          </div>

          {/* View Controls */}
          <div className="control-section">
            <h4><MapIcon size={14} className="inline mr-2" />View Controls</h4>
            <div className="button-row">
              <button onClick={onZoomIn} className="btn-icon btn-secondary" title="Zoom In">
                <ZoomInIcon size={16} />
                <span>Zoom In</span>
              </button>
              <button onClick={onZoomOut} className="btn-icon btn-secondary" title="Zoom Out">
                <ZoomOutIcon size={16} />
                <span>Zoom Out</span>
              </button>
            </div>
            <button onClick={onExport} className="btn-icon btn-tertiary" title="Export as PNG">
              <DownloadIcon size={16} />
              <span>Export PNG</span>
            </button>
          </div>

          {/* Color Scheme */}
          <div className="control-section">
            <h4>Color Scheme</h4>
            <div className="color-scheme-grid">
              {[
                { name: 'default', color: '#6366f1', label: 'Default' },
                { name: 'ocean', color: '#0ea5e9', label: 'Ocean' },
                { name: 'forest', color: '#10b981', label: 'Forest' }
              ].map(scheme => (
                <button
                  key={scheme.name}
                  onClick={() => onColorSchemeChange?.(scheme.name)}
                  className={`color-scheme-option ${
                    scheme.name === 'default' ? 'active' : ''
                  }`}
                  title={scheme.label}
                >
                  <div 
                    className="color-preview" 
                    style={{ backgroundColor: scheme.color }}
                  ></div>
                  <span>{scheme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          <div className="control-section">
            <h4><ChartIcon size={14} className="inline mr-2" />Graph Statistics</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Nodes</span>
                <span className="stat-value">{nodeCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Edges</span>
                <span className="stat-value">{edgeCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Layout</span>
                <span className={`stat-value ${isLayoutRunning ? 'running' : 'idle'}`}>
                  {isLayoutRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Performance</span>
                <span className="stat-value">{performanceMode ? 'High' : 'Normal'}</span>
              </div>
            </div>
          </div>

          <div className="control-section">
            <h4>Performance Settings</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={performanceMode}
                onChange={(e) => onPerformanceModeChange?.(e.target.checked)}
                className="rounded border-app-border text-app-accent focus:ring-app-accent"
              />
              <span className="text-sm text-app-text">High Performance Mode</span>
            </label>
            <p className="text-xs text-app-muted mt-1">
              Reduces visual effects for better performance with large graphs
            </p>
          </div>
        </div>
      )}

      {/* Minimap Tab */}
      {activeTab === 'minimap' && (
        <div className="space-y-4">
          <div className="control-section">
            <h4><MapIcon size={14} className="inline mr-2" />Graph Overview</h4>
            <div className="bg-app-panel border border-app-border rounded-lg p-4 h-48 flex items-center justify-center">
              {nodeCount > 0 ? (
                <div className="text-center text-app-muted">
                  <div className="text-sm">Minimap visualization</div>
                  <div className="text-xs mt-1">Coming soon</div>
                </div>
              ) : (
                <div className="text-center text-app-muted">
                  <div className="text-sm">No nodes to display</div>
                </div>
              )}
            </div>
          </div>

          <div className="control-section">
            <h4>Navigation</h4>
            <div className="text-sm text-app-muted space-y-1">
              <div>• Click and drag to pan</div>
              <div>• Scroll to zoom</div>
              <div>• Click nodes to select</div>
              <div>• Double-click to focus</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphPanel;