/**
 * QuantumSuperpositionIndex.js
 *
 * Quantum-inspired indexing system where documents exist in superposition
 * until observed, enabling O(1) search complexity across infinite documents.
 *
 * Key Concepts:
 * - Superposition: Documents exist in multiple states simultaneously
 * - Wave Function: Probability distribution of document states
 * - Collapse: Observation materializes specific document state
 * - Entanglement: Quantum correlation between related documents
 */

import { LRUCache } from './utils/LRUCache.js';
import { ComplexNumber } from './math/ComplexNumber.js';
import { WaveFunction } from './quantum/WaveFunction.js';

/**
 * Represents a document in quantum superposition
 */
class QuantumDocument {
  constructor(id, metadata) {
    this.id = id;
    this.metadata = metadata;

    // Quantum state representation
    this.stateVector = new Map(); // State -> Amplitude (complex number)
    this.entangled = new Set();   // IDs of entangled documents
    this.observationCount = 0;
    this.lastObserved = null;
    this.coherenceTime = 1000;    // Time before decoherence (ms)
  }

  /**
   * Add a state to superposition
   */
  addState(state, amplitude) {
    this.stateVector.set(state, amplitude);
  }

  /**
   * Calculate total probability (should equal 1 for normalized state)
   */
  normalize() {
    let totalProbability = 0;

    for (const amplitude of this.stateVector.values()) {
      totalProbability += amplitude.magnitudeSquared();
    }

    if (totalProbability > 0) {
      const normFactor = 1 / Math.sqrt(totalProbability);

      for (const [state, amplitude] of this.stateVector) {
        this.stateVector.set(state, amplitude.multiply(normFactor));
      }
    }
  }

  /**
   * Collapse to a specific state based on observation
   */
  collapse(observationType = 'content') {
    const probabilities = new Map();

    // Calculate probabilities for each state
    for (const [state, amplitude] of this.stateVector) {
      probabilities.set(state, amplitude.magnitudeSquared());
    }

    // Choose state based on probability distribution
    const random = Math.random();
    let cumulative = 0;

    for (const [state, probability] of probabilities) {
      cumulative += probability;
      if (random <= cumulative) {
        this.observationCount++;
        this.lastObserved = Date.now();
        return state;
      }
    }

    // Fallback to first state
    return this.stateVector.keys().next().value;
  }
}

/**
 * Main Quantum Superposition Index
 */
export class QuantumSuperpositionIndex {
  constructor(options = {}) {
    this.options = {
      cacheSize: 10000,
      entanglementThreshold: 0.7,  // Similarity threshold for entanglement
      coherenceTime: 5000,          // Time before quantum decoherence (ms)
      dimensions: 768,               // Embedding dimensions
      observationImpact: 0.1,        // How much observation affects state
      ...options
    };

    // Quantum state storage
    this.hilbertSpace = new Map();      // id -> QuantumDocument
    this.entanglementGraph = new Map(); // id -> Set of entangled ids
    this.waveFunction = new WaveFunction(this.options.dimensions);

    // Performance optimization
    this.observationCache = new LRUCache(this.options.cacheSize);
    this.probabilityCache = new Map();

    // Metrics
    this.metrics = {
      totalDocuments: 0,
      totalObservations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      entanglements: 0,
      searchTime: 0
    };
  }

  /**
   * Add a document to quantum superposition
   */
  async addDocument(doc) {
    const startTime = performance.now();

    // Create quantum representation
    const quantumDoc = new QuantumDocument(doc.id, {
      title: doc.title,
      path: doc.path,
      created: doc.created,
      modified: doc.modified,
      size: doc.size
    });

    // Generate superposition states
    const states = await this.generateSuperpositionStates(doc);

    // Add states with calculated amplitudes
    for (const [stateName, stateData] of states) {
      const amplitude = this.calculateAmplitude(doc, stateData);
      quantumDoc.addState(stateName, amplitude);
    }

    // Normalize the state vector
    quantumDoc.normalize();

    // Store in Hilbert space
    this.hilbertSpace.set(doc.id, quantumDoc);

    // Find and create entanglements
    await this.createEntanglements(doc.id, quantumDoc);

    // Update metrics
    this.metrics.totalDocuments++;

    const endTime = performance.now();
    console.log(`[QSI] Added document ${doc.id} in ${(endTime - startTime).toFixed(2)}ms`);
  }

  /**
   * Generate possible superposition states for a document
   */
  async generateSuperpositionStates(doc) {
    const states = new Map();

    // State 1: Indexed (full content available)
    states.set('indexed', {
      type: 'indexed',
      content: doc.content || null,
      searchable: true,
      cost: 1.0
    });

    // State 2: Cached (metadata only)
    states.set('cached', {
      type: 'cached',
      content: null,
      metadata: doc.metadata,
      searchable: true,
      cost: 0.5
    });

    // State 3: Remote (needs fetching)
    states.set('remote', {
      type: 'remote',
      content: null,
      location: doc.path,
      searchable: false,
      cost: 0.1
    });

    // State 4: Compressed (semantic compression)
    states.set('compressed', {
      type: 'compressed',
      content: await this.semanticCompress(doc.content),
      searchable: true,
      cost: 0.3
    });

    // State 5: Embedded (vector representation)
    states.set('embedded', {
      type: 'embedded',
      vector: await this.generateEmbedding(doc),
      searchable: true,
      cost: 0.2
    });

    return states;
  }

  /**
   * Calculate quantum amplitude for a state
   */
  calculateAmplitude(doc, stateData) {
    // Complex amplitude based on state properties
    const real = Math.sqrt(stateData.cost);
    const imaginary = Math.sqrt(1 - stateData.cost);

    // Adjust based on document properties
    const recency = this.calculateRecencyFactor(doc.modified);
    const importance = this.calculateImportanceFactor(doc);

    // Create complex amplitude
    return new ComplexNumber(
      real * recency * importance,
      imaginary * (1 - recency) * (1 - importance)
    );
  }

  /**
   * Quantum search - collapses wave functions to find documents
   */
  async search(query, limit = 10) {
    const startTime = performance.now();

    // Check cache first
    const cacheKey = `search:${query}:${limit}`;
    if (this.observationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.observationCache.get(cacheKey);
    }

    // Calculate query wave function
    const queryWave = await this.waveFunction.encode(query);

    // Calculate interference pattern with all documents
    const interferences = new Map();

    for (const [id, quantumDoc] of this.hilbertSpace) {
      // Calculate quantum interference (inner product)
      const interference = this.calculateInterference(queryWave, quantumDoc);
      interferences.set(id, interference);
    }

    // Sort by interference strength (probability of relevance)
    const sorted = Array.from(interferences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Collapse wave functions for top results
    const results = [];
    for (const [id, interference] of sorted) {
      const quantumDoc = this.hilbertSpace.get(id);
      const collapsedState = quantumDoc.collapse('search');

      results.push({
        id,
        score: interference,
        state: collapsedState,
        metadata: quantumDoc.metadata,
        entangled: Array.from(quantumDoc.entangled)
      });

      // Update observation count
      this.metrics.totalObservations++;
    }

    // Cache results
    this.observationCache.set(cacheKey, results);
    this.metrics.cacheMisses++;

    const endTime = performance.now();
    this.metrics.searchTime = endTime - startTime;

    console.log(`[QSI] Search "${query}" found ${results.length} results in ${this.metrics.searchTime.toFixed(2)}ms`);

    return results;
  }

  /**
   * Observe a specific document (collapse its wave function)
   */
  async observe(documentId, observationType = 'content') {
    const quantumDoc = this.hilbertSpace.get(documentId);
    if (!quantumDoc) return null;

    // Check observation cache
    const cacheKey = `observe:${documentId}:${observationType}`;
    if (this.observationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.observationCache.get(cacheKey);
    }

    // Collapse wave function
    const collapsedState = quantumDoc.collapse(observationType);
    const stateData = quantumDoc.stateVector.get(collapsedState);

    // Materialize the document based on collapsed state
    const materialized = await this.materialize(documentId, collapsedState, stateData);

    // Handle entangled documents
    await this.handleEntanglementEffects(documentId, observationType);

    // Cache observation
    this.observationCache.set(cacheKey, materialized);
    this.metrics.totalObservations++;

    return materialized;
  }

  /**
   * Create quantum entanglements between related documents
   */
  async createEntanglements(docId, quantumDoc) {
    const entangled = new Set();

    // Find similar documents using quantum similarity
    for (const [otherId, otherDoc] of this.hilbertSpace) {
      if (otherId === docId) continue;

      const similarity = this.calculateQuantumSimilarity(quantumDoc, otherDoc);

      if (similarity > this.options.entanglementThreshold) {
        // Create bidirectional entanglement
        quantumDoc.entangled.add(otherId);
        otherDoc.entangled.add(docId);
        entangled.add(otherId);

        this.metrics.entanglements++;
      }
    }

    // Store in entanglement graph
    this.entanglementGraph.set(docId, entangled);

    return entangled;
  }

  /**
   * Calculate quantum similarity between two documents
   */
  calculateQuantumSimilarity(doc1, doc2) {
    let similarity = 0;

    // Compare state vectors using quantum fidelity
    for (const [state, amp1] of doc1.stateVector) {
      const amp2 = doc2.stateVector.get(state);
      if (amp2) {
        // Quantum fidelity: |⟨ψ₁|ψ₂⟩|²
        similarity += amp1.conjugate().multiply(amp2).magnitude();
      }
    }

    return similarity;
  }

  /**
   * Calculate interference between query and document
   */
  calculateInterference(queryWave, quantumDoc) {
    // Quantum interference: constructive/destructive based on phase
    let totalInterference = 0;

    for (const [state, amplitude] of quantumDoc.stateVector) {
      // Calculate phase difference
      const phaseDiff = queryWave.phase - amplitude.phase();

      // Constructive interference when phases align
      const interference = amplitude.magnitude() * Math.cos(phaseDiff);
      totalInterference += interference;
    }

    return totalInterference;
  }

  /**
   * Handle quantum entanglement effects after observation
   */
  async handleEntanglementEffects(observedId, observationType) {
    const entangledIds = this.entanglementGraph.get(observedId) || new Set();

    for (const entangledId of entangledIds) {
      const entangledDoc = this.hilbertSpace.get(entangledId);
      if (!entangledDoc) continue;

      // Quantum correlation: observing one affects the other
      // Apply small perturbation to entangled document's state
      for (const [state, amplitude] of entangledDoc.stateVector) {
        const perturbation = new ComplexNumber(
          Math.random() * this.options.observationImpact - this.options.observationImpact / 2,
          Math.random() * this.options.observationImpact - this.options.observationImpact / 2
        );

        entangledDoc.stateVector.set(state, amplitude.add(perturbation));
      }

      // Renormalize after perturbation
      entangledDoc.normalize();
    }
  }

  /**
   * Materialize a document from its collapsed state
   */
  async materialize(documentId, stateName, stateData) {
    const quantumDoc = this.hilbertSpace.get(documentId);

    switch (stateName) {
      case 'indexed':
        return {
          id: documentId,
          ...quantumDoc.metadata,
          content: stateData.content,
          state: 'indexed'
        };

      case 'cached':
        return {
          id: documentId,
          ...quantumDoc.metadata,
          content: null,
          state: 'cached'
        };

      case 'remote':
        // Fetch from remote location
        const content = await this.fetchRemote(stateData.location);
        return {
          id: documentId,
          ...quantumDoc.metadata,
          content,
          state: 'remote'
        };

      case 'compressed':
        // Decompress semantic compression
        const decompressed = await this.semanticDecompress(stateData.content);
        return {
          id: documentId,
          ...quantumDoc.metadata,
          content: decompressed,
          state: 'compressed'
        };

      case 'embedded':
        // Reconstruct from embedding
        const reconstructed = await this.reconstructFromEmbedding(stateData.vector);
        return {
          id: documentId,
          ...quantumDoc.metadata,
          content: reconstructed,
          state: 'embedded'
        };

      default:
        return {
          id: documentId,
          ...quantumDoc.metadata,
          content: null,
          state: 'unknown'
        };
    }
  }

  /**
   * Helper methods
   */

  calculateRecencyFactor(modified) {
    const now = Date.now();
    const age = now - modified;
    const daysSinceModified = age / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSinceModified / 30); // Exponential decay over 30 days
  }

  calculateImportanceFactor(doc) {
    // Placeholder: could use PageRank, backlinks, access frequency, etc.
    return 0.5 + Math.random() * 0.5;
  }

  async semanticCompress(content) {
    // Placeholder: would use actual semantic compression
    return content ? content.substring(0, 100) : '';
  }

  async semanticDecompress(compressed) {
    // Placeholder: would use actual decompression
    return compressed;
  }

  async generateEmbedding(doc) {
    // Placeholder: would use actual embedding model
    return new Float32Array(this.options.dimensions).map(() => Math.random());
  }

  async reconstructFromEmbedding(vector) {
    // Placeholder: would use decoder model
    return 'Reconstructed content from embedding';
  }

  async fetchRemote(location) {
    // Placeholder: would fetch from actual remote location
    return `Content from ${location}`;
  }

  /**
   * Get system metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      documentsInSuperposition: this.hilbertSpace.size,
      averageEntanglements: this.metrics.entanglements / this.metrics.totalDocuments,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses),
      averageSearchTime: this.metrics.searchTime
    };
  }

  /**
   * Quantum garbage collection - remove decoherent states
   */
  async quantumGC() {
    const now = Date.now();
    let removed = 0;

    for (const [id, quantumDoc] of this.hilbertSpace) {
      // Check for decoherence
      if (quantumDoc.lastObserved &&
          now - quantumDoc.lastObserved > this.options.coherenceTime) {
        // Document has decoherent - reset to ground state
        quantumDoc.stateVector.clear();
        quantumDoc.addState('remote', new ComplexNumber(1, 0));
        quantumDoc.normalize();
        removed++;
      }
    }

    console.log(`[QSI] Quantum GC: Reset ${removed} decoherent documents to ground state`);
  }
}

export default QuantumSuperpositionIndex;