/**
 * Graph Index for Lokus MCP Server — Node entry
 *
 * Builds and maintains a persistent index of wiki links between notes.
 * Provides graph traversal, path finding, and cluster detection.
 *
 * This module is the NODE-backed entry point: it pairs the pure engine in
 * graphIndex.core.js with a `fs/promises` IO adapter. The MCP server (bundled
 * for Node via esbuild) resolves this file directly.
 *
 * The browser/Tauri renderer must NOT bundle this file — its `fs/promises` and
 * `path` imports have no browser equivalent and break the Vite build. vite.config.js
 * aliases `graphIndex.js` to graphIndex.tauri.js, which pairs the same core with a
 * Tauri (`invoke`) adapter. (Build-fix mechanism adapted from PR #536, pointed at a
 * real Tauri-backed adapter instead of a dead stub.)
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative, extname, basename } from 'path';
import { GraphIndexCore } from './graphIndex.core.js';

/**
 * Node IO adapter — filesystem access via fs/promises.
 */
class NodeGraphAdapter {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.indexPath = join(workspacePath, '.lokus', 'mcp-graph-index.json');
  }

  /**
   * Recursively enumerate every markdown file under the workspace.
   * @returns {Promise<Array<{ path, relativePath, name }>>}
   */
  async listMarkdownFiles() {
    const files = [];
    const walk = async (dirPath) => {
      let entries;
      try {
        entries = await readdir(dirPath);
      } catch (error) {
        return;
      }

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = join(dirPath, entry);
        let stats;
        try {
          stats = await stat(fullPath);
        } catch (error) {
          continue;
        }

        if (stats.isDirectory()) {
          await walk(fullPath);
        } else if (extname(entry) === '.md') {
          files.push({
            path: fullPath,
            relativePath: relative(this.workspacePath, fullPath),
            name: basename(fullPath, '.md')
          });
        }
      }
    };

    await walk(this.workspacePath);
    return files;
  }

  async readFile(filePath) {
    return readFile(filePath, 'utf-8');
  }

  async loadCache() {
    try {
      const content = await readFile(this.indexPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async saveCache(data) {
    await writeFile(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

/**
 * GraphIndex — Node-backed knowledge graph for a workspace.
 */
export class GraphIndex extends GraphIndexCore {
  constructor(workspacePath) {
    super(workspacePath, new NodeGraphAdapter(workspacePath));
  }
}

// Singleton instance cache
const instances = new Map();

/**
 * Get or create a GraphIndex for a workspace
 */
export function getGraphIndex(workspacePath) {
  if (!instances.has(workspacePath)) {
    instances.set(workspacePath, new GraphIndex(workspacePath));
  }
  return instances.get(workspacePath);
}

export default { GraphIndex, getGraphIndex };
