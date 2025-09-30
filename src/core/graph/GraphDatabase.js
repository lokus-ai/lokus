/**
 * GraphDatabase - Advanced in-memory graph database for Lokus
 * 
 * A high-performance, event-driven graph database optimized for real-time wiki link tracking.
 * Provides O(1) lookups, bidirectional indexing, and incremental updates for maximum efficiency.
 * 
 * Features:
 * - In-memory adjacency lists for O(1) node/edge operations
 * - Bidirectional indexing (outgoing and incoming links)
 * - Real-time diff-based updates (only process changes)
 * - Weighted connections with metadata tracking
 * - Event-driven architecture with observers
 * - Smart caching with file timestamp tracking
 * - Incremental edge updates without full rebuilds
 * - Production-ready error handling and logging
 * 
 * @author Claude AI
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

export class GraphDatabase extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.options = {
      maxNodes: options.maxNodes || 100000,
      maxEdgesPerNode: options.maxEdgesPerNode || 10000,
      enableMetrics: options.enableMetrics !== false,
      enableValidation: options.enableValidation !== false,
      cacheTimeout: options.cacheTimeout || 30000, // 30 seconds
      ...options
    };
    
    // Core graph data structures
    this.nodes = new Map();           // nodeId -> NodeData
    this.outgoingEdges = new Map();   // sourceId -> Map(targetId -> EdgeData)
    this.incomingEdges = new Map();   // targetId -> Map(sourceId -> EdgeData)
    this.nodeMetadata = new Map();    // nodeId -> metadata object
    this.edgeWeights = new Map();     // edgeId -> weight/frequency
    
    // Caching and performance
    this.fileTimestamps = new Map();  // filePath -> lastModified timestamp
    this.processedFiles = new Set();  // track processed files
    this.dirtyNodes = new Set();      // nodes needing reprocessing
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Metrics and monitoring
    this.metrics = {
      totalNodes: 0,
      totalEdges: 0,
      totalConnections: 0,
      lastUpdate: null,
      operationCounts: {
        addNode: 0,
        removeNode: 0,
        addEdge: 0,
        removeEdge: 0,
        updateFile: 0
      },
      performanceStats: {
        avgQueryTime: 0,
        maxQueryTime: 0,
        totalQueries: 0
      }
    };
    
    // Error handling and logging
    this.errorLog = [];
    this.maxErrorLogSize = 1000;
    this.logger = options.logger || console;
    
    // Initialize performance monitoring
    if (this.options.enableMetrics) {
      this._initializeMetrics();
    }
    
    this.logger.info('GraphDatabase initialized', {
      maxNodes: this.options.maxNodes,
      maxEdgesPerNode: this.options.maxEdgesPerNode,
      enableMetrics: this.options.enableMetrics
    });
  }

  /**
   * Initialize performance monitoring
   * @private
   */
  _initializeMetrics() {
    // Periodic metrics collection
    this.metricsInterval = setInterval(() => {
      this._collectMetrics();
    }, 10000); // Every 10 seconds
    
    // Memory usage monitoring
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.memoryMonitor = setInterval(() => {
        const memory = process.memoryUsage();
        if (memory.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
          this.logger.warn('High memory usage detected', {
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            totalNodes: this.metrics.totalNodes,
            totalEdges: this.metrics.totalEdges
          });
        }
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Collect and emit performance metrics
   * @private
   */
  _collectMetrics() {
    this.metrics.totalNodes = this.nodes.size;
    this.metrics.totalEdges = this._countTotalEdges();
    this.metrics.lastUpdate = new Date().toISOString();
    
    this.emit('metrics', {
      ...this.metrics,
      cacheHitRatio: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      memoryUsage: this._estimateMemoryUsage()
    });
  }

  /**
   * Count total edges in the graph
   * @private
   * @returns {number}
   */
  _countTotalEdges() {
    let total = 0;
    for (const edges of this.outgoingEdges.values()) {
      total += edges.size;
    }
    return total;
  }

  /**
   * Estimate memory usage of the graph database
   * @private
   * @returns {object}
   */
  _estimateMemoryUsage() {
    const nodeMemory = this.nodes.size * 200; // Rough estimate per node
    const edgeMemory = this._countTotalEdges() * 100; // Rough estimate per edge
    const metadataMemory = this.nodeMetadata.size * 150; // Rough estimate per metadata
    
    return {
      nodes: Math.round(nodeMemory / 1024) + 'KB',
      edges: Math.round(edgeMemory / 1024) + 'KB', 
      metadata: Math.round(metadataMemory / 1024) + 'KB',
      total: Math.round((nodeMemory + edgeMemory + metadataMemory) / 1024) + 'KB'
    };
  }

  /**
   * Add or update a node in the graph
   * @param {string} nodeId - Unique identifier for the node
   * @param {object} nodeData - Node data (title, type, etc.)
   * @returns {boolean} - True if added, false if updated
   */
  addNode(nodeId, nodeData = {}) {
    const startTime = performance.now();
    
    try {
      this._validateNodeId(nodeId);
      this._checkCapacityLimits();
      
      const isNew = !this.nodes.has(nodeId);
      
      // Create or update node
      const node = {
        id: nodeId,
        title: nodeData.title || nodeId,
        type: nodeData.type || 'file',
        created: isNew ? Date.now() : this.nodes.get(nodeId)?.created || Date.now(),
        modified: Date.now(),
        size: nodeData.size || 0,
        path: nodeData.path || nodeId,
        ...nodeData
      };
      
      this.nodes.set(nodeId, node);
      
      // Initialize edge maps if new node
      if (isNew) {
        this.outgoingEdges.set(nodeId, new Map());
        this.incomingEdges.set(nodeId, new Map());
        this.metrics.operationCounts.addNode++;
      }
      
      // Track performance
      this._trackQueryPerformance(performance.now() - startTime);
      
      // Emit event
      this.emit(isNew ? 'nodeAdded' : 'nodeUpdated', {
        nodeId,
        node,
        isNew
      });
      
      return isNew;
      
    } catch (error) {
      this._logError('addNode', error, { nodeId, nodeData });
      throw error;
    }
  }

  /**
   * Remove a node and all its connections
   * @param {string} nodeId - Node to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeNode(nodeId) {
    const startTime = performance.now();
    
    try {
      if (!this.nodes.has(nodeId)) {
        return false;
      }
      
      // Get all connections before removal
      const outgoing = Array.from(this.outgoingEdges.get(nodeId)?.keys() || []);
      const incoming = Array.from(this.incomingEdges.get(nodeId)?.keys() || []);
      
      // Remove all outgoing edges
      for (const targetId of outgoing) {
        this.removeConnection(nodeId, targetId);
      }
      
      // Remove all incoming edges
      for (const sourceId of incoming) {
        this.removeConnection(sourceId, nodeId);
      }
      
      // Remove node data
      this.nodes.delete(nodeId);
      this.outgoingEdges.delete(nodeId);
      this.incomingEdges.delete(nodeId);
      this.nodeMetadata.delete(nodeId);
      this.dirtyNodes.delete(nodeId);
      
      this.metrics.operationCounts.removeNode++;
      this._trackQueryPerformance(performance.now() - startTime);
      
      this.emit('nodeRemoved', {
        nodeId,
        removedConnections: outgoing.length + incoming.length
      });
      
      return true;
      
    } catch (error) {
      this._logError('removeNode', error, { nodeId });
      throw error;
    }
  }

  /**
   * Add a connection between two nodes with metadata
   * @param {string} sourceFile - Source node ID
   * @param {string} targetFile - Target node ID  
   * @param {object} metadata - Connection metadata
   * @returns {boolean} - True if added, false if updated
   */
  addConnection(sourceFile, targetFile, metadata = {}) {
    const startTime = performance.now();
    // console.log('🔗 GraphDatabase.addConnection called:', { sourceFile, targetFile, metadata });
    
    try {
      this._validateNodeId(sourceFile);
      this._validateNodeId(targetFile);
      
      // Ensure both nodes exist
      if (!this.nodes.has(sourceFile)) {
        this.addNode(sourceFile, { path: sourceFile });
      }
      if (!this.nodes.has(targetFile)) {
        this.addNode(targetFile, { path: targetFile });
      }
      
      // Check edge capacity
      const sourceEdges = this.outgoingEdges.get(sourceFile);
      if (sourceEdges.size >= this.options.maxEdgesPerNode) {
        throw new Error(`Maximum edges per node exceeded for ${sourceFile}`);
      }
      
      const edgeId = `${sourceFile}->${targetFile}`;
      const isNew = !sourceEdges.has(targetFile);
      
      // Create edge data
      const edge = {
        id: edgeId,
        source: sourceFile,
        target: targetFile,
        created: isNew ? Date.now() : sourceEdges.get(targetFile)?.created || Date.now(),
        modified: Date.now(),
        weight: metadata.weight || 1,
        type: metadata.type || 'wikilink',
        context: metadata.context || '',
        lineNumber: metadata.lineNumber || 0,
        ...metadata
      };
      
      // Add to adjacency lists
      sourceEdges.set(targetFile, edge);
      
      if (!this.incomingEdges.has(targetFile)) {
        this.incomingEdges.set(targetFile, new Map());
      }
      this.incomingEdges.get(targetFile).set(sourceFile, edge);
      
      // Update edge weight
      const currentWeight = this.edgeWeights.get(edgeId) || 0;
      this.edgeWeights.set(edgeId, currentWeight + (metadata.weight || 1));
      
      this.metrics.operationCounts.addEdge++;
      this._trackQueryPerformance(performance.now() - startTime);
      
      this.emit(isNew ? 'connectionAdded' : 'connectionUpdated', {
        sourceFile,
        targetFile,
        edge,
        isNew
      });
      
    // console.log('✅ GraphDatabase connection created successfully:', {
      //  edgeId,
      //  isNew,
      //  totalEdges: this.edgeCount
      // });
      
      return isNew;
      
    } catch (error) {
      this._logError('addConnection', error, { sourceFile, targetFile, metadata });
      throw error;
    }
  }

  /**
   * Remove a connection between two nodes
   * @param {string} sourceFile - Source node ID
   * @param {string} targetFile - Target node ID
   * @returns {boolean} - True if removed, false if not found
   */
  removeConnection(sourceFile, targetFile) {
    const startTime = performance.now();
    
    try {
      const sourceEdges = this.outgoingEdges.get(sourceFile);
      const targetEdges = this.incomingEdges.get(targetFile);
      
      if (!sourceEdges || !targetEdges || !sourceEdges.has(targetFile)) {
        return false;
      }
      
      // Get edge data before removal
      const edge = sourceEdges.get(targetFile);
      const edgeId = `${sourceFile}->${targetFile}`;
      
      // Remove from adjacency lists
      sourceEdges.delete(targetFile);
      targetEdges.delete(sourceFile);
      this.edgeWeights.delete(edgeId);
      
      this.metrics.operationCounts.removeEdge++;
      this._trackQueryPerformance(performance.now() - startTime);
      
      this.emit('connectionRemoved', {
        sourceFile,
        targetFile,
        edge
      });
      
      return true;
      
    } catch (error) {
      this._logError('removeConnection', error, { sourceFile, targetFile });
      throw error;
    }
  }

  /**
   * Get all outgoing connections from a file
   * @param {string} file - File to get connections for
   * @returns {Array} - Array of connection objects
   */
  getConnections(file) {
    const startTime = performance.now();
    
    try {
      const edges = this.outgoingEdges.get(file);
      if (!edges) {
        this.cacheMisses++;
        return [];
      }
      
      this.cacheHits++;
      const connections = Array.from(edges.values());
      
      this._trackQueryPerformance(performance.now() - startTime);
      
      return connections;
      
    } catch (error) {
      this._logError('getConnections', error, { file });
      return [];
    }
  }

  /**
   * Get all incoming links to a file
   * @param {string} file - File to get incoming links for
   * @returns {Array} - Array of connection objects
   */
  getIncomingLinks(file) {
    const startTime = performance.now();
    
    try {
      const edges = this.incomingEdges.get(file);
      if (!edges) {
        this.cacheMisses++;
        return [];
      }
      
      this.cacheHits++;
      const connections = Array.from(edges.values());
      
      this._trackQueryPerformance(performance.now() - startTime);
      
      return connections;
      
    } catch (error) {
      this._logError('getIncomingLinks', error, { file });
      return [];
    }
  }

  /**
   * Update file links with intelligent diff-based processing
   * @param {string} filePath - Path of the file being updated
   * @param {Array} newLinks - New links found in the file
   * @param {Array} oldLinks - Previous links (optional for diff)
   * @returns {object} - Update summary with added/removed counts
   */
  updateFileLinks(filePath, newLinks = [], oldLinks = null) {
    const startTime = performance.now();
    
    try {
      this._validateNodeId(filePath);
      
      // Check if file needs updating based on timestamp
      const fileTimestamp = this.fileTimestamps.get(filePath);
      const currentTime = Date.now();
      
      if (fileTimestamp && (currentTime - fileTimestamp) < this.options.cacheTimeout) {
        this.cacheHits++;
        return { added: 0, removed: 0, cached: true };
      }
      
      this.cacheMisses++;
      
      // Get current links if oldLinks not provided
      if (!oldLinks) {
        oldLinks = this.getConnections(filePath).map(edge => edge.target);
      }
      
      // Calculate diff
      const oldSet = new Set(oldLinks);
      const newSet = new Set(newLinks);
      
      const toAdd = newLinks.filter(link => !oldSet.has(link));
      const toRemove = oldLinks.filter(link => !newSet.has(link));
      
      // Apply changes
      let addedCount = 0;
      let removedCount = 0;
      
      // Remove old connections
      for (const target of toRemove) {
        if (this.removeConnection(filePath, target)) {
          removedCount++;
        }
      }
      
      // Add new connections
      for (const target of toAdd) {
        if (this.addConnection(filePath, target, {
          type: 'wikilink',
          context: `Link from ${filePath}`,
          timestamp: currentTime
        })) {
          addedCount++;
        }
      }
      
      // Update timestamp
      this.fileTimestamps.set(filePath, currentTime);
      this.processedFiles.add(filePath);
      this.dirtyNodes.delete(filePath);
      
      this.metrics.operationCounts.updateFile++;
      this._trackQueryPerformance(performance.now() - startTime);
      
      const result = {
        added: addedCount,
        removed: removedCount,
        total: newLinks.length,
        cached: false
      };
      
      this.emit('fileLinksUpdated', {
        filePath,
        ...result,
        toAdd,
        toRemove
      });
      
      return result;
      
    } catch (error) {
      this._logError('updateFileLinks', error, { filePath, newLinks: newLinks?.length, oldLinks: oldLinks?.length });
      throw error;
    }
  }

  /**
   * Export graph data for visualization
   * @param {object} options - Export options
   * @returns {object} - Graph data in format suitable for visualization
   */
  exportGraphData(options = {}) {
    const startTime = performance.now();
    
    try {
      const {
        includeMetadata = true,
        includeWeights = true,
        nodeLimit = this.options.maxNodes,
        edgeLimit = Infinity,
        filterTypes = null
      } = options;
      
      const nodes = [];
      const edges = [];
      
      // Export nodes
      let nodeCount = 0;
      for (const [nodeId, nodeData] of this.nodes) {
        if (nodeCount >= nodeLimit) break;
        if (filterTypes && !filterTypes.includes(nodeData.type)) continue;
        
        const node = {
          id: nodeId,
          label: nodeData.title || nodeId,
          type: nodeData.type,
          size: this._calculateNodeSize(nodeId),
          color: this._getNodeColor(nodeData.type),
          ...nodeData
        };
        
        if (includeMetadata) {
          node.metadata = this.nodeMetadata.get(nodeId);
        }
        
        nodes.push(node);
        nodeCount++;
      }
      
      // Export edges
      let edgeCount = 0;
      for (const [sourceId, targets] of this.outgoingEdges) {
        if (edgeCount >= edgeLimit) break;
        
        for (const [targetId, edgeData] of targets) {
          if (edgeCount >= edgeLimit) break;
          
          const edge = {
            id: edgeData.id,
            source: sourceId,
            target: targetId,
            type: edgeData.type,
            size: includeWeights ? this._getEdgeWeight(sourceId, targetId) : 1,
            ...edgeData
          };
          
          edges.push(edge);
          edgeCount++;
        }
      }
      
      this._trackQueryPerformance(performance.now() - startTime);
      
      const result = {
        nodes,
        edges,
        metadata: {
          totalNodes: this.nodes.size,
          totalEdges: this._countTotalEdges(),
          exportedNodes: nodes.length,
          exportedEdges: edges.length,
          timestamp: new Date().toISOString()
        }
      };
      
      this.emit('dataExported', result.metadata);
      
      return result;
      
    } catch (error) {
      this._logError('exportGraphData', error, { options });
      throw error;
    }
  }

  /**
   * Import bulk data for initial population
   * @param {Array} files - Array of file objects with path and links
   * @returns {object} - Import summary
   */
  async importBulkData(files) {
    const startTime = performance.now();
    
    try {
      let processedFiles = 0;
      let totalConnections = 0;
      let errors = 0;
      
      // Process in batches for better performance
      const batchSize = 100;
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        for (const file of batch) {
          try {
            // Add node for file
            this.addNode(file.path, {
              title: file.title || file.name,
              type: this._getFileType(file.path),
              size: file.size || 0,
              modified: file.modified || Date.now(),
              ...file.metadata
            });
            
            // Add connections
            if (file.links && Array.isArray(file.links)) {
              for (const link of file.links) {
                this.addConnection(file.path, link.target || link, {
                  type: link.type || 'wikilink',
                  context: link.context || '',
                  weight: link.weight || 1
                });
                totalConnections++;
              }
            }
            
            processedFiles++;
            
          } catch (fileError) {
            errors++;
            this._logError('importBulkData.file', fileError, { file: file.path });
          }
        }
        
        // Emit progress
        this.emit('importProgress', {
          processed: Math.min(i + batchSize, files.length),
          total: files.length,
          connections: totalConnections,
          errors
        });
        
        // Allow event loop to breathe
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      this._trackQueryPerformance(performance.now() - startTime);
      
      const result = {
        processedFiles,
        totalConnections,
        errors,
        duration: performance.now() - startTime
      };
      
      this.emit('bulkImportCompleted', result);
      
      return result;
      
    } catch (error) {
      this._logError('importBulkData', error, { fileCount: files?.length });
      throw error;
    }
  }

  /**
   * Get graph statistics and metrics
   * @returns {object} - Comprehensive statistics
   */
  getStatistics() {
    const nodeStats = this._calculateNodeStatistics();
    const edgeStats = this._calculateEdgeStatistics();
    
    return {
      nodes: nodeStats,
      edges: edgeStats,
      performance: {
        ...this.metrics.performanceStats,
        cacheHitRatio: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
        memoryUsage: this._estimateMemoryUsage()
      },
      operations: this.metrics.operationCounts,
      health: {
        errorCount: this.errorLog.length,
        lastError: this.errorLog[this.errorLog.length - 1]?.timestamp,
        uptime: this.metrics.lastUpdate ? Date.now() - new Date(this.metrics.lastUpdate).getTime() : 0
      }
    };
  }

  /**
   * Clear all data and reset the database
   */
  clear() {
    this.nodes.clear();
    this.outgoingEdges.clear();
    this.incomingEdges.clear();
    this.nodeMetadata.clear();
    this.edgeWeights.clear();
    this.fileTimestamps.clear();
    this.processedFiles.clear();
    this.dirtyNodes.clear();
    
    // Reset metrics
    this.metrics.totalNodes = 0;
    this.metrics.totalEdges = 0;
    this.metrics.lastUpdate = new Date().toISOString();
    
    this.emit('databaseCleared');
    
    this.logger.info('GraphDatabase cleared');
  }

  /**
   * Cleanup resources and stop monitoring
   */
  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    
    this.clear();
    this.removeAllListeners();
    
    this.logger.info('GraphDatabase destroyed');
  }

  // Private helper methods

  /**
   * Validate node ID format and constraints
   * @private
   */
  _validateNodeId(nodeId) {
    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('Node ID must be a non-empty string');
    }
    if (nodeId.length > 1000) {
      throw new Error('Node ID too long (max 1000 characters)');
    }
    if (this.options.enableValidation && nodeId.includes('->')) {
      throw new Error('Node ID cannot contain "->" sequence');
    }
  }

  /**
   * Check capacity limits
   * @private
   */
  _checkCapacityLimits() {
    if (this.nodes.size >= this.options.maxNodes) {
      throw new Error(`Maximum nodes capacity reached (${this.options.maxNodes})`);
    }
  }

  /**
   * Track query performance
   * @private
   */
  _trackQueryPerformance(duration) {
    this.metrics.performanceStats.totalQueries++;
    this.metrics.performanceStats.maxQueryTime = Math.max(
      this.metrics.performanceStats.maxQueryTime,
      duration
    );
    
    // Update rolling average
    const total = this.metrics.performanceStats.totalQueries;
    const current = this.metrics.performanceStats.avgQueryTime;
    this.metrics.performanceStats.avgQueryTime = 
      (current * (total - 1) + duration) / total;
  }

  /**
   * Log error with context
   * @private
   */
  _logError(operation, error, context = {}) {
    const errorEntry = {
      operation,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
    
    this.errorLog.push(errorEntry);
    
    // Trim error log if too large
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }
    
    this.logger.error(`GraphDatabase.${operation}:`, error.message, context);
    this.emit('error', errorEntry);
  }

  /**
   * Calculate node size for visualization
   * @private
   */
  _calculateNodeSize(nodeId) {
    const outgoing = this.outgoingEdges.get(nodeId)?.size || 0;
    const incoming = this.incomingEdges.get(nodeId)?.size || 0;
    return Math.max(5, Math.min(50, (outgoing + incoming) * 2));
  }

  /**
   * Get node color based on type
   * @private
   */
  _getNodeColor(type) {
    const colors = {
      file: '#10b981',
      folder: '#3b82f6',
      image: '#f59e0b',
      document: '#8b5cf6',
      unknown: '#6366f1'
    };
    return colors[type] || colors.unknown;
  }

  /**
   * Get edge weight between two nodes
   * @private
   */
  _getEdgeWeight(sourceId, targetId) {
    const edgeId = `${sourceId}->${targetId}`;
    return this.edgeWeights.get(edgeId) || 1;
  }

  /**
   * Determine file type from path
   * @private
   */
  _getFileType(path) {
    const ext = path.toLowerCase().split('.').pop();
    if (['md', 'markdown', 'txt'].includes(ext)) return 'document';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return 'image';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
    return 'file';
  }

  /**
   * Calculate node statistics
   * @private
   */
  _calculateNodeStatistics() {
    let totalConnections = 0;
    let maxConnections = 0;
    let isolatedNodes = 0;
    const typeDistribution = {};
    
    for (const [nodeId, nodeData] of this.nodes) {
      const outgoing = this.outgoingEdges.get(nodeId)?.size || 0;
      const incoming = this.incomingEdges.get(nodeId)?.size || 0;
      const connections = outgoing + incoming;
      
      totalConnections += connections;
      maxConnections = Math.max(maxConnections, connections);
      
      if (connections === 0) {
        isolatedNodes++;
      }
      
      const type = nodeData.type || 'unknown';
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }
    
    return {
      total: this.nodes.size,
      avgConnections: this.nodes.size ? totalConnections / this.nodes.size : 0,
      maxConnections,
      isolatedNodes,
      typeDistribution
    };
  }

  /**
   * Calculate edge statistics
   * @private
   */
  _calculateEdgeStatistics() {
    const weights = Array.from(this.edgeWeights.values());
    const types = {};
    
    for (const edges of this.outgoingEdges.values()) {
      for (const edge of edges.values()) {
        const type = edge.type || 'unknown';
        types[type] = (types[type] || 0) + 1;
      }
    }
    
    return {
      total: this._countTotalEdges(),
      avgWeight: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
      maxWeight: weights.length ? Math.max(...weights) : 0,
      typeDistribution: types
    };
  }
}

export default GraphDatabase;