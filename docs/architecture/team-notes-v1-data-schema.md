# Team Notes V1 Data Architecture

**Status:** Implemented and contract-tested on the isolated `xmpoug...` staging project. Production `wiagh...` remains untouched.

**Canonical models:**

- `team-notes-v1-cloud.dbml` — Supabase/Postgres control plane and shared history
- `team-notes-v1-local.dbml` — workspace-local `.lokus/notes.sqlite3`

The `auth.users` table in DBML is an external-reference stub for the ERD. Generated preview SQL is validation output only; the real migration must never create, replace, or rewrite Supabase-managed Auth tables.

## 1. Current transferred project

The repository is linked to transferred project `wiaghcgcnpwepwcojsbb`. Remote inspection on 2026-08-22 found:

| Existing public table | Approximate rows | V1 treatment |
|---|---:|---|
| `sync_files` | 33 | Preserve until personal-note cutover; never extend for teams |
| `user_workspaces` | 1 | Preserve until personal-note cutover |
| `user_encryption_keys` | 12 | Preserve for legacy personal sync |
| `publishers` | 1 | Preserve; plugin marketplace domain |
| `plugins` | 1 | Preserve; plugin marketplace domain |
| `plugin_versions` | 1 | Preserve; plugin marketplace domain |
| `plugin_ratings` | 0 | Preserve |
| `plugin_questions` | 0 | Preserve |
| `api_keys` | 1 | Preserve pending separate security review |

Storage buckets:

- `vaults` — preserve all existing encrypted note objects
- `plugin-releases` — preserve

The new schema does not inherit these tables as its design. Existing Auth users and real note objects are data to retain while the old sync metadata is retired later.

## 2. Data-preservation decision

Preserve:

- all `auth.users` identities and login credentials
- all objects in `vaults`
- legacy encryption keys needed to decrypt those objects
- plugin marketplace data and releases

Reset or replace after verified cutover:

- path-based `sync_files`
- one-workspace registry assumptions
- whole-workspace manifest state
- legacy sync caches that are not authoritative note history

No destructive migration runs until a backup, object inventory, and note-decryption smoke test succeed.

## 3. Data ownership

```text
Supabase Auth user
  └── Profile
      ├── Devices
      └── Team memberships
          └── Team
              ├── Groups
              ├── Invites
              ├── Team metadata key epochs
              └── Spaces
                  ├── User/group grants
                  ├── Key epochs and device envelopes
                  └── Notes
                      ├── Immutable encrypted revisions
                      ├── One accepted head
                      ├── Ordered per-space actions
                      └── Optional tombstone
```

Important boundaries:

- Supabase Auth owns credentials and sessions.
- `profiles` stores product-facing identity only.
- A team is the administrative container.
- A space is the access, sync, and encryption boundary.
- A team metadata key encrypts group names; space keys encrypt space names and note revisions.
- A note belongs to exactly one team space.
- Personal/local notes use the same local engine but remain on the personal transport during V1.

## 4. Why actions are ordered per space

Restricted-space members must not infer activity in spaces they cannot access. A single team-wide sequence would leak action volume through gaps and checkpoint movement.

V1 therefore uses:

```text
(space_id, sequence) → one immutable sync action
```

Each local replica stores a checkpoint per authorized space. Pull correctness does not depend on WebSocket delivery.

`pull_sync_actions` always receives `since_sequence` from the client’s durable local `sync_checkpoints`. The cloud `replica_checkpoint_observations` table is an observability and retention hint only. The server must never substitute that reported value for the client cursor because a crash between server reporting and local commit would skip actions.

Realtime publishes only `space_sync_counters` and per-user `team_membership_realtime_hints`. These rows contain opaque IDs, sequence/epoch counters, and membership state—not note metadata or content. A missed event is repaired by periodic pull from the durable local checkpoint.

## 5. Server-blind note representation

The server stores:

- opaque team, space, note, revision, action, operation, and device IDs
- membership and access relationships
- permission and key epochs
- encrypted-object key, size, checksum, codec version, and timestamps

The server does not store plaintext:

- note title
- relative path
- note body
- frontmatter
- tags or links
- custom group names
- recovery branch bytes
- plaintext content hashes
- private, space, or revision keys

The encrypted revision payload contains all user-visible note metadata and content.

## 6. Access model

### Team roles

| Role | Team administration |
|---|---|
| `owner` | Full administration; last owner cannot leave or be removed |
| `admin` | Invite/manage members and spaces, except owner-only actions |
| `member` | No implicit access to restricted spaces |

### Space roles

| Role | Capability |
|---|---|
| `reader` | Pull/decrypt authorized revisions |
| `editor` | Reader plus create/edit/tombstone/restore notes |
| `manager` | Editor plus manage grants and key provisioning |

Effective space access is the maximum active direct grant or active group grant. The default `Everyone` group is an ordinary persisted group whose `system_key = 'everyone'`; `UNIQUE(team_id, system_key)` permits many NULL custom groups but exactly one Everyone group. A CHECK permits only NULL or `everyone`. It is not an application-code bypass.

Tenant isolation is also structural:

- grant tables carry `team_id`
- composite foreign keys require each user to belong to that team
- composite foreign keys require spaces, groups, and invites to share that same team
- RPC checks additionally require memberships to be active rather than suspended/removed

## 7. Authorization boundary

Postgres is authoritative:

- RLS enabled before client grants are added
- direct table mutation denied for state transitions
- narrow transactional RPCs derive the actor from `auth.uid()`
- client-provided user IDs, roles, epochs, and cached leases are never trusted
- `SECURITY DEFINER` functions have a fixed `search_path`, explicit checks, and execution revoked from `PUBLIC`
- circular current-epoch foreign keys are DEFERRABLE; team/space creation RPCs defer them and insert the owner, initial epochs, envelopes, and current pointers in one transaction

Core RPCs:

- `create_team`
- `create_invite`
- `accept_invite`
- `register_device`
- `get_member_key_history_plan`
- `provision_member_key_history`
- `remove_member`
- `transfer_ownership`
- `begin_revision_upload`
- `push_note_revision`
- `pull_sync_actions`
- `restore_tombstoned_note`
- `move_note_to_space`

### Atomic removal and rotation

Server-blind encryption means the database cannot invent replacement keys. Before removal, an authorized device prepares the next team metadata key, each affected space key, and envelopes for every remaining active device. One `remove_member` RPC validates complete envelope coverage and atomically:

- inserts the next team/space key epochs and envelopes
- marks the membership removed
- increments the team permission epoch
- advances current key epochs
- writes typed audit events

If the envelope bundle is incomplete, removal does not partially commit. `provision_key_envelopes` remains a separate join/device-onboarding operation, but removal never relies on a later best-effort provisioning call.

## 8. Immutable revision commit

```text
1. begin_revision_upload(op_id)
   - authorize membership, grant, device, and epochs
   - create short-lived pending upload row
   - may reserve a client-generated note ID that does not exist yet; the note row is created only by the later atomic push

2. upload ciphertext
   - immutable object key
   - no plaintext path/title in key

3. push_note_operations(op_id, expected_head)
   - reauthorize everything
   - validate pending object size/checksum
   - lock note head and space sequence
   - reject stale head or missing predecessor
   - insert revision, update head, append action, store receipt
   - commit atomically

4. retry
   - same device/op_id returns the stored receipt
   - never creates a second logical effect
```

### Moving a note between spaces

A move preserves `note_id` but changes access and encryption scope:

1. Source and target must belong to the same team, enforced by composite foreign keys in `note_space_transitions`.
2. Client must be able to manage the source and edit the target.
3. Client decrypts the current head and uploads a fresh snapshot encrypted under the target space key.
4. `move_note_to_space` validates the expected head and target upload.
5. One transaction updates `notes.space_id`, accepts the target-space revision, records `note_space_transitions`, and appends `note_moved_out` plus `note_moved_in` actions under the two independent space sequences.
6. Historical revisions retain their original `space_id`; previous recipients may retain old history but cannot receive future revisions.

Target members receive history beginning at the move snapshot unless a later product policy explicitly re-encrypts older revisions.

## 9. Storage layout

New private bucket: `team-note-revisions`

```text
spaces/{space_id}/notes/{note_id}/revisions/{revision_id}.bin
```

Rules:

- object names contain opaque IDs only
- objects are immutable
- client overwrite and delete are denied
- upload requires an unexpired `pending_revision_uploads` row owned by the actor
- read requires current effective access to the revision's space
- rejected/orphaned uploads are garbage-collected after expiry by a service-only worker

The legacy `vaults` bucket remains untouched during V1 migration.

## 10. Local SQLite responsibility

`.lokus/notes.sqlite3` stores metadata and durable operation state—not committed note bodies.

Main groups:

- identity: `local_notes`, `note_path_history`
- three-head planner: `note_heads`
- crash durability: `mutation_intents` plus self-describing journal files
- write serialization: `note_mutation_locks`, one in-flight operation per note
- outbound sync: `outbox_operations`
- durable encrypted retry bytes: `.lokus/team-outbox/` plus epoch-bound outbox metadata
- device-global ordering: `team_sequence_state`
- inbound sync: `inbox_actions`
- convergence: `sync_checkpoints`
- deletion: `local_tombstones`
- no-loss recovery: `recovery_branches`
- scope state: `sync_scopes`

Private keys stay in OS-backed secure storage. Complete pending bytes live temporarily in `.lokus/note-journal/`; recoverable branch bytes live under `.lokus/recovery/`. Outbox claims use expiring tokens, and cached ciphertext is reused only for the exact space-key epoch under which it was produced.

## 11. Required invariants

1. One live `note_id` owns one normalized local path.
2. Rename/move preserves `note_id`; copy creates a new ID.
3. One process has one mutable session per note.
4. No note has more than one accepted server head.
5. `(device_id, op_id)` produces at most one server effect.
6. `(space_id, sequence)` is unique and gap-free for committed actions.
7. A checkpoint advances only after every authorized preceding action is durably applied.
8. Scan absence never creates a tombstone.
9. A tombstone never discards a stale edit; that edit becomes recovery data.
10. Removed members cannot pull, push, read blobs, or receive future key envelopes.
11. A committed revision references an existing immutable object with matching ciphertext checksum and size.
12. Team and space deletion remain recoverable until their explicit retention expiry.
13. Every revision’s `(space_id, key_epoch)` references a real space-key epoch.
14. Every action’s permission epoch references immutable team permission-epoch history.
15. Grant, group-member, and invite-grant rows cannot cross team IDs even if an RPC is buggy.
16. One local `note_mutation_locks` row prevents concurrent in-flight mutations for the same note.
17. V1 audit events use typed columns only; no free-form JSON can carry plaintext note metadata.

## 12. Clean migration sequence

### Stage A — Inventory and backup

- verify Auth user count
- inventory `vaults` without exposing object names in logs
- export plugin and legacy sync tables
- prove at least one legacy note can decrypt locally

### Stage B — Additive foundation

- create extensions/enums/functions
- create `profiles`, teams, memberships, invites, groups, and spaces
- create devices plus team-metadata and space-content key-epoch tables
- create notes, revisions, heads, actions, receipts, checkpoints, and tombstones
- enable RLS and add authorization tests before granting client access

### Stage C — Local identity

- ship `.lokus/notes.sqlite3`
- idempotently assign UUIDv7 IDs to existing local notes
- preserve explicit copy/move/case-rename/symlink behavior
- keep personal sync operating through its compatibility adapter

### Stage D — Team promotion

- user selects notes to move into a team space
- client creates encrypted initial revisions under their stable IDs
- server accepts them through the same upload/push path
- local files remain ordinary Markdown/plain text

### Stage E — Legacy retirement

- verify all preserved notes and Auth users
- disable legacy writes
- retain legacy tables/bucket read-only for a rollback window
- only then archive/drop obsolete sync metadata

## 13. Explicit non-goals for this schema

- Yjs updates and awareness state
- comments, mentions, suggestions, and notifications
- Canvas/Kanban/Bases/Calendar collaboration
- billing and seat enforcement
- public links and anonymous capabilities
- organization escrow/recovery keys
- post-foundation restricted-space/group administration UI beyond invite-time grants

These may add tables later but must not weaken the V1 identity, access, revision, action, or key-epoch contracts.
