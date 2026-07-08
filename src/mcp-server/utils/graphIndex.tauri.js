/**
 * Graph Index — Tauri/browser entry
 *
 * Pairs the pure engine in graphIndex.core.js with a Tauri IO adapter so the
 * knowledge graph works inside the WebKit renderer, where Node's `fs/promises`
 * does not exist. vite.config.js aliases every `graphIndex.js` import to this
 * file for the client bundle; the Node/MCP-server build keeps using graphIndex.js.
 *
 * Why `invoke` and not @tauri-apps/plugin-fs: plugin-fs is scope-gated (see
 * src-tauri/capabilities/*.json — only $HOME/.lokus, $DOCUMENT, $DESKTOP,
 * $DOWNLOAD are allowed), but a workspace can live anywhere on disk. The app's
 * own Rust commands (`read_workspace_files`, `read_file_content`,
 * `write_file_content`) are unscoped and are what the rest of the renderer
 * already uses for arbitrary workspace paths, so we go through them too.
 */

import { invoke } from '@tauri-apps/api/core';
import { GraphIndexCore } from './graphIndex.core.js';

const SEP = /[\\/]/;

// Pure path helpers (renderer has no `path` module). Handle both separators so
// this works regardless of the OS the backend reports paths in.
function baseName(p) {
  const last = p.split(SEP).pop() || p;
  return last.replace(/\.md$/i, '');
}

function toRelative(root, p) {
  const rel = p.startsWith(root) ? p.slice(root.length) : p;
  return rel.replace(/^[\\/]+/, '');
}

/**
 * Tauri IO adapter — filesystem access via the app's Rust commands.
 */
class TauriGraphAdapter {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.indexPath = `${workspacePath}/.lokus/mcp-graph-index.json`;
  }

  /**
   * Enumerate every markdown file under the workspace via `read_workspace_files`,
   * which returns a recursive tree (already excluding .lokus/node_modules/.git).
   * @returns {Promise<Array<{ path, relativePath, name }>>}
   */
  async listMarkdownFiles() {
    let tree;
    try {
      tree = await invoke('read_workspace_files', { workspacePath: this.workspacePath });
    } catch (error) {
      return [];
    }

    const files = [];
    const walk = (nodes) => {
      for (const node of nodes || []) {
        if (node.is_directory) {
          walk(node.children);
        } else if (typeof node.path === 'string' && /\.md$/i.test(node.path)) {
          files.push({
            path: node.path,
            relativePath: toRelative(this.workspacePath, node.path),
            name: baseName(node.path)
          });
        }
      }
    };
    walk(tree);
    return files;
  }

  async readFile(filePath) {
    return invoke('read_file_content', { path: filePath });
  }

  async loadCache() {
    try {
      const content = await invoke('read_file_content', { path: this.indexPath });
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async saveCache(data) {
    try {
      await invoke('write_file_content', {
        path: this.indexPath,
        content: JSON.stringify(data, null, 2)
      });
    } catch (error) {
      // Best-effort: cache write may fail if `.lokus` doesn't exist yet; the graph
      // is still held in memory for this window, so we just skip persistence.
    }
  }
}

/**
 * GraphIndex — Tauri-backed knowledge graph for a workspace.
 */
export class GraphIndex extends GraphIndexCore {
  constructor(workspacePath) {
    super(workspacePath, new TauriGraphAdapter(workspacePath));
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
