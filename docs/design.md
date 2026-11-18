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
| Analytics | PostHog | Product events and how sync is doing, with an opt-out; note content is never sent |

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
- **Desktop menus** present those same registered commands, not separate implementations.
  On macOS, Lokus → Settings… uses Command-comma, after About and before Services. On Windows
  and Linux, Settings is in Edit, Quit in File, and About in Help; Mac-only app items are absent.
  File offers New Note, Today's Note, New Note from Template, New Window, Open Vault, Save,
  Close Tab and Close Window. Edit keeps system clipboard actions and adds search
  across notes. Format offers the existing marks, link, headings and normal text. View offers
  the command palette, note/heading navigation, sidebar, assistant and graph; Window adds next
  and previous tab to the supported system window controls. Predefined Undo/Redo and Fullscreen
  appear only on macOS; Minimize/Maximize appear on macOS and Windows, not Linux, following
  [Tauri's platform support](https://docs.rs/tauri/latest/tauri/menu/struct.PredefinedMenuItem.html).
  Ordinary editing shortcuts still belong to the focused editor or input on every platform.
  Unbuilt actions (such as print/export) and a
  new folder prompt are not advertised; folder creation remains in the file tree.
  Commands are sent only to the focused window. Unavailable items stay visible but disabled:
  workspace commands need a vault and no dialog, note commands need a visible note, tab
  navigation needs multiple tabs, and Format needs focus in the visible note's text editor
  (not another input or frame). The bridge checks again before running a command. Native menu
  accelerators own their shortcuts, so the UI and CodeMirror do not execute them a second time.
  macOS Control-Tab/Control-Shift-Tab run through the same UI command route while cancelling the
  native default, because WebKit otherwise consumes them for focus navigation.
  Settings opens even without a vault, focuses its controls, keeps Tab within the dialog and
  makes the workspace behind it inert. Dismissal restores the previous focus; follow-on
  news/sign-in dialogs replace Settings and keep their own focus, including before a vault.
  When opened over a still-valid command menu, Settings first dismisses it and restores its
  captured target, so that target becomes the return focus. Invalidated targets are not restored.
  Editor commands reject a note hidden by Graph, a file
  viewer or Settings. Native menu actions send a command ID, not a captured note path;
  formatting targets the currently focused visible note at execution. Context callers can
  supply an optional captured `path` to mark, heading and link commands; a mismatch with the
  current note is rejected instead of editing that different note.
  Menus never substitute note formatting for system clipboard operations.
  Placement follows [Apple's menu-bar guidance](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar)
  ([readable HIG text](https://appstoreguidelines.com/human-interface-guidelines/version/17/the-menu-bar/))
  and [Tauri's native-menu platform behavior](https://v2.tauri.app/learn/window-menu/).
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

- **Folders in the sidebar:** opening a file shows its parents unless the person has closed
  them. A manually closed folder stays closed through edits, tab changes and renaming it
  in the sidebar; its nested folder choices follow the rename too. The separate
  **Collapse all folders** sidebar button and `tree.collapseAll` command close every folder
  in the open workspace, including nested folders, without closing files, changing text or
  stopping sync. `tree.revealActive` (**Reveal active file in sidebar**) reopens the active
  file's parents and brings its row into view. Folder choices belong to the current workspace
  and window; switching workspaces starts a fresh tree, not another workspace's choices.
- **Links inside a note:** `[[Note#Heading]]` and `[[Note^block]]` open the note at that place;
  `![[Note#Heading]]` embeds just that part. "Go to a heading" lists the open note's headings.
  A link to a web page, `[words](https://…)`, opens in the browser on a click, as a link to a
  note opens the note (Option-click or the arrow keys to change it). Only `https` addresses.
  A picture, `![words](file)`, is shown when its file name has brackets in it too.
  A link whose address is on the line below, or a picture written over two lines, stays as text.
  A note that cannot be drawn does not open, and the note on screen stays as it was.
- **Tables:** a table in a note is edited as a table. A click in a cell types into that cell (the
  cell shows its own markdown while typed in, the rest stay drawn), Tab and Enter move on and make
  a new row past the last one, and a right-click adds or removes a row or a column. Shift+F10 or
  the Menu key opens the same command menu from a cell. Arrow keys, Home and End move through
  its actions; Enter or Space chooses one. The target cell stays outlined while its menu is
  open. Escape or Tab dismisses it and restores the cell's
  selection. The menu stays inside the window and closes on outside focus/click, window blur,
  scrolling, resize, or a change to the captured note, document, selection or editable state.
  It never applies an old action to a replacement row or hidden note. Header deletion and
  deletion of the last column are not offered. The existing table actions use named commands
  and the shared `ui/src/shell/contextMenu.ts` presentation; ordinary inputs and source text
  retain native menus. No clipboard bridge or native popup is added. A link in a
  cell, to a note or to a web page, reads as its words and opens on a click. Each
  keystroke changes only that cell's text in the file, so the note is still a plain markdown
  table. When the file changes outside the app, only the part that differs is replaced in the
  open note, so the cell being typed in keeps the keyboard. If the row being typed in is itself
  removed outside, the next key goes nowhere instead of into the row that took its place. `ui/src/editor/livePreview.ts`.
  Tried in the real app on a Mac.
- **Daily note:** `Daily/YYYY-MM-DD.md`, created on first use from `Templates/Daily.md` if present.
- **Templates:** any note in `Templates/`; `{{date}}`, `{{time}}` and `{{title}}` are filled in.
- **Trash:** deleting moves a file to `.lokus/trash/`; "Restore from the trash" puts it back.
  A note a teammate deletes while it is open here closes its tab and says so, so nobody goes on
  typing into a note that is gone; it is in this computer's trash too. The graph or a file in
  front stays in front, and while it is in front keys do not reach the note underneath, however
  it was brought forward; the note takes the keyboard again when it is back in front. A note that is not shared, with words not yet in its file, keeps its tab,
  and saving brings it back. Known limit: in a shared note, keys typed in the instant between the
  delete arriving and the tab closing (about a tenth of a second) reach no file.
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
  What was said is drawn the way a note is (bold, lists, links). A message from Slack keeps the
  text Slack sent in its note, and is shown the way Slack shows it: `<@U1|Pavan>` reads "@Pavan",
  `<https://x|the doc>` is a link that opens in the browser, `*this*` is bold. An address
  that is not `https` cannot be opened, so it is written out next to its words.
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
- **Edit without leaving the board or list.** Status, priority, assignee and due date have inline
  controls. They confirm only after the existing task writer succeeds; a failed change keeps
  the saved value alongside the attempted field/value and offers Retry or Cancel change. In-flight
  or failed inline edits keep their board open through note navigation, close and folder changes;
  Cancel discards only that failed inline intent, never shared text or a running write, and remains
  available to viewers. An unsaved open task must be saved first. The writer
  checks the field's original parsed value, not its normalized display, and changes only supplied properties in the latest file,
  preserving its body; explicit empty values clear a property. Clicked tasks are identified by
  their path, not by a possibly duplicated number.
- **Custom columns** use the board note's existing `order` property, an array of status names.
  A board whose `order` is written one entry per line is left as written: column edits there
  are refused with a message asking for the `order: [a, b]` form, rather than rewriting the list.
  Empty custom columns survive reload and sync. Names are lowercase, one line, up to 30
  characters; duplicate names are refused. Only empty custom columns can be renamed or removed;
  populated columns require moving their tasks first. Built-in columns remain. The board's
  editor changes this property through the same save path as its body, not a separate writer.
  Quoted names preserve commas, quotes, backslashes and Unicode. Existing cached properties
  rebuild automatically for corrected decoding, without rewriting notes or requiring user action.
- **Save feedback** distinguishes unsaved, saving, locally saved and failed writes on task pages
  and the board. A locally saved file is not a relay acknowledgement: offline edits can still
  be saved on this device. Failed shared updates stay queued with their dependencies for retry.
  Closing or replacing their tab, disconnecting sync or changing folders cannot discard them.
  Saves and task mutations identify their original vault; a delayed operation cannot write to
  a different folder's same-named note or shared document.
  Edits arriving while a folder opens refuse that transition and keep their sessions. The original
  native root is restored only if the opened target still owns it; a newer independent open is
  not overwritten. If restoration fails, selecting the original folder again restores ownership
  without resetting retained work. Reconnecting with pending edits requires the same captured
  root, server and workspace. Failed target construction leaves the original sync link running;
  stale conditional opens do not change the current root, link or remembered-folder settings.
  File and folder renames also capture the original vault: failed saves refuse the rename,
  private/shared writers reject another root, and stale completion cannot move a new vault's
  tabs or trigger caller follow-up. Tree refresh reads that captured root and discards results
  after the UI changes vaults. Shared rename preserves the existing document identity.
  Every core command a window sends names the folder that window shows: the bridge adds it to
  any call that does not carry one, and Rust refuses the call when another folder is open. A
  window left on its folder by a refused switch therefore neither reads nor writes the folder
  another window opened, whichever feature made the call. A call that captured its folder
  before waiting still sends that one. A window with no folder open sends none. A new folder
  made from the sidebar, a team invitation, a team brought to this computer or first-run setup
  is created and opened only after this window has saved its notes and the assistant has kept
  its reply in progress.
  Incoming sync events carry the serving vault's root: another vault's same-ID text, presence,
  rename, trash, role or new-data notice cannot change the retained session or current workspace.
  A shared document without a materialized file refuses local updates before changing sync state
  or the outbox. Pending words stay unsaved after peer deletion; Retry never resurrects the note.
- **Context actions and trash.** Right-click a task to open it, focus its inline fields or move
  that task to the vault trash; right-click a column to manage columns. These use the shared
  command-menu presentation and capture the clicked target, invalidating on context changes,
  including a board hidden behind Graph or a file. Delayed column actions recheck that visibility.
  Task pages also expose trash directly. The existing note trash operation retains open sessions
  until pending saves and deletion succeed. Viewer task controls are disabled.
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
  assistant knows what they are here for. `Lokus: run the setup again` replays it. Someone
  with no model connected is asked to turn the assistant on: Sign in with ChatGPT, or a Claude
  or OpenAI key pasted right there (`ui/src/features/ai/Connect.tsx`, the same card the
  assistant's panel shows). The key is not sent to Settings for: Settings is not on screen
  until a folder is open.
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
| `invites` | code, workspace, role, who made it, when it runs out, whether it was cancelled, who used it; for one sent by email: the address, the name the owner goes by, when it was last emailed and how often, the key its email carries, and when the person it names pressed Join on its page |
| `updates` | the edit log: a running number, workspace, note id, the edit, who made it and when |
| `blobs` | attachments under the hash of their bytes, with size, who stored them and when |
| `audit` | who changed who may do what; kept even after a workspace is deleted |
| `ingest_keys` | keys a team's own systems push customer facts with: a hash, a name, who made it, when it was last used |
| `inbox` | pushed facts waiting for a device to write them into notes, and which device has taken each |

Once a note has 200 stored edits they are folded into one row. A note's text is whatever its
edits add up to; that is the cloud copy.

A note arriving at a path where this device already has a file of its own never overwrites it:
the local file is kept beside it as "name (local copy)" and synced too. The one exception is a
local file that already holds exactly the arriving text (the starter notes every new vault
begins with): it is the same note, so it stays where it is and nothing is kept twice.

Two people who each make a note of the same name while apart (two "Untitled" notes written
offline), or who each rename a different note to the same name, have two notes, and both are
kept. Every device that may edit gives the name to the same one of them and names the other
beside it, "name (local copy)", so no text is merged or lost. A viewer's device decides nothing
for the team: it shows the second note once an editor's device has named it. A note the viewer
made itself, which the team has never seen, is the one that steps aside there. A tab open on a
note that sync moves goes with the note.

A shared note whose tab is behind another still takes what teammates type. Its tab shows that
text the moment it comes forward, and a click on the tab already on screen changes nothing.

A device that was away can get several renames as one change (two notes that swapped names, a
note given the name of one that was deleted). The note in the way steps aside until its own
move is made, so neither file is written over and sync does not stop. Everything it missed
about names is taken in before it touches a file, so it never names two notes apart that the
team has since moved or deleted: said late, that word could win and undo theirs. What it
made while away goes out the same way, as where its notes are now and not each place they have
been, so a note made as "Untitled" and given its title offline never meets a teammate's
"Untitled".

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
- A socket that has gone silent is not trusted. The app asks the relay to answer every 20
  seconds; after 50 seconds of hearing nothing (a laptop that slept, a network that changed) it
  drops the connection and opens a new one, and what either side missed arrives then. While
  what it missed is still arriving the wait is ten minutes: that comes as one message, heard
  only when all of it is here, and a team's whole history over a slow link takes longer than 50
  seconds. That one message may be up to 1 GB; the 16 MB a websocket takes by default
  refused a team's history once it had grown past that.

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
change a role, remove someone, invite by email and cancel invitations, leave or delete.
There is no separate team window, and no way to stop syncing: a member's folder syncs.

**Leaving, deleting, being removed.** When Leave or Delete succeeds, the connection ends, the
folder is taken off this device's workspace list and the app shows the next workspace on the
list, or the start page when there is none, where the same one sentence is shown (`dropWorkspace` in `ui/src/shell/workspace.ts`;
`vault_forget` also closes the folder when it is the open one, so the next start does not open
it again). The folder and its notes stay on disk, and the page and the notice say so. The same
happens on another member's device: when its connection is refused it asks the relay which
teams the person is in, and if this one is not among them it stops, says so once and drops the
folder the same way; a team folder that is not open is dropped at the next look for teams, and so is one an
earlier version left on the list after a Leave or Delete (it is named in that version's
`lokus.sync.stopped`, which is read once and then removed). A
refusal for any other reason (a sign-in that ran out) keeps the folder and shows "Sync stopped". A
folder with words that could not be written to disk is not dropped: it stays open with the words
on screen, says the save failed, and reads "Sync stopped" with the relay's reason, since its
connection has ended and nothing retries; it goes from the list at the next start. The note
editor is one object for the life of the window, and the page it sits on comes and goes with
the folder, so the editor is put onto each new page (`attachEditor`).

**Seeing sync fail without asking for a log.** Through the analytics bridge
(`trackSync` in `ui/src/bridge/analytics.ts`) the app sends `sync_connected` (role),
`sync_offline` and `sync_refused` (the reason) and `sync_first_pull` (edits, seconds from
connected to pulled), each with the app version, the platform and the team's id. Each distinct
event and reason goes once per team, and that memory outlives a reconnect: a relay that is down,
or a connection that comes up and drops every three seconds, is one event per reason, not twenty
a minute. It starts again only after a connection that held (its first pull is in and it stayed
up 30 seconds), so a later failure is said once more. The same thing still repeating an hour
later is sent again with `suppressed`, the number of repeats held back. Leaving or deleting a
workspace from this device is not a failure and sends no `sync_refused`. The memory is in the
window, not on disk. Reasons have paths and file names taken out and anything shaped like a
sign-in replaced; no note, title, path or token is sent. The opt-out covers these too.
`sync.log` on the device is unchanged.

**Not built:** end-to-end encryption (whoever runs the relay can read the notes; see the
decision log), attachments in a bucket, and limits on ordinary requests per account.

Checked by `crates/lokus-server/tests/relay.rs` against a real relay on a local port, and by two
scripted flows: `checks/flows/sync-devices.sh` and `checks/flows/live-coedit.sh`.

Device and relay exchange only what the other is missing; after that edits are relayed live.
Cursors and presence pass through memory and are never stored. Each outgoing cursor, name,
removal and new-peer reply carries its shared note's original vault root; the native boundary
checks the captured connection's engine and drops stale presence rather than forwarding it to
another folder's team. Presence delivery remains best-effort and cannot change note save state.
A personal vault is local-only
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

### Several people's assistants in one workspace (built; tried with two devices on a local relay)

Five people in a workspace means five copies of Lokus, each with an assistant and each with its
own connections. Three things keep that from becoming five of everything.

- **The same thing recorded twice is one thing.** A message or issue is filed under the id its
  source gave it, so two assistants recording the same Slack message write the same note.
- **One meeting is one record.** Each person's recorder gives the same meeting a different id,
  so a meeting is matched by customer, day and title; a second person's notes are added to the
  first record under their name (`ingest::same_meeting`).
- **One look per workspace.** Before a scheduled look a device asks the relay for the turn
  (`POST /v1/workspaces/{id}/looks/claim`); one is granted per interval and the rest skip. A
  look asked for by hand is not held back. Findings live in the vault's `noticed/` folder,
  which syncs, so everyone sees what the one look found, and dealing with a finding deals
  with it for all.

Not handled: two people acting on the same finding at the same moment; a meeting whose title
differs between recorders.

### In the menu bar (built; tried in the real app on a Mac)

The assistant's looks run on a timer inside the app, so an app that quits with its window stops
looking. Lokus therefore stays: closing the window or pressing Cmd+Q hides the window and the
Dock icon and leaves a mark in the menu bar (`apps/desktop/src/background.rs`). The mark's menu
opens Lokus, asks for a look now, or quits it for good, which is the only real quit. A number
beside the mark says how many findings need the person. Once a minute the shell tells the
hidden window the time has moved, because the system slows a hidden window's own timers; the
window decides whether a look is due. "Keep Lokus in the menu bar" under Settings, Assistant
turns all of it off. Not built: a system notification when something is found; starting Lokus
when the computer starts.

### Workspaces and the switcher (built; tried in the real app)

A workspace is a folder. A person can have several (one for a team, one for school) and
nothing is shared between them. The shell keeps the list of every folder opened in Lokus
(`vaults.json` beside `last-vault`; a folder that is gone drops out). The workspace's name at
the top of the sidebar opens the switcher, after Notion's: the open workspace with Settings
and Invite people, the others with "Team" on the shared ones, invitations waiting with a Join
button, and "Add workspace", which makes a folder of that name in Documents. A new workspace
is private; sharing it is one step under Settings, Team. Every window still shows the same
workspace: switching in one switches them all.

**A team comes by itself.** Being in a team is enough to have it on a computer.
On sign-in, when the app starts and when its window is returned to, the app asks the relay
which teams the person is in (`GET /v1/workspaces`); each one with no folder on this computer
gets a folder in Documents named after it, is opened and starts syncing
(`bringTeams` in `ui/src/features/teams/invites.ts`). Nobody is asked. The rules that keep it
safe:

- It never lands in a folder holding files, nor in one that syncs with another team, nor
  where a plain file has the name: each is passed over for "name 2", "name 3". A person's
  own notes cannot reach a team this way, nor one team's notes another. Folders are told
  apart as the disk spells them, so teams "sales" and "Sales" get "sales" and "Sales 2".
- A connection is asked for one folder by name (`sync_connect`'s `root`) and refused when
  another is open by then, so a folder opened in the same instant is not taken for the team's.
  It is looked at again at the moment the connection starts, and opening a folder ends any
  connection begun for the last one: none runs behind a folder it was not asked for.
- A folder that already synced with this team here is used again, so asking twice makes
  nothing twice.
- What was being typed is written to its own folder before the team's folder takes the
  screen. When a note there cannot be written (it changed on disk meanwhile), the folder
  stays on screen and the teams wait for the next look. A team that cannot be given a
  folder does not hold up the others.
- Nothing turns a team's syncing off, and nothing has to be pressed to start it. A folder
  that synced with a team before (its `.lokus/sync.sqlite` names the team; `sync_bound`) is
  connected again when a member opens it, including one whose syncing an earlier version had
  stopped. "Sync this vault here" is left only for a relay of one's own, which knows nobody
  until its address and token are typed. Creating a team (Share) and joining by invitation
  stay the person's own acts.
- A folder kept for a team the person is no longer in is taken off the workspace list (see
  "Leaving, deleting, being removed").
- One connection is open at a time, the open folder's. With several teams the first is left
  on screen; the others sync when their folder is opened from the switcher.
- First-run setup chooses the first folder itself; teams are brought when it closes. With
  no relay or no sign-in nothing is made and nothing is said; it is asked again later.
- A team folder opened while signed out starts syncing when the person signs in.

### Inviting by email (built; tried in the real app against a local relay with a stand-in mail service; no real email has been sent yet)

An owner types an address under Settings, Team. The relay emails that person from
`noreply@lokusmd.com`; they press Join on the page the email opens, and the workspace comes to
every computer where they are signed in to Lokus with that address. Nobody copies or pastes a
code, and someone who pressed Join on the page is not asked again inside Lokus.

- **Sending.** `POST /v1/workspaces/{id}/invites` with an `email` makes the invite and sends
  it through Resend's HTTP API (`crates/lokus-server/src/mail.rs`). The relay needs
  `LOKUS_MAIL_KEY` and `LOKUS_PUBLIC_URL`; without them it sends nothing and says so, and
  invites go out as links as before. A reply to the email goes to the owner who invited.
- **The email** (`assets/invitation.html`) says who invited whom to what, as what, with one
  button and the three steps after it. It is the app's own colours, light and dark.
- **The link** opens `/join/{code}` on the relay: the same facts, a Join button, the installers
  for the newest build (both kinds of Mac, Windows, Linux; the reader's own system first, with
  the one thing that system asks when opening it), which address to sign in with, and the code
  for someone who signs in under another.
- **Join on the page.** The link in the email carries a key (`?k=`, `invites.agree_key`) that
  the owner who sent the invitation is never shown. With it the page has a Join button, which
  posts to `/join/{code}?k=...` and only notes that the person the invitation names said yes
  (`agreed_at`): the page is signed in to nothing, so nobody joins there. `GET
  /v1/invites/mine` hands `agreed_at` to Lokus, signed in with the invited address, and Lokus
  uses the invitation without asking (`lookForInvites`, one look at a time), then `bringTeams`
  gives the workspace a folder as for any team the person is in. In first-run setup it is the
  person's first folder and the question "join, or set up my own first" is not put. Opening
  the link says yes to nothing, because mail programs open links by themselves. Without the
  key (the owner's copy of the link, an email sent before this, a bare link with no address)
  there is no button and the invitation waits inside Lokus as before, so an owner cannot put
  a workspace on someone's computer for them. A copy of Lokus from before this
  (2.0.0-alpha.11 and older) does not read `agreed_at`: it shows the invitation with its Join
  button, as it always did.
- **Waiting.** Someone who signs in without pressing Join on the page is still asked inside
  the app: `GET /v1/invites/mine` gives the invitations addressed to the signed-in
  person's email. The app asks on sign-in and when the window is returned to (at most every
  ten seconds). In first-run
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
  it, once, as before. Saying yes on the page takes the key that only the email carries.
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
6. The text in a note's document always uses `\n`. Beside it the document carries one word,
   `crlf` or `lf` (map `meta`, key `eol`): the line ending of the file on the device that last
   put an edit of its own into the document. A device that has no file of the note yet creates
   it with that ending, so a note written with `\r\n`, with or without a final newline or a
   byte-order mark, arrives byte-identical. A file that exists is never rewritten because of
   this word: a device keeps the endings its own file has, whatever a teammate's file has, so
   a person who rewrites a note with other endings changes only their own file and those made
   after it. A document without the word means `\n`, which is what a build before this one
   writes and reads; notes already synced with `\n` stay so. Mixed endings and a lone `\r`
   are not carried: such a note arrives with `\n`, and the first edit by anyone unifies it on
   the device that wrote it too.

### Releases and news (built)

The relay also answers every copy of the app, signed in or not: `GET /v1/app/update/{target}/{arch}/{version}`
(the newest build for that platform, or 204) and `GET /v1/app/news` (posts, newest first). Tables
`app_releases (version, platform, url, signature, pulled)` and `app_news (id, body, at)`.
Publishing needs `LOKUS_PUBLISH_KEY`. The app installs a download only if it carries our
signature for that version. The window's side is `ui/src/features/updates/`; the steps a person
goes through, how to publish, and what was tested are in `docs/releasing.md`.
Published-build and in-app update checks are recorded there by version and platform; they are
historical evidence, not acceptance of a later release.

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

## 8. AI and MCP (built; MCP discovery and workflow reads tried with GitHub)

`lokus-ai` holds all of it; the UI is a chat panel and a settings section.

- **Bring your own key.** The key lives in the OS keychain. Every provider call is made from
  Rust, so the UI and plugins never see a key. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are read
  as a fallback, which is how the command line and the scripted flow supply one.
- **Three wire formats:** Anthropic's Messages API for Claude (default model Claude Opus 5.5), the
  OpenAI Responses API for OpenAI itself (a key or a ChatGPT plan), and the OpenAI
  chat-completions format for any compatible service at another address. Conversations are
  kept in one shape and translated on the way out.
- **The address belongs to one provider.** It is typed for a compatible service; choosing
  another provider drops it, so a ChatGPT sign-in or a Claude key is never sent there.
- **The chosen model stays with its provider.** Connecting the same provider again, or going
  between a ChatGPT plan and an OpenAI key, keeps the model; any other change of provider, or a
  typed address, clears it and the provider's default is used.
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
- **Unsent drafts.** Closing and reopening the assistant keeps the entire message: text,
  explicitly picked @ notes/folders and attached files. Each conversation in each workspace
  has its own draft in this window's memory; Earlier conversations also lists messages not
  sent yet, so New chat or a workspace switch leaves them reachable. Deleting a conversation
  clears its draft. A successful answer clears the submitted draft only if it was not edited
  while waiting; a failure, stop or model refusal keeps it. Sending waits for file imports.
  An import belongs to the draft and vault where it started, even if the panel closes or the
  conversation changes. If its vault is no longer open when the write starts, it reports an
  error rather than writing into the new workspace. Drafts are not synced, shared between
  windows or kept after an app restart. Imported files remain ordinary vault files when
  removed from a draft or when a conversation is deleted.
  Switching conversations or starting New chat saves unfinished reply progress before
  leaving. Opening another workspace from this window waits for its captured transcript
  save; a failed save refuses the switch. A workspace change already completed by another
  window or initial setup may lose the latest unsaved reply text; its draft is still retained
  and no transcript is written to another workspace. Stop also cancels while context is
  loading, before a provider request starts. Late loads/replies cannot undo a newer choice
  or reopen a deleted conversation.
  This window declines new sends and additional workspace switches until its current switch
  finishes or fails; drafts and imports remain with their conversation. A pending deletion
  cannot be re-saved by the switch. Failed deletion keeps the draft and reply progress for retry.
  While the current conversation's deletion is unresolved, New, opening another conversation,
  carrying on from a shared conversation or Noticed, and an ordinary workspace switch are
  declined with a message. This keeps recovery available if deletion fails; it does not block
  resetting the panel after a workspace change that has already completed elsewhere.
- **MCP:** tool servers over HTTP through the official Rust SDK (`rmcp`), added by address in
  Settings or contributed by a plugin. A server that asks for sign-in gets it: "Sign in" opens
  the browser, the app catches the redirect on a local port, and the SDK keeps the tokens fresh.
  The initialize handshake advertises the SDK's latest initialize-compatible protocol, not a
  newer protocol that no longer supports that handshake. A saved bearer token takes precedence
  over OAuth for that server; OAuth-only servers keep their existing sign-in and refresh path.
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
every look is shown. This handoff belongs to the conversation and workspace it opened. If
the person changes conversations or workspaces, starts another reply, or stops it before
the reply starts, the delayed action is canceled. A draft typed in that same conversation
stays unsent while the original action proceeds. Recording the choice and refreshing the
findings use the original workspace; a resolution that fails before the choice is recorded shows an error and does not start the action; if the choice was recorded and only writing what was learned failed, the error is shown and the action still starts. A choice already recorded is not undone when the later handoff is canceled.
Not built: looking while the app is closed, system notifications, a
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

### Connections

**A connection belongs to one workspace**, the folder it was made in: a tool server (named
service or one added by address) and a team's own API alike. Two workspaces can each connect
their own Slack or GitHub; connecting, replacing or disconnecting in one changes nothing in
another, and a new workspace starts with none. The assistant's model, its key and the ChatGPT
sign-in are the person's and stay the same in every workspace.

- **Which workspace:** the folder's own id, a random value in `.lokus/id` made the first time
  it is needed (`Vault::id`). It goes with the folder, so a folder that is moved or renamed
  keeps its connections. It is never synced: each computer's copy of a shared folder has its
  own. A folder copied by hand carries its original's id, so the copy and the original share
  connections on that computer.
- **Settings:** the one `ai.json` keeps, beside the model, `workspaces`: folder id → that
  workspace's `mcp` and `apis`. `Config::seen_from` is the only reader and `Config::put` the
  only writer; the window is shown one workspace's list with the folder it is for and sends
  that folder back with every change, so a change made during a switch lands where it was
  shown.
- **Keys:** the same keychain service; the account carries the folder's id, not its path:
  `mcp:<name>@<id>`, `mcp-oauth:<name>@<id>`, `api:<name>@<id>`. Never in a file or a log.
- **A request** takes the open workspace once (`ai_send`): its notes, its plugins and its
  connections go together, and a question asked in another folder is refused. Tool servers are
  connected per request, so nothing is held over from the workspace before.
- **Installs from before this:** at the first start, each connection in the top-level `mcp`
  and `apis` lists is given to every workspace on the computer and marked as `shared`: it goes
  on using the keychain entry it already had (`mcp:<name>`, no id). Nothing in the keychain is
  read, copied or removed, so nobody signs in again and no prompt appears. One sign-in is
  shared rather than copied because a copied browser sign-in dies the first time another copy
  refreshes it. A workspace that connects again, updates its token or disconnects gets its own
  entry (or none) and stops sharing; the old entry is removed when the last workspace has let
  go. Nothing else is ever written to the top-level lists or to an entry without an id.
- **With no folder open** (first-run setup) a connection waits under a place of its own
  (`workspaces["-"]`, keys `…@-`), and it and its keys move to the next folder that is opened
  (`Config::settle`). It never touches a sign-in that workspaces share.
- **Going back to an older build loses them:** a build from before this reads and writes only
  the top-level lists, so it shows no connections, and its first ordinary settings save (a
  model change is enough) writes the file without `workspaces`. Every workspace's connections,
  inherited ones included, then have to be connected again.

A connector is a tool server (MCP) that a service runs itself. Settings, Connections lists them
by name: Connect signs the person in with that service in the browser (or asks for its supported
personal access token) and the assistant gains
its tools, named `mcp__<id>__<tool>`. Each can be switched off or disconnected. Anything that
changes something asks first unless the person has turned asking off.

The list is `lokus_ai::catalog`: an id, a name, an address, and whether a person can connect
today. Checked against the live servers on 2026-11-13:

| Ready now | Waiting for Lokus to be registered with the service | Not built |
|---|---|---|
| GitHub (personal access token), Linear, Notion, Granola, Sentry, Jira and Confluence, Stripe, Intercom, Zapier, and Slack (in the workspace its app was made in; see `deploy/slack/`) | Gmail, Google Calendar, Google Drive, Asana, HubSpot | iMessage (runs on the Mac, not at a service) |

GitHub's [official remote MCP instructions](https://github.com/github/github-mcp-server#remote-github-mcp-server)
support a personal access token without registering the host app; browser OAuth still needs a
registered GitHub or OAuth app. First-run setup and Settings reuse the same GitHub Connect
screen: it asks for one token, links to
GitHub's token creation page, and checks tool discovery before saving it in the existing OS
keychain (`mcp:github@<workspace id>`). The token's repository access and permissions determine what works;
Lokus neither widens them nor copies a token from another app. Checking uses only the entered
token, never an older token or OAuth grant, and times out after 20 seconds. Cancelling that check
or leaving the screen saves nothing. Saving requires the keychain; a rejected token or failed
save never reports success. A token replacement stops if the old credential cannot be read;
if saving settings fails, the previous token is restored (or the new one removed). A connected
GitHub row offers Update token for an expired or revoked
credential without switching on a connection the person switched off. Existing OAuth and
custom-server connections keep their own sign-in flows; tool
annotations and the assistant's existing approval gate still govern writes.
Disconnect clears the in-memory OAuth session even if the keychain is unavailable, but keeps
the server entry until OAuth and bearer-token deletion succeed; an uncleared token must not follow a
reused server name to a different address.

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
