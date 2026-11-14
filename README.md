# Lokus

The place a small team keeps what it knows and what it has to do: notes, customers and tasks in
one app, with an assistant that reads the tools the team already uses and keeps the three in
step. Everything is a plain markdown file in a folder you choose, so nothing is locked in.

**Status: alpha.** Lokus 2 is a ground-up rewrite. It runs from source with the commands below.
Mac builds are signed, notarized and update themselves. There are no Windows or Linux builds yet. The
previous app (Lokus 1) is kept at the tag `v1-legacy`.

## Get it

Early builds for Macs, for people who do not mind rough edges:
[Apple Silicon](https://github.com/lokus-ai/lokus/releases/download/v2.0.0-alpha.2/Lokus_2.0.0-alpha.2_aarch64.dmg)
or [Intel](https://github.com/lokus-ai/lokus/releases/download/v2.0.0-alpha.2/Lokus_2.0.0-alpha.2_x86_64.dmg).
Open the download and drag Lokus into Applications. It updates itself from then on.

## What it does

| | |
|---|---|
| **Notes** | A live-preview editor over the real markdown text, `[[links]]`, backlinks, full-text search, a graph, daily notes, templates, version history. Pages have an icon, a cover and properties |
| **Customers** | One page per customer: its details (any you like, each with a type), the people there, open issues, whole conversations and everything else that happened. A list that puts the customers who need someone first, and says why |
| **Tasks** | A board and a list of the team's work. Each task has a number (`T-12`), a status, a priority, an owner and, when it is for one, a customer. It shows on that customer's page |
| **Assistant** | Bring your own key (Claude, or anything OpenAI-compatible) or sign in with ChatGPT. It reads and changes notes, customers and tasks, asks before it changes anything, remembers what you tell it to, and can ask you a question with choices |
| **Connections** | Sign in to Linear, Notion, Slack, Granola, Sentry, Jira and Confluence, Stripe, Intercom or Zapier and the assistant can read and act there. Any other MCP server can be added by its address |
| **Teams** | Workspaces with owner, editor and viewer roles, invites, live co-editing with presence, offline edits that merge, attachments. Through a small server you can host yourself |
| **Your own data** | A key lets your backend send customer facts to Lokus (a plan change, a payment, a support message). Each lands on that customer's page for the whole team |
| **Plugins** | Sandboxed and permission-checked; see [`docs/plugins.md`](./docs/plugins.md) |
| **First run** | A one-minute setup asks what you are here for and builds the workspace from your answers: the pages you need, the tools you use ready to connect, the assistant told what matters |
| **Made to fit** | Choose how much is on screen: spacing, how much detail each row shows, what is open when Lokus starts. Open a second window on the same workspace with its own tabs |
| **Updates** | The app tells you when a new version is ready, installs it and restarts. News and what changed arrive inside the app. See [`docs/releasing.md`](./docs/releasing.md) |

What a typical day looks like: a customer complains in Slack. Ask the assistant to bring the
board up to date and it finds the complaint, adds or updates the task for it, ties the task to
the customer, and marks the customer at risk if the complaint sounds like someone about to leave.

Not there yet: Windows and Linux builds, end-to-end encryption of synced notes, mobile apps, a hosted server run for you, the assistant doing
this on its own without being asked, GitHub and Google connections (each needs Lokus registered
with that service first).

## Run it

Needs Rust (stable), Node 22+ and pnpm 10.

```sh
pnpm install
pnpm dev                                    # the desktop app
pnpm build                                  # a release build of the app
cargo test --workspace                      # the tests
node checks/run.mjs                         # the hard rules
```

Copy `.env.example` to `.env` to turn on accounts (Supabase), team sync (a relay address) and
usage counts (PostHog). With none of them set the app is a local, single-person notes app.

Everything the app does is a command, so it can be driven from a terminal:

```sh
cargo run -p lokus-cli -- commands.list                    # every core command
lokus search.query --vault ~/notes q=launch
lokus ai --vault ~/notes q="what is still open for the launch?"
lokus sync --vault ~/notes server=https://relay.example.com workspace=ID token=TOKEN
```

## The server

Team sync, and data pushed from your own systems, go through the relay: one binary with one
SQLite file. It never reads or writes a note.

```sh
docker build -f crates/lokus-server/Dockerfile -t lokus-relay .
docker run -p 8787:8787 -v lokus-data:/data -e SUPABASE_URL=https://YOUR-PROJECT.supabase.co lokus-relay
```

A Supabase project that signs logins with a shared secret (older projects do) also needs
`-e SUPABASE_JWT_SECRET=...`; the relay says so at start-up if that is the case. How the one we
run is set up is in [`deploy/relay/`](./deploy/relay/README.md).

## Sending your own data

Make a key in Settings, Team. Then, from anywhere:

```sh
curl -X POST https://YOUR-RELAY/v1/ingest \
  -H "authorization: Bearer lk_..." -H "content-type: application/json" \
  -d '{"customer": "acme.com", "name": "Acme", "set": {"plan": "Growth", "mrr": 900}}'
```

A fact can also carry something that happened (`event`), a person at the customer (`person`) and
work to be done for them (`task`). Sending the same fact twice changes nothing. The full shape is
in [`docs/design.md`](./docs/design.md), section 5c.

## Coming from Lokus 1

Your notes are ordinary markdown files, so Lokus 2 opens the same folder. What does not carry
over: Lokus 1's cloud sync (turn sync on again in Settings, Team), its `.kanban` and `.canvas`
files (they stay on disk, untouched, and are not shown), calendar, Gmail and the terminal panel.
See [`docs/transition.md`](./docs/transition.md).

## Find your way

- [`MAP.md`](./MAP.md): where each kind of change goes.
- [`AGENTS.md`](./AGENTS.md): the rules for anyone, person or agent, changing the code.
- [`docs/design.md`](./docs/design.md): how it is built and what is and is not done.
- [`docs/decisions.md`](./docs/decisions.md): what was decided, why, and by whom.

## License

Lokus is source-available under the [Fair Core License](./LICENSE) (`FCL-1.0-MIT`). In short:

- You may use it, change it and host it yourself, for your own team or your clients' teams.
- You may not sell it, or something built from it, as a product or service that competes with Lokus.
- Each version becomes plain MIT two years after it is released.

That is a summary, not the terms; the [`LICENSE`](./LICENSE) file is what applies. Copyright
Pratham Patel. What Lokus ships that others made, and under what terms, is listed in
[`THIRD-PARTY.md`](./THIRD-PARTY.md).
