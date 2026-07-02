/**
 * Browser stub for graphIndex.js
 *
 * The real graphIndex.js imports Node builtins (fs/promises, path) and walks the
 * workspace on disk. Those builtins do not exist in the WebKit renderer, so the
 * production browser bundle uses this stub instead (wired via resolve.alias in
 * vite.config.js). The Node/MCP-server build still bundles the real module.
 *
 * The renderer only calls: getGraphIndex(ws) -> { load(), getRelatedNotes() }.
 * Graph-backed suggestions degrade to empty; the rest of the app is unaffected.
 */

class GraphIndex {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.graph = null;
  }

  async load() {
    return this.graph;
  }

  getRelatedNotes() {
    return { found: false, related: [] };
  }

  getBacklinks() {
    return [];
  }
}

const instances = new Map();

export function getGraphIndex(workspacePath) {
  if (!instances.has(workspacePath)) {
    instances.set(workspacePath, new GraphIndex(workspacePath));
  }
  return instances.get(workspacePath);
}

export { GraphIndex };
export default { GraphIndex, getGraphIndex };
