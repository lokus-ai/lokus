/**
 * actionContext — builds the ActionContext (PRD §3.2) that surfaces pass to
 * `actionRegistry.execute(id, params, ctx)` and to `aiClient.runToolLoop`.
 *
 * The engine's ActionRegistry expects a context object carrying the editor
 * handle, workspace path, graph index, an LLM caller, and a session id. This
 * module wires those from the live Lokus singletons/globals — keeping every
 * surface from re-deriving the same plumbing.
 *
 * It imports only files already present in the repo (engine + editorAPI +
 * graphIndex) plus this stream's aiClient. It does NOT import ai-provider.js
 * directly (that goes through aiClient's lazy resolution).
 *
 * See LOKUS_AI_PRD.md §3.2 (ActionContext shape) / §6 (agent loop context).
 */

import { editorAPI } from '../../plugins/api/EditorAPI.js';
import { getGraphIndex } from '../../mcp-server/utils/graphIndex.js';
import { streamText } from './aiClient.js';

/**
 * Resolve the active workspace path from the well-known globals the rest of the
 * app uses (`window.__WORKSPACE_PATH__`, `globalThis.__LOKUS_WORKSPACE_PATH__`).
 * @returns {string|undefined}
 */
export function getWorkspacePath() {
  return (
    globalThis.__LOKUS_WORKSPACE_PATH__
    ?? (typeof window !== 'undefined' ? window.__WORKSPACE_PATH__ : undefined)
    ?? undefined
  );
}

/**
 * Resolve the active note id/path from the well-known global, if any.
 * @returns {string|undefined}
 */
export function getActiveNoteId() {
  const active = globalThis.__LOKUS_ACTIVE_FILE__;
  return active?.path ?? active?.name ?? undefined;
}

/**
 * Build an ActionContext for the registry / agent loop.
 *
 * @param {object} [overrides] - explicit values that win over the resolved ones
 * @param {string} [overrides.workspacePath]
 * @param {string} [overrides.noteId]
 * @param {string} [overrides.surface] - drives aiClient surface routing
 * @param {AbortSignal} [overrides.signal]
 * @param {object} [overrides.agentState] - { observations: string[] } for L6
 * @returns {object} ActionContext
 */
export function buildActionContext(overrides = {}) {
  const workspacePath = overrides.workspacePath ?? getWorkspacePath();
  const surface = overrides.surface ?? 'palette';

  return {
    editorAPI,
    workspacePath,
    noteId: overrides.noteId ?? getActiveNoteId(),
    graphIndex: workspacePath ? getGraphIndex(workspacePath) : null,
    sessionId: cryptoRandomId(),
    agentState: overrides.agentState ?? { observations: [] },
    signal: overrides.signal,
    surface,
    /**
     * callLLM — the engine's ActionContext LLM hook (PRD §3.2). A thin shim over
     * aiClient.streamText so action handlers (e.g. editor.rewrite) can call the
     * model without importing the provider themselves.
     * @param {{ system?: string, user: string }} prompt
     * @param {object} [opts] - { model, maxTokens, signal, surface, onDelta }
     * @returns {Promise<string>}
     */
    callLLM: async (prompt, opts = {}) => {
      const messages = [{ role: 'user', content: prompt.user ?? '' }];
      return streamText(
        messages,
        {
          system: prompt.system,
          surface: opts.surface ?? surface,
          model: opts.model,
          maxTokens: opts.maxTokens,
          signal: opts.signal ?? overrides.signal,
        },
        opts.onDelta,
      );
    },
    ...stripKnown(overrides),
  };
}

/** Remove keys we already mapped so `...overrides` doesn't clobber computed ones. */
function stripKnown(overrides) {
  const { workspacePath, noteId, surface, signal, agentState, ...rest } = overrides;
  return rest;
}

/** UUID with a safe fallback when crypto.randomUUID is unavailable. */
function cryptoRandomId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // ignore
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default buildActionContext;
