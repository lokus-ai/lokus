/**
 * graphWorker.js
 *
 * Web Worker for heavy graph calculations
 * Offloads force simulation and layout calculations from main thread
 */

// Force simulation algorithm (Barnes-Hut approximation)
class ForceSimulation {
  constructor(nodes, edges, options = {}) {
    this.nodes = nodes;
    this.edges = edges;
    this.options = {
      iterations: options.iterations || 100,
      alpha: options.alpha || 0.9,
      alphaDecay: options.alphaDecay || 0.01,
      velocityDecay: options.velocityDecay || 0.4,
      forces: {
        charge: options.charge || -300,
        link: options.link || 30,
        center: options.center || 0.1,
        collision: options.collision || 20
      }
    };

    // Initialize velocities
    this.nodes.forEach(node => {
      node.vx = 0;
      node.vy = 0;
      if (node.x === undefined) node.x = Math.random() * 1000 - 500;
      if (node.y === undefined) node.y = Math.random() * 1000 - 500;
    });

    // Build edge index
    this.edgeIndex = new Map();
    this.edges.forEach(edge => {
      if (!this.edgeIndex.has(edge.source)) {
        this.edgeIndex.set(edge.source, []);
      }
      if (!this.edgeIndex.has(edge.target)) {
        this.edgeIndex.set(edge.target, []);
      }
      this.edgeIndex.get(edge.source).push(edge);
      this.edgeIndex.get(edge.target).push(edge);
    });
  }

  /**
   * Run force simulation
   */
  simulate() {
    let alpha = this.options.alpha;

    for (let i = 0; i < this.options.iterations; i++) {
      // Apply forces
      this.applyChargeForce(alpha);
      this.applyLinkForce(alpha);
      this.applyCenterForce(alpha);
      this.applyCollisionForce(alpha);

      // Update positions
      this.updatePositions(alpha);

      // Cool down
      alpha *= 1 - this.options.alphaDecay;

      // Report progress
      if (i % 10 === 0) {
        self.postMessage({
          type: 'progress',
          progress: i / this.options.iterations,
          alpha
        });
      }
    }

    return this.nodes;
  }

  /**
   * Apply charge force (repulsion between nodes)
   */
  applyChargeForce(alpha) {
    const strength = this.options.forces.charge * alpha;

    // Use Barnes-Hut approximation for O(n log n) complexity
    const quadtree = this.buildQuadtree();

    this.nodes.forEach(node => {
      this.applyQuadtreeForce(node, quadtree, strength);
    });
  }

  /**
   * Build quadtree for Barnes-Hut approximation
   */
  buildQuadtree() {
    const tree = {
      x0: -1000, y0: -1000,
      x1: 1000, y1: 1000,
      nodes: [],
      children: null
    };

    this.nodes.forEach(node => {
      this.insertQuadtree(tree, node);
    });

    return tree;
  }

  /**
   * Insert node into quadtree
   */
  insertQuadtree(tree, node) {
    if (tree.nodes.length === 0 && !tree.children) {
      tree.nodes.push(node);
      return;
    }

    if (!tree.children) {
      // Subdivide
      const mx = (tree.x0 + tree.x1) / 2;
      const my = (tree.y0 + tree.y1) / 2;

      tree.children = [
        { x0: tree.x0, y0: tree.y0, x1: mx, y1: my, nodes: [], children: null },
        { x0: mx, y0: tree.y0, x1: tree.x1, y1: my, nodes: [], children: null },
        { x0: tree.x0, y0: my, x1: mx, y1: tree.y1, nodes: [], children: null },
        { x0: mx, y0: my, x1: tree.x1, y1: tree.y1, nodes: [], children: null }
      ];

      // Move existing nodes
      tree.nodes.forEach(n => {
        const quadrant = this.getQuadrant(tree, n);
        tree.children[quadrant].nodes.push(n);
      });
      tree.nodes = [];
    }

    // Insert new node
    const quadrant = this.getQuadrant(tree, node);
    this.insertQuadtree(tree.children[quadrant], node);
  }

  /**
   * Get quadrant index for node
   */
  getQuadrant(tree, node) {
    const mx = (tree.x0 + tree.x1) / 2;
    const my = (tree.y0 + tree.y1) / 2;

    if (node.x < mx) {
      return node.y < my ? 0 : 2;
    } else {
      return node.y < my ? 1 : 3;
    }
  }

  /**
   * Apply force from quadtree
   */
  applyQuadtreeForce(node, tree, strength) {
    if (!tree) return;

    const dx = tree.x - node.x || 0.001;
    const dy = tree.y - node.y || 0.001;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (tree.children) {
      const width = tree.x1 - tree.x0;
      const theta = 0.5; // Barnes-Hut theta parameter

      if (width / distance < theta) {
        // Treat as single body
        const force = strength / (distance * distance);
        node.vx += (dx / distance) * force;
        node.vy += (dy / distance) * force;
      } else {
        // Recurse
        tree.children.forEach(child => {
          if (child) this.applyQuadtreeForce(node, child, strength);
        });
      }
    } else {
      // Leaf node
      tree.nodes.forEach(other => {
        if (other !== node) {
          const dx = other.x - node.x || 0.001;
          const dy = other.y - node.y || 0.001;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const force = strength / (distance * distance);
          node.vx -= (dx / distance) * force;
          node.vy -= (dy / distance) * force;
        }
      });
    }
  }

  /**
   * Apply link force (attraction along edges)
   */
  applyLinkForce(alpha) {
    const strength = this.options.forces.link * alpha;

    this.edges.forEach(edge => {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);

      if (!source || !target) return;

      const dx = target.x - source.x || 0.001;
      const dy = target.y - source.y || 0.001;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const force = (distance - 100) * strength / distance;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });
  }

  /**
   * Apply center force (gravity towards center)
   */
  applyCenterForce(alpha) {
    const strength = this.options.forces.center * alpha;
    const cx = 0;
    const cy = 0;

    this.nodes.forEach(node => {
      const dx = cx - node.x;
      const dy = cy - node.y;

      node.vx += dx * strength;
      node.vy += dy * strength;
    });
  }

  /**
   * Apply collision force (prevent overlapping)
   */
  applyCollisionForce(alpha) {
    const radius = this.options.forces.collision;
    const strength = 0.7 * alpha;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];

        const dx = nodeB.x - nodeA.x || 0.001;
        const dy = nodeB.y - nodeA.y || 0.001;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = radius * 2;

        if (distance < minDistance) {
          const force = (minDistance - distance) * strength / distance;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          nodeA.vx -= fx;
          nodeA.vy -= fy;
          nodeB.vx += fx;
          nodeB.vy += fy;
        }
      }
    }
  }

  /**
   * Update node positions based on velocities
   */
  updatePositions(alpha) {
    const decay = this.options.velocityDecay;

    this.nodes.forEach(node => {
      // Apply velocity decay
      node.vx *= decay;
      node.vy *= decay;

      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Constrain to bounds
      node.x = Math.max(-1000, Math.min(1000, node.x));
      node.y = Math.max(-1000, Math.min(1000, node.y));
    });
  }
}

/**
 * Community detection using Louvain algorithm
 */
class CommunityDetection {
  constructor(nodes, edges) {
    this.nodes = nodes;
    this.edges = edges;
    this.communities = new Map();

    // Initialize each node in its own community
    this.nodes.forEach(node => {
      this.communities.set(node.id, node.id);
    });
  }

  /**
   * Run Louvain algorithm
   */
  detect() {
    let improved = true;
    let iterations = 0;

    while (improved && iterations < 100) {
      improved = false;

      for (const node of this.nodes) {
        const currentCommunity = this.communities.get(node.id);
        const neighbors = this.getNeighbors(node.id);

        let bestCommunity = currentCommunity;
        let bestGain = 0;

        for (const neighbor of neighbors) {
          const neighborCommunity = this.communities.get(neighbor);
          if (neighborCommunity === currentCommunity) continue;

          const gain = this.calculateModularityGain(node.id, neighborCommunity);
          if (gain > bestGain) {
            bestGain = gain;
            bestCommunity = neighborCommunity;
          }
        }

        if (bestCommunity !== currentCommunity) {
          this.communities.set(node.id, bestCommunity);
          improved = true;
        }
      }

      iterations++;
    }

    return this.communities;
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId) {
    const neighbors = new Set();

    this.edges.forEach(edge => {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    });

    return Array.from(neighbors);
  }

  /**
   * Calculate modularity gain
   */
  calculateModularityGain(nodeId, targetCommunity) {
    // Simplified modularity calculation
    const currentCommunity = this.communities.get(nodeId);
    const edgesToTarget = this.edges.filter(e =>
      (e.source === nodeId && this.communities.get(e.target) === targetCommunity) ||
      (e.target === nodeId && this.communities.get(e.source) === targetCommunity)
    ).length;

    const edgesToCurrent = this.edges.filter(e =>
      (e.source === nodeId && this.communities.get(e.target) === currentCommunity) ||
      (e.target === nodeId && this.communities.get(e.source) === currentCommunity)
    ).length;

    return edgesToTarget - edgesToCurrent;
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'simulate':
      const simulation = new ForceSimulation(data.nodes, data.edges, data.options);
      const result = simulation.simulate();

      self.postMessage({
        type: 'simulation-complete',
        nodes: result
      });
      break;

    case 'detect-communities':
      const detector = new CommunityDetection(data.nodes, data.edges);
      const communities = detector.detect();

      self.postMessage({
        type: 'communities-detected',
        communities: Object.fromEntries(communities)
      });
      break;

    case 'calculate-centrality':
      const centrality = calculateCentrality(data.nodes, data.edges, data.algorithm);

      self.postMessage({
        type: 'centrality-calculated',
        centrality
      });
      break;

    case 'find-shortest-path':
      const path = findShortestPath(data.nodes, data.edges, data.source, data.target);

      self.postMessage({
        type: 'path-found',
        path
      });
      break;

    default:
      self.postMessage({
        type: 'error',
        message: `Unknown message type: ${type}`
      });
  }
};

/**
 * Calculate node centrality
 */
function calculateCentrality(nodes, edges, algorithm = 'degree') {
  const centrality = new Map();

  switch (algorithm) {
    case 'degree':
      // Degree centrality
      nodes.forEach(node => {
        const degree = edges.filter(e =>
          e.source === node.id || e.target === node.id
        ).length;
        centrality.set(node.id, degree);
      });
      break;

    case 'betweenness':
      // Simplified betweenness centrality
      nodes.forEach(node => {
        let betweenness = 0;
        // Calculate shortest paths through this node
        for (const source of nodes) {
          for (const target of nodes) {
            if (source.id !== target.id && source.id !== node.id && target.id !== node.id) {
              const pathWithNode = findShortestPath(nodes, edges, source.id, target.id, node.id);
              const pathWithout = findShortestPath(nodes, edges, source.id, target.id);

              if (pathWithNode && pathWithNode.includes(node.id)) {
                betweenness++;
              }
            }
          }
        }
        centrality.set(node.id, betweenness);
      });
      break;

    case 'closeness':
      // Closeness centrality
      nodes.forEach(node => {
        let totalDistance = 0;
        let reachableNodes = 0;

        for (const other of nodes) {
          if (other.id !== node.id) {
            const path = findShortestPath(nodes, edges, node.id, other.id);
            if (path) {
              totalDistance += path.length;
              reachableNodes++;
            }
          }
        }

        const closeness = reachableNodes > 0 ? reachableNodes / totalDistance : 0;
        centrality.set(node.id, closeness);
      });
      break;
  }

  return Object.fromEntries(centrality);
}

/**
 * Find shortest path using BFS
 */
function findShortestPath(nodes, edges, sourceId, targetId, throughNode = null) {
  const queue = [{ id: sourceId, path: [sourceId] }];
  const visited = new Set([sourceId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift();

    if (id === targetId) {
      if (!throughNode || path.includes(throughNode)) {
        return path;
      }
    }

    const neighbors = edges
      .filter(e => e.source === id || e.target === id)
      .map(e => e.source === id ? e.target : e.source);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          id: neighbor,
          path: [...path, neighbor]
        });
      }
    }
  }

  return null;
}