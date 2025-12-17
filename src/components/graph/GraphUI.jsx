/**
 * GraphUI - Simplified professional interface for graph visualization
 *
 * Features:
 * - Clean, simplified controls (Filters and Forces moved to GraphSidebar)
 * - Beautiful glassmorphism design with frosted glass effects
 * - Smooth 60fps animations with Framer Motion
 * - Multiple view modes (2D, 3D, force-directed)
 * - Quick search and basic controls
 * - Real-time performance monitoring
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings,
  Eye,
  Layers,
  Network,
  Box,
  Download,
  Info,
  Target,
  Hash,
  Zap
} from 'lucide-react';

export const GraphUI = ({
  graphData,
  onViewModeChange,
  onSearch,
  onLayoutControl,
  onZoom,
  onReset,
  onExport,
  stats = {},
  isLayoutRunning = false,
  viewMode = '2d',
  searchQuery = '',
  selectedNodes = [],
  hoveredNode = null,
  className = ''
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const searchInputRef = useRef(null);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            onReset?.();
            break;
          case '1':
            e.preventDefault();
            onViewModeChange?.('2d');
            break;
          case '2':
            e.preventDefault();
            onViewModeChange?.('3d');
            break;
          case '3':
            e.preventDefault();
            onViewModeChange?.('force');
            break;
          default:
            break;
        }
      }

      if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setShowSettings(false);
        searchInputRef.current?.blur();
      }

      if (e.key === ' ') {
        e.preventDefault();
        onLayoutControl?.(isLayoutRunning ? 'stop' : 'start');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLayoutRunning, onViewModeChange, onReset, onLayoutControl]);
  
  // Handle search
  const handleSearchChange = useCallback((value) => {
    onSearch?.(value);
    // In a real implementation, this would trigger graph data search
    if (value.trim()) {
      // Mock search results for demonstration
      setSearchResults([
        { id: '1', title: 'Sample Node 1', type: 'document' },
        { id: '2', title: 'Sample Node 2', type: 'placeholder' }
      ]);
    } else {
      setSearchResults([]);
    }
  }, [onSearch]);
  
  // View mode configurations
  const viewModes = [
    { id: '2d', icon: Layers, label: '2D View', hotkey: '⌘1' },
    { id: '3d', icon: Box, label: '3D View', hotkey: '⌘2' },
    { id: 'force', icon: Network, label: 'Force Layout', hotkey: '⌘3' }
  ];
  
  return (
    <div className={`graph-ui ${className}`}>
      {/* Simplified Control Panel - No Tabs */}
      <motion.div
        className="graph-control-panel"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Search Section */}
        <div className="panel-section">
          <div className="search-input-container">
            <Search size={16} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={`search-input ${isSearchFocused ? 'focused' : ''}`}
            />
            {searchQuery && (
              <motion.button
                className="clear-search"
                onClick={() => handleSearchChange('')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                ×
              </motion.button>
            )}
          </div>
        </div>

        {/* Essential Controls */}
        <div className="panel-content">
          <ControlsPanel
            viewMode={viewMode}
            viewModes={viewModes}
            isLayoutRunning={isLayoutRunning}
            onViewModeChange={onViewModeChange}
            onLayoutControl={onLayoutControl}
            onZoom={onZoom}
            onReset={onReset}
            onExport={onExport}
          />

          {/* Toggle Stats Button */}
          <div className="control-section">
            <motion.button
              className="control-btn secondary full-width"
              onClick={() => setShowStats(!showStats)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Info size={16} />
              <span>{showStats ? 'Hide' : 'Show'} Statistics</span>
            </motion.button>
          </div>

          {/* Stats (collapsible) */}
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <StatsPanel stats={stats} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      {/* Floating Action Buttons */}
      <div className="floating-actions">
        <motion.button
          className="fab primary"
          onClick={() => onLayoutControl?.(isLayoutRunning ? 'stop' : 'start')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={isLayoutRunning ? 'Stop Layout' : 'Start Layout'}
        >
          {isLayoutRunning ? <Pause size={20} /> : <Play size={20} />}
        </motion.button>
        
        <motion.button
          className="fab secondary"
          onClick={() => onReset?.()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Reset View (⌘R)"
        >
          <RotateCcw size={18} />
        </motion.button>
        
        <motion.button
          className="fab secondary"
          onClick={() => onZoom?.('fit')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Fit to Screen"
        >
          <Maximize2 size={18} />
        </motion.button>
      </div>

      {/* Performance Monitor */}
      {stats.fps && (
        <motion.div
          className="performance-monitor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className={`fps-indicator ${stats.fps < 30 ? 'warning' : stats.fps < 50 ? 'caution' : 'good'}`}>
            {Math.round(stats.fps)} FPS
          </div>
          <div className="node-count">
            {stats.nodeCount || 0} nodes
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Controls Panel Component
const ControlsPanel = ({
  viewMode,
  viewModes,
  isLayoutRunning,
  onViewModeChange,
  onLayoutControl,
  onZoom,
  onReset,
  onExport
}) => (
  <div className="controls-panel">
    <div className="control-section">
      <h4>View Mode</h4>
      <div className="view-mode-grid">
        {viewModes.map((mode) => (
          <motion.button
            key={mode.id}
            className={`view-mode-btn ${viewMode === mode.id ? 'active' : ''}`}
            onClick={() => onViewModeChange?.(mode.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <mode.icon size={18} />
            <span>{mode.label}</span>
            <kbd>{mode.hotkey}</kbd>
          </motion.button>
        ))}
      </div>
    </div>
    
    <div className="control-section">
      <h4>Layout Controls</h4>
      <div className="button-grid">
        <motion.button
          className={`control-btn ${isLayoutRunning ? 'danger' : 'primary'}`}
          onClick={() => onLayoutControl?.(isLayoutRunning ? 'stop' : 'start')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLayoutRunning ? <Pause size={16} /> : <Play size={16} />}
          <span>{isLayoutRunning ? 'Stop' : 'Start'}</span>
        </motion.button>
        
        <motion.button
          className="control-btn secondary"
          onClick={() => onReset?.()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RotateCcw size={16} />
          <span>Reset</span>
        </motion.button>
      </div>
    </div>
    
    <div className="control-section">
      <h4>Zoom Controls</h4>
      <div className="button-row">
        <motion.button
          className="control-btn tertiary"
          onClick={() => onZoom?.('in')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ZoomIn size={16} />
        </motion.button>
        
        <motion.button
          className="control-btn tertiary"
          onClick={() => onZoom?.('out')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ZoomOut size={16} />
        </motion.button>
        
        <motion.button
          className="control-btn tertiary"
          onClick={() => onZoom?.('fit')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Maximize2 size={16} />
        </motion.button>
      </div>
    </div>
    
    <div className="control-section">
      <h4>Export</h4>
      <motion.button
        className="control-btn secondary full-width"
        onClick={() => onExport?.()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Download size={16} />
        <span>Export PNG</span>
      </motion.button>
    </div>
  </div>
);

// Statistics Panel Component
const StatsPanel = ({ stats }) => (
  <div className="stats-panel">
    <div className="stats-grid">
      <div className="stat-item">
        <div className="stat-value">{stats.nodeCount || 0}</div>
        <div className="stat-label">Nodes</div>
      </div>
      
      <div className="stat-item">
        <div className="stat-value">{stats.linkCount || 0}</div>
        <div className="stat-label">Links</div>
      </div>
      
      <div className="stat-item">
        <div className="stat-value">{Math.round(stats.fps || 60)}</div>
        <div className="stat-label">FPS</div>
      </div>
      
      <div className="stat-item">
        <div className="stat-value">{stats.renderTime ? `${stats.renderTime}ms` : '0ms'}</div>
        <div className="stat-label">Render Time</div>
      </div>
    </div>
    
    <div className="performance-section">
      <h5>Performance</h5>
      <div className="performance-bar">
        <div className="performance-indicator">
          <div 
            className="performance-fill"
            style={{ width: `${Math.min(100, (stats.fps || 60) / 60 * 100)}%` }}
          />
        </div>
        <span className="performance-text">
          {stats.fps >= 50 ? 'Excellent' : stats.fps >= 30 ? 'Good' : 'Poor'}
        </span>
      </div>
    </div>
    
    <div className="memory-section">
      <h5>Memory Usage</h5>
      <div className="memory-stats">
        <div>Nodes: {((stats.nodeCount || 0) * 0.1).toFixed(1)} KB</div>
        <div>Links: {((stats.linkCount || 0) * 0.05).toFixed(1)} KB</div>
      </div>
    </div>
  </div>
);

// Node Information Card Component
const NodeInfoCard = ({ node }) => (
  <div className="node-info-card">
    <div className="node-info-header">
      <div className="node-title">{node.title || node.label}</div>
      <div className="node-type">{node.type}</div>
    </div>
    
    <div className="node-info-content">
      {node.wordCount && (
        <div className="info-item">
          <span className="info-label">Words:</span>
          <span className="info-value">{node.wordCount}</span>
        </div>
      )}
      
      {node.backlinkCount !== undefined && (
        <div className="info-item">
          <span className="info-label">Backlinks:</span>
          <span className="info-value">{node.backlinkCount}</span>
        </div>
      )}
      
      {node.tags && node.tags.length > 0 && (
        <div className="info-item">
          <span className="info-label">Tags:</span>
          <div className="tag-list">
            {node.tags.map(tag => (
              <span key={tag} className="tag"># {tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default GraphUI;