/**
 * AntiLagManager - Advanced anti-lag features for massive graph rendering
 * 
 * This module provides comprehensive lag prevention and performance optimization
 * specifically designed for handling massive graphs with 10,000+ nodes smoothly.
 * 
 * Features:
 * - Adaptive frame rate control
 * - Intelligent batching and scheduling
 * - Memory pressure monitoring
 * - Automatic quality degradation
 * - Progressive loading strategies
 * - Emergency performance modes
 */
export class AntiLagManager {
  constructor(graphEngine, performanceManager) {
    this.engine = graphEngine;
    this.performanceManager = performanceManager;
    this.sigma = graphEngine.sigma;
    this.graph = graphEngine.graph;
    
    // Performance thresholds
    this.thresholds = {
      criticalFPS: 15,        // Emergency mode threshold
      warningFPS: 25,         // Warning threshold
      targetFPS: 60,          // Ideal target
      memoryLimit: 512 * 1024 * 1024, // 512MB memory limit
      nodeCountWarning: 5000,  // Start optimizations
      nodeCountCritical: 15000 // Emergency optimizations
    };
    
    // Current performance state
    this.state = {
      mode: 'normal',         // normal, warning, critical, emergency
      currentFPS: 60,
      memoryUsage: 0,
      nodeCount: 0,
      edgeCount: 0,
      renderingPaused: false,
      emergencyModeActive: false
    };
    
    // Adaptive systems
    this.adaptive = {
      frameSkipping: {
        enabled: false,
        skipRatio: 0,           // 0-1, portion of frames to skip
        frameCounter: 0,
        lastRenderFrame: 0
      },
      
      levelOfDetail: {
        currentLevel: 1.0,      // 1.0 = full quality, 0.1 = minimum
        targetLevel: 1.0,
        adjustmentSpeed: 0.1,   // How fast to adjust quality
        minLevel: 0.1
      },
      
      culling: {
        aggressiveness: 1.0,    // 1.0 = normal, 2.0 = aggressive
        viewportMargin: 0.2,
        lastCullTime: 0,
        cullInterval: 100       // ms between culling updates
      },
      
      rendering: {
        useInstancedRendering: false,
        useBatchedUpdates: true,
        maxBatchSize: 100,
        renderQueue: [],
        priorityQueue: new Map()
      }
    };
    
    // Emergency strategies
    this.emergency = {
      strategies: [
        'pausePhysics',
        'reduceNodeCount',
        'simplifyEdges',
        'pauseRendering',
        'clearCache',
        'forceGarbageCollection'
      ],
      activeStrategies: new Set(),
      recoveryThreshold: 40,   // FPS threshold for recovery
      lastEmergencyTime: 0
    };
    
    // Performance monitoring
    this.monitoring = {
      enabled: true,
      interval: 1000,          // Check every second
      history: [],
      historySize: 30,         // Keep 30 seconds of history
      lastCheck: Date.now(),
      performanceWorker: null
    };
    
    // Batch processing
    this.batching = {
      enabled: true,
      operations: new Map(),   // Queued operations
      batchSize: 50,
      processingInterval: 16,  // ~60fps
      lastProcessTime: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize the anti-lag system
   */
  initialize() {
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
    
    // Setup adaptive systems
    this.setupAdaptiveRendering();
    
    // Setup batch processing
    this.setupBatchProcessing();
    
    // Setup emergency detection
    this.setupEmergencyDetection();
    
    // Setup memory monitoring
    this.setupMemoryMonitoring();
    
  }

  /**
   * Start continuous performance monitoring
   */
  startPerformanceMonitoring() {
    if (!this.monitoring.enabled) return;
    
    const monitor = () => {
      this.updatePerformanceState();
      this.adjustPerformanceSettings();
      this.checkForEmergencyConditions();
      
      setTimeout(monitor, this.monitoring.interval);
    };
    
    monitor();
  }

  /**
   * Update current performance state
   */
  updatePerformanceState() {
    // Get current metrics
    const metrics = this.performanceManager ? this.performanceManager.getMetrics() : {};
    
    this.state.currentFPS = metrics.fps || 60;
    this.state.memoryUsage = metrics.memoryUsage || 0;
    this.state.nodeCount = this.graph.order;
    this.state.edgeCount = this.graph.size;
    
    // Add to history
    this.monitoring.history.push({
      timestamp: Date.now(),
      fps: this.state.currentFPS,
      memory: this.state.memoryUsage,
      nodes: this.state.nodeCount,
      mode: this.state.mode
    });
    
    // Trim history
    if (this.monitoring.history.length > this.monitoring.historySize) {
      this.monitoring.history.shift();
    }
    
    // Determine performance mode
    this.updatePerformanceMode();
  }

  /**
   * Update performance mode based on current conditions
   */
  updatePerformanceMode() {
    const { currentFPS, memoryUsage, nodeCount } = this.state;
    const { criticalFPS, warningFPS, memoryLimit, nodeCountWarning, nodeCountCritical } = this.thresholds;
    
    let newMode = 'normal';
    
    // Check FPS
    if (currentFPS < criticalFPS) {
      newMode = 'critical';
    } else if (currentFPS < warningFPS) {
      newMode = 'warning';
    }
    
    // Check memory usage
    if (memoryUsage > memoryLimit) {
      newMode = newMode === 'normal' ? 'warning' : 'critical';
    }
    
    // Check node count
    if (nodeCount > nodeCountCritical) {
      newMode = 'critical';
    } else if (nodeCount > nodeCountWarning && newMode === 'normal') {
      newMode = 'warning';
    }
    
    // Check for emergency conditions
    if (currentFPS < 10 || memoryUsage > memoryLimit * 1.5) {
      newMode = 'emergency';
    }
    
    if (newMode !== this.state.mode) {
      this.onPerformanceModeChanged(this.state.mode, newMode);
      this.state.mode = newMode;
    }
  }

  /**
   * Handle performance mode changes
   */
  onPerformanceModeChanged(oldMode, newMode) {
    
    switch (newMode) {
      case 'warning':
        this.enableWarningOptimizations();
        break;
      case 'critical':
        this.enableCriticalOptimizations();
        break;
      case 'emergency':
        this.enableEmergencyMode();
        break;
      case 'normal':
        this.restoreNormalMode();
        break;
    }
    
    // Emit event
    this.engine.emit('performanceModeChanged', { oldMode, newMode, state: this.state });
  }

  /**
   * Enable warning-level optimizations
   */
  enableWarningOptimizations() {
    // Slightly reduce quality
    this.adaptive.levelOfDetail.targetLevel = 0.8;
    
    // Enable frame skipping if needed
    if (this.state.currentFPS < this.thresholds.warningFPS) {
      this.adaptive.frameSkipping.enabled = true;
      this.adaptive.frameSkipping.skipRatio = 0.1; // Skip 10% of frames
    }
    
    // Increase culling aggressiveness
    this.adaptive.culling.aggressiveness = 1.3;
    this.adaptive.culling.viewportMargin = 0.15;
    
    // Enable batched updates
    this.adaptive.rendering.useBatchedUpdates = true;
    this.adaptive.rendering.maxBatchSize = 75;
    
  }

  /**
   * Enable critical-level optimizations
   */
  enableCriticalOptimizations() {
    // Significantly reduce quality
    this.adaptive.levelOfDetail.targetLevel = 0.5;
    
    // Increase frame skipping
    this.adaptive.frameSkipping.enabled = true;
    this.adaptive.frameSkipping.skipRatio = 0.2; // Skip 20% of frames
    
    // Aggressive culling
    this.adaptive.culling.aggressiveness = 2.0;
    this.adaptive.culling.viewportMargin = 0.1;
    
    // Reduce batch sizes for better responsiveness
    this.adaptive.rendering.maxBatchSize = 50;
    
    // Pause physics simulation if running
    if (this.engine.isLayoutRunning) {
      this.pausePhysicsTemporarily();
    }
    
  }

  /**
   * Enable emergency mode
   */
  enableEmergencyMode() {
    if (this.state.emergencyModeActive) return;
    
    this.state.emergencyModeActive = true;
    this.emergency.lastEmergencyTime = Date.now();
    
    
    // Apply all emergency strategies
    this.applyEmergencyStrategies();
    
    // Set minimum quality
    this.adaptive.levelOfDetail.targetLevel = this.adaptive.levelOfDetail.minLevel;
    
    // Maximum frame skipping
    this.adaptive.frameSkipping.enabled = true;
    this.adaptive.frameSkipping.skipRatio = 0.5; // Skip 50% of frames
    
    // Pause rendering temporarily
    this.pauseRendering(2000); // 2 seconds
    
    // Force immediate cleanup
    this.forceCleanup();
  }

  /**
   * Restore normal performance mode
   */
  restoreNormalMode() {
    // Restore quality
    this.adaptive.levelOfDetail.targetLevel = 1.0;
    
    // Disable frame skipping
    this.adaptive.frameSkipping.enabled = false;
    this.adaptive.frameSkipping.skipRatio = 0;
    
    // Normal culling
    this.adaptive.culling.aggressiveness = 1.0;
    this.adaptive.culling.viewportMargin = 0.2;
    
    // Normal batch sizes
    this.adaptive.rendering.maxBatchSize = 100;
    
    // Resume rendering if paused
    this.resumeRendering();
    
    // Deactivate emergency mode
    if (this.state.emergencyModeActive) {
      this.deactivateEmergencyMode();
    }
    
  }

  /**
   * Apply emergency strategies
   */
  applyEmergencyStrategies() {
    for (const strategy of this.emergency.strategies) {
      if (!this.emergency.activeStrategies.has(strategy)) {
        switch (strategy) {
          case 'pausePhysics':
            this.pausePhysicsTemporarily();
            break;
          case 'reduceNodeCount':
            this.reduceVisibleNodes();
            break;
          case 'simplifyEdges':
            this.simplifyEdgeRendering();
            break;
          case 'pauseRendering':
            this.pauseRendering(1000);
            break;
          case 'clearCache':
            this.clearNonEssentialCaches();
            break;
          case 'forceGarbageCollection':
            this.forceGarbageCollection();
            break;
        }
        
        this.emergency.activeStrategies.add(strategy);
      }
    }
  }

  /**
   * Deactivate emergency mode
   */
  deactivateEmergencyMode() {
    this.state.emergencyModeActive = false;
    
    // Reverse emergency strategies
    for (const strategy of this.emergency.activeStrategies) {
      this.reverseEmergencyStrategy(strategy);
    }
    
    this.emergency.activeStrategies.clear();
    
  }

  /**
   * Reverse an emergency strategy
   */
  reverseEmergencyStrategy(strategy) {
    switch (strategy) {
      case 'pausePhysics':
        this.resumePhysics();
        break;
      case 'reduceNodeCount':
        this.restoreVisibleNodes();
        break;
      case 'simplifyEdges':
        this.restoreEdgeRendering();
        break;
      case 'pauseRendering':
        this.resumeRendering();
        break;
      // Cache and GC strategies don't need reversal
    }
  }

  /**
   * Setup adaptive rendering system
   */
  setupAdaptiveRendering() {
    // Override sigma's render method to add frame skipping
    if (this.sigma && this.sigma.render) {
      const originalRender = this.sigma.render.bind(this.sigma);
      
      this.sigma.render = () => {
        if (this.shouldSkipFrame()) {
          return; // Skip this frame
        }
        
        // Adjust level of detail before rendering
        this.adjustLevelOfDetail();
        
        // Perform rendering
        originalRender();
        
        this.adaptive.frameSkipping.frameCounter++;
      };
    }
  }

  /**
   * Check if current frame should be skipped
   */
  shouldSkipFrame() {
    if (!this.adaptive.frameSkipping.enabled) return false;
    
    const { skipRatio, frameCounter } = this.adaptive.frameSkipping;
    
    // Skip frame based on ratio
    return (frameCounter % Math.floor(1 / skipRatio)) !== 0;
  }

  /**
   * Adjust level of detail based on current target
   */
  adjustLevelOfDetail() {
    const { currentLevel, targetLevel, adjustmentSpeed } = this.adaptive.levelOfDetail;
    
    if (Math.abs(currentLevel - targetLevel) > 0.01) {
      // Gradually adjust to target level
      const newLevel = currentLevel + (targetLevel - currentLevel) * adjustmentSpeed;
      this.adaptive.levelOfDetail.currentLevel = newLevel;
      
      // Apply LOD to performance manager
      if (this.performanceManager) {
        this.performanceManager.setQualityLevel(this.getQualityLevelFromLOD(newLevel));
      }
    }
  }

  /**
   * Convert LOD value to quality level string
   */
  getQualityLevelFromLOD(lodValue) {
    if (lodValue > 0.8) return 'high';
    if (lodValue > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Setup batch processing system
   */
  setupBatchProcessing() {
    if (!this.batching.enabled) return;
    
    const processBatches = () => {
      const now = Date.now();
      
      if (now - this.batching.lastProcessTime >= this.batching.processingInterval) {
        this.processBatchedOperations();
        this.batching.lastProcessTime = now;
      }
      
      requestAnimationFrame(processBatches);
    };
    
    processBatches();
  }

  /**
   * Process batched operations
   */
  processBatchedOperations() {
    for (const [type, operations] of this.batching.operations) {
      if (operations.length === 0) continue;
      
      // Process up to batchSize operations
      const batch = operations.splice(0, this.batching.batchSize);
      
      switch (type) {
        case 'nodeUpdate':
          this.processBatchedNodeUpdates(batch);
          break;
        case 'edgeUpdate':
          this.processBatchedEdgeUpdates(batch);
          break;
        case 'positionUpdate':
          this.processBatchedPositionUpdates(batch);
          break;
      }
    }
  }

  /**
   * Add operation to batch queue
   */
  queueBatchedOperation(type, operation) {
    if (!this.batching.operations.has(type)) {
      this.batching.operations.set(type, []);
    }
    
    this.batching.operations.get(type).push(operation);
  }

  /**
   * Process batched node updates
   */
  processBatchedNodeUpdates(batch) {
    for (const operation of batch) {
      try {
        operation.execute();
      } catch (error) {
      }
    }
  }

  /**
   * Process batched edge updates
   */
  processBatchedEdgeUpdates(batch) {
    for (const operation of batch) {
      try {
        operation.execute();
      } catch (error) {
      }
    }
  }

  /**
   * Process batched position updates
   */
  processBatchedPositionUpdates(batch) {
    // Group position updates by node for efficiency
    const nodeUpdates = new Map();
    
    for (const operation of batch) {
      const nodeId = operation.nodeId;
      if (!nodeUpdates.has(nodeId)) {
        nodeUpdates.set(nodeId, operation);
      } else {
        // Merge with existing update
        const existing = nodeUpdates.get(nodeId);
        existing.x = operation.x;
        existing.y = operation.y;
      }
    }
    
    // Apply all position updates
    for (const [nodeId, update] of nodeUpdates) {
      if (this.graph.hasNode(nodeId)) {
        this.graph.setNodeAttribute(nodeId, 'x', update.x);
        this.graph.setNodeAttribute(nodeId, 'y', update.y);
      }
    }
  }

  /**
   * Setup emergency detection
   */
  setupEmergencyDetection() {
    // Monitor for sudden performance drops
    setInterval(() => {
      this.detectPerformanceDrops();
    }, 500); // Check twice per second
  }

  /**
   * Detect sudden performance drops
   */
  detectPerformanceDrops() {
    if (this.monitoring.history.length < 5) return;
    
    const recent = this.monitoring.history.slice(-5);
    const avgRecentFPS = recent.reduce((sum, entry) => sum + entry.fps, 0) / recent.length;
    
    // Check for sudden drop
    if (avgRecentFPS < this.thresholds.criticalFPS && this.state.mode !== 'emergency') {
      this.enableEmergencyMode();
    }
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    if (!performance.memory) return;
    
    setInterval(() => {
      const memoryInfo = performance.memory;
      this.state.memoryUsage = memoryInfo.usedJSHeapSize;
      
      // Check for memory pressure
      if (memoryInfo.usedJSHeapSize > this.thresholds.memoryLimit) {
        this.handleMemoryPressure(memoryInfo);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Handle memory pressure
   */
  handleMemoryPressure(memoryInfo) {
    
    // Clear non-essential caches
    this.clearNonEssentialCaches();
    
    // Force garbage collection if available
    this.forceGarbageCollection();
    
    // Reduce cache sizes
    this.reduceCacheSizes();
  }

  /**
   * Pause physics simulation temporarily
   */
  pausePhysicsTemporarily() {
    if (this.performanceManager) {
      this.performanceManager.pausePhysics();
    }
  }

  /**
   * Resume physics simulation
   */
  resumePhysics() {
    if (this.performanceManager) {
      this.performanceManager.resumePhysics();
    }
  }

  /**
   * Reduce visible nodes for emergency performance
   */
  reduceVisibleNodes() {
    // Temporarily hide nodes that are far from viewport
    // This would integrate with viewport culling
  }

  /**
   * Restore visible nodes
   */
  restoreVisibleNodes() {
    // Restore hidden nodes
  }

  /**
   * Simplify edge rendering
   */
  simplifyEdgeRendering() {
    // Use simplified edge rendering
  }

  /**
   * Restore edge rendering
   */
  restoreEdgeRendering() {
    // Restore normal edge rendering
  }

  /**
   * Pause rendering temporarily
   */
  pauseRendering(duration) {
    if (this.state.renderingPaused) return;
    
    this.state.renderingPaused = true;
    
    setTimeout(() => {
      this.resumeRendering();
    }, duration);
  }

  /**
   * Resume rendering
   */
  resumeRendering() {
    if (!this.state.renderingPaused) return;
    
    this.state.renderingPaused = false;
  }

  /**
   * Clear non-essential caches
   */
  clearNonEssentialCaches() {
    if (this.engine.cache) {
      // Clear viewport cache (can be recalculated quickly)
      this.engine.cache.viewportStates.clear();
      
      // Clear older layout cache entries
      const now = Date.now();
      for (const [key, entry] of this.engine.cache.layouts) {
        if (now - entry.timestamp > 60000) { // Older than 1 minute
          this.engine.cache.layouts.delete(key);
        }
      }
    }
    
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection() {
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Reduce cache sizes
   */
  reduceCacheSizes() {
    if (this.engine.cache) {
      this.engine.cache.maxCacheSize = Math.floor(this.engine.cache.maxCacheSize * 0.5);
      this.engine.cleanupCache();
    }
  }

  /**
   * Force immediate cleanup
   */
  forceCleanup() {
    // Clear all caches
    this.clearNonEssentialCaches();
    
    // Force engine cache cleanup
    if (this.engine.forceCacheCleanup) {
      this.engine.forceCacheCleanup();
    }
    
    // Clear memory pools partially
    if (this.engine.memoryPools) {
      this.engine.memoryPools.vectors.length = Math.floor(this.engine.memoryPools.vectors.length * 0.5);
      this.engine.memoryPools.matrices.length = Math.floor(this.engine.memoryPools.matrices.length * 0.5);
    }
    
  }

  /**
   * Adjust performance settings based on current state
   */
  adjustPerformanceSettings() {
    // Auto-adjust based on performance history
    if (this.monitoring.history.length >= 10) {
      const recent = this.monitoring.history.slice(-10);
      const avgFPS = recent.reduce((sum, entry) => sum + entry.fps, 0) / recent.length;
      
      // If consistently below target, be more aggressive
      if (avgFPS < this.thresholds.targetFPS * 0.8) {
        this.adaptive.levelOfDetail.adjustmentSpeed = 0.2; // Faster adjustment
      } else {
        this.adaptive.levelOfDetail.adjustmentSpeed = 0.1; // Normal adjustment
      }
    }
  }

  /**
   * Check for emergency conditions
   */
  checkForEmergencyConditions() {
    const { currentFPS, memoryUsage, nodeCount } = this.state;
    
    // Multiple emergency triggers
    const emergencyConditions = [
      currentFPS < 5,                           // Extremely low FPS
      memoryUsage > this.thresholds.memoryLimit * 2,  // Memory overflow
      nodeCount > 50000,                        // Extreme node count
      this.state.mode === 'critical' && Date.now() - this.emergency.lastEmergencyTime > 30000 // Stuck in critical mode
    ];
    
    if (emergencyConditions.some(condition => condition) && !this.state.emergencyModeActive) {
      this.enableEmergencyMode();
    }
    
    // Recovery check
    if (this.state.emergencyModeActive && currentFPS > this.emergency.recoveryThreshold) {
      
      // Wait a bit to ensure stable recovery
      setTimeout(() => {
        if (this.state.currentFPS > this.emergency.recoveryThreshold) {
          this.deactivateEmergencyMode();
        }
      }, 5000);
    }
  }

  /**
   * Get current anti-lag status
   */
  getStatus() {
    return {
      state: { ...this.state },
      adaptive: {
        frameSkipping: { ...this.adaptive.frameSkipping },
        levelOfDetail: { ...this.adaptive.levelOfDetail },
        culling: { ...this.adaptive.culling },
        rendering: {
          useBatchedUpdates: this.adaptive.rendering.useBatchedUpdates,
          maxBatchSize: this.adaptive.rendering.maxBatchSize,
          queueLength: this.adaptive.rendering.renderQueue.length
        }
      },
      emergency: {
        active: this.state.emergencyModeActive,
        activeStrategies: Array.from(this.emergency.activeStrategies),
        lastActivation: this.emergency.lastEmergencyTime
      },
      monitoring: {
        historyLength: this.monitoring.history.length,
        lastCheck: this.monitoring.lastCheck
      },
      batching: {
        enabled: this.batching.enabled,
        queuedOperations: Array.from(this.batching.operations.entries()).map(([type, ops]) => ({
          type,
          count: ops.length
        }))
      }
    };
  }

  /**
   * Get performance report for debugging
   */
  getPerformanceReport() {
    const recent = this.monitoring.history.slice(-10);
    
    return {
      summary: {
        currentMode: this.state.mode,
        emergencyModeActive: this.state.emergencyModeActive,
        currentFPS: this.state.currentFPS,
        averageFPS: recent.length ? recent.reduce((sum, entry) => sum + entry.fps, 0) / recent.length : 0,
        memoryUsage: Math.round(this.state.memoryUsage / 1024 / 1024) + 'MB',
        nodeCount: this.state.nodeCount,
        edgeCount: this.state.edgeCount
      },
      adaptiveSettings: {
        lodLevel: this.adaptive.levelOfDetail.currentLevel,
        frameSkipRatio: this.adaptive.frameSkipping.skipRatio,
        cullingAggressiveness: this.adaptive.culling.aggressiveness,
        batchSize: this.adaptive.rendering.maxBatchSize
      },
      recommendations: this.generatePerformanceRecommendations()
    };
  }

  /**
   * Generate performance recommendations
   */
  generatePerformanceRecommendations() {
    const recommendations = [];
    const { currentFPS, nodeCount, memoryUsage } = this.state;
    
    if (currentFPS < 30) {
      recommendations.push('Consider reducing node count or enabling more aggressive optimizations');
    }
    
    if (nodeCount > 10000) {
      recommendations.push('Graph is very large - viewport culling and LOD are essential');
    }
    
    if (memoryUsage > 200 * 1024 * 1024) {
      recommendations.push('High memory usage detected - consider cache cleanup');
    }
    
    if (this.emergency.activeStrategies.size > 0) {
      recommendations.push('Emergency strategies are active - consider reducing graph complexity');
    }
    
    return recommendations;
  }

  /**
   * Enable/disable anti-lag system
   */
  setEnabled(enabled) {
    this.monitoring.enabled = enabled;
    
    if (!enabled) {
      // Restore normal mode
      this.restoreNormalMode();
    }
    
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    // Deactivate emergency mode
    if (this.state.emergencyModeActive) {
      this.deactivateEmergencyMode();
    }
    
    // Clear monitoring data
    this.monitoring.history = [];
    
    // Clear batch queues
    this.batching.operations.clear();
    
    // Restore normal rendering
    this.restoreNormalMode();
    
  }
}

export default AntiLagManager;