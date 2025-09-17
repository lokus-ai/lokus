/**
 * GraphWorker.js - Web Worker for heavy graph calculations
 * 
 * This Web Worker handles computationally expensive graph operations
 * in a background thread to prevent blocking the main UI thread.
 * 
 * Features:
 * - Force simulation calculations (ForceAtlas2)
 * - Large dataset processing
 * - Graph analytics (centrality, clustering, etc.)
 * - Layout optimization algorithms
 * - Pathfinding and graph traversal
 * - Real-time graph updates
 */

// Worker-specific imports and polyfills
let forceAtlas2 = null;
let Graph = null;

// Initialize worker with required libraries
const initializeWorker = async () => {
  try {
    // Import graph libraries (these would need to be available in worker context)
    // For now, we'll implement basic force simulation algorithms
    console.log('🔧 GraphWorker initialized');
  } catch (error) {
    console.error('Failed to initialize GraphWorker:', error);
  }
};

// Worker state
const workerState = {
  graph: null,
  layoutConfig: null,
  isRunning: false,
  currentIteration: 0,
  maxIterations: 1000,
  stabilityThreshold: 0.005,
  lastEnergy: Infinity,
  nodes: new Map(),
  edges: new Map(),
  forces: new Map(),
  
  // Performance tracking
  performance: {
    iterationsPerSecond: 0,
    totalIterations: 0,
    totalTime: 0,
    lastIterationTime: 0
  },
  
  // Cache for expensive calculations
  cache: {
    distances: new Map(),
    centrality: new Map(),
    clustering: new Map(),
    lastCacheUpdate: 0
  }
};

/**
 * Main message handler for the worker
 */
self.onmessage = function(event) {
  const { type, data, id } = event.data;
  
  try {
    switch (type) {
      case 'init':
        handleInit(data, id);
        break;
      
      case 'setGraph':
        handleSetGraph(data, id);
        break;
      
      case 'startLayout':
        handleStartLayout(data, id);
        break;
      
      case 'stopLayout':
        handleStopLayout(data, id);
        break;
      
      case 'stepLayout':
        handleStepLayout(data, id);
        break;
      
      case 'calculateMetrics':
        handleCalculateMetrics(data, id);
        break;
      
      case 'optimizeLayout':
        handleOptimizeLayout(data, id);
        break;
      
      case 'findShortestPath':
        handleFindShortestPath(data, id);
        break;
      
      case 'detectCommunities':
        handleDetectCommunities(data, id);
        break;
      
      case 'updateNodes':
        handleUpdateNodes(data, id);
        break;
      
      case 'getPerformanceMetrics':
        handleGetPerformanceMetrics(data, id);
        break;
      
      default:
        postMessage({
          type: 'error',
          id,
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    postMessage({
      type: 'error',
      id,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Initialize the worker with configuration
 */
function handleInit(config, id) {
  workerState.layoutConfig = {
    gravity: config.gravity || 1,
    scalingRatio: config.scalingRatio || 10,
    strongGravityMode: config.strongGravityMode || false,
    barnesHutOptimize: config.barnesHutOptimize || true,
    barnesHutTheta: config.barnesHutTheta || 0.5,
    linLogMode: config.linLogMode || false,
    adjustSizes: config.adjustSizes || false,
    slowDown: config.slowDown || 1,
    outboundAttractionDistribution: config.outboundAttractionDistribution || false,
    ...config
  };
  
  workerState.maxIterations = config.maxIterations || 1000;
  workerState.stabilityThreshold = config.stabilityThreshold || 0.005;
  
  postMessage({
    type: 'initialized',
    id,
    success: true
  });
}

/**
 * Set the graph data for processing
 */
function handleSetGraph(graphData, id) {
  workerState.nodes.clear();
  workerState.edges.clear();
  workerState.forces.clear();
  
  // Convert nodes to internal format
  graphData.nodes.forEach(node => {
    workerState.nodes.set(node.key, {
      id: node.key,
      x: node.attributes.x || Math.random() * 1000,
      y: node.attributes.y || Math.random() * 1000,
      size: node.attributes.size || 8,
      mass: node.attributes.mass || 1,
      vx: 0, // velocity
      vy: 0,
      fx: 0, // force
      fy: 0,
      oldX: node.attributes.x || Math.random() * 1000,
      oldY: node.attributes.y || Math.random() * 1000,
      ...node.attributes
    });
  });
  
  // Convert edges to internal format
  graphData.edges.forEach(edge => {
    workerState.edges.set(edge.key, {
      id: edge.key,
      source: edge.source,
      target: edge.target,
      weight: edge.attributes.weight || 1,
      ...edge.attributes
    });
  });
  
  // Initialize forces
  initializeForces();
  
  postMessage({
    type: 'graphSet',
    id,
    nodeCount: workerState.nodes.size,
    edgeCount: workerState.edges.size
  });
}

/**
 * Initialize force calculation systems
 */
function initializeForces() {
  // Initialize force vectors for all nodes
  for (const [nodeId, node] of workerState.nodes) {
    workerState.forces.set(nodeId, {
      repulsion: { x: 0, y: 0 },
      attraction: { x: 0, y: 0 },
      gravity: { x: 0, y: 0 },
      total: { x: 0, y: 0 }
    });
  }
}

/**
 * Start the layout calculation
 */
function handleStartLayout(config, id) {
  if (workerState.isRunning) {
    postMessage({
      type: 'error',
      id,
      error: 'Layout is already running'
    });
    return;
  }
  
  workerState.isRunning = true;
  workerState.currentIteration = 0;
  workerState.performance.totalTime = 0;
  
  // Override config if provided
  if (config) {
    Object.assign(workerState.layoutConfig, config);
  }
  
  postMessage({
    type: 'layoutStarted',
    id,
    success: true
  });
  
  // Start the layout loop
  runLayoutLoop();
}

/**
 * Stop the layout calculation
 */
function handleStopLayout(data, id) {
  workerState.isRunning = false;
  
  postMessage({
    type: 'layoutStopped',
    id,
    iteration: workerState.currentIteration,
    totalTime: workerState.performance.totalTime
  });
}

/**
 * Perform a single layout step
 */
function handleStepLayout(data, id) {
  const startTime = performance.now();
  
  // Perform one iteration of the layout algorithm
  const stepResult = performLayoutStep();
  
  const endTime = performance.now();
  const stepTime = endTime - startTime;
  
  // Update performance metrics
  workerState.performance.lastIterationTime = stepTime;
  workerState.performance.totalTime += stepTime;
  workerState.performance.totalIterations++;
  
  postMessage({
    type: 'layoutStep',
    id,
    iteration: workerState.currentIteration,
    energy: stepResult.energy,
    stabilized: stepResult.stabilized,
    stepTime,
    nodePositions: Array.from(workerState.nodes.entries()).map(([id, node]) => ({
      id,
      x: node.x,
      y: node.y
    }))
  });
}

/**
 * Main layout calculation loop
 */
function runLayoutLoop() {
  const step = () => {
    if (!workerState.isRunning) return;
    
    const startTime = performance.now();
    const stepResult = performLayoutStep();
    const endTime = performance.now();
    
    // Update performance
    const stepTime = endTime - startTime;
    workerState.performance.lastIterationTime = stepTime;
    workerState.performance.totalTime += stepTime;
    workerState.performance.totalIterations++;
    
    // Send progress update
    postMessage({
      type: 'layoutProgress',
      iteration: workerState.currentIteration,
      energy: stepResult.energy,
      stabilized: stepResult.stabilized,
      stepTime,
      nodePositions: getOptimizedNodePositions()
    });
    
    // Check for completion
    if (stepResult.stabilized || workerState.currentIteration >= workerState.maxIterations) {
      workerState.isRunning = false;
      
      postMessage({
        type: 'layoutCompleted',
        iteration: workerState.currentIteration,
        totalTime: workerState.performance.totalTime,
        finalEnergy: stepResult.energy,
        reason: stepResult.stabilized ? 'stabilized' : 'maxIterations'
      });
      
      return;
    }
    
    // Continue loop
    setTimeout(step, 0); // Allow other messages to be processed
  };
  
  step();
}

/**
 * Get optimized node positions (only send necessary data)
 */
function getOptimizedNodePositions() {
  const positions = [];
  
  // Only send positions for nodes that moved significantly
  for (const [id, node] of workerState.nodes) {
    const dx = node.x - node.oldX;
    const dy = node.y - node.oldY;
    const movement = Math.sqrt(dx * dx + dy * dy);
    
    if (movement > 0.1) { // Only include nodes that moved
      positions.push({
        id,
        x: node.x,
        y: node.y
      });
      
      // Update old position
      node.oldX = node.x;
      node.oldY = node.y;
    }
  }
  
  return positions;
}

/**
 * Perform one step of the ForceAtlas2 algorithm
 */
function performLayoutStep() {
  const config = workerState.layoutConfig;
  
  // Reset forces
  for (const force of workerState.forces.values()) {
    force.repulsion.x = force.repulsion.y = 0;
    force.attraction.x = force.attraction.y = 0;
    force.gravity.x = force.gravity.y = 0;
    force.total.x = force.total.y = 0;
  }
  
  // Calculate repulsion forces (most expensive operation)
  if (config.barnesHutOptimize && workerState.nodes.size > 100) {
    calculateBarnesHutForces();
  } else {
    calculateBruteForceRepulsion();
  }
  
  // Calculate attraction forces
  calculateAttractionForces();
  
  // Calculate gravity forces
  calculateGravityForces();
  
  // Apply forces and update positions
  let totalEnergy = 0;
  
  for (const [nodeId, node] of workerState.nodes) {
    const force = workerState.forces.get(nodeId);
    
    // Sum all forces
    force.total.x = force.repulsion.x + force.attraction.x + force.gravity.x;
    force.total.y = force.repulsion.y + force.attraction.y + force.gravity.y;
    
    // Apply force with mass and slow down
    const massInverse = 1 / (node.mass || 1);
    const slowDown = config.slowDown || 1;
    
    node.vx = (node.vx + force.total.x * massInverse) * slowDown;
    node.vy = (node.vy + force.total.y * massInverse) * slowDown;
    
    // Update position
    node.x += node.vx;
    node.y += node.vy;
    
    // Calculate energy for this node
    const energy = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    totalEnergy += energy;
  }
  
  workerState.currentIteration++;
  
  // Check for stability
  const energyChange = Math.abs(totalEnergy - workerState.lastEnergy);
  const stabilized = energyChange < workerState.stabilityThreshold;
  
  workerState.lastEnergy = totalEnergy;
  
  return {
    energy: totalEnergy,
    stabilized,
    energyChange
  };
}

/**
 * Calculate repulsion forces using brute force (O(n²))
 */
function calculateBruteForceRepulsion() {
  const config = workerState.layoutConfig;
  const nodes = Array.from(workerState.nodes.values());
  
  for (let i = 0; i < nodes.length; i++) {
    const node1 = nodes[i];
    const force1 = workerState.forces.get(node1.id);
    
    for (let j = i + 1; j < nodes.length; j++) {
      const node2 = nodes[j];
      const force2 = workerState.forces.get(node2.id);
      
      // Calculate distance
      const dx = node1.x - node2.x;
      const dy = node1.y - node2.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 0.1) distance = 0.1; // Prevent division by zero
      
      // Calculate repulsion force magnitude
      const k = config.scalingRatio || 10;
      const forceMagnitude = k * k / distance;
      
      // Normalize direction
      const fx = (dx / distance) * forceMagnitude;
      const fy = (dy / distance) * forceMagnitude;
      
      // Apply forces (equal and opposite)
      force1.repulsion.x += fx;
      force1.repulsion.y += fy;
      force2.repulsion.x -= fx;
      force2.repulsion.y -= fy;
    }
  }
}

/**
 * Calculate repulsion forces using Barnes-Hut approximation (O(n log n))
 */
function calculateBarnesHutForces() {
  // Simplified Barnes-Hut implementation
  // In a full implementation, this would use a quadtree
  
  const config = workerState.layoutConfig;
  const theta = config.barnesHutTheta || 0.5;
  
  // For now, use a simplified approach that groups distant nodes
  const nodes = Array.from(workerState.nodes.values());
  
  for (const node1 of nodes) {
    const force1 = workerState.forces.get(node1.id);
    
    for (const node2 of nodes) {
      if (node1.id === node2.id) continue;
      
      const dx = node1.x - node2.x;
      const dy = node1.y - node2.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 0.1) distance = 0.1;
      
      // Barnes-Hut approximation check
      const nodeSize = Math.max(node1.size || 8, node2.size || 8);
      if (nodeSize / distance > theta) {
        // Use exact calculation for close nodes
        const k = config.scalingRatio || 10;
        const forceMagnitude = k * k / distance;
        
        force1.repulsion.x += (dx / distance) * forceMagnitude;
        force1.repulsion.y += (dy / distance) * forceMagnitude;
      } else {
        // Use approximation for distant nodes
        const k = config.scalingRatio || 10;
        const forceMagnitude = (k * k / distance) * 0.5; // Reduced force for approximation
        
        force1.repulsion.x += (dx / distance) * forceMagnitude;
        force1.repulsion.y += (dy / distance) * forceMagnitude;
      }
    }
  }
}

/**
 * Calculate attraction forces along edges
 */
function calculateAttractionForces() {
  const config = workerState.layoutConfig;
  
  for (const edge of workerState.edges.values()) {
    const sourceNode = workerState.nodes.get(edge.source);
    const targetNode = workerState.nodes.get(edge.target);
    
    if (!sourceNode || !targetNode) continue;
    
    const sourceForce = workerState.forces.get(edge.source);
    const targetForce = workerState.forces.get(edge.target);
    
    // Calculate distance
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.1) continue;
    
    // Calculate attraction force
    let forceMagnitude;
    
    if (config.linLogMode) {
      // LinLog mode
      forceMagnitude = Math.log(1 + distance) * (edge.weight || 1);
    } else {
      // Standard mode
      forceMagnitude = distance * (edge.weight || 1);
    }
    
    // Apply distribution
    if (config.outboundAttractionDistribution) {
      // Divide by node degree
      const sourceDegree = getNodeDegree(edge.source);
      const targetDegree = getNodeDegree(edge.target);
      forceMagnitude /= Math.max(sourceDegree, targetDegree);
    }
    
    // Normalize and apply
    const fx = (dx / distance) * forceMagnitude;
    const fy = (dy / distance) * forceMagnitude;
    
    sourceForce.attraction.x += fx;
    sourceForce.attraction.y += fy;
    targetForce.attraction.x -= fx;
    targetForce.attraction.y -= fy;
  }
}

/**
 * Calculate gravity forces
 */
function calculateGravityForces() {
  const config = workerState.layoutConfig;
  const gravity = config.gravity || 1;
  
  if (gravity === 0) return;
  
  // Calculate center of mass
  let centerX = 0, centerY = 0;
  for (const node of workerState.nodes.values()) {
    centerX += node.x;
    centerY += node.y;
  }
  centerX /= workerState.nodes.size;
  centerY /= workerState.nodes.size;
  
  // Apply gravity towards center
  for (const [nodeId, node] of workerState.nodes) {
    const force = workerState.forces.get(nodeId);
    
    const dx = centerX - node.x;
    const dy = centerY - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.1) continue;
    
    let gravityForce;
    
    if (config.strongGravityMode) {
      gravityForce = gravity;
    } else {
      gravityForce = gravity / distance;
    }
    
    force.gravity.x = (dx / distance) * gravityForce;
    force.gravity.y = (dy / distance) * gravityForce;
  }
}

/**
 * Get node degree (number of connections)
 */
function getNodeDegree(nodeId) {
  let degree = 0;
  for (const edge of workerState.edges.values()) {
    if (edge.source === nodeId || edge.target === nodeId) {
      degree++;
    }
  }
  return Math.max(1, degree);
}

/**
 * Calculate graph metrics (centrality, clustering, etc.)
 */
function handleCalculateMetrics(config, id) {
  const metrics = {};
  
  // Calculate degree centrality
  if (config.degreeCentrality) {
    metrics.degreeCentrality = calculateDegreeCentrality();
  }
  
  // Calculate betweenness centrality
  if (config.betweennessCentrality) {
    metrics.betweennessCentrality = calculateBetweennessCentrality();
  }
  
  // Calculate clustering coefficient
  if (config.clustering) {
    metrics.clustering = calculateClusteringCoefficient();
  }
  
  // Calculate PageRank
  if (config.pageRank) {
    metrics.pageRank = calculatePageRank();
  }
  
  postMessage({
    type: 'metricsCalculated',
    id,
    metrics
  });
}

/**
 * Calculate degree centrality for all nodes
 */
function calculateDegreeCentrality() {
  const centrality = new Map();
  
  for (const nodeId of workerState.nodes.keys()) {
    centrality.set(nodeId, getNodeDegree(nodeId));
  }
  
  return Array.from(centrality.entries()).map(([id, value]) => ({ id, value }));
}

/**
 * Calculate betweenness centrality (simplified version)
 */
function calculateBetweennessCentrality() {
  // This is a simplified version - full implementation would use Floyd-Warshall or Brandes' algorithm
  const centrality = new Map();
  const nodes = Array.from(workerState.nodes.keys());
  
  // Initialize all centralities to 0
  for (const nodeId of nodes) {
    centrality.set(nodeId, 0);
  }
  
  // For each pair of nodes, find shortest paths and count how many pass through each node
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const source = nodes[i];
      const target = nodes[j];
      
      const paths = findShortestPaths(source, target);
      
      if (paths.length > 0) {
        // Count nodes that appear in shortest paths
        const pathNodes = new Set();
        for (const path of paths) {
          for (let k = 1; k < path.length - 1; k++) { // Exclude source and target
            pathNodes.add(path[k]);
          }
        }
        
        // Distribute centrality
        const pathCount = paths.length;
        for (const nodeId of pathNodes) {
          centrality.set(nodeId, centrality.get(nodeId) + 1 / pathCount);
        }
      }
    }
  }
  
  return Array.from(centrality.entries()).map(([id, value]) => ({ id, value }));
}

/**
 * Calculate clustering coefficient
 */
function calculateClusteringCoefficient() {
  const clustering = new Map();
  
  for (const nodeId of workerState.nodes.keys()) {
    const neighbors = getNodeNeighbors(nodeId);
    
    if (neighbors.length < 2) {
      clustering.set(nodeId, 0);
      continue;
    }
    
    // Count triangles
    let triangles = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (areNodesConnected(neighbors[i], neighbors[j])) {
          triangles++;
        }
      }
    }
    
    // Calculate clustering coefficient
    const possibleTriangles = (neighbors.length * (neighbors.length - 1)) / 2;
    clustering.set(nodeId, triangles / possibleTriangles);
  }
  
  return Array.from(clustering.entries()).map(([id, value]) => ({ id, value }));
}

/**
 * Calculate PageRank (simplified version)
 */
function calculatePageRank() {
  const damping = 0.85;
  const epsilon = 0.0001;
  const maxIterations = 100;
  
  const nodes = Array.from(workerState.nodes.keys());
  const nodeCount = nodes.length;
  
  // Initialize PageRank values
  const pageRank = new Map();
  const newPageRank = new Map();
  
  for (const nodeId of nodes) {
    pageRank.set(nodeId, 1 / nodeCount);
  }
  
  // Iterate until convergence
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let maxChange = 0;
    
    for (const nodeId of nodes) {
      let sum = 0;
      
      // Sum contributions from all nodes linking to this node
      for (const edge of workerState.edges.values()) {
        if (edge.target === nodeId) {
          const sourceDegree = getNodeDegree(edge.source);
          sum += pageRank.get(edge.source) / sourceDegree;
        }
      }
      
      const newValue = (1 - damping) / nodeCount + damping * sum;
      newPageRank.set(nodeId, newValue);
      
      const change = Math.abs(newValue - pageRank.get(nodeId));
      maxChange = Math.max(maxChange, change);
    }
    
    // Update values
    for (const [nodeId, value] of newPageRank) {
      pageRank.set(nodeId, value);
    }
    
    // Check convergence
    if (maxChange < epsilon) {
      break;
    }
  }
  
  return Array.from(pageRank.entries()).map(([id, value]) => ({ id, value }));
}

/**
 * Get neighbors of a node
 */
function getNodeNeighbors(nodeId) {
  const neighbors = [];
  
  for (const edge of workerState.edges.values()) {
    if (edge.source === nodeId) {
      neighbors.push(edge.target);
    } else if (edge.target === nodeId) {
      neighbors.push(edge.source);
    }
  }
  
  return neighbors;
}

/**
 * Check if two nodes are connected
 */
function areNodesConnected(node1, node2) {
  for (const edge of workerState.edges.values()) {
    if ((edge.source === node1 && edge.target === node2) ||
        (edge.source === node2 && edge.target === node1)) {
      return true;
    }
  }
  return false;
}

/**
 * Find shortest paths between two nodes (simplified BFS)
 */
function findShortestPaths(source, target) {
  const queue = [[source]];
  const visited = new Set([source]);
  const paths = [];
  let shortestLength = Infinity;
  
  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentNode = currentPath[currentPath.length - 1];
    
    if (currentPath.length > shortestLength) {
      break; // All remaining paths will be longer
    }
    
    if (currentNode === target) {
      if (currentPath.length < shortestLength) {
        shortestLength = currentPath.length;
        paths.length = 0; // Clear previous longer paths
      }
      if (currentPath.length === shortestLength) {
        paths.push([...currentPath]);
      }
      continue;
    }
    
    const neighbors = getNodeNeighbors(currentNode);
    
    for (const neighbor of neighbors) {
      if (!currentPath.includes(neighbor)) {
        const newPath = [...currentPath, neighbor];
        queue.push(newPath);
      }
    }
  }
  
  return paths;
}

/**
 * Handle shortest path finding
 */
function handleFindShortestPath(data, id) {
  const { source, target } = data;
  const paths = findShortestPaths(source, target);
  
  postMessage({
    type: 'shortestPathFound',
    id,
    source,
    target,
    paths,
    distance: paths.length > 0 ? paths[0].length - 1 : -1
  });
}

/**
 * Detect communities using a simplified algorithm
 */
function handleDetectCommunities(config, id) {
  // Simplified Louvain-style community detection
  const communities = new Map();
  const nodes = Array.from(workerState.nodes.keys());
  
  // Initialize each node in its own community
  for (let i = 0; i < nodes.length; i++) {
    communities.set(nodes[i], i);
  }
  
  let improved = true;
  let iteration = 0;
  const maxIterations = config.maxIterations || 100;
  
  while (improved && iteration < maxIterations) {
    improved = false;
    
    for (const nodeId of nodes) {
      const currentCommunity = communities.get(nodeId);
      const neighbors = getNodeNeighbors(nodeId);
      
      // Find the best community to move to
      const communityWeights = new Map();
      
      for (const neighbor of neighbors) {
        const neighborCommunity = communities.get(neighbor);
        communityWeights.set(neighborCommunity, (communityWeights.get(neighborCommunity) || 0) + 1);
      }
      
      // Find community with highest weight
      let bestCommunity = currentCommunity;
      let bestWeight = communityWeights.get(currentCommunity) || 0;
      
      for (const [community, weight] of communityWeights) {
        if (weight > bestWeight) {
          bestCommunity = community;
          bestWeight = weight;
        }
      }
      
      // Move to best community if different
      if (bestCommunity !== currentCommunity) {
        communities.set(nodeId, bestCommunity);
        improved = true;
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
  
  postMessage({
    type: 'communitiesDetected',
    id,
    communities: Array.from(communityGroups.entries()).map(([id, nodes]) => ({
      id,
      nodes,
      size: nodes.length
    })),
    iterations: iteration
  });
}

/**
 * Handle node updates
 */
function handleUpdateNodes(data, id) {
  const { updates } = data;
  
  for (const update of updates) {
    const node = workerState.nodes.get(update.id);
    if (node) {
      Object.assign(node, update.attributes);
    }
  }
  
  postMessage({
    type: 'nodesUpdated',
    id,
    updated: updates.length
  });
}

/**
 * Handle optimization requests
 */
function handleOptimizeLayout(config, id) {
  // Optimize layout parameters based on graph characteristics
  const nodeCount = workerState.nodes.size;
  const edgeCount = workerState.edges.size;
  const density = edgeCount / (nodeCount * (nodeCount - 1) / 2);
  
  const optimizedConfig = { ...workerState.layoutConfig };
  
  // Adjust parameters based on graph size and density
  if (nodeCount > 5000) {
    optimizedConfig.barnesHutOptimize = true;
    optimizedConfig.barnesHutTheta = 0.8; // More aggressive approximation
    optimizedConfig.scalingRatio = Math.max(50, optimizedConfig.scalingRatio);
  }
  
  if (density > 0.1) {
    // Dense graph - reduce repulsion
    optimizedConfig.scalingRatio *= 0.7;
    optimizedConfig.gravity *= 1.5;
  } else if (density < 0.01) {
    // Sparse graph - increase attraction
    optimizedConfig.scalingRatio *= 1.3;
    optimizedConfig.gravity *= 0.8;
  }
  
  // Apply optimized configuration
  workerState.layoutConfig = optimizedConfig;
  
  postMessage({
    type: 'layoutOptimized',
    id,
    config: optimizedConfig,
    analysis: {
      nodeCount,
      edgeCount,
      density,
      recommendations: generateOptimizationRecommendations(nodeCount, edgeCount, density)
    }
  });
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(nodeCount, edgeCount, density) {
  const recommendations = [];
  
  if (nodeCount > 10000) {
    recommendations.push('Enable Barnes-Hut optimization for large graphs');
    recommendations.push('Consider increasing barnesHutTheta for better performance');
  }
  
  if (density > 0.2) {
    recommendations.push('Dense graph detected - reduce scalingRatio to prevent overlap');
  }
  
  if (density < 0.005) {
    recommendations.push('Sparse graph detected - increase gravity to prevent dispersion');
  }
  
  if (edgeCount / nodeCount > 10) {
    recommendations.push('High connectivity - consider using linLogMode');
  }
  
  return recommendations;
}

/**
 * Get performance metrics
 */
function handleGetPerformanceMetrics(data, id) {
  const now = performance.now();
  
  // Calculate iterations per second
  if (workerState.performance.totalTime > 0) {
    workerState.performance.iterationsPerSecond = 
      (workerState.performance.totalIterations * 1000) / workerState.performance.totalTime;
  }
  
  postMessage({
    type: 'performanceMetrics',
    id,
    metrics: {
      ...workerState.performance,
      currentIteration: workerState.currentIteration,
      isRunning: workerState.isRunning,
      nodeCount: workerState.nodes.size,
      edgeCount: workerState.edges.size,
      cacheSize: workerState.cache.distances.size + workerState.cache.centrality.size + workerState.cache.clustering.size
    }
  });
}

// Initialize the worker
initializeWorker();