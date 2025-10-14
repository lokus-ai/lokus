/**
 * LRUCache.js
 *
 * Least Recently Used (LRU) cache implementation for quantum observations.
 * Optimized for high-performance caching of collapsed quantum states.
 */

export class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get value from cache
   */
  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      // Move to end (most recently used)
      this.updateAccessOrder(key);
      return this.cache.get(key);
    }

    this.misses++;
    return null;
  }

  /**
   * Set value in cache
   */
  set(key, value) {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    // Check if we need to evict
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new item
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete from cache
   */
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return true;
    }
    return false;
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      utilization: this.cache.size / this.maxSize
    };
  }

  /**
   * Private: Update access order
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Private: Remove from access order
   */
  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Private: Evict least recently used item
   */
  evictLRU() {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
    }
  }

  /**
   * Get current cache size
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Iterator for cache entries
   */
  *entries() {
    for (const [key, value] of this.cache.entries()) {
      yield [key, value];
    }
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values() {
    return Array.from(this.cache.values());
  }
}

export default LRUCache;