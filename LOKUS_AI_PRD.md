# Lokus AI Integration PRD

> **Doc 2 of 4** — The master engineering PRD for Lokus's AI system.
>
> | Doc | Title | Scope |
> |-----|-------|-------|
> | 1 | `LOKUS_DIFFERENTIATION.md` | Why the resurfacing engine wins; positioning |
> | **2** | **`LOKUS_AI_INTEGRATION_PRD.md`** (this doc) | **Architecture, engine, agent loop, surfaces, routing, safety** |
> | 3 | `LOKUS_AI_IMPLEMENTATION.md` | Proxy code, ops/Docker/Caddy, full SQL migrations, deploy runbook |
> | 4 | `LOKUS_MONETIZATION_PRD.md` | Pricing ($12/mo Pro = 4000 credits), credit economics, plan gating |
>
> **Status:** Locked architecture. Builder-ready. All file paths and API signatures verified against the repository at `fix-sync` HEAD (May 2026). Where the codebase does *not* yet contain something, it is explicitly marked **[CREATE]**, **[EXTEND]**, or **[PREREQUISITE]**.

---

## 0. TL;DR

Lokus is a local-first markdown note app (Tauri 2 / Rust + React 19 + raw ProseMirror). We are adding an AI system whose **differentiator is the Resurfacing Engine**: as you write, Lokus hands you back forgotten-but-relevant notes — first via the wiki-link graph (ships first, $0, no AI), then via local semantic embeddings (SQLite-vec + Ollama, still $0).

Everything is built on **one engine**:

- **ActionRegistry** — every Lokus action becomes an LLM-callable tool. A structural clone of `src/plugins/registry/CommandRegistry.js`, projecting to `toToolSchema()` / `bySurface()` / `toMcpManifest()`.
- **ContextAssembler** — adaptive, budget-capped context (L1 instruction → L6 agent observations).
- **Surfaces** (same engine, different gesture): ambient resurfacing (first, zero-LLM), inline slash, selection transforms, ghost text (opt-in/off), **Cmd-K natural-language → chained actions (PRIMARY)**, agent/chat panel (last).

**Model routing:** local (Ollama, later Apple Foundation Models) for ambient/ghost/embeddings/STT = **$0**; cloud frontier (Anthropic primary, OpenAI secondary, OpenRouter optional fallback) for heavy synthesis / Cmd-K / agent = **credits**.

**The proxy** is a **self-hosted Hono (TypeScript) service on the founder's own Linux server** behind Caddy at `api.lokusmd.com`, NOT a Supabase Edge Function. Provider keys live **only** in the proxy's server env. Supabase remains the system of record for **auth (JWT)** and **Postgres (credit ledger + existing tables)**.

**Credit flow:** reserve-then-reconcile, idempotent, server-trustworthy keys, **over-reserve so reconcile only ever refunds** (no post-hoc charge, no negative balance). One canonical ledger schema. STT and agent loops are metered.

**Critical architecture correction (vs. early drafts):** the **agent ReAct loop runs ON THE CLIENT**, not the proxy. The proxy is stateless and only does per-step model inference + credit accounting. The proxy never calls back to the client and never holds a write buffer. (The earlier "proxy calls `localhost:{port}/tool-exec`" design is impossible: `src-tauri/src/api_server.rs:345` binds `127.0.0.1` only, and exposing it publicly would leak the user's filesystem.)

**Safety:** diff-preview before write, confirm-before-write, undo (`prosemirror-history`, already installed), append-only local audit at `.lokus/ai-audit.jsonl`, cross-window lock reuse.

---

## 1. Aim & Goals

### 1.1 Product Aim

**Transform Lokus from a vault of inert, forgotten knowledge into a living system that hands the note back before you ask.**

A note written in January sits dormant until you remember to search for it. The Resurfacing Engine kills that dormancy: as you write, Lokus continuously surfaces related notes — from graph traversal (wiki-links) to semantic meaning-match (embeddings). The passive act of "having written something" becomes an active, recycled resource.

### 1.2 Definition of "AI-Native" for Lokus

AI-native here means three concrete properties, in priority order:

1. **The most valuable AI runs locally and free.** Ambient resurfacing, ghost text, embeddings, and (later) local STT cost zero credits and work offline. AI is not a paywalled bolt-on; it is woven into the writing surface.
2. **Cloud AI is invoked by deliberate gesture, never ambiently.** The expensive frontier model is reached only when the user explicitly asks (Cmd-K, a selection transform, the agent panel). No background token burn.
3. **Every AI write is reversible and auditable.** Diff-preview → confirm → undo, with a local append-only audit trail. The user owns the loop.

### 1.3 Objectives & User Outcomes

| # | Outcome | Mechanism | Ship | Success metric |
|---|---------|-----------|------|----------------|
| O1 | **Ambient panel** shows 3–5 related notes as you type, instant, free | `GraphIndex.getRelatedNotes()` 1-hop | P0 | 60% of users with 50+ notes interact weekly |
| O2 | **Cmd-K natural language** → chained actions, streamed | IntentRouter → ActionRegistry → proxy → Anthropic | P0 | 20% of Pro+ users invoke ≥2×/week |
| O3 | **Credit transparency** — balance visible, audit local | reserve-then-reconcile + `.lokus/ai-audit.jsonl` | P0 | Zero "where did my credits go" escalations |
| O4 | **Semantic resurfacing** — embeddings merge with graph | Ollama `nomic-embed-text` + SQLite-vec | P2 | +40% relevant suggestions, satisfaction >80% |
| O5 | **Local-first everywhere** — ambient/ghost/embeddings offline | Ollama + Rust SQLite-vec | P2 | Ambient works on a plane |

### 1.4 Non-Goals

- ❌ Automated note *generation* (we surface and transform; we do not write your notes for you unattended).
- ❌ LLM-based *search* (graph + embeddings + FTS only; the LLM reasons over retrieved context, it does not *be* the index).
- ❌ Training on vault data (everything stays local or transits the founder's proxy; no model training, no telemetry — Lokus is marketed local-first/no-telemetry, and this must hold).
- ❌ Real-time multi-user collaboration (single-user, offline-first).
- ❌ User-trained/custom models on day 1 (Anthropic + OpenAI + local Ollama only; Apple Foundation Models is a future epic, §8.4).

---

## 2. System Architecture

### 2.1 Principle: Local First, Cloud Smart, Keys Server-Side Only

- Vault data stays in the workspace. Provider keys (Anthropic / OpenAI / Deepgram / Supabase service-role) stay **only** in the proxy server env. The Tauri binary and React bundle contain **zero** provider secrets.
- Supabase is the **system of record** for auth + the credit ledger. It does **not** proxy LLM calls (unlike the legacy `supabase/functions/llm-summary/`, which stays only for the meeting-summary flow during transition).
- The founder runs the proxy: a self-hosted Docker service behind Caddy (automatic TLS) at `api.lokusmd.com`.

### 2.2 Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  TAURI DESKTOP APP (local, on user's machine)                      │
│  React 19 · raw ProseMirror · Zustand · Rust backend (lib.rs)      │
│                                                                    │
│  JS engine (src/core/ai/):                                         │
│    ActionRegistry · ContextAssembler · ActionContextBuilder        │
│    IntentRouter · CmdKOrchestrator · Pipeline · AgentLoop (client) │
│    ResurfacingEngine · DiffPreview · ModelRouter · EmbeddingPipeline│
│                                                                    │
│  Existing JS reused:                                               │
│    GraphIndex (mcp-server/utils/graphIndex.js)                     │
│    notesTools / executeNoteTool (mcp-server/tools/notes.js)        │
│    ai-provider.js (789 lines; rewritten — §8)                      │
│                                                                    │
│  Rust commands (src-tauri/src/):                                   │
│    lib.rs: llm_stream_request (cloud BYOK, line 499)               │
│    ollama.rs [CREATE] · embeddings.rs [CREATE] · afm.rs [STUB]     │
│    search.rs (search_in_files) · transcription.rs (Deepgram WS)    │
│    secure_store.rs [PREREQUISITE — keyring 3.6]                    │
│                                                                    │
│  .lokus/  (local, excluded from cloud sync — §9.4):               │
│    notes/ · ai-audit.jsonl · embeddings.db · mcp-graph-index.json  │
└───────────────┬────────────────────────────────────────────────┬─┘
                │ HTTPS+JWT (chat, agent steps, STT, embed-fallback) │ localhost
                ▼                                                    ▼
  ┌──────────────────────────────┐                       ┌───────────────┐
  │ FOUNDER'S LINUX VPS          │                       │  Ollama       │
  │ (api.lokusmd.com)            │                       │  localhost    │
  │                              │                       │  :11434       │
  │  Caddy (TLS, SSE flush)      │                       │  qwen3, nomic │
  │     │                        │                       └───────────────┘
  │  Hono proxy (Bun)            │
  │   /v1/chat  (SSE)            │──► Anthropic (primary)
  │   /v1/agent-step (1 call)    │──► OpenAI (secondary)
  │   /v1/transcribe (+/ws)      │──► OpenRouter (fallback)
  │   /v1/embed (cloud fallback) │──► Deepgram (STT)
  │   /v1/balance · /health      │
  │     │                        │
  │  Redis (rate-limit + idem +  │
  │         reservation state)   │
  └─────┼────────────────────────┘
        │ service-role JWT + RPC
        ▼
  ┌──────────────────────────────┐
  │ SUPABASE                     │
  │  Auth (JWT — verified at     │
  │    proxy via JWKS, cached)   │
  │  Postgres:                   │
  │    user_credits (canonical)  │
  │    credit_reservations       │
  │    credit_ledger (audit)     │
  │    ai_audit_log              │
  │    user_tiers · meeting_usage│
  │    workspace_manifests [NEW] │
  │  RPCs: reserve_credits,      │
  │    settle_credits,           │
  │    refund_reservation,       │
  │    update_manifest [NEW]     │
  └──────────────────────────────┘
```

### 2.3 Canonical Route Map (resolves the cross-section inconsistency)

There is exactly **one** route family. All earlier names (`/v1/actions`, `/v1/embeddings`, `/v1/intent`, `/v1/agent`) are superseded by this table.

| Method | Path | Purpose | Credits |
|--------|------|---------|---------|
| `POST` | `/v1/chat` | Streaming chat / single tool-calling turn (SSE). Used by Cmd-K single-shot, selection transforms, and **each step of the client-driven agent loop**. | reserve/reconcile |
| `POST` | `/v1/transcribe` | Batch STT (Deepgram) | reserve/reconcile (per audio-second) |
| `GET` | `/v1/transcribe/ticket` | Issue a 30s one-time WS ticket (Bearer JWT) | — |
| `GET` | `/v1/transcribe/ws` | Real-time STT (ticket-authed) | reserve on open, settle on close |
| `POST` | `/v1/embed` | Cloud embedding **fallback only** (local Ollama is primary, $0) | reserve/reconcile if used |
| `GET` | `/v1/balance` | Current credit balance | — |
| `GET` | `/health` | Liveness + drain signal | — |

There is **no `/v1/agent`** endpoint and **no `/tool-exec` callback**. The agent loop is client-side (§6) and calls `/v1/chat` once per step.

### 2.4 Request Narrative A — Ambient Resurfacing (graph, ~50ms, $0)

```
T+0ms    User opens note "Distributed Systems" → React emits 'lokus:note-opened'
T+5ms    ResurfacingEngine.surfaceGraphNeighbors(noteName) called
T+10ms   getGraphIndex(window.__WORKSPACE_PATH__).getRelatedNotes(
             "distributed-systems", { depth: 1, direction: 'both' })
         → reads .lokus/mcp-graph-index.json (cached, <5min stale)
         → { found: true, related: [ {id,name,path,depth,direction,connections}, … ] }
T+25ms   AmbientNotesPanel renders 3–5 cards (incoming ← / outgoing →)
T+50ms   User-perceivable. Click → open note → loop re-fires for new note.

LATENCY ~50ms · COST $0 · NO NETWORK · NO LLM
```

> **Correction applied:** the resurfacing engine uses the public `getRelatedNotes()` API and the real node field `incomingLinks` (NOT a nonexistent `backlinks` field). It does not poke `graph.nodes[id]` internals.

### 2.5 Request Narrative B — Cmd-K Synthesis (cloud, 1–3s, credits)

```
T+0ms    Cmd-K. User types "explain the tradeoffs between these three".
T+50ms   IntentRouter (client): Tier-0 fuzzy miss → Tier-1 static "explain" hits
         the 'explain-comparison' action (no model call needed for routing).
T+70ms   ContextAssembler.assemble({ instruction, noteId, selection, searchQuery })
           L1 instruction · L2 open note (≤30%) · L3 selection (≤15%)
           L4 FTS via search_in_files (≤25%) · L5 GraphIndex 1-hop (≤15%)
         → system string with ---CACHE_BOUNDARY--- between stable (L1+L2) and dynamic (L3-L6)
T+100ms  POST https://api.lokusmd.com/v1/chat
           Authorization: Bearer <supabase JWT>
           X-Idempotency-Key: <uuid>
           body: { messages, system, tools?, model?, stream:true }
T+120ms  Proxy: verify JWT locally (JWKS, cached 60s) → {userId, tier}
T+130ms  estimate = input_tokens + max_tokens(ceiling)  ← OVER-reserve (see §2.6)
T+140ms  reserve_credits(userId, estimate, reserveId)
           Redis SET reserve:{key} NX EX 600  (idempotency gate)
           → INSERT credit_reservations; UPDATE user_credits ... WHERE balance >= estimate
           → insufficient? 402 INSUFFICIENT_CREDITS, no upstream call.
T+150ms  HTTP 200 + Content-Type: text/event-stream flushed.
           POST Anthropic /v1/messages (x-api-key from server env),
           prompt-caching beta header, c.req.raw.signal propagated (abort on disconnect).
T+300ms→1500ms  SSE text_delta forwarded as `data:{ "type":"text_delta","text":"…" }`.
T+1500ms message_stop → usage { input_tokens, output_tokens, cache_read_input_tokens }
T+1510ms settle_credits(reserveId, actualCredits)  ← actual ≤ reserved ⇒ REFUND only
           INSERT credit_ledger audit; INSERT ai_audit_log; mark reservation settled.
           data:{ "type":"done", usage, credits:{reserved,actual,balance_after} }
           data: [DONE]
T+1600ms Client: diff-preview (DiffPreview.js). User Accept → PM transaction;
           Cmd-Z undoes; .lokus/ai-audit.jsonl line appended.

LATENCY ~1.6s · COST = actual ≤ reserved (always a refund, never a post-hoc charge)
```

### 2.6 Credit Flow Invariants (the fixes that make billing correct)

These five invariants are the load-bearing corrections; every credit code path must honor them.

1. **Over-reserve, never under-reserve.** `estimate = measured_input_tokens × input_rate + max_tokens_ceiling × output_rate`. Because we reserve at the model's `max_tokens` output ceiling (not a 25% guess), **actual ≤ reserved always**, so `settle_credits` only ever refunds. This single change eliminates the entire negative-balance bug class.
2. **One canonical ledger.** A single lockable `user_credits(user_id PK, balance bigint CHECK(balance>=0))` row is the source of truth. Deduction uses `UPDATE … WHERE balance >= amount` (atomic, floor-enforced). An append-only `credit_ledger` is the audit trail; `credit_reservations` tracks in-flight reserves. The aggregating-view-as-balance design and the three RPC name sets are deleted. (Full SQL in Doc 3; signatures in §9.)
3. **Idempotency gates execution, not just response.** The reserve is `INSERT … ON CONFLICT DO NOTHING` on `credit_reservations.reserve_id`. **If 0 rows inserted (key replay), the proxy returns the cached result and does NOT call the provider.** This closes the free-call exploit where a replayed key returned success-without-deduct while the proxy still billed upstream.
4. **State survives restarts.** Idempotency records, reservation state, and rate-limit windows live in **Redis + Postgres**, never in-process Maps. Zero-downtime deploys restart the container; in-memory state would reset quotas and strand reserves.
5. **Stranded reserves get swept.** A `pg_cron` job refunds `credit_reservations WHERE settled=false AND created_at < now()-interval '15 min'`. A proxy crash mid-stream therefore self-heals within 15 minutes instead of silently over-charging.

---

## 3. The Engine — ActionRegistry

### 3.1 What & Where

**File: `src/core/ai/ActionRegistry.js` [CREATE].** A superset of `src/plugins/registry/CommandRegistry.js` (same `EventEmitter` base from `src/utils/EventEmitter.js`). `CommandRegistry` is left **unchanged** — it stays the UI command palette. `ActionRegistry` is the LLM tool layer. They coexist.

The differences over `CommandRegistry`: `register()` requires a `params` JSON Schema and a `surfaces` array; `execute()` takes a typed `ActionContext`; and it adds `toToolSchema()` (Anthropic/OpenAI shape), `toMcpManifest()` (MCP `tools/list` shape), `bySurface()`, and `freeActions()`.

### 3.2 Entry Shape

```javascript
// ActionEntry (stored in the internal Map)
{
  id, title, description,                 // identity; description doubles as LLM tool description
  category,                               // 'vault'|'editor'|'search'|'ai'|'system'|'plugin'
  icon,                                   // Lucide name | null
  params: { [name]: { type, description, enum?, default?, required?, items? } }, // JSON Schema
  surfaces: ['slash'|'palette'|'selection'|'agent'|'ambient'],
  requiresEditor, requiresSelection, requiresNetwork,  // booleans
  creditCost: 'free'|'low'|'medium'|'high',
  pluginId,                               // null for built-ins
  handler: async (params, context) => ActionResult
}

// ActionContext (2nd handler arg; never serialized)
{
  editorAPI,        // src/plugins/api/EditorAPI.js singleton (getContent, replaceText, …)
  noteManager,      // thin wrappers over Rust invoke (search, read, create)
  graphIndex,       // getGraphIndex(workspacePath) — getRelatedNotes(name,{depth,direction})
  workspacePath,    // window.__WORKSPACE_PATH__
  callLLM,          // ({system,user}, {streaming,model}) => Promise<string> → POST /v1/chat
  supabaseToken,    // JWT (from secure_store; localStorage fallback until §9.5 lands)
  sessionId,        // crypto.randomUUID() for lokus:llm-chunk:{sessionId} events
  agentState        // { observations: string[] } for L6
}

// ActionResult
{ type:'text'|'diff'|'insert'|'replace'|'open-note'|'ambient',
  content, targetRange?, noteId?, diff?:{before,after}, metadata? }
```

### 3.3 Class (abridged — full methods identical in shape to the spec)

```javascript
// src/core/ai/ActionRegistry.js
import { EventEmitter } from '../../utils/EventEmitter.js';

class ActionRegistry extends EventEmitter {
  constructor() { super(); this._actions = new Map(); }

  register(action) {
    const { id, title, handler } = action;
    if (!id || !title || typeof handler !== 'function')
      throw new Error('ActionRegistry.register: id, title, handler required');
    if (this._actions.has(id)) throw new Error(`"${id}" already registered`);
    const entry = {
      id, title,
      description: action.description ?? '', category: action.category ?? 'plugin',
      icon: action.icon ?? null, params: action.params ?? {},
      surfaces: action.surfaces ?? ['palette'],
      requiresEditor: action.requiresEditor ?? false,
      requiresSelection: action.requiresSelection ?? false,
      requiresNetwork: action.requiresNetwork ?? true,
      creditCost: action.creditCost ?? 'medium', pluginId: action.pluginId ?? null, handler,
    };
    this._actions.set(id, entry);
    this.emit('action-registered', entry);
    return { dispose: () => this.unregister(id) };
  }

  unregister(id) { const e=this._actions.get(id); if(e){this._actions.delete(id);this.emit('action-unregistered',e);} }
  get(id){return this._actions.get(id)??null;} exists(id){return this._actions.has(id);}
  getAll(){return [...this._actions.values()];}
  bySurface(s){return this.getAll().filter(a=>a.surfaces.includes(s));}
  byCategory(c){return this.getAll().filter(a=>a.category===c);}
  freeActions(){return this.getAll().filter(a=>a.creditCost==='free');}

  async execute(id, params, context) {
    const a = this._actions.get(id);
    if (!a) { this.emit('action-error',{id,error:new Error('not found')}); throw new Error(`"${id}" not found`); }
    if (a.requiresEditor && !context.editorAPI?.editorInstance) throw new Error(`"${id}" requires editor`);
    if (a.requiresSelection) { const s=context.editorAPI?.editorInstance?.state?.selection; if(!s||s.empty) throw new Error(`"${id}" requires selection`); }
    const t=Date.now();
    try { const r=await a.handler(params,context); this.emit('action-executed',{id,durationMs:Date.now()-t,result:r}); return r; }
    catch(err){ this.emit('action-error',{id,error:err}); throw err; }
  }

  toToolSchema({ provider='anthropic', surface, category } = {}) {
    let acts=this.getAll();
    if(surface) acts=acts.filter(a=>a.surfaces.includes(surface));
    if(category) acts=acts.filter(a=>a.category===category);
    return acts.map(a=>{
      const properties={}, required=[];
      for(const[k,s]of Object.entries(a.params)){
        properties[k]={type:s.type,description:s.description??'',...(s.enum?{enum:s.enum}:{}),...(s.default!==undefined?{default:s.default}:{}),...(s.items?{items:s.items}:{})};
        if(s.required) required.push(k);
      }
      const input_schema={type:'object',properties,...(required.length?{required}:{})};
      if(provider==='openai') return {type:'function',function:{name:a.id.replace(/[.-]/g,'_'),description:a.description,parameters:input_schema}};
      return {name:a.id.replace(/[.-]/g,'_'),description:a.description,input_schema};
    });
  }

  toMcpManifest({ surface } = {}) {
    let acts=this.getAll(); if(surface) acts=acts.filter(a=>a.surfaces.includes(surface));
    return { tools: acts.map(a=>{
      const properties={},required=[];
      for(const[k,s]of Object.entries(a.params)){properties[k]={type:s.type,description:s.description??'',...(s.enum?{enum:s.enum}:{}),...(s.items?{items:s.items}:{})}; if(s.required)required.push(k);}
      return {name:a.id,description:a.description,inputSchema:{type:'object',properties,...(required.length?{required}:{})},
        _lokus:{surfaces:a.surfaces,category:a.category,creditCost:a.creditCost,icon:a.icon}};
    })};
  }

  clearPlugin(pluginId){for(const[id,a]of this._actions)if(a.pluginId===pluginId)this.unregister(id);}
  get count(){return this._actions.size;}
}
export const actionRegistry = new ActionRegistry();
export default ActionRegistry;
```

### 3.4 Migrating the Three Existing Catalogs

| Source | Count (verified) | Strategy |
|--------|------------------|----------|
| `ACTIONS` in `src/core/shortcuts/registry.js` | **47** | wrap each as an event-re-emitting `creditCost:'free'` palette action |
| `CommandRegistry` plugin commands (runtime) | variable | mirror on `command-registered` event |
| `notesTools` in `src/mcp-server/tools/notes.js` | 10 | wrap `executeNoteTool` as handler; surfaces `['agent','palette']` |

> **Correction:** `ACTIONS` has **47** entries (verified `grep -c "id:"`), not 42/46.

**Pattern A — `builtin-actions.js` [CREATE]** re-emits the existing Tauri event so every existing listener keeps working:
```javascript
// src/core/ai/actions/builtin-actions.js
import { emit } from '@tauri-apps/api/event';
import { ACTIONS } from '../../shortcuts/registry.js';
import { actionRegistry } from '../ActionRegistry.js';
export function registerBuiltinActions() {
  for (const a of ACTIONS) {
    const isFmt = a.id.startsWith('format-') || a.id.startsWith('insert-');
    actionRegistry.register({
      id:a.id, title:a.name, description:`Executes "${a.name}" in Lokus`,
      category:'system', surfaces: isFmt?['palette','slash']:['palette'], params:{},
      requiresEditor:isFmt, requiresNetwork:false, creditCost:'free', pluginId:null,
      handler: async()=>{ await emit(a.event); return {type:'text',content:`Executed: ${a.name}`}; },
    });
  }
}
```

**Pattern B — mirror plugin commands** (add to `src/plugins/PluginManager.js`, additive only):
```javascript
commandRegistry.on('command-registered', (cmd) => {
  if (!actionRegistry.exists(cmd.id)) actionRegistry.register({
    id:cmd.id, title:cmd.title, description:cmd.description||cmd.title,
    category:cmd.category?.toLowerCase()??'plugin', surfaces:['palette'], params:{},
    requiresEditor:cmd.requiresEditor??false, requiresNetwork:false, creditCost:'free', pluginId:cmd.pluginId,
    handler: async()=>({type:'text',content:(await commandRegistry.execute(cmd.id))??`Executed: ${cmd.title}`}),
  });
});
```

**Pattern C — `vault-actions.js` [CREATE]** wraps `executeNoteTool`. The 10 real tool names are: `list_notes, read_note, create_note, update_note, delete_note, search_notes, get_note_links, get_note_backlinks, extract_note_metadata, rename_note`.
```javascript
// src/core/ai/actions/vault-actions.js
import { notesTools, executeNoteTool } from '../../../mcp-server/tools/notes.js';
import { actionRegistry } from '../ActionRegistry.js';
export function registerVaultActions(workspacePath) {
  for (const tool of notesTools) actionRegistry.register({
    id:`vault.${tool.name}`, title:tool.name.replace(/_/g,' '), description:tool.description,
    category:'vault', params:_mcpSchemaToParams(tool.inputSchema), surfaces:['agent','palette'],
    requiresEditor:false, requiresNetwork:false, creditCost:'free', pluginId:null,
    handler: async (params, ctx) => {
      const r = await executeNoteTool(tool.name, params, ctx.workspacePath ?? workspacePath, null);
      return { type:'text', content: r.content?.[0]?.text ?? '' };
    },
  });
}
function _mcpSchemaToParams(s){const p={},req=new Set(s.required??[]);for(const[k,v]of Object.entries(s.properties??{}))p[k]={type:v.type,description:v.description??'',required:req.has(k),...(v.enum?{enum:v.enum}:{}),...(v.items?{items:v.items}:{})};return p;}
```

### 3.5 Startup Wiring — correct file

> **Correction:** registration goes in **`src/views/Workspace.jsx`** (where `workspacePath` state exists), NOT `src/App.jsx` (which has no `workspacePath` and only a `[]`-dep effect calling `registerGlobalShortcuts()`). Alternatively read `window.__WORKSPACE_PATH__` (used by `canvas/manager.js`, `shortcuts/registry.js:224`, `PluginApiManager.js`).

```javascript
// src/views/Workspace.jsx — inside the effect that has workspacePath
import { registerBuiltinActions } from '../core/ai/actions/builtin-actions.js';
import { registerVaultActions }   from '../core/ai/actions/vault-actions.js';
useEffect(() => {
  if (!workspacePath) return;
  registerBuiltinActions();
  registerVaultActions(workspacePath);
}, [workspacePath]);
```

### 3.6 Three Representative Tools

- **`note.create`** → `executeNoteTool('create_note', …)` (`notes.js`). `creditCost:'free'`, surfaces `['agent','palette']`. `toToolSchema` emits Anthropic `{name:'note_create', input_schema:{…, required:['path','content']}}`.
- **`editor.rewrite`** → `context.callLLM()` then returns `{type:'diff', diff:{before,after}, targetRange}`; UI shows diff-preview, Accept calls `editorAPI.replaceText(range, content)` (PM `tr.replaceWith`). `creditCost:'medium'`, surfaces `['selection','palette','agent']`.
- **`vault.search`** → `invoke('search_in_files', { query, workspacePath, options })` (`src-tauri/src/search.rs`). The result match field is serde-renamed to **`match`** (not `match_text`). `creditCost:'free'`.

### 3.7 MCP Server Integration

Extend the `tools/list` handler in `src/mcp-server/http-server.js` to merge `actionRegistry.toMcpManifest().tools` with the legacy `notesTools` not already registered as `vault.*` (dedupe by stripping the `vault.` prefix).

---

## 4. The Engine — ContextAssembler

### 4.1 What & Where

**File: `src/core/ai/ContextAssembler.js` [CREATE].** Produces a budget-capped context string for an LLM call. Real dependencies (all verified):

| Import | Source | Provides |
|--------|--------|----------|
| `editorAPI` | `src/plugins/api/EditorAPI.js` | `getContent()` → `createLokusSerializer().serialize(doc)` |
| `getGraphIndex` | `src/mcp-server/utils/graphIndex.js` | `getRelatedNotes(name,{depth:1,direction:'both'})` |
| `invoke('search_in_files',…)` | `src-tauri/src/search.rs` | FTS |
| `createLokusSerializer` | `src/core/markdown/lokus-md-pipeline.js` | PM doc → markdown |

### 4.2 Layer Model & Budget Caps

| Layer | Content | Source | Soft cap |
|-------|---------|--------|----------|
| L1 | System instruction | caller | always |
| L2 | Open note (PM doc → MD) | `editorAPI.getContent()` | 30% |
| L3 | Selection | PM `doc.textBetween` | 15% |
| L4 | Vault FTS | `search_in_files` | 25% |
| L5 | 1-hop wiki-link neighbors (**GraphRAG**) | `getRelatedNotes` | 15% |
| L6 | Agent observations | `agentState` | remainder |

**Hard rule:** L1 always; remaining budget allocated L1→L6 until exhausted. Token estimate = `ceil(chars/4)`; the proxy reconciles true tokens for billing.

### 4.3 Budget Algorithm

```
budget = maxTokens; ctx = ""
ctx += L1(instruction); budget -= est(L1); if budget<=0 return ctx
for (layer, cap) in [(L2,.30),(L3,.15),(L4,.25),(L5,.15)]:
    block = build(layer); if !block continue
    trimmed = truncate(block, min(budget, maxTokens*cap))
    ctx += trimmed; budget -= est(trimmed); if budget<=0 return ctx
ctx += truncate(L6(agentState.observations[-5:]), budget)
return ctx
```

`truncate()` prefers a paragraph boundary, else char-level with a `[… truncated]` marker.

### 4.4 Prompt-Cache Contract

The assembler joins **stable prefix (L1+L2)** and **dynamic suffix (L3–L6)** with the literal marker `\n\n---CACHE_BOUNDARY---\n\n`. The proxy splits on it and sets Anthropic `cache_control:{type:'ephemeral'}` on the prefix block only. This cuts repeat-call input cost ~90% within a Cmd-K session.

### 4.5 Class (abridged)

```javascript
// src/core/ai/ContextAssembler.js
import { invoke } from '@tauri-apps/api/core';
import { getGraphIndex } from '../../mcp-server/utils/graphIndex.js';
import { editorAPI } from '../../plugins/api/EditorAPI.js';

const CACHE_BOUNDARY = '\n\n---CACHE_BOUNDARY---\n\n';
const est = t => t ? Math.ceil(t.length/4) : 0;
const truncate = (t,maxTok) => { const m=maxTok*4; if(t.length<=m)return t; const c=t.slice(0,m),p=c.lastIndexOf('\n\n'); return p>m*0.7?c.slice(0,p)+'\n\n[… truncated]':c+'\n[… truncated]'; };

export class ContextAssembler {
  constructor({ defaultMaxTokens=8192 }={}) { this.defaultMaxTokens=defaultMaxTokens; this._cache=new Map(); this._ttl=30_000; }
  invalidate(){this._cache.clear();}
  invalidateNote(id){for(const k of this._cache.keys())if(k.startsWith(`${id}::`))this._cache.delete(k);}

  async assemble(req) {
    const max = req.maxTokens ?? this.defaultMaxTokens;
    const key = `${req.noteId}::${req.searchQuery}::${req.agentState?.observations?.length??0}`;
    const hit = this._cache.get(key); if (hit && Date.now()-hit.ts<this._ttl) return hit.context;
    let budget=max;
    const l1 = req.instruction ? `# System Instruction\n${req.instruction}\n\n` : '';
    let stable = l1; budget -= est(l1);

    // L2 (stable, cacheable)
    if (req.useEditor!==false && editorAPI.editorInstance && budget>0) {
      try { const md=await editorAPI.getContent();
        if (md?.trim()) { const title=req.noteId?req.noteId.split('/').pop()?.replace(/\.md$/,''):'Current Note';
          const block=truncate(`# Open Note: ${title}\n\n${md}\n\n`, Math.min(budget, max*0.30));
          stable+=block; budget-=est(block); } } catch {}
    }
    let dynamic='';
    // L3 selection
    let sel=req.selection;
    if(!sel && editorAPI.editorInstance){const v=editorAPI.editorInstance,{from,to}=v.state.selection; if(from!==to) sel=v.state.doc.textBetween(from,to,'\n');}
    if(sel?.trim() && budget>0){const b=truncate(`# Selected Text\n\n${sel}\n\n`,Math.min(budget,max*0.15)); dynamic+=b; budget-=est(b);}
    // L4 FTS
    if(req.searchQuery && req.workspacePath && budget>0){
      try{const r=await invoke('search_in_files',{query:req.searchQuery,workspacePath:req.workspacePath,options:{caseSensitive:false,wholeWord:false,regex:false,fileTypes:['md'],maxResults:8,contextLines:1}});
        if(r?.length){const lines=[`# Related Notes (search: "${req.searchQuery}")\n`]; for(const f of r.slice(0,8)){lines.push(`## ${f.fileName}`); for(const m of f.matches.slice(0,2))lines.push(`  L${m.line}: ${m.text.trim()}`);} const b=truncate(lines.join('\n')+'\n',Math.min(budget,max*0.25)); dynamic+=b; budget-=est(b);}
      }catch{}
    }
    // L5 graph
    if(req.noteId && req.workspacePath && budget>0){
      try{const gi=getGraphIndex(req.workspacePath); await gi.load();
        const name=req.noteId.split('/').pop()?.replace(/\.md$/i,'')??'';
        const {found,related}=gi.getRelatedNotes(name,{depth:1,direction:'both',limit:10});
        if(found&&related?.length){const lines=[`# Wiki-Link Neighbors (1-hop from "${name}")\n`]; for(const n of related)lines.push(`${n.direction==='outgoing'?'→':'←'} [[${n.name}]] — ${n.connections} connections`); const b=truncate(lines.join('\n')+'\n\n',Math.min(budget,max*0.15)); dynamic+=b; budget-=est(b);}
      }catch{}
    }
    // L6
    if(req.agentState?.observations?.length && budget>0) dynamic+=truncate(`# Prior Agent Context\n\n${req.agentState.observations.slice(-5).join('\n\n')}\n\n`,budget);

    const context = stable + CACHE_BOUNDARY + dynamic;
    this._cache.set(key,{context,ts:Date.now()});
    return context;
  }
}
export const contextAssembler = new ContextAssembler();
```

### 4.6 Cache Invalidation & Per-Surface Budgets

- Invalidate on PM update: add `contextAssembler.invalidate()` to `EditorAPI.notifyUpdate()`. Invalidate on save: `listen('lokus:save-file', () => contextAssembler.invalidate())`.
- Per-surface `maxTokens`: slash 2048 · selection 3072 · palette 8192 · agent 16384 · ambient 512 (graph-only display, no LLM).

---

## 5. The Resurfacing Engine

This is **the differentiator** — "hands the note back before you ask." Two layers; A ships first.

### 5.1 Layer A — Graph (ships first, $0, no AI)

**File: `src/core/ai/ResurfacingEngine.js` [CREATE].** Uses the public `GraphIndex` API.

```javascript
import { getGraphIndex } from '../../mcp-server/utils/graphIndex.js';
import { invoke } from '@tauri-apps/api/core';

export class ResurfacingEngine {
  constructor(workspacePath){ this.workspacePath=workspacePath; this.currentNoteId=null; this.ambient=[]; }

  // LAYER A — graph 1-hop neighbors (incoming + outgoing). Always available.
  async surfaceGraphNeighbors(noteName) {
    const gi = getGraphIndex(this.workspacePath); await gi.load();
    const { found, related } = gi.getRelatedNotes(noteName, { depth:1, direction:'both', limit:5 });
    this.ambient = found ? related : [];      // [{id,name,path,depth,direction,connections}]
    return this.ambient;
  }

  // LAYER B — local-embedding meaning-match (P2; Ollama + SQLite-vec, $0)
  async surfaceSemanticMatches(currentText) {
    try {
      const check = await invoke('ollama_check'); if (!check.running) return [];
      const queryEmbedding = await invoke('ollama_embed', { model:'nomic-embed-text', text:currentText.slice(0,2048) });
      const matches = await invoke('search_embeddings', { workspacePath:this.workspacePath, queryEmbedding, topK:5 });
      return matches.filter(m => m.distance < 1.2 && m.noteId !== this.currentNoteId);
    } catch { return []; }
  }
}
```

> **Correction:** uses `getRelatedNotes()` and the field `direction` from the real return shape; never references a nonexistent `backlinks`/`outgoingLinks` node field.

### 5.2 Layer B — Local Semantic (P2)

Background-embed all notes (Ollama `nomic-embed-text`, 768-dim) into SQLite-vec (Rust, §8.3). On editor idle (500ms debounce), embed the current paragraph and kNN-search; merge with Layer A by score in the ambient panel. All $0, all offline.

### 5.3 Ambient UI

**`src/components/AmbientNotesPanel.jsx` [CREATE].** Renders 3–5 cards; merges `surfaceGraphNeighbors` (immediate) with `lokus:semantic-notes-updated` events (Layer B). Click → `lokus:navigate:note`. This is the zero-LLM surface that ships in P0 and creates the "living vault" feel before any cloud cost.

---

## 6. The Agent Loop & Orchestration

> **CRITICAL CORRECTION — the loop runs ON THE CLIENT.** Earlier drafts had the remote proxy call back to `http://localhost:{port}/tool-exec` to run read tools. That is impossible and unsafe: `src-tauri/src/api_server.rs:345` binds `127.0.0.1` only; exposing it publicly would leak the user's notes to the network. The proxy stays **stateless** and does **per-step inference only**. The client owns the loop, executes read tools locally, holds the write buffer, and renders the diff.

### 6.1 Cmd-K Intent Router (`src/core/ai/IntentRouter.js` [CREATE])

Three tiers, cheapest first:

- **Tier 0 — local fuzzy** against `actionRegistry.getAll()` titles/descriptions. Score ≥ 0.72 dispatches directly. 0 tokens, 0 network.
- **Tier 1 — static keyword table** (`summarize`, `rewrite`, `translate`, `ask`, `insert table`, …) → action id. 0 tokens.
- **Tier 2 — model intent resolve.** One cheap Haiku call via `/v1/chat` (with `tools` = `actionRegistry.toToolSchema()`, `max_tokens` small). Returns one of `{type:'tool_use',tool,params}` | `{type:'plan',steps}` | `{type:'open_ended'}`.

### 6.2 Pipeline vs Agent Loop — the routing rule

| Use **Pipeline** (deterministic, step-capped) when | Use **Agent Loop** (ReAct, model-directed) when |
|----|----|
| Output structure is known before execution | Model must decide which notes to read / how many steps based on what it finds |
| Every step maps to a registered action | Task needs conditional branching on intermediate results |
| Intent resolved unambiguously | Intent returned `open_ended` |

Examples: "Summarize this" / "Rewrite formally" / "Transcript → linked tasks" = **Pipeline**. "What did I write about pricing last month?" / "Find contradictions across my project notes" = **Agent Loop**.

Both buffer all writes and show **one** diff at the end. Pipeline: no model call between steps. Agent loop: ≤10 steps (hard client cap).

### 6.3 Client-Side ReAct Loop (`src/core/ai/AgentLoop.js` [CREATE])

```
runAgentLoop(query, context, ui, signal):
  messages = [{role:'user', content: query}]
  writeBuffer = []
  for step in 1..10:
    system = await contextAssembler.assemble({ instruction: AGENT_SYSTEM, ...context, maxTokens:16384 })
    tools  = [...AGENT_READ_TOOLS, ...actionRegistry.toToolSchema(), FINALIZE_TOOL]
    // ONE inference call to the stateless proxy:
    resp = await streamChat('/v1/chat', { messages, system, tools, stream:true }, { signal, onText: ui.onThought })
    messages.push({ role:'assistant', content: resp.content })
    toolUse = resp.content.find(b => b.type==='tool_use')
    if (!toolUse) { ui.onDiff({operations:writeBuffer, summary: resp.text}); break }
    ui.onToolCall(toolUse)
    if (toolUse.name === 'finalize') {
      if (toolUse.input.writes) writeBuffer.push(...toolUse.input.writes)
      ui.onDiff({ operations: writeBuffer, summary: toolUse.input.answer }); break
    }
    // READ TOOLS EXECUTE LOCALLY (no network, no proxy callback):
    result = await execLocalTool(toolUse.name, toolUse.input, context.workspacePath)
    ui.onToolResult({ ...toolUse, result, step })
    messages.push({ role:'user', content:[{ type:'tool_result', tool_use_id:toolUse.id, content: JSON.stringify(result) }] })
    if (step === 9) messages.push({ role:'user', content:'1 step left. Call finalize now.' })
```

**Local tool executor** maps to existing code (no invented tools):

| Agent tool | Local implementation |
|------------|----------------------|
| `read_note` | `invoke('read_file_content', { path })` |
| `search_notes` (was `search_vault`) | `invoke('search_in_files', { query, workspacePath, options })` |
| `get_note_backlinks` / graph | `getGraphIndex(workspacePath).getRelatedNotes(name,{depth:1})` |
| `list_notes` | `executeNoteTool('list_notes', …)` |
| `finalize` | client-only sentinel; flushes `writeBuffer` to diff-preview |

> **Correction:** tool names map to the **real** `notesTools` (`search_notes`, `get_note_backlinks`, `list_notes`, `read_note`), not invented `search_vault`/`get_graph_neighbors`.

### 6.4 Credit Reservation for the Loop (fixed)

Reserve **per step** at the model `max_tokens` ceiling, settle per step on the same `/v1/chat` reserve/reconcile path. **No single flat 10,000-credit upfront block** (which is exceedable and caused the all-or-nothing refund bug). On client abort (`AbortController` via Escape), the dropped connection's `signal` propagates to the proxy (`c.req.raw.signal`), which aborts the upstream provider call immediately, then the per-step reservation is settled to actual or swept within 15 min. **No double refund** — each step settles exactly once.

### 6.5 Streaming Contract (unified across all routes)

One SSE event shape everywhere (chat, intent, agent steps):
```
data: {"type":"text_delta","text":"…"}
data: {"type":"tool_use","id":"toolu_…","name":"…","input":{…}}
data: {"type":"usage","promptTokens":…,"completionTokens":…,"cacheReadTokens":…}
data: {"type":"done","credits":{"reserved":…,"actual":…,"balance_after":…}}
data: [DONE]
```
**Error frame (single shape):** `data: {"type":"error","code":"…","retryable":bool}` then `data: [DONE]`. **Clients MUST treat absence of a `type:"done"` frame as failure even on HTTP 200** (because streaming flushes 200 before the upstream call). A `: keepalive` comment ping every ~15s lets dead connections be detected and credits refunded.

### 6.6 Execution Boundary

| Concern | Runs on | Why |
|---------|---------|-----|
| Intent Tier 0/1 | client | 0 latency/cost |
| Intent Tier 2 + all inference | proxy `/v1/chat` | keys server-side; credit accounting |
| Context assembly (L1–L5) | client | local FS / GraphIndex |
| Read-tool execution | client | local FS only — proxy has no access |
| Write buffering + diff | client (ProseMirror) | editor state is in the webview |
| Credit ledger | Supabase RPC via proxy | single source of truth |
| Audit log | `.lokus/ai-audit.jsonl` (local) + `ai_audit_log` (cloud) | local-first ownership + ops dashboard |

---

## 7. The Surfaces

Same engine, different gesture. Shipping order is intentional: zero-cost surfaces first, the highest-leverage cloud surface (Cmd-K) next, the open-ended one (agent) last.

| Surface | Gesture | Role | Backend | Cost | Ships |
|---------|---------|------|---------|------|-------|
| **Ambient resurfacing** | none (auto) | hands back related notes as you write | GraphIndex → SQLite-vec | $0 | **P0** |
| **Inline slash `/`** | type `/` in editor | quick local transforms / inserts | Ollama (cloud if absent) | $0 / low | P1 |
| **Selection transform** | select → toolbar | rewrite/simplify/expand/tone | proxy (Sonnet) | medium | P1 |
| **Ghost text** | inline (opt-in, default OFF) | next-phrase suggestion | Ollama small (qwen3:1.7b) | $0 | P2 |
| **Cmd-K (PRIMARY)** | ⌘K → natural language | NL → chained actions / synthesis | IntentRouter → proxy | medium | **P0** |
| **Agent / chat panel** | side panel | multi-step research over vault | client ReAct → proxy steps | medium/high | **P4 (last)** |

Ghost text defaults OFF (privacy + flow). Ambient and Cmd-K are the two P0 surfaces that define the product.

---

## 8. Model Routing

### 8.1 ModelRouter (`src/core/ai/ModelRouter.js` [CREATE])

Decision table, evaluated per surface with a live `ollama_check` + cached capabilities + credit balance + tier:

| Surface | If Ollama running | Else |
|---------|-------------------|------|
| `embed` | Ollama `nomic-embed-text` ($0) | **skip** (never cloud-bill silently) |
| `ambient` / `ghost` | Ollama `qwen3:1.7b` ($0) | skip |
| `slash` | Ollama `qwen3:8b` ($0) | cloud if credits>0, else skip |
| `cmdK` / `agent` | cloud preferred if credits>100; else Ollama `qwen3:8b` | cloud if credits>100, else skip |
| `STT` | — | Deepgram via proxy (metered) |

Free-tier cloud = `claude-haiku`; Pro/Power = `claude-sonnet`. Fallback flag `fallbackToCloud` defaults **false** for ambient/ghost (never silently bill) and **true** for cmdK/agent (user opted in).

### 8.2 Ollama (`src-tauri/src/ollama.rs` [CREATE])

Commands: `ollama_check`, `ollama_list_models`, `ollama_pull_model`, `ollama_stream_request`, `ollama_embed`. `ollama_stream_request` emits the **same** `lokus:llm-chunk:{sessionId}` / `lokus:llm-done:{sessionId}` events as `llm_stream_request` (lib.rs:499), so the JS listener (the existing `_rustStream` at `ai-provider.js:164` already does listen/unlisten) is reused unchanged. No new crates — `reqwest` (json+stream) and `futures-util` already present. Gate with `#[cfg(not(any(target_os="ios",target_os="android")))]` (same block reqwest lives in, Cargo.toml:85–88), not generic `#[cfg(desktop)]`.

### 8.3 Embeddings & SQLite-vec (`src-tauri/src/embeddings.rs` [CREATE])

DB at `{workspace}/.lokus/embeddings.db`. **[PREREQUISITE]** add to `[dependencies]` (all platforms): `rusqlite = { version="0.31", features=["bundled"] }` + a verified vector crate. **Open item (§13):** confirm `sqlite-vec` crate + version + exact load path on crates.io before committing; if unavailable, fall back to a bundled `.dylib/.so/.dll` extension via `tauri.conf.json` resources, or a pure-Rust index (`usearch`/`hora`). The `sqlite_vec::*` helper names in early drafts are **unverified** and must be replaced with the published API.

Commands: `index_note_embedding`, `search_embeddings`. Generate-on-save via `src/core/ai/EmbeddingPipeline.js` [CREATE], 3s debounce (matches `SyncScheduler`), markdown-stripped text, fire-and-forget (embedding failure never surfaces a UI error). Background full-vault index on workspace open (50ms yield between notes).

### 8.4 ai-provider.js Rewrite (verified line numbers)

`src/services/ai-provider.js` is **789 lines**. `_rustStream` at **164**, `_proxyGenerate` at **219**, `_proxyStream` at **256**. Rewrite scope:
- Add `ollama`/`local` branch → `invoke('ollama_stream_request', …)`; add `embed(text)` → `invoke('ollama_embed', …)`.
- Rename `generateSummary`/`streamSummary` → `generate`/`stream` (keep old names as aliases for the meeting-summary UI).
- Point `mode:'lokus'` at the Hono proxy: change `_proxyGenerate`/`_proxyStream` URLs from the edge-fn path to `${VITE_PROXY_BASE_URL}/v1/chat`. The SSE parse loop is unchanged.
- Keep `llm_stream_request` (lib.rs:499) as the cloud BYOK path; add a guard so it only fires in BYOK mode (proxy mode never passes a provider key through it).

### 8.5 Apple Foundation Models (future epic — hard-gated out of P0–P3)

`objc2-foundation` (Cargo.toml:115) is NSString/NSArray plumbing, NOT inference. No `objc2-foundation-models` crate exists (May 2026). AFM requires a **Swift sidecar** (`lokus-afm`, same architecture as `lokus-stt`) + Unix-socket bridge — **~7.5 engineering days**. Keep `src-tauri/src/afm.rs` as compile-only stubs **not** registered in `generate_handler!` until the sidecar exists.

---

## 9. Safety, Data Model & Contracts

### 9.1 Diff-Preview / Confirm / Undo

> **Correction:** `prosemirror-suggestion-mode` and `prosemirror-changeset` are **NOT installed** (verified `package.json`). `tr.setMeta('suggestion', true)` is an invented API. Two valid paths:
> 1. **Ship-now (P0):** build diff-preview on **`prosemirror-history`** (already installed, line 145) + custom decorations: insert AI content, render a confirm bar, `Accept` commits, `Reject`/`Cmd-Z` undoes. No new dependency.
> 2. **Richer (P1+):** install a real tracked-changes package and use its actual plugin/decoration API.

`DiffPreview.js` [CREATE] exposes `previewWriteBuffer(view, ops)`, `acceptPreview(view)`, `rejectPreview(view)`. Every accept/reject appends a line to `.lokus/ai-audit.jsonl`.

### 9.2 Audit Log `.lokus/ai-audit.jsonl`

Append-only NDJSON, one object per line, written via `invoke('append_audit_log', …)` (new command in a Rust handler using `OpenOptions::append(true)`). Fields: `idempotency_key, ts, action_id, surface, provider, model, context_layers, tokens{prompt,completion}, credits{reserved,actual,delta,balance_after}, latency_ms, outcome, error?`. Rotated at 5MB; cleaned after 90 days.

> **Correction (privacy-critical):** `.lokus/ai-audit.jsonl` and `embeddings.db` are **NOT** currently excluded from cloud sync. `FileScanner.js` descends into `.lokus/` and only excludes `LOKUS_EXCLUDED_FILES = ['sync-cache.json','sync-id','offline-queue.json']` and dirs `['backups','temp','plugins','cache']`. **Add `'ai-audit.jsonl'`, `'embeddings.db'`, `'embeddings.db-wal'`, `'embeddings.db-shm'` to `LOKUS_EXCLUDED_FILES`** — otherwise a 150MB binary vector DB uploads on every sync and the audit log leaks to the cloud, breaking the local-first/no-telemetry promise.

### 9.3 Auth & Secrets

- **JWT verified locally at the proxy** via cached JWKS (or HS256 project secret) — verify signature + `exp` + `aud` in-process, cache `(userId,tier)` 60s by token hash; fall back to `getUser()` only on miss. This removes the per-request Supabase-Auth round-trip and the SPOF.
- Provider keys live only in `/opt/lokus-proxy/.env` (root-owned, `600`). **[PREREQUISITE]** implement `secure_store_set`/`secure_store_get` Rust commands backed by `keyring = "3.6"` (Cargo.toml:89) and register them. **Until then, the Supabase JWT falls back to localStorage** (verified comments at `ai-provider.js:711,771`); ops/security wording must say "localStorage fallback; secure_store is a required prerequisite," not "tokens live in secure storage."
- **Env var names match the codebase:** `LOKUS_DEEPGRAM_KEY` (existing, `transcribe/index.ts:252`) and `SUPABASE_SERVICE_ROLE_KEY` (existing, `llm-summary/index.ts:117`). Do **not** introduce `DEEPGRAM_API_KEY`/`SUPABASE_SERVICE_KEY`.
- **STT WS auth via ticket, not query string.** `GET /v1/transcribe/ticket` (Bearer JWT) issues a 30s one-time ticket; WS connects with it (or via `Sec-WebSocket-Protocol`). Auth is checked **in the upgrade handler before the upgrade completes**. JWT never appears in Caddy/proxy access logs.

### 9.4 Canonical Credit Ledger (one design — supersedes all three earlier schemas)

```sql
-- One lockable balance row (CHECK enforces floor)
CREATE TABLE public.user_credits (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- In-flight reserves (idempotency + sweep)
CREATE TABLE public.credit_reservations (
  reserve_id text PRIMARY KEY, user_id uuid NOT NULL, amount bigint NOT NULL,
  settled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
-- Append-only audit
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  delta bigint NOT NULL, kind text NOT NULL,  -- 'reserve'|'settle'|'refund'|'grant'
  reserve_id text, balance_after bigint, created_at timestamptz NOT NULL DEFAULT now()
);

-- reserve_credits: atomic floor-enforced deduction, idempotent, gates execution.
CREATE OR REPLACE FUNCTION public.reserve_credits(p_user_id uuid, p_amount bigint, p_reserve_id text)
RETURNS TABLE(ok boolean, balance_after bigint, replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal bigint;
BEGIN
  -- idempotency: prior key → replay (caller must NOT call provider again)
  IF EXISTS (SELECT 1 FROM credit_reservations WHERE reserve_id = p_reserve_id) THEN
    SELECT balance INTO v_bal FROM user_credits WHERE user_id = p_user_id;
    RETURN QUERY SELECT true, v_bal, true; RETURN;
  END IF;
  UPDATE user_credits SET balance = balance - p_amount, updated_at = now()
    WHERE user_id = p_user_id AND balance >= p_amount;   -- atomic floor check
  IF NOT FOUND THEN
    SELECT COALESCE((SELECT balance FROM user_credits WHERE user_id=p_user_id),0) INTO v_bal;
    RETURN QUERY SELECT false, v_bal, false; RETURN;
  END IF;
  INSERT INTO credit_reservations(reserve_id,user_id,amount) VALUES (p_reserve_id,p_user_id,p_amount);
  SELECT balance INTO v_bal FROM user_credits WHERE user_id = p_user_id;
  INSERT INTO credit_ledger(user_id,delta,kind,reserve_id,balance_after) VALUES (p_user_id,-p_amount,'reserve',p_reserve_id,v_bal);
  RETURN QUERY SELECT true, v_bal, false;
END; $$;

-- settle_credits: refund the unused part (actual ≤ reserved by over-reserve invariant).
CREATE OR REPLACE FUNCTION public.settle_credits(p_reserve_id text, p_actual bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res bigint; v_uid uuid; v_refund bigint; v_bal bigint;
BEGIN
  SELECT amount,user_id INTO v_res,v_uid FROM credit_reservations WHERE reserve_id=p_reserve_id AND settled=false;
  IF NOT FOUND THEN RETURN; END IF;
  v_refund := GREATEST(v_res - p_actual, 0);                -- never charge extra
  UPDATE user_credits SET balance = balance + v_refund, updated_at=now() WHERE user_id=v_uid RETURNING balance INTO v_bal;
  UPDATE credit_reservations SET settled=true WHERE reserve_id=p_reserve_id;
  INSERT INTO credit_ledger(user_id,delta,kind,reserve_id,balance_after) VALUES (v_uid,v_refund,'settle',p_reserve_id,v_bal);
END; $$;

-- refund_reservation: full refund on upstream failure / sweep.
CREATE OR REPLACE FUNCTION public.refund_reservation(p_reserve_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res bigint; v_uid uuid; v_bal bigint;
BEGIN
  SELECT amount,user_id INTO v_res,v_uid FROM credit_reservations WHERE reserve_id=p_reserve_id AND settled=false;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE user_credits SET balance = balance + v_res, updated_at=now() WHERE user_id=v_uid RETURNING balance INTO v_bal;
  UPDATE credit_reservations SET settled=true WHERE reserve_id=p_reserve_id;
  INSERT INTO credit_ledger(user_id,delta,kind,reserve_id,balance_after) VALUES (v_uid,v_res,'refund',p_reserve_id,v_bal);
END; $$;

-- Lock down: SECURITY DEFINER defaults to PUBLIC EXECUTE — revoke it.
REVOKE ALL ON FUNCTION public.reserve_credits(uuid,bigint,text)   FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.settle_credits(text,bigint)         FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.refund_reservation(text)            FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits(text,bigint)       TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_reservation(text)          TO service_role;

-- Sweep stranded reserves (pg_cron, every 5 min)
SELECT cron.schedule('sweep-reservations','*/5 * * * *',
  $$ SELECT public.refund_reservation(reserve_id) FROM public.credit_reservations
     WHERE settled=false AND created_at < now()-interval '15 minutes'; $$);
```

Only **three** RPC names exist: `reserve_credits` / `settle_credits` / `refund_reservation`. `deduct_credits`, `check_and_deduct_credits`, `reconcile_credits`, `adjust_credits`, the `credit_grants`/`credit_transactions`/`credit_balance` view design, and the advisory-lock cast hackery are all **deleted**. (Free-tier signup grant and Pro monthly grant insert into `user_credits.balance` + a `'grant'` ledger row; details in Doc 4.)

### 9.5 Missing Migration That Must Ship Regardless (verified production gap)

`ManifestManager.js:116` calls `supabase.rpc('update_manifest', {p_user_id,p_workspace_id,p_manifest,p_expected_version})` but **no migration** in `supabase/migrations/` defines `workspace_manifests` or `update_manifest` (only `meeting_usage`, `file_sync`, `workspace_registry`, `sync_fixes` exist). Ship `supabase/migrations/<ts>_workspace_manifests.sql`: the table (`user_id` unique, `manifest jsonb`, `manifest_version int`), the CAS RPC (matching that exact signature, returns boolean), RLS, and `service_role`-only EXECUTE.

### 9.6 ai_audit_log (one schema)

```sql
CREATE TABLE public.ai_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL, action_id text, surface text,
  provider text, model text,
  tokens_prompt int NOT NULL DEFAULT 0, tokens_completion int NOT NULL DEFAULT 0,
  credits_reserved int NOT NULL DEFAULT 0, credits_actual int NOT NULL DEFAULT 0,
  credits_delta int GENERATED ALWAYS AS (credits_reserved - credits_actual) STORED,
  outcome text NOT NULL DEFAULT 'success', error_code text, latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_audit_select_own ON public.ai_audit_log FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY ai_audit_insert_service ON public.ai_audit_log FOR INSERT TO service_role WITH CHECK (true);
```
A single `ai_audit_log` schema (the two divergent versions across earlier sections are unified here). Cost/usage dashboard views live in Doc 3.

### 9.7 STT & Embed Metering, CORS, Rate Limiting

- **STT metered:** reserve on WS open from declared max duration; settle on close from Deepgram-reported audio seconds (`cost_matrix.deepgram.second`). Hard-close at 2h; max concurrent WS per user. Batch `/v1/transcribe` reserves/settles likewise.
- **Embed:** local Ollama = $0, no reservation. Cloud `/v1/embed` fallback reserves/settles if ever used.
- **CORS in one place (Hono only).** Allow exactly `['tauri://localhost','https://tauri.localhost']` (real Tauri webview origins; plus `http://localhost:5173` for dev). **Remove `Access-Control-Allow-Origin` from the Caddyfile** to avoid duplicate/invalid headers. The `https://lokusmd.com` value would block the desktop client.
- **Rate limiting in one place (Redis, per-user keyed on JWT `sub`).** Tier limits documented in Doc 3. Cloudflare provides a separate edge per-IP limit. The in-memory Map limiter is deleted (resets on deploy = quota bypass).

### 9.8 Multi-Window

The existing cross-window mutex (`src/core/sync/SyncLock.js`, localStorage + heartbeat) is reused so concurrent windows don't double-run an agent loop or double-write a diff for the same note.

---

## 10. AI Feature Catalog

| Feature | Surface | Backend | Cost | Phase |
|---------|---------|---------|------|-------|
| Related-notes ambient panel | ambient | GraphIndex | $0 | P0 |
| Cmd-K: summarize / outline / explain | Cmd-K | proxy (Sonnet/Haiku) | medium | P0 |
| Cmd-K: NL → chained pipeline | Cmd-K | IntentRouter → actions | medium | P1 |
| Selection rewrite/simplify/expand/tone | selection | proxy | medium | P1 |
| Slash quick actions (local) | slash | Ollama | $0 | P1 |
| Semantic resurfacing (Layer B) | ambient | Ollama + SQLite-vec | $0 | P2 |
| Ghost text (opt-in) | inline | Ollama small | $0 | P2 |
| Agent: "find contradictions / what did I write about X" | panel | client ReAct → proxy | medium/high | P4 |
| Meeting transcript → summary (legacy, retained) | meeting | edge fn (transition) | metered | exists |
| STT (Deepgram, real-time + batch) | meeting | proxy WS | metered | P3 |

---

## 11. Build Roadmap

### P0 — Foundation + the two flagship surfaces
**Tasks:** ActionRegistry + ContextAssembler + ActionContextBuilder; `builtin-actions` (47) + `vault-actions` (10); Workspace.jsx wiring; ResurfacingEngine Layer A + AmbientNotesPanel; IntentRouter (Tier 0/1) + CmdKOrchestrator + Pipeline; `src/core/ai/proxyClient` → `/v1/chat`; Hono proxy skeleton (`/v1/chat`, `/v1/balance`, `/health`) with JWKS-cached auth; canonical credit ledger migration + `reserve/settle/refund` RPCs + sweep; **workspace_manifests migration**; FileScanner exclusions; DiffPreview on `prosemirror-history`.
**Acceptance:** ambient panel renders ≤50ms from real `getRelatedNotes`; Cmd-K "summarize this" streams from proxy, reserves→refunds correctly, balance updates, audit line written, Cmd-Z undoes; replayed idempotency key does **not** trigger a second provider call (verified via proxy log); `update_manifest` RPC resolves (sync no longer calls a missing RPC).

### P1 — Transforms, slash, pipelines
**Tasks:** `editor.rewrite` + selection toolbar; slash menu surface; IntentRouter Tier 2 (Haiku); multi-step Pipeline with single end-diff; OpenAI secondary + OpenRouter fallback in proxy.
**Acceptance:** select→rewrite shows diff, Accept replaces range; a 2-step pipeline ("format + add TOC") shows one diff; provider fallback fires on simulated Anthropic 5xx with no double-reserve.

### P2 — Local models + semantic resurfacing
**Tasks:** `ollama.rs` (check/list/pull/stream/embed); `embeddings.rs` + verified SQLite-vec crate; `EmbeddingPipeline` (on-save + background); ResurfacingEngine Layer B; ModelRouter; ghost text (opt-in); ai-provider.js rewrite.
**Acceptance:** with Ollama running, ambient merges semantic + graph results; embeddings never block save; `embeddings.db` is excluded from sync (verified no upload); ambient works offline.

### P3 — STT
**Tasks:** proxy `/v1/transcribe` + ticket + `/ws`; metered reserve/settle per audio-second; 2h cap + concurrency cap; migrate client WS URL to proxy.
**Acceptance:** real-time STT authed by ticket (no JWT in logs); reserve on open, settle on close from Deepgram seconds; over-2h stream hard-closes.

### P4 — Agent panel (last)
**Tasks:** client `AgentLoop` (≤10 steps, abort propagation); local tool executor mapping to real `notesTools`/`search_in_files`/GraphIndex; per-step reserve/settle; agent UI (thoughts/tool calls/diff).
**Acceptance:** "what did I write about pricing?" runs ≤10 client steps, reads notes locally, ends in one diff; client Escape aborts upstream within one step; each step settles exactly once (no double refund); proxy never calls back to client.

### Future epic — Apple Foundation Models (`afm.rs` sidecar). Hard-gated out of P0–P4.

---

## 12. Success Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Ambient adoption | 60% of 50+ note users interact weekly | `lokus:ambient-note-opened` events |
| Cmd-K adoption | 20% of Pro+ ≥2×/week | `ai_audit_log` |
| Cmd-K P95 latency | ≤2s to first SSE chunk | proxy logs |
| Credit correctness | 0 negative balances; 0 free-call exploits; <0.5% stranded >15min | `credit_ledger` + `credit_reservations` sweep stats |
| Avg Pro spend | ~150 credits/user/mo (~$0.18 proxy cost) | `ai_audit_log` aggregate |
| Privacy | 0 `ai-audit.jsonl`/`embeddings.db` uploads | sync manifest inspection |
| Retention lift | +15% 30-day for users with ≥1 AI action | cohort analysis |

---

## 13. Risks & Open Questions

| # | Risk / Open question | Mitigation / Decision needed |
|---|----------------------|------------------------------|
| R1 | **SQLite-vec crate availability** unconfirmed; helper API names (`sqlite_vec::float32_to_blob`, `F32_BLOB(768)`) unverified | Before P2: confirm crate+version+load path on crates.io; else bundle the C extension via `tauri.conf.json` resources or use `usearch`/`hora`. Block P2 on this. |
| R2 | **`secure_store_*` unimplemented** → JWT currently in localStorage | P0 prerequisite: implement via `keyring 3.6` and register; until then, document the localStorage fallback honestly. |
| R3 | **Diff-preview package** not installed | Ship P0 on `prosemirror-history` + decorations; defer tracked-changes package to P1+. |
| R4 | **Model IDs / cache pricing** (`claude-*-20250514`, `prompt-caching` beta header, 10%/125% cache math) may drift | Validate against live Anthropic API at proxy build time; centralize in proxy `COST` + config. |
| R5 | **Greenfield proxy** — no `proxy/` tree, package.json, lockfile yet | Doc 3 ships the full tree with pinned Bun version + lockfile listing `hono`, `@anthropic-ai/sdk`, `openai`, `@supabase/supabase-js`, `ioredis`. |
| R6 | **Secret blast radius** — deploy user in docker group can `docker inspect` keys | Separate deploy identity from key access; consider Docker secrets / SOPS-age (Doc 3). |
| R7 | **AFM** has no Rust bindings | Future epic only; stubs not registered. |
| R8 | **Estimate accuracy** for over-reserve depends on knowing input tokens pre-call | Count input tokens with the provider tokenizer (or `chars/4` upper bound) + `max_tokens` ceiling; always round up. |
| R9 | Migration filename/date collisions across early drafts | Single migration series authored fresh in Doc 3; this doc defines object names, Doc 3 owns timestamps. |

---

## Appendix: Codebase Anchors (verified at `fix-sync` HEAD)

| Anchor | Path:Line | Note |
|--------|-----------|------|
| CommandRegistry (clone source) | `src/plugins/registry/CommandRegistry.js` | EventEmitter + Map; ActionRegistry is a superset |
| EventEmitter base | `src/utils/EventEmitter.js` | shared base class |
| ACTIONS catalog | `src/core/shortcuts/registry.js` | **47** entries (`grep -c "id:"`) |
| MCP notes tools | `src/mcp-server/tools/notes.js` | 10 tools; `executeNoteTool`; `search_notes`/`get_note_backlinks` real names |
| GraphIndex | `src/mcp-server/utils/graphIndex.js` | `getRelatedNotes(name,{depth,direction})` → `{found,related:[{id,name,path,depth,direction,connections}]}` |
| EditorAPI | `src/plugins/api/EditorAPI.js` | `getContent()`, `replaceText()`, `notifyUpdate()` |
| Markdown pipeline | `src/core/markdown/lokus-md-pipeline.js` | `createLokusSerializer()` |
| ai-provider.js | `src/services/ai-provider.js` | **789 lines**; `_rustStream`:164, `_proxyGenerate`:219, `_proxyStream`:256; `secure_store_*` fallback at 711/771 |
| Cloud LLM (Rust) | `src-tauri/src/lib.rs:499` | `llm_stream_request` — plain strings, no tools, stays for BYOK |
| Search (Rust) | `src-tauri/src/search.rs` | `search_in_files`; result field serde-renamed to `match` |
| STT (Rust) | `src-tauri/src/transcription.rs` | Deepgram cloud WS; pattern for `ollama.rs` streaming |
| Local API server | `src-tauri/src/api_server.rs:345` | binds **127.0.0.1** only (proxy cannot call back — agent loop is client-side) |
| keyring crate | `src-tauri/Cargo.toml:89` | `keyring = "3.6"` for `secure_store_*` |
| objc2-foundation | `src-tauri/Cargo.toml:115` | NSString plumbing, NOT FoundationModels |
| reqwest target block | `src-tauri/Cargo.toml:85-88` | gate `ollama_*` here, not `#[cfg(desktop)]` |
| FileScanner exclusions | `src/core/sync/FileScanner.js:5-6` | add `ai-audit.jsonl` + `embeddings.db*` to `LOKUS_EXCLUDED_FILES` |
| ManifestManager RPC call | `src/core/sync/ManifestManager.js:116` | `update_manifest` — **no migration exists**; ship it |
| SyncLock | `src/core/sync/SyncLock.js` | cross-window mutex reused for AI safety |
| prosemirror-history | `package.json:145` | present; basis for diff-preview undo |
| Existing migrations | `supabase/migrations/` | only `meeting_usage`, `file_sync`, `workspace_registry`, `sync_fixes` |
| Legacy edge fn | `supabase/functions/llm-summary/index.ts` | `X-Accel-Buffering` at 411/483; `SUPABASE_SERVICE_ROLE_KEY` at 117; retained for meeting summaries |
| Legacy STT edge fn | `supabase/functions/transcribe/index.ts:252` | env var is `LOKUS_DEEPGRAM_KEY` |
