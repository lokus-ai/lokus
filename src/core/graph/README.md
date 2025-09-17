# Advanced Graph Performance Optimizations

This document describes the advanced performance optimization system implemented for the Lokus graph view, designed to handle massive graphs with 10,000+ nodes smoothly.

## 🚀 Performance Features

### Core Optimizations
- **WebGL Rendering**: Hardware-accelerated rendering for maximum performance
- **Viewport Culling**: Only render visible nodes and edges (10,000+ node support)
- **Level of Detail (LOD)**: Adaptive quality based on zoom level and performance
- **Barnes-Hut Physics**: O(n log n) force simulation for large graphs
- **Progressive Rendering**: Chunked rendering to maintain smooth interactions
- **Aggressive Caching**: Multi-layer caching with TTL and size limits
- **Memory Pooling**: Reusable objects to reduce garbage collection

### Anti-Lag System
- **Adaptive Frame Rate**: Automatic frame skipping during performance drops
- **Emergency Modes**: Automatic quality degradation when performance is critical
- **Memory Management**: Active memory monitoring and cleanup
- **Batch Processing**: Efficient batching of graph operations
- **Background Workers**: Heavy calculations moved to Web Workers

## 📁 Architecture

```
src/core/graph/
├── GraphEngine.js          # Core graph engine with caching
├── GraphDataProcessor.js   # Data processing and extraction
├── PerformanceManager.js   # WebGL optimizations and LOD
├── AntiLagManager.js      # Anti-lag features and emergency modes
├── GraphWorker.js         # Web Worker for background calculations
└── index.js              # Main exports and utilities
```

## 🔧 Usage Examples

### Basic Optimized Graph

```javascript
import { GraphEngine } from './core/graph';

// Create optimized graph engine
const container = document.getElementById('graph-container');
const engine = new GraphEngine(container, {
  maxNodes: 50000,
  stopPhysicsWhenStable: true,
  stabilityThreshold: 0.001
});

// Initialize with performance optimizations
await engine.initialize();
```

### Maximum Performance Graph

```javascript
import GraphSystem from './core/graph';

// Create graph with maximum performance optimizations
const engine = GraphSystem.createPerformanceOptimizedGraph(container, {
  maxNodes: 100000,
  barnesHutOptimize: true,
  viewportCulling: true,
  emergencyMode: true
});

await engine.initialize();
```

### Manual Performance Management

```javascript
import { GraphEngine, PerformanceManager, AntiLagManager } from './core/graph';

const engine = new GraphEngine(container);
await engine.initialize();

// Add performance manager for advanced optimizations
const performanceManager = new PerformanceManager(engine);

// Add anti-lag manager for emergency handling
const antiLagManager = new AntiLagManager(engine, performanceManager);

// Monitor performance
setInterval(() => {
  const report = antiLagManager.getPerformanceReport();
  console.log('Performance:', report.summary);
}, 5000);
```

## ⚡ Performance Modes

### Normal Mode (< 1,000 nodes)
- Full quality rendering
- All effects enabled
- Standard physics simulation
- No performance restrictions

### Warning Mode (1,000 - 5,000 nodes)
- Reduced LOD at distance
- Frame skipping if needed (10%)
- Increased culling aggressiveness
- Batched updates enabled

### Critical Mode (5,000 - 15,000 nodes)
- Significant quality reduction
- Frame skipping (20%)
- Aggressive viewport culling
- Physics simulation may pause
- Smaller batch sizes

### Emergency Mode (> 15,000 nodes or FPS < 10)
- Minimum quality rendering
- Maximum frame skipping (50%)
- Rendering may pause temporarily
- Automatic cache cleanup
- Memory pressure relief

## 🎛️ Configuration Options

### PerformanceManager Settings

```javascript
const performanceManager = new PerformanceManager(engine);

// Adjust LOD thresholds
performanceManager.lodSettings.highDetailZoom = 1.0;
performanceManager.lodSettings.mediumDetailZoom = 0.5;
performanceManager.lodSettings.lowDetailZoom = 0.2;

// Configure viewport culling
performanceManager.viewportCulling.enabled = true;
performanceManager.viewportCulling.margin = 0.2; // 20% margin

// Physics optimization
performanceManager.physicsOptimization.barnesHutOptimize = true;
performanceManager.physicsOptimization.barnesHutTheta = 0.5;
```

### AntiLagManager Settings

```javascript
const antiLagManager = new AntiLagManager(engine, performanceManager);

// Set performance thresholds
antiLagManager.thresholds.criticalFPS = 15;
antiLagManager.thresholds.warningFPS = 25;
antiLagManager.thresholds.memoryLimit = 512 * 1024 * 1024; // 512MB

// Configure adaptive systems
antiLagManager.adaptive.frameSkipping.enabled = true;
antiLagManager.adaptive.levelOfDetail.adjustmentSpeed = 0.1;
```

### Cache Configuration

```javascript
// Configure aggressive caching
engine.cache.maxCacheAge = 300000; // 5 minutes
engine.cache.maxCacheSize = 1000;   // 1000 items
engine.cache.enabled = true;

// Manual cache control
engine.setCacheEnabled(true);
engine.forceCacheCleanup();

// Monitor cache performance
const cacheStats = engine.getCacheStats();
console.log('Cache hit ratio:', cacheStats.hitRatio);
```

## 📊 Performance Monitoring

### Real-time Metrics

```javascript
// Get current performance state
const metrics = performanceManager.getMetrics();
console.log('FPS:', metrics.fps);
console.log('Visible nodes:', metrics.visibleNodes);
console.log('Memory usage:', metrics.memoryUsage);

// Get anti-lag status
const status = antiLagManager.getStatus();
console.log('Performance mode:', status.state.mode);
console.log('Emergency active:', status.emergency.active);

// Get detailed performance report
const report = antiLagManager.getPerformanceReport();
console.log('Performance report:', report);
```

### Event Monitoring

```javascript
// Listen for performance events
engine.on('performanceModeChanged', (event) => {
  console.log(`Mode changed: ${event.oldMode} → ${event.newMode}`);
});

engine.on('layoutCompleted', (event) => {
  console.log('Layout completed:', event);
});

engine.on('metricsCalculated', (event) => {
  console.log('Graph metrics:', event.metrics);
});
```

## 🔧 Troubleshooting

### Poor Performance Symptoms
- FPS dropping below 30
- Laggy interactions
- Browser becomes unresponsive
- High memory usage

### Solutions

1. **Enable Emergency Mode**
   ```javascript
   antiLagManager.enableEmergencyMode();
   ```

2. **Reduce Node Count**
   ```javascript
   // Filter to most important nodes
   const importantNodes = nodes.filter(node => node.importance > 0.5);
   ```

3. **Adjust Quality Settings**
   ```javascript
   performanceManager.setQualityLevel('low');
   ```

4. **Clear Caches**
   ```javascript
   engine.forceCacheCleanup();
   ```

5. **Check Memory Usage**
   ```javascript
   if (performance.memory.usedJSHeapSize > 500 * 1024 * 1024) {
     antiLagManager.handleMemoryPressure(performance.memory);
   }
   ```

## 🎯 Best Practices

### For Large Graphs (10,000+ nodes)
1. Always enable viewport culling
2. Use Barnes-Hut physics optimization
3. Enable progressive rendering
4. Set appropriate LOD thresholds
5. Monitor memory usage actively

### For Maximum Performance
1. Use the `createPerformanceOptimizedGraph` utility
2. Enable anti-lag manager
3. Set conservative performance thresholds
4. Use Web Workers for heavy calculations
5. Implement custom culling strategies

### Memory Management
1. Enable automatic cache cleanup
2. Set reasonable cache size limits
3. Use memory pools for frequent allocations
4. Monitor for memory leaks
5. Force cleanup during idle periods

## 📈 Performance Benchmarks

Expected performance with optimizations enabled:

| Node Count | FPS (Target) | Memory Usage | Features Enabled |
|------------|--------------|--------------|------------------|
| 1,000      | 60 FPS       | < 50MB      | All features     |
| 5,000      | 45+ FPS      | < 100MB     | LOD + Culling    |
| 10,000     | 30+ FPS      | < 200MB     | All optimizations|
| 25,000     | 20+ FPS      | < 400MB     | Emergency mode   |
| 50,000+    | 15+ FPS      | < 600MB     | Maximum optimizations |

## 🔬 Advanced Features

### Custom Performance Strategies

```javascript
// Implement custom emergency strategy
antiLagManager.emergency.strategies.push('customOptimization');

// Add custom strategy handler
antiLagManager.applyCustomStrategy = () => {
  // Your custom optimization logic
};
```

### Web Worker Integration

```javascript
// Send graph data to worker for heavy calculations
engine.sendWorkerMessage('calculateMetrics', {
  degreeCentrality: true,
  betweennessCentrality: true
});

// Handle worker results
engine.on('metricsCalculated', (metrics) => {
  console.log('Centrality calculated in background:', metrics);
});
```

### Progressive Loading

```javascript
// Load graph data progressively
async function loadLargeGraph(graphData) {
  const batchSize = 1000;
  
  for (let i = 0; i < graphData.nodes.length; i += batchSize) {
    const batch = graphData.nodes.slice(i, i + batchSize);
    
    // Add batch with performance monitoring
    for (const node of batch) {
      engine.addNodeOptimized(node.id, node.attributes);
    }
    
    // Pause between batches to maintain responsiveness
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
```

This performance optimization system makes the graph view production-ready for handling massive datasets while maintaining smooth user interactions.