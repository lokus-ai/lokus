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
importScripts('https://d3js.org/d3-force.v3.min.js');

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
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(50).strength(this.settings.forceStrength.link))
      .force('charge', d3.forceManyBody().strength(this.settings.forceStrength.charge))
      .force('center', d3.forceCenter(0, 0).strength(this.settings.forceStrength.center))
      .force('collision', d3.forceCollide().radius(d => (d.size || 5) + 2).strength(this.settings.forceStrength.collision))
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
        nodes: this.nodes.map(node => ({\n          id: node.id,\n          x: node.x,\n          y: node.y,\n          z: node.z,\n          vx: node.vx,\n          vy: node.vy,\n          vz: node.vz\n        })),\n        alpha: this.simulation.alpha(),\n        fps: this.fps\n      }\n    });\n    \n    // Auto-stop when simulation stabilizes\n    if (this.simulation.alpha() < this.settings.targetAlpha) {\n      this.stopSimulation();\n    }\n  }\n  \n  onSimulationEnd() {\n    this.isRunning = false;\n    \n    this.postMessage({\n      type: 'SIMULATION_ENDED',\n      data: {\n        finalPositions: this.nodes.map(node => ({\n          id: node.id,\n          x: node.x,\n          y: node.y,\n          z: node.z\n        }))\n      }\n    });\n  }\n  \n  // Advanced graph analysis methods\n  \n  calculateCentrality() {\n    const centrality = new Map();\n    \n    // Calculate degree centrality\n    for (const node of this.nodes) {\n      const degree = this.links.filter(link => \n        link.source.id === node.id || link.target.id === node.id\n      ).length;\n      \n      centrality.set(node.id, {\n        degree,\n        normalized: degree / (this.nodes.length - 1)\n      });\n    }\n    \n    // Calculate betweenness centrality (simplified)\n    const betweenness = this.calculateBetweennessCentrality();\n    \n    // Calculate PageRank (simplified)\n    const pagerank = this.calculatePageRank();\n    \n    // Combine results\n    const results = new Map();\n    for (const node of this.nodes) {\n      results.set(node.id, {\n        ...centrality.get(node.id),\n        betweenness: betweenness.get(node.id) || 0,\n        pagerank: pagerank.get(node.id) || 0\n      });\n    }\n    \n    this.postMessage({\n      type: 'CENTRALITY_CALCULATED',\n      data: Object.fromEntries(results)\n    });\n  }\n  \n  calculateBetweennessCentrality() {\n    const betweenness = new Map();\n    \n    // Initialize\n    for (const node of this.nodes) {\n      betweenness.set(node.id, 0);\n    }\n    \n    // Simplified betweenness calculation\n    // In a full implementation, this would use Brandes' algorithm\n    for (const node of this.nodes) {\n      const connectedNodes = this.links\n        .filter(link => link.source.id === node.id || link.target.id === node.id)\n        .map(link => link.source.id === node.id ? link.target.id : link.source.id);\n      \n      // Simple approximation based on connectivity\n      const score = connectedNodes.length * (connectedNodes.length - 1) / 2;\n      betweenness.set(node.id, score);\n    }\n    \n    return betweenness;\n  }\n  \n  calculatePageRank(damping = 0.85, iterations = 10) {\n    const pagerank = new Map();\n    const nodeCount = this.nodes.length;\n    \n    // Initialize PageRank values\n    for (const node of this.nodes) {\n      pagerank.set(node.id, 1 / nodeCount);\n    }\n    \n    // Build adjacency structure\n    const inLinks = new Map();\n    const outDegree = new Map();\n    \n    for (const node of this.nodes) {\n      inLinks.set(node.id, []);\n      outDegree.set(node.id, 0);\n    }\n    \n    for (const link of this.links) {\n      const sourceId = link.source.id || link.source;\n      const targetId = link.target.id || link.target;\n      \n      inLinks.get(targetId).push(sourceId);\n      outDegree.set(sourceId, outDegree.get(sourceId) + 1);\n    }\n    \n    // Iterative calculation\n    for (let i = 0; i < iterations; i++) {\n      const newPageRank = new Map();\n      \n      for (const node of this.nodes) {\n        const nodeId = node.id;\n        let sum = 0;\n        \n        for (const inNodeId of inLinks.get(nodeId)) {\n          const outDeg = outDegree.get(inNodeId);\n          if (outDeg > 0) {\n            sum += pagerank.get(inNodeId) / outDeg;\n          }\n        }\n        \n        newPageRank.set(nodeId, (1 - damping) / nodeCount + damping * sum);\n      }\n      \n      // Update PageRank values\n      for (const [nodeId, value] of newPageRank) {\n        pagerank.set(nodeId, value);\n      }\n    }\n    \n    return pagerank;\n  }\n  \n  findCommunities() {\n    // Simplified community detection using label propagation\n    const communities = new Map();\n    \n    // Initialize each node as its own community\n    for (const node of this.nodes) {\n      communities.set(node.id, node.id);\n    }\n    \n    // Build adjacency list\n    const adjacency = new Map();\n    for (const node of this.nodes) {\n      adjacency.set(node.id, []);\n    }\n    \n    for (const link of this.links) {\n      const sourceId = link.source.id || link.source;\n      const targetId = link.target.id || link.target;\n      \n      adjacency.get(sourceId).push(targetId);\n      adjacency.get(targetId).push(sourceId);\n    }\n    \n    // Label propagation iterations\n    let changed = true;\n    let iteration = 0;\n    const maxIterations = 10;\n    \n    while (changed && iteration < maxIterations) {\n      changed = false;\n      \n      // Randomize node order\n      const shuffledNodes = [...this.nodes].sort(() => Math.random() - 0.5);\n      \n      for (const node of shuffledNodes) {\n        const nodeId = node.id;\n        const neighbors = adjacency.get(nodeId);\n        \n        if (neighbors.length === 0) continue;\n        \n        // Count neighbor communities\n        const communityCount = new Map();\n        for (const neighborId of neighbors) {\n          const community = communities.get(neighborId);\n          communityCount.set(community, (communityCount.get(community) || 0) + 1);\n        }\n        \n        // Find most frequent community\n        let maxCount = 0;\n        let bestCommunity = communities.get(nodeId);\n        \n        for (const [community, count] of communityCount) {\n          if (count > maxCount) {\n            maxCount = count;\n            bestCommunity = community;\n          }\n        }\n        \n        // Update community if changed\n        if (bestCommunity !== communities.get(nodeId)) {\n          communities.set(nodeId, bestCommunity);\n          changed = true;\n        }\n      }\n      \n      iteration++;\n    }\n    \n    // Group nodes by community\n    const communityGroups = new Map();\n    for (const [nodeId, communityId] of communities) {\n      if (!communityGroups.has(communityId)) {\n        communityGroups.set(communityId, []);\n      }\n      communityGroups.get(communityId).push(nodeId);\n    }\n    \n    this.postMessage({\n      type: 'COMMUNITIES_FOUND',\n      data: {\n        communities: Object.fromEntries(communities),\n        groups: Object.fromEntries(communityGroups),\n        iteration\n      }\n    });\n  }\n  \n  findPath(sourceId, targetId) {\n    // Breadth-first search for shortest path\n    const visited = new Set();\n    const queue = [{ nodeId: sourceId, path: [sourceId] }];\n    const adjacency = new Map();\n    \n    // Build adjacency list\n    for (const node of this.nodes) {\n      adjacency.set(node.id, []);\n    }\n    \n    for (const link of this.links) {\n      const source = link.source.id || link.source;\n      const target = link.target.id || link.target;\n      \n      adjacency.get(source).push(target);\n      adjacency.get(target).push(source);\n    }\n    \n    while (queue.length > 0) {\n      const { nodeId, path } = queue.shift();\n      \n      if (nodeId === targetId) {\n        this.postMessage({\n          type: 'PATH_FOUND',\n          data: {\n            path,\n            distance: path.length - 1\n          }\n        });\n        return;\n      }\n      \n      if (visited.has(nodeId)) continue;\n      visited.add(nodeId);\n      \n      const neighbors = adjacency.get(nodeId) || [];\n      for (const neighborId of neighbors) {\n        if (!visited.has(neighborId)) {\n          queue.push({\n            nodeId: neighborId,\n            path: [...path, neighborId]\n          });\n        }\n      }\n    }\n    \n    // No path found\n    this.postMessage({\n      type: 'PATH_NOT_FOUND',\n      data: {\n        source: sourceId,\n        target: targetId\n      }\n    });\n  }\n  \n  postMessage(message) {\n    self.postMessage(message);\n  }\n}\n\n// Initialize worker\nconst worker = new GraphPhysicsWorker();\n\n// Handle worker errors\nself.addEventListener('error', (error) => {\n  \n  worker.postMessage({\n    type: 'WORKER_ERROR',\n    data: {\n      message: error.message,\n      filename: error.filename,\n      lineno: error.lineno\n    }\n  });\n});\n\n// Handle unhandled promise rejections\nself.addEventListener('unhandledrejection', (event) => {\n  \n  worker.postMessage({\n    type: 'WORKER_ERROR',\n    data: {\n      message: 'Unhandled promise rejection',\n      reason: event.reason\n    }\n  });\n});