/**
 * Graph Navigation Tools for MCP
 * Tools for working with Lokus knowledge graph
 */

import { readFile, readdir } from "fs/promises";
import { join, extname, basename } from "path";

export const graphTools = [
  {
    name: "get_graph_overview",
    description: "Get overview of the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "get_node_connections",
    description: "Get all connections for a specific node (note)",
    inputSchema: {
      type: "object",
      properties: {
        nodeName: {
          type: "string",
          description: "Name of the node/note"
        }
      },
      required: ["nodeName"]
    }
  },
  {
    name: "find_path",
    description: "Find path between two nodes in the graph",
    inputSchema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Starting node"
        },
        to: {
          type: "string",
          description: "Target node"
        }
      },
      required: ["from", "to"]
    }
  },
  {
    name: "get_orphan_notes",
    description: "Find notes with no connections (orphans)",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "get_hub_notes",
    description: "Find most connected notes (hubs)",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of top hubs to return"
        }
      },
    }
  },
  {
    name: "get_clusters",
    description: "Identify clusters of related notes",
    inputSchema: {
      type: "object",
      properties: {},
    }
  }
];

export async function executeGraphTool(tool, args, workspace, apiUrl) {
  switch (tool) {
    case "get_graph_overview":
      return await getGraphOverview(workspace);

    case "get_node_connections":
      return await getNodeConnections(workspace, args.nodeName);

    case "find_path":
      return await findPath(workspace, args.from, args.to);

    case "get_orphan_notes":
      return await getOrphanNotes(workspace);

    case "get_hub_notes":
      return await getHubNotes(workspace, args.limit || 10);

    case "get_clusters":
      return await getClusters(workspace);

    default:
      throw new Error(`Unknown graph tool: ${tool}`);
  }
}

// Build the graph from wiki links
async function buildGraph(workspace) {
  const graph = {
    nodes: new Set(),
    edges: [],
    adjacencyList: {}
  };

  // Find all notes
  async function findNotes(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await findNotes(fullPath);
      } else if (entry.isFile() && ['.md', '.txt'].includes(extname(entry.name))) {
        const noteName = basename(entry.name, extname(entry.name));
        graph.nodes.add(noteName);

        try {
          const content = await readFile(fullPath, 'utf-8');

          // Extract wiki links
          const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
          const linkedNotes = wikiLinks.map(link => link.slice(2, -2));

          graph.adjacencyList[noteName] = linkedNotes;

          for (const linkedNote of linkedNotes) {
            graph.edges.push({ from: noteName, to: linkedNote });
          }
        } catch (e) {
          // Skip files we can't read
        }
      }
    }
  }

  await findNotes(workspace);
  return graph;
}

async function getGraphOverview(workspace) {
  const graph = await buildGraph(workspace);

  const stats = {
    totalNodes: graph.nodes.size,
    totalEdges: graph.edges.length,
    avgConnections: graph.edges.length / Math.max(graph.nodes.size, 1),
    orphanCount: 0,
    hubCount: 0
  };

  // Count orphans and hubs
  for (const node of graph.nodes) {
    const connections = (graph.adjacencyList[node] || []).length;
    const backlinks = graph.edges.filter(e => e.to === node).length;
    const total = connections + backlinks;

    if (total === 0) stats.orphanCount++;
    if (total > 5) stats.hubCount++;
  }

  return {
    content: [{
      type: "text",
      text: `**Knowledge Graph Overview**\n
🔵 Total Notes: ${stats.totalNodes}
🔗 Total Connections: ${stats.totalEdges}
📊 Avg Connections: ${stats.avgConnections.toFixed(2)}
🏝️ Orphan Notes: ${stats.orphanCount}
🌟 Hub Notes (>5 connections): ${stats.hubCount}

The knowledge graph shows how your notes are interconnected through wiki links.`
    }]
  };
}

async function getNodeConnections(workspace, nodeName) {
  const graph = await buildGraph(workspace);

  const outgoing = graph.adjacencyList[nodeName] || [];
  const incoming = graph.edges
    .filter(e => e.to === nodeName)
    .map(e => e.from);

  const related = new Set([...outgoing, ...incoming]);

  return {
    content: [{
      type: "text",
      text: `**Connections for "${nodeName}"**\n
**Outgoing Links (${outgoing.length}):**
${outgoing.map(n => `  → ${n}`).join('\n') || '  None'}

**Incoming Links (${incoming.length}):**
${incoming.map(n => `  ← ${n}`).join('\n') || '  None'}

**All Related Notes (${related.size}):**
${Array.from(related).map(n => `  • ${n}`).join('\n') || '  None'}`
    }]
  };
}

async function findPath(workspace, from, to) {
  const graph = await buildGraph(workspace);

  // BFS to find shortest path
  const queue = [[from]];
  const visited = new Set([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === to) {
      return {
        content: [{
          type: "text",
          text: `**Path from "${from}" to "${to}":**\n\n${
            path.map((node, i) => {
              if (i === 0) return `🟢 ${node}`;
              if (i === path.length - 1) return `🔴 ${node}`;
              return `⚪ ${node}`;
            }).join(' → ')
          }\n\nPath length: ${path.length - 1} steps`
        }]
      };
    }

    const neighbors = graph.adjacencyList[current] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return {
    content: [{
      type: "text",
      text: `No path found from "${from}" to "${to}". These notes are not connected in the knowledge graph.`
    }]
  };
}

async function getOrphanNotes(workspace) {
  const graph = await buildGraph(workspace);
  const orphans = [];

  for (const node of graph.nodes) {
    const outgoing = (graph.adjacencyList[node] || []).length;
    const incoming = graph.edges.filter(e => e.to === node).length;

    if (outgoing === 0 && incoming === 0) {
      orphans.push(node);
    }
  }

  return {
    content: [{
      type: "text",
      text: `**Orphan Notes (${orphans.length}):**\n
These notes have no connections to other notes:\n
${orphans.map(n => `  • ${n}`).join('\n') || 'No orphan notes found!'}

Consider linking these notes to integrate them into your knowledge graph.`
    }]
  };
}

async function getHubNotes(workspace, limit) {
  const graph = await buildGraph(workspace);
  const connections = {};

  // Count total connections for each node
  for (const node of graph.nodes) {
    const outgoing = (graph.adjacencyList[node] || []).length;
    const incoming = graph.edges.filter(e => e.to === node).length;
    connections[node] = outgoing + incoming;
  }

  // Sort by connection count
  const sorted = Object.entries(connections)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return {
    content: [{
      type: "text",
      text: `**Top ${limit} Hub Notes:**\n
These notes are most connected in your knowledge graph:\n
${sorted.map(([node, count], i) =>
  `${i + 1}. **${node}** - ${count} connections`
).join('\n')}

Hub notes are central to your knowledge structure and often represent key concepts.`
    }]
  };
}

async function getClusters(workspace) {
  const graph = await buildGraph(workspace);

  // Simple clustering based on connected components
  const visited = new Set();
  const clusters = [];

  function dfs(node, cluster) {
    if (visited.has(node)) return;
    visited.add(node);
    cluster.add(node);

    const neighbors = graph.adjacencyList[node] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, cluster);
    }

    // Also check incoming connections
    const incoming = graph.edges
      .filter(e => e.to === node)
      .map(e => e.from);
    for (const source of incoming) {
      dfs(source, cluster);
    }
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      const cluster = new Set();
      dfs(node, cluster);
      if (cluster.size > 1) {
        clusters.push(Array.from(cluster));
      }
    }
  }

  // Sort clusters by size
  clusters.sort((a, b) => b.length - a.length);

  return {
    content: [{
      type: "text",
      text: `**Knowledge Clusters (${clusters.length}):**\n
${clusters.slice(0, 5).map((cluster, i) =>
  `**Cluster ${i + 1}** (${cluster.length} notes):\n${
    cluster.slice(0, 10).map(n => `  • ${n}`).join('\n')
  }${cluster.length > 10 ? `\n  ... and ${cluster.length - 10} more` : ''}`
).join('\n\n')}${clusters.length > 5 ? `\n\n... and ${clusters.length - 5} more clusters` : ''}

Clusters represent groups of related notes that are interconnected.`
    }]
  };
}