import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GraphStats.css';

/**
 * GraphStats - Real-time analytics and performance monitoring
 * 
 * Features:
 * - Performance metrics with FPS counter
 * - Memory usage monitoring
 * - Graph statistics and clustering analysis
 * - Real-time updates with smooth animations
 * - Expandable detailed view
 */
export function GraphStats({ 
  graphEngine = null,
  nodeCount = 0,
  edgeCount = 0,
  isLayoutRunning = false,
  performanceMode = false,
  onPerformanceModeChange = null,
  className = '',
  isVisible = true 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fps, setFps] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [layoutIterations, setLayoutIterations] = useState(0);
  const [clusters, setClusters] = useState(0);
  const [density, setDensity] = useState(0);
  
  const fpsCounterRef = useRef(0);
  const lastFrameTime = useRef(performance.now());
  const frameCount = useRef(0);
  const animationFrameRef = useRef(null);

  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    fps: { good: 55, warning: 30, critical: 15 },
    memory: { good: 50, warning: 100, critical: 200 }, // MB
    renderTime: { good: 16, warning: 33, critical: 50 }, // ms
    nodes: { performance: 1000, warning: 2000, critical: 5000 }
  };

  // Calculate performance status
  const getPerformanceStatus = useCallback((value, thresholds) => {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'critical';
  }, []);

  // FPS Counter
  const updateFPS = useCallback(() => {
    const now = performance.now();
    frameCount.current++;
    
    if (now - lastFrameTime.current >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / (now - lastFrameTime.current)));
      frameCount.current = 0;
      lastFrameTime.current = now;
    }
    
    animationFrameRef.current = requestAnimationFrame(updateFPS);
  }, []);

  // Start/stop FPS monitoring
  useEffect(() => {
    if (isVisible) {
      animationFrameRef.current = requestAnimationFrame(updateFPS);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible, updateFPS]);

  // Memory usage monitoring
  useEffect(() => {
    const updateMemoryUsage = () => {
      if (performance.memory) {
        const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
        setMemoryUsage(Math.round(usedMB));
      }
    };

    const interval = setInterval(updateMemoryUsage, 2000);
    updateMemoryUsage(); // Initial call
    
    return () => clearInterval(interval);
  }, []);

  // Update stats from graph engine
  useEffect(() => {
    if (!graphEngine) return;

    const updateStats = () => {
      try {
        const stats = graphEngine.getStats();
        setRenderTime(stats.renderTime || 0);
        setLayoutIterations(stats.layoutIterations || 0);
        
        // Calculate graph density
        if (nodeCount > 1) {
          const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
          const currentDensity = (edgeCount / maxPossibleEdges) * 100;
          setDensity(Math.round(currentDensity * 100) / 100);
        } else {
          setDensity(0);
        }
        
        // Estimate clusters (simplified)
        const estimatedClusters = Math.max(1, Math.ceil(nodeCount / 10));
        setClusters(estimatedClusters);
        
      } catch (error) {
        console.warn('Failed to update graph stats:', error);
      }
    };

    const interval = setInterval(updateStats, 1000);
    updateStats(); // Initial call
    
    return () => clearInterval(interval);
  }, [graphEngine, nodeCount, edgeCount]);

  // Auto-enable performance mode based on thresholds
  useEffect(() => {
    const shouldEnablePerformanceMode = 
      fps < PERFORMANCE_THRESHOLDS.fps.warning ||
      nodeCount > PERFORMANCE_THRESHOLDS.nodes.performance ||
      memoryUsage > PERFORMANCE_THRESHOLDS.memory.warning;

    if (shouldEnablePerformanceMode && !performanceMode && onPerformanceModeChange) {
      onPerformanceModeChange(true);
    }
  }, [fps, nodeCount, memoryUsage, performanceMode, onPerformanceModeChange]);

  if (!isVisible) {
    return null;
  }

  const fpsStatus = getPerformanceStatus(fps, PERFORMANCE_THRESHOLDS.fps);
  const memoryStatus = getPerformanceStatus(
    PERFORMANCE_THRESHOLDS.memory.critical - memoryUsage, 
    { good: PERFORMANCE_THRESHOLDS.memory.critical - PERFORMANCE_THRESHOLDS.memory.good,
      warning: PERFORMANCE_THRESHOLDS.memory.critical - PERFORMANCE_THRESHOLDS.memory.warning,
      critical: 0 }
  );

  return (
    <div className={`graph-stats ${className} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Compact View */}
      <div className="stats-compact">
        <button 
          className="stats-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse stats' : 'Expand stats'}
        >
          <div className="stats-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v5h5" />
              <path d="M21 21v-5h-5" />
              <path d="M8 8l13 13" />
              <path d="M3 21l7.5-7.5" />
            </svg>
          </div>
          
          <div className="quick-stats">
            <div className={`stat-indicator fps ${fpsStatus}`}>
              <span className="stat-value">{fps}</span>
              <span className="stat-unit">fps</span>
            </div>
            
            <div className={`stat-indicator memory ${memoryStatus}`}>
              <span className="stat-value">{memoryUsage}</span>
              <span className="stat-unit">mb</span>
            </div>
            
            <div className="stat-indicator nodes">
              <span className="stat-value">{nodeCount.toLocaleString()}</span>
              <span className="stat-unit">nodes</span>
            </div>
          </div>
          
          <div className="expand-icon">
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className={isExpanded ? 'rotated' : ''}
            >
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </div>
        </button>
        
        {/* Performance Mode Indicator */}
        {performanceMode && (
          <div className="performance-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
            </svg>
            <span>Performance</span>
          </div>
        )}
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="stats-expanded">
          <div className="stats-header">
            <h4>Performance Analytics</h4>
            <div className="header-actions">
              <button 
                className={`performance-toggle ${performanceMode ? 'active' : ''}`}
                onClick={() => onPerformanceModeChange && onPerformanceModeChange(!performanceMode)}
                title="Toggle performance mode"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="stats-grid">
            {/* Rendering Performance */}
            <div className="stat-card">
              <div className="card-header">
                <h5>Rendering</h5>
                <div className={`status-dot ${fpsStatus}`}></div>
              </div>
              <div className="card-content">
                <div className="metric">
                  <span className="metric-label">FPS</span>
                  <span className={`metric-value ${fpsStatus}`}>{fps}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Frame Time</span>
                  <span className="metric-value">{renderTime.toFixed(1)}ms</span>
                </div>
              </div>
            </div>
            
            {/* Memory Usage */}
            <div className="stat-card">
              <div className="card-header">
                <h5>Memory</h5>
                <div className={`status-dot ${memoryStatus}`}></div>
              </div>
              <div className="card-content">
                <div className="metric">
                  <span className="metric-label">JS Heap</span>
                  <span className={`metric-value ${memoryStatus}`}>{memoryUsage}MB</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Status</span>
                  <span className="metric-value">
                    {memoryStatus === 'good' ? 'Optimal' : 
                     memoryStatus === 'warning' ? 'High' : 'Critical'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Graph Structure */}
            <div className="stat-card">
              <div className="card-header">
                <h5>Graph Structure</h5>
                <div className="status-dot good"></div>
              </div>
              <div className="card-content">
                <div className="metric">
                  <span className="metric-label">Nodes</span>
                  <span className="metric-value">{nodeCount.toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Edges</span>
                  <span className="metric-value">{edgeCount.toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Density</span>
                  <span className="metric-value">{density}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Clusters</span>
                  <span className="metric-value">{clusters}</span>
                </div>
              </div>
            </div>
            
            {/* Layout Engine */}
            <div className="stat-card">
              <div className="card-header">
                <h5>Layout Engine</h5>
                <div className={`status-dot ${isLayoutRunning ? 'warning' : 'good'}`}></div>
              </div>
              <div className="card-content">
                <div className="metric">
                  <span className="metric-label">Status</span>
                  <span className={`metric-value ${isLayoutRunning ? 'running' : 'idle'}`}>
                    {isLayoutRunning ? 'Computing' : 'Idle'}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Iterations</span>
                  <span className="metric-value">{layoutIterations.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Performance Recommendations */}
          {(fpsStatus !== 'good' || memoryStatus !== 'good' || nodeCount > PERFORMANCE_THRESHOLDS.nodes.warning) && (
            <div className="recommendations">
              <h5>Recommendations</h5>
              <div className="recommendation-list">
                {fpsStatus !== 'good' && (
                  <div className="recommendation warning">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Low FPS detected. Enable performance mode or reduce node count.
                  </div>
                )}
                {memoryStatus !== 'good' && (
                  <div className="recommendation critical">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    High memory usage. Consider filtering data or enabling performance mode.
                  </div>
                )}
                {nodeCount > PERFORMANCE_THRESHOLDS.nodes.warning && (
                  <div className="recommendation info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    Large graph detected. Performance mode is recommended for {nodeCount.toLocaleString()}+ nodes.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GraphStats;