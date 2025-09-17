/**
 * Graph Core Module - Main exports for the Lokus graph system
 * 
 * This module provides the complete graph processing and visualization system with
 * advanced performance optimizations for handling massive graphs smoothly:
 * 
 * Core Components:
 * - GraphEngine: Handles Sigma.js visualization and rendering with caching
 * - GraphDataProcessor: Processes workspace files and extracts graph data
 * 
 * Performance Systems:
 * - PerformanceManager: WebGL optimizations, viewport culling, LOD rendering
 * - AntiLagManager: Anti-lag features, adaptive performance, emergency modes
 * - GraphWorker: Web Worker for background calculations (force simulation, analytics)
 * 
 * Features:
 * - Viewport culling for 10,000+ nodes
 * - Level of Detail (LOD) rendering
 * - Barnes-Hut physics optimization
 * - Progressive rendering and batching
 * - Aggressive caching with TTL
 * - Memory pool management
 * - Automatic quality adjustment
 * - Emergency performance modes
 */

// Core components
export { GraphEngine } from './GraphEngine.js';
export { GraphDataProcessor } from './GraphDataProcessor.js';

// Performance optimization components
export { PerformanceManager } from './PerformanceManager.js';
export { AntiLagManager } from './AntiLagManager.js';

// Re-export default classes for convenience
import { GraphEngine } from './GraphEngine.js';
import { GraphDataProcessor } from './GraphDataProcessor.js';
import { PerformanceManager } from './PerformanceManager.js';
import { AntiLagManager } from './AntiLagManager.js';

/**
 * Default export object with all graph system components
 */
export default {
  // Core components
  GraphEngine,
  GraphDataProcessor,
  
  // Performance components
  PerformanceManager,
  AntiLagManager,
  
  // Utility functions
  createOptimizedGraphEngine: (container, options = {}) => {
    const engine = new GraphEngine(container, {
      maxNodes: 50000,              // Support up to 50k nodes
      stopPhysicsWhenStable: true,
      stabilityThreshold: 0.001,
      ...options
    });
    
    return engine;
  },
  
  createPerformanceOptimizedGraph: (container, options = {}) => {
    const engine = new GraphEngine(container, {
      maxNodes: 100000,             // Support up to 100k nodes
      stopPhysicsWhenStable: true,
      stabilityThreshold: 0.005,    // More lenient for large graphs
      ...options
    });
    
    // Initialize with AntiLagManager for maximum performance
    engine.on('initialized', () => {
      if (engine.performanceManager) {
        engine.antiLagManager = new AntiLagManager(engine, engine.performanceManager);
      }
    });
    
    return engine;
  }
};