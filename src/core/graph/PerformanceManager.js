/**
 * PerformanceManager - Advanced performance optimizations for graph visualization
 * 
 * Features:
 * - Level of Detail (LOD) rendering based on zoom level
 * - Viewport culling for massive graphs (10,000+ nodes)
 * - Physics simulation optimizations with Barnes-Hut
 * - Real-time performance monitoring and auto-adjustment
 * - Memory management and garbage collection optimization
 * - Progressive rendering for smooth interactions
 */
export class PerformanceManager {
  constructor(graphEngine) {
    this.engine = graphEngine;
    this.sigma = graphEngine.sigma;
    this.graph = graphEngine.graph;
    
    // Performance targets
    this.targetFPS = 60;
    this.frameTime = 1000 / this.targetFPS;
    this.minFrameTime = 1000 / 30; // Fallback to 30 FPS
    
    // Performance metrics
    this.metrics = {
      fps: 60,
      frameTime: 0,
      renderTime: 0,
      visibleNodes: 0,
      visibleEdges: 0,
      memoryUsage: 0,
      lastFrameTimestamp: performance.now(),
      frameCount: 0,
      droppedFrames: 0
    };
    
    // Level of Detail settings
    this.lodSettings = {
      // Zoom thresholds for different detail levels
      highDetailZoom: 1.0,    // Show everything
      mediumDetailZoom: 0.5,  // Hide labels, simplify edges
      lowDetailZoom: 0.2,     // Only show major nodes
      cullingZoom: 0.1,       // Aggressive culling
      
      // Node count thresholds for auto-adjustment
      highPerformanceNodeCount: 1000,
      mediumPerformanceNodeCount: 5000,
      lowPerformanceNodeCount: 10000
    };
    
    // Viewport culling
    this.viewportCulling = {
      enabled: true,
      margin: 0.2, // 20% margin around viewport
      lastCullTime: 0,
      cullInterval: 100, // Recalculate every 100ms
      visibleNodeIds: new Set(),
      visibleEdgeIds: new Set()
    };
    
    // Physics optimization
    this.physicsOptimization = {
      enabled: true,
      stabilityThreshold: 0.005,
      maxIterationsPerFrame: 10,
      adaptiveIterations: true,
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      simulationPaused: false,
      lastStabilityCheck: 0,
      stabilityCheckInterval: 1000,
      consecutiveStableFrames: 0,
      requiredStableFrames: 10
    };
    
    // Memory management
    this.memoryManagement = {
      enabled: true,
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      cacheCleanupInterval: 30000, // 30 seconds
      lastCleanup: Date.now(),
      renderBufferPool: [],
      geometryCache: new Map(),
      textureCache: new Map()
    };
    
    // Progressive rendering
    this.progressiveRendering = {
      enabled: true,
      chunkSize: 100, // Render 100 nodes per frame
      currentChunk: 0,
      totalChunks: 0,
      renderQueue: [],
      priority: new Map() // Node priority for rendering
    };
    
    // Auto-adjustment settings
    this.autoAdjustment = {
      enabled: true,
      adjustmentInterval: 5000, // Check every 5 seconds
      lastAdjustment: Date.now(),
      performanceHistory: [],
      historySize: 10,
      degradationThreshold: 0.8, // Adjust if performance drops below 80%
      improvementThreshold: 1.2  // Increase quality if performance is 120% of target
    };
    
    // Event listeners
    this.boundUpdatePerformance = this.updatePerformanceMetrics.bind(this);
    this.boundHandleCameraUpdate = this.handleCameraUpdate.bind(this);
    this.boundRenderFrame = this.renderFrame.bind(this);
    
    // Prevent recursive rendering
    this.isRendering = false;
    
    this.initialize();
  }

  /**
   * Initialize performance optimization systems
   */
  initialize() {
    console.log('🚀 Initializing PerformanceManager...');
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
    
    // Enable level of detail
    this.enableLevelOfDetail();
    
    // Enable viewport culling
    this.enableViewportCulling();
    
    // Enable physics optimizations
    this.enablePhysicsOptimizations();
    
    // Setup memory management
    this.setupMemoryManagement();
    
    // Enable progressive rendering
    this.enableProgressiveRendering();
    
    // Start auto-adjustment
    this.startAutoAdjustment();
    
    console.log('✅ PerformanceManager initialized');
  }

  /**
   * Enable Level of Detail rendering
   */
  enableLevelOfDetail() {
    if (!this.sigma) return;
    
    // Override node renderer with LOD
    const originalNodeRenderer = this.sigma.getSetting('nodeRenderer');
    
    this.sigma.setSetting('nodeRenderer', (context, data, settings) => {
      const zoomRatio = settings.zoomRatio;
      const nodeCount = this.graph.order;
      
      // Determine detail level
      const detailLevel = this.getDetailLevel(zoomRatio, nodeCount);
      
      // Apply LOD optimizations
      this.renderNodeWithLOD(context, data, settings, detailLevel);
    });
    
    // Override edge renderer with LOD
    this.sigma.setSetting('edgeRenderer', (context, data, settings) => {
      const zoomRatio = settings.zoomRatio;
      const nodeCount = this.graph.order;
      
      // Determine detail level
      const detailLevel = this.getDetailLevel(zoomRatio, nodeCount);
      
      // Apply LOD optimizations
      this.renderEdgeWithLOD(context, data, settings, detailLevel);
    });
    
    console.log('📊 Level of Detail enabled');
  }

  /**
   * Determine the appropriate detail level based on zoom and node count
   */
  getDetailLevel(zoomRatio, nodeCount) {
    if (nodeCount > this.lodSettings.lowPerformanceNodeCount) {
      return zoomRatio > this.lodSettings.mediumDetailZoom ? 'medium' : 'low';
    } else if (nodeCount > this.lodSettings.mediumPerformanceNodeCount) {
      return zoomRatio > this.lodSettings.highDetailZoom ? 'high' : 'medium';
    } else if (nodeCount > this.lodSettings.highPerformanceNodeCount) {
      return zoomRatio > this.lodSettings.highDetailZoom ? 'high' : 'medium';
    }
    
    return 'high'; // Full quality for small graphs
  }

  /**
   * Render node with Level of Detail optimizations
   */
  renderNodeWithLOD(context, data, settings, detailLevel) {
    const { x, y, size, color, label, type } = data;
    
    // Skip rendering if node is outside viewport (handled by culling)
    if (!this.isNodeInViewport(x, y, size, settings)) {
      return;
    }
    
    // Adjust rendering based on detail level
    let actualSize = size;
    let showLabel = true;
    let useComplexShape = true;
    
    switch (detailLevel) {
      case 'low':
        actualSize = Math.max(2, size * 0.5);
        showLabel = false;
        useComplexShape = false;
        break;
      case 'medium':
        actualSize = Math.max(3, size * 0.75);
        showLabel = size > 8; // Only show labels for larger nodes
        useComplexShape = size > 6;
        break;
      case 'high':
        // Full quality rendering
        break;
    }
    
    // Draw node
    context.fillStyle = color;
    context.beginPath();
    
    if (useComplexShape && type !== 'default') {
      // Complex shapes for high detail
      switch (type) {
        case 'folder':
          context.fillRect(x - actualSize, y - actualSize, actualSize * 2, actualSize * 2);
          break;
        case 'tag':
          context.moveTo(x, y - actualSize);
          context.lineTo(x + actualSize, y);
          context.lineTo(x, y + actualSize);
          context.lineTo(x - actualSize, y);
          context.closePath();
          context.fill();
          break;
        default:
          context.arc(x, y, actualSize, 0, Math.PI * 2);
          context.fill();
      }
    } else {
      // Simple circle for all nodes in low detail
      context.arc(x, y, actualSize, 0, Math.PI * 2);
      context.fill();
    }
    
    // Draw label if appropriate
    if (showLabel && label && detailLevel !== 'low') {
      const fontSize = Math.max(8, actualSize * 0.6);
      context.fillStyle = '#333';
      context.font = `${fontSize}px Arial`;
      context.textAlign = 'center';
      context.fillText(label, x, y + actualSize + fontSize);
    }
  }

  /**
   * Render edge with Level of Detail optimizations
   */
  renderEdgeWithLOD(context, data, settings, detailLevel) {
    const { source, target, size, color, type } = data;
    
    // Get node positions
    const sourceData = this.graph.getNodeAttributes(source);
    const targetData = this.graph.getNodeAttributes(target);
    
    // Skip if either node is culled
    if (!this.isNodeInViewport(sourceData.x, sourceData.y, sourceData.size, settings) &&
        !this.isNodeInViewport(targetData.x, targetData.y, targetData.size, settings)) {
      return;
    }
    
    // Adjust rendering based on detail level
    let actualSize = size || 1;
    let useComplexStyle = true;
    
    switch (detailLevel) {
      case 'low':
        if (actualSize < 2) return; // Skip thin edges in low detail
        actualSize = Math.max(1, actualSize * 0.5);
        useComplexStyle = false;
        break;
      case 'medium':
        if (actualSize < 1.5) return;
        actualSize = Math.max(1, actualSize * 0.75);
        useComplexStyle = actualSize > 2;
        break;
      case 'high':
        // Full quality rendering
        break;
    }
    
    context.strokeStyle = color || '#d1d5db';
    context.lineWidth = actualSize;
    
    // Apply line style only in high/medium detail
    if (useComplexStyle && type === 'weak') {
      context.setLineDash([5, 5]);
    } else {
      context.setLineDash([]);
    }
    
    context.beginPath();
    context.moveTo(sourceData.x, sourceData.y);
    context.lineTo(targetData.x, targetData.y);
    context.stroke();
  }

  /**
   * Enable viewport culling for massive graphs
   */
  enableViewportCulling() {
    if (!this.sigma) return;
    
    // Set up camera event listener
    this.sigma.getCamera().on('updated', this.boundHandleCameraUpdate);
    
    // Initial culling calculation
    this.updateViewportCulling();
    
    console.log('🔍 Viewport culling enabled');
  }

  /**
   * Handle camera updates for viewport culling
   */
  handleCameraUpdate() {
    const now = performance.now();
    if (now - this.viewportCulling.lastCullTime > this.viewportCulling.cullInterval) {
      this.updateViewportCulling();
      this.viewportCulling.lastCullTime = now;
    }
  }

  /**
   * Update viewport culling calculations
   */
  updateViewportCulling() {
    if (!this.viewportCulling.enabled || !this.sigma) return;
    
    const camera = this.sigma.getCamera();
    const { x, y, ratio } = camera.getState();
    const { width, height } = this.sigma.getDimensions();
    
    // Calculate viewport bounds with margin
    const margin = this.viewportCulling.margin;
    const viewportWidth = width * ratio * (1 + margin);
    const viewportHeight = height * ratio * (1 + margin);
    
    const left = x - viewportWidth / 2;
    const right = x + viewportWidth / 2;
    const top = y - viewportHeight / 2;
    const bottom = y + viewportHeight / 2;
    
    // Update visible nodes
    this.viewportCulling.visibleNodeIds.clear();
    this.viewportCulling.visibleEdgeIds.clear();
    
    this.graph.forEachNode((nodeId, attributes) => {
      if (this.isPointInBounds(attributes.x, attributes.y, left, right, top, bottom)) {
        this.viewportCulling.visibleNodeIds.add(nodeId);
      }
    });
    
    // Update visible edges (only if both nodes are visible or one is in viewport)
    this.graph.forEachEdge((edgeId, attributes, source, target) => {
      const sourceVisible = this.viewportCulling.visibleNodeIds.has(source);
      const targetVisible = this.viewportCulling.visibleNodeIds.has(target);
      
      if (sourceVisible || targetVisible) {
        this.viewportCulling.visibleEdgeIds.add(edgeId);
      }
    });
    
    // Update metrics
    this.metrics.visibleNodes = this.viewportCulling.visibleNodeIds.size;
    this.metrics.visibleEdges = this.viewportCulling.visibleEdgeIds.size;
  }

  /**
   * Check if a point is within the viewport bounds
   */
  isPointInBounds(x, y, left, right, top, bottom) {
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  /**
   * Check if a node is in the current viewport
   */
  isNodeInViewport(x, y, size, settings) {
    if (!this.viewportCulling.enabled) return true;
    
    const camera = this.sigma.getCamera();
    const { x: cameraX, y: cameraY, ratio } = camera.getState();
    const { width, height } = this.sigma.getDimensions();
    
    const margin = this.viewportCulling.margin;
    const viewportWidth = width * ratio * (1 + margin);
    const viewportHeight = height * ratio * (1 + margin);
    
    const left = cameraX - viewportWidth / 2;
    const right = cameraX + viewportWidth / 2;
    const top = cameraY - viewportHeight / 2;
    const bottom = cameraY + viewportHeight / 2;
    
    // Check if node (with its size) intersects with viewport
    return (x + size >= left && x - size <= right && 
            y + size >= top && y - size <= bottom);
  }

  /**
   * Enable physics simulation optimizations
   */
  enablePhysicsOptimizations() {
    if (!this.engine.isLayoutRunning) return;
    
    // Override the layout step function with optimizations
    const originalStartLayout = this.engine.startLayout.bind(this.engine);
    
    this.engine.startLayout = () => {
      this.startOptimizedLayout();
    };
    
    console.log('⚡ Physics optimizations enabled');
  }

  /**
   * Start optimized layout with Barnes-Hut and stability detection
   */
  startOptimizedLayout() {
    if (this.engine.isLayoutRunning) return;
    
    const nodeCount = this.graph.order;
    
    // Configure optimized ForceAtlas2 settings
    const settings = {
      iterations: this.engine.options.maxLayoutIterations,
      settings: {
        gravity: this.calculateOptimalGravity(nodeCount),
        strongGravityMode: nodeCount > 1000,
        scalingRatio: this.calculateOptimalScaling(nodeCount),
        slowDown: 1,
        barnesHutOptimize: this.physicsOptimization.barnesHutOptimize && nodeCount > 100,
        barnesHutTheta: this.physicsOptimization.barnesHutTheta,
        linLogMode: nodeCount > 5000, // Better for large graphs
        outboundAttractionDistribution: false,
        adjustSizes: false
      }
    };
    
    this.engine.isLayoutRunning = true;
    this.physicsOptimization.simulationPaused = false;
    
    let iterations = 0;
    let lastEnergy = Infinity;
    let energyHistory = [];
    
    const optimizedLayoutStep = () => {
      if (!this.engine.isLayoutRunning || this.physicsOptimization.simulationPaused) {
        return;
      }
      
      const frameStart = performance.now();
      
      // Adaptive iteration count based on performance
      const maxIterationsThisFrame = this.calculateAdaptiveIterations();
      
      for (let i = 0; i < maxIterationsThisFrame && iterations < settings.iterations; i++) {
        // Perform layout step
        // Note: This would integrate with the actual ForceAtlas2 implementation
        iterations++;
      }
      
      // Check for stability every interval
      const now = performance.now();
      if (now - this.physicsOptimization.lastStabilityCheck > this.physicsOptimization.stabilityCheckInterval) {
        const currentEnergy = this.engine.calculateLayoutEnergy();
        energyHistory.push(currentEnergy);
        
        if (energyHistory.length > 5) {
          energyHistory.shift();
          
          // Check for stability
          const avgEnergy = energyHistory.reduce((a, b) => a + b) / energyHistory.length;
          const energyVariance = energyHistory.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / energyHistory.length;
          const stabilityRatio = Math.sqrt(energyVariance) / avgEnergy;
          
          if (stabilityRatio < this.physicsOptimization.stabilityThreshold) {
            this.physicsOptimization.consecutiveStableFrames++;
            
            if (this.physicsOptimization.consecutiveStableFrames >= this.physicsOptimization.requiredStableFrames) {
              console.log(`🎯 Layout stabilized after ${iterations} iterations (stability: ${stabilityRatio.toFixed(4)})`);
              this.engine.stopLayout();
              return;
            }
          } else {
            this.physicsOptimization.consecutiveStableFrames = 0;
          }
        }
        
        this.physicsOptimization.lastStabilityCheck = now;
      }
      
      // Update performance metrics
      const frameTime = performance.now() - frameStart;
      this.updateLayoutPerformance(frameTime);
      
      // Refresh display if not in progressive mode
      if (!this.progressiveRendering.enabled) {
        this.sigma.refresh();
      }
      
      // Continue layout
      if (iterations < settings.iterations) {
        requestAnimationFrame(optimizedLayoutStep);
      } else {
        this.engine.stopLayout();
      }
    };
    
    // Start the optimized layout
    optimizedLayoutStep();
    this.engine.emit('layoutStarted');
  }

  /**
   * Calculate optimal gravity based on node count
   */
  calculateOptimalGravity(nodeCount) {
    if (nodeCount < 100) return 1;
    if (nodeCount < 1000) return 0.5;
    if (nodeCount < 5000) return 0.2;
    return 0.1;
  }

  /**
   * Calculate optimal scaling based on node count
   */
  calculateOptimalScaling(nodeCount) {
    if (nodeCount < 100) return 10;
    if (nodeCount < 1000) return 20;
    if (nodeCount < 5000) return 50;
    return 100;
  }

  /**
   * Calculate adaptive iteration count based on current performance
   */
  calculateAdaptiveIterations() {
    if (!this.physicsOptimization.adaptiveIterations) {
      return this.physicsOptimization.maxIterationsPerFrame;
    }
    
    const currentFPS = this.metrics.fps;
    const targetFPS = this.targetFPS;
    
    if (currentFPS < targetFPS * 0.8) {
      // Performance is poor, reduce iterations
      return Math.max(1, Math.floor(this.physicsOptimization.maxIterationsPerFrame * 0.5));
    } else if (currentFPS > targetFPS * 1.1) {
      // Performance is good, can increase iterations
      return Math.min(20, Math.floor(this.physicsOptimization.maxIterationsPerFrame * 1.5));
    }
    
    return this.physicsOptimization.maxIterationsPerFrame;
  }

  /**
   * Setup memory management system
   */
  setupMemoryManagement() {
    // Initialize buffer pools
    this.memoryManagement.renderBufferPool = [];
    
    // Setup periodic cleanup
    setInterval(() => {
      this.cleanupMemory();
    }, this.memoryManagement.cacheCleanupInterval);
    
    console.log('🧹 Memory management enabled');
  }

  /**
   * Clean up memory caches and unused resources
   */
  cleanupMemory() {
    const now = Date.now();
    
    // Clean geometry cache
    for (const [key, { lastUsed, data }] of this.memoryManagement.geometryCache) {
      if (now - lastUsed > 60000) { // 1 minute
        this.memoryManagement.geometryCache.delete(key);
      }
    }
    
    // Clean texture cache
    for (const [key, { lastUsed, texture }] of this.memoryManagement.textureCache) {
      if (now - lastUsed > 120000) { // 2 minutes
        // Clean up WebGL texture if applicable
        if (texture && texture.dispose) {
          texture.dispose();
        }
        this.memoryManagement.textureCache.delete(key);
      }
    }
    
    // Update memory usage estimate
    this.updateMemoryUsage();
    
    this.memoryManagement.lastCleanup = now;
  }

  /**
   * Update memory usage estimate
   */
  updateMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Enable progressive rendering for massive graphs
   */
  enableProgressiveRendering() {
    if (!this.progressiveRendering.enabled) return;
    
    // Override sigma's render method
    if (this.sigma && this.sigma.render) {
      const originalRender = this.sigma.render.bind(this.sigma);
      
      this.sigma.render = () => {
        this.renderProgressively();
      };
    }
    
    console.log('🎨 Progressive rendering enabled');
  }

  /**
   * Render the graph progressively in chunks
   */
  renderProgressively() {
    // Prevent recursive calls
    if (this.isRendering) {
      return;
    }
    
    this.isRendering = true;
    
    try {
      const nodeCount = this.graph.order;
      
      if (nodeCount <= 1000) {
        // Use normal rendering for small graphs - but don't call refresh to prevent loop
        return;
      }
      
      // Setup progressive rendering
      if (this.progressiveRendering.renderQueue.length === 0) {
        this.setupRenderQueue();
      }
      
      // Render current chunk
      this.renderChunk();
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Setup the render queue with prioritized nodes
   */
  setupRenderQueue() {
    this.progressiveRendering.renderQueue = [];
    this.progressiveRendering.priority.clear();
    
    // Add all visible nodes to queue with priority
    this.graph.forEachNode((nodeId, attributes) => {
      if (this.viewportCulling.visibleNodeIds.has(nodeId) || !this.viewportCulling.enabled) {
        const priority = this.calculateNodePriority(nodeId, attributes);
        this.progressiveRendering.priority.set(nodeId, priority);
        this.progressiveRendering.renderQueue.push(nodeId);
      }
    });
    
    // Sort by priority (higher priority first)
    this.progressiveRendering.renderQueue.sort((a, b) => {
      return this.progressiveRendering.priority.get(b) - this.progressiveRendering.priority.get(a);
    });
    
    // Calculate chunks
    this.progressiveRendering.totalChunks = Math.ceil(
      this.progressiveRendering.renderQueue.length / this.progressiveRendering.chunkSize
    );
    this.progressiveRendering.currentChunk = 0;
  }

  /**
   * Calculate rendering priority for a node
   */
  calculateNodePriority(nodeId, attributes) {
    let priority = 0;
    
    // Higher priority for larger nodes
    priority += (attributes.size || 8) * 10;
    
    // Higher priority for nodes with more connections
    priority += this.graph.degree(nodeId) * 5;
    
    // Higher priority for highlighted nodes
    if (attributes.highlighted) {
      priority += 1000;
    }
    
    // Higher priority for nodes closer to center of viewport
    if (this.sigma) {
      const camera = this.sigma.getCamera();
      const { x: cameraX, y: cameraY } = camera.getState();
      const distance = Math.sqrt(
        Math.pow(attributes.x - cameraX, 2) + Math.pow(attributes.y - cameraY, 2)
      );
      priority += Math.max(0, 500 - distance); // Closer = higher priority
    }
    
    return priority;
  }

  /**
   * Render a single chunk of nodes
   */
  renderChunk() {
    const chunkStart = this.progressiveRendering.currentChunk * this.progressiveRendering.chunkSize;
    const chunkEnd = Math.min(chunkStart + this.progressiveRendering.chunkSize, this.progressiveRendering.renderQueue.length);
    
    const chunk = this.progressiveRendering.renderQueue.slice(chunkStart, chunkEnd);
    
    // Render this chunk (this would integrate with the actual rendering system)
    // For now, we'll just mark the chunk as processed
    
    this.progressiveRendering.currentChunk++;
    
    // Continue rendering if more chunks remain
    if (this.progressiveRendering.currentChunk < this.progressiveRendering.totalChunks) {
      requestAnimationFrame(() => this.renderChunk());
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor frame rate
    let lastFrameTime = performance.now();
    let frameCount = 0;
    
    const updateFPS = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastFrameTime >= 1000) {
        this.metrics.fps = frameCount;
        this.metrics.frameTime = (now - lastFrameTime) / frameCount;
        frameCount = 0;
        lastFrameTime = now;
        
        // Check for dropped frames
        if (this.metrics.frameTime > this.minFrameTime) {
          this.metrics.droppedFrames++;
        }
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    updateFPS();
    
    // Monitor memory usage periodically
    setInterval(() => {
      this.updateMemoryUsage();
    }, 5000);
    
    console.log('📊 Performance monitoring enabled');
  }

  /**
   * Update performance metrics after layout step
   */
  updateLayoutPerformance(frameTime) {
    this.metrics.renderTime = frameTime;
    
    // Add to performance history for auto-adjustment
    if (this.autoAdjustment.enabled) {
      this.autoAdjustment.performanceHistory.push({
        fps: this.metrics.fps,
        frameTime: frameTime,
        timestamp: Date.now()
      });
      
      // Keep only recent history
      if (this.autoAdjustment.performanceHistory.length > this.autoAdjustment.historySize) {
        this.autoAdjustment.performanceHistory.shift();
      }
    }
  }

  /**
   * Start auto-adjustment of quality settings
   */
  startAutoAdjustment() {
    if (!this.autoAdjustment.enabled) return;
    
    setInterval(() => {
      this.adjustQualitySettings();
    }, this.autoAdjustment.adjustmentInterval);
    
    console.log('🎛️ Auto quality adjustment enabled');
  }

  /**
   * Automatically adjust quality settings based on performance
   */
  adjustQualitySettings() {
    if (this.autoAdjustment.performanceHistory.length < 3) return;
    
    // Calculate average performance
    const avgFPS = this.autoAdjustment.performanceHistory.reduce((sum, p) => sum + p.fps, 0) / 
                   this.autoAdjustment.performanceHistory.length;
    
    const performanceRatio = avgFPS / this.targetFPS;
    
    if (performanceRatio < this.autoAdjustment.degradationThreshold) {
      // Performance is poor, reduce quality
      this.reduceQuality();
      console.log(`📉 Reducing quality due to poor performance (${avgFPS.toFixed(1)} FPS)`);
    } else if (performanceRatio > this.autoAdjustment.improvementThreshold) {
      // Performance is good, can increase quality
      this.increaseQuality();
      console.log(`📈 Increasing quality due to good performance (${avgFPS.toFixed(1)} FPS)`);
    }
    
    this.autoAdjustment.lastAdjustment = Date.now();
  }

  /**
   * Reduce quality settings to improve performance
   */
  reduceQuality() {
    // Reduce LOD thresholds
    this.lodSettings.highDetailZoom *= 1.2;
    this.lodSettings.mediumDetailZoom *= 1.2;
    this.lodSettings.lowDetailZoom *= 1.2;
    
    // Increase culling aggressiveness
    this.viewportCulling.margin = Math.max(0.1, this.viewportCulling.margin * 0.8);
    
    // Reduce physics iterations
    this.physicsOptimization.maxIterationsPerFrame = Math.max(1, 
      Math.floor(this.physicsOptimization.maxIterationsPerFrame * 0.8));
    
    // Reduce progressive rendering chunk size
    this.progressiveRendering.chunkSize = Math.max(25, 
      Math.floor(this.progressiveRendering.chunkSize * 0.8));
  }

  /**
   * Increase quality settings when performance allows
   */
  increaseQuality() {
    // Increase LOD thresholds
    this.lodSettings.highDetailZoom = Math.max(0.5, this.lodSettings.highDetailZoom * 0.9);
    this.lodSettings.mediumDetailZoom = Math.max(0.2, this.lodSettings.mediumDetailZoom * 0.9);
    this.lodSettings.lowDetailZoom = Math.max(0.1, this.lodSettings.lowDetailZoom * 0.9);
    
    // Reduce culling aggressiveness
    this.viewportCulling.margin = Math.min(0.3, this.viewportCulling.margin * 1.1);
    
    // Increase physics iterations
    this.physicsOptimization.maxIterationsPerFrame = Math.min(15, 
      Math.floor(this.physicsOptimization.maxIterationsPerFrame * 1.1));
    
    // Increase progressive rendering chunk size
    this.progressiveRendering.chunkSize = Math.min(200, 
      Math.floor(this.progressiveRendering.chunkSize * 1.1));
  }

  /**
   * Pause physics simulation to conserve resources
   */
  pausePhysics() {
    this.physicsOptimization.simulationPaused = true;
    console.log('⏸️ Physics simulation paused');
  }

  /**
   * Resume physics simulation
   */
  resumePhysics() {
    this.physicsOptimization.simulationPaused = false;
    console.log('▶️ Physics simulation resumed');
  }

  /**
   * Force a quality level for testing/debugging
   */
  setQualityLevel(level) {
    switch (level) {
      case 'low':
        this.lodSettings.highDetailZoom = 2.0;
        this.lodSettings.mediumDetailZoom = 1.0;
        this.lodSettings.lowDetailZoom = 0.5;
        this.viewportCulling.margin = 0.1;
        this.physicsOptimization.maxIterationsPerFrame = 3;
        break;
      case 'medium':
        this.lodSettings.highDetailZoom = 1.0;
        this.lodSettings.mediumDetailZoom = 0.5;
        this.lodSettings.lowDetailZoom = 0.2;
        this.viewportCulling.margin = 0.2;
        this.physicsOptimization.maxIterationsPerFrame = 7;
        break;
      case 'high':
        this.lodSettings.highDetailZoom = 0.8;
        this.lodSettings.mediumDetailZoom = 0.3;
        this.lodSettings.lowDetailZoom = 0.1;
        this.viewportCulling.margin = 0.3;
        this.physicsOptimization.maxIterationsPerFrame = 12;
        break;
    }
    
    console.log(`🎯 Quality level set to: ${level}`);
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      settings: {
        lod: this.lodSettings,
        culling: this.viewportCulling,
        physics: this.physicsOptimization,
        memory: this.memoryManagement,
        progressive: this.progressiveRendering
      }
    };
  }

  /**
   * Get performance report for debugging
   */
  getPerformanceReport() {
    const nodeCount = this.graph.order;
    const edgeCount = this.graph.size;
    
    return {
      summary: {
        nodeCount,
        edgeCount,
        visibleNodes: this.metrics.visibleNodes,
        visibleEdges: this.metrics.visibleEdges,
        currentFPS: this.metrics.fps,
        targetFPS: this.targetFPS,
        memoryUsage: this.metrics.memoryUsage,
        performanceRatio: this.metrics.fps / this.targetFPS
      },
      optimizations: {
        lodEnabled: true,
        cullingEnabled: this.viewportCulling.enabled,
        physicsOptimized: this.physicsOptimization.enabled,
        progressiveRendering: this.progressiveRendering.enabled,
        autoAdjustment: this.autoAdjustment.enabled
      },
      settings: this.getMetrics().settings,
      recommendations: this.generateOptimizationRecommendations()
    };
  }

  /**
   * Generate optimization recommendations based on current state
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    const nodeCount = this.graph.order;
    const performanceRatio = this.metrics.fps / this.targetFPS;
    
    if (nodeCount > 10000 && !this.viewportCulling.enabled) {
      recommendations.push('Enable viewport culling for better performance with large graphs');
    }
    
    if (performanceRatio < 0.7) {
      recommendations.push('Consider reducing quality settings or enabling more aggressive optimizations');
    }
    
    if (this.metrics.memoryUsage > 500 * 1024 * 1024) { // 500MB
      recommendations.push('High memory usage detected, consider more frequent cleanup');
    }
    
    if (nodeCount > 5000 && !this.physicsOptimization.barnesHutOptimize) {
      recommendations.push('Enable Barnes-Hut optimization for large graphs');
    }
    
    return recommendations;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics() {
    const now = performance.now();
    
    // Calculate FPS
    if (this.lastFrameTime) {
      const frameDelta = now - this.lastFrameTime;
      this.metrics.fps = Math.round(1000 / frameDelta);
    }
    this.lastFrameTime = now;
    
    // Update memory usage
    if (performance.memory) {
      this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
    }
    
    // Update performance mode based on metrics
    this.adjustPerformanceMode();
  }

  /**
   * Render frame with performance optimizations
   */
  renderFrame() {
    if (!this.sigma) return;
    
    try {
      this.updatePerformanceMetrics();
      this.sigma.refresh();
    } catch (error) {
      console.warn('Frame render error:', error);
    }
  }

  /**
   * Cleanup and destroy the performance manager
   */
  destroy() {
    // Remove event listeners
    if (this.sigma && this.sigma.getCamera) {
      this.sigma.getCamera().off('updated', this.boundHandleCameraUpdate);
    }
    
    // Clear caches
    this.memoryManagement.geometryCache.clear();
    this.memoryManagement.textureCache.clear();
    
    // Reset performance manager
    this.metrics = {};
    this.autoAdjustment.performanceHistory = [];
    
    console.log('🧹 PerformanceManager destroyed');
  }
}

export default PerformanceManager;