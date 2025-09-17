import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GraphEngine } from '../core/graph/GraphEngine.js';
import GraphPanel from './GraphPanel.jsx';
import './GraphView.css';

/**
 * GraphView - React component for graph visualization
 * 
 * Features:
 * - Real-time graph rendering with Sigma.js
 * - Interactive controls and settings
 * - Performance monitoring
 * - Node and edge management
 * - Layout controls
 */
const GraphView = ({ 
  data = null, 
  onNodeClick = null, 
  onEdgeClick = null,
  options = {},
  className = '',
  graphEngine = null, // Accept external GraphEngine instance
  isVisible = true     // Whether the graph view is currently visible
}) => {
  const containerRef = useRef(null);
  const graphEngineRef = useRef(graphEngine);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [stats, setStats] = useState({
    nodeCount: 0,
    edgeCount: 0,
    layoutIterations: 0,
    renderTime: 0
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [colorScheme, setColorScheme] = useState('default');
  const [performanceMode, setPerformanceMode] = useState(false);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Initialize GraphEngine when component mounts
  useEffect(() => {
    if (!containerRef.current) return;

    let engine = graphEngineRef.current;

    // If no external engine provided, create a new one
    if (!engine && !isInitialized) {
      try {
        engine = new GraphEngine(containerRef.current, options);
        
        // Setup event listeners
        engine.on('nodeClick', handleNodeClick);
        engine.on('edgeClick', handleEdgeClick);
        engine.on('layoutStarted', () => setIsLayoutRunning(true));
        engine.on('layoutStopped', () => setIsLayoutRunning(false));
        engine.on('nodeAdded', updateStats);
        engine.on('edgeAdded', updateStats);
        engine.on('nodeRemoved', updateStats);
        engine.on('edgeRemoved', updateStats);

        // Initialize the engine
        engine.initialize();
        graphEngineRef.current = engine;
        setIsInitialized(true);
        setError(null);

        console.log('GraphView created new GraphEngine');

      } catch (err) {
        console.error('Failed to initialize GraphView:', err);
        setError(err.message);
        return;
      }
    } else if (engine && !isInitialized) {
      // Use existing external engine
      try {
        // Update container if needed
        if (engine.container !== containerRef.current) {
          engine.container = containerRef.current;
          engine.sigma.setContainer(containerRef.current);
        }
        
        // Setup event listeners for this view
        engine.on('nodeClick', handleNodeClick);
        engine.on('edgeClick', handleEdgeClick);
        engine.on('layoutStarted', () => setIsLayoutRunning(true));
        engine.on('layoutStopped', () => setIsLayoutRunning(false));
        
        setIsInitialized(true);
        setError(null);
        updateStats();

        console.log('GraphView using existing GraphEngine');

      } catch (err) {
        console.error('Failed to setup existing GraphEngine:', err);
        setError(err.message);
      }
    }

    // Don't destroy engine on unmount - it might be shared
    // Only pause it when this view unmounts
    return () => {
      if (engine && engine.pause && !engine.isPaused) {
        engine.pause();
      }
    };
  }, [options, graphEngine]);

  // Handle data updates
  useEffect(() => {
    if (!isInitialized || !graphEngineRef.current || !data) return;

    try {
      graphEngineRef.current.importData(data);
      updateStats();
    } catch (err) {
      console.error('Failed to import graph data:', err);
      setError(err.message);
    }
  }, [data, isInitialized]);

  // Update stats from graph engine
  const updateStats = useCallback(() => {
    if (graphEngineRef.current) {
      setStats(graphEngineRef.current.getStats());
    }
  }, []);

  // Handle node click events
  const handleNodeClick = useCallback((event) => {
    const { nodeId, nodeData } = event;
    setSelectedNode({ id: nodeId, data: nodeData });
    
    if (onNodeClick) {
      onNodeClick(event);
    }
  }, [onNodeClick]);

  // Handle edge click events
  const handleEdgeClick = useCallback((event) => {
    if (onEdgeClick) {
      onEdgeClick(event);
    }
  }, [onEdgeClick]);

  // Control functions
  const startLayout = useCallback(() => {
    if (graphEngineRef.current && !isLayoutRunning) {
      graphEngineRef.current.startLayout();
    }
  }, [isLayoutRunning]);

  const stopLayout = useCallback(() => {
    if (graphEngineRef.current && isLayoutRunning) {
      graphEngineRef.current.stopLayout();
    }
  }, [isLayoutRunning]);

  const fitToViewport = useCallback(() => {
    if (graphEngineRef.current) {
      graphEngineRef.current.fitToViewport();
    }
  }, []);

  const clearGraph = useCallback(() => {
    if (graphEngineRef.current) {
      graphEngineRef.current.clear();
      setSelectedNode(null);
      updateStats();
    }
  }, [updateStats]);

  // Add sample data for testing
  const addSampleData = useCallback(() => {
    if (!graphEngineRef.current) return;

    const engine = graphEngineRef.current;
    
    // Add sample nodes
    engine.addNode('file1', { 
      type: 'file', 
      label: 'Document.md',
      size: 10
    });
    engine.addNode('file2', { 
      type: 'file', 
      label: 'Notes.md',
      size: 8
    });
    engine.addNode('folder1', { 
      type: 'folder', 
      label: 'Projects',
      size: 12
    });
    engine.addNode('tag1', { 
      type: 'tag', 
      label: '#important',
      size: 6
    });
    engine.addNode('tag2', { 
      type: 'tag', 
      label: '#work',
      size: 6
    });

    // Add sample edges
    engine.addEdge('edge1', 'file1', 'file2', { 
      type: 'strong',
      size: 2
    });
    engine.addEdge('edge2', 'folder1', 'file1', { 
      type: 'default'
    });
    engine.addEdge('edge3', 'folder1', 'file2', { 
      type: 'default'
    });
    engine.addEdge('edge4', 'file1', 'tag1', { 
      type: 'weak'
    });
    engine.addEdge('edge5', 'file2', 'tag2', { 
      type: 'weak'
    });

    updateStats();
  }, [updateStats]);

  // New control functions for modern UI
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!graphEngineRef.current || !query.trim()) {
      setSearchResults([]);
      return;
    }

    // Search through nodes
    const results = [];
    if (data && data.nodes) {
      data.nodes.forEach(node => {
        if (node.label && node.label.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: node.id,
            label: node.label,
            type: node.type || 'file'
          });
        }
      });
    }
    setSearchResults(results.slice(0, 10)); // Limit results
  }, [data]);

  const handleColorSchemeChange = useCallback((scheme) => {
    setColorScheme(scheme);
    if (graphEngineRef.current) {
      // Apply color scheme to graph engine
      graphEngineRef.current.setColorScheme(scheme);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (graphEngineRef.current) {
      const newZoom = Math.min(zoomLevel * 1.2, 500);
      setZoomLevel(Math.round(newZoom));
      graphEngineRef.current.setZoom(newZoom / 100);
    }
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    if (graphEngineRef.current) {
      const newZoom = Math.max(zoomLevel / 1.2, 10);
      setZoomLevel(Math.round(newZoom));
      graphEngineRef.current.setZoom(newZoom / 100);
    }
  }, [zoomLevel]);

  const handleCenter = useCallback(() => {
    if (graphEngineRef.current) {
      graphEngineRef.current.fitToViewport();
      setZoomLevel(100);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (graphEngineRef.current) {
      graphEngineRef.current.resetLayout();
      setZoomLevel(100);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (graphEngineRef.current) {
      graphEngineRef.current.exportToPNG();
    }
  }, []);

  const handleViewportChange = useCallback((position) => {
    if (graphEngineRef.current) {
      graphEngineRef.current.panTo(position.x, position.y);
    }
  }, []);

  const handlePerformanceModeChange = useCallback((enabled) => {
    setPerformanceMode(enabled);
    if (graphEngineRef.current) {
      graphEngineRef.current.setPerformanceMode(enabled);
    }
  }, []);

  // Handle visibility changes (pause/resume)
  useEffect(() => {
    if (!graphEngineRef.current || !isInitialized) return;

    const engine = graphEngineRef.current;

    if (isVisible) {
      // Resume when visible
      if (engine.isPaused) {
        engine.resume();
        console.log('GraphView resumed due to visibility');
      }
    } else {
      // Pause when not visible
      if (!engine.isPaused) {
        engine.pause();
        console.log('GraphView paused due to visibility');
      }
    }
  }, [isVisible, isInitialized]);

  // Update viewport bounds periodically (only when visible)
  useEffect(() => {
    if (!graphEngineRef.current || !isVisible) return;

    const updateViewportBounds = () => {
      try {
        const bounds = graphEngineRef.current.getViewportBounds();
        setViewportBounds(bounds);
      } catch (error) {
        // Ignore errors if graph engine doesn't support this method yet
      }
    };

    const interval = setInterval(updateViewportBounds, 500);
    updateViewportBounds(); // Initial call

    return () => clearInterval(interval);
  }, [isInitialized, isVisible]);

  if (error) {
    return (
      <div className={`graph-view error ${className}`}>
        <div className="error-message">
          <h3>Graph Initialization Error</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`graph-view modern ${className}`}>
      {/* Graph Container */}
      <div 
        ref={containerRef} 
        className="graph-container"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Unified Graph Panel */}
      <GraphPanel
        // Controls props
        onLayoutStart={startLayout}
        onLayoutStop={stopLayout}
        onReset={handleReset}
        onSearch={handleSearch}
        onColorSchemeChange={handleColorSchemeChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenter={handleCenter}
        onExport={handleExport}
        searchResults={searchResults}
        
        // Stats props
        graphEngine={graphEngineRef.current}
        nodeCount={stats.nodeCount}
        edgeCount={stats.edgeCount}
        isLayoutRunning={isLayoutRunning}
        performanceMode={performanceMode}
        onPerformanceModeChange={handlePerformanceModeChange}
        
        // Minimap props
        graphData={data}
        viewportBounds={viewportBounds}
        onViewportChange={handleViewportChange}
        
        // General props
        isVisible={isInitialized}
      />

      {/* Loading Indicator */}
      {!isInitialized && (
        <div className="loading-overlay modern">
          <div className="loading-spinner">
            <div className="spinner modern"></div>
            <p>Initializing Graph Engine...</p>
            <div className="loading-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Controls (Hidden) */}
      <div className="legacy-controls" style={{ display: 'none' }}>
        <button onClick={addSampleData}>Add Sample Data</button>
        <button onClick={clearGraph}>Clear Graph</button>
      </div>
    </div>
  );
};

export default GraphView;