/**
 * Simple EventEmitter implementation for plugin system
 */
export class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  /**
   * Register an event listener
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(listener)
    
    // Return unsubscribe function
    return () => this.off(event, listener)
  }

  /**
   * Register a one-time event listener
   */
  once(event, listener) {
    const onceListener = (...args) => {
      this.off(event, onceListener)
      listener(...args)
    }
    return this.on(event, onceListener)
  }

  /**
   * Remove an event listener
   */
  off(event, listener) {
    if (!this.events.has(event)) {
      return
    }
    
    const listeners = this.events.get(event)
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
    
    // Clean up empty event arrays
    if (listeners.length === 0) {
      this.events.delete(event)
    }
  }

  /**
   * Emit an event to all listeners
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false
    }
    
    const listeners = this.events.get(event).slice() // Clone to prevent issues with modifications during emit
    for (const listener of listeners) {
      try {
        listener(...args)
      } catch { }
    }
    
    return true
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
  }

  /**
   * Get all event names
   */
  eventNames() {
    return Array.from(this.events.keys())
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0
  }

  /**
   * Get all listeners for an event
   */
  listeners(event) {
    return this.events.has(event) ? this.events.get(event).slice() : []
  }
}