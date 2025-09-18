import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GraphEngine } from '../core/graph/GraphEngine.js';
import { providerManager } from '../plugins/data/ProviderRegistry.js';
import GraphPanel from './GraphPanel.jsx';
import './GraphView.css';

/**
 * Enhanced GraphView with Data Provider Support
 * 
 * Features:
 * - Pluggable graph data providers
 * - Custom layout algorithms from providers
 * - Automatic fallback to default data sources
 * - Real-time provider switching
 * - Enhanced error handling and recovery
 */
const EnhancedGraphView = ({ 
  data = null, 
  onNodeClick = null, 
  onEdgeClick = null,
  options = {},
  className = '',
  graphEngine = null,
  isVisible = true,
  providerId = null, // Optional specific provider to use
  enableProviderSwitching = true
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
  
  // Provider-specific state
  const [currentProvider, setCurrentProvider] = useState(null);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [providerStatus, setProviderStatus] = useState('disconnected');
  const [graphData, setGraphData] = useState(data);

  // Initialize provider system and GraphEngine
  useEffect(() => {
    if (!containerRef.current) return;

    const initializeSystem = async () => {
      try {
        // Initialize provider manager if not already done
        await providerManager.initialize();
        
        // Get available graph providers
        const providers = providerManager.registry.getProvidersByType('graph');
        setAvailableProviders(providers);

        // Use specific provider or get active one
        let activeProvider;
        if (providerId) {
          activeProvider = providerManager.registry.getProvider(providerId);
        } else {
          activeProvider = providerManager.registry.getActiveProvider('graph');
        }

        if (activeProvider) {
          setCurrentProvider(activeProvider);
          setProviderStatus(activeProvider.isConnected ? 'connected' : 'disconnected');
          
          // Set up provider event listeners
          activeProvider.on('connected', () => setProviderStatus('connected'));
          activeProvider.on('disconnected', () => setProviderStatus('disconnected'));
          activeProvider.on('error', (error) => {
            console.error('Graph provider error:', error);
            setError(error.message);
          });
        }

        // Initialize GraphEngine
        let engine = graphEngineRef.current;
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

            console.log('Enhanced GraphView created GraphEngine with provider support');

          } catch (err) {
            console.error('Failed to initialize Enhanced GraphView:', err);
            setError(err.message);
            return;
          }
        }

        // Load graph data from provider if available
        if (activeProvider && activeProvider.isConnected) {
          await loadGraphDataFromProvider(activeProvider);
        }

      } catch (err) {
        console.error('Failed to initialize provider system:', err);
        setError(err.message);
      }
    };

    initializeSystem();

    // Cleanup
    return () => {
      if (graphEngineRef.current && graphEngineRef.current.pause && !graphEngineRef.current.isPaused) {
        graphEngineRef.current.pause();
      }
    };
  }, [options, graphEngine, providerId]);

  // Load graph data from provider
  const loadGraphDataFromProvider = useCallback(async (provider) => {
    if (!provider || !provider.isConnected) return;

    try {
      setError(null);
      
      // Use provider manager to execute operation with fallback
      const data = await providerManager.executeGraphOperation(
        async (graphProvider) => {
          return await graphProvider.getGraphData('graphology', {
            includeMetrics: true,
            optimizeForRendering: true
          });
        }
      );

      if (data && graphEngineRef.current) {
        setGraphData(data);
        graphEngineRef.current.importData(data);
        updateStats();
      }

    } catch (error) {
      console.error('Failed to load graph data from provider:', error);
      setError(`Provider error: ${error.message}`);
      
      // Fall back to default data if provided
      if (data && graphEngineRef.current) {
        setGraphData(data);
        graphEngineRef.current.importData(data);
        updateStats();
      }
    }
  }, [data]);

  // Switch to a different graph provider
  const switchProvider = useCallback(async (newProviderId) => {
    try {
      await providerManager.registry.setActiveProvider('graph', newProviderId);
      const newProvider = providerManager.registry.getProvider(newProviderId);
      
      if (newProvider) {
        setCurrentProvider(newProvider);
        setProviderStatus(newProvider.isConnected ? 'connected' : 'disconnected');
        
        // Load data from new provider
        await loadGraphDataFromProvider(newProvider);
        
        console.log(`Switched to graph provider: ${newProviderId}`);
      }
    } catch (error) {
      console.error('Failed to switch graph provider:', error);
      setError(`Failed to switch provider: ${error.message}`);
    }
  }, [loadGraphDataFromProvider]);

  // Apply custom layout from provider
  const applyProviderLayout = useCallback(async (algorithm = 'force-directed', options = {}) => {
    if (!currentProvider || !graphData || !graphEngineRef.current) return;

    try {
      setIsLayoutRunning(true);
      
      const layoutResult = await providerManager.executeGraphOperation(
        async (graphProvider) => {
          return await graphProvider.applyLayout(graphData, algorithm, options);
        }
      );

      if (layoutResult && layoutResult.nodePositions) {
        // Apply layout result to graph engine
        layoutResult.nodePositions.forEach(({ id, x, y }) => {
          if (graphEngineRef.current.graph.hasNode(id)) {
            graphEngineRef.current.graph.setNodeAttribute(id, 'x', x);
            graphEngineRef.current.graph.setNodeAttribute(id, 'y', y);
          }
        });
        
        graphEngineRef.current.sigma.refresh();
      }

    } catch (error) {
      console.error('Failed to apply provider layout:', error);
      setError(`Layout error: ${error.message}`);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [currentProvider, graphData]);

  // Calculate graph metrics using provider
  const calculateProviderMetrics = useCallback(async (metrics = ['centrality', 'clustering']) => {
    if (!currentProvider || !graphData) return null;

    try {
      const metricsResult = await providerManager.executeGraphOperation(
        async (graphProvider) => {
          return await graphProvider.calculateMetrics(graphData, metrics);
        }
      );

      return metricsResult;

    } catch (error) {
      console.error('Failed to calculate provider metrics:', error);
      return null;
    }
  }, [currentProvider, graphData]);

  // Handle data updates (prioritize provider data)
  useEffect(() => {
    if (!isInitialized || !graphEngineRef.current) return;

    // If we have a provider, prefer its data
    if (currentProvider && currentProvider.isConnected) {
      loadGraphDataFromProvider(currentProvider);
    } else if (data) {
      // Fall back to provided data
      try {
        setGraphData(data);
        graphEngineRef.current.importData(data);
        updateStats();
      } catch (err) {
        console.error('Failed to import fallback graph data:', err);
        setError(err.message);
      }
    }
  }, [data, isInitialized, currentProvider, loadGraphDataFromProvider]);

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

  // Control functions with provider integration
  const startLayout = useCallback(async () => {
    if (graphEngineRef.current && !isLayoutRunning) {
      // Try provider layout first, fall back to engine layout
      if (currentProvider && currentProvider.isConnected) {
        await applyProviderLayout();
      } else {
        graphEngineRef.current.startLayout();
      }
    }
  }, [isLayoutRunning, currentProvider, applyProviderLayout]);

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
      setGraphData(null);
      updateStats();
    }
  }, [updateStats]);

  // Enhanced search with provider support
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!graphEngineRef.current || !query.trim()) {
      setSearchResults([]);
      return;
    }

    let results = [];

    // Try provider search first
    if (currentProvider && currentProvider.isConnected) {
      try {
        const providerResults = await providerManager.executeSearchOperation(
          async (searchProvider) => {
            return await searchProvider.search(query, {
              type: 'keyword',
              limit: 10,
              context: 'graph-nodes'
            });
          }
        );

        if (providerResults && providerResults.length > 0) {
          results = providerResults.map(result => ({
            id: result.id || result.nodeId,
            label: result.label || result.title,
            type: result.type || 'node',
            score: result.score || 1
          }));
        }
      } catch (error) {
        console.warn('Provider search failed, using fallback:', error);
      }
    }

    // Fall back to local search if no provider results
    if (results.length === 0 && graphData && graphData.nodes) {
      graphData.nodes.forEach(node => {
        if (node.label && node.label.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: node.id,
            label: node.label,
            type: node.type || 'file',
            score: 1
          });
        }
      });
    }

    setSearchResults(results.slice(0, 10));
  }, [currentProvider, graphData]);

  // Enhanced color scheme handling
  const handleColorSchemeChange = useCallback((scheme) => {
    setColorScheme(scheme);
    if (graphEngineRef.current) {
      graphEngineRef.current.setColorScheme(scheme);
    }
  }, []);

  // Provider status indicator
  const getProviderStatusColor = () => {
    switch (providerStatus) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-red-500';
      case 'connecting': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  // Visibility management
  useEffect(() => {
    if (!graphEngineRef.current || !isInitialized) return;

    const engine = graphEngineRef.current;

    if (isVisible) {
      if (engine.isPaused) {
        engine.resume();
        console.log('Enhanced GraphView resumed');
      }
    } else {
      if (!engine.isPaused) {
        engine.pause();
        console.log('Enhanced GraphView paused');
      }
    }
  }, [isVisible, isInitialized]);

  // Error boundary
  if (error) {
    return (
      <div className={`graph-view error ${className}`}>
        <div className="error-message">
          <h3>Graph Initialization Error</h3>
          <p>{error}</p>
          <div className="mt-4 space-y-2">
            <button 
              onClick={() => setError(null)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`graph-view enhanced modern ${className}`}>
      {/* Provider Status Bar */}
      {enableProviderSwitching && (
        <div className="provider-status-bar bg-gray-100 dark:bg-gray-800 p-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Provider:</span>
              <select
                value={currentProvider?.id || ''}
                onChange={(e) => switchProvider(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="">Default</option>
                {availableProviders.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.config.name || provider.id}
                  </option>
                ))}
              </select>
              <span className={`text-sm ${getProviderStatusColor()}`}>
                ● {providerStatus}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {currentProvider && (
                <button
                  onClick={() => calculateProviderMetrics()}
                  className="text-sm px-2 py-1 border rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Calculate Metrics
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graph Container */}
      <div 
        ref={containerRef} 
        className="graph-container"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Enhanced Graph Panel with Provider Info */}
      <GraphPanel
        // Controls props
        onLayoutStart={startLayout}
        onLayoutStop={stopLayout}
        onReset={() => {
          clearGraph();
          if (currentProvider) {
            loadGraphDataFromProvider(currentProvider);
          }
        }}
        onSearch={handleSearch}
        onColorSchemeChange={handleColorSchemeChange}
        onZoomIn={() => {
          const newZoom = Math.min(zoomLevel * 1.2, 500);
          setZoomLevel(Math.round(newZoom));
          if (graphEngineRef.current) {
            graphEngineRef.current.setZoom(newZoom / 100);
          }
        }}
        onZoomOut={() => {
          const newZoom = Math.max(zoomLevel / 1.2, 10);
          setZoomLevel(Math.round(newZoom));
          if (graphEngineRef.current) {
            graphEngineRef.current.setZoom(newZoom / 100);
          }
        }}
        onCenter={fitToViewport}
        onExport={() => {
          if (graphEngineRef.current) {
            graphEngineRef.current.exportToPNG();
          }
        }}
        searchResults={searchResults}
        
        // Stats props with provider info
        graphEngine={graphEngineRef.current}
        nodeCount={stats.nodeCount}
        edgeCount={stats.edgeCount}
        isLayoutRunning={isLayoutRunning}
        performanceMode={performanceMode}
        onPerformanceModeChange={(enabled) => {
          setPerformanceMode(enabled);
          if (graphEngineRef.current) {
            graphEngineRef.current.setPerformanceMode(enabled);
          }
        }}
        
        // Enhanced props
        providerInfo={currentProvider ? {
          id: currentProvider.id,
          name: currentProvider.config.name || currentProvider.id,
          status: providerStatus,
          capabilities: currentProvider.getCapabilities()
        } : null}
        
        // Minimap props
        graphData={graphData}
        viewportBounds={viewportBounds}
        onViewportChange={(position) => {
          if (graphEngineRef.current) {
            graphEngineRef.current.panTo(position.x, position.y);
          }
        }}
        
        // General props
        isVisible={isInitialized}
      />

      {/* Loading Indicator */}
      {!isInitialized && (
        <div className="loading-overlay modern">
          <div className="loading-spinner">
            <div className="spinner modern"></div>
            <p>Initializing Enhanced Graph Engine...</p>
            {currentProvider && (
              <p className="text-sm text-gray-600 mt-2">
                Loading data from {currentProvider.config.name || currentProvider.id}
              </p>
            )}
            <div className="loading-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedGraphView;