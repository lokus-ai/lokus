/**
 * Simple LRU (Least Recently Used) Cache implementation
 * Automatically evicts least recently used items when capacity is reached
 */
export class LRUCache {
  constructor(capacity = 200) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add new entry
    this.cache.set(key, value);

    // Evict least recently used if over capacity
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }

  // Convert to Map for React state compatibility
  toMap() {
    return new Map(this.cache);
  }

  // Create from Map
  static fromMap(map, capacity = 200) {
    const cache = new LRUCache(capacity);
    for (const [key, value] of map) {
      cache.set(key, value);
    }
    return cache;
  }
}
