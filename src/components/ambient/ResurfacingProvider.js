/**
 * ResurfacingProvider — the data engine behind the ambient "Connected notes" panel.
 *
 * This is the product differentiator (PRD §5): "hands the note back before you ask."
 * It surfaces related notes as the user writes, in two layers:
 *
 *   Layer A — Graph (THIS FILE, ships first): 1-hop wiki-link neighbors via the public
 *             `GraphIndex` API. Zero LLM, zero network, zero credits, works offline. ~50ms.
 *   Layer B — Local semantic (later): merges Ollama-embedding meaning-matches once the
 *             `providers` stream ships `embed()`. Wired through the pluggable-scorer seam
 *             below so adding it is purely additive — no change to Layer A.
 *
 * The graph source (`src/mcp-server/utils/graphIndex.js`) is IMPORTED, never modified.
 * `getRelatedNotes` already sorts by depth then connection-count and slices to `limit`;
 * we re-rank only when more than one scorer contributes (Layer B), so Layer A behaviour
 * is byte-identical to the raw graph result.
 *
 * `GraphIndex.load()` touches the filesystem via Node `fs`. In the Tauri renderer that may
 * reject; like ContextAssembler's L5, every external call here is wrapped so a missing
 * backend degrades to "no results" instead of throwing.
 *
 * See LOKUS_AI_PRD.md §5.1 / §2.4 / §5.3.
 */

import { getGraphIndex } from '../../mcp-server/utils/graphIndex.js';

/** Default number of cards the ambient panel shows. PRD: 3–5. */
export const DEFAULT_LIMIT = 5;

/**
 * @typedef {Object} RelatedNote
 * @property {string} id            normalized graph id
 * @property {string} name          display name
 * @property {string} path          workspace-relative path
 * @property {number} [depth]       hop distance (Layer A: 1)
 * @property {'incoming'|'outgoing'} [direction]  link direction (Layer A only)
 * @property {number} [connections] total degree of the neighbor (Layer A relevance)
 * @property {number} [score]       merged relevance score (set by the scorer merge)
 * @property {string} source        which layer produced it: 'graph' | 'semantic'
 */

/**
 * A scorer is a pluggable async source of related notes. Layer A registers the graph
 * scorer; Layer B will register a semantic one. Each returns a list of candidates with a
 * normalized `score` in [0,1] so results merge across layers by a single comparable rank.
 *
 * @typedef {Object} Scorer
 * @property {string} name
 * @property {(noteName: string, ctx: Object) => Promise<RelatedNote[]>} score
 */

/**
 * Build the always-on Layer A graph scorer.
 * @param {string} workspacePath
 * @returns {Scorer}
 */
function makeGraphScorer(workspacePath) {
  return {
    name: 'graph',
    async score(noteName, { limit = DEFAULT_LIMIT } = {}) {
      if (!noteName || !workspacePath) return [];
      const gi = getGraphIndex(workspacePath);
      await gi.load();
      // Pull a few extra so the merge has room to re-rank when Layer B joins.
      const { found, related } = gi.getRelatedNotes(noteName, {
        depth: 1,
        direction: 'both',
        limit: Math.max(limit * 2, limit),
      });
      if (!found || !related?.length) return [];
      // Connection count is the graph's relevance signal; normalize it to [0,1] within
      // this result set so it stays comparable to a future semantic similarity score.
      const maxConn = related.reduce((m, n) => Math.max(m, n.connections || 0), 0) || 1;
      return related.map((n) => ({
        ...n,
        source: 'graph',
        score: (n.connections || 0) / maxConn,
      }));
    },
  };
}

export class ResurfacingProvider {
  /**
   * @param {string} workspacePath  absolute workspace path (window.__WORKSPACE_PATH__)
   * @param {Object} [opts]
   * @param {Scorer[]} [opts.scorers]  extra scorers (Layer B, etc.). Graph is always added.
   */
  constructor(workspacePath, { scorers = [] } = {}) {
    this.workspacePath = workspacePath;
    this.currentNoteId = null;
    this.ambient = [];
    // Graph (Layer A) is always present; callers append semantic scorers later.
    this.scorers = [makeGraphScorer(workspacePath), ...scorers];
  }

  /**
   * Register an additional scorer (e.g. Layer B semantic). Additive; idempotent by name.
   * @param {Scorer} scorer
   */
  addScorer(scorer) {
    if (!scorer?.name || typeof scorer.score !== 'function') return;
    if (this.scorers.some((s) => s.name === scorer.name)) return;
    this.scorers.push(scorer);
  }

  /**
   * LAYER A — graph 1-hop neighbors (incoming + outgoing). Always available, offline, $0.
   * Mirrors the PRD §5.1 reference signature; never throws (degrades to []).
   * @param {string} noteName  the open note's display name (no extension)
   * @param {number} [limit]
   * @returns {Promise<RelatedNote[]>}
   */
  async surfaceGraphNeighbors(noteName, limit = DEFAULT_LIMIT) {
    try {
      const results = await makeGraphScorer(this.workspacePath).score(noteName, { limit });
      this.currentNoteId = noteName;
      this.ambient = results.slice(0, limit);
      return this.ambient;
    } catch {
      // Graph index unavailable (no fs in renderer / no notes) — degrade to empty.
      this.ambient = [];
      return this.ambient;
    }
  }

  /**
   * Run every registered scorer, merge by note id (highest score wins, layers union via
   * `sources`), re-rank by score, and return the top `limit`. With only Layer A registered
   * this is equivalent to `surfaceGraphNeighbors` — the merge is a no-op pass-through.
   *
   * @param {string} noteName
   * @param {Object} [opts]
   * @param {number} [opts.limit]
   * @returns {Promise<RelatedNote[]>}
   */
  async resurface(noteName, { limit = DEFAULT_LIMIT } = {}) {
    this.currentNoteId = noteName;
    if (!noteName) {
      this.ambient = [];
      return this.ambient;
    }

    // Run scorers concurrently; a failing scorer contributes nothing rather than aborting.
    const settled = await Promise.allSettled(
      this.scorers.map((s) => s.score(noteName, { limit })),
    );
    const candidates = settled.flatMap((r) =>
      r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [],
    );

    this.ambient = ResurfacingProvider.merge(candidates, noteName, limit);
    return this.ambient;
  }

  /**
   * Merge candidates from multiple scorers into a single ranked list.
   *  - Dedupe by note id (fall back to name); keep the highest score.
   *  - Union the contributing layers into `sources`.
   *  - Never surface the note the user is currently in.
   *  - Sort by score desc (stable on insertion order), slice to `limit`.
   *
   * @param {RelatedNote[]} candidates
   * @param {string} noteName  current note (excluded from results)
   * @param {number} limit
   * @returns {RelatedNote[]}
   */
  static merge(candidates, noteName, limit = DEFAULT_LIMIT) {
    const selfKey = String(noteName ?? '').trim().toLowerCase();
    const byId = new Map();
    let order = 0;

    for (const c of candidates) {
      if (!c) continue;
      const key = (c.id || c.name || '').toString().trim().toLowerCase();
      if (!key || key === selfKey) continue;

      const existing = byId.get(key);
      if (!existing) {
        // Seed `sources` from any already-accumulated tags (re-merge of prior results)
        // plus this candidate's own source, deduped.
        const sources = [...new Set([...(c.sources || []), c.source].filter(Boolean))];
        byId.set(key, { ...c, sources, _order: order++ });
        continue;
      }
      // Same note from another layer: keep the better score, union the layer tags.
      if ((c.score ?? 0) > (existing.score ?? 0)) {
        existing.score = c.score;
        // Preserve the richer graph metadata (direction/connections) if present.
        if (c.direction) existing.direction = c.direction;
        if (c.connections != null) existing.connections = c.connections;
      }
      for (const s of [...(c.sources || []), c.source].filter(Boolean)) {
        if (!existing.sources.includes(s)) existing.sources.push(s);
      }
    }

    return [...byId.values()]
      .sort((a, b) => {
        const ds = (b.score ?? 0) - (a.score ?? 0);
        if (ds !== 0) return ds;
        return a._order - b._order; // stable
      })
      .slice(0, limit)
      .map(({ _order, ...rest }) => rest);
  }
}

export default ResurfacingProvider;
