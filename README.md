# Lokus

Local-first markdown notes for teams. Your notes are plain `.md` files in a folder you choose;
Lokus adds a live-preview editor, links and search across them, Notion-style pages and databases,
and real-time collaboration through a small server you can host yourself.

**This branch (`next`) is a ground-up rewrite in alpha.** It runs and is used through the
commands below, but it has no signed release yet. The previous app is at tag `v1-legacy`.

## What works

| | |
|---|---|
| Editor | Live preview over the real markdown text, auto-paired `**`, slash menu, tables, images, embeds, paste or drop a file |
| Pages | Icon, cover and properties in frontmatter; table and board views over a folder's notes |
| Finding things | Full-text search, backlinks, graph, go to note or heading |
| Teams | Workspaces, owner / editor / viewer roles, invites, live co-editing with presence, offline edits that merge, attachments |
| Assistant | Bring your own key (Claude, or anything OpenAI-compatible); it reads and edits notes with your approval; MCP tool servers |
| Plugins | Sandboxed, permission-checked; see [`docs/plugins.md`](./docs/plugins.md) |
| Everyday | Daily note, templates, trash and version history, light and dark themes |

Not there yet: mobile apps, a hosted server, signed installers. See the milestone table in
[`docs/design.md`](./docs/design.md).

## Run it

Needs Rust (stable), Node 22+ and pnpm 10.

```sh
pnpm install
pnpm dev                                    # the desktop app
pnpm build                                  # a release build of the app
cargo run -p lokus-cli -- commands.list     # every core command
node checks/run.mjs                         # the hard rules
```

Everything the app does is a command, so it can be driven from a terminal:

```sh
lokus search.query --vault ~/notes q=launch
lokus ai --vault ~/notes q="what is still open for the launch?"
lokus sync --vault ~/notes server=https://relay.example.com workspace=ID token=TOKEN
```

## The server

Team sync needs the relay. It is one binary with one SQLite file:

```sh
docker build -f crates/lokus-server/Dockerfile -t lokus-relay .
docker run -p 8787:8787 -v lokus-data:/data -e SUPABASE_URL=https://YOUR-PROJECT.supabase.co lokus-relay
```

A Supabase project that signs logins with a shared secret (older projects do) also needs
`-e SUPABASE_JWT_SECRET=...`; the relay says so at start-up if that is the case.

## Find your way

- [`MAP.md`](./MAP.md): where each kind of change goes.
- [`AGENTS.md`](./AGENTS.md): the rules.
- [`docs/design.md`](./docs/design.md): how it works. [`docs/decisions.md`](./docs/decisions.md): why.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md).
