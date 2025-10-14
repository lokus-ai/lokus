/**
 * QuantumSearchSystem.js
 *
 * Integrated quantum-inspired search system
 * Combines QuantumSuperpositionIndex, NeuralSemanticCache, and VectorDatabase
 * for ultra-fast, intelligent search across large knowledge bases
 */

import { QuantumSuperpositionIndex } from './QuantumSuperpositionIndex.js';
import { NeuralSemanticCache } from './NeuralSemanticCache.js';
import { VectorDatabase } from './vector/VectorDatabase.js';
import { StreamingDataLoader } from './StreamingDataLoader.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';

export class QuantumSearchSystem {
  constructor(options = {}) {
    this.options = {
      dimensions: options.dimensions || 768,
      cacheSize: options.cacheSize || 1000,
      quantumIndexSize: options.quantumIndexSize || 10000,
      useWebWorker: options.useWebWorker !== false,
      ...options
    };

    // Initialize quantum components
    this.quantumIndex = new QuantumSuperpositionIndex(this.options.quantumIndexSize);
    this.semanticCache = new NeuralSemanticCache({
      dimensions: this.options.dimensions,
      cacheSize: this.options.cacheSize
    });
    this.vectorDB = new VectorDatabase(this.options.dimensions);
    this.dataLoader = new StreamingDataLoader();
    this.monitor = new PerformanceMonitor();

    // Initialize web worker for heavy computations
    if (this.options.useWebWorker && typeof Worker !== 'undefined') {
      this.searchWorker = new Worker(
        new URL('./workers/searchWorker.js', import.meta.url),
        { type: 'module' }
      );
      this.setupWorker();
    }

    // Statistics
    this.stats = {
      totalSearches: 0,
      quantumCollapses: 0,
      cacheHits: 0,
      averageLatency: 0,
      quantumSpeedup: 1
    };
  }

  /**
   * Initialize the system with documents
   */
  async initialize(documentsPath) {
    this.monitor.startRecording();
    this.monitor.mark('initialization-start');

    console.log('[QuantumSearch] Initializing system...');

    try {
      // Stream documents progressively
      let count = 0;
      const startTime = performance.now();

      for await (const doc of this.dataLoader.streamFiles(documentsPath, {
        includeContent: false, // Load metadata only initially
        chunkSize: 100
      })) {
        // Add to quantum index (superposition state)
        await this.quantumIndex.addDocument({
          id: doc.path,
          content: doc.name,
          metadata: {
            path: doc.path,
            size: doc.size,
            modified: doc.modified
          }
        });

        count++;

        // Report progress
        if (count % 100 === 0) {
          const elapsed = performance.now() - startTime;
          const rate = count / (elapsed / 1000);
          console.log(`[QuantumSearch] Indexed ${count} documents (${rate.toFixed(0)} docs/sec)`);
        }
      }

      // Pre-compute quantum entanglements
      await this.computeEntanglements();

      this.monitor.mark('initialization-end');
      const duration = this.monitor.measure('initialization', 'initialization-start', 'initialization-end');

      console.log(`[QuantumSearch] ✅ Initialized with ${count} documents in ${duration.toFixed(2)}ms`);
      console.log(`[QuantumSearch] Quantum states: ${this.quantumIndex.superpositionStates}`);

      return {
        success: true,
        documentsIndexed: count,
        duration,
        quantumStates: this.quantumIndex.superpositionStates
      };
    } catch (error) {
      console.error('[QuantumSearch] Initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.monitor.stopRecording();
    }
  }

  /**
   * Perform quantum-accelerated search
   */
  async search(query, options = {}) {
    const {
      limit = 10,
      semanticSearch = true,
      quantumBoost = true,
      returnContent = false
    } = options;

    this.stats.totalSearches++;
    const searchStart = performance.now();

    try {
      // Check semantic cache first
      const cacheResult = await this.semanticCache.get(query);
      if (cacheResult && cacheResult.confidence > 0.9) {
        this.stats.cacheHits++;
        console.log('[QuantumSearch] Cache hit with confidence:', cacheResult.confidence);

        const latency = performance.now() - searchStart;
        this.updateStats(latency);

        return {
          results: cacheResult.results.slice(0, limit),
          source: 'cache',
          latency,
          confidence: cacheResult.confidence
        };
      }

      // Perform quantum search
      let results;

      if (quantumBoost && this.searchWorker) {
        // Use web worker for parallel quantum computation
        results = await this.performQuantumSearchInWorker(query, limit);
      } else {
        // In-thread quantum search
        results = await this.performQuantumSearch(query, limit);
      }

      // Semantic re-ranking if enabled
      if (semanticSearch && results.length > 0) {
        results = await this.semanticRerank(query, results);
      }

      // Load content if requested
      if (returnContent) {
        results = await this.loadResultContent(results);
      }

      // Cache results
      await this.semanticCache.set(query, {
        results,
        confidence: this.calculateConfidence(results)
      });

      const latency = performance.now() - searchStart;
      this.updateStats(latency);

      return {
        results: results.slice(0, limit),
        source: 'quantum',
        latency,
        quantumCollapses: this.stats.quantumCollapses,
        speedup: this.stats.quantumSpeedup
      };
    } catch (error) {
      console.error('[QuantumSearch] Search error:', error);
      return {
        results: [],
        error: error.message,
        latency: performance.now() - searchStart
      };
    }
  }

  /**
   * Perform quantum search using superposition
   */
  async performQuantumSearch(query, limit) {
    // Record quantum metrics
    this.monitor.recordQuantumMetric('quantumSearches', 1);

    // Create query wave function
    const queryVector = await this.createQueryVector(query);

    // Perform quantum search with wave function collapse
    const results = await this.quantumIndex.search(query, {
      limit: limit * 2, // Get more for re-ranking
      threshold: 0.3
    });

    // Record collapses
    this.stats.quantumCollapses += results.length;
    this.monitor.recordQuantumMetric('waveFunctionCollapses', results.length);

    return results;
  }

  /**
   * Perform quantum search in web worker
   */
  async performQuantumSearchInWorker(query, limit) {
    return new Promise((resolve, reject) => {
      const messageHandler = (e) => {
        if (e.data.type === 'search-complete') {
          this.searchWorker.removeEventListener('message', messageHandler);
          resolve(e.data.results);
        } else if (e.data.type === 'error') {
          this.searchWorker.removeEventListener('message', messageHandler);
          reject(new Error(e.data.message));
        }
      };

      this.searchWorker.addEventListener('message', messageHandler);
      this.searchWorker.postMessage({
        type: 'quantum-search',
        data: {
          query,
          limit,
          index: this.quantumIndex.export()
        }
      });
    });
  }

  /**
   * Semantic re-ranking using vector embeddings
   */
  async semanticRerank(query, results) {
    // Generate query embedding
    const queryEmbedding = await this.semanticCache.generateEmbedding({
      content: query
    });

    // Calculate semantic similarity for each result
    const scored = await Promise.all(results.map(async (result) => {
      let embedding;

      // Check if embedding is cached
      if (this.vectorDB.vectors.has(result.id)) {
        embedding = this.vectorDB.vectors.get(result.id);
      } else {
        // Generate and cache embedding
        embedding = await this.semanticCache.generateEmbedding({
          content: result.content || result.name
        });
        await this.vectorDB.insert(result.id, embedding, result);
      }

      // Calculate cosine similarity
      const similarity = this.vectorDB.cosineSimilarity(queryEmbedding, embedding);

      return {
        ...result,
        semanticScore: similarity,
        finalScore: result.score * 0.5 + similarity * 0.5 // Combine quantum and semantic scores
      };
    }));

    // Sort by final score
    return scored.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Load content for search results
   */
  async loadResultContent(results) {
    const withContent = [];

    for (const result of results) {
      try {
        const content = await this.dataLoader.loadFileContent(result.id);
        withContent.push({
          ...result,
          content,
          preview: this.generatePreview(content, 200)
        });
      } catch (error) {
        withContent.push(result);
      }
    }

    return withContent;
  }

  /**
   * Compute quantum entanglements between related documents
   */
  async computeEntanglements() {
    console.log('[QuantumSearch] Computing quantum entanglements...');

    const documents = Array.from(this.quantumIndex.documents.values());
    let entanglements = 0;

    // Use clustering to find related documents
    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const similarity = await this.calculateSimilarity(documents[i], documents[j]);

        if (similarity > 0.7) {
          // Create quantum entanglement
          this.quantumIndex.entangle(documents[i].id, documents[j].id, similarity);
          entanglements++;
          this.monitor.recordQuantumMetric('entanglements', 1);
        }
      }

      // Report progress
      if (i % 100 === 0) {
        console.log(`[QuantumSearch] Processed ${i}/${documents.length} documents, ${entanglements} entanglements`);
      }
    }

    console.log(`[QuantumSearch] Created ${entanglements} quantum entanglements`);
  }

  /**
   * Calculate similarity between documents
   */
  async calculateSimilarity(doc1, doc2) {
    // Simple Jaccard similarity for demonstration
    const words1 = new Set(doc1.content?.toLowerCase().split(/\s+/) || []);
    const words2 = new Set(doc2.content?.toLowerCase().split(/\s+/) || []);

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Create query vector
   */
  async createQueryVector(query) {
    // Generate embedding for query
    return await this.semanticCache.generateEmbedding({
      content: query
    });
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(results) {
    if (results.length === 0) return 0;

    const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
    const hasHighScore = results.some(r => (r.score || 0) > 0.8);

    return hasHighScore ? Math.min(0.95, avgScore + 0.2) : avgScore;
  }

  /**
   * Generate text preview
   */
  generatePreview(content, maxLength = 200) {
    if (!content) return '';

    const cleaned = content
      .replace(/<[^>]*>/g, '') // Remove HTML
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return cleaned.length > maxLength
      ? cleaned.substring(0, maxLength) + '...'
      : cleaned;
  }

  /**
   * Update statistics
   */
  updateStats(latency) {
    const n = this.stats.totalSearches;
    this.stats.averageLatency = (this.stats.averageLatency * (n - 1) + latency) / n;

    // Calculate quantum speedup vs traditional search
    const traditionalLatency = this.quantumIndex.documents.size * 0.1; // Estimated O(n) search
    this.stats.quantumSpeedup = traditionalLatency / latency;
  }

  /**
   * Setup web worker
   */
  setupWorker() {
    this.searchWorker.addEventListener('message', (e) => {
      if (e.data.type === 'progress') {
        console.log('[QuantumSearch] Worker progress:', e.data);
      }
    });
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      ...this.stats,
      quantumIndex: this.quantumIndex.getStats(),
      semanticCache: this.semanticCache.getStats(),
      vectorDB: this.vectorDB.getStats(),
      dataLoader: this.dataLoader.getCacheStats()
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.searchWorker?.terminate();
    this.monitor.destroy();
    this.dataLoader.cancel();
    this.vectorDB.clear();
    this.semanticCache.clear();
    this.quantumIndex.clear();
  }
}

/**
 * React hook for quantum search
 */
export function useQuantumSearch(documentsPath) {
  const [system, setSystem] = React.useState(null);
  const [initialized, setInitialized] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const quantumSystem = new QuantumSearchSystem();

    const init = async () => {
      try {
        setLoading(true);
        const result = await quantumSystem.initialize(documentsPath);

        if (result.success) {
          setSystem(quantumSystem);
          setInitialized(true);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      quantumSystem.destroy();
    };
  }, [documentsPath]);

  const search = React.useCallback(async (query, options) => {
    if (!system || !initialized) {
      return { results: [], error: 'System not initialized' };
    }

    return await system.search(query, options);
  }, [system, initialized]);

  return {
    search,
    loading,
    error,
    initialized,
    stats: system?.getStats()
  };
}

// Export singleton instance for global access
export const quantumSearchSystem = new QuantumSearchSystem();

export default QuantumSearchSystem;