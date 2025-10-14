/**
 * PerformanceMonitor.js
 *
 * Advanced performance monitoring system with quantum metrics
 * Tracks performance, memory, and custom quantum-inspired metrics
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Set();
    this.isRecording = false;
    this.quantumMetrics = {
      superpositionStates: 0,
      waveFunctionCollapses: 0,
      entanglements: 0,
      quantumSearches: 0,
      coherenceTime: 0,
      decoherenceEvents: 0
    };

    // Initialize performance observers
    this.initObservers();
  }

  /**
   * Initialize performance observers
   */
  initObservers() {
    // Long task observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('longTask', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.add(longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }

      // Layout shift observer
      try {
        const layoutObserver = new PerformanceObserver((list) => {
          let cls = 0;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          }
          this.recordMetric('layoutShift', { value: cls });
        });
        layoutObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.add(layoutObserver);
      } catch (e) {
        console.warn('Layout shift observer not supported');
      }

      // Resource timing observer
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('resource', {
              name: entry.name,
              duration: entry.duration,
              size: entry.transferSize,
              type: entry.initiatorType
            });
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.add(resourceObserver);
      } catch (e) {
        console.warn('Resource observer not supported');
      }
    }

    // Memory monitoring
    if ('memory' in performance) {
      setInterval(() => {
        this.recordMetric('memory', {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        });
      }, 5000);
    }
  }

  /**
   * Start performance recording
   */
  startRecording() {
    this.isRecording = true;
    this.metrics.clear();
    performance.mark('recording-start');
  }

  /**
   * Stop recording and generate report
   */
  stopRecording() {
    this.isRecording = false;
    performance.mark('recording-end');
    performance.measure('recording-duration', 'recording-start', 'recording-end');

    return this.generateReport();
  }

  /**
   * Mark a performance event
   */
  mark(name, metadata = {}) {
    performance.mark(name);
    this.recordMetric('mark', { name, ...metadata });
  }

  /**
   * Measure between two marks
   */
  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];

      this.recordMetric('measure', {
        name,
        duration: measure.duration,
        startTime: measure.startTime
      });

      return measure.duration;
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
      return 0;
    }
  }

  /**
   * Record a metric
   */
  recordMetric(type, data) {
    if (!this.isRecording && type !== 'quantum') return;

    const timestamp = performance.now();
    const metric = {
      type,
      timestamp,
      data
    };

    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    this.metrics.get(type).push(metric);

    // Emit to listeners
    this.emit('metric', metric);
  }

  /**
   * Record quantum metrics
   */
  recordQuantumMetric(type, value = 1) {
    if (this.quantumMetrics.hasOwnProperty(type)) {
      this.quantumMetrics[type] += value;
      this.recordMetric('quantum', { type, value, total: this.quantumMetrics[type] });
    }
  }

  /**
   * Track component render time
   */
  trackComponentRender(componentName) {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;

    return {
      start: () => this.mark(startMark),
      end: () => {
        this.mark(endMark);
        return this.measure(`${componentName}-render`, startMark, endMark);
      }
    };
  }

  /**
   * Track async operation
   */
  async trackAsync(name, operation) {
    const start = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - start;

      this.recordMetric('async', {
        name,
        duration,
        status: 'success'
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.recordMetric('async', {
        name,
        duration,
        status: 'error',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get FPS (Frames Per Second)
   */
  getFPS() {
    return new Promise(resolve => {
      let lastTime = performance.now();
      let frames = 0;
      let fps = 0;

      const measureFPS = () => {
        frames++;
        const currentTime = performance.now();

        if (currentTime >= lastTime + 1000) {
          fps = Math.round(frames * 1000 / (currentTime - lastTime));
          resolve(fps);
        } else {
          requestAnimationFrame(measureFPS);
        }
      };

      requestAnimationFrame(measureFPS);
    });
  }

  /**
   * Calculate Web Vitals
   */
  getWebVitals() {
    const entries = performance.getEntries();
    const navigation = entries.find(e => e.entryType === 'navigation');

    return {
      // First Contentful Paint
      FCP: this.getMetricValue('first-contentful-paint'),
      // Largest Contentful Paint
      LCP: this.getMetricValue('largest-contentful-paint'),
      // Time to Interactive
      TTI: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
      // Total Blocking Time
      TBT: this.calculateTBT(),
      // Cumulative Layout Shift
      CLS: this.calculateCLS()
    };
  }

  /**
   * Get metric value
   */
  getMetricValue(name) {
    const entries = performance.getEntriesByName(name);
    return entries.length > 0 ? entries[entries.length - 1].startTime : 0;
  }

  /**
   * Calculate Total Blocking Time
   */
  calculateTBT() {
    const longTasks = this.metrics.get('longTask') || [];
    return longTasks.reduce((total, task) => {
      return total + Math.max(0, task.data.duration - 50);
    }, 0);
  }

  /**
   * Calculate Cumulative Layout Shift
   */
  calculateCLS() {
    const shifts = this.metrics.get('layoutShift') || [];
    return shifts.reduce((total, shift) => total + shift.data.value, 0);
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      timestamp: Date.now(),
      duration: performance.now(),
      metrics: Object.fromEntries(this.metrics),
      webVitals: this.getWebVitals(),
      quantum: this.quantumMetrics,
      memory: this.getMemoryStats(),
      summary: this.generateSummary()
    };

    console.log('🚀 Performance Report:', report);
    return report;
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    if (!performance.memory) return null;

    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.totalJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;

    return {
      used: this.formatBytes(used),
      total: this.formatBytes(total),
      limit: this.formatBytes(limit),
      usage: ((used / total) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const marks = this.metrics.get('mark') || [];
    const measures = this.metrics.get('measure') || [];
    const asyncOps = this.metrics.get('async') || [];

    return {
      totalMarks: marks.length,
      totalMeasures: measures.length,
      averageMeasureDuration: this.average(measures.map(m => m.data.duration)),
      totalAsyncOps: asyncOps.length,
      failedAsyncOps: asyncOps.filter(a => a.data.status === 'error').length,
      averageAsyncDuration: this.average(asyncOps.map(a => a.data.duration)),
      quantumOperations: Object.values(this.quantumMetrics).reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Calculate average
   */
  average(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Event emitter functionality
   */
  on(event, callback) {
    if (!this.listeners) this.listeners = new Map();
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
  }

  emit(event, data) {
    if (!this.listeners?.has(event)) return;
    this.listeners.get(event).forEach(callback => callback(data));
  }

  /**
   * Cleanup
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
  }
}

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitor() {
  const monitorRef = React.useRef(null);
  const [metrics, setMetrics] = React.useState({});

  React.useEffect(() => {
    const monitor = new PerformanceMonitor();
    monitorRef.current = monitor;

    // Listen for metric updates
    monitor.on('metric', (metric) => {
      setMetrics(prev => ({
        ...prev,
        [metric.type]: metric.data
      }));
    });

    // Start recording
    monitor.startRecording();

    return () => {
      monitor.stopRecording();
      monitor.destroy();
    };
  }, []);

  return {
    monitor: monitorRef.current,
    metrics,
    mark: (name) => monitorRef.current?.mark(name),
    measure: (name, start, end) => monitorRef.current?.measure(name, start, end),
    trackAsync: (name, op) => monitorRef.current?.trackAsync(name, op),
    recordQuantum: (type, value) => monitorRef.current?.recordQuantumMetric(type, value),
    getReport: () => monitorRef.current?.generateReport()
  };
}

// Global instance for easy access
export const globalMonitor = new PerformanceMonitor();

export default PerformanceMonitor;