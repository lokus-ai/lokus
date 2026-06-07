# Lokus AI — Execution Plan (for the implementing agent)

**Doc 5 of 5** · Companion to `LOKUS_AI_PRD.md`, `LOKUS_AI_IMPLEMENTATION.md`, `LOKUS_MONETIZATION_PRD.md`, `LOKUS_DIFFERENTIATION.md`. · **Date:** May 2026.

> **You are the implementing agent.** This document tells you *how to build* the Lokus AI system using a parallel agent **team** + **git worktrees**, decomposed so **no two agents ever touch the same file**. The *what* lives in the 4 companion PRDs — read them; this plan does not repeat their specs, it sequences and assigns them.
>
> **Operating contract (decided by the founder):**
> - **Full autonomy, including commits** to your feature branches. **Do NOT `git push` or open a PR without explicit human approval.**
> - **Follow `/dev-guide`** (the project dev guide) for every stream: question assumptions, plan-with-files, blast-radius before shared-file edits, tests before & after, 3-strike error protocol.
> - **Honor `AGENTS.md` parallel-agent rules:** one owner per file, additive over edits, coordinate via new files in `.context/`, split work by file (never by line).
> - **Commit message rule:** never mention Claude/AI/Anthropic in commit messages or metadata.
> - Docs stay at repo root (founder override of the "no loose root markdown" convention).

---

## 0. Before you start — read these (in order)

1. `LOKUS_AI_PRD.md` — engine (ActionRegistry, ContextAssembler), resurfacing engine, agent loop, surfaces, safety, build roadmap, **Appendix: Codebase Anchors**.
2. `LOKUS_AI_IMPLEMENTATION.md` — **§0 Canonical Decisions (authoritative — resolves all cross-doc conflicts)**, proxy design + request lifecycle, hosting, data schemas, local models, security.
3. `LOKUS_MONETIZATION_PRD.md` — credit ledger semantics, tiers, pricing the ledger must enforce.
4. `LOKUS_DIFFERENTIATION.md` — product context (why; informs UX copy/priorities only).

**Verified codebase facts these plans rest on** (re-verify with `lsp`/`grep` before editing — code may have moved):
- Editor is **raw ProseMirror** (NOT TipTap — `PROJECT_ARCHITECTURE.md` is stale on this; `LEARNINGS.md` is correct).
- `src/services/ai-provider.js` (789 lines) is summary-shaped: `_rustStream`@164, `_proxyGenerate`@219, `_proxyStream`@256. No tool-calling, no embeddings.
- `src-tauri/src/lib.rs` — `llm_stream_request`@~499 takes plain strings (no tools/history).
- `src-tauri/src/api_server.rs:345` binds `127.0.0.1` only → **the agent loop runs client-side; the proxy is stateless per-call inference.**
- `src/core/shortcuts/registry.js` — `ACTIONS` (47 entries incl. `NON_GLOBAL_ACTIONS`).
- `src/plugins/registry/CommandRegistry.js` — EventEmitter+Map `register`/`execute` pattern to clone.
- `src/mcp-server/utils/graphIndex.js` — `outgoingLinks`/`incomingLinks`/`neighbors` (free GraphRAG).
- `supabase/functions/llm-summary/index.ts` — `TIER_LIMITS{free:5,pro:30,power:Infinity}`, count-cap only, **no balance enforcement**. `transcribe/index.ts` exists.
- `prosemirror-suggestion-mode` is **NOT** installed; `prosemirror-history` is. `secure_store_*` is unimplemented (localStorage fallback).
- Credit-ledger and `workspace_manifests`/`update_manifest` migrations are **genuinely missing** from `supabase/migrations/`.

---

## 1. Git & worktree setup (do this first, once)

```bash
# Land on a clean, fresh base (founder's instruction)
git checkout main
git pull origin main
git checkout -b feat/ai-integration          # the shared integration branch

# Bring the 5 planning docs onto the branch so worktrees can see them
git add LOKUS_AI_*.md LOKUS_DIFFERENTIATION.md LOKUS_MONETIZATION_PRD.md
git commit -m "docs: add AI integration PRDs + execution plan"

# One worktree per WAVE-1 stream, each on its own branch off feat/ai-integration
git worktree add -b feat/ai-engine  ../lokus-ai-engine  feat/ai-integration
git worktree add -b feat/ai-ledger  ../lokus-ai-ledger  feat/ai-integration
git worktree add -b feat/ai-proxy   ../lokus-ai-proxy   feat/ai-integration
```

> If `git checkout main` is blocked by the dirty `fix-sync` tree, stash the unrelated changes (`git stash push -m wip-fix-sync`) — do **not** discard them; they are the founder's in-progress sync work. The untracked PRDs travel with the working dir regardless.
>
> The repo also has `scripts/worktree-manager.sh` if you prefer its conventions over raw `git worktree`.

Each teammate works **only inside its own worktree directory.** Merge order is defined in §6.

---

## 2. Team setup

```
TeamCreate(team_name: "lokus-ai")
```

| Teammate | Model | Worktree | Owns (exclusive) |
|---|---|---|---|
| `engine`   | **opus** | `../lokus-ai-engine` | `src/core/ai/**` (new) |
| `ledger`   | **opus** | `../lokus-ai-ledger` | `supabase/**` |
| `proxy`    | **opus** | `../lokus-ai-proxy`  | `proxy/**` (new dir) |
| *(wave 2, spawned after wave 1 merges — see §6)* | | | |
| `providers`| **opus** | `../lokus-ai-providers` | `src/services/ai-provider.js`, **all** `src-tauri/src/**` AI edits |
| `surfaces` | **opus** | `../lokus-ai-surfaces`  | `src/editor/**` AI hooks, `src/components/{EditorContextMenu,CommandPalette}.jsx`, `package.json` |
| `ambient`  | **opus** | `../lokus-ai-ambient`   | new ambient UI components (JS only) |
| `integrator`| **opus**| (main worktree)         | `src/views/Workspace.jsx` wiring, e2e tests |

- **opus for everything that writes code.** Use **sonnet** only for read-only exploration teammates. **haiku** never touches this code.
- Coordinate via `.context/ai-board.md` (gitignored): each teammate writes `files:<name>` claims + discoveries (ports, schema names, interface contracts) **before** editing. Read the board first.
- Use `TaskCreate` for each stream task below; teammates set status `in_progress` → `completed`.

---

## 3. The dependency graph (why waves exist)

```
WAVE 1 (fully parallel, zero file overlap):
  engine ─┐
  ledger ─┼─► (no inter-dependencies; merge when all green)
  proxy  ─┘

WAVE 2 (after wave 1 merges; each edits SHARED files → single owner each):
  providers ──► (rewrites ai-provider.js + lib.rs; defines the AIProvider contract)
        │
        ├──► surfaces  (slash / Cmd-K / selection / ghost / diff-preview — needs engine + provider contract)
        └──► ambient   (Connected-notes panel + local index UI — needs engine + provider embeddings)

WAVE 3 (after wave 2 merges):
  integrator ──► startup wiring in Workspace.jsx + end-to-end tests + paid-AI gate behind ledger
```

**Rule:** a wave does not start until the previous wave's branches are merged into `feat/ai-integration` and the suite is green. Within a wave, streams run concurrently.

---

## 4. WAVE 1 — three parallel streams (all additive / new files)

### Stream `engine` — the capability + context layer
- **Spec:** `LOKUS_AI_PRD.md` §3 (ActionRegistry) + §4 (ContextAssembler).
- **Build (new files only):**
  - `src/core/ai/ActionRegistry.js` — clone the `CommandRegistry.js` EventEmitter+Map pattern; `register/execute/getAll/toToolSchema/bySurface/toMcpManifest`. Include **adapter functions** that *wrap* (do not edit) `ACTIONS` and the MCP tools — wrapping happens at runtime, so this stream creates the adapters but does not modify `registry.js` or `mcp-server/tools/*`.
  - `src/core/ai/ContextAssembler.js` — L1–L6, budget algorithm; L5 reads `graphIndex.js` (import, don't edit).
  - `src/core/ai/*.test.js` — unit tests for both.
- **Acceptance:** `registry.getAll()` returns a unified tool list; `toToolSchema()` emits valid JSON Schema; `ContextAssembler.build(ctx)` returns a budgeted object. Tests green. **No edits outside `src/core/ai/`.**

### Stream `ledger` — credit ledger + missing migrations
- **Spec:** `LOKUS_AI_IMPLEMENTATION.md` §6 + `LOKUS_MONETIZATION_PRD.md` §1, §5.
- **Build:**
  - `supabase/migrations/<ts>_credit_ledger.sql` — `user_credits(balance CHECK>=0)`, `credit_reservations`, append-only `credit_ledger`; RPCs `reserve_credits`/`settle_credits`/`refund_reservation` (`REVOKE … FROM PUBLIC`, grant `service_role`). Over-reserve-to-`max_tokens` semantics.
  - `supabase/migrations/<ts>_workspace_manifests.sql` — the genuinely-missing manifest migration + `update_manifest()`.
  - Edit `supabase/functions/llm-summary/index.ts` + `transcribe/index.ts` — replace `power:Infinity` count-cap with a balance gate; fix the `on_auth_user_created` farming gate. **(These edits live entirely under `supabase/` → owned solely by this stream.)**
- **Acceptance:** a 0-balance request is refused; deductions idempotent; `reserve→settle` only ever refunds. Migrations apply cleanly to a test DB.

### Stream `proxy` — the self-hosted Hono proxy
- **Spec:** `LOKUS_AI_IMPLEMENTATION.md` §2, §3, §4, §5.
- **Build (entirely new `proxy/` dir):** Hono/TS service — routes (`/v1/chat`, `/v1/embed`, `/v1/transcribe[/ticket|/ws]`, `/v1/balance`, `/health`), provider abstraction (Anthropic+OpenAI), JWT (JWKS-cached) → rate-limit (Redis) → reserve (Supabase RPC) → stream (SSE) → reconcile; idempotency via Redis `SET NX`; `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.example`.
- **Acceptance:** local `docker compose up` boots; `/health` 200; a mocked chat call performs reserve→stream→settle; keys load only from env. **Do not call real providers with real keys in tests — use mocks/`.env.example` placeholders.**

> Wave-1 streams share **zero** files. Merge all three into `feat/ai-integration` when green, run the suite, then start wave 2.

---

## 5. WAVE 2 — dependent streams (single owner per shared file)

### Stream `providers` (start first in wave 2 — others depend on its contract)
- **Spec:** `LOKUS_AI_PRD.md` §8 + `LOKUS_AI_IMPLEMENTATION.md` §7.
- **Owns:** `src/services/ai-provider.js` (rewrite → `complete(messages, tools?, signal)` + `embed()`, `lokus`/`byok` modes pointed at the new proxy) **and all `src-tauri/src/**` AI edits** — `lib.rs` (`llm_stream_request` → tools + history; register new commands), new `src-tauri/src/ai_local.rs` (Ollama), `ai_embeddings.rs` (SQLite-vec). **This is the only stream allowed to edit `lib.rs`.**
- **First action:** publish the `AIProvider` interface + Rust command signatures to `.context/ai-board.md` so `surfaces`/`ambient` build against a frozen contract.
- **Blast radius (do this — shared files):** `find_references`/`grep` every caller of `createLLMClient`, `_rustStream`, `llm_stream_request` before changing signatures; keep back-compat shims or update all callers in this stream.

### Stream `surfaces`
- **Spec:** `LOKUS_AI_PRD.md` §6 (agent loop / Cmd-K) + §7 (surfaces) + §9 (safety/diff).
- **Owns:** AI hooks in `src/editor/**` (slash `/ai`, floating-toolbar/selection), `src/components/EditorContextMenu.jsx`, `src/components/CommandPalette.jsx` (Cmd-K router), new ghost-text plugin, diff-preview integration, and `package.json` (add `prosemirror-suggestion-mode`). **Sole owner of `package.json` for the whole effort** — any other stream needing a dep requests it via the board.
- **Depends on:** `engine` (merged) + `providers` contract (from board).

### Stream `ambient`
- **Spec:** `LOKUS_AI_PRD.md` §5 (resurfacing).
- **Owns:** new "Connected notes" component(s) + the JS side of the local embeddings/resurfacing UI (Layer A graph-only first, then Layer B once `providers` ships `embed()`). **JS only — no Rust, no editor-core files** (those belong to `providers`/`surfaces`).
- **Depends on:** `engine` + `providers` `embed()`.

---

## 6. WAVE 3 — integration

### Stream `integrator` (runs in the main worktree after wave 2 merges)
- **Owns:** `src/views/Workspace.jsx` (startup wiring of ActionRegistry/ContextAssembler — **not `App.jsx`**, per impl-doc finding), final cross-stream wiring, the paid-AI gate (only enable metered calls when the ledger is live), and end-to-end tests.
- **Acceptance:** ambient "Connected notes" works end-to-end with zero LLM; a Cmd-K action runs reserve→stream→settle against the proxy; full suite green vs. baseline; nothing pushed.

---

## 7. Master file-ownership matrix (the no-overlap guarantee)

| Path | Sole owner | Notes |
|---|---|---|
| `src/core/ai/**` | `engine` | new |
| `supabase/**` (migrations + functions) | `ledger` | new + edits |
| `proxy/**` | `proxy` | new dir |
| `src/services/ai-provider.js` | `providers` | rewrite |
| `src-tauri/src/**` (AI-related) | `providers` | only AI edits; coordinate if touching unrelated Rust |
| `src/editor/**` (AI hooks), `EditorContextMenu.jsx`, `CommandPalette.jsx` | `surfaces` | |
| `package.json` / lockfile | `surfaces` | single owner; others request deps via board |
| new ambient components | `ambient` | JS only |
| `src/views/Workspace.jsx`, e2e tests | `integrator` | wave 3 |

**If any stream discovers it needs a file owned by another:** stop, post to `.context/ai-board.md`, and let the **owner** make the edit (split by file, never by line — AGENTS.md rule). Never two writers on one file.

---

## 8. Per-stream definition of done (every stream)

Per `/dev-guide`:
- [ ] `task_plan.md` + `findings.md` + `progress.md` created in the worktree.
- [ ] Blast radius mapped for any shared-file edit (wave 2+).
- [ ] Tests run **before** (baseline recorded) and **after** (no regressions) — `npm test`; Rust streams `cargo test`.
- [ ] `lsp` diagnostics clean on touched TS/JS; `cargo check` clean on Rust.
- [ ] Stayed inside owned files only.
- [ ] Committed to the stream branch (allowed). **Not pushed. No PR.**
- [ ] Status posted to `.context/ai-board.md` and the team task marked `completed`.

---

## 9. Hard "do NOT" list

- ❌ Do **not** `git push` or open a PR — stop and ask the human.
- ❌ Do **not** edit a file owned by another stream (see §7).
- ❌ Do **not** put real provider/Deepgram/Supabase **service-role** keys in code, tests, or commits — env only, `.env.example` placeholders.
- ❌ Do **not** build the agent loop on the proxy (it binds localhost-only; loop is client-side).
- ❌ Do **not** ship a write surface before the diff-preview primitive exists (`surfaces` builds it first).
- ❌ Do **not** mock away the credit reserve/settle path — it's the money path; build it real behind the ledger.
- ❌ Do **not** mark "done" on confidence — run the verification commands and show output (`/dev-guide`).

---

## 10. Suggested kickoff message for the implementing agent

> "Read `LOKUS_AI_EXECUTION_PLAN.md` and the 4 companion PRDs. Follow `/dev-guide`. Do §1 git+worktree setup, `TeamCreate("lokus-ai")`, then run **Wave 1** (`engine`, `ledger`, `proxy`) as parallel teammates in their own worktrees — strictly within their owned files per §7. Commit to stream branches; do not push. Report on `.context/ai-board.md`. When all three are green and merged to `feat/ai-integration`, start Wave 2."
