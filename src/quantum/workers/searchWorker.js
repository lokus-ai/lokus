/**
 * searchWorker.js
 *
 * Web Worker for quantum search computations
 * Performs heavy quantum calculations in parallel thread
 */

// Import quantum index in worker context
class QuantumSearchWorker {
  constructor() {
    this.index = null;
    this.cache = new Map();
  }

  /**
   * Initialize with quantum index data
   */
  initialize(indexData) {
    this.index = indexData;
    console.log('[SearchWorker] Initialized with', Object.keys(indexData.documents).length, 'documents');
  }

  /**
   * Perform quantum search
   */
  quantumSearch(query, limit) {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    const startTime = performance.now();

    // Tokenize query
    const queryTokens = this.tokenize(query.toLowerCase());

    // Calculate quantum probabilities for each document
    const results = [];

    for (const [docId, doc] of Object.entries(this.index.documents)) {
      // Calculate superposition probability
      const probability = this.calculateQuantumProbability(queryTokens, doc);

      if (probability > 0.1) {
        // Wave function collapse
        results.push({
          id: docId,
          score: probability,
          collapsed: true,
          ...doc.metadata
        });
      }
    }

    // Sort by probability (quantum measurement)
    results.sort((a, b) => b.score - a.score);

    const duration = performance.now() - startTime;
    console.log(`[SearchWorker] Quantum search completed in ${duration.toFixed(2)}ms`);

    return results.slice(0, limit);
  }

  /**
   * Calculate quantum probability using wave function
   */
  calculateQuantumProbability(queryTokens, document) {
    const docTokens = this.tokenize((document.content || '').toLowerCase());

    // Calculate quantum overlap (inner product)
    let overlap = 0;
    let queryNorm = 0;
    let docNorm = 0;

    // Create frequency maps
    const queryFreq = this.getFrequencyMap(queryTokens);
    const docFreq = this.getFrequencyMap(docTokens);

    // Calculate inner product and norms
    for (const [token, qFreq] of queryFreq) {
      queryNorm += qFreq * qFreq;

      if (docFreq.has(token)) {
        const dFreq = docFreq.get(token);
        overlap += qFreq * dFreq;
      }
    }

    for (const [, dFreq] of docFreq) {
      docNorm += dFreq * dFreq;
    }

    // Normalize (quantum state normalization)
    if (queryNorm === 0 || docNorm === 0) return 0;

    const probability = overlap / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));

    // Apply quantum interference patterns
    const interference = this.calculateInterference(document);

    return Math.min(1, probability * (1 + interference));
  }

  /**
   * Calculate quantum interference from entangled documents
   */
  calculateInterference(document) {
    if (!this.index.entanglements || !this.index.entanglements[document.id]) {
      return 0;
    }

    let interference = 0;
    const entangled = this.index.entanglements[document.id];

    for (const [otherId, strength] of Object.entries(entangled)) {
      // Constructive interference from related documents
      interference += strength * 0.1;
    }

    return Math.min(0.5, interference);
  }

  /**
   * Fuzzy search with quantum tunneling
   */
  fuzzySearch(query, limit) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [docId, doc] of Object.entries(this.index.documents)) {
      const content = (doc.content || '').toLowerCase();

      // Calculate fuzzy match score with quantum tunneling
      const score = this.fuzzyMatch(queryLower, content);

      if (score > 0.3) {
        results.push({
          id: docId,
          score,
          fuzzy: true,
          ...doc.metadata
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Fuzzy matching algorithm
   */
  fuzzyMatch(pattern, text) {
    if (!pattern || !text) return 0;

    let patternIdx = 0;
    let score = 0;
    let consecutiveMatches = 0;
    let lastMatchIdx = -1;

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        score += 1;

        // Bonus for consecutive matches
        if (lastMatchIdx === i - 1) {
          consecutiveMatches++;
          score += consecutiveMatches * 0.5;
        } else {
          consecutiveMatches = 0;
        }

        lastMatchIdx = i;
        patternIdx++;
      }
    }

    // Normalize score
    return patternIdx === pattern.length
      ? score / pattern.length
      : score / pattern.length * 0.5;
  }

  /**
   * Tokenize text
   */
  tokenize(text) {
    return text
      .split(/[\s\-_.,;:!?()[\]{}'"]+/)
      .filter(token => token.length > 2);
  }

  /**
   * Get frequency map of tokens
   */
  getFrequencyMap(tokens) {
    const freq = new Map();

    for (const token of tokens) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }

    return freq;
  }

  /**
   * Parallel batch search
   */
  batchSearch(queries, limit) {
    const results = new Map();

    for (const query of queries) {
      results.set(query, this.quantumSearch(query, limit));
    }

    return Object.fromEntries(results);
  }
}

// Create worker instance
const worker = new QuantumSearchWorker();

// Handle messages
self.onmessage = function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'initialize':
        worker.initialize(data);
        self.postMessage({
          type: 'initialized',
          success: true
        });
        break;

      case 'quantum-search':
        const results = worker.quantumSearch(data.query, data.limit);
        self.postMessage({
          type: 'search-complete',
          results
        });
        break;

      case 'fuzzy-search':
        const fuzzyResults = worker.fuzzySearch(data.query, data.limit);
        self.postMessage({
          type: 'search-complete',
          results: fuzzyResults
        });
        break;

      case 'batch-search':
        const batchResults = worker.batchSearch(data.queries, data.limit);
        self.postMessage({
          type: 'batch-complete',
          results: batchResults
        });
        break;

      default:
        self.postMessage({
          type: 'error',
          message: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message,
      stack: error.stack
    });
  }
};