/**
 * Smart Search MCP Tools
 *
 * Graph-powered search and topic exploration.
 * Uses the knowledge graph to find related content instead of brute-force file scanning.
 *
 * Tools:
 * - smart_search: Full-text search enhanced with graph traversal
 * - explore_topic: Navigate the knowledge graph from a starting point
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, relative, extname, basename } from 'path';
import { getGraphIndex } from '../utils/graphIndex.js';

/**
 * Simple full-text search in a file
 */
async function searchInFile(filePath, query, workspacePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (!lowerContent.includes(lowerQuery)) {
      return null;
    }

    // Find matching lines
    const lines = content.split('\n');
    const matches = [];

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push({
          lineNumber: index + 1,
          text: line.trim().substring(0, 200) // Limit line length
        });
      }
    });

    // Calculate relevance score
    const occurrences = (lowerContent.match(new RegExp(lowerQuery, 'gi')) || []).length;
    const titleMatch = basename(filePath, '.md').toLowerCase().includes(lowerQuery);

    return {
      path: relative(workspacePath, filePath),
      name: basename(filePath, '.md'),
      matches,
      occurrences,
      titleMatch,
      score: occurrences + (titleMatch ? 10 : 0) + (matches.length > 0 ? 5 : 0)
    };
  } catch (error) {
    return null;
  }
}

/**
 * Recursively scan directory for markdown files
 */
async function scanDirectory(dirPath, files = []) {
  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;

      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        await scanDirectory(fullPath, files);
      } else if (extname(entry) === '.md') {
        files.push(fullPath);
      }
    }

    return files;
  } catch (error) {
    return files;
  }
}

/**
 * Smart search with graph enhancement
 */
async function smartSearch(workspace, query, options = {}) {
  const {
    depth = 1,          // How many link hops to follow for related notes
    limit = 20,         // Max results
    folder = null,      // Filter by folder
    includeRelated = true  // Include graph-related notes
  } = options;

  // Get graph index
  const graphIndex = getGraphIndex(workspace);
  await graphIndex.load();

  // Full-text search
  let files = await scanDirectory(workspace);

  // Filter by folder if specified
  if (folder) {
    const folderPath = join(workspace, folder);
    files = files.filter(f => f.startsWith(folderPath));
  }

  // Search in files
  const searchPromises = files.map(f => searchInFile(f, query, workspace));
  const searchResults = (await Promise.all(searchPromises))
    .filter(r => r !== null);

  // Sort by score
  searchResults.sort((a, b) => b.score - a.score);

  // Enhance with graph data
  const enhancedResults = [];

  for (const result of searchResults.slice(0, limit)) {
    const enhanced = { ...result };

    // Get related notes via graph
    if (includeRelated) {
      const related = graphIndex.getRelatedNotes(result.name, { depth, limit: 5 });
      if (related.found) {
        enhanced.relatedNotes = related.related.map(r => ({
          name: r.name,
          path: r.path,
          depth: r.depth,
          direction: r.direction
        }));
        enhanced.connectionCount = related.source.outgoingLinks.length + related.source.incomingLinks.length;
      }
    }

    enhancedResults.push(enhanced);
  }

  return {
    query,
    totalMatches: searchResults.length,
    results: enhancedResults,
    graphEnabled: includeRelated
  };
}

/**
 * Explore a topic through the knowledge graph
 */
async function exploreTopic(workspace, topic, options = {}) {
  const {
    depth = 2,
    direction = 'both',  // 'outgoing', 'incoming', or 'both'
    includeContent = false,
    limit = 30
  } = options;

  // Get graph index
  const graphIndex = getGraphIndex(workspace);
  await graphIndex.load();

  // Find the topic note
  const searchResults = graphIndex.searchByName(topic, 5);

  if (searchResults.length === 0) {
    return {
      found: false,
      topic,
      message: `No note found matching "${topic}". Try a different search term.`,
      suggestions: graphIndex.getHubs(5).map(h => h.name)
    };
  }

  const topicNote = searchResults[0];

  // Get related notes
  const related = graphIndex.getRelatedNotes(topicNote.name, {
    depth,
    direction,
    limit
  });

  // Group by depth
  const directLinks = related.related.filter(r => r.depth === 1);
  const secondDegree = related.related.filter(r => r.depth === 2);
  const thirdDegree = related.related.filter(r => r.depth >= 3);

  // Optionally include content snippets
  let topicContent = null;
  if (includeContent) {
    try {
      const fullPath = join(workspace, topicNote.path);
      const content = await readFile(fullPath, 'utf-8');
      // Get first 500 chars as snippet
      topicContent = content.substring(0, 500).trim();
      if (content.length > 500) topicContent += '...';
    } catch (error) {
      // Couldn't read content
    }
  }

  // Find paths to other hub notes
  const hubs = graphIndex.getHubs(3).filter(h => h.id !== topicNote.id);
  const pathsToHubs = [];

  for (const hub of hubs.slice(0, 2)) {
    const path = graphIndex.findPath(topicNote.name, hub.name);
    if (path.found && path.distance <= 3) {
      pathsToHubs.push({
        to: hub.name,
        distance: path.distance,
        path: path.path.map(n => n.name)
      });
    }
  }

  return {
    found: true,
    topic: {
      name: topicNote.name,
      path: topicNote.path,
      connections: topicNote.connections,
      content: topicContent
    },
    exploration: {
      direction,
      depth,
      totalRelated: related.related.length
    },
    directlyLinked: directLinks,
    secondDegree: secondDegree.slice(0, 10),
    thirdDegree: thirdDegree.slice(0, 5),
    pathsToHubs,
    graphStats: graphIndex.getOverview().stats
  };
}

// Tool definitions
export const searchTools = [
  {
    name: 'smart_search',
    description: 'Search notes using content AND knowledge graph. Returns matching notes plus their connected notes via wiki links. Much smarter than just text search.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (searches note content and titles)'
        },
        depth: {
          type: 'number',
          description: 'How many wiki link hops to follow for related notes (1-3, default: 1)'
        },
        folder: {
          type: 'string',
          description: 'Filter to specific folder (e.g., "Projects" or "Daily Notes")'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)'
        },
        includeRelated: {
          type: 'boolean',
          description: 'Include graph-related notes in results (default: true)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'explore_topic',
    description: 'Explore a topic through the knowledge graph. Finds a note and all its connections via wiki links. Great for understanding how ideas connect.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic or note name to explore'
        },
        depth: {
          type: 'number',
          description: 'How deep to traverse links (1-3, default: 2)'
        },
        direction: {
          type: 'string',
          enum: ['outgoing', 'incoming', 'both'],
          description: 'Link direction: outgoing (notes this links to), incoming (notes linking here), both'
        },
        includeContent: {
          type: 'boolean',
          description: 'Include content snippet of the topic note (default: false)'
        },
        limit: {
          type: 'number',
          description: 'Max related notes to return (default: 30)'
        }
      },
      required: ['topic']
    }
  }
];

/**
 * Execute search tools
 */
export async function executeSearchTool(toolName, args, workspace) {
  let result;

  switch (toolName) {
    case 'smart_search': {
      const { query, depth = 1, folder, limit = 20, includeRelated = true } = args;

      if (!query) {
        throw new Error('Query is required for smart_search');
      }

      const searchResult = await smartSearch(workspace, query, {
        depth: Math.min(depth, 3),
        folder,
        limit,
        includeRelated
      });

      result = {
        success: true,
        ...searchResult,
        message: searchResult.totalMatches > 0
          ? `Found ${searchResult.totalMatches} notes matching "${query}"${searchResult.graphEnabled ? ' (with graph connections)' : ''}`
          : `No notes found matching "${query}"`
      };
      break;
    }

    case 'explore_topic': {
      const { topic, depth = 2, direction = 'both', includeContent = false, limit = 30 } = args;

      if (!topic) {
        throw new Error('Topic is required for explore_topic');
      }

      const exploration = await exploreTopic(workspace, topic, {
        depth: Math.min(depth, 3),
        direction,
        includeContent,
        limit
      });

      if (!exploration.found) {
        result = {
          success: false,
          ...exploration
        };
      } else {
        result = {
          success: true,
          ...exploration,
          message: `Explored "${exploration.topic.name}" with ${exploration.exploration.totalRelated} connected notes`
        };
      }
      break;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

export default { searchTools, executeSearchTool };
