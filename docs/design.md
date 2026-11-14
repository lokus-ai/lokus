# Lokus design

One living document. It describes the system as it is designed today and is edited in place;
there are no amendments. Why a choice was made, and who made it, is in
[`decisions.md`](./decisions.md).

Status words used below: **built** (in this branch and runnable), **building** (the current
slice), **planned** (designed, no code).

## 1. Goal

A notes app for teams that feels like Notion and Obsidian together: plain markdown files on your
disk, a fast live-preview editor, and real-time collaboration. Local-first: every device has a
full copy and works offline; the server is where devices meet. Light and quick, without giving
up features or UX to get there.

This is a ground-up rewrite. The previous app is kept at tag `v1-legacy` for reference only;
none of its code is carried over.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Tauri 2 | One Rust codebase for macOS, Windows, Linux, iOS and Android; uses the system webview |
| Logic | Pure-Rust `lokus-core` | Files, index, search, links and sync live here; no Tauri and no networking inside it |
| UI | React + TypeScript | A view layer only: it renders and sends commands |
| Editor | CodeMirror 6 | The markdown text is the document, so saving cannot corrupt a file; gives live preview |
| Collaboration | Yjs in the editor, `yrs` in Rust | Same format on both sides; offline merge and live cursors |
| Server | Supabase (auth, Postgres, storage) + one Rust websocket relay | Supabase alone cannot relay durable edits |
| Analytics | PostHog | Product events only, with an opt-out; note content is never sent |

## 3. Repo layout

```text
crates/
  lokus-core/     vault, commands, watcher; later index, search, links   (building)
  lokus-cli/      the `lokus` binary: run core commands on a real vault  (building)
  lokus-sync/     CRDT documents, local update store, sync client         (planned)
  lokus-server/   websocket relay, roles, persistence                     (planned)
apps/
  desktop/        Tauri shell: thin, forwards commands                    (building)
  mobile/         the same shell on mobile targets                        (planned)
ui/src/
  bridge/         the only code that calls Rust, the network, Supabase or PostHog
  shell/          layout, tabs, command palette, quick switcher, tokens
  editor/         CodeMirror extensions
  features/       one folder per feature (file-tree, page-header, auth, analytics, ...)
checks/           the scripts that enforce the hard rules
docs/             this file and the decision log
parts.json        which part owns which folder; MAP.md is generated from it
```

## 4. Data pipeline

1. A keystroke becomes a CRDT update in the editor.
2. The core stores the update in local SQLite and writes the plain `.md` file shortly after.
3. The core updates the search index and the link and backlink index.
4. The sync client sends the update over a websocket; the relay stores it and fans it out.
5. Other devices apply it and rewrite their `.md` file.

Today (**building**): steps 1 to 2 without the CRDT. The editor holds the text, the core writes
it atomically (temp file, then rename), and a watcher reports outside changes. Steps 3 to 5 are
**planned**.

The vault is plain markdown. Page cover, icon and properties live in YAML frontmatter, so a note
is still a normal file in any other editor. App state lives in `.lokus/` inside the vault.

## 5. Commands, and how we test

Every feature is a named command with JSON in and JSON out: `note.create`, `vault.tree`,
`editor.toggleBold`, `team.invite`. The same commands power the command palette, keyboard
shortcuts, plugins and AI tools.

- **Core commands** are registered in `lokus-core`. The Tauri shell exposes a single `run`
  entry that forwards to that registry.
- **UI commands** (editor and shell actions) are registered in the UI.
- **`lokus` CLI** runs any core command against a real vault:
  `lokus note.read --vault ~/notes '{"path":"Welcome.md"}'`.
- **Dev channel** (debug builds only): a unix socket in the running app that runs any command,
  core or UI, and returns the real result.

Testing is running real commands on real files and checking the real result, plus a small set of
scripted flows. We do not write piles of generated unit tests. The one always-on check is
fidelity: `vault.fidelity` reads and rewrites every note in a deliberately nasty fixture vault
and fails unless every file is byte-identical.

## 5b. Everyday features (built)

Small things that make it a daily driver, all plain commands over plain files:

- **Links inside a note:** `[[Note#Heading]]` and `[[Note^block]]` open the note at that place;
  `![[Note#Heading]]` embeds just that part. "Go to a heading" lists the open note's headings.
- **Daily note:** `Daily/YYYY-MM-DD.md`, created on first use from `Templates/Daily.md` if present.
- **Templates:** any note in `Templates/`; `{{date}}`, `{{time}}` and `{{title}}` are filled in.
- **Trash:** deleting moves a file to `.lokus/trash/`; "Restore from the trash" puts it back.
- **Version history:** when a note is overwritten (by you, a teammate's edit or the assistant) its
  old text is kept in `.lokus/history/`, at most one copy every five minutes and fifty per note.
  "Version history" restores one; what it replaces is kept too. History is per device and does
  not follow a rename.
- **Settings:** a dialog with pages for appearance (theme), the editor (typeface, text size, line
  spacing, page width), the assistant, plugins and privacy. The assistant's model is chosen in the
  chat box.

## 5c. Customers (page, list, people and the push door built; no connectors yet)

For a small team that cannot see, across Slack, Linear, messages and its own admin page, which
customer needs someone and what that customer's story is.

| Thing | What it is on disk |
|---|---|
| A customer | A note with `type: customer`, by default in `customers/`. Every other property is a fact about them; none is a fixed field |
| Something that happened | A note in the folder named after the customer (`customers/Acme/`), with `kind` (issue, message, event), `source` (slack, linear, admin), `at`, `status`, `from` and `title` |
| The summary | The customer note's `summary` property |
| The list | A note with `view: customers` and `source: <folder>` |

- **The customer's page** is a note like any other: the same title, icon and cover, in the same
  column. Under the title come the details as a list of properties (health first, with the
  reason in words), then where things stand, open issues, activity by day, and the note's own
  text under "Notes". All of it is edited in place.
- **The list** is one table split into "Needs attention" and "Doing fine", ordered by health,
  then open issues, then silence. A "What is going on" column gives the reason in words (open
  issues, any date detail coming up within 45 days, silence of 14 days). After the fixed
  columns come the team's own: "Add column" at the end of the header picks an existing detail or
  makes a new one with a type; a column's header menu sorts, sets its type, moves it and
  removes it; a cell in a team column is edited in place.
- **Conversations.** A message carries `thread`, `channel` and `direction` (`in` from the
  customer, `out` from us). Messages with the same thread are one conversation: a single line
  that opens into who said what, in order. When the customer spoke last it is marked "Waiting
  on us", and that becomes a reason in the list ("Waiting on our reply for 2d").
- The list has a "Waiting on us" view: every conversation, across customers, where the customer
  spoke last, the longest wait first. It cannot yet tell a question from a thank-you.
- Clicking an issue or event opens the rest of it underneath, in place; "Open as a note" is
  there for when the note itself is wanted.
- **Pictures.** A page's `icon` may be a picture (a file in the vault or a web address) as well as
  an emoji. A customer's is its logo and a person's is their face; it shows on the page, its tab,
  the list and the people rows. Without one, the first letter is shown.
- An issue is open unless its `status` is done, closed, resolved, fixed or cancelled.

**Details have types, and the team chooses them.** A detail is text, a number, money, a date, a
person, a label or a link. The type decides how it is shown and sorted (money gets its sign and a
total under its column; a date reads "Dec 15, 2026, in 32d"). Nothing reads the type from the
detail's name. The choices live in the list's own note, so the whole team shares them:

| Property on the list note | Holds |
|---|---|
| `fields: [seats number, renewal date]` | the type of each detail the team has set |
| `hidden: [signed_up]` | details kept off the customer's page |
| `columns: [plan, owner, mrr]` | the list's columns, in order |

A detail the team has not typed starts from a short built-in list (plan, owner, mrr, domain,
renewal) and otherwise from what its value looks like. Each detail's menu sets its type, hides
it, and shows its history.

**History of a detail.** When a detail changes, whatever changed it also adds an event note with
`field: <name>` ("Plan changed from Growth to Scale"). The detail's menu lists those. Editing a
detail by hand in the app does not record history yet.

**People.** Someone at a customer is a note with `type: person` and `customer: <name>`, by
default in `people/`. A person is the same person whichever tool names them: an item's `from`
is theirs when it matches the note's name, `email`, `slack` or anything in `also`. The
customer's page lists its people (who is waiting on us, who has open requests); a person's page
shows what they asked for and every conversation they took part in.

**Getting data in: the push door (built; live only on a relay running this build).** A team's
own systems send facts; Lokus does not ask each team to build an API.

```
their backend --POST /v1/ingest (key)--> relay inbox --one device takes it--> notes --sync--> everyone
```

- An owner makes a key in Settings, Team. The key is shown once; the relay keeps only its hash.
  A workspace has at most 20; removing one stops it at once; making and removing are recorded.
- A fact names a customer (its domain, the team's own id, or its name) and carries any of:
  `set` (details; each key becomes a property), `event` (one thing that happened: an issue, a
  message, a payment), and `person`. Up to 100 facts a request, 32 KB each.
- The relay checks only the envelope. It never reads or writes a note, so it keeps each fact in
  an `inbox` table until one signed-in device that may edit takes it, writes it, and says so.
  A fact is handed to one device at a time; one that was taken and not finished is handed out
  again after two minutes. At most 10,000 may wait.
- The writing is `lokus_core::ingest::apply`: it finds or makes the customer's note, sets the
  details, writes a history event for each detail that changed, and upserts the event and the
  person. The same fact twice changes nothing, so a sender may retry. A name is only ever a
  file name, never a path; a detail may not be `type`, `view`, `source` or `summary`; text is
  kept to one line so it cannot start a second properties block. A fact that makes no sense is
  reported and dropped, not retried.
- Settings also gives the owner a request to paste into a terminal and a brief to hand a coding
  assistant, which is how "the assistant sets it up" works today.

Checked by tests in `crates/lokus-core/src/ingest.rs`, one in `crates/lokus-server/tests/relay.rs`,
and the flow `checks/flows/push-facts.sh` (a backend, a relay and three devices).

**Not built:** the Slack, Linear and Granola connectors (they would send the same facts),
a place for facts whose customer is
ambiguous, the assistant writing the summary, replying to a message from Lokus, opening an item
in the tool it came from, and limits on how fast one key may push.

### Any kind of thing, and logs (built; tried with a made-up survey company's data)

The push door also takes records that are not customers. `{"kind": "order", "id": "A-1042",
"set": {...}, "links": {"customer": "acme.com"}}` becomes `data/order/<name>.md` with `type:
order`, its `id`, and whatever was sent as properties: nested objects flattened
(`address_city`), lists of plain values kept as lists, lists of records counted (`items_count`)
and kept as a JSON block in the note. `links` become properties holding `[[links]]` to the
customer or to another thing (made as a placeholder if it has not arrived). A changed detail
leaves a history note; an `event` is filed under the thing. Each kind gets `data/<Kind>
list.md`, an ordinary table view. `crates/lokus-core/src/things.rs`.

`{"log": {"message", "level", "stream", ...}}` is appended to
`.lokus/logs/<stream>/<day>.jsonl`: not synced, two weeks kept, 20 MB a day per stream. The
assistant reads them with `search_logs`.

Not built: asking their system to do something (the door is one way), a page made for a kind
(things open as plain notes with properties), logs on teammates' devices.

## 5d. Tasks (built)

The team's work, kept the way customers are: one note each.

| Thing | What it is on disk |
|---|---|
| A task | A note with `type: task` in `tasks/`. Its file name is its title. Properties: `number`, `status` (backlog, todo, doing, review, done, or a word of the team's own), `priority` (urgent, high, medium, low), `assignee`, `customer`, `due`, `labels`, `link` |
| The board | A note with `view: tasks` |

- Each task gets the next number and is spoken of as `T-12`. `lokus_core::tasks::record` adds a
  task or updates one named by its number or its title, so recording the same task twice does not
  make two. The command is `tasks.record`.
- **The board** has a column per status and cards dragged between them; **the list** is the same
  tasks grouped the same way. A card shows the number, priority, customer, labels, due date and
  whose it is. A task's own page shows those as properties, changed in place, above its text.
- **Tied to customers.** A task with `customer:` shows under Tasks on that customer's page, and
  one can be added from there. A fact pushed through the data door may carry a `task`.
- **Kept in step by the assistant.** Its standing instructions tell it that when a customer
  reports a problem or asks for something it looks at the board first, updates the task that
  already covers it or adds one tied to that customer, labels it (bug, request, billing,
  question), and when what was said shows the customer may leave, labels the task `churn-risk`,
  raises its priority and sets the customer's health to at risk. It does this when asked ("bring
  the board up to date"), not yet by itself as messages arrive.

**Not built:** the assistant acting on new messages without being asked, sub-tasks, cycles or
sprints, estimates, a roadmap or timeline view, comments on a task, and reading Lokus 1's
`.kanban` files.

## 5e. First run, the start page, windows and layout (built)

- **Setup** (`ui/src/features/onboarding/`): shown once, in the first window. One question a
  screen; a small picture of their Lokus fills in as they answer. The last screen does the work
  in front of them: makes Documents/Lokus if no folder is open, creates `Customers.md` and
  `Tasks.md` when asked for, and writes "About this workspace" into `Assistant.md` so the
  assistant knows what they are here for. `Lokus: run the setup again` replays it.
- **Start page**: what shows when nothing is open. Cards ordered by what they said they use,
  their aim, the tools they named but have not connected, and their notes.
- **Windows** (`apps/desktop/src/windows.rs`): File, New Window (Cmd+Shift+N). Every window
  shows the same folder; tabs, panels and dialogs are each window's own. The theme and layout
  preferences follow across windows; Cmd+W goes to the window in front. If one window opens a
  different folder, all follow, because the core holds one open folder.
- **Layout** (Settings, Appearance): Spacing (roomy, regular, compact), Detail (essentials,
  balanced, everything) and what is on screen when Lokus opens. `styles/density.css`.

## 6. Sync and the server (built, M3)

Client-server; no peer-to-peer. Three places, each owning one thing:

| Piece | Owns | Built on |
|---|---|---|
| Accounts | Who you are: sign-up, sign-in, sessions | Supabase Auth |
| Relay | Workspaces, members, invites, every note's edit log, attachments, and a record of who changed who may do what | Our own small Rust service (axum + `yrs`), one SQLite file |
| Device | The notes themselves, as plain files, plus rebuildable sync state in `.lokus/` | `lokus-sync` |

The relay runs as a single binary or container with a volume. The hosted one is described in `deploy/relay/README.md`. It never interprets a note: edits
are opaque CRDT updates. The app's editor binds to a Yjs document and passes updates to the
engine in `lokus-sync`, which writes the file.

**The relay's tables**

| Table | Holds |
|---|---|
| `workspaces` | id, name, who created it and when |
| `members` | workspace, user, email, role, when they joined |
| `invites` | code, workspace, role, who made it, when it runs out, whether it was cancelled, who used it; for one sent by email: the address, the name the owner goes by, when it was last emailed and how often |
| `updates` | the edit log: a running number, workspace, note id, the edit, who made it and when |
| `blobs` | attachments under the hash of their bytes, with size, who stored them and when |
| `audit` | who changed who may do what; kept even after a workspace is deleted |
| `ingest_keys` | keys a team's own systems push customer facts with: a hash, a name, who made it, when it was last used |
| `inbox` | pushed facts waiting for a device to write them into notes, and which device has taken each |

Once a note has 200 stored edits they are folded into one row. A note's text is whatever its
edits add up to; that is the cloud copy.

**Who may do what**

- Roles are owner, editor and viewer per workspace. Per-folder permissions come later.
- An owner invites (one person per code, good for seven days, cancellable), changes roles,
  removes people and can delete the workspace. Anyone can leave. A workspace always keeps at
  least one owner.
- A device signs in with its Supabase token, verified against the project's published keys (or
  its shared secret). The token is the socket's first message, never part of its address.
- The role is looked up when the socket opens, not per edit, and looked up again the moment that
  person's place changes: a removed member's open sockets are closed at once and a changed role
  applies at once.
- A socket does not outlive its sign-in. The app hands each fresh account token (about hourly)
  to the running connection; a socket that is not renewed is closed a minute after its token
  runs out.

**What the relay refuses**

- Note ids that are not a UUID or `manifest`, edits that are not well-formed updates, presence
  messages that are not a short string, and workspace names that are not one short line.
- More than 25 MB in one attachment, more than 5 GB of attachments in one workspace
  (`LOKUS_WORKSPACE_BYTES`), more than 50 open invites, more than 50 workspaces per owner.
- A socket that sends more than about 200 edits a second is slowed down, not cut off.
- Every statement to the database passes its values as parameters.

**What a device refuses**

Another device can only name a place inside the vault. A path that would leave it, follow a link
out of it, or reach into `.lokus/` is skipped and reported; it never stops the rest of sync.

A vault's sync state belongs to one workspace. Pointed at a different workspace, the device
drops that state and publishes the vault afresh, so nothing from the old workspace leaks into the
new one. Only one sync engine runs on a vault at a time: a second one (another window, the
command line) is told the vault is already syncing. A burst of local edits is sent as one batch.

**Where people manage it.** Settings, Team page: create or join a workspace, see who is in it,
change a role, remove someone, invite by email and cancel invitations, stop syncing, leave or delete.
There is no separate team window.

**Not built:** end-to-end encryption (whoever runs the relay can read the notes; see the
decision log), attachments in a bucket, and limits on ordinary requests per account.

Checked by `crates/lokus-server/tests/relay.rs` against a real relay on a local port, and by two
scripted flows: `checks/flows/sync-devices.sh` and `checks/flows/live-coedit.sh`.

Device and relay exchange only what the other is missing; after that edits are relayed live.
Cursors and presence pass through memory and are never stored. A personal vault is local-only
by default; turning sync on makes it a one-person workspace on the same pipeline.

### Files that are not notes (built; tried in the real app with a ChatGPT-plan model)

A vault holds pictures, PDFs and CSVs beside its notes, and they sync like any attachment.

- **Looking at one.** Clicking a file in the sidebar opens it in a tab: a picture as a picture,
  a PDF in the system's own PDF view, a CSV as a table (first 1,000 rows), a text file as text.
  Nothing is edited there. `file.read` hands a file over whole and `file.text` gives its words
  (a PDF's text through `pdf-extract`), in parts for a long one.
- **Attaching to the assistant.** The + in the message box, a drop or a paste puts a file with
  the next message; "Ask about this" on an open file does the same. A file from outside is
  first kept in `attachments/`, so the conversation can be reopened and a teammate has it too.
  The conversation stores only the file's place (`{type: "attachment", path}`); what the model
  is sent is made for each request in `lokus-ai/src/files.rs`: a picture as a picture (all
  three providers), anything with words as up to 24,000 characters of them, the rest read with
  `read_file`. A picture over 4.5 MB is named and left out.
- **Files the assistant makes.** `create_file` writes a CSV, an SVG chart or a text file;
  `create_pdf` writes a PDF from text laid out like a note (`file.pdf`, Latin letters only, since
  it uses the fonts every reader has). Both ask first. What was made shows as a card under the
  reply, a picture as itself, and opens in a tab.
- **Not built.** Pictures made by an image model; looking at a picture already in the vault
  without it being attached; scanned PDFs (no text in them); editing a CSV in place.

### Workspaces and the switcher (built; tried in the real app)

A workspace is a folder. A person can have several (one for a team, one for school) and
nothing is shared between them. The shell keeps the list of every folder opened in Lokus
(`vaults.json` beside `last-vault`; a folder that is gone drops out). The workspace's name at
the top of the sidebar opens the switcher, after Notion's: the open workspace with Settings
and Invite people, the others with "Team" on the shared ones, invitations waiting with a Join
button, and "Add workspace", which makes a folder of that name in Documents. A new workspace
is private; sharing it is one step under Settings, Team. Every window still shows the same
workspace: switching in one switches them all.

### Inviting by email (built; tried in the real app against a local relay with a stand-in mail service; no real email has been sent yet)

An owner types an address under Settings, Team. The relay emails that person from
`noreply@lokusmd.com`; they sign in to Lokus with that address and the invitation is waiting.
Nobody copies or pastes a code.

- **Sending.** `POST /v1/workspaces/{id}/invites` with an `email` makes the invite and sends
  it through Resend's HTTP API (`crates/lokus-server/src/mail.rs`). The relay needs
  `LOKUS_MAIL_KEY` and `LOKUS_PUBLIC_URL`; without them it sends nothing and says so, and
  invites go out as links as before. A reply to the email goes to the owner who invited.
- **The email** (`assets/invitation.html`) says who invited whom to what, as what, with one
  button and the three steps after it. It is the app's own colours, light and dark.
- **The link** opens `/join/{code}` on the relay: the same facts, the installers for the newest
  build, which address to sign in with, and the code for someone who signs in under another.
- **Waiting.** `GET /v1/invites/mine` gives the invitations addressed to the signed-in
  person's email. The app asks on sign-in and when the window is returned to. In first-run
  setup it is the step after signing in, and joining skips the questions about pages (those
  are the team's). Afterwards it is a card, and stays under Settings, Team if put away.
- **Where the workspace lands.** A folder that holds the person's own notes is never merged
  into a team silently: the card offers a new folder in Documents named after the workspace
  (the default) or the open folder, saying how many notes would become the team's.
- **Limits.** One live invitation per address per workspace (a new one replaces the old); not
  to someone already inside; 60 emails a day per account; the same one again after a minute.
  A person's name is not printed if it looks like a link or an address, and everything typed
  by a person is escaped.
- **What it rests on.** "Waiting for you" trusts the address in the sign-in, so email
  confirmation must stay on in Supabase. The code in the link still works for whoever holds
  it, once, as before.
- **Not built.** A `lokus://` link that opens the app from the email (the app has no link
  scheme yet); telling the owner when an invitation is declined.

### Attachments (built)

Files that are not notes (images, PDFs) are not merged. The manifest records each path's content
hash; the bytes are stored on the relay under that hash (`PUT`/`GET
/v1/workspaces/{id}/blobs/{hash}`, 25 MB limit, in the same SQLite file); each device fetches what
it lacks. A local file is never overwritten by a different one: it is kept beside it as
"name (local copy)". Pasting or dropping a file into a note saves it in an `attachments` folder
beside the note and links it.

### Keeping `.md` files and the CRDT in step

The hardest part. Rules, taken from the Obsidian plugin Relay, which hit these bugs first:

1. A file's content enters the CRDT exactly once; after that only minimal diffs are applied.
   Never delete-all and reinsert.
2. Never write to disk while the note is open in the editor.
3. An outside change is three-way merged against the last synced text. A true conflict becomes a
   conflict file.
4. Do not publish local files until the first server sync completes, or stale devices bring
   deleted notes back.
5. Normalise line endings for diffing only; the file on disk keeps its own.

### Releases and news (built; tested on macOS with three local releases)

The relay also answers every copy of the app, signed in or not: `GET /v1/app/update/{target}/{arch}/{version}`
(the newest build for that platform, or 204) and `GET /v1/app/news` (posts, newest first). Tables
`app_releases (version, platform, url, signature, pulled)` and `app_news (id, body, at)`.
Publishing needs `LOKUS_PUBLISH_KEY`. The app installs a download only if it carries our
signature for that version. The window's side is `ui/src/features/updates/`; the steps a person
goes through, how to publish, and what was tested are in `docs/releasing.md`.

## 7. Plugins (built)

A plugin is a folder in the vault, `.lokus/plugins/<id>/`, with a `manifest.json` and its files.
`docs/plugins.md` is the guide for writing one; `examples/plugins/word-count` uses every part of
the API.

- **Isolation:** each plugin runs in a sandboxed frame with its own null origin. Its files are
  served by the app over `lokus-plugin://`, with a content-security policy built from the
  manifest, so a plugin can load only its own files and reach only the network hosts it declared.
  It has no access to the main window, Tauri, the filesystem or the app's storage.
- **One API:** the frame gets a `lokus` object that sends messages to the app. Every request is
  checked against the manifest's permissions: `vault:read`, `vault:write`, `editor`, `net:<host>`.
  Each core command is marked read, write or private (`core.commands`); private ones (plugins,
  index, anything about the app itself) are never reachable from a plugin.
- **Contributions,** all declared in the manifest so the app can show them without running the
  plugin: commands, views (the plugin's own page in the side panel), settings (a schema the app
  renders), slash-menu snippets, and tool servers for the assistant.
- **Manifest:**

  ```json
  { "id": "", "name": "", "version": "", "apiVersion": 1, "main": "main.js",
    "permissions": ["vault:read", "net:api.example.com"],
    "contributes": { "commands": [], "views": [], "settings": [], "snippets": [], "mcpServers": [] },
    "activation": ["onStartup"] }
  ```

- A plugin loads when one of its commands or views is first used, unless it asks for `onStartup`.
- Plugins are installed from a folder, start switched off, and show their permissions in plain
  words in Settings before they are switched on.
- One API and one integer `apiVersion`. No second "trusted" tier.
- Not built: editor decorations from plugins, install from a URL, a marketplace, plugin-to-plugin
  calls.

Checked by `checks/flows/plugins.sh`, which installs a hostile fixture plugin in the real app and
confirms that everything it must not be able to do is refused.

## 8. AI and MCP (built; untried against a real provider)

`lokus-ai` holds all of it; the UI is a chat panel and a settings section.

- **Bring your own key.** The key lives in the OS keychain. Every provider call is made from
  Rust, so the UI and plugins never see a key. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are read
  as a fallback, which is how the command line and the scripted flow supply one.
- **Three wire formats:** Anthropic's Messages API for Claude (default model Claude Opus 5.5), the
  OpenAI chat-completions format for OpenAI and any compatible service, and the OpenAI Responses
  API for a ChatGPT plan. Conversations are
  kept in one shape and translated on the way out.
- **Tools, in three groups.** Reading the vault (search, read a note in parts, list one folder,
  backlinks) never asks. Changing it (create, edit by exact-match replace, move, set a property)
  waits for the person to allow it unless they switch that off, as does any tool-server action
  not marked read-only. Acting on the app (open a note at a heading, show the graph) never asks;
  the window carries these out. Every result is capped, and a cut result says how to see the rest.
- **Context.** One loop, one conversation, only ever added to. Each conversation starts with a
  briefing that then never changes: the date, the shape of the vault, and the person's standing
  instructions from the note `Assistant.md`. Each message carries a small `<app_state>` block
  (open note, selection); the open note's text is attached only when it is new or has changed.
  Note text and tool results are treated as information, never as instructions.
- **MCP:** tool servers over HTTP through the official Rust SDK (`rmcp`), added by address in
  Settings or contributed by a plugin. A server that asks for sign-in gets it: "Sign in" opens
  the browser, the app catches the redirect on a local port, and the SDK keeps the tokens fresh.
  Tokens live in the keychain (in memory until the app quits if the keychain is unavailable).
  Not built: local (stdio) servers.
- `lokus ai --vault DIR q=...` asks one question from a terminal.
- **Sign in with ChatGPT** (built; never run against OpenAI). A third provider choice that uses
  the person's own ChatGPT Plus or Pro plan with no key. OpenAI's developer pages (read
  2026-11-12) say plan usage is open to open-source apps that run on the person's machine, which
  is what Lokus is; registration is automatic on first sign-in. The flow is OAuth with PKCE and a
  redirect to `127.0.0.1`; requests go to the Responses API with `store: false`. If Lokus ever
  ships a hosted or paid build, that build needs OpenAI's separate approval.

Checked by `checks/flows/assistant.sh` against a stand-in provider and tool server
(`checks/flows/mock-ai.py`): the full loop in both formats, a declined edit, a refused key. The
flow's stand-in sign-ins go to a keychain of their own (`LOKUS_KEYCHAIN`), not the app's.
Not built yet: saving conversations to disk, and compaction of very long ones.

### Working on its own (built; tried on a real workspace)

`ui/src/features/noticed/` wakes the assistant while the app is open: on a timer (hourly unless
changed in Settings, Assistant), 90 seconds after a customer fact is pushed in, and with any
note in `watches/` marked `type: watch` (`every:` minutes) added to what it looks for. A look is
an ordinary request with one difference: every tool that would change something is refused.
What it finds goes through two tools into `.lokus/noticed/` (never synced):

- `report_finding`: a plain statement, the one thing recommended, up to three facts with their
  sources, an `action` it can carry out later, and the kind of `situation` with no names in it.
  The tool refuses anything longer than a glance.
- `suggest_note_change`: text for a note, shown on that note as a suggestion until added or
  dismissed.

"Do it" hands the action to the assistant in the open, where each change is asked about, and
writes what was chosen under "How we handle things" in `Assistant.md`, which every request and
every look is shown. Not built: looking while the app is closed, system notifications, a
team's own admin API as a connection (it works today only if that API is offered as an MCP
server), GitHub.

### A team's own API (built; tried on Clean's real staff API)

Settings, Connections, "Your own product's API": a name, an address, a key (kept in the
keychain, sent as a Bearer token) and a few words on where to start. `crates/lokus-ai/src/own_api.rs`
offers the assistant `api_get` and `api_send` whenever one is switched on, and tells it each
system's name, address and starting point. The path is joined to the address and checked to
still lead there; redirects are not followed; plain http is allowed only for this computer.

### What a request is made of

Every request carries the instructions, a briefing about this workspace, the conversation, and
the tools. Lokus's own tools (16) are always there. A connected service's tools are offered
directly only while all of them together stay under 40,000 characters; past that they go on a
shelf: the instructions list each by name with one line, and the assistant calls `load_tools`
for the ones it needs. Tools a conversation has used stay loaded for the rest of it. Each
request's make-up is measured and sent with its trace (`chars_tools_<service>` and so on).

### Connections (the catalog is built; signing in to a real service is untried)

A connector is a tool server (MCP) that a service runs itself. Settings, Connections lists them
by name: Connect signs the person in with that service in the browser and the assistant gains
its tools, named `mcp__<id>__<tool>`. Each can be switched off or disconnected. Anything that
changes something asks first unless the person has turned asking off.

The list is `lokus_ai::catalog`: an id, a name, an address, and whether a person can connect
today. Checked against the live servers on 2026-11-13:

| Ready now | Waiting for Lokus to be registered with the service | Not built |
|---|---|---|
| Linear, Notion, Granola, Sentry, Jira and Confluence, Stripe, Intercom, Zapier, and Slack (in the workspace its app was made in; see `deploy/slack/`) | GitHub, Gmail, Google Calendar, Google Drive, Asana, HubSpot | iMessage (runs on the Mac, not at a service) |

A server that is not listed can be added by its address. A plugin can still bring its own.

**Not built:** connectors filling customer pages on their own (today the assistant can read a
connected service when asked, and only a team's own backend pushes facts); an identity for
Lokus that services can look up (a client metadata document at a web address), which the newer
sign-in rules prefer over registering on the fly; choosing which of a connector's tools are
allowed; and installing connector bundles (a server plus instructions) from a shared catalog.

## 9. UI and design tokens (building)

Tokens are set before screens are built, and every component reads them.

- **Type:** Inter for UI; 16px body at 1.5; 40px page title; editor font switchable between sans,
  serif and mono.
- **Layout:** 720px reading column; sidebar 248px; 28px rows on desktop, 44px on mobile; cover
  240px with a 72px icon overlapping its bottom edge.
- **Surfaces:** slightly warm neutrals, 1px low-contrast borders, layered soft shadows on
  popovers. Radii 4, 6, 8, 12.
- **Colour:** one accent, used only for primary buttons, links, focus and selection.
- **Motion:** 80ms hovers, 140ms menus, 220ms dialogs. Typing and the caret are never animated.
  Honour reduced-motion.
- **Patterns:** chrome that appears on hover; a slash menu showing the markdown shortcut; share
  as a popover; search with a preview pane; settings as a full page.

Most of the reference numbers were estimated from screenshots, so they are a starting point to
tune by eye in the real app.

## 10. Security

Basic and unbloated for now: TLS, Supabase login tokens, workspace roles enforced on the server,
provider encryption at rest. No end-to-end encryption; the server can read content, which is what
later allows web access, share links and server-side search. Advanced security is added when it
is needed.

## 11. Milestones

| # | Slice | Done when | Status |
|---|---|---|---|
| M0 | Skeleton, rules, checks, CI | The empty app builds and the checks pass | built |
| M1 | Single-player editor, file tree, tabs, quick switcher, login, analytics | A real vault opens and saves byte-identical | built (login and analytics not yet tried against the real services) |
| M2 | Search, backlinks, graph, slash menu, embeds | Usable as a daily driver | built |
| M3 | Relay, teams, invites, roles, live cursors, offline merge | Two devices editing one note converge | built; checked with real sign-ins on several devices against a local relay; the hosted relay is live and checked with one signed-in device |
| M4 | iOS and Android | Builds in TestFlight and the Play internal track | skipped for now by the owner. Already in place for later: a phone entry point, a layout that works at phone width, touch-size targets |
| M5 | Databases and kanban | Query engine with new UI | built: table and board views over a folder's note properties |

| M6 | Plugins | A sandboxed plugin adds a command, a view and a setting, and cannot do what it was not granted | built |
| M7 | Assistant: bring your own key, vault tools, MCP tool servers | A question about the vault is answered from the notes, and an edit waits for a yes | built; checked against a stand-in provider only, never a real one |

## 12. Risks

1. **Mobile keyboard in Tauri.** Open bugs push the webview off screen on iOS and behave
   inconsistently on Android. Prototype during M1, not M4.
2. **Deletes and renames across devices.** Where Relay had most of its bugs.
3. **Three-way merge on large notes** can stall the UI; it runs in Rust, off the UI thread.

## 13. Cut from the rewrite

Calendar, Gmail, MathGraph, the terminal panel, the old templates engine, the old plugin system,
end-to-end encrypted team sync, and the manifest-based personal sync. Existing users of the old
sync get a sunset notice; their notes are plain files and are unaffected.
