# Contributing

The rewrite on `next` is moving quickly, so open an issue before starting anything large. Pull
requests against the old app (`v1-legacy`) are no longer merged.

1. Read [`MAP.md`](./MAP.md) to find where your change goes and [`AGENTS.md`](./AGENTS.md) for
   the rules. There are four hard ones; CI tells you if you break one.
2. Set up: `pnpm install`, then `pnpm dev` for the app or
   `cargo run -p lokus-cli -- commands.list` for the engine.
3. Before opening a pull request, run:

   ```sh
   cargo fmt --all && cargo clippy --workspace && cargo test --workspace
   pnpm -C ui typecheck
   node checks/run.mjs
   ```

4. In the pull request, show the change working: the command you ran and its output, or a
   screenshot of the app.

New source files start with a part marker (`//! @part-of core.vault`,
`/** @part-of ui.editor */`). A new directory needs an entry in `parts.json`, followed by
`node checks/gen-map.mjs`.
