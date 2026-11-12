# Lokus

Local-first markdown notes for teams: plain files on your disk, a live-preview editor, and
real-time collaboration.

**This branch (`next`) is a ground-up rewrite and is not usable yet.** The released app is at tag
`v1-legacy`.

## Run it

Needs Rust (stable), Node 22+ and pnpm 10.

```sh
pnpm install
pnpm dev                                    # the desktop app
cargo run -p lokus-cli -- commands.list     # every core command
node checks/run.mjs                         # the hard rules
```

## Find your way

- [`MAP.md`](./MAP.md): where each kind of change goes.
- [`AGENTS.md`](./AGENTS.md): the rules.
- [`docs/design.md`](./docs/design.md): how it works. [`docs/decisions.md`](./docs/decisions.md): why.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md).
