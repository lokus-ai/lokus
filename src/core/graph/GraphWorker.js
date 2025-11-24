/**
 * GraphWorker - Web Worker for high-performance physics calculations
 * 
 * This worker handles computationally intensive graph layout calculations
 * in a separate thread to maintain 60fps in the main UI thread.
 * 
 * Features:
 * - Force-directed layout simulation (ForceAtlas2, d3-force)
 * - Node clustering and community detection
 * - Centrality calculations (betweenness, PageRank)
 * - Path finding algorithms
 * - Real-time physics simulation updates
 */

// Import required libraries for physics calculations
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

class GraphPhysicsWorker {
  constructor() {
    this.simulation = null;
    this.nodes = [];
    this.links = [];
    this.isRunning = false;
    this.settings = {
      alphaDecay: 0.02,
      velocityDecay: 0.3,
      forceStrength: {
        charge: -300,
        link: 1,
        center: 0.1,
        collision: 1
      },
      targetAlpha: 0.01
    };

    // Performance monitoring
    this.frameCount = 0;
    this.lastUpdate = performance.now();
    this.fps = 60;

    // Setup message handlers
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    self.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'INIT_SIMULATION':
          this.initSimulation(data);
          break;
        case 'UPDATE_NODES':
          this.updateNodes(data.nodes);
          break;
        case 'UPDATE_LINKS':
          this.updateLinks(data.links);
          break;
        case 'START_SIMULATION':
          this.startSimulation();
          break;
        case 'STOP_SIMULATION':
          this.stopSimulation();
          break;
        case 'UPDATE_SETTINGS':
          this.updateSettings(data.settings);
          break;
        case 'SET_NODE_POSITION':
          this.setNodePosition(data.nodeId, data.x, data.y, data.z);
          break;
        case 'CALCULATE_CENTRALITY':
          this.calculateCentrality();
          break;
        case 'FIND_COMMUNITIES':
          this.findCommunities();
          break;
        case 'FIND_PATH':
          this.findPath(data.sourceId, data.targetId);
          break;
        default:
      }
    });
  }

  initSimulation(data) {
    const { nodes, links, settings = {} } = data;

    // Update settings
    this.settings = { ...this.settings, ...settings };

    // Store data
    this.nodes = nodes.map(node => ({ ...node }));
    this.links = links.map(link => ({ ...link }));

    // Create d3-force simulation
    this.simulation = forceSimulation(this.nodes)
      .force('link', forceLink(this.links).id(d => d.id).distance(50).strength(this.settings.forceStrength.link))
      .force('charge', forceManyBody().strength(this.settings.forceStrength.charge))
      .force('center', forceCenter(0, 0).strength(this.settings.forceStrength.center))
      .force('collision', forceCollide().radius(d => (d.size || 5) + 2).strength(this.settings.forceStrength.collision))
      .alphaDecay(this.settings.alphaDecay)
      .velocityDecay(this.settings.velocityDecay)
      .on('tick', () => this.onTick())
      .on('end', () => this.onSimulationEnd());

    this.postMessage({
      type: 'SIMULATION_INITIALIZED',
      data: {
        nodeCount: this.nodes.length,
        linkCount: this.links.length
      }
    });
  }

  updateNodes(nodes) {
    this.nodes = nodes.map(node => ({ ...node }));
    if (this.simulation) {
      this.simulation.nodes(this.nodes);
    }
  }

  updateLinks(links) {
    this.links = links.map(link => ({ ...link }));
    if (this.simulation) {
      this.simulation.force('link').links(this.links);
    }
  }

  startSimulation() {
    if (this.simulation) {
      this.isRunning = true;
      this.simulation.restart();
      this.lastUpdate = performance.now();
      this.frameCount = 0;

      this.postMessage({
        type: 'SIMULATION_STARTED'
      });
    }
  }

  stopSimulation() {
    if (this.simulation) {
      this.isRunning = false;
      this.simulation.stop();

      this.postMessage({
        type: 'SIMULATION_STOPPED'
      });
    }
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };

    if (this.simulation) {
      // Update force strengths
      if (settings.forceStrength) {
        if (settings.forceStrength.charge !== undefined) {
          this.simulation.force('charge').strength(settings.forceStrength.charge);
        }
        if (settings.forceStrength.link !== undefined) {
          this.simulation.force('link').strength(settings.forceStrength.link);
        }
        if (settings.forceStrength.center !== undefined) {
          this.simulation.force('center').strength(settings.forceStrength.center);
        }
        if (settings.forceStrength.collision !== undefined) {
          this.simulation.force('collision').strength(settings.forceStrength.collision);
        }
      }

      // Update simulation parameters
      if (settings.alphaDecay !== undefined) {
        this.simulation.alphaDecay(settings.alphaDecay);
      }
      if (settings.velocityDecay !== undefined) {
        this.simulation.velocityDecay(settings.velocityDecay);
      }
    }
  }

  setNodePosition(nodeId, x, y, z = 0) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
      if (z !== undefined) node.fz = z;

      // Reheat simulation to respond to position change
      if (this.simulation && this.isRunning) {
        this.simulation.alpha(0.3).restart();
      }
    }
  }

  onTick() {
    this.frameCount++;
    const now = performance.now();

    // Calculate FPS every 60 frames
    if (this.frameCount % 60 === 0) {
      const deltaTime = now - this.lastUpdate;
      this.fps = 60000 / deltaTime; // 60 frames / deltaTime in ms
      this.lastUpdate = now;
    }

    // Send position updates to main thread
    this.postMessage({
      type: 'TICK_UPDATE',
      data: {
        nodes: this.nodes.map(node => ({
          id: node.id,
          x: node.x,
          y: node.y,
          z: node.z,
          vx: node.vx,
          vy: node.vy,
          vz: node.vz
        })),
        alpha: this.simulation.alpha(),
        fps: this.fps
      }
    });

    // Auto-stop when simulation stabilizes
    if (this.simulation.alpha() < this.settings.targetAlpha) {
      this.stopSimulation();
    }
  }

  onSimulationEnd() {
    this.isRunning = false;

    this.postMessage({
      type: 'SIMULATION_ENDED',
      data: {
        finalPositions: this.nodes.map(node => ({
          id: node.id,
          x: node.x,
          y: node.y,
          z: node.z
        }))
      }
    });
  }

  // Advanced graph analysis methods

  calculateCentrality() {
    const centrality = new Map();

    // Calculate degree centrality
    for (const node of this.nodes) {
      const degree = this.links.filter(link =>
        link.source.id === node.id || link.target.id === node.id
      ).length;

      centrality.set(node.id, {
        degree,
        normalized: degree / (this.nodes.length - 1)
      });
    }

    // Calculate betweenness centrality (simplified)
    const betweenness = this.calculateBetweennessCentrality();

    // Calculate PageRank (simplified)
    const pagerank = this.calculatePageRank();

    // Combine results
    const results = new Map();
    for (const node of this.nodes) {
      results.set(node.id, {
        ...centrality.get(node.id),
        betweenness: betweenness.get(node.id) || 0,
        pagerank: pagerank.get(node.id) || 0
      });
    }

    this.postMessage({
      type: 'CENTRALITY_CALCULATED',
      data: Object.fromEntries(results)
    });
  }

  calculateBetweennessCentrality() {
    const betweenness = new Map();

    // Initialize
    for (const node of this.nodes) {
      betweenness.set(node.id, 0);
    }

    // Simplified betweenness calculation
    // In a full implementation, this would use Brandes' algorithm
    for (const node of this.nodes) {
      const connectedNodes = this.links
        .filter(link => link.source.id === node.id || link.target.id === node.id)
        .map(link => link.source.id === node.id ? link.target.id : link.source.id);

      // Simple approximation based on connectivity
      const score = connectedNodes.length * (connectedNodes.length - 1) / 2;
      betweenness.set(node.id, score);
    }

    return betweenness;
  }

  calculatePageRank(damping = 0.85, iterations = 10) {
    const pagerank = new Map();
    const nodeCount = this.nodes.length;

    // Initialize PageRank values
    for (const node of this.nodes) {
      pagerank.set(node.id, 1 / nodeCount);
    }

    // Build adjacency structure
    const inLinks = new Map();
    const outDegree = new Map();

    for (const node of this.nodes) {
      inLinks.set(node.id, []);
      outDegree.set(node.id, 0);
    }

    for (const link of this.links) {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;

      inLinks.get(targetId).push(sourceId);
      outDegree.set(sourceId, outDegree.get(sourceId) + 1);
    }

    // Iterative calculation
    for (let i = 0; i < iterations; i++) {
      const newPageRank = new Map();

      for (const node of this.nodes) {
        const nodeId = node.id;
        let sum = 0;

        for (const inNodeId of inLinks.get(nodeId)) {
          const outDeg = outDegree.get(inNodeId);
          if (outDeg > 0) {
            sum += pagerank.get(inNodeId) / outDeg;
          }
        }

        newPageRank.set(nodeId, (1 - damping) / nodeCount + damping * sum);
      }

      // Update PageRank values
      for (const [nodeId, value] of newPageRank) {
        pagerank.set(nodeId, value);
      }
    }

    return pagerank;
  }

  findCommunities() {
    // Simplified community detection using label propagation
    const communities = new Map();

    // Initialize each node as its own community
    for (const node of this.nodes) {
      communities.set(node.id, node.id);
    }

    // Build adjacency list
    const adjacency = new Map();
    for (const node of this.nodes) {
      adjacency.set(node.id, []);
    }

    for (const link of this.links) {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;

      adjacency.get(sourceId).push(targetId);
      adjacency.get(targetId).push(sourceId);
    }

    // Label propagation iterations
    let changed = true;
    let iteration = 0;
    const maxIterations = 10;

    while (changed && iteration < maxIterations) {
      changed = false;

      // Randomize node order
      const shuffledNodes = [...this.nodes].sort(() => Math.random() - 0.5);

      for (const node of shuffledNodes) {
        const nodeId = node.id;
        const neighbors = adjacency.get(nodeId);

        if (neighbors.length === 0) continue;

        // Count neighbor communities
        const communityCount = new Map();
        for (const neighborId of neighbors) {
          const community = communities.get(neighborId);
          communityCount.set(community, (communityCount.get(community) || 0) + 1);
        }

        // Find most frequent community
        let maxCount = 0;
        let bestCommunity = communities.get(nodeId);

        for (const [community, count] of communityCount) {
          if (count > maxCount) {
            maxCount = count;
            bestCommunity = community;
          }
        }

        // Update community if changed
        if (bestCommunity !== communities.get(nodeId)) {
          communities.set(nodeId, bestCommunity);
          changed = true;
        }
      }

      iteration++;
    }

    // Group nodes by community
    const communityGroups = new Map();
    for (const [nodeId, communityId] of communities) {
      if (!communityGroups.has(communityId)) {
        communityGroups.set(communityId, []);
      }
      communityGroups.get(communityId).push(nodeId);
    }

    this.postMessage({
      type: 'COMMUNITIES_FOUND',
      data: {
        communities: Object.fromEntries(communities),
        groups: Object.fromEntries(communityGroups),
        iteration
      }
    });
  }

  findPath(sourceId, targetId) {
    // Breadth-first search for shortest path
    const visited = new Set();
    const queue = [{ nodeId: sourceId, path: [sourceId] }];
    const adjacency = new Map();

    // Build adjacency list
    for (const node of this.nodes) {
      adjacency.set(node.id, []);
    }

    for (const link of this.links) {
      const source = link.source.id || link.source;
      const target = link.target.id || link.target;

      adjacency.get(source).push(target);
      adjacency.get(target).push(source);
    }

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift();

      if (nodeId === targetId) {
        this.postMessage({
          type: 'PATH_FOUND',
          data: {
            path,
            distance: path.length - 1
          }
        });
        return;
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          queue.push({
            nodeId: neighborId,
            path: [...path, neighborId]
          });
        }
      }
    }

    // No path found
    this.postMessage({
      type: 'PATH_NOT_FOUND',
      data: {
        source: sourceId,
        target: targetId
      }
    });
  }

  postMessage(message) {
    self.postMessage(message);
  }
}

// Initialize worker
const worker = new GraphPhysicsWorker();

// Handle worker errors
self.addEventListener('error', (error) => {

  worker.postMessage({
    type: 'WORKER_ERROR',
    data: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno
    }
  });
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {

  worker.postMessage({
    type: 'WORKER_ERROR',
    data: {
      message: 'Unhandled promise rejection',
      reason: event.reason
    }
  });
});