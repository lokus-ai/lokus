/**
 * GraphPerformanceOptimizer - Optimizations for handling 1000+ nodes
 *
 * Key optimizations:
 * - Node culling (hide off-screen nodes)
 * - Level-of-detail (LOD) system
 * - Progressive loading
 * - Force simulation optimization
 * - Memory management
 */

export class GraphPerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      enableCulling: true,
      enableLOD: true,
      enableProgressive: true,
      performanceThreshold: 500, // Switch to performance mode above this node count
      cullingPadding: 100, // Pixels outside viewport to keep nodes
      lodThresholds: {
        high: 50,    // Full detail for < 50 nodes visible
        medium: 200, // Medium detail for < 200 nodes
        low: 500     // Low detail above 500 nodes
      },
      chunkSize: 100, // Load nodes in chunks
      maxRenderNodes: 5000, // Maximum nodes to render at once
      ...options
    };

    this.viewport = { x: 0, y: 0, width: 0, height: 0, zoom: 1 };
    this.visibleNodes = new Set();
    this.renderQueue = [];
    this.isOptimizing = false;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.fps = 60;
  }

  /**
   * Update viewport information
   */
  updateViewport(viewport) {
    this.viewport = { ...this.viewport, ...viewport };
  }

  /**
   * Check if a node is within the viewport (with padding)
   */
  isNodeVisible(node, padding = 0) {
    if (!node.x || !node.y) return true; // Show nodes without position

    const effectivePadding = padding || this.options.cullingPadding;
    const zoom = this.viewport.zoom || 1;

    // Calculate node bounds in screen space
    const screenX = (node.x - this.viewport.x) * zoom;
    const screenY = (node.y - this.viewport.y) * zoom;
    const nodeSize = (node.size || 5) * zoom;

    // Check if node is within viewport bounds (with padding)
    return (
      screenX + nodeSize >= -effectivePadding &&
      screenX - nodeSize <= this.viewport.width + effectivePadding &&
      screenY + nodeSize >= -effectivePadding &&
      screenY - nodeSize <= this.viewport.height + effectivePadding
    );
  }

  /**
   * Cull nodes outside viewport
   */
  cullNodes(nodes) {
    if (!this.options.enableCulling || nodes.length < this.options.performanceThreshold) {
      return nodes; // Don't cull for small datasets
    }

    const visibleNodes = [];
    const start = performance.now();

    for (const node of nodes) {
      if (this.isNodeVisible(node)) {
        visibleNodes.push(node);
        this.visibleNodes.add(node.id);
      } else {
        this.visibleNodes.delete(node.id);
      }
    }

    const duration = performance.now() - start;
    if (duration > 16) {
      console.warn(`[GraphOptimizer] Culling took ${duration.toFixed(2)}ms for ${nodes.length} nodes`);
    }

    console.log(`[GraphOptimizer] Showing ${visibleNodes.length} of ${nodes.length} nodes`);
    return visibleNodes;
  }

  /**
   * Get level of detail based on current state
   */
  getLODLevel(nodeCount, zoom = 1) {
    if (!this.options.enableLOD) return 'high';

    const visibleCount = this.visibleNodes.size;
    const { lodThresholds } = this.options;

    // Adjust LOD based on zoom level
    const zoomFactor = Math.max(0.5, Math.min(2, zoom));
    const adjustedCount = visibleCount / zoomFactor;

    if (adjustedCount < lodThresholds.high) return 'high';
    if (adjustedCount < lodThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Apply LOD settings to nodes
   */
  applyLOD(nodes, links) {
    const lodLevel = this.getLODLevel(nodes.length, this.viewport.zoom);

    const optimizedNodes = nodes.map(node => {
      const optimized = { ...node };

      switch (lodLevel) {
        case 'low':
          // Minimal rendering for low LOD
          optimized.renderLabel = false;
          optimized.renderDetails = false;
          optimized.size = Math.min(node.size || 5, 3);
          break;
        case 'medium':
          // Reduced details for medium LOD
          optimized.renderLabel = this.visibleNodes.has(node.id) && (node.selected || node.hovered);
          optimized.renderDetails = false;
          optimized.size = node.size || 5;
          break;
        case 'high':
        default:
          // Full details for high LOD
          optimized.renderLabel = true;
          optimized.renderDetails = true;
          optimized.size = node.size || 5;
          break;
      }

      return optimized;
    });

    // Optimize links based on LOD
    const optimizedLinks = links.map(link => {
      const optimized = { ...link };

      if (lodLevel === 'low') {
        optimized.width = 0.5;
        optimized.particles = 0;
      } else if (lodLevel === 'medium') {
        optimized.width = link.width || 1;
        optimized.particles = 0;
      }

      return optimized;
    });

    return { nodes: optimizedNodes, links: optimizedLinks, lodLevel };
  }

  /**
   * Progressive loading of nodes
   */
  async loadNodesProgressive(allNodes, onBatch) {
    if (!this.options.enableProgressive) {
      return onBatch(allNodes);
    }

    const chunks = [];
    const { chunkSize } = this.options;

    // Split nodes into chunks
    for (let i = 0; i < allNodes.length; i += chunkSize) {
      chunks.push(allNodes.slice(i, i + chunkSize));
    }

    console.log(`[GraphOptimizer] Loading ${allNodes.length} nodes in ${chunks.length} chunks`);

    // Load chunks progressively
    let loadedNodes = [];
    for (let i = 0; i < chunks.length; i++) {
      loadedNodes = [...loadedNodes, ...chunks[i]];

      // Call callback with current batch
      await onBatch(loadedNodes);

      // Add small delay between chunks to maintain responsiveness
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 16)); // One frame delay
      }
    }

    return loadedNodes;
  }

  /**
   * Optimize force simulation for large datasets
   */
  optimizeForceSimulation(simulation, nodeCount) {
    if (nodeCount < this.options.performanceThreshold) {
      // Standard settings for small graphs
      return {
        alphaDecay: 0.02,
        velocityDecay: 0.3,
        iterations: 1
      };
    }

    // Aggressive optimization for large graphs
    const settings = {
      alphaDecay: 0.05, // Faster cooling
      velocityDecay: 0.5, // More damping
      iterations: Math.max(1, Math.floor(300 / nodeCount)) // Fewer iterations
    };

    if (simulation) {
      simulation.alphaDecay(settings.alphaDecay);
      simulation.velocityDecay(settings.velocityDecay);

      // Stop simulation after initial layout for very large graphs
      if (nodeCount > 2000) {
        setTimeout(() => {
          simulation.stop();
          console.log('[GraphOptimizer] Stopped simulation for performance');
        }, 5000);
      }
    }

    return settings;
  }

  /**
   * Monitor and report performance
   */
  measurePerformance() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;

    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      this.fps = Math.round(1000 / delta);

      if (this.fps < 30) {
        console.warn(`[GraphOptimizer] Low FPS detected: ${this.fps}`);
        this.enableEmergencyOptimizations();
      }
    }

    this.lastFrameTime = now;
    return this.fps;
  }

  /**
   * Enable emergency optimizations when performance is critical
   */
  enableEmergencyOptimizations() {
    console.log('[GraphOptimizer] Enabling emergency optimizations');

    // Reduce quality settings
    this.options.cullingPadding = 0;
    this.options.lodThresholds.high = 20;
    this.options.lodThresholds.medium = 100;

    // Limit max render nodes
    this.options.maxRenderNodes = 1000;

    this.isOptimizing = true;
  }

  /**
   * Optimize graph data for rendering
   */
  optimizeGraphData(graphData) {
    const { nodes, links } = graphData;
    const nodeCount = nodes.length;

    // Skip optimization for small graphs
    if (nodeCount < 100) {
      return { ...graphData, optimized: false };
    }

    console.log(`[GraphOptimizer] Optimizing graph with ${nodeCount} nodes`);

    // Apply various optimizations
    let optimizedNodes = nodes;
    let optimizedLinks = links;

    // 1. Culling
    if (this.options.enableCulling) {
      optimizedNodes = this.cullNodes(optimizedNodes);

      // Filter links to only include visible nodes
      const visibleNodeIds = new Set(optimizedNodes.map(n => n.id));
      optimizedLinks = links.filter(link => {
        const sourceId = link.source?.id || link.source;
        const targetId = link.target?.id || link.target;
        return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      });
    }

    // 2. Apply LOD
    const lodResult = this.applyLOD(optimizedNodes, optimizedLinks);
    optimizedNodes = lodResult.nodes;
    optimizedLinks = lodResult.links;

    // 3. Limit max nodes if needed
    if (optimizedNodes.length > this.options.maxRenderNodes) {
      console.warn(`[GraphOptimizer] Limiting to ${this.options.maxRenderNodes} nodes`);
      optimizedNodes = optimizedNodes.slice(0, this.options.maxRenderNodes);

      // Update links accordingly
      const limitedNodeIds = new Set(optimizedNodes.map(n => n.id));
      optimizedLinks = optimizedLinks.filter(link => {
        const sourceId = link.source?.id || link.source;
        const targetId = link.target?.id || link.target;
        return limitedNodeIds.has(sourceId) && limitedNodeIds.has(targetId);
      });
    }

    // Monitor performance
    const fps = this.measurePerformance();

    return {
      nodes: optimizedNodes,
      links: optimizedLinks,
      metadata: {
        optimized: true,
        totalNodes: nodes.length,
        visibleNodes: optimizedNodes.length,
        totalLinks: links.length,
        visibleLinks: optimizedLinks.length,
        lodLevel: lodResult.lodLevel,
        fps,
        cullingEnabled: this.options.enableCulling,
        emergencyMode: this.isOptimizing
      }
    };
  }

  /**
   * Clean up and reset optimizer
   */
  reset() {
    this.visibleNodes.clear();
    this.renderQueue = [];
    this.isOptimizing = false;
    this.frameCount = 0;
    this.fps = 60;
  }

  /**
   * Get optimization recommendations based on current performance
   */
  getRecommendations(nodeCount, fps) {
    const recommendations = [];

    if (nodeCount > 5000) {
      recommendations.push('Consider filtering or aggregating nodes');
    }

    if (nodeCount > 1000 && fps < 30) {
      recommendations.push('Enable node culling');
      recommendations.push('Reduce force simulation iterations');
    }

    if (fps < 20) {
      recommendations.push('Switch to static layout');
      recommendations.push('Disable animations');
    }

    return recommendations;
  }
}

// Singleton instance
let optimizerInstance = null;

export function getGraphOptimizer(options) {
  if (!optimizerInstance) {
    optimizerInstance = new GraphPerformanceOptimizer(options);
  }
  return optimizerInstance;
}

export default GraphPerformanceOptimizer;