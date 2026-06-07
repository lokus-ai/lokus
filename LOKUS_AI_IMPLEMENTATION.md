# Lokus AI — Implementation & Operations

> **Doc 4 of 4** — companion to `LOKUS_AI_PRD.md` (aim/engine/agent-loop — see its §6), `LOKUS_DIFFERENTIATION.md` (vision/moat), and `LOKUS_MONETIZATION_PRD.md` (pricing/credits).
>
> This is the **"how we actually build, host, and run it"** document. Every config below is copy-pasteable. Every claim is grounded in the real repository at `/Users/pratham/Programming/Lokus/lokus`. Where a section corrects an earlier draft, the correction is called out inline as **[FIX]** so the builder knows it supersedes anything contradictory in the other docs.
>
> **Assumed server:** generic Ubuntu 24.04 + Docker. Domain is `lokusmd.com` (existing infra already runs `config.lokusmd.com`, `crash.lokusmd.com`). The proxy lives at `api.lokusmd.com`. Adjust the domain and the VPS provider's snapshot tooling for your environment; everything else is portable.

---

## 0. Canonical Decisions (read this first — it resolves all cross-doc conflicts)

The three earlier drafts each sketched a slightly different credit ledger, route map, rate-limiter, and env-var set. This document is **authoritative**. Where it disagrees with another doc, this wins. The unifying decisions:

| Concern | **Canonical decision** | Supersedes |
|---|---|---|
| **Credit ledger** | One mutable balance row `user_credits(user_id PK, balance bigint CHECK(balance>=0))` + append-only `credit_ledger` audit table + `credit_reservations(reserve_id PK, …, settled bool)`. Row-level `FOR UPDATE` lock on `user_credits` is the serialization primitive. | The append-only `credit_grants`+`credit_transactions`+`credit_balance`-view design (race-prone: you cannot `FOR UPDATE` an aggregating view). |
| **Credit RPCs** | Exactly three: `reserve_credits(p_user_id, p_amount, p_reserve_id)`, `settle_credits(p_reserve_id, p_actual_amount)`, `refund_reservation(p_reserve_id)`. | `deduct_credits`, `check_and_deduct_credits`, `reconcile_credits`, `adjust_credits` — all removed. |
| **Reservation policy** | **Over-reserve to the model's `max_tokens` ceiling.** Reconcile only ever *refunds*, never charges more. Eliminates the negative-balance bug class. | The 25%-of-input estimate that under-reserves. |
| **Idempotency key** | **Server-derived** on the proxy: `sha256(user_id + ':' + sha256(body) + ':' + minute_bucket)`. The LLM call is gated on a fresh `INSERT … ON CONFLICT DO NOTHING` into `credit_reservations`. A replayed key returns the cached result and **does not** call the provider. | Client-chosen `X-Idempotency-Key` trusted verbatim (free-call exploit). |
| **Route map** | `POST /v1/chat` (streaming inference + tool calls), `POST /v1/embed` (cloud fallback only), `POST /v1/transcribe` (batch STT), `POST /v1/transcribe/ticket` + `GET /v1/transcribe/ws` (streaming STT), `GET /v1/balance`, `GET /health`. **There is no `/v1/actions`, `/v1/agent`, or `/v1/intent`.** | The agent/intent routes — the ReAct loop runs **client-side** (see §2.6 and the rewritten loop doc); the proxy only does per-call inference. |
| **Agent loop location** | **Client.** Tauri/React assembles context locally, runs the ReAct loop, executes read-tools against the local filesystem, and calls `POST /v1/chat` once per model step. The proxy never holds a write buffer and never calls back to the client. | The proxy-resident loop with an `http://localhost:{port}/tool-exec` back-channel — **architecturally impossible** (`api_server.rs:345` binds `127.0.0.1` only; a remote server cannot reach it without exposing the user's notes to the network). |
| **Rate limit** | **Redis-backed, per-user (JWT `sub`), in Hono middleware only.** Cloudflare provides a separate per-IP edge limit. | In-memory per-instance Maps (reset on every deploy) and the conflicting 20/60/200 vs 30/IP vs 100/user numbers. |
| **Idempotency store** | **Redis** (`SET reserve:{key} … NX EX 900`) — survives deploys. | In-memory Map. |
| **JWT validation** | **Local signature verification** against Supabase JWKS (cached 1h) + 60s decoded-token cache keyed by token hash. `getUser()` only on cache miss. | A `supabase.auth.getUser()` network call on every request (latency + Supabase-Auth SPOF). |
| **Env var names** | `LOKUS_DEEPGRAM_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (match the existing edge functions — verified `transcribe/index.ts:252`, `llm-summary/index.ts:117`). | `DEEPGRAM_API_KEY`, `SUPABASE_SERVICE_KEY`. |
| **CORS** | Owned **only** by Hono. Allowed origins: `tauri://localhost`, `https://tauri.localhost`. The Caddyfile sets **no** `Access-Control-Allow-Origin`. | Double CORS headers (Caddy `https://lokusmd.com` + Hono Tauri origins → invalid, browsers reject). |
| **Local AI files** | `ai-audit.jsonl`, `embeddings.db`, `embeddings.db-wal`, `embeddings.db-shm` added to `FileScanner.LOKUS_EXCLUDED_FILES`. Never synced to cloud. | The false claim that the `.lokus/` prefix already excludes them (verified: `FileScanner` descends into `.lokus/`). |
| **SSE terminal frame** | Every streaming route ends with a single `data: {"type":"done", …}` then `data: [DONE]`. Errors: `data: {"type":"error","code":…,"retryable":bool}` then `data: [DONE]`. Clients **must** treat the absence of a `type:"done"` frame as failure regardless of HTTP 200. | Mixed `event: error` named-event vs in-band `{type:'error'}` shapes. |

These are firm. The rest of the document elaborates them.

---

## 1. Deployment Topology (the whole system, where each piece runs)

```
                                  Internet
                                     │
                       ┌─────────────▼──────────────┐
                       │  Cloudflare (DNS + proxy)   │
                       │  api.lokusmd.com → VPS IP   │
                       │  · L3/4 DDoS, Bot Fight      │
                       │  · per-IP rate limit (edge)  │
                       │  · WAF: block /v1/* w/o Bearer│
                       └─────────────┬──────────────┘
                                     │  HTTPS / WSS (443)  — Cloudflare IPs only (ufw)
                       ┌─────────────▼──────────────┐
                       │      Ubuntu 24.04 VPS       │
                       │                             │
                       │  ┌───────────────────────┐  │
                       │  │  Caddy (443/80)        │  │  auto-TLS (Let's Encrypt)
                       │  │  flush_interval -1 (SSE)│  │
                       │  └──────────┬────────────┘  │
                       │             │ :3000 (docker bridge, not host-published)
                       │  ┌──────────▼────────────┐  │
                       │  │  lokus-proxy (Hono/Bun)│  │  · JWT verify (local JWKS)
                       │  │  · reserve→stream→settle│  │  · provider abstraction
                       │  │  · SIGTERM drain        │  │  · ALL provider keys here only
                       │  └──────┬───────┬─────────┘  │
                       │         │       │            │
                       │  ┌──────▼──┐ ┌──▼──────────┐ │
                       │  │ Redis   │ │ Ollama       │ │  (Ollama optional, local embeds)
                       │  │ rate-lim│ │ :11434       │ │
                       │  │ idem    │ │ nomic-embed  │ │
                       │  └─────────┘ └──────────────┘ │
                       └─────────────┬───────────────┘
                                     │
              ┌──────────────────────┼───────────────────────┐
              │                      │                        │
     ┌────────▼────────┐   ┌─────────▼────────┐    ┌──────────▼────────┐
     │  Supabase        │   │  Anthropic        │    │  Deepgram          │
     │  · Auth (JWKS)   │   │  api.anthropic.com│    │  api.deepgram.com  │
     │  · Postgres      │   │  (primary)        │    │  (STT)             │
     │    user_credits  │   └───────────────────┘    └────────────────────┘
     │    credit_ledger │   ┌───────────────────┐
     │    credit_resv'ns│   │  OpenAI           │
     │    ai_audit_log  │   │  api.openai.com   │
     │    workspace_man.│   │  (secondary)      │
     └──────────────────┘   └───────────────────┘

  ┌───────────────────────────────────────────────────────────────────────────┐
  │  TAURI DESKTOP CLIENT (local-first; the brain of the agent loop lives here)  │
  │  · React 19 + raw ProseMirror                                               │
  │  · ActionRegistry / ContextAssembler / ResurfacingEngine (client-side)      │
  │  · ReAct agent loop runs HERE; read-tools hit local FS via existing cmds    │
  │  · Ollama (if installed locally) for $0 embeds/ghost; else proxy /v1/embed  │
  │  · SQLite-vec at .lokus/embeddings.db (NEVER synced)                        │
  │  · Supabase JWT in keyring (secure_store_*, to be implemented) — POSTed to  │
  │    proxy as `Authorization: Bearer`. Provider keys NEVER on client.         │
  │  · .lokus/ai-audit.jsonl local audit mirror (NEVER synced)                  │
  └───────────────────────────────────────────────────────────────────────────┘
```

**Trust boundaries, stated explicitly:**

1. **Provider keys** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `LOKUS_DEEPGRAM_KEY`) and the **Supabase service-role key** live **only** in `/opt/lokus-proxy/.env` on the VPS. They are absent from the Tauri binary, the React bundle, and every Git commit.
2. The **client holds only the user's Supabase JWT** (a short-lived, user-scoped token). It is sent to the proxy on every request. **[FIX]** Today this JWT lives in plaintext `localStorage` because `secure_store_set`/`secure_store_get` are **unimplemented** (verified: `ai-provider.js:709,768` call them inside try/catch with `// not yet implemented — fall back to localStorage`). Implementing keyring-backed secure storage (the `keyring 3.6` crate is already in `Cargo.toml:89`) is a **hard prerequisite** before the AI surface ships. See §8.1.
3. The **agent loop's read-tools** (read note, search, graph neighbors) run on the **client** against the local filesystem using commands that already exist. The proxy never sees the vault contents except as pre-assembled context text the client chooses to send.

**Existing infra the AI work integrates with (verified):**

- `src/core/auth/supabase.js` already reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. We add one build-time var: `VITE_PROXY_BASE_URL=https://api.lokusmd.com`. Non-secret; embedded in the Vite bundle.
- `src-tauri/src/lib.rs:499` `llm_stream_request` (cloud streaming, plain strings) and `lib.rs:433` `validate_api_key` (BYOK settings) **remain** for the BYOK path. The proxy path does **not** route through them — the JS `_proxyStream` (`ai-provider.js:256`) calls the proxy URL directly.
- `supabase/functions/llm-summary/` and `supabase/functions/transcribe/` (Deno edge functions) remain live during migration. The proxy reuses their request/response logic, ported to Hono. Cut-over is a single env-var flip (§5.6).

---

## 2. The Proxy — Design (modules, provider abstraction, prompt caching)

### 2.1 Greenfield directory tree

**[FIX]** The proxy does not exist yet. The entire `proxy/` tree is created from scratch with a pinned lockfile so builds are reproducible.

```
proxy/
├── package.json
├── bun.lockb                       # committed — reproducible deps
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                    # Hono app, route mounting, SIGTERM drain
│   ├── config.ts                   # env validation (real var names)
│   ├── middleware/
│   │   ├── auth.ts                 # local JWKS verify + 60s token cache
│   │   ├── rate-limit.ts           # Redis per-user sliding window
│   │   ├── idempotency.ts          # Redis NX (reserve gate lives in credit svc)
│   │   └── logger.ts               # one JSON line per request
│   ├── routes/
│   │   ├── chat.ts                 # POST /v1/chat  (SSE inference + tools)
│   │   ├── embed.ts                # POST /v1/embed (cloud fallback; $0 local)
│   │   ├── transcribe.ts           # POST /v1/transcribe + /ticket + GET /ws
│   │   └── balance.ts              # GET /v1/balance
│   ├── providers/
│   │   ├── interface.ts            # IProvider + StreamEvent
│   │   ├── anthropic.ts            # @anthropic-ai/sdk adapter (+ prompt cache)
│   │   ├── openai.ts               # openai adapter
│   │   └── ollama.ts               # local embed/chat (server-side Ollama)
│   ├── services/
│   │   ├── credit.ts               # reserve / settle / refund (3 RPCs only)
│   │   ├── router.ts               # tier→model/provider selection
│   │   └── audit.ts                # fire-and-forget ai_audit_log insert
│   └── lib/
│       ├── supabase.ts             # service-role admin client (RPCs only)
│       ├── redis.ts                # ioredis singleton
│       ├── jwks.ts                 # cached JWKS fetch + jose verify
│       └── errors.ts              # ProxyError + canonical codes
```

**Runtime: Bun 1.1.x** (native `fetch`, native TS, fast cold start). Node 22 fallback = change only the Dockerfile `CMD`. The `package.json` pins:

```json
{
  "name": "lokus-proxy",
  "private": true,
  "type": "module",
  "scripts": { "start": "bun run src/index.ts", "dev": "bun --watch run src/index.ts" },
  "dependencies": {
    "hono": "4.6.14",
    "@anthropic-ai/sdk": "0.32.1",
    "openai": "4.77.0",
    "@supabase/supabase-js": "2.47.10",
    "ioredis": "5.4.2",
    "jose": "5.9.6"
  }
}
```

> Version pins are starting points. **Validate at build time:** the Anthropic prompt-caching beta header (`prompt-caching-2024-07-31`) and cache pricing math (cache read ≈ 0.1× input, cache write ≈ 1.25× input) are assumptions — confirm against the live Anthropic docs when you `bun install`, and update §2.5 if the SDK has folded caching into stable.

### 2.2 Config & env validation

`config.ts` fails fast on startup if a required key is missing. **[FIX]** Uses the **real** env var names.

```typescript
// proxy/src/config.ts
interface Cfg {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  LOKUS_DEEPGRAM_KEY: string;          // [FIX] matches transcribe/index.ts:252
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;   // [FIX] matches llm-summary/index.ts:117
  SUPABASE_JWT_ISSUER: string;         // "<SUPABASE_URL>/auth/v1"
  REDIS_URL: string;
  OLLAMA_BASE_URL: string;
  OPENROUTER_API_KEY?: string;         // optional fallback
  PORT: number;
}
let _cfg: Cfg | null = null;
export function getCfg(): Cfg { if (!_cfg) throw new Error("validateConfig() not called"); return _cfg; }
export function validateConfig(): void {
  const required = [
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "LOKUS_DEEPGRAM_KEY",
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REDIS_URL",
  ] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
  _cfg = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    LOKUS_DEEPGRAM_KEY: process.env.LOKUS_DEEPGRAM_KEY!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    SUPABASE_JWT_ISSUER: `${process.env.SUPABASE_URL}/auth/v1`,
    REDIS_URL: process.env.REDIS_URL ?? "redis://lokus-redis:6379",
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? "http://lokus-ollama:11434",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    PORT: Number(process.env.PORT ?? 3000),
  };
}
```

### 2.3 Provider abstraction (`IProvider`)

One interface, three adapters. The client always sends the **same** request shape; the adapter normalizes provider quirks into a single `StreamEvent` union.

```typescript
// proxy/src/providers/interface.ts
export interface Message { role: "user" | "assistant" | "tool"; content: string | ContentBlock[]; }
export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string; id?: string; name?: string; input?: unknown;
  tool_use_id?: string; content?: string; is_error?: boolean;
}
export interface Tool {
  name: string; description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}
export interface CompleteOptions {
  model: string; messages: Message[]; system?: string; tools?: Tool[];
  max_tokens: number; signal: AbortSignal;          // [FIX] always propagate cancellation
}
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "usage"; promptTokens: number; completionTokens: number;
      cacheReadTokens?: number; cacheCreationTokens?: number }
  | { type: "message_stop" };
export interface IProvider {
  complete(opts: CompleteOptions): Promise<{ stream(): AsyncIterable<StreamEvent> }>;
  embed?(texts: string[]): Promise<number[][]>;
}
```

The Anthropic adapter (cache-aware) and OpenAI adapter (fragmented-tool-call reassembly) follow the streaming-normalization logic detailed in the proxy-design draft; the only mandatory change here is **`signal` is threaded into both** `this.client.messages.stream({…}, { signal })` and `this.client.chat.completions.create({…, signal })` so a dropped client connection cancels the upstream call and stops burning credits.

**Normalization table** (the contract every adapter satisfies):

| Concept | Anthropic raw | OpenAI raw | `StreamEvent` |
|---|---|---|---|
| Text | `content_block_delta`/`text_delta` | `choices[0].delta.content` | `text_delta` |
| Tool call | `content_block_start` `tool_use` + `input_json_delta` | `delta.tool_calls[i]` (fragmented) | accumulate → `tool_use` |
| Usage | `message_start.usage` + `message_delta.usage` | final chunk `usage` (needs `stream_options.include_usage`) | `usage` |
| Cache | `usage.cache_read_input_tokens` | n/a | `usage.cacheReadTokens` |
| End | `message_stop` | `finish_reason` | `message_stop` |

### 2.4 Provider selection & fallback (`router.ts`)

```typescript
export function selectProvider(tier: "free" | "pro" | "power", requested?: string):
  { provider: "anthropic" | "openai"; model: string } {
  if (tier === "free") return { provider: "anthropic", model: "claude-haiku-4-20250514" };
  const ALLOWED: Record<string, "anthropic" | "openai"> = {
    "claude-haiku-4-20250514": "anthropic",
    "claude-sonnet-4-20250514": "anthropic",
    "gpt-4o-mini": "openai",
    "gpt-4o": "openai",
  };
  if (requested && ALLOWED[requested]) return { provider: ALLOWED[requested], model: requested };
  return { provider: "anthropic", model: "claude-sonnet-4-20250514" };
}
```

> Model IDs `claude-haiku-4-20250514` / `claude-sonnet-4-20250514` match the existing `llm-summary/index.ts:67-69`, so they are correct today. Treat them as config, not constants — pin them in `router.ts` and bump in one place when Anthropic rotates snapshots.

**Fallback:** if the primary (Anthropic) returns 5xx **before the first byte is streamed to the client**, the chat route retries once on OpenAI `gpt-4o` using the *same* reservation (no second reserve). Once SSE streaming has begun, no fallback — the client reconnects with a fresh idempotency-eligible request.

### 2.5 Prompt caching (Anthropic `cache_control`)

The client's `ContextAssembler` inserts a literal marker `\n\n---CACHE_BOUNDARY---\n\n` between the **stable prefix** (L1 system instruction + L2 open-note body) and the **dynamic suffix** (L3 selection, L4 search, L5 graph, L6 agent obs). The Anthropic adapter splits on it and marks the first block `cache_control: { type: "ephemeral" }`. Cache-read tokens are billed at ~10% of input in `settle`, but **[FIX]** because we over-reserve to `max_tokens` (§3.3), caching only ever makes the **refund larger** — it never risks an under-reservation.

### 2.6 What the proxy is NOT

**[FIX]** The proxy is **stateless per request** and does **not**:
- run the ReAct agent loop,
- hold a write buffer,
- call back to the client,
- expose `/v1/agent`, `/v1/intent`, or `/v1/actions`.

The client owns the loop: it assembles context (L1–L6) locally, calls `POST /v1/chat` with `{messages, tools, system}`, receives a `tool_use` block, executes read-tools **locally** (`read_file_content`, `search_in_files`, `getGraphIndex(window.__WORKSPACE_PATH__).getRelatedNotes(name, {depth:1, direction:'both'})` — note the real method returns `{found, related:[{id,name,path,depth,direction,connections}]}`, and the node field is `incomingLinks`, **not** `backlinks`), appends a `tool_result`, and loops. Each model step is one `/v1/chat` call with its own reservation. This makes credit accounting natural (reserve per step, not one unknowable 10k upfront) and keeps the vault on-device.

Agent read-tool names map to the **real** MCP tools in `src/mcp-server/tools/notes.js`: `list_notes`, `read_note`, `search_notes` (← "search_vault"), `get_note_backlinks`/`get_note_links` (← "get_graph_neighbors"). There is no `search_vault` or `finalize` tool in the codebase; the loop's "finalize" is a client-side state, not a server tool.

---

## 3. The Proxy — Request Lifecycle (JWT → rate-limit → reserve → stream → reconcile)

### 3.1 Sequence diagram (streaming chat)

```
Client                 Proxy                     Redis        Supabase(PG)      Anthropic
  │                      │                          │              │               │
  │─POST /v1/chat───────►│                          │              │               │
  │  Bearer <JWT>        │                          │              │               │
  │  {messages,tools,    │                          │              │               │
  │   system,max_tokens} │                          │              │               │
  │                      │─verify JWT locally───────┤ (JWKS cached)│               │
  │                      │  (60s token cache)       │              │               │
  │                      │─rate-limit (per-user)───►│ ZADD/ZCARD   │               │
  │                      │  429 if over             │              │               │
  │                      │                          │              │               │
  │                      │─derive reserveId =       │              │               │
  │                      │  sha256(uid:body:minute) │              │               │
  │                      │─SET reserve:{id} NX EX900┤              │               │
  │                      │  (idempotency gate)      │              │               │
  │                      │   ├ already set ─► replay cached result, NO provider call
  │                      │   └ fresh ─► continue    │              │               │
  │                      │                          │              │               │
  │                      │─reserve_credits(uid,     │              │               │
  │                      │   max_tokens_cost, id)───┼─────────────►│ FOR UPDATE    │
  │                      │  402 if insufficient     │              │ balance>=cost │
  │                      │◄─────────────────────────┼──────────────│ ok,balance    │
  │◄─200 text/event-stream│ (headers flushed now)   │              │               │
  │                      │─complete({…, signal})────┼──────────────┼──────────────►│
  │◄─data:{text_delta}───│◄─SSE chunk───────────────┼──────────────┼───────────────│
  │◄─data:{text_delta}───│◄─SSE chunk               │              │               │
  │◄─data:{tool_use}─────│◄─tool_use block          │              │               │
  │◄─data:{type:done,…}──│◄─usage (prompt,compl)    │              │               │
  │◄─data:[DONE]─────────│                          │              │               │
  │                      │─settle_credits(id,actual)┼─────────────►│ FOR UPDATE    │
  │                      │  (refund max-actual)     │              │ balance+=delta│
  │                      │─audit insert (f&f)───────┼─────────────►│ ai_audit_log  │
  │                      │─SET reserve:{id} = result│ (cache replay)│              │
```

### 3.2 Local JWT verification (`auth.ts`)

**[FIX]** No `getUser()` on the hot path. Verify the HS256/RS256 signature locally with `jose`, cache the decoded `{userId, tier}` for 60s keyed by a hash of the token.

```typescript
// proxy/src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { getCfg } from "../config.js";
import { getSupa } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { createHash } from "node:crypto";

const cfg = () => getCfg();
const JWKS = createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export const authMiddleware = createMiddleware(async (c, next) => {
  const h = c.req.header("Authorization");
  if (!h?.startsWith("Bearer ")) return c.json({ error: { code: "UNAUTHORIZED" } }, 401);
  const jwt = h.slice(7);
  const tokenHash = createHash("sha256").update(jwt).digest("hex");

  // 60s decoded-token cache
  const cached = await getRedis().get(`tok:${tokenHash}`);
  if (cached) { const { userId, tier } = JSON.parse(cached); c.set("userId", userId); c.set("tier", tier); return next(); }

  let userId: string;
  try {
    const { payload } = await jwtVerify(jwt, JWKS, { issuer: cfg().SUPABASE_JWT_ISSUER });
    if (!payload.sub) throw new Error("no sub");
    userId = payload.sub;
  } catch { return c.json({ error: { code: "INVALID_TOKEN" } }, 401); }

  // tier lookup — only on cache miss
  const { data } = await getSupa().from("user_tiers").select("tier").eq("user_id", userId).maybeSingle();
  const tier = (data?.tier as "free" | "pro" | "power") ?? "free";

  await getRedis().set(`tok:${tokenHash}`, JSON.stringify({ userId, tier }), "EX", 60);
  c.set("userId", userId); c.set("tier", tier);
  await next();
});
```

> Supabase issues HS256 tokens with the project JWT secret by default and RS256/JWKS on newer projects. If your project is HS256, replace `createRemoteJWKSet` with a `TextEncoder` over `SUPABASE_JWT_SECRET` and use `jwtVerify(jwt, secret, …)`. Confirm which your project uses before shipping.

### 3.3 Reservation: over-reserve, idempotent, row-locked

**[FIX]** Reserve at the **`max_tokens` ceiling** so reconcile only refunds. The reservation is gated on a fresh Redis `NX` insert — a replayed key never calls the provider.

```typescript
// proxy/src/services/credit.ts
import { getSupa } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { createHash } from "node:crypto";

// credits per 1k tokens — single source of truth (mirror in client UI via /v1/balance)
const COST = {
  "claude-haiku-4-20250514":  { input: 0.25, output: 1.25 },
  "claude-sonnet-4-20250514": { input: 3.0,  output: 15.0 },
  "gpt-4o-mini":              { input: 0.15, output: 0.6  },
  "gpt-4o":                   { input: 5.0,  output: 15.0 },
} as const;

export function deriveReserveId(userId: string, body: string): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  return createHash("sha256").update(`${userId}:${createHash("sha256").update(body).digest("hex")}:${minuteBucket}`).digest("hex");
}

// Over-reserve: measured input + FULL max_tokens output. Reconcile only refunds.
export function reserveAmount(model: string, inputTokens: number, maxTokens: number): number {
  const r = COST[model as keyof typeof COST] ?? COST["claude-sonnet-4-20250514"];
  return Math.ceil((inputTokens * r.input + maxTokens * r.output) / 1000) + 5;
}
export function actualAmount(model: string, pt: number, ct: number, cacheRead = 0): number {
  const r = COST[model as keyof typeof COST] ?? COST["claude-sonnet-4-20250514"];
  const normalIn = (pt - cacheRead) * r.input + cacheRead * r.input * 0.1;
  return Math.ceil((normalIn + ct * r.output) / 1000);
}

/** Returns { proceed:boolean, replay?:string, ok?:boolean, balance?:number } */
export async function reserve(userId: string, reserveId: string, amount: number, model: string, provider: string) {
  // Idempotency gate: NX. If the key exists, replay (no provider call).
  const fresh = await getRedis().set(`reserve:${reserveId}`, "pending", "NX", "EX", 900);
  if (fresh === null) {
    const done = await getRedis().get(`result:${reserveId}`);
    return { proceed: false, replay: done ?? null };          // replay cached SSE summary or null (in-flight)
  }
  const { data, error } = await getSupa().rpc("reserve_credits", {
    p_user_id: userId, p_amount: amount, p_reserve_id: reserveId,
  });
  if (error) throw new Error(`reserve_credits: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { proceed: true, ok: row.ok as boolean, balance: Number(row.balance_after) };
}

export async function settle(reserveId: string, actual: number): Promise<void> {
  // fire-and-forget; the sweeper (§5.4) recovers if this fails
  getSupa().rpc("settle_credits", { p_reserve_id: reserveId, p_actual_amount: actual })
    .then(({ error }) => { if (error) console.error("[credit] settle failed", reserveId, error); });
}
export async function refund(reserveId: string): Promise<void> {
  getSupa().rpc("refund_reservation", { p_reserve_id: reserveId })
    .then(({ error }) => { if (error) console.error("[credit] refund failed", reserveId, error); });
}
```

### 3.4 The chat route (full, with every failure mode)

```typescript
// proxy/src/routes/chat.ts
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { selectProvider } from "../services/router.js";
import * as credit from "../services/credit.js";
import { writeAudit } from "../services/audit.js";
import { getAnthropic, getOpenAI } from "../providers/index.js";
import { getRedis } from "../lib/redis.js";

const chat = new Hono();
chat.use("*", authMiddleware, rateLimit);

chat.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const tier = c.get("tier") as "free" | "pro" | "power";
  const raw = await c.req.text();                                   // exact bytes for reserveId
  const body = JSON.parse(raw);
  const maxTokens = Math.min(body.max_tokens ?? 4096, 8192);
  const { provider, model } = selectProvider(tier, body.model);

  // estimate input tokens (coarse; only affects reserve size, which over-reserves anyway)
  const inputTokens = Math.ceil(JSON.stringify(body.messages).length / 4);
  const reserveAmt = credit.reserveAmount(model, inputTokens, maxTokens);
  const reserveId = credit.deriveReserveId(userId, raw);

  const r = await credit.reserve(userId, reserveId, reserveAmt, model, provider);
  if (!r.proceed) {
    // replayed request — return cached result (or 409 if still in-flight)
    if (r.replay) return c.text(r.replay, 200, { "Content-Type": "text/event-stream" });
    return c.json({ error: { code: "REQUEST_IN_FLIGHT", message: "Duplicate request in progress" } }, 409);
  }
  if (!r.ok) {
    await getRedis().del(`reserve:${reserveId}`);                   // allow retry after top-up
    return c.json({ error: { code: "INSUFFICIENT_CREDITS", balance: r.balance, estimated: reserveAmt } }, 402);
  }

  const signal = c.req.raw.signal;                                  // [FIX] client-disconnect cancels upstream
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("X-Accel-Buffering", "no");

  return stream(c, async (w) => {
    let pt = 0, ct = 0, cacheRead = 0, streamFailed = false, captured = "";
    const send = async (obj: unknown) => { const line = `data: ${JSON.stringify(obj)}\n\n`; captured += line; await w.write(line); };
    // keepalive: SSE comment every 15s so dead connections surface fast
    const ka = setInterval(() => { w.write(": keepalive\n\n").catch(() => {}); }, 15_000);
    try {
      let up;
      try {
        up = await (provider === "anthropic" ? getAnthropic() : getOpenAI())
          .complete({ model, messages: body.messages, system: body.system, tools: body.tools, max_tokens: maxTokens, signal });
      } catch (primary) {
        if (provider === "anthropic" && !signal.aborted) {          // one-shot OpenAI fallback, same reservation
          up = await getOpenAI().complete({ model: "gpt-4o", messages: body.messages, system: body.system, tools: body.tools, max_tokens: maxTokens, signal });
        } else throw primary;
      }
      for await (const ev of up.stream()) {
        if (signal.aborted) break;
        if (ev.type === "text_delta") await send({ type: "text_delta", text: ev.text });
        else if (ev.type === "tool_use") await send({ type: "tool_use", id: ev.id, name: ev.name, input: ev.input });
        else if (ev.type === "usage") { pt = ev.promptTokens || pt; ct = ev.completionTokens || ct; cacheRead = ev.cacheReadTokens ?? cacheRead; }
      }
      const actual = credit.actualAmount(model, pt, ct, cacheRead);
      await send({ type: "done", usage: { promptTokens: pt, completionTokens: ct },
                   credits: { reserved: reserveAmt, actual, balanceDelta: reserveAmt - actual } });
      await w.write("data: [DONE]\n\n");
    } catch (err) {
      streamFailed = true;
      const aborted = signal.aborted;
      await send({ type: "error", code: aborted ? "CLIENT_ABORT" : "UPSTREAM_ERROR",
                   message: err instanceof Error ? err.message : String(err), retryable: !aborted })
        .catch(() => {});
      await w.write("data: [DONE]\n\n").catch(() => {});
    } finally {
      clearInterval(ka);
      if (streamFailed || (pt === 0 && ct === 0)) {
        await credit.refund(reserveId);                              // full refund on failure/abort
      } else {
        const actual = credit.actualAmount(model, pt, ct, cacheRead);
        await credit.settle(reserveId, actual);                      // refund (reserved - actual) >= 0
        writeAudit({ userId, model, provider, promptTokens: pt, completionTokens: ct,
                     creditsReserved: reserveAmt, creditsActual: actual, reserveId, action: body.action ?? "chat" });
        // cache the SSE body for idempotent replay
        await getRedis().set(`result:${reserveId}`, captured, "EX", 900);
      }
    }
  });
});
export default chat;
```

**Failure-mode matrix:**

| Scenario | Handling |
|---|---|
| Insufficient credits | `reserve_credits` returns `ok=false` → 402, Redis reserve key deleted so a later top-up + retry works |
| Replayed idempotency key (Redis `NX` fails) | Return cached SSE body; **no provider call** (closes the free-call exploit) |
| Replay while original in-flight | 409 `REQUEST_IN_FLIGHT` (no `result:` key yet) |
| Provider 5xx before first byte | One-shot OpenAI fallback on same reservation |
| Provider error mid-stream | `type:"error"` frame + `[DONE]`; `finally` refunds full reserve (no usage captured) or settles partial if a usage event arrived |
| Client disconnect (dropped TCP) | `signal.aborted` breaks the loop; keepalive surfaces dead connections within 15s; upstream `complete()` got the same `signal` and cancels; full refund |
| `settle`/`refund` RPC fails | Logged; sweeper (§5.4) recovers from `credit_reservations.settled=false` after 15 min |
| Process killed mid-stream (deploy) | Reservation row persists in PG (not just Redis); sweeper refunds it |

---

## 4. Client ↔ Proxy API Contract

### 4.1 Endpoints (canonical)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/chat` | Bearer JWT | Streaming inference + tool calls (SSE) |
| `POST` | `/v1/embed` | Bearer JWT | Cloud embedding fallback (local Ollama preferred, $0) |
| `POST` | `/v1/transcribe` | Bearer JWT | Batch STT (Deepgram) |
| `POST` | `/v1/transcribe/ticket` | Bearer JWT | Issue 30s one-time WS ticket |
| `GET` | `/v1/transcribe/ws` | ticket via `Sec-WebSocket-Protocol` | Streaming STT |
| `GET` | `/v1/balance` | Bearer JWT | Credit balance + tier |
| `GET` | `/health` | none | Liveness/readiness |

### 4.2 Headers

```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
X-Client-Version: 1.0.0
```

**[FIX]** There is **no client-supplied idempotency header.** The proxy derives the reserve id server-side from `sha256(userId + bodyHash + minuteBucket)`. This makes replays safe regardless of client behavior.

### 4.3 `POST /v1/chat` body

```jsonc
{
  "messages": [ { "role": "user", "content": "…" },
                { "role": "assistant", "content": [ {"type":"tool_use","id":"…","name":"read_note","input":{}} ] },
                { "role": "tool", "content": [ {"type":"tool_result","tool_use_id":"…","content":"…"} ] } ],
  "system": "…L1+L2…\n\n---CACHE_BOUNDARY---\n\n…L3-L6…",   // pre-assembled by client ContextAssembler
  "tools":  [ { "name":"read_note", "description":"…", "input_schema": {…} } ],
  "model":  "claude-sonnet-4-20250514",                     // ignored for free tier
  "max_tokens": 4096,
  "action": "summarize-note"                                // audit label only
}
```

### 4.4 SSE events (the ONE canonical shape)

```
data: {"type":"text_delta","text":"Here is the"}
data: {"type":"text_delta","text":" summary:"}
data: {"type":"tool_use","id":"toolu_01","name":"read_note","input":{"path":"a.md"}}
data: {"type":"done","usage":{"promptTokens":812,"completionTokens":234},"credits":{"reserved":300,"actual":173,"balanceDelta":127}}
data: [DONE]
```

Error stream:

```
data: {"type":"error","code":"UPSTREAM_ERROR","message":"Anthropic 529 overloaded","retryable":true}
data: [DONE]
```

**Client contract (mandatory):** treat the response as **failed** if no `{"type":"done"}` frame arrives before `[DONE]`, **regardless of HTTP 200**. The 200 is flushed before the provider call, so HTTP status alone is not success.

### 4.5 Error envelope (non-streaming) + codes

```json
{ "error": { "code": "INSUFFICIENT_CREDITS", "message": "…", "balance": 12, "estimated": 300 } }
```

| HTTP | code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | malformed body |
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` | missing / bad JWT |
| 402 | `INSUFFICIENT_CREDITS` | reserve failed |
| 403 | `MODEL_NOT_ALLOWED` | free tier requested premium model |
| 409 | `REQUEST_IN_FLIGHT` | duplicate, original still streaming |
| 429 | `RATE_LIMITED` | per-user Redis window exceeded |
| 500 | `INTERNAL_ERROR` | proxy bug; reserve refunded |
| 502 | `UPSTREAM_ERROR` | provider 5xx (pre-stream); reserve refunded |
| 503 | `SERVICE_UNAVAILABLE` | provider key/Redis/Ollama down |

### 4.6 `GET /v1/balance`

```json
{ "balance": 3791, "tier": "pro" }
```

Implemented as `SELECT balance FROM user_credits WHERE user_id=$1` (service role). The client calls it on app start and after every `type:"done"` to keep the credit indicator live.

### 4.7 STT streaming auth (ticket flow) — **[FIX]**

**Never put the JWT in the query string** (it leaks into Caddy + proxy JSON logs and browser history). Instead:

1. `POST /v1/transcribe/ticket` with `Authorization: Bearer <JWT>` → proxy validates, reserves an STT estimate (declared `max_duration_seconds`), returns `{ ticket: "<opaque 30s one-time token>", reserveId }`. Ticket stored in Redis `stt:ticket:{t} = {userId,reserveId}` `EX 30`.
2. Client opens `GET /v1/transcribe/ws` carrying the ticket in the `Sec-WebSocket-Protocol` header (`["lokus-stt", "<ticket>"]`). The upgrade handler validates the ticket **before completing the upgrade** and rejects otherwise — auth is not left to generic middleware that may run after the upgrade.
3. On close, settle STT credits using Deepgram-reported audio seconds (`COST.deepgram.second`). Hard limits: max stream 2h (server force-close), max 2 concurrent WS per user (Redis counter).

`/v1/transcribe` (batch) reserves on the declared/encoded duration and settles on Deepgram's returned `duration`. `/v1/embed` cloud fallback reserves a tiny per-1k-token cost; local Ollama embeds are $0 and never touch the proxy.

### 4.8 How the Tauri client calls the proxy

The existing `_proxyStream` (`ai-provider.js:256`) already implements the SSE reader and listen/unlisten lifecycle. **[FIX]** Change only its URL from the Supabase edge-function path to `${VITE_PROXY_BASE_URL}/v1/chat`, and switch the request body to `{messages, system, tools, model, max_tokens}`. The Supabase JWT comes from the (to-be-implemented) `secure_store_get` with localStorage fallback. No `api_key` is ever sent — provider keys live only on the proxy.

---

## 5. Hosting & Deployment on Your Server

### 5.1 Directory layout on the VPS

```
/opt/lokus-proxy/
├── docker-compose.yml
├── Caddyfile
├── .env                      # root:root 600 — never committed
├── proxy/                    # built into image; or pull from GHCR
└── scripts/{deploy.sh,setup-firewall.sh}
```

### 5.2 Dockerfile

```dockerfile
# proxy/Dockerfile
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.1-alpine AS runner
WORKDIR /app
RUN addgroup -S lokus && adduser -S lokus -G lokus
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
ENV NODE_ENV=production PORT=3000
USER lokus
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["bun", "run", "src/index.ts"]
```

### 5.3 docker-compose.yml

```yaml
services:
  proxy:
    build: { context: ./proxy }
    container_name: lokus-proxy
    restart: unless-stopped
    env_file: [.env]
    environment: { NODE_ENV: production, PORT: "3000" }
    expose: ["3000"]                  # bridge-only; Caddy reaches it, host does not publish
    networks: [lokus-internal]
    depends_on:
      redis:   { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s; timeout: 5s; retries: 3; start_period: 15s
    stop_grace_period: 30s            # SIGTERM drain window (§5.5)
    logging: { driver: json-file, options: { max-size: "50m", max-file: "5" } }

  redis:
    image: redis:7-alpine
    container_name: lokus-redis
    restart: unless-stopped
    command: redis-server --save "" --appendonly no --maxmemory 256mb --maxmemory-policy noeviction
    expose: ["6379"]
    networks: [lokus-internal]
    healthcheck: { test: ["CMD","redis-cli","ping"], interval: 10s, timeout: 3s, retries: 3 }

  ollama:                              # optional, server-side embeds
    image: ollama/ollama:latest
    container_name: lokus-ollama
    restart: unless-stopped
    volumes: [ollama_data:/root/.ollama]
    expose: ["11434"]
    networks: [lokus-internal]

  caddy:
    image: caddy:2-alpine
    container_name: lokus-caddy
    restart: unless-stopped
    ports: ["80:80","443:443","443:443/udp"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [lokus-internal]
    depends_on: [proxy]
    logging: { driver: json-file, options: { max-size: "20m", max-file: "3" } }

networks: { lokus-internal: { driver: bridge } }
volumes:  { caddy_data: {}, caddy_config: {}, ollama_data: {} }
```

> **[FIX]** Redis uses `--maxmemory-policy noeviction`. Idempotency/reservation keys must **not** be evicted under memory pressure (eviction would re-open the double-charge window). `noeviction` + a generous 256mb cap is correct; rate-limit keys carry short TTLs and self-expire.

### 5.4 Caddyfile — **[FIX]** no CORS header here

```caddyfile
{
  email admin@lokusmd.com
  servers { protocols h1 h2 h3 }
}

api.lokusmd.com {
  reverse_proxy lokus-proxy:3000 {
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    flush_interval -1                 # critical: do NOT buffer SSE
    health_uri /health
    health_interval 20s
    transport http {
      response_header_timeout 15s
      read_timeout 0                  # SSE streams are open-ended
      dial_timeout 5s
    }
  }
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options nosniff
    X-Frame-Options DENY
    Referrer-Policy no-referrer
    -Server
    # NO Access-Control-Allow-Origin — Hono owns CORS (see §8.4)
  }
  encode { zstd; gzip; match { not header Content-Type text/event-stream } }
  log { output file /var/log/caddy/api-access.log { roll_size 100mb roll_keep 7 } format json }
}
```

### 5.5 Hono entry + graceful SIGTERM drain

```typescript
// proxy/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";        // or Bun.serve
import { validateConfig } from "./config.js";
import { requestLogger } from "./middleware/logger.js";
import chat from "./routes/chat.js";
import embed from "./routes/embed.js";
import transcribe from "./routes/transcribe.js";
import balance from "./routes/balance.js";

validateConfig();
const app = new Hono();
let draining = false;

// [FIX] CORS owned here, only Tauri webview origins
app.use("*", cors({
  origin: (o) => (["tauri://localhost", "https://tauri.localhost"].includes(o) ? o : ""),
  allowHeaders: ["Authorization", "Content-Type", "X-Client-Version"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  exposeHeaders: ["X-RateLimit-Remaining"],
  maxAge: 86400,
}));
app.use("*", requestLogger);

app.get("/health", (c) => draining ? c.json({ status: "draining" }, 503)
                                    : c.json({ status: "ok", uptime: process.uptime() }));
app.route("/v1/chat", chat);
app.route("/v1/embed", embed);
app.route("/v1/transcribe", transcribe);
app.route("/v1/balance", balance);

const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });

async function shutdown(sig: string) {
  console.log(`[proxy] ${sig} → draining`);
  draining = true;                                 // /health → 503 → Caddy stops routing
  await new Promise((r) => setTimeout(r, 2000));   // let Caddy notice
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000);       // hard cap < stop_grace_period 30s
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
```

**[FIX] Drain + credit safety:** because every reservation is persisted in `credit_reservations` at reserve time (not just Redis), a stream killed mid-flight during the 25s window is recovered by the sweeper — the drain timer alone does not guarantee settlement, and we do not rely on it to.

**Stranded-reservation sweeper** (pg_cron, runs every 5 min):

```sql
-- in the credit migration
SELECT cron.schedule('lokus-reservation-sweep', '*/5 * * * *', $$
  SELECT public.refund_reservation(reserve_id)
  FROM public.credit_reservations
  WHERE settled = false AND created_at < now() - interval '15 minutes';
$$);
```

If `pg_cron` is unavailable on your Supabase plan, run the same query from a GitHub Actions cron (§9) hitting an authenticated admin endpoint.

### 5.6 CI/CD (GitHub Actions → GHCR → VPS) + cut-over

The pipeline: **gitleaks scan → build & push image to GHCR → SSH deploy with health-gate → smoke test.** Deploy step (the load-bearing part):

```yaml
# .github/workflows/deploy-proxy.yml (deploy job, abridged)
- uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.VPS_HOST }}
    username: ${{ secrets.VPS_USER }}     # 'deploy', in docker group
    key: ${{ secrets.VPS_SSH_KEY }}
    script: |
      set -euo pipefail
      cd /opt/lokus-proxy
      echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
      docker compose pull proxy
      docker compose up -d --no-deps proxy
      for i in $(seq 1 12); do
        S=$(docker inspect --format='{{.State.Health.Status}}' lokus-proxy 2>/dev/null || echo starting)
        [ "$S" = healthy ] && break; sleep 5
      done
      [ "$(docker inspect --format='{{.State.Health.Status}}' lokus-proxy)" = healthy ] || { docker logs --tail=50 lokus-proxy; exit 1; }
      docker image prune -f --filter "until=24h"
```

**Zero-downtime reality:** with `stop_grace_period: 30s` + the SIGTERM drain, a `docker compose up -d` rolling restart loses at most one in-flight SSE stream, whose reservation the sweeper refunds. For hard zero-drop, run blue/green (`proxy-blue`/`proxy-green` profiles, toggle the Caddy upstream) — overkill at current scale.

**Edge-function cut-over:** the client flips one var:
```
# was: VITE_LOKUS_LLM_BASE=https://<proj>.supabase.co/functions/v1
VITE_PROXY_BASE_URL=https://api.lokusmd.com
```
`_proxyStream`'s URL changes from `_edgeFnUrl(...)` to `${VITE_PROXY_BASE_URL}/v1/chat`. The edge functions stay deployed as a fallback during rollout.

---

## 6. Data Model & Schemas

### 6.1 Canonical credit ledger — **[FIX]** one design, race-safe

**Migration: `supabase/migrations/20260601000000_credit_ledger.sql`**

```sql
-- =============================================================================
-- Canonical Lokus credit ledger. Supersedes ALL other credit schemas in the
-- PRD drafts. Mutable balance row + append-only audit + reservation table.
-- Serialization: row-level FOR UPDATE on user_credits. No advisory-lock hacks,
-- no aggregating-view balance (which cannot be locked).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),   -- hard floor
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (   -- append-only audit of every mutation
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta      bigint NOT NULL,                       -- + grant/refund, - reserve, +/- settle
  reason     text NOT NULL,                          -- 'reserve'|'settle'|'refund'|'grant'|'shortfall'
  reserve_id text,
  balance_after bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON public.credit_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.credit_reservations (
  reserve_id text PRIMARY KEY,                       -- server-derived sha256
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     bigint NOT NULL CHECK (amount > 0),
  settled    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resv_unsettled ON public.credit_reservations (settled, created_at)
  WHERE settled = false;

-- Signup grant: 500 free credits (fires alongside the existing meeting_usage trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user_credit()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 500)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.credit_ledger (user_id, delta, reason, balance_after)
    VALUES (NEW.id, 500, 'grant', 500);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
CREATE TRIGGER on_auth_user_created_credit AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credit();
```

### 6.2 The three RPCs — row-locked, idempotent, floored

```sql
-- reserve_credits: lock the user row, check floor, deduct, record reservation.
-- Idempotent on reserve_id (the proxy also gates via Redis NX, this is belt+braces).
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id uuid, p_amount bigint, p_reserve_id text
) RETURNS TABLE(ok boolean, balance_after bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal bigint;
BEGIN
  -- Idempotency: if this reserve already exists, return current balance, no double-deduct.
  IF EXISTS (SELECT 1 FROM credit_reservations WHERE reserve_id = p_reserve_id) THEN
    SELECT balance INTO v_bal FROM user_credits WHERE user_id = p_user_id;
    RETURN QUERY SELECT true, COALESCE(v_bal, 0); RETURN;
  END IF;

  -- Lock the physical row — the ONLY serialization needed.
  SELECT balance INTO v_bal FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  IF v_bal IS NULL THEN
    INSERT INTO user_credits(user_id, balance) VALUES (p_user_id, 0)
      ON CONFLICT (user_id) DO NOTHING;
    v_bal := 0;
  END IF;

  IF v_bal < p_amount THEN RETURN QUERY SELECT false, v_bal; RETURN; END IF;

  UPDATE user_credits SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_user_id;
  INSERT INTO credit_reservations(reserve_id, user_id, amount) VALUES (p_reserve_id, p_user_id, p_amount);
  INSERT INTO credit_ledger(user_id, delta, reason, reserve_id, balance_after)
    VALUES (p_user_id, -p_amount, 'reserve', p_reserve_id, v_bal - p_amount);
  RETURN QUERY SELECT true, v_bal - p_amount;
END; $$;

-- settle_credits: refund (reserved - actual). Because we over-reserve, delta >= 0 normally.
-- If actual > reserved (should not happen), clamp the refund to 0 and log a 'shortfall'
-- ledger row instead of driving balance negative.
CREATE OR REPLACE FUNCTION public.settle_credits(
  p_reserve_id text, p_actual_amount bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reserved bigint; v_user uuid; v_delta bigint; v_bal bigint;
BEGIN
  SELECT amount, user_id INTO v_reserved, v_user
    FROM credit_reservations WHERE reserve_id = p_reserve_id AND settled = false FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;            -- already settled or unknown: no-op (idempotent)

  v_delta := v_reserved - p_actual_amount;     -- + = refund excess
  IF v_delta > 0 THEN
    SELECT balance INTO v_bal FROM user_credits WHERE user_id = v_user FOR UPDATE;
    UPDATE user_credits SET balance = balance + v_delta, updated_at = now() WHERE user_id = v_user;
    INSERT INTO credit_ledger(user_id, delta, reason, reserve_id, balance_after)
      VALUES (v_user, v_delta, 'settle', p_reserve_id, v_bal + v_delta);
  ELSIF v_delta < 0 THEN
    -- Under-reservation (rare; over-reserve policy should prevent it). Do NOT go negative.
    INSERT INTO credit_ledger(user_id, delta, reason, reserve_id, balance_after)
      SELECT v_user, 0, 'shortfall', p_reserve_id, balance FROM user_credits WHERE user_id = v_user;
  END IF;
  UPDATE credit_reservations SET settled = true WHERE reserve_id = p_reserve_id;
END; $$;

-- refund_reservation: full refund on failure/abort/sweep.
CREATE OR REPLACE FUNCTION public.refund_reservation(p_reserve_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount bigint; v_user uuid; v_bal bigint;
BEGIN
  SELECT amount, user_id INTO v_amount, v_user
    FROM credit_reservations WHERE reserve_id = p_reserve_id AND settled = false FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT balance INTO v_bal FROM user_credits WHERE user_id = v_user FOR UPDATE;
  UPDATE user_credits SET balance = balance + v_amount, updated_at = now() WHERE user_id = v_user;
  INSERT INTO credit_ledger(user_id, delta, reason, reserve_id, balance_after)
    VALUES (v_user, v_amount, 'refund', p_reserve_id, v_bal + v_amount);
  UPDATE credit_reservations SET settled = true WHERE reserve_id = p_reserve_id;
END; $$;
```

### 6.3 Lock-down: SECURITY DEFINER + REVOKE PUBLIC — **[FIX]**

```sql
ALTER TABLE public.user_credits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY uc_sel  ON public.user_credits        FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY cl_sel  ON public.credit_ledger       FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- credit_reservations: no authenticated SELECT (internal accounting only)

-- Functions take p_user_id; they MUST NOT be callable by end users.
REVOKE ALL ON FUNCTION public.reserve_credits(uuid,bigint,text)   FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.settle_credits(text,bigint)         FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.refund_reservation(text)            FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid,bigint,text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits(text,bigint)        TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_reservation(text)           TO service_role;
```

### 6.4 `ai_audit_log` (one schema — **[FIX]** reconcile the two drafts)

```sql
-- supabase/migrations/20260601000001_ai_audit_log.sql
CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserve_id        text,
  action            text NOT NULL DEFAULT 'chat',
  provider          text NOT NULL,
  model             text NOT NULL,
  tokens_prompt     integer NOT NULL DEFAULT 0,
  tokens_completion integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  credits_reserved  integer NOT NULL DEFAULT 0,
  credits_actual    integer NOT NULL DEFAULT 0,
  credits_delta     integer GENERATED ALWAYS AS (credits_reserved - credits_actual) STORED,
  latency_ms        integer,
  outcome           text NOT NULL DEFAULT 'success',  -- success|error_upstream|error_credits|client_abort
  error_code        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON public.ai_audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_date ON public.ai_audit_log (created_at DESC);
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_sel ON public.ai_audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY audit_ins ON public.ai_audit_log FOR INSERT TO service_role WITH CHECK (true);

-- Founder cost dashboard
CREATE OR REPLACE VIEW public.v_daily_cost AS
SELECT date_trunc('day', created_at)::date AS day, provider, model,
       COUNT(*) AS calls, SUM(tokens_prompt) AS tok_in, SUM(tokens_completion) AS tok_out,
       SUM(credits_actual) AS credits
FROM public.ai_audit_log WHERE outcome = 'success'
GROUP BY 1,2,3 ORDER BY 1 DESC, 7 DESC;
```

### 6.5 The genuinely-missing sync migration — **[FIX]** ship it now

`ManifestManager.js:116` calls `rpc('update_manifest', { p_user_id, p_workspace_id, p_manifest, p_expected_version })`. **Verified: no such RPC or table exists in any committed migration.** This is a live production gap independent of the AI work. Author it:

```sql
-- supabase/migrations/20260601000002_workspace_manifests.sql
CREATE TABLE IF NOT EXISTS public.workspace_manifests (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- 1 per user
  workspace_id     text NOT NULL,
  manifest         jsonb NOT NULL DEFAULT '{}',
  manifest_version integer NOT NULL DEFAULT 1,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY wm_own ON public.workspace_manifests FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Optimistic-concurrency CAS — exact signature ManifestManager.js:116 calls.
CREATE OR REPLACE FUNCTION public.update_manifest(
  p_user_id uuid, p_workspace_id text, p_manifest jsonb, p_expected_version integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.workspace_manifests(user_id, workspace_id, manifest, manifest_version)
    VALUES (p_user_id, p_workspace_id, p_manifest, 1)
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.workspace_manifests
     SET manifest = p_manifest, workspace_id = p_workspace_id,
         manifest_version = manifest_version + 1, updated_at = now()
   WHERE user_id = p_user_id AND manifest_version = p_expected_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;                       -- false = version conflict
END; $$;
REVOKE ALL ON FUNCTION public.update_manifest(uuid,text,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_manifest(uuid,text,jsonb,integer) TO authenticated, service_role;
```

> The manifest RPC is callable by `authenticated` (not just service_role) because the sync engine runs in the client with the user's JWT, and the function is scoped by `p_user_id` under RLS. The credit RPCs are service_role-only because they are called from the proxy with the service key.

### 6.6 Local audit log `.lokus/ai-audit.jsonl` (NDJSON, never synced)

Written by a new Tauri command `append_audit_log` (in `src-tauri/src/handlers/ai.rs`, `OpenOptions::append(true)`), mirroring the `ai_audit_log` row, correlated by `reserve_id`. One JSON object per line:

```json
{"$schema":"lokus-ai-audit-v1","reserve_id":"<sha256>","ts":"2026-05-28T14:32:01.123Z","action":"summarize-note","surface":"palette","provider":"anthropic","model":"claude-haiku-4-20250514","tokens":{"prompt":812,"completion":234},"credits":{"reserved":300,"actual":173,"balance_after":3827},"latency_ms":1247,"outcome":"success","error":null}
```

**[FIX] Sync exclusion (verified necessary):** `FileScanner` descends into `.lokus/` and only excludes `['sync-cache.json','sync-id','offline-queue.json']` (`FileScanner.js:6`). Add the AI files explicitly:

```javascript
// src/core/sync/FileScanner.js:6 — extend the list
const LOKUS_EXCLUDED_FILES = [
  'sync-cache.json', 'sync-id', 'offline-queue.json',
  'ai-audit.jsonl',                                   // [ADD] local audit, never sync
  'embeddings.db', 'embeddings.db-wal', 'embeddings.db-shm', // [ADD] 150MB vector DB, never sync
];
```

Rotation: when `ai-audit.jsonl` > 5MB, rename to `ai-audit-{YYYY-MM}.jsonl`; reuse `TrashManager`'s cleanup to drop logs > 90 days.

### 6.7 Local SQLite-vec schema (`.lokus/embeddings.db`)

```sql
PRAGMA journal_mode = WAL;
CREATE VIRTUAL TABLE IF NOT EXISTS note_vecs USING vec0(
  note_id TEXT PRIMARY KEY,
  embedding FLOAT[768]                              -- nomic-embed-text dims
);
CREATE TABLE IF NOT EXISTS note_meta (
  note_id TEXT PRIMARY KEY, note_path TEXT NOT NULL,
  mtime INTEGER NOT NULL, chunk_hash TEXT NOT NULL, indexed_at INTEGER NOT NULL
);
-- kNN query: SELECT note_id, vec_distance_cosine(embedding, :q) AS d
--            FROM note_vecs ORDER BY d ASC LIMIT :k;
```

**[FIX] sqlite-vec is unconfirmed on crates.io.** `Cargo.toml` has no `rusqlite`/`sqlite` at all (verified). Before committing: (a) confirm a published `sqlite-vec` crate + version and its real helper API, or (b) bundle the C extension `.dylib`/`.so`/`.dll` via `tauri.conf.json` `resources` and `Connection::load_extension`, or (c) fall back to a pure-Rust index (`usearch`/`hora`). Add `rusqlite = { version = "0.31", features = ["bundled"] }` (the `bundled` feature statically links libsqlite3, avoiding cross-platform version drift). The reindex diff uses `FileScanner`'s existing mtime cache: notes with `mtime > note_meta.mtime` (or absent) re-embed; notes in `note_meta` but absent from the scan get their chunks deleted.

---

## 7. Local Model Integration (Ollama now, Apple FM later, embeddings, fallback)

### 7.1 Ollama Rust module — **[FIX]** correct cfg gating

New `src-tauri/src/ollama.rs` with commands `ollama_check`, `ollama_list_models`, `ollama_stream_request`, `ollama_pull_model`, `ollama_embed`. They use `reqwest` (already present) — so they must be gated on the **same target block reqwest lives in**, not a generic `#[cfg(desktop)]`:

```rust
// gate (matches Cargo.toml:85 — reqwest is in this exact target block)
#[cfg(not(any(target_os = "ios", target_os = "android")))]
```

`ollama_stream_request` emits the **same** `lokus:llm-chunk:{session_id}` / `lokus:llm-done:{session_id}` events as `llm_stream_request`, so the existing `_rustStream` (`ai-provider.js:164`, which already contains the listen/unlisten lifecycle) works unchanged — the JS just passes `provider:"ollama"`. Ollama's `/api/chat` is NDJSON (one JSON object per line, `{"message":{"content":"…"},"done":false}`), not SSE — the Rust loop splits on `\n` and parses each line, capturing `eval_count`/`prompt_eval_count` on the final `done:true` chunk.

`embeddings.rs` (rusqlite only, no reqwest) can be **all-platform** with no cfg gate. Commands: `index_note_embedding`, `search_embeddings`.

Register in `lib.rs` (`mod ollama; mod embeddings;` + add to `generate_handler!`).

### 7.2 Provider-rewrite scope (`ai-provider.js`) — surgical

`ai-provider.js` is 789 lines (verified). The rewrite is additive:
- Add `_ollamaStream(model, prompt, onChunk)` and `_ollamaGenerate` that invoke the new Ollama commands (reuse the `_rustStream` listen/unlisten pattern verbatim).
- Add `embed(text)` → `invoke('ollama_embed', { model: 'nomic-embed-text', text })`; throws if not local mode.
- `createLLMClient` gains a `mode: 'local'` branch and an `llmProvider: 'ollama'` route.
- `_proxyStream` (line 256) / `_proxyGenerate` (line 219): change URL to `${VITE_PROXY_BASE_URL}/v1/chat` and body to the §4.3 shape. The SSE parse loop is unchanged.
- `generateSummary`/`streamSummary` stay as aliases to `generate`/`stream` so the meeting-summary UI keeps working.

`llm_stream_request` (`lib.rs:499`) and `validate_api_key` (`lib.rs:433`) are **untouched** — they serve BYOK only.

### 7.3 ModelRouter (client) — $0 vs credits decision

A client-side `ModelRouter` picks the backend per surface from `{ollamaRunning, credits, tier}`:

| Surface | Local available | Routing |
|---|---|---|
| `embed` | always (local Ollama) | Ollama `nomic-embed-text` — never cloud, never credits |
| `ambient`/`ghost` | Ollama running | Ollama `qwen3:1.7b`; **skip** if not running (no cloud — must be $0) |
| `slash` | Ollama running | Ollama `qwen3:8b`; cloud if credits>0 else skip |
| `cmdK`/`agent` | optional | cloud preferred (quality); local only if credits≈0 |
| STT | never local | Deepgram via proxy |

`fallbackToCloud` defaults **false** for ambient/ghost (must never silently bill); **true** for cmdK/agent. Embeddings: local Ollama is the primary path; the proxy `/v1/embed` is a rarely-used cloud fallback (and the only embed path that costs credits).

### 7.4 Apple Foundation Models — hard-gated out of v1

**[FIX]** No `objc2-foundation-models` bindings exist (verified: `Cargo.toml:115` has only `objc2-foundation` NSString/NSArray plumbing). AFM requires a **Swift sidecar** (`lokus-afm`) over a Unix socket (`~/.lokus/afm.sock`), same architecture as the existing `lokus-stt` sidecar — **~7.5 engineering days**, a separate future epic. Ship compile-only `afm.rs` stubs (`afm_check`, `afm_stream_request`) that are **NOT** added to `generate_handler!` until the sidecar exists. Gate any future registration `#[cfg(target_os = "macos")]` + a runtime macOS-26+ check. Do not put AFM in milestones 1–3.

---

## 8. Security & Abuse Hardening

| Threat | Mitigation | Status in this doc |
|---|---|---|
| **Free-call via key replay** | Server-derived reserve id; LLM call gated on Redis `NX` + PG reservation insert; replay returns cached SSE, no provider call | §3.3, §3.4 |
| **Double-spend (concurrent reserves)** | Row-level `FOR UPDATE` on `user_credits` (no view-locking, no advisory-lock cast hacks) | §6.2 |
| **Negative balance** | Over-reserve to `max_tokens`; `CHECK(balance>=0)`; settle clamps refund ≥0, logs `shortfall` instead of going negative | §3.3, §6.2 |
| **Orphaned billable calls on disconnect** | `c.req.raw.signal` threaded into every provider `complete()`; 15s SSE keepalive; full refund on abort | §3.4 |
| **Stranded reservations (proxy crash)** | Reservation persisted in PG; pg_cron sweeper refunds `settled=false` after 15 min | §5.5 |
| **Provider key blast radius** | Keys only in `/opt/lokus-proxy/.env` (root:root 600); deploy user in docker group can `docker inspect` → mitigate with SOPS-encrypted `.env` + key rotation runbook; consider Docker secrets when adding team | §8.2 |
| **Unauthenticated Deepgram tunnel** | Ticket flow: auth validated **in the WS upgrade handler before upgrade completes**, not via generic middleware; per-stream credit reserve; 2h hard cap; 2 concurrent/user | §4.7 |
| **JWT leak via logs** | JWT carried in `Sec-WebSocket-Protocol`, never query string; access logs never contain bearer tokens | §4.7 |
| **Cross-user RPC abuse** | `REVOKE EXECUTE … FROM PUBLIC, authenticated` on all credit RPCs; service_role only | §6.3 |
| **JWT plaintext at rest (client)** | Implement `secure_store_*` with `keyring 3.6` (already in Cargo); until then, documented as a prerequisite, not a shipped guarantee | §8.1 |
| **Edge DDoS / volumetric** | Cloudflare proxied DNS, Bot Fight, per-IP edge rate limit, WAF rule blocking `/v1/*` without `Authorization` | §8.3 |
| **Direct-IP bypass of Cloudflare** | `ufw` allows 443 only from Cloudflare IP ranges; SSH from admin IP only; fail2ban on 4xx floods | §8.3 |

### 8.1 `secure_store_*` — the prerequisite

**[FIX]** Implement `secure_store_set(key, value)` / `secure_store_get(key)` as Tauri commands backed by `keyring 3.6` (in `Cargo.toml:89`; on Linux it uses secret-service per the comment at `Cargo.toml:133`). Register in `generate_handler!`. The JS already calls them with localStorage fallback (`ai-provider.js:709,768`). Until shipped, all docs must say "JWT currently in localStorage; secure_store is a required prerequisite for the AI surface," not "tokens live in secure storage." Provider keys correctly never touch the client regardless.

### 8.2 Secrets at rest on the VPS

`.env` is `chmod 600`, `root:root`, read by Docker (which runs as root) via `env_file`. Because the `deploy` user is in the `docker` group, a compromised deploy account can `docker inspect` the running container and read every env var. Mitigations, in order: (1) SOPS-encrypt `.env` in a private infra repo, decrypt at deploy time; (2) rotate all provider keys on any suspected deploy-account compromise; (3) move to Docker secrets when more than one operator exists. `gitleaks` runs in CI on every push to catch `sk-ant-`, `sk-proj-`, key patterns.

### 8.3 Edge + host firewall

Cloudflare (orange-cloud `api.lokusmd.com`): Bot Fight on; per-IP rate limit `/v1/*` 60 req/min → 10-min block; WAF custom rule blocks `/v1/*` lacking a `Bearer ` Authorization header. On the VPS, `setup-firewall.sh` allows 443 only from Cloudflare's published IPv4/IPv6 ranges, SSH only from the admin IP, refresh the Cloudflare allowlist monthly via cron. `fail2ban` bans IPs producing 50 `4[01][0-9]` responses against `/v1/*` in 60s.

### 8.4 CORS — single owner

Hono `cors()` reflects only `tauri://localhost` and `https://tauri.localhost`. The Caddyfile sets **no** `Access-Control-Allow-Origin` (double headers are invalid and rejected by browsers). The desktop webview origin is one of the two Tauri schemes — `https://lokusmd.com` is **not** a valid client origin and must not be allowed.

---

## 9. Observability & Cost Monitoring

**Structured request logs:** one JSON line per request to stdout (`logger.ts`), captured by Docker `json-file` (rotated 50m×5), shipped via a lightweight Vector sidecar to Better Stack Logs (free tier, SQL query UI). Fields: `ts, request_id, method, path, status, duration_ms, user_id, tier, provider, model, tokens_in, tokens_out, credits_actual`.

**Cost dashboard:** the `ai_audit_log` table + `v_daily_cost` view (§6.4) queried in Supabase Studio, or Grafana on the PG connection pooler. Per-user spend = `SELECT user_id, SUM(credits_actual) FROM ai_audit_log WHERE created_at > date_trunc('month', now()) GROUP BY 1`.

**Uptime:** Better Uptime (or Cloudflare health check) polls `https://api.lokusmd.com/health` every 3 min; alert to Slack on first failure.

**Daily cost/error alert:** a scheduled GitHub Action (`cron: 0 8 * * *`) queries `v_daily_cost` for yesterday and the error rate (`outcome != 'success'`), posts to a Slack webhook if daily approx USD > threshold (e.g. $20) or error rate > 2%.

**Reservation health:** alert if `SELECT count(*) FROM credit_reservations WHERE settled=false AND created_at < now()-interval '1 hour'` > 0 — indicates the sweeper or settle path is failing.

---

## 10. Testing & Rollout Plan

### 10.1 Test matrix

| Layer | What | How |
|---|---|---|
| **Credit RPCs** | concurrency, idempotency, floor | pgTAP / SQL test: 100 parallel `reserve_credits` for the same user with balance=N×amount → exactly N succeed; replayed reserve_id never double-deducts; settle never drives negative |
| **Proxy unit** | provider normalization, reserve→settle→refund, JWT verify, idempotency replay | Vitest/bun:test with mocked Anthropic/OpenAI SDK + a fake Supabase RPC + Redis (testcontainers or `ioredis-mock`) |
| **Proxy integration** | full `/v1/chat` SSE lifecycle, abort → refund, 402, replay | spin the Hono app against a stub provider; assert `type:"done"` frame, ledger rows, reservation `settled=true` |
| **Disconnect** | client abort mid-stream | open SSE, drop the socket, assert upstream `complete()` saw `signal.aborted` and a `refund` ledger row exists |
| **STT auth** | ticket flow, expired ticket, query-param rejected | assert WS upgrade rejected without valid `Sec-WebSocket-Protocol` ticket |
| **Client** | ContextAssembler budget caps, ModelRouter $0 vs credit routing, SSE reader handles `type:"done"`/`error` | Vitest |
| **Client e2e** | Cmd-K → proxy → Anthropic → credit deducted → diff preview → accept → audit line | Playwright against a staging proxy + test Supabase project |

### 10.2 Rollout phases

1. **M0 — Foundations (parallelizable):** ship the 3 SQL migrations (credit ledger + RPCs, `ai_audit_log`, **`workspace_manifests`** — the last fixes a live sync bug); implement `secure_store_*`; stand up the proxy with `/health`, `/v1/balance`, JWT verify, Redis. Gate behind a feature flag; no LLM surface yet.
2. **M1 — Cloud Cmd-K (credits):** `/v1/chat` streaming, reserve→settle→refund, client ContextAssembler + ActionRegistry registration (**[FIX]** wire registration in `src/views/Workspace.jsx` where `workspacePath` state lives, or read `window.__WORKSPACE_PATH__` — **not** `App.jsx`, which has no `workspacePath` and a `[]`-dep effect). Diff preview via **`prosemirror-history` + custom decorations** (do not invent `tr.setMeta('suggestion')`; install `prosemirror-suggestion-mode` only if you adopt its real plugin API). Internal dogfood.
3. **M2 — Ambient resurfacing (Layer A, $0):** graph neighbors via the **real** `getGraphIndex(workspacePath).getRelatedNotes(name, {depth:1, direction:'both'})` (field is `incomingLinks`, not `backlinks`). Ships to all users, zero LLM.
4. **M3 — Local models + embeddings:** Ollama commands, SQLite-vec (after confirming the crate), generate-on-save pipeline (`.lokus/embeddings.db`, excluded from sync), ModelRouter, Layer B semantic resurfacing.
5. **M4 — STT proxy migration + agent loop (client-side):** ticket-auth WS, metered STT credits; the client ReAct loop calling `/v1/chat` per step.
6. **Future epic:** Apple Foundation Models Swift sidecar (gated out of M0–M4).

Cut-over from edge functions is a single `VITE_PROXY_BASE_URL` flip with the edge functions kept warm as fallback through M1–M2.

---

## Appendix: env vars & config reference

**Proxy `/opt/lokus-proxy/.env` (root:root 600) — [FIX] real var names:**

```bash
# LLM providers (proxy-only; never in client)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
LOKUS_DEEPGRAM_KEY=...                       # matches transcribe/index.ts:252
# OPENROUTER_API_KEY=sk-or-...               # optional fallback

# Supabase (service role; proxy validates JWT locally via JWKS, uses this only for RPCs/tier)
SUPABASE_URL=https://YOURPROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # matches llm-summary/index.ts:117
# SUPABASE_JWT_SECRET=...                     # only if project uses HS256 (see §3.2)

# Infra
REDIS_URL=redis://lokus-redis:6379
OLLAMA_BASE_URL=http://lokus-ollama:11434
PORT=3000
LOG_LEVEL=info
```

**Tauri build-time `.env.production` (non-secret; committed):**

```bash
VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...                # anon key, public by design
VITE_PROXY_BASE_URL=https://api.lokusmd.com  # NEW
VITE_EMBED_MODEL=nomic-embed-text            # local Ollama embed model
```

**GitHub repo secrets (CI/CD):** `VPS_HOST`, `VPS_USER` (=`deploy`), `VPS_SSH_KEY`, `GHCR_TOKEN` (read:packages), `SLACK_WEBHOOK`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for the cost-alert cron).

**Config-file inventory:**

| Path | Purpose | Committed? |
|---|---|---|
| `/opt/lokus-proxy/.env` | all secrets | No (password manager / SOPS) |
| `/opt/lokus-proxy/docker-compose.yml` | proxy + redis + ollama + caddy | Yes |
| `/opt/lokus-proxy/Caddyfile` | TLS + reverse proxy (no CORS header) | Yes |
| `proxy/Dockerfile`, `proxy/package.json`, `proxy/bun.lockb` | reproducible build | Yes |
| `proxy/src/**` | Hono app | Yes |
| `supabase/migrations/20260601000000_credit_ledger.sql` | balance + RPCs + sweeper | Yes |
| `supabase/migrations/20260601000001_ai_audit_log.sql` | audit table + cost view | Yes |
| `supabase/migrations/20260601000002_workspace_manifests.sql` | **fixes live sync gap** | Yes |
| `.github/workflows/deploy-proxy.yml` | CI/CD | Yes |
| `.github/workflows/cost-alert.yml` | daily cost/error/reservation alert | Yes |

**Cost matrix (single source of truth — proxy `credit.ts`):** Haiku `0.25/1.25` · Sonnet `3.0/15.0` · gpt-4o-mini `0.15/0.6` · gpt-4o `5.0/15.0` (credits per 1k input/output tokens); Deepgram per audio-second per the monetization PRD. Pro = $12/mo = 4000 credits; signup = 500; local Ollama features = 0 credits.

**Verified-fact corrections applied throughout (for the builder's trust):** `ACTIONS` array = lines 66–123 of `shortcuts/registry.js`; `ai-provider.js` = 789 lines, `_proxyGenerate`@219, `_proxyStream`@256, `_rustStream`@164 (already has listen/unlisten); `SearchResult.match_text` is serde-renamed to `"match"` (`search.rs:28`); `secure_store_*` unimplemented; `keyring 3.6` present; `prosemirror-history` present, `prosemirror-suggestion-mode`/`prosemirror-changeset` absent; `api_server.rs:345` binds `127.0.0.1` only; env vars `LOKUS_DEEPGRAM_KEY`/`SUPABASE_SERVICE_ROLE_KEY`; credit/`workspace_manifests` migrations genuinely missing from `supabase/migrations/`; `reqwest` in the `cfg(not(any(ios,android)))` target block — gate Ollama commands identically, keep `embeddings.rs` all-platform.
