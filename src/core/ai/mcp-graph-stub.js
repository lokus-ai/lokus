/**
 * Browser-safe stub for mcp-server/utils/graphIndex.js.
 * The real module uses Node fs/promises; this stub degrades gracefully
 * when the code runs in the Tauri renderer (browser context).
 */

class StubGraphIndex {
  constructor() {
    this.graph = { nodes: new Map(), edges: [] };
  }
  async load() { return this.graph; }
  async build() { return this.graph; }
  getRelatedNotes() { return { found: false, related: [] }; }
  getHubs() { return []; }
  findPath() { return null; }
  getOverview() { return { stats: { nodeCount: 0, edgeCount: 0 } }; }
  searchByName() { return []; }
}

const stub = new StubGraphIndex();

export function getGraphIndex() {
  return stub;
}

export class GraphIndex extends StubGraphIndex {}
