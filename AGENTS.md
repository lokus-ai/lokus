# Working in this repo

Lokus is a local-first markdown notes app for teams. This branch is a ground-up rewrite; the old
app is at tag `v1-legacy` and is reference only. Do not copy code from it.

Read first: [`MAP.md`](./MAP.md) (where a change goes), [`docs/design.md`](./docs/design.md) (how
the system works), [`docs/decisions.md`](./docs/decisions.md) (why, and who decided).

## Hard rules (the build fails: `node checks/run.mjs`)

1. **Logic lives in Rust; the UI only renders.** UI code reaches Rust, the network, Supabase and
   PostHog only through `ui/src/bridge/`.
2. **`lokus-core` has no Tauri and no networking in it.**
3. **Reading a note and saving it unchanged leaves the file byte-identical.**
4. **Every source file starts with its `@part-of` marker**, matching `parts.json`.

## Conventions (review, not checks)

- **Strip, then replace.** To swap an approach, first remove every trace of the old one (files,
  tables, config, dependencies) in its own commit, then build the new one. No `_v2`, `legacy` or
  fallback copies. Half-built work is continued or deleted, never parked.
- **No versioned contracts.** Before launch, change schemas and APIs in place. Never run two
  versions side by side.
- **One owner per thing:** one markdown parser, one index, one module writing each table.
- **Everything is a command.** A feature is a named command with JSON in and out, so the CLI, the
  palette, shortcuts, plugins and AI all reach it the same way.
- **Works offline.** Opening and editing a note never needs the server.
- **The server checks permissions,** once per connection, not per edit.
- **Do not over-engineer.** No rule, check, abstraction or security layer before it is needed.
  A file over about 1,000 lines gets a warning, not a failure.

## Verifying

"Done" means shown working with real output, not only passing tests.

- Run the command for real: `cargo run -p lokus-cli -- <command> --vault <dir> '<json>'`.
- Run the real app (`pnpm dev`) for anything a user sees.
- Do not write bulk generated tests. Add a test when it pins a real bug or a real edge case.

## Records

- A decision that changes direction gets a row at the top of `docs/decisions.md`, saying who made
  the call. Update `docs/design.md` in place to match; no amendments, no work logs in this file.
- A new directory needs a part in `parts.json`; then run `node checks/gen-map.mjs`.

## Git

- Never commit, push, merge or deploy without the owner's say-so.
- Commit messages never mention AI tools or assistants.
