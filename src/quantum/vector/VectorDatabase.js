/**
 * VectorDatabase.js
 *
 * High-performance vector database for semantic search.
 * Implements HNSW (Hierarchical Navigable Small World) algorithm for efficient ANN search.
 */

export class VectorDatabase {
  constructor(dimensions = 768) {
    this.dimensions = dimensions;
    this.vectors = new Map(); // id -> vector
    this.metadata = new Map(); // id -> metadata

    // HNSW index structure
    this.layers = [];
    this.entryPoint = null;
    this.M = 16; // Max connections per node
    this.efConstruction = 200; // Size of dynamic candidate list
    this.efSearch = 50; // Size of search candidate list
    this.mL = 1 / Math.log(2.0); // Normalization factor for level assignment

    // Performance tracking
    this.metrics = {
      vectorsStored: 0,
      searchQueries: 0,
      averageSearchTime: 0
    };
  }

  /**
   * Insert vector into database
   */
  async insert(id, vector, metadata = {}) {
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }

    // Normalize vector
    const normalized = this.normalize(vector);

    // Store vector and metadata
    this.vectors.set(id, normalized);
    this.metadata.set(id, metadata);

    // Add to HNSW index
    this.addToHNSW(id, normalized);

    this.metrics.vectorsStored++;
  }

  /**
   * Add vector to HNSW index
   */
  addToHNSW(id, vector) {
    // Assign level using exponential decay probability
    const level = Math.floor(-Math.log(Math.random()) * this.mL);

    // Initialize layers if needed
    while (this.layers.length <= level) {
      this.layers.push(new Map());
    }

    // Add node to all layers up to its level
    for (let lc = 0; lc <= level; lc++) {
      this.layers[lc].set(id, new Set());
    }

    // Special case: first point
    if (!this.entryPoint) {
      this.entryPoint = id;
      return;
    }

    // Find nearest neighbors at all layers
    const candidates = this.searchLayer(vector, this.entryPoint, 1, this.layers.length - 1);

    for (let lc = Math.min(level, this.layers.length - 1); lc >= 0; lc--) {
      const m = lc === 0 ? this.M * 2 : this.M;
      const neighbors = this.selectNeighbors(vector, candidates, m, lc);

      // Add bidirectional links
      const node = this.layers[lc].get(id);
      for (const neighbor of neighbors) {
        node.add(neighbor);
        this.layers[lc].get(neighbor).add(id);

        // Prune connections if necessary
        this.pruneConnections(neighbor, lc);
      }
    }
  }

  /**
   * Search for nearest neighbors
   */
  async search(queryVector, k = 10) {
    const startTime = performance.now();

    if (this.vectors.size === 0) return [];

    // Normalize query vector
    const normalized = this.normalize(queryVector);

    // Search using HNSW
    const candidates = this.searchLayer(normalized, this.entryPoint, k, 0);

    // Sort by distance and return top k
    const results = candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map(candidate => ({
        id: candidate.id,
        similarity: 1 - candidate.distance, // Convert distance to similarity
        metadata: this.metadata.get(candidate.id)
      }));

    const searchTime = performance.now() - startTime;
    this.metrics.searchQueries++;
    this.metrics.averageSearchTime =
      (this.metrics.averageSearchTime * (this.metrics.searchQueries - 1) + searchTime) /
      this.metrics.searchQueries;

    return results;
  }

  /**
   * Search layer in HNSW graph
   */
  searchLayer(query, entryPoint, ef, layer) {
    const visited = new Set();
    const candidates = [];
    const W = [];

    // Initialize with entry point
    const d = this.distance(query, this.vectors.get(entryPoint));
    candidates.push({ id: entryPoint, distance: d });
    W.push({ id: entryPoint, distance: d });
    visited.add(entryPoint);

    while (candidates.length > 0) {
      // Get closest unvisited candidate
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift();

      // Check if we can terminate
      if (current.distance > W[W.length - 1].distance) {
        break;
      }

      // Check neighbors
      const neighbors = this.layers[layer].get(current.id) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const d = this.distance(query, this.vectors.get(neighbor));

          if (d < W[W.length - 1].distance || W.length < ef) {
            candidates.push({ id: neighbor, distance: d });
            W.push({ id: neighbor, distance: d });
            W.sort((a, b) => a.distance - b.distance);

            if (W.length > ef) {
              W.pop();
            }
          }
        }
      }
    }

    return W;
  }

  /**
   * Select M neighbors using heuristic
   */
  selectNeighbors(vector, candidates, m, layer) {
    const selected = [];
    const candidatesCopy = [...candidates];

    while (selected.length < m && candidatesCopy.length > 0) {
      candidatesCopy.sort((a, b) => a.distance - b.distance);
      const best = candidatesCopy.shift();
      selected.push(best.id);

      // Remove candidates that are farther from query than from selected neighbor
      candidatesCopy.filter(candidate => {
        const distToSelected = this.distance(
          this.vectors.get(best.id),
          this.vectors.get(candidate.id)
        );
        return candidate.distance < distToSelected;
      });
    }

    return selected;
  }

  /**
   * Prune connections to maintain max degree
   */
  pruneConnections(nodeId, layer) {
    const m = layer === 0 ? this.M * 2 : this.M;
    const connections = this.layers[layer].get(nodeId);

    if (connections.size > m) {
      // Keep only m closest neighbors
      const neighbors = Array.from(connections).map(id => ({
        id,
        distance: this.distance(this.vectors.get(nodeId), this.vectors.get(id))
      }));

      neighbors.sort((a, b) => a.distance - b.distance);
      const keep = new Set(neighbors.slice(0, m).map(n => n.id));

      // Remove farther connections
      for (const neighbor of connections) {
        if (!keep.has(neighbor)) {
          connections.delete(neighbor);
          this.layers[layer].get(neighbor).delete(nodeId);
        }
      }
    }
  }

  /**
   * Get vector by ID
   */
  async get(id) {
    return this.vectors.get(id);
  }

  /**
   * Delete vector
   */
  async delete(id) {
    // Remove from vectors and metadata
    this.vectors.delete(id);
    this.metadata.delete(id);

    // Remove from HNSW index
    for (const layer of this.layers) {
      const connections = layer.get(id);
      if (connections) {
        // Remove bidirectional links
        for (const neighbor of connections) {
          layer.get(neighbor)?.delete(id);
        }
        layer.delete(id);
      }
    }

    // Update entry point if necessary
    if (this.entryPoint === id) {
      this.entryPoint = this.vectors.keys().next().value || null;
    }

    this.metrics.vectorsStored--;
  }

  /**
   * Calculate L2 distance between vectors
   */
  distance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < this.dimensions; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate cosine similarity between vectors
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < this.dimensions; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Normalize vector to unit length
   */
  normalize(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;

    return vector.map(val => val / norm);
  }

  /**
   * Batch insert multiple vectors
   */
  async batchInsert(items) {
    for (const { id, vector, metadata } of items) {
      await this.insert(id, vector, metadata);
    }
  }

  /**
   * Clear all vectors
   */
  clear() {
    this.vectors.clear();
    this.metadata.clear();
    this.layers = [];
    this.entryPoint = null;
    this.metrics.vectorsStored = 0;
  }

  /**
   * Get database statistics
   */
  getStats() {
    return {
      ...this.metrics,
      dimensions: this.dimensions,
      layers: this.layers.length,
      totalConnections: this.layers.reduce((sum, layer) =>
        sum + Array.from(layer.values()).reduce((s, connections) => s + connections.size, 0),
        0
      )
    };
  }

  /**
   * Export database to JSON
   */
  export() {
    return {
      dimensions: this.dimensions,
      vectors: Array.from(this.vectors.entries()),
      metadata: Array.from(this.metadata.entries()),
      layers: this.layers.map(layer =>
        Array.from(layer.entries()).map(([id, connections]) =>
          [id, Array.from(connections)]
        )
      ),
      entryPoint: this.entryPoint
    };
  }

  /**
   * Import database from JSON
   */
  import(data) {
    this.dimensions = data.dimensions;
    this.vectors = new Map(data.vectors);
    this.metadata = new Map(data.metadata);
    this.layers = data.layers.map(layer =>
      new Map(layer.map(([id, connections]) => [id, new Set(connections)]))
    );
    this.entryPoint = data.entryPoint;
    this.metrics.vectorsStored = this.vectors.size;
  }
}

export default VectorDatabase;