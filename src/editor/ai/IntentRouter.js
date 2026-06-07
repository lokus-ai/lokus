/**
 * IntentRouter — Cmd-K natural-language → action routing (PRD §6.1).
 *
 * Three tiers, cheapest first, so most Cmd-K invocations cost zero tokens and
 * zero network:
 *
 *   Tier 0 — local fuzzy match against actionRegistry titles/descriptions.
 *            Score ≥ threshold dispatches directly. 0 tokens, 0 network.
 *   Tier 1 — static keyword table (summarize/rewrite/translate/ask/…) → action
 *            id or an `ask`/`agent` intent. 0 tokens.
 *   Tier 2 — model intent resolve: ONE cheap call via aiClient with the
 *            registry's tool schema, returning a tool_use, a plan, or open_ended.
 *
 * The router is pure-ish: it reads the registry and (only for Tier 2) calls the
 * provider. It does NOT execute anything — it returns an Intent the caller
 * (Cmd-K orchestrator) decides how to run (single action, pipeline, or agent
 * loop). Keeping routing and execution separate keeps this unit-testable with no
 * editor/provider for Tier 0/1.
 *
 * Intent shapes returned by route():
 *   { tier:0, type:'action', actionId, params:{}, score, title }
 *   { tier:1, type:'action', actionId, params }
 *   { tier:1, type:'ask',    query }            // free-form question → cmdK chat
 *   { tier:1, type:'agent',  query }            // open-ended research → agent loop
 *   { tier:2, type:'tool_use', actionId, params }
 *   { tier:2, type:'plan',   steps:[{actionId,params}] }
 *   { tier:2, type:'open_ended', query }        // → agent loop
 *   { tier:-1, type:'none' }                    // nothing matched, no provider
 *
 * See LOKUS_AI_PRD.md §6.1 / §6.2.
 */

import { completeTurn } from './aiClient.js';

/** Default fuzzy score below which Tier 0 declines (PRD: ≥ 0.72 dispatches). */
export const TIER0_THRESHOLD = 0.72;

/**
 * Tier-1 keyword table. Each entry maps trigger words → a resolver that yields
 * an Intent given the (lower-cased) query and its remainder after the keyword.
 * Order matters: the first matching keyword wins.
 */
export const KEYWORD_TABLE = [
  { words: ['summarize', 'summary', 'tldr', 'tl;dr'], intent: (q) => ({ type: 'action', actionId: 'ai.summarize', params: { query: q } }) },
  { words: ['rewrite', 'reword', 'rephrase'], intent: (q) => ({ type: 'action', actionId: 'editor.rewrite', params: { instruction: q } }) },
  { words: ['simplify', 'shorten'], intent: (q) => ({ type: 'action', actionId: 'editor.rewrite', params: { instruction: q, mode: 'simplify' } }) },
  { words: ['expand', 'elaborate'], intent: (q) => ({ type: 'action', actionId: 'editor.rewrite', params: { instruction: q, mode: 'expand' } }) },
  { words: ['translate'], intent: (q) => ({ type: 'action', actionId: 'editor.rewrite', params: { instruction: q, mode: 'translate' } }) },
  { words: ['fix grammar', 'grammar', 'proofread'], intent: (q) => ({ type: 'action', actionId: 'editor.rewrite', params: { instruction: q, mode: 'grammar' } }) },
  { words: ['ask', 'explain', 'what', 'why', 'how', 'who', 'when'], intent: (q) => ({ type: 'ask', query: q }) },
  { words: ['find', 'search', 'where'], intent: (q) => ({ type: 'agent', query: q }) },
];

/**
 * Tiny token-overlap + substring fuzzy score in [0,1]. No dependency; good
 * enough to surface obvious title matches ("toggle bold" → format-bold).
 * @param {string} query
 * @param {string} target
 * @returns {number}
 */
export function fuzzyScore(query, target) {
  const q = query.toLowerCase().trim();
  const t = (target ?? '').toLowerCase().trim();
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.9;
  if (t.includes(q)) return 0.8;

  const qTokens = q.split(/\s+/).filter(Boolean);
  const tTokens = new Set(t.split(/\s+/).filter(Boolean));
  if (qTokens.length === 0) return 0;
  let hits = 0;
  for (const tok of qTokens) {
    if (tTokens.has(tok)) hits += 1;
    else if ([...tTokens].some((tt) => tt.startsWith(tok) || tok.startsWith(tt))) hits += 0.5;
  }
  return hits / qTokens.length;
}

/**
 * Tier 0 — best fuzzy match among the registry's palette/Cmd-K-eligible actions.
 * @param {string} query
 * @param {{ bySurface: Function, getAll: Function }} registry
 * @param {number} [threshold]
 * @returns {{ actionId, title, score }|null}
 */
export function tier0(query, registry, threshold = TIER0_THRESHOLD) {
  const actions = (registry.bySurface?.('palette') ?? registry.getAll?.() ?? []);
  let best = null;
  for (const a of actions) {
    const score = Math.max(
      fuzzyScore(query, a.title),
      a.description ? fuzzyScore(query, a.description) * 0.85 : 0,
    );
    if (!best || score > best.score) best = { actionId: a.id, title: a.title, score };
  }
  return best && best.score >= threshold ? best : null;
}

/**
 * Tier 1 — static keyword lookup. Returns null if no keyword leads.
 * @param {string} query
 * @returns {object|null} partial Intent (without tier)
 */
export function tier1(query) {
  const q = query.toLowerCase().trim();
  for (const entry of KEYWORD_TABLE) {
    for (const w of entry.words) {
      if (q === w || q.startsWith(`${w} `) || q.includes(` ${w} `) || q.startsWith(`${w}:`)) {
        return entry.intent(query.trim());
      }
    }
  }
  return null;
}

/**
 * Tier 2 — one model call to resolve an ambiguous instruction into a tool_use,
 * a plan, or open_ended. Uses the registry's Anthropic tool schema so the model
 * can only pick real actions. Falls back to open_ended on any provider error.
 *
 * @param {string} query
 * @param {{ toToolSchema: Function }} registry
 * @param {object} [options] - { system, model, maxTokens, signal, surface }
 * @returns {Promise<object>} partial Intent (without tier)
 */
export async function tier2(query, registry, options = {}) {
  const tools = registry.toToolSchema?.({ provider: 'anthropic', surface: 'palette' }) ?? [];
  const system = options.system
    ?? 'You are a router. Choose the single best tool for the user request, or answer briefly if no tool fits. Prefer a tool call over prose.';
  try {
    const turn = await completeTurn(
      [{ role: 'user', content: query }],
      { ...options, system, tools, surface: options.surface ?? 'palette', model: options.model },
    );
    if (turn.toolUses.length === 1) {
      return { type: 'tool_use', actionId: turn.toolUses[0].name, params: turn.toolUses[0].input ?? {} };
    }
    if (turn.toolUses.length > 1) {
      return { type: 'plan', steps: turn.toolUses.map((t) => ({ actionId: t.name, params: t.input ?? {} })) };
    }
    // No tool chosen → treat as an open-ended request (caller may run the agent loop).
    return { type: 'open_ended', query, answer: turn.text };
  } catch {
    return { type: 'open_ended', query };
  }
}

/**
 * Route a natural-language instruction to an Intent. Runs Tier 0 → Tier 1 →
 * (optionally) Tier 2. Set `useModel:false` to stay fully local (no provider).
 *
 * @param {string} query
 * @param {object} params
 * @param {object} params.registry - actionRegistry
 * @param {boolean} [params.useModel=true] - allow Tier 2 model resolve
 * @param {number} [params.threshold]
 * @param {object} [params.options] - Tier 2 completeTurn options
 * @returns {Promise<object>} Intent (with `tier`)
 */
export async function route(query, { registry, useModel = true, threshold, options } = {}) {
  const q = (query ?? '').trim();
  if (!q || !registry) return { tier: -1, type: 'none' };

  const t0 = tier0(q, registry, threshold);
  if (t0) return { tier: 0, type: 'action', actionId: t0.actionId, params: {}, score: t0.score, title: t0.title };

  const t1 = tier1(q);
  if (t1) return { tier: 1, ...t1 };

  if (!useModel) return { tier: -1, type: 'none' };

  const t2 = await tier2(q, registry, options);
  return { tier: 2, ...t2 };
}

export default { route, tier0, tier1, tier2, fuzzyScore, KEYWORD_TABLE, TIER0_THRESHOLD };
