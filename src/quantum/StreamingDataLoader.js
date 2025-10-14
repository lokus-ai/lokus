/**
 * StreamingDataLoader.js
 *
 * High-performance streaming data loader with async iteration
 * Replaces synchronous getAllFiles() with progressive loading
 */

import { invoke } from '@tauri-apps/api/core';

export class StreamingDataLoader {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 50;
    this.preloadNext = options.preloadNext !== false;
    this.cache = new Map();
    this.loadingQueue = [];
    this.abortController = null;
  }

  /**
   * Async generator for streaming files
   * Yields files in chunks for progressive rendering
   */
  async *streamFiles(directory, options = {}) {
    const {
      filter = () => true,
      sortBy = 'name',
      limit = Infinity,
      includeContent = false
    } = options;

    try {
      // Get file list without content first (fast)
      const fileList = await invoke('get_file_list', {
        directory,
        recursive: true,
        metadataOnly: !includeContent
      });

      // Sort files
      const sorted = this.sortFiles(fileList, sortBy);

      // Stream in chunks
      let count = 0;
      for (let i = 0; i < sorted.length && count < limit; i += this.chunkSize) {
        const chunk = sorted.slice(i, Math.min(i + this.chunkSize, sorted.length));

        // Apply filter
        const filtered = chunk.filter(filter);

        // If content needed, load it progressively
        if (includeContent) {
          const withContent = await this.loadContent(filtered);
          yield* withContent;
        } else {
          yield* filtered;
        }

        count += filtered.length;

        // Preload next chunk in background
        if (this.preloadNext && i + this.chunkSize < sorted.length) {
          this.preloadChunk(sorted, i + this.chunkSize, filter, includeContent);
        }
      }
    } catch (error) {
      console.error('[StreamingDataLoader] Error streaming files:', error);
      throw error;
    }
  }

  /**
   * Load file content progressively
   */
  async loadContent(files) {
    const results = [];

    for (const file of files) {
      // Check cache first
      if (this.cache.has(file.path)) {
        results.push(this.cache.get(file.path));
        continue;
      }

      try {
        // Load content asynchronously
        const content = await this.loadFileContent(file.path);
        const fileWithContent = { ...file, content };

        // Cache result
        this.cache.set(file.path, fileWithContent);
        results.push(fileWithContent);
      } catch (error) {
        console.warn(`Failed to load content for ${file.path}:`, error);
        results.push(file); // Return without content on error
      }
    }

    return results;
  }

  /**
   * Load single file content with optimizations
   */
  async loadFileContent(path) {
    // Check if file is too large
    const stats = await invoke('get_file_stats', { path });

    if (stats.size > 1024 * 1024) { // > 1MB
      // For large files, only load first portion
      return await invoke('read_file_partial', {
        path,
        offset: 0,
        length: 1024 * 100 // First 100KB
      });
    }

    // Load full content for small files
    return await invoke('read_text_file', { path });
  }

  /**
   * Preload next chunk in background
   */
  async preloadChunk(files, startIndex, filter, includeContent) {
    const chunk = files.slice(startIndex, startIndex + this.chunkSize);
    const filtered = chunk.filter(filter);

    if (includeContent) {
      // Queue for background loading
      this.loadingQueue.push(...filtered.map(f => f.path));
      this.processLoadingQueue();
    }
  }

  /**
   * Process loading queue with concurrency control
   */
  async processLoadingQueue() {
    const MAX_CONCURRENT = 3;
    const processing = new Set();

    while (this.loadingQueue.length > 0 || processing.size > 0) {
      // Start new loads up to max concurrent
      while (processing.size < MAX_CONCURRENT && this.loadingQueue.length > 0) {
        const path = this.loadingQueue.shift();

        if (this.cache.has(path)) continue;

        const loadPromise = this.loadFileContent(path)
          .then(content => {
            this.cache.set(path, content);
            processing.delete(loadPromise);
          })
          .catch(error => {
            console.warn(`Preload failed for ${path}:`, error);
            processing.delete(loadPromise);
          });

        processing.add(loadPromise);
      }

      // Wait for at least one to complete
      if (processing.size > 0) {
        await Promise.race(processing);
      }
    }
  }

  /**
   * Sort files by different criteria
   */
  sortFiles(files, sortBy) {
    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name),
      size: (a, b) => (b.size || 0) - (a.size || 0),
      modified: (a, b) => (b.modified || 0) - (a.modified || 0),
      created: (a, b) => (b.created || 0) - (a.created || 0),
      type: (a, b) => (a.extension || '').localeCompare(b.extension || '')
    };

    const sorter = sorters[sortBy] || sorters.name;
    return [...files].sort(sorter);
  }

  /**
   * Stream search results progressively
   */
  async *streamSearch(query, options = {}) {
    const {
      searchIn = 'all', // 'all', 'name', 'content'
      caseSensitive = false,
      regex = false,
      limit = 100
    } = options;

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Use Rust backend for fast searching
      const searchStream = await invoke('stream_search', {
        query,
        searchIn,
        caseSensitive,
        regex,
        signal: this.abortController.signal
      });

      let count = 0;
      for await (const result of searchStream) {
        if (count >= limit) break;

        yield result;
        count++;
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[StreamingDataLoader] Search error:', error);
        throw error;
      }
    }
  }

  /**
   * Cancel ongoing operations
   */
  cancel() {
    this.abortController?.abort();
    this.loadingQueue = [];
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      memoryUsage: this.estimateCacheMemory(),
      queueLength: this.loadingQueue.length
    };
  }

  /**
   * Estimate cache memory usage
   */
  estimateCacheMemory() {
    let bytes = 0;
    for (const [key, value] of this.cache) {
      bytes += key.length * 2; // UTF-16 string
      if (value.content) {
        bytes += value.content.length * 2;
      }
      bytes += JSON.stringify(value).length;
    }
    return bytes;
  }
}

/**
 * React hook for streaming data
 */
export function useStreamingData(directory, options = {}) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const loaderRef = React.useRef(null);

  React.useEffect(() => {
    const loader = new StreamingDataLoader(options);
    loaderRef.current = loader;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const results = [];

        for await (const item of loader.streamFiles(directory, options)) {
          results.push(item);

          // Update UI progressively
          if (results.length % loader.chunkSize === 0) {
            setData([...results]);
          }
        }

        setData(results);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      loader.cancel();
    };
  }, [directory, JSON.stringify(options)]);

  return { data, loading, error, loader: loaderRef.current };
}

export default StreamingDataLoader;