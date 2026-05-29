/**
 * ContextAssembler - builds a budget-capped LLM context string from Lokus state.
 *
 * Layers (PRD §4.2), each with a soft cap of the total budget:
 *   L1  System instruction (caller)                 always
 *   L2  Open note (PM doc -> markdown)              30%   } stable prefix
 *   L3  Selection (PM doc.textBetween)             15%   } -- cache boundary --
 *   L4  Vault FTS (search_in_files)                25%   }
 *   L5  1-hop wiki-link neighbors (GraphRAG)       15%   } dynamic suffix
 *   L6  Agent observations (agentState)            remainder
 *
 * The stable prefix (L1 + L2) and the dynamic suffix (L3-L6) are joined with the
 * literal marker `\n\n---CACHE_BOUNDARY---\n\n`. The proxy splits on it and marks
 * only the prefix with Anthropic `cache_control:{type:'ephemeral'}`, cutting
 * repeat-call input cost within a Cmd-K session.
 *
 * Token estimate is `ceil(chars / 4)`; the proxy reconciles true tokens for
 * billing. All layer sources are imported, never modified, and every external
 * call is wrapped so a failing layer degrades gracefully instead of aborting.
 *
 * See LOKUS_AI_PRD.md §4.
 */

import { invoke } from '@tauri-apps/api/core';
import { getGraphIndex } from '../../mcp-server/utils/graphIndex.js';
import { editorAPI } from '../../plugins/api/EditorAPI.js';

export const CACHE_BOUNDARY = '\n\n---CACHE_BOUNDARY---\n\n';

/** Per-surface default budgets (PRD §4.6). Ambient is graph-only (no LLM). */
export const SURFACE_BUDGETS = {
  slash: 2048,
  selection: 3072,
  palette: 8192,
  agent: 16384,
  ambient: 512,
};

/** Rough token estimate: ~4 chars/token. */
const est = (text) => (text ? Math.ceil(text.length / 4) : 0);

const PARA_MARKER = '\n\n[… truncated]';
const CHAR_MARKER = '\n[… truncated]';

/**
 * Truncate text so its token estimate never exceeds `maxTokens`, preferring a
 * paragraph boundary. The truncation marker is counted against the budget (we
 * reserve room for it before slicing) so the returned block, once est()'d,
 * stays within the cap — important because the budget is decremented by
 * est(block) after each layer.
 * @param {string} text
 * @param {number} maxTokens
 * @returns {string}
 */
function truncate(text, maxTokens) {
  const maxChars = Math.max(0, maxTokens) * 4;
  if (text.length <= maxChars) return text;
  // Reserve space for the longer of the two markers so neither overflows.
  const room = Math.max(0, maxChars - PARA_MARKER.length);
  const clipped = text.slice(0, room);
  const para = clipped.lastIndexOf('\n\n');
  // Only honor a paragraph break if it keeps most of the budget.
  return para > room * 0.7
    ? clipped.slice(0, para) + PARA_MARKER
    : text.slice(0, Math.max(0, maxChars - CHAR_MARKER.length)) + CHAR_MARKER;
}

export class ContextAssembler {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.defaultMaxTokens=8192]
   * @param {number} [opts.ttl=30000] - assemble() result cache TTL (ms)
   */
  constructor({ defaultMaxTokens = 8192, ttl = 30_000 } = {}) {
    this.defaultMaxTokens = defaultMaxTokens;
    this._cache = new Map();
    this._ttl = ttl;
  }

  /** Drop the entire assemble() cache (call on editor update / save). */
  invalidate() {
    this._cache.clear();
  }

  /**
   * Drop cached contexts for a single note.
   * @param {string} noteId
   */
  invalidateNote(noteId) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(`${noteId}::`)) this._cache.delete(key);
    }
  }

  /**
   * Assemble a budgeted context for an LLM call (returns the joined string).
   *
   * @param {Object} req
   * @param {string} [req.instruction] - L1 system instruction
   * @param {string} [req.noteId] - open note id/path (drives L2 title + L5 graph)
   * @param {string} [req.selection] - explicit L3 selection (else read from editor)
   * @param {string} [req.searchQuery] - L4 FTS query
   * @param {string} [req.workspacePath] - required for L4 + L5
   * @param {Object} [req.agentState] - { observations: string[] } for L6
   * @param {number} [req.maxTokens]
   * @param {boolean} [req.useEditor] - set false to skip L2/L3 editor reads
   * @returns {Promise<string>}
   */
  async assemble(req = {}) {
    const max = req.maxTokens ?? this.defaultMaxTokens;
    const key = `${req.noteId}::${req.searchQuery}::${req.agentState?.observations?.length ?? 0}`;
    const hit = this._cache.get(key);
    if (hit && Date.now() - hit.ts < this._ttl) return hit.context;

    const parts = await this._buildParts(req, max);
    const context = parts.stable + CACHE_BOUNDARY + parts.dynamic;
    this._cache.set(key, { context, ts: Date.now() });
    return context;
  }

  /**
   * Assemble and return a structured, budgeted object (does not use the cache).
   * Acceptance contract: returns an object that respects the budget.
   *
   * @param {Object} ctx - same shape as assemble()'s req
   * @returns {Promise<{
   *   context: string, stable: string, dynamic: string,
   *   budget: number, tokensUsed: number, withinBudget: boolean,
   *   cacheBoundary: string, layers: Object
   * }>}
   */
  async build(ctx = {}) {
    const max = ctx.maxTokens ?? this.defaultMaxTokens;
    const parts = await this._buildParts(ctx, max);
    const context = parts.stable + CACHE_BOUNDARY + parts.dynamic;
    // The boundary marker itself is bookkeeping, not billable context.
    const tokensUsed = est(parts.stable) + est(parts.dynamic);
    return {
      context,
      stable: parts.stable,
      dynamic: parts.dynamic,
      budget: max,
      tokensUsed,
      withinBudget: tokensUsed <= max,
      cacheBoundary: CACHE_BOUNDARY,
      layers: parts.layers,
    };
  }

  /**
   * Core layered assembly. Allocates the budget L1 -> L6 until exhausted.
   * @private
   * @param {Object} req
   * @param {number} max
   * @returns {Promise<{ stable: string, dynamic: string, layers: Object }>}
   */
  async _buildParts(req, max) {
    let budget = max;
    const layers = {};

    // L1 - system instruction (always present, part of the stable prefix).
    const l1 = req.instruction ? `# System Instruction\n${req.instruction}\n\n` : '';
    let stable = l1;
    budget -= est(l1);
    layers.l1 = est(l1);

    // L2 - open note body (stable / cacheable). Soft cap 30%.
    if (req.useEditor !== false && editorAPI.editorInstance && budget > 0) {
      try {
        const md = await editorAPI.getContent();
        if (md?.trim()) {
          const title = req.noteId
            ? req.noteId.split('/').pop()?.replace(/\.md$/i, '')
            : 'Current Note';
          const block = truncate(
            `# Open Note: ${title}\n\n${md}\n\n`,
            Math.min(budget, max * 0.3),
          );
          stable += block;
          budget -= est(block);
          layers.l2 = est(block);
        }
      } catch {
        // Editor not ready / serialization failed - skip L2.
      }
    }

    let dynamic = '';

    // L3 - selection. Soft cap 15%. Prefer explicit selection, else editor state.
    let selection = req.selection;
    if (!selection && req.useEditor !== false && editorAPI.editorInstance) {
      try {
        const view = editorAPI.editorInstance;
        const { from, to } = view.state.selection;
        if (from !== to) selection = view.state.doc.textBetween(from, to, '\n');
      } catch {
        // No usable selection.
      }
    }
    if (selection?.trim() && budget > 0) {
      const block = truncate(
        `# Selected Text\n\n${selection}\n\n`,
        Math.min(budget, max * 0.15),
      );
      dynamic += block;
      budget -= est(block);
      layers.l3 = est(block);
    }

    // L4 - vault full-text search. Soft cap 25%.
    if (req.searchQuery && req.workspacePath && budget > 0) {
      try {
        const results = await invoke('search_in_files', {
          query: req.searchQuery,
          workspacePath: req.workspacePath,
          options: {
            caseSensitive: false,
            wholeWord: false,
            regex: false,
            fileTypes: ['md'],
            maxResults: 8,
            contextLines: 1,
          },
        });
        if (results?.length) {
          const lines = [`# Related Notes (search: "${req.searchQuery}")\n`];
          for (const file of results.slice(0, 8)) {
            lines.push(`## ${file.fileName}`);
            for (const m of (file.matches ?? []).slice(0, 2)) {
              lines.push(`  L${m.line}: ${m.text.trim()}`);
            }
          }
          const block = truncate(
            lines.join('\n') + '\n',
            Math.min(budget, max * 0.25),
          );
          dynamic += block;
          budget -= est(block);
          layers.l4 = est(block);
        }
      } catch {
        // Search unavailable (no Rust backend / no index) - skip L4.
      }
    }

    // L5 - 1-hop wiki-link neighbors (GraphRAG). Soft cap 15%.
    if (req.noteId && req.workspacePath && budget > 0) {
      try {
        const graphIndex = getGraphIndex(req.workspacePath);
        await graphIndex.load();
        const name = req.noteId.split('/').pop()?.replace(/\.md$/i, '') ?? '';
        const { found, related } = graphIndex.getRelatedNotes(name, {
          depth: 1,
          direction: 'both',
          limit: 10,
        });
        if (found && related?.length) {
          const lines = [`# Wiki-Link Neighbors (1-hop from "${name}")\n`];
          for (const n of related) {
            const arrow = n.direction === 'outgoing' ? '→' : '←';
            lines.push(`${arrow} [[${n.name}]] — ${n.connections} connections`);
          }
          const block = truncate(
            lines.join('\n') + '\n\n',
            Math.min(budget, max * 0.15),
          );
          dynamic += block;
          budget -= est(block);
          layers.l5 = est(block);
        }
      } catch {
        // Graph index unavailable - skip L5.
      }
    }

    // L6 - prior agent observations (last 5). Takes the remaining budget.
    if (req.agentState?.observations?.length && budget > 0) {
      const block = truncate(
        `# Prior Agent Context\n\n${req.agentState.observations.slice(-5).join('\n\n')}\n\n`,
        budget,
      );
      dynamic += block;
      budget -= est(block);
      layers.l6 = est(block);
    }

    return { stable, dynamic, layers };
  }
}

export const contextAssembler = new ContextAssembler();
export default ContextAssembler;
