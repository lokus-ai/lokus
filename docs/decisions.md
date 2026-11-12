# Decision log

What we decided, why, and who made the call. Newest on top. An entry is never edited to change
its meaning; a reversal is a new entry that names what it replaces. "Claude (default)" means the
question was open, nobody answered, and a default was taken: those are the easiest to overturn.

| Date | Decision | Why | Who made the call | Replaces |
|---|---|---|---|---|
| 2026-11-12 | Testing is command-driven: every feature is a named command that the `lokus` CLI or the in-app dev channel can run on real files. A few scripted flows, not piles of generated tests | Generated test suites pass while the feature still fails in production | Pratham | v1's Vitest, Playwright and QA-harness suites |
| 2026-11-12 | Decisions are tracked in this file; the design is one living doc (`docs/design.md`) | Know what was done, why, and who called it, without a chain of PRDs and amendments | Pratham (the log); Claude (the single-doc shape) | v1's scattered PRDs and reports |
| 2026-11-12 | Strip, then replace: swapping an approach removes every trace of the old one first. Half-built work is continued or deleted | Two systems half-layered on each other is how v1 got cluttered | Pratham | — |
| 2026-11-12 | No versioned contracts. Before launch, schemas and APIs change in place and the dev database is reset; after launch, changes are additive | Stacked v1 to v4 contract migrations were the worst pain in another project | Pratham (the rule); Claude (the before/after-launch mechanics) | — |
| 2026-11-12 | Every source file carries a `@part-of` marker, checked against a small registry (`parts.json`); `MAP.md` is generated from it | Makes ownership of code obvious; asked for explicitly | Pratham; Claude (one marker per file, about 15 parts) | — |
| 2026-11-12 | Few hard rules. Four checks fail the build (UI goes through the bridge, core is pure, byte-identical save, part markers); the rest are conventions. No file-length cap, only a warning at 1,000 lines. A check is added only after a rule is actually broken | A 400-line cap and check-everything rules create problems and over-engineering | Pratham (no 400 cap, keep it light); Claude (the specific set) | The 12-rule proposal from earlier the same day |
| 2026-11-12 | "Lightweight" is a guideline balanced against UX and features, not a gate. No CI performance budgets | One remark should not bend the whole design | Pratham | Claude's proposed RAM, size and start-up budgets |
| 2026-11-12 | Sync is client-server, not peer-to-peer | Peer-to-peer was tried before; it did not work and does not scale | Pratham | — |
| 2026-11-12 | We write our own small relay (axum + `yrs`), with an update log plus snapshots in Postgres and a role check per connection | No maintained self-hostable server fits; Y-Sweet has stalled | Claude (default), from research | Claude's earlier idea of adopting Y-Sweet |
| 2026-11-12 | CRDT is Yjs in the editor and `yrs` in Rust | Most-used editor binding, standard wire protocol; nothing found justifies Loro or Automerge | Claude (default), from research | — |
| 2026-11-12 | Security stays basic: TLS, login, workspace roles, encryption at rest. No end-to-end encryption for now | Earlier security work bloated the app without being useful | Pratham | v1's end-to-end encrypted team schema (27 tables) |
| 2026-11-12 | Plugins run in a sandboxed frame behind one small permission-checked API, manifest-first, with a single `apiVersion` | v1's plugin system was bloated, with two overlapping APIs; a sandbox cannot be retrofitted later | Pratham (wants a lean plugin system with MCP); Claude (this design, from research) | v1 plugin system, SDK and CLI |
| 2026-11-12 | AI is bring-your-own-key first; keys in the OS keychain, calls from Rust. MCP servers plug in through plugins. Sign in with ChatGPT follows if its terms fit | BYOK is the fastest safe path | Pratham (BYOK first, MCP in plugins); Claude (keychain and Rust-side calls) | — |
| 2026-11-12 | PostHog is integrated from the start, with an opt-out, and never sends note content | Wanted from day one, not bolted on | Pratham (PostHog); Claude (opt-out, no content) | v1's PostHog, Sentry and Umami mix |
| 2026-11-12 | Reuse the existing PostHog key and Supabase project for now | The question went unanswered; lets work start. A fresh Supabase project is still recommended before M3 | Claude (default) | — |
| 2026-11-12 | Login is Supabase Auth (email and Google) | Already in place; a login system is required | Pratham (there must be login); Claude (Supabase) | v1's auth, OAuth server and PKCE code |
| 2026-11-12 | Pages have a cover, icon and properties, stored in YAML frontmatter | Notion-style pages while the file stays plain markdown | Pratham (the page style); Claude (frontmatter) | — |
| 2026-11-12 | Design tokens are set before any screen is built | The craft is in type, spacing, edges and motion | Pratham (the bar); Claude (the token set, from research) | v1's Tailwind and Radix styling |
| 2026-11-12 | Editor is CodeMirror 6 with live preview | The markdown text is the document, so a save cannot corrupt a file; gives auto-paired `**` and syntax that hides away from the cursor | Pratham, on Claude's recommendation | v1's ProseMirror editor |
| 2026-11-12 | Stay on Tauri 2; all logic in a pure-Rust core; the UI only renders | A pure-Rust UI has no production markdown editor and no mobile story. The core has no Tauri in it, so the shell can be swapped later | Claude (default). Pratham questioned it and did not object after the answer | — |
| 2026-11-12 | Ground-up rewrite on a `next` branch whose first commit removes the old tree; v1 kept at tag `v1-legacy`, reference only | No system half-built on another | Pratham | The v1 app |
| 2026-11-12 | Nothing is pushed; work stays on the local `next` branch until the owner says so | The go-ahead to push was not given | Claude (default) | — |
| 2026-11-12 | Fidelity is tested on a generated fixture vault, not the owner's personal vault | Permission to use a copy of the personal vault was not given | Claude (default) | — |
| 2026-11-12 | Tracker reset: the owner's open issues, his two open PRs and the open Lokus todos are closed as superseded. Outside contributors' issues and PRs stay open | Start from level one without discarding other people's work on a public repo | Pratham (the wipe); Claude (leaving outside contributions open) | — |
| 2026-11-12 | Cut from the rewrite: calendar, Gmail, MathGraph, terminal panel, the templates engine | Not part of "Notion plus Obsidian for teams" | Claude (default) | Those v1 features |
| 2026-11-12 | Users of the old sync get a sunset notice, not a migration | Notes are plain files and are safe; the question went unanswered | Claude (default) | v1 manifest sync and team sync |
| 2026-11-12 | No billing or plan limits until after M3 | The business model is undecided | Claude (default) | v1's tiers and credits tables |
| 2026-11-12 | No web version at launch; the server design leaves room for one | Not asked for yet | Claude (default) | — |
