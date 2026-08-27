# Team Collaboration Product and Technical Roadmap

**Status:** Product shell, encrypted revision sync, recovery, private presence,
and production hardening are implemented on the Teams collaboration branch.
True same-document multiplayer is not yet implemented and must not be implied
by the UI.

## Product goal

Teams should feel like one shared local-first workspace:

- local actions are immediate and remain durable while offline
- every authorized device converges after reconnecting
- people can tell who is present and where active work is happening
- permission and encryption changes never silently weaken access
- conflicts are exceptional and recoverable, not the normal co-editing path

The goal is not to copy every Notion or Figma feature. It is to adopt the
patterns that make collaboration trustworthy while preserving Lokus's local
files and server-blind content model.

## Research conclusions

1. **Durable changes and presence are different systems.** Figma keeps document
   changes durable while treating cursors and selections as ephemeral. Supabase
   likewise recommends Presence for slow-changing online state and Broadcast
   for high-frequency cursors.
2. **Apply changes locally first.** Linear's local-first model makes the client
   database the immediate UI source and reconciles ordered changes in the
   background.
3. **Use the smallest useful conflict domain.** Figma resolves independent
   object properties separately. A whole-file compare-and-swap is safe for
   snapshots but too coarse for live text, boards, or canvases.
4. **Do not invent text transforms.** ProseMirror's native collaboration model
   requires a central authority that can inspect and rebase steps. The Lokus
   server is intentionally blind to plaintext. Yjs already provides a
   ProseMirror binding, offline merging, shared undo, and relative cursor
   positions while allowing the server to relay opaque updates.
5. **Permissions must be visible at the point of sharing.** Notion's teamspace
   model makes membership and inherited access understandable before content is
   shared. Lokus should keep the simpler team/space boundary and show the exact
   reader/editor grant before creating an invite or moving a note.

Primary references:

- [Figma multiplayer architecture](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Figma ordered sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)
- [Linear delta sync](https://linear.app/now/rebuilding-delta-sync-read-path)
- [ProseMirror collaboration guide](https://prosemirror.net/docs/guides/collab/)
- [Yjs ProseMirror binding](https://github.com/yjs/y-prosemirror)
- [Yjs awareness protocol](https://docs.yjs.dev/api/about-awareness)
- [Supabase Presence guidance](https://supabase.com/docs/guides/realtime/presence)
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Notion teamspace permissions](https://www.notion.com/help/intro-to-teamspaces)

## Current architecture

```text
Local files
  ↕ crash-safe note engine + SQLite identity/outbox/checkpoints
Encrypted immutable revisions
  ↕ narrow authorized RPCs + private Storage
Per-space ordered action log
  ↕ Realtime counters as hints, durable pull as authority
Other authorized devices

Separate ephemeral path:
Active team note
  ↔ private Presence (viewing/editing identity)
  ↔ private Broadcast (optional transient pointer/selection events)
```

The current path is correct for offline edits, explicit saves, key rotation, and
recovery. It is not a keystroke-level multiplayer protocol:

- revisions contain complete encrypted note snapshots
- concurrent saves use an expected head and may require manual recovery
- an open dirty note blocks remote replacement
- cursors are not rendered because remote text cannot yet converge live

## Product decisions

### Workspace and spaces

- A **team** is the administrative container.
- A **space** is the access, encryption, and sync boundary.
- Team spaces belong in the main workspace sidebar, not only in Settings.
- Personal and team notes may coexist locally, but the UI must always show
  which transport owns the active note.
- Team notes remain normal files. The local note ID, not a path, is their stable
  identity.

### Presence

- Show up to three avatars in the active artifact header, then `+N`.
- Presence answers “who is here?”; it does not prove a change is durable.
- Presence is removed on disconnect and is never written to note history.
- Use Presence only for joins, leaves, and viewing/editing mode.
- Use Broadcast for pointer or selection messages and throttle them.
- Do not render remote text cursors until the CRDT document is active.
- Current private channel payloads are authorized but server-visible. The CRDT
  phase should encrypt cursor/selection payloads with the active space key when
  zero-knowledge awareness is required.

### Authorship and activity

- Notes: show last editor and revision history in an activity surface, not a
  permanent author label on every paragraph.
- Kanban/Bases: attach actor and timestamp to each durable property operation;
  show recent activity in card/row details.
- Canvas: record actor in history; show live cursors and selections, but do not
  label every shape by default.
- Sticky notes and comments may show authors because authorship is part of
  their product meaning.
- Similar consecutive activity should be grouped to avoid an unreadable feed.

### Conflict and undo

- Keep the existing three-snapshot recovery path for filesystem divergence,
  access rejection, and legacy clients.
- Normal concurrent text edits should merge automatically through the CRDT.
- Undo must affect the local user's CRDT operations, not overwrite a teammate's
  later work.
- Structured surfaces should use operation-level inverse actions instead of
  restoring an entire stale file.

## Next technical phase: encrypted live text

The next durable protocol should be an encrypted Yjs update provider layered on
the existing team identity, permission, and key systems.

```text
ProseMirror transaction
  → Y.XmlFragment
  → apply immediately to local Y.Doc
  → persist merged update in local outbox
  → encrypt with current space key epoch
  → append opaque update through authorized RPC
  → private Broadcast wake-up
  → peers pull, decrypt, and apply Yjs update
  → debounce Markdown materialization to the ordinary local file
  → periodically commit an encrypted revision checkpoint
```

Required cloud records:

- one collaboration document per `note_id`
- immutable encrypted update chunks with `op_id`, device sequence, key epoch,
  checksum, and actor
- a per-note durable sequence/checkpoint
- encrypted compacted snapshots with compare-and-swap coverage
- a typed activity record that contains no plaintext note content

Required local records:

- Yjs binary state per team note
- unsent encrypted update batches
- last durable collaboration sequence
- materialized Markdown generation
- compaction and key-epoch metadata

Key rules:

- Updates are idempotent by `(device_id, op_id)`.
- The server orders and authorizes opaque updates but never decodes them.
- A client returning from offline applies the latest encrypted snapshot and all
  later updates, then contributes its local updates.
- Key rotation starts a new encryption epoch. Remaining devices can read old
  history and write new updates; removed members cannot decrypt the new epoch.
- Compaction is client-produced and accepted only when its covered sequence is
  still current.

## Structured collaboration after text

### Kanban and Bases

Do not sync a whole `.kanban` file after every drag.

- represent cards/rows, columns, and properties with stable IDs
- send create/update/move/delete operations
- use server-ordered property-level last-write-wins for scalar fields
- use fractional positions for ordered cards/columns
- retain actor, timestamp, and previous value for activity and undo
- materialize the local file from the converged model

Show a colored outline while another person edits or drags the same card. Show
“updated by” in card details and activity, not on every collapsed card.

### Canvas

Do not replace the whole Excalidraw document during collaboration.

- sync elements by stable element ID
- merge independent element properties separately
- retain tombstones for deleted elements until compaction
- send pointer, selection, and viewport only through the ephemeral path
- scope undo to the local user's operations
- materialize `.excalidraw` from the converged element store

## Administration still required

Before broad release:

- atomic device revocation with key rotation and remaining-device envelopes
- self-service leave-team with last-owner protection or ownership transfer
- scheduled orphan upload cleanup
- server-side binding of committed ciphertext metadata to stored object bytes
- space creation, archive/restore, grants, and group management UI
- a canary-aware server flag rather than only a global client flag

These controls must not be implemented as UI-only actions. Each needs one
transactional RPC and adversarial authorization tests.

## Rollout sequence

1. Inventory Auth users, legacy sync rows, Storage objects, and current Realtime
   publication membership.
2. Back up the production database and Storage inventory.
3. Configure `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`,
   `SUPABASE_PROJECT_ID`, and `SUPABASE_URL` as runtime secrets, then run
   `scripts/deploy-team-cleanup.sh`. It creates one cleanup token in both Edge
   Function secrets and Vault before deploying the worker and migrations.
4. Verify that legacy personal sync, authentication, and plugins are unchanged.
5. Run owner/member/outsider authorization probes and private channel checks.
6. Enable Teams for internal accounts only.
7. Exercise two users, two devices each: invite, key provisioning, share, edit,
   offline edit, reconnect, conflict, member removal, and key rotation.
8. Expand the canary only after outbox age, pull latency, conflict rate, and
   authorization failures remain within targets.

## Release definition

The revision-sync Teams release is ready when:

- no team content enters personal manifest sync
- every visible sync state maps to real outbox/checkpoint state
- invite links are token-bound, revocable, and never logged
- readers cannot write; outsiders cannot read Storage or Realtime channels
- member removal rotates current keys atomically
- all local edits survive offline and rejected changes become recovery data

The multiplayer-text release is ready when:

- two users can type concurrently in one note without a manual conflict
- remote selections stay anchored through concurrent edits
- local undo never removes a teammate's work
- reconnect converges after long offline edits and duplicate delivery
- a new device can bootstrap from a compacted encrypted snapshot
- Markdown on disk deterministically matches the converged Yjs document

Live cursors, Canvas multiplayer, or “Figma-like” claims must wait for those
conditions rather than being treated as cosmetic UI milestones.
