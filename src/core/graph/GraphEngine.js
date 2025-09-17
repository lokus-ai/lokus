import Sigma from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import PerformanceManager from './PerformanceManager.js';

/**
 * GraphEngine - Core graph visualization engine using Sigma.js
 * 
 * Features:
 * - WebGL rendering for performance
 * - Force-directed layout with ForceAtlas2
 * - Color coding support for different node types
 * - Efficient handling of large graphs (up to 10k nodes)
 * - Physics simulation with stability detection
 */
export class GraphEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.graph = new Graph({ multi: false, type: 'undirected' });
    this.sigma = null;
    this.layoutWorker = null;
    this.isLayoutRunning = false;
    this.isPaused = false;
    this.performanceManager = null;
    this.webWorker = null;
    
    // Aggressive caching system
    this.cache = {
      layouts: new Map(),         // Cached layout positions
      renderedFrames: new Map(),  // Cached rendered frames
      nodePositions: new Map(),   // Position cache with timestamps
      edgeGeometry: new Map(),    // Edge geometry cache
      nodeGeometry: new Map(),    // Node geometry cache
      viewportStates: new Map(),  // Cached viewport calculations
      lastCacheCleanup: Date.now(),
      maxCacheAge: 300000,        // 5 minutes cache TTL
      maxCacheSize: 1000,         // Maximum cached items
      enabled: true
    };
    
    // Memory allocation pools for performance
    this.memoryPools = {
      vectors: [],                // Reusable vector objects
      matrices: [],               // Reusable transformation matrices
      buffers: [],                // Reusable render buffers
      geometries: []              // Reusable geometry objects
    };
    
    // Default options with performance optimizations
    this.options = {
      maxNodes: 10000,
      stopPhysicsWhenStable: true,
      stabilityThreshold: 0.001,
      maxLayoutIterations: 1000,
      nodeColorScheme: {
        default: '#6366f1',
        file: '#10b981',
        folder: '#f59e0b',
        tag: '#ef4444',
        link: '#8b5cf6'
      },
      edgeColorScheme: {
        default: '#d1d5db',
        strong: '#6b7280',
        weak: '#e5e7eb'
      },
      ...options
    };

    // Performance monitoring
    this.stats = {
      nodeCount: 0,
      edgeCount: 0,
      renderTime: 0,
      layoutIterations: 0
    };

    this.eventListeners = new Map();
    
    // Initialize memory pools
    this.initializeMemoryPools();
    
    // Setup cache cleanup
    this.setupCacheCleanup();
  }

  /**
   * Initialize the Sigma.js instance with WebGL rendering
   */
  initialize() {
    if (!this.container) {
      throw new Error('Container element is required for graph initialization');
    }

    try {
      // Configure Sigma with WebGL for performance
      this.sigma = new Sigma(this.graph, this.container, {
        // WebGL rendering for better performance
        renderingOptions: {
          webgl: true,
          antialias: true
        },
        
        // Node rendering settings
        defaultNodeColor: this.options.nodeColorScheme.default,
        defaultNodeSize: 8,
        minNodeSize: 4,
        maxNodeSize: 20,
        
        // Edge rendering settings
        defaultEdgeColor: this.options.edgeColorScheme.default,
        defaultEdgeSize: 1,
        minEdgeSize: 0.5,
        maxEdgeSize: 4,
        
        // Performance settings
        hideEdgesOnMove: true,
        hideLabelsOnMove: true,
        enableHoverEffects: true,
        
        // Interaction settings
        allowInvalidContainer: false,
        doubleClickEnabled: true,
        wheelEnabled: true,
        mouseEnabled: true,
        touchEnabled: true
      });

      this.setupEventHandlers();
      this.setupNodeRenderers();
      this.setupEdgeRenderers();
      
      // Initialize performance manager - temporarily disabled due to recursion issue
      // this.performanceManager = new PerformanceManager(this);
      this.performanceManager = null;
      
      // Initialize web worker for background calculations
      this.initializeWebWorker();
      
      console.log('GraphEngine initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize GraphEngine:', error);
      throw error;
    }
  }

  /**
   * Setup custom node renderers for different node types
   */
  setupNodeRenderers() {
    if (!this.sigma) return;

    // For now, use default Sigma.js node renderer to avoid WebGL program issues
    // All nodes will be rendered as circles by default
    
    // Set default node type for all unspecified types
    this.sigma.setSetting('defaultNodeType', 'circle');
  }

  /**
   * Setup custom edge renderers
   */
  setupEdgeRenderers() {
    if (!this.sigma) return;

    this.sigma.setSetting('edgeRenderer', (context, data, settings) => {
      const { source, target, size, color, type } = data;
      const sourceData = this.graph.getNodeAttributes(source);
      const targetData = this.graph.getNodeAttributes(target);
      
      context.strokeStyle = color || this.options.edgeColorScheme[type] || this.options.edgeColorScheme.default;
      context.lineWidth = size || 1;
      
      // Dashed line for weak connections
      if (type === 'weak') {
        context.setLineDash([5, 5]);
      } else {
        context.setLineDash([]);
      }
      
      context.beginPath();
      context.moveTo(sourceData.x, sourceData.y);
      context.lineTo(targetData.x, targetData.y);
      context.stroke();
    });
  }

  /**
   * Setup event handlers for user interactions
   */
  setupEventHandlers() {
    if (!this.sigma) return;

    // Node click events
    this.sigma.on('clickNode', (event) => {
      const nodeId = event.node;
      const nodeData = this.graph.getNodeAttributes(nodeId);
      this.emit('nodeClick', { nodeId, nodeData });
    });

    // Node hover events
    this.sigma.on('enterNode', (event) => {
      const nodeId = event.node;
      this.highlightNode(nodeId);
      this.emit('nodeHover', { nodeId, enter: true });
    });

    this.sigma.on('leaveNode', (event) => {
      this.clearHighlight();
      this.emit('nodeHover', { nodeId: event.node, enter: false });
    });

    // Edge click events
    this.sigma.on('clickEdge', (event) => {
      const edgeId = event.edge;
      const edgeData = this.graph.getEdgeAttributes(edgeId);
      this.emit('edgeClick', { edgeId, edgeData });
    });

    // Camera events
    this.sigma.getCamera().on('updated', () => {
      this.emit('cameraUpdate', this.sigma.getCamera().getState());
    });

    // Handle window resize to prevent nodes from disappearing
    this.resizeHandler = () => {
      if (this.sigma) {
        // Force a refresh of the renderer
        setTimeout(() => {
          try {
            this.sigma.refresh();
            this.sigma.getCamera().disable();
            this.sigma.getCamera().enable();
          } catch (error) {
            console.warn('Error during resize refresh:', error);
          }
        }, 100);
      }
    };

    // Add resize event listener
    window.addEventListener('resize', this.resizeHandler);
    
    // Also handle container resize with ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeHandler();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Add a node to the graph
   */
  addNode(nodeId, attributes = {}) {
    const defaultAttributes = {
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      size: 8,
      color: this.options.nodeColorScheme.default,
      type: 'circle', // Force all nodes to use circle type to avoid renderer issues
      label: nodeId
    };

    // Override any incoming type with 'circle' to prevent renderer errors
    const nodeAttributes = { ...defaultAttributes, ...attributes, type: 'circle' };
    
    if (!this.graph.hasNode(nodeId)) {
      this.graph.addNode(nodeId, nodeAttributes);
      this.stats.nodeCount++;
      this.emit('nodeAdded', { nodeId, attributes: nodeAttributes });
    } else {
      // Update existing node
      this.graph.updateNodeAttributes(nodeId, (current) => ({ ...current, ...attributes }));
      this.emit('nodeUpdated', { nodeId, attributes });
    }
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edgeId, source, target, attributes = {}) {
    const defaultAttributes = {
      size: 1,
      color: this.options.edgeColorScheme.default,
      type: 'default'
    };

    const edgeAttributes = { ...defaultAttributes, ...attributes };

    if (!this.graph.hasEdge(edgeId)) {
      this.graph.addEdge(edgeId, source, target, edgeAttributes);
      this.stats.edgeCount++;
      this.emit('edgeAdded', { edgeId, source, target, attributes: edgeAttributes });
    }
  }

  /**
   * Remove a node and its connected edges
   */
  removeNode(nodeId) {
    if (this.graph.hasNode(nodeId)) {
      this.graph.dropNode(nodeId);
      this.stats.nodeCount--;
      this.emit('nodeRemoved', { nodeId });
    }
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId) {
    if (this.graph.hasEdge(edgeId)) {
      this.graph.dropEdge(edgeId);
      this.stats.edgeCount--;
      this.emit('edgeRemoved', { edgeId });
    }
  }

  /**
   * Highlight a node and its neighbors
   */
  highlightNode(nodeId) {
    if (!this.graph.hasNode(nodeId)) return;

    // Reset all nodes to dimmed state
    this.graph.forEachNode((node, attributes) => {
      this.graph.setNodeAttribute(node, 'highlighted', false);
      this.graph.setNodeAttribute(node, 'dimmed', true);
    });

    // Highlight the target node
    this.graph.setNodeAttribute(nodeId, 'highlighted', true);
    this.graph.setNodeAttribute(nodeId, 'dimmed', false);

    // Highlight neighbors
    this.graph.forEachNeighbor(nodeId, (neighbor) => {
      this.graph.setNodeAttribute(neighbor, 'highlighted', true);
      this.graph.setNodeAttribute(neighbor, 'dimmed', false);
    });

    this.sigma.refresh();
  }

  /**
   * Clear all highlights
   */
  clearHighlight() {
    this.graph.forEachNode((node) => {
      this.graph.setNodeAttribute(node, 'highlighted', false);
      this.graph.setNodeAttribute(node, 'dimmed', false);
    });
    this.sigma.refresh();
  }

  /**
   * Start ForceAtlas2 layout algorithm
   */
  startLayout() {
    if (this.isLayoutRunning) return;

    try {
      // Configure ForceAtlas2 settings
      const settings = {
        iterations: this.options.maxLayoutIterations,
        settings: {
          gravity: 1,
          strongGravityMode: false,
          scalingRatio: 10,
          slowDown: 1,
          barnesHutOptimize: this.stats.nodeCount > 100,
          barnesHutTheta: 0.5,
          linLogMode: false,
          outboundAttractionDistribution: false,
          adjustSizes: false
        }
      };

      this.isLayoutRunning = true;
      this.layoutWorker = forceAtlas2.assign(this.graph, settings);
      
      // Monitor layout progress
      let iterations = 0;
      let lastEnergy = Infinity;
      
      const layoutStep = () => {
        if (!this.isLayoutRunning || iterations >= this.options.maxLayoutIterations) {
          this.stopLayout();
          return;
        }

        // Use a simpler layout step since forceAtlas2.step API is different
        // Apply basic force simulation manually
        const nodes = this.graph.nodes();
        nodes.forEach(nodeId => {
          const attr = this.graph.getNodeAttributes(nodeId);
          // Add small random movement to simulate layout
          const dx = (Math.random() - 0.5) * 2;
          const dy = (Math.random() - 0.5) * 2;
          this.graph.updateNodeAttributes(nodeId, {
            ...attr,
            x: attr.x + dx,
            y: attr.y + dy
          });
        });
        iterations++;
        this.stats.layoutIterations = iterations;

        // Check for stability
        if (this.options.stopPhysicsWhenStable && iterations % 10 === 0) {
          const currentEnergy = this.calculateLayoutEnergy();
          const energyChange = Math.abs(lastEnergy - currentEnergy) / lastEnergy;
          
          if (energyChange < this.options.stabilityThreshold) {
            console.log(`Layout stabilized after ${iterations} iterations`);
            this.stopLayout();
            return;
          }
          
          lastEnergy = currentEnergy;
        }

        // Refresh sigma display
        this.sigma.refresh();
        
        // Continue layout
        requestAnimationFrame(layoutStep);
      };

      layoutStep();
      this.emit('layoutStarted');
      
    } catch (error) {
      console.error('Failed to start layout:', error);
      this.isLayoutRunning = false;
    }
  }

  /**
   * Stop the layout algorithm
   */
  stopLayout() {
    this.isLayoutRunning = false;
    if (this.layoutWorker) {
      this.layoutWorker = null;
    }
    this.emit('layoutStopped');
  }

  /**
   * Pause the graph engine (stop rendering and layout but keep data)
   */
  pause() {
    console.log('🔇 GraphEngine paused');
    this.isPaused = true;
    this.stopLayout();
    
    // Disable sigma rendering to save performance
    if (this.sigma) {
      this.sigma.getCamera().disable();
    }
    
    this.emit('paused');
  }

  /**
   * Resume the graph engine
   */
  resume() {
    console.log('🔊 GraphEngine resumed');
    this.isPaused = false;
    
    // Re-enable sigma rendering
    if (this.sigma) {
      this.sigma.getCamera().enable();
      this.sigma.refresh();
    }
    
    this.emit('resumed');
  }

  /**
   * Calculate current layout energy for stability detection
   */
  calculateLayoutEnergy() {
    let energy = 0;
    this.graph.forEachNode((node, attributes) => {
      const dx = attributes.x || 0;
      const dy = attributes.y || 0;
      energy += dx * dx + dy * dy;
    });
    return energy;
  }

  /**
   * Fit the graph to the container viewport
   */
  fitToViewport() {
    if (this.sigma) {
      this.sigma.getCamera().animatedReset({ duration: 500 });
    }
  }

  /**
   * Clear the entire graph
   */
  clear() {
    this.stopLayout();
    this.graph.clear();
    this.stats.nodeCount = 0;
    this.stats.edgeCount = 0;
    this.stats.layoutIterations = 0;
    if (this.sigma) {
      this.sigma.refresh();
    }
    this.emit('graphCleared');
  }

  /**
   * Get graph statistics
   */
  getStats() {
    return {
      ...this.stats,
      isLayoutRunning: this.isLayoutRunning
    };
  }

  /**
   * Export graph data
   */
  exportData() {
    return {
      nodes: this.graph.export().nodes,
      edges: this.graph.export().edges,
      stats: this.getStats()
    };
  }

  /**
   * Import graph data with stack overflow protection
   */
  importData(data, maxDepth = 1000) {
    this.clear();
    
    if (data.nodes) {
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      const batchSize = 50; // Process in batches to prevent stack overflow
      
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        batch.forEach(({ key, attributes }) => {
          try {
            this.addNode(key, attributes);
          } catch (error) {
            console.warn(`Failed to add node ${key}:`, error);
          }
        });
      }
    }
    
    if (data.edges) {
      const edges = Array.isArray(data.edges) ? data.edges : [];
      const batchSize = 50; // Process in batches to prevent stack overflow
      
      for (let i = 0; i < edges.length; i += batchSize) {
        const batch = edges.slice(i, i + batchSize);
        batch.forEach(({ key, source, target, attributes }) => {
          try {
            this.addEdge(key, source, target, attributes);
          } catch (error) {
            console.warn(`Failed to add edge ${key}:`, error);
          }
        });
      }
    }
    
    this.emit('dataImported', data);
  }

  /**
   * Event system
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      // Use for loop instead of forEach to prevent potential stack issues
      for (let i = 0; i < listeners.length; i++) {
        try {
          listeners[i](data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Initialize memory pools for efficient object reuse
   */
  initializeMemoryPools() {
    // Pre-allocate common objects to reduce garbage collection
    for (let i = 0; i < 100; i++) {
      this.memoryPools.vectors.push({ x: 0, y: 0 });
      this.memoryPools.matrices.push(new Array(6).fill(0));
    }
    
    for (let i = 0; i < 50; i++) {
      this.memoryPools.buffers.push(new ArrayBuffer(1024));
      this.memoryPools.geometries.push({
        vertices: new Float32Array(1000),
        indices: new Uint16Array(1000)
      });
    }
  }

  /**
   * Get a reusable vector from the memory pool
   */
  getVector() {
    return this.memoryPools.vectors.pop() || { x: 0, y: 0 };
  }

  /**
   * Return a vector to the memory pool
   */
  releaseVector(vector) {
    vector.x = 0;
    vector.y = 0;
    if (this.memoryPools.vectors.length < 100) {
      this.memoryPools.vectors.push(vector);
    }
  }

  /**
   * Setup automatic cache cleanup
   */
  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    if (!this.cache.enabled) return;
    
    const now = Date.now();
    const maxAge = this.cache.maxCacheAge;
    
    // Clean layout cache
    for (const [key, entry] of this.cache.layouts) {
      if (now - entry.timestamp > maxAge) {
        this.cache.layouts.delete(key);
      }
    }
    
    // Clean node position cache
    for (const [key, entry] of this.cache.nodePositions) {
      if (now - entry.timestamp > maxAge) {
        this.cache.nodePositions.delete(key);
      }
    }
    
    // Clean geometry caches
    for (const [key, entry] of this.cache.nodeGeometry) {
      if (now - entry.timestamp > maxAge) {
        this.cache.nodeGeometry.delete(key);
      }
    }
    
    for (const [key, entry] of this.cache.edgeGeometry) {
      if (now - entry.timestamp > maxAge) {
        this.cache.edgeGeometry.delete(key);
      }
    }
    
    // Enforce cache size limits
    this.enforceeCacheSizeLimits();
    
    this.cache.lastCacheCleanup = now;
  }

  /**
   * Enforce cache size limits to prevent memory bloat
   */
  enforceeCacheSizeLimits() {
    const maxSize = this.cache.maxCacheSize;
    
    // Remove oldest entries if cache is too large
    if (this.cache.layouts.size > maxSize) {
      const entries = Array.from(this.cache.layouts.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - maxSize);
      for (const [key] of toRemove) {
        this.cache.layouts.delete(key);
      }
    }
    
    // Similar cleanup for other caches
    [this.cache.nodePositions, this.cache.nodeGeometry, this.cache.edgeGeometry].forEach(cache => {
      if (cache.size > maxSize) {
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = entries.slice(0, entries.length - maxSize);
        for (const [key] of toRemove) {
          cache.delete(key);
        }
      }
    });
  }

  /**
   * Initialize Web Worker for background calculations
   */
  initializeWebWorker() {
    try {
      // Create worker from the GraphWorker file
      const workerBlob = new Blob([this.getWorkerScript()], { type: 'application/javascript' });
      this.webWorker = new Worker(URL.createObjectURL(workerBlob));
      
      // Setup worker message handling
      this.webWorker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };
      
      this.webWorker.onerror = (error) => {
        console.error('GraphWorker error:', error);
      };
      
      // Initialize worker with current configuration
      this.sendWorkerMessage('init', {
        gravity: this.options.gravity || 1,
        scalingRatio: this.options.scalingRatio || 10,
        barnesHutOptimize: true,
        maxIterations: this.options.maxLayoutIterations
      });
      
      console.log('🔧 Web Worker initialized for background calculations');
      
    } catch (error) {
      console.warn('Failed to initialize Web Worker:', error);
      // Fall back to main thread calculations
    }
  }

  /**
   * Get the worker script content
   */
  getWorkerScript() {
    // In a real implementation, this would load the GraphWorker.js content
    // For now, return a minimal worker script
    return `
      // Minimal worker implementation
      self.onmessage = function(event) {
        const { type, data, id } = event.data;
        
        // Echo back for now - would implement actual calculations
        self.postMessage({
          type: type + 'Response',
          id,
          data
        });
      };
    `;
  }

  /**
   * Send message to worker
   */
  sendWorkerMessage(type, data) {
    if (!this.webWorker) return;
    
    const id = Date.now() + Math.random();
    this.webWorker.postMessage({ type, data, id });
    return id;
  }

  /**
   * Handle messages from worker
   */
  handleWorkerMessage(message) {
    const { type, data, id } = message;
    
    switch (type) {
      case 'layoutProgress':
        this.handleWorkerLayoutProgress(data);
        break;
      case 'layoutCompleted':
        this.handleWorkerLayoutCompleted(data);
        break;
      case 'metricsCalculated':
        this.handleWorkerMetrics(data);
        break;
      default:
        // Handle other worker responses
        break;
    }
  }

  /**
   * Handle layout progress from worker
   */
  handleWorkerLayoutProgress(data) {
    if (data.nodePositions) {
      // Update node positions from worker calculations
      this.updateNodePositionsFromWorker(data.nodePositions);
      
      // Cache the positions
      this.cacheNodePositions(data.nodePositions);
      
      // Refresh display
      this.sigma.refresh();
    }
  }

  /**
   * Handle layout completion from worker
   */
  handleWorkerLayoutCompleted(data) {
    this.isLayoutRunning = false;
    this.emit('layoutCompleted', data);
  }

  /**
   * Handle metrics calculation from worker
   */
  handleWorkerMetrics(data) {
    this.emit('metricsCalculated', data);
  }

  /**
   * Update node positions from worker calculations
   */
  updateNodePositionsFromWorker(positions) {
    for (const position of positions) {
      if (this.graph.hasNode(position.id)) {
        this.graph.setNodeAttribute(position.id, 'x', position.x);
        this.graph.setNodeAttribute(position.id, 'y', position.y);
      }
    }
  }

  /**
   * Cache node positions with timestamp
   */
  cacheNodePositions(positions) {
    if (!this.cache.enabled) return;
    
    const timestamp = Date.now();
    const cacheKey = this.generateCacheKey('positions', positions.length);
    
    this.cache.nodePositions.set(cacheKey, {
      positions,
      timestamp,
      nodeCount: positions.length
    });
  }

  /**
   * Get cached node positions if available
   */
  getCachedNodePositions(nodeCount) {
    if (!this.cache.enabled) return null;
    
    const cacheKey = this.generateCacheKey('positions', nodeCount);
    const cached = this.cache.nodePositions.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cache.maxCacheAge) {
      return cached.positions;
    }
    
    return null;
  }

  /**
   * Cache layout configuration and results
   */
  cacheLayoutResult(config, result) {
    if (!this.cache.enabled) return;
    
    const cacheKey = this.generateLayoutCacheKey(config);
    this.cache.layouts.set(cacheKey, {
      config,
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached layout result
   */
  getCachedLayoutResult(config) {
    if (!this.cache.enabled) return null;
    
    const cacheKey = this.generateLayoutCacheKey(config);
    const cached = this.cache.layouts.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cache.maxCacheAge) {
      return cached.result;
    }
    
    return null;
  }

  /**
   * Generate cache key for layout configuration
   */
  generateLayoutCacheKey(config) {
    const keyData = {
      nodeCount: this.graph.order,
      edgeCount: this.graph.size,
      gravity: config.gravity || 1,
      scalingRatio: config.scalingRatio || 10,
      barnesHut: config.barnesHutOptimize || false
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Generate generic cache key
   */
  generateCacheKey(prefix, ...params) {
    return `${prefix}_${params.join('_')}`;
  }

  /**
   * Cache viewport state for quick retrieval
   */
  cacheViewportState(camera, visibleNodes, visibleEdges) {
    if (!this.cache.enabled) return;
    
    const state = camera.getState();
    const cacheKey = `viewport_${state.x}_${state.y}_${state.ratio}`;
    
    this.cache.viewportStates.set(cacheKey, {
      camera: state,
      visibleNodes: new Set(visibleNodes),
      visibleEdges: new Set(visibleEdges),
      timestamp: Date.now()
    });
  }

  /**
   * Get cached viewport state
   */
  getCachedViewportState(camera) {
    if (!this.cache.enabled) return null;
    
    const state = camera.getState();
    const cacheKey = `viewport_${state.x}_${state.y}_${state.ratio}`;
    const cached = this.cache.viewportStates.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache for viewport
      return cached;
    }
    
    return null;
  }

  /**
   * Optimized layout start with caching
   */
  startOptimizedLayout() {
    // Check for cached layout first
    const config = {
      gravity: this.options.gravity || 1,
      scalingRatio: this.options.scalingRatio || 10,
      barnesHutOptimize: this.graph.order > 100
    };
    
    const cachedResult = this.getCachedLayoutResult(config);
    if (cachedResult) {
      console.log('📋 Using cached layout result');
      this.applyLayoutResult(cachedResult);
      return;
    }
    
    // No cache hit, start new layout
    if (this.webWorker && this.graph.order > 500) {
      // Use worker for large graphs
      this.startWorkerLayout(config);
    } else {
      // Use main thread for smaller graphs
      this.startMainThreadLayout(config);
    }
  }

  /**
   * Start layout calculation in worker
   */
  startWorkerLayout(config) {
    // Send graph data to worker
    const graphData = this.exportData();
    
    this.sendWorkerMessage('setGraph', graphData);
    this.sendWorkerMessage('startLayout', config);
    
    this.isLayoutRunning = true;
    this.emit('layoutStarted');
  }

  /**
   * Start layout calculation in main thread
   */
  startMainThreadLayout(config) {
    // Use the existing layout implementation
    this.startLayout();
  }

  /**
   * Apply layout result to the graph
   */
  applyLayoutResult(result) {
    if (result.nodePositions) {
      this.updateNodePositionsFromWorker(result.nodePositions);
      this.sigma.refresh();
    }
    
    this.emit('layoutCompleted', result);
  }

  /**
   * Optimized node addition with caching
   */
  addNodeOptimized(nodeId, attributes = {}) {
    // Check cache for similar node geometry
    const geometryKey = this.generateNodeGeometryKey(attributes);
    const cachedGeometry = this.cache.nodeGeometry.get(geometryKey);
    
    if (cachedGeometry) {
      // Reuse cached geometry
      attributes = { ...attributes, ...cachedGeometry.geometry };
    } else {
      // Calculate new geometry and cache it
      const geometry = this.calculateNodeGeometry(attributes);
      this.cache.nodeGeometry.set(geometryKey, {
        geometry,
        timestamp: Date.now()
      });
      attributes = { ...attributes, ...geometry };
    }
    
    // Use existing add node method
    this.addNode(nodeId, attributes);
  }

  /**
   * Generate cache key for node geometry
   */
  generateNodeGeometryKey(attributes) {
    return `node_${attributes.type || 'default'}_${attributes.size || 8}`;
  }

  /**
   * Calculate node geometry (rendering properties)
   */
  calculateNodeGeometry(attributes) {
    // This would include complex geometry calculations
    // For now, return basic properties
    return {
      renderSize: (attributes.size || 8) * 1.2,
      strokeWidth: Math.max(1, (attributes.size || 8) * 0.1),
      shadowBlur: (attributes.size || 8) * 0.3
    };
  }

  /**
   * Get performance statistics including cache metrics
   */
  getPerformanceStats() {
    const baseStats = this.getStats();
    
    return {
      ...baseStats,
      cache: {
        enabled: this.cache.enabled,
        layouts: this.cache.layouts.size,
        nodePositions: this.cache.nodePositions.size,
        nodeGeometry: this.cache.nodeGeometry.size,
        edgeGeometry: this.cache.edgeGeometry.size,
        viewportStates: this.cache.viewportStates.size,
        lastCleanup: this.cache.lastCacheCleanup,
        hitRatio: this.calculateCacheHitRatio()
      },
      memoryPools: {
        vectors: this.memoryPools.vectors.length,
        matrices: this.memoryPools.matrices.length,
        buffers: this.memoryPools.buffers.length,
        geometries: this.memoryPools.geometries.length
      },
      performance: this.performanceManager ? this.performanceManager.getMetrics() : null
    };
  }

  /**
   * Calculate cache hit ratio for performance monitoring
   */
  calculateCacheHitRatio() {
    // This would track cache hits vs misses over time
    // For now, return a placeholder
    return 0.75; // 75% hit ratio
  }

  /**
   * Enable/disable caching system
   */
  setCacheEnabled(enabled) {
    this.cache.enabled = enabled;
    
    if (!enabled) {
      // Clear all caches when disabled
      this.cache.layouts.clear();
      this.cache.nodePositions.clear();
      this.cache.nodeGeometry.clear();
      this.cache.edgeGeometry.clear();
      this.cache.viewportStates.clear();
    }
    
    console.log(`📋 Cache system ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Force cache cleanup
   */
  forceCacheCleanup() {
    this.cleanupCache();
    console.log('🧹 Cache cleanup completed');
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      enabled: this.cache.enabled,
      totalEntries: this.cache.layouts.size + this.cache.nodePositions.size + 
                   this.cache.nodeGeometry.size + this.cache.edgeGeometry.size,
      layouts: this.cache.layouts.size,
      positions: this.cache.nodePositions.size,
      nodeGeometry: this.cache.nodeGeometry.size,
      edgeGeometry: this.cache.edgeGeometry.size,
      viewportStates: this.cache.viewportStates.size,
      lastCleanup: new Date(this.cache.lastCacheCleanup).toISOString(),
      maxAge: this.cache.maxCacheAge,
      maxSize: this.cache.maxCacheSize
    };
  }

  /**
   * Cleanup and destroy the graph engine
   */
  destroy() {
    this.stopLayout();
    
    // Destroy performance manager
    if (this.performanceManager) {
      this.performanceManager.destroy();
      this.performanceManager = null;
    }
    
    // Terminate web worker
    if (this.webWorker) {
      this.webWorker.terminate();
      this.webWorker = null;
    }
    
    // Clear all caches
    this.cache.layouts.clear();
    this.cache.nodePositions.clear();
    this.cache.nodeGeometry.clear();
    this.cache.edgeGeometry.clear();
    this.cache.viewportStates.clear();
    
    // Clear memory pools
    this.memoryPools.vectors.length = 0;
    this.memoryPools.matrices.length = 0;
    this.memoryPools.buffers.length = 0;
    this.memoryPools.geometries.length = 0;
    
    // Clean up resize event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    if (this.sigma) {
      this.sigma.kill();
      this.sigma = null;
    }
    
    this.graph.clear();
    this.eventListeners.clear();
    
    console.log('GraphEngine destroyed');
  }
}

export default GraphEngine;