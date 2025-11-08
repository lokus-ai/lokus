import { invoke } from '@tauri-apps/api/core';

/**
 * Performance Tracker - Lightweight instrumentation with async batching
 *
 * Features:
 * - Async batching: Events sent in batches every 100ms (not per-event)
 * - Sampling support: For high-frequency operations
 * - Zero blocking: All logging is async
 * - Automatic error handling
 * - Thread-safe timer management
 */
class PerformanceTracker {
  constructor() {
    this.timers = new Map();
    this.eventQueue = [];
    this.batchInterval = 100; // ms
    this.flushTimer = null;
    this.enabled = true;
    this.sampleRates = new Map(); // operation -> sample rate
    this.sampleCounters = new Map(); // operation -> current count

    // Start batch flushing
    this.startBatchFlushing();
  }

  /**
   * Enable/disable performance tracking globally
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      this.eventQueue = [];
    } else if (enabled && !this.flushTimer) {
      this.startBatchFlushing();
    }
  }

  /**
   * Set sample rate for a specific operation (0-1)
   * E.g., 0.1 = track 1 in 10 occurrences
   */
  setSampleRate(operation, rate) {
    this.sampleRates.set(operation, Math.max(0, Math.min(1, rate)));
    this.sampleCounters.set(operation, 0);
  }

  /**
   * Check if we should sample this operation
   */
  shouldSample(operation) {
    const rate = this.sampleRates.get(operation);
    if (rate === undefined) return true; // No sampling = always track

    if (rate === 0) return false; // Never track
    if (rate === 1) return true; // Always track

    // Deterministic sampling based on counter
    const counter = this.sampleCounters.get(operation) || 0;
    const interval = Math.floor(1 / rate);
    const shouldSample = counter % interval === 0;

    this.sampleCounters.set(operation, counter + 1);
    return shouldSample;
  }

  /**
   * Start periodic batch flushing
   */
  startBatchFlushing() {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.batchInterval);
  }

  /**
   * Flush queued events to backend in a single batch
   */
  async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, this.eventQueue.length);

    try {
      await invoke('monitor_log_performance_events_batch', {
        events: batch
      });
    } catch (e) {
      // Silent failure - don't let performance tracking break the app
      if (import.meta.env.DEV) {
        console.warn('Failed to log performance batch:', e);
      }
    }
  }

  /**
   * Queue an event for batched sending
   */
  queueEvent(eventType, operation, durationMs, metadata = null) {
    if (!this.enabled) return;
    if (!this.shouldSample(operation)) return;

    this.eventQueue.push({
      event_type: eventType,
      operation,
      duration_ms: durationMs,
      metadata: metadata ? JSON.stringify(metadata) : null
    });
  }

  /**
   * Start a timer for an operation
   */
  startTimer(label) {
    if (!this.enabled) return;
    this.timers.set(label, performance.now());
  }

  /**
   * End a timer and queue the event
   */
  endTimer(label, eventType = 'operation', metadata = null) {
    if (!this.enabled) return;

    const start = this.timers.get(label);
    if (!start) return;

    const duration = Math.round(performance.now() - start);
    this.timers.delete(label);

    this.queueEvent(eventType, label, duration, metadata);
  }

  /**
   * Track an async operation (returns result, queues timing)
   */
  async trackAsync(label, fn, eventType = 'operation', metadata = null) {
    if (!this.enabled) {
      return await fn();
    }

    const start = performance.now();
    let error = null;

    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.queueEvent(eventType, label, duration, metadata);
      return result;
    } catch (e) {
      error = e;
      const duration = Math.round(performance.now() - start);
      this.queueEvent(eventType, label, duration, {
        ...metadata,
        error: e.message
      });
      throw e;
    }
  }

  /**
   * Track a synchronous operation (returns result, queues timing)
   */
  trackSync(label, fn, eventType = 'operation', metadata = null) {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();

    try {
      const result = fn();
      const duration = Math.round(performance.now() - start);
      this.queueEvent(eventType, label, duration, metadata);
      return result;
    } catch (e) {
      const duration = Math.round(performance.now() - start);
      this.queueEvent(eventType, label, duration, {
        ...metadata,
        error: e.message
      });
      throw e;
    }
  }

  /**
   * Log a custom event (when you already know the duration)
   */
  logEvent(eventType, operation, durationMs, metadata = null) {
    if (!this.enabled) return;
    this.queueEvent(eventType, operation, durationMs, metadata);
  }

  /**
   * Mark a startup phase completion
   * This immediately flushes to backend (not batched) for accurate startup metrics
   */
  async markStartupPhase(name, durationMs) {
    if (!this.enabled) return;

    try {
      await invoke('monitor_add_startup_phase', {
        name,
        durationMs
      });
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('Failed to mark startup phase:', e);
      }
    }
  }

  /**
   * Cleanup - flush remaining events before app closes
   */
  async cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushEvents();
  }
}

// Singleton instance
export const perfTracker = new PerformanceTracker();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    perfTracker.cleanup();
  });
}

// Common sample rates for high-frequency operations
export const SAMPLE_RATES = {
  NEVER: 0,
  RARE: 0.01,      // 1 in 100
  OCCASIONAL: 0.1,  // 1 in 10
  FREQUENT: 0.5,    // 1 in 2
  ALWAYS: 1,        // Every time
};

// Event type constants
export const EVENT_TYPES = {
  MODULE_INIT: 'module_init',
  COMPONENT_RENDER: 'component_render',
  API_CALL: 'api_call',
  FILE_OP: 'file_op',
  USER_ACTION: 'user_action',
  SEARCH: 'search',
  PLUGIN_ACTION: 'plugin_action',
  CANVAS_OP: 'canvas_op',
  GRAPH_OP: 'graph_op',
  DATABASE_OP: 'database_op',
};
