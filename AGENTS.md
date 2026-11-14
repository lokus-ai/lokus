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

## Principles (review, not checks)

Every agent working here follows these. They are the owner's.

### Size the thing to the need

- **Build what is needed now, not what might be.** No rule, check, abstraction or security layer
  before something has actually broken without it. A file over about 1,000 lines gets a warning,
  not a failure.
- **One remark is not a mandate.** A stated preference ("lightweight") is weighed against UX and
  features; it does not bend the whole design. Do not go to extremes on it.
- **But do not under-build either.** The parts that cannot be retrofitted are done properly the
  first time: the plugin sandbox, byte-identical saves, sync that never overwrites a file.

### One of everything

- **One owner per thing:** one markdown parser, one index, one module writing each table.
- **Strip, then replace.** To swap an approach, first remove every trace of the old one (files,
  tables, config, dependencies) in its own commit, then build the new one. No `_v2`, `legacy` or
  fallback copies.
- **No versioned contracts.** Before launch, change schemas and APIs in place. Never run two
  versions side by side.
- **Half-built work is finished or deleted,** never parked.

### Shape

- **Logic in Rust, UI only renders.** The UI reaches the outside world through one folder
  (`ui/src/bridge/`).
- **Everything is a command.** A feature is a named command with JSON in and out, so the CLI, the
  palette, shortcuts, plugins and the assistant all reach it the same way.
- **Plain files are the truth.** Anything derived (the index, history, sync state) can be deleted
  and rebuilt.
- **Works offline.** Opening and editing a note never needs the server.
- **The server checks permissions** when a connection opens and again the moment someone's
  access changes, not per edit.

## Proving it works

"Done" means shown working with real output, in the real app, on real files; not only passing
tests.

- Run the command for real: `cargo run -p lokus-cli -- <command> --vault <dir> '<json>'`.
- Run the real app (`pnpm dev`) for anything a user sees, and **look at the real thing**:
  `lokus app window.snapshot path=...` pictures the real window. The first real-window pictures
  found two bugs that headless screenshots had missed.
- **Say what was not verified, and why.** A stand-in is not the real service.
- Do not write piles of generated tests. A test exists when it pins a real bug or a real edge
  case. A few scripted flows (`checks/flows/`) drive the real thing end to end.

## Records

- A decision that changes direction gets a row at the top of `docs/decisions.md`, saying who made
  the call. Update `docs/design.md` in place to match; no amendments, no work logs in this file.
- A new directory needs a part in `parts.json`; then run `node checks/gen-map.mjs`.
- A default taken because nobody answered is marked as the agent's own, so it is easy to overturn.

## Pace and the owner's lines

- Never commit, push, merge or deploy without the owner's say-so.
- Batch related work and push once. CI minutes are limited; verify locally first.
- Production, credentials and other people's money wait for a yes.
- Commit messages never mention AI tools or assistants.
