use rusqlite::Connection;

const MIGRATIONS: &[&str] = &[
    r#"
CREATE TABLE schema_meta (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE workspace_replica (
  singleton_id          INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  client_instance_id    TEXT NOT NULL UNIQUE,
  device_id             TEXT,
  user_id               TEXT,
  workspace_fingerprint TEXT NOT NULL,
  schema_version        INTEGER NOT NULL,
  created_at_ms         INTEGER NOT NULL,
  updated_at_ms         INTEGER NOT NULL
);

CREATE TABLE migration_runs (
  migration_id    TEXT PRIMARY KEY,
  scan_generation INTEGER NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('running', 'committed', 'failed')),
  started_at_ms   INTEGER NOT NULL,
  committed_at_ms INTEGER,
  error_code      TEXT
);

CREATE TABLE sync_scopes (
  scope_kind               TEXT NOT NULL CHECK (scope_kind IN ('local_only', 'personal', 'team')),
  scope_id                 TEXT NOT NULL,
  team_id                  TEXT,
  permission_epoch         INTEGER,
  key_epoch                INTEGER,
  status                   TEXT NOT NULL CHECK (status IN ('active', 'key_pending', 'suspended', 'removed')),
  last_membership_check_ms INTEGER,
  created_at_ms            INTEGER NOT NULL,
  updated_at_ms            INTEGER NOT NULL,
  PRIMARY KEY (scope_kind, scope_id)
) WITHOUT ROWID;
CREATE INDEX idx_sync_scopes_team ON sync_scopes(team_id);

CREATE TABLE local_notes (
  note_id             TEXT PRIMARY KEY,
  relative_path       TEXT NOT NULL,
  normalized_path_key TEXT NOT NULL UNIQUE,
  note_kind           TEXT NOT NULL CHECK (note_kind IN ('markdown', 'plain_text')),
  status              TEXT NOT NULL CHECK (status IN ('active', 'missing', 'tombstoned', 'detached')),
  scope_kind          TEXT NOT NULL,
  scope_id            TEXT NOT NULL,
  file_device         INTEGER,
  file_inode          INTEGER,
  file_size           INTEGER NOT NULL CHECK (file_size >= 0),
  file_mtime_ns       INTEGER NOT NULL,
  created_at_ms       INTEGER NOT NULL,
  updated_at_ms       INTEGER NOT NULL,
  missing_since_ms    INTEGER,
  FOREIGN KEY (scope_kind, scope_id)
    REFERENCES sync_scopes(scope_kind, scope_id)
);
CREATE INDEX idx_local_notes_scope ON local_notes(scope_kind, scope_id);
CREATE INDEX idx_local_notes_file_identity ON local_notes(file_device, file_inode);
CREATE INDEX idx_local_notes_status ON local_notes(status);

CREATE TABLE note_heads (
  note_id            TEXT PRIMARY KEY REFERENCES local_notes(note_id),
  local_generation   INTEGER NOT NULL DEFAULT 0 CHECK (local_generation >= 0),
  local_hash         TEXT,
  remote_revision_id TEXT,
  remote_sequence    INTEGER,
  base_revision_id   TEXT,
  base_hash          TEXT,
  updated_at_ms      INTEGER NOT NULL
);

CREATE TABLE note_path_history (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id             TEXT NOT NULL REFERENCES local_notes(note_id),
  relative_path       TEXT NOT NULL,
  normalized_path_key TEXT NOT NULL,
  reason              TEXT NOT NULL,
  first_seen_at_ms    INTEGER NOT NULL,
  last_seen_at_ms     INTEGER NOT NULL
);
CREATE INDEX idx_note_path_history_note
  ON note_path_history(note_id, last_seen_at_ms);
CREATE INDEX idx_note_path_history_path
  ON note_path_history(normalized_path_key, last_seen_at_ms);

CREATE TABLE mutation_intents (
  op_id                     TEXT PRIMARY KEY,
  note_id                   TEXT NOT NULL REFERENCES local_notes(note_id),
  mutation_kind             TEXT NOT NULL CHECK (
    mutation_kind IN (
      'create', 'write', 'rename', 'move', 'delete', 'restore',
      'apply_remote', 'reconcile_external'
    )
  ),
  source                    TEXT NOT NULL,
  expected_local_generation INTEGER,
  target_relative_path      TEXT,
  journal_relative_path     TEXT NOT NULL UNIQUE,
  payload_size              INTEGER NOT NULL CHECK (payload_size >= 0),
  payload_sha256            TEXT NOT NULL,
  state                     TEXT NOT NULL CHECK (
    state IN ('prepared', 'file_applied', 'committed', 'recovery_required')
  ),
  created_at_ms             INTEGER NOT NULL,
  file_applied_at_ms        INTEGER,
  committed_at_ms           INTEGER,
  error_code                TEXT
);
CREATE INDEX idx_mutation_intents_note_state
  ON mutation_intents(note_id, state);

CREATE TABLE note_mutation_locks (
  note_id       TEXT PRIMARY KEY REFERENCES local_notes(note_id),
  op_id         TEXT NOT NULL UNIQUE REFERENCES mutation_intents(op_id),
  acquired_at_ms INTEGER NOT NULL
);

CREATE TABLE outbox_operations (
  op_id                    TEXT PRIMARY KEY REFERENCES mutation_intents(op_id),
  note_id                  TEXT NOT NULL REFERENCES local_notes(note_id),
  scope_kind               TEXT NOT NULL,
  scope_id                 TEXT NOT NULL,
  client_sequence          INTEGER NOT NULL CHECK (client_sequence > 0),
  base_revision_id         TEXT,
  payload_relative_path    TEXT NOT NULL,
  state                    TEXT NOT NULL CHECK (
    state IN ('pending', 'in_flight', 'accepted', 'conflicted', 'rejected')
  ),
  attempt_count            INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  retry_after_ms           INTEGER,
  accepted_revision_id     TEXT,
  accepted_action_sequence INTEGER,
  last_error_code          TEXT,
  created_at_ms            INTEGER NOT NULL,
  updated_at_ms            INTEGER NOT NULL,
  UNIQUE (scope_kind, scope_id, client_sequence),
  FOREIGN KEY (scope_kind, scope_id)
    REFERENCES sync_scopes(scope_kind, scope_id)
);
CREATE INDEX idx_outbox_due ON outbox_operations(state, retry_after_ms);

CREATE TABLE inbox_actions (
  action_id                   TEXT PRIMARY KEY,
  scope_id                    TEXT NOT NULL,
  action_sequence             INTEGER NOT NULL CHECK (action_sequence > 0),
  action_type                 TEXT NOT NULL,
  note_id                     TEXT NOT NULL,
  revision_id                 TEXT,
  encrypted_object_key        TEXT,
  staged_payload_relative_path TEXT,
  state                       TEXT NOT NULL CHECK (
    state IN ('received', 'applying', 'applied', 'recovery_required')
  ),
  received_at_ms              INTEGER NOT NULL,
  applied_at_ms               INTEGER,
  error_code                  TEXT,
  UNIQUE (scope_id, action_sequence)
);
CREATE INDEX idx_inbox_state ON inbox_actions(state, received_at_ms);

CREATE TABLE sync_checkpoints (
  scope_kind           TEXT NOT NULL,
  scope_id             TEXT NOT NULL,
  last_applied_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_applied_sequence >= 0),
  updated_at_ms        INTEGER NOT NULL,
  PRIMARY KEY (scope_kind, scope_id),
  FOREIGN KEY (scope_kind, scope_id)
    REFERENCES sync_scopes(scope_kind, scope_id)
) WITHOUT ROWID;

CREATE TABLE local_tombstones (
  note_id                 TEXT PRIMARY KEY REFERENCES local_notes(note_id),
  op_id                   TEXT NOT NULL REFERENCES mutation_intents(op_id),
  local_generation        INTEGER NOT NULL CHECK (local_generation >= 0),
  remote_revision_id      TEXT,
  retention_expires_at_ms INTEGER,
  restored_at_ms          INTEGER,
  created_at_ms           INTEGER NOT NULL
);

CREATE TABLE recovery_branches (
  id                    TEXT PRIMARY KEY,
  note_id               TEXT NOT NULL REFERENCES local_notes(note_id),
  kind                  TEXT NOT NULL CHECK (kind IN ('local', 'remote', 'base', 'external', 'rejected')),
  payload_relative_path TEXT NOT NULL UNIQUE,
  payload_sha256        TEXT NOT NULL,
  base_revision_id      TEXT,
  remote_revision_id    TEXT,
  source_op_id          TEXT,
  created_at_ms         INTEGER NOT NULL,
  resolved_at_ms        INTEGER
);
CREATE INDEX idx_recovery_note ON recovery_branches(note_id, resolved_at_ms);
CREATE INDEX idx_recovery_kind ON recovery_branches(kind, created_at_ms);
"#,
    r#"
ALTER TABLE local_notes ADD COLUMN pending_scope_id TEXT;

ALTER TABLE outbox_operations
  ADD COLUMN encrypted_payload_relative_path TEXT;
ALTER TABLE outbox_operations
  ADD COLUMN encrypted_payload_sha256 TEXT;
ALTER TABLE outbox_operations
  ADD COLUMN encrypted_payload_size INTEGER;

ALTER TABLE inbox_actions ADD COLUMN team_id TEXT;
ALTER TABLE inbox_actions ADD COLUMN permission_epoch INTEGER;
ALTER TABLE inbox_actions ADD COLUMN key_epoch INTEGER;
ALTER TABLE inbox_actions ADD COLUMN relative_path TEXT;

CREATE TABLE team_sequence_state (
  singleton_id  INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  next_sequence INTEGER NOT NULL CHECK (next_sequence > 0),
  updated_at_ms INTEGER NOT NULL
);
INSERT INTO team_sequence_state (singleton_id, next_sequence, updated_at_ms)
SELECT 1,
       COALESCE((
         SELECT max(client_sequence) + 1
           FROM outbox_operations
          WHERE scope_kind='team'
       ), 1),
       0;
"#,
    r#"
UPDATE outbox_operations
   SET encrypted_payload_relative_path=NULL,
       encrypted_payload_sha256=NULL,
       encrypted_payload_size=NULL
 WHERE encrypted_payload_relative_path IS NOT NULL;
"#,
    r#"
ALTER TABLE note_heads ADD COLUMN remote_space_id TEXT;

UPDATE note_heads
   SET remote_space_id=(
     SELECT note.scope_id
       FROM local_notes note
      WHERE note.note_id=note_heads.note_id
        AND note.scope_kind='team'
   )
 WHERE remote_revision_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM local_notes note
      WHERE note.note_id=note_heads.note_id
        AND note.scope_kind='team'
   );
"#,
    r#"
ALTER TABLE outbox_operations ADD COLUMN move_source_scope_id TEXT;

UPDATE outbox_operations
   SET move_source_scope_id=(
     SELECT note.scope_id
       FROM local_notes note
      WHERE note.note_id=outbox_operations.note_id
   )
 WHERE move_source_scope_id IS NULL
   AND scope_kind='team'
   AND EXISTS (
     SELECT 1
       FROM mutation_intents intent
       JOIN local_notes note ON note.note_id=intent.note_id
      WHERE intent.op_id=outbox_operations.op_id
        AND intent.source='team-space-move'
        AND note.pending_scope_id=outbox_operations.scope_id
   );
"#,
];

pub fn apply_migrations(conn: &mut Connection) -> Result<(), String> {
    let current: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    for (index, sql) in MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version <= current {
            continue;
        }
        let tx = conn
            .transaction()
            .map_err(|error| format!("migration v{version}: {error}"))?;
        if version == 3 {
            add_column_if_missing(
                &tx,
                "outbox_operations",
                "encrypted_payload_key_epoch",
                "INTEGER",
            )
            .map_err(|error| format!("migration v{version}: {error}"))?;
            add_column_if_missing(&tx, "outbox_operations", "claim_token", "TEXT")
                .map_err(|error| format!("migration v{version}: {error}"))?;
            add_column_if_missing(&tx, "outbox_operations", "claim_expires_at_ms", "INTEGER")
                .map_err(|error| format!("migration v{version}: {error}"))?;
        }
        tx.execute_batch(sql)
            .map_err(|error| format!("migration v{version}: {error}"))?;
        tx.pragma_update(None, "user_version", version)
            .map_err(|error| format!("migration v{version}: {error}"))?;
        tx.commit()
            .map_err(|error| format!("migration v{version}: {error}"))?;
    }

    Ok(())
}

fn add_column_if_missing(
    tx: &rusqlite::Transaction<'_>,
    table: &str,
    column: &str,
    definition: &str,
) -> rusqlite::Result<()> {
    let exists: bool = tx.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM pragma_table_info(?1) WHERE name=?2
         )",
        [table, column],
        |row| row.get(0),
    )?;
    if !exists {
        tx.execute_batch(&format!(
            "ALTER TABLE {table} ADD COLUMN {column} {definition}"
        ))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_exists(conn: &Connection, table: &str) -> bool {
        conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
            [table],
            |row| row.get(0),
        )
        .unwrap()
    }

    #[test]
    fn migrations_create_the_complete_note_engine_schema() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();

        apply_migrations(&mut conn).unwrap();

        for table in [
            "schema_meta",
            "workspace_replica",
            "migration_runs",
            "sync_scopes",
            "local_notes",
            "note_heads",
            "note_path_history",
            "mutation_intents",
            "note_mutation_locks",
            "outbox_operations",
            "inbox_actions",
            "sync_checkpoints",
            "local_tombstones",
            "recovery_branches",
            "team_sequence_state",
        ] {
            assert!(table_exists(&conn, table), "missing table {table}");
        }
    }

    #[test]
    fn migrations_are_idempotent_and_advance_user_version() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();

        apply_migrations(&mut conn).unwrap();
        apply_migrations(&mut conn).unwrap();

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn v3_upgrades_existing_v2_outboxes_and_invalidates_unbound_ciphertext() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.execute_batch(MIGRATIONS[1]).unwrap();
        conn.pragma_update(None, "user_version", 2).unwrap();
        conn.execute(
            "INSERT INTO sync_scopes (
               scope_kind, scope_id, team_id, permission_epoch, key_epoch,
               status, created_at_ms, updated_at_ms
             ) VALUES ('team', 'space-1', 'team-1', 1, 1, 'active', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO local_notes (
               note_id, relative_path, normalized_path_key, note_kind, status,
               scope_kind, scope_id, file_size, file_mtime_ns,
               created_at_ms, updated_at_ms
             ) VALUES (
               'note-1', 'note.md', 'note.md', 'markdown', 'active',
               'team', 'space-1', 0, 0, 1, 1
             )",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO mutation_intents (
               op_id, note_id, mutation_kind, source, journal_relative_path,
               payload_size, payload_sha256, state, created_at_ms
             ) VALUES (
               'op-1', 'note-1', 'write', 'test', 'none', 1, 'hash',
               'committed', 1
             )",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO outbox_operations (
               op_id, note_id, scope_kind, scope_id, client_sequence,
               payload_relative_path, state, created_at_ms, updated_at_ms,
               encrypted_payload_relative_path
             ) VALUES (
               'op-1', 'note-1', 'team', 'space-1', 1,
               'outbox/op-1', 'pending', 1, 1, 'team-outbox/op-1'
             )",
            [],
        )
        .unwrap();

        apply_migrations(&mut conn).unwrap();

        let cached: Option<String> = conn
            .query_row(
                "SELECT encrypted_payload_relative_path FROM outbox_operations",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(cached, None);
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn v3_accepts_the_early_v2_layout_that_already_had_lease_columns() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.execute_batch(MIGRATIONS[1]).unwrap();
        conn.execute_batch(
            "ALTER TABLE outbox_operations
               ADD COLUMN encrypted_payload_key_epoch INTEGER;
             ALTER TABLE outbox_operations ADD COLUMN claim_token TEXT;
             ALTER TABLE outbox_operations
               ADD COLUMN claim_expires_at_ms INTEGER;",
        )
        .unwrap();
        conn.pragma_update(None, "user_version", 2).unwrap();

        apply_migrations(&mut conn).unwrap();

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn v5_backfills_source_scope_for_an_existing_pending_move() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        for migration in &MIGRATIONS[..4] {
            conn.execute_batch(migration).unwrap();
        }
        conn.pragma_update(None, "user_version", 4).unwrap();
        conn.execute_batch(
            "INSERT INTO sync_scopes (
               scope_kind, scope_id, team_id, permission_epoch, key_epoch,
               status, created_at_ms, updated_at_ms
             ) VALUES
               ('team', 'space-a', 'team-1', 1, 1, 'active', 1, 1),
               ('team', 'space-b', 'team-1', 1, 1, 'active', 1, 1);
             INSERT INTO local_notes (
               note_id, relative_path, normalized_path_key, note_kind, status,
               scope_kind, scope_id, pending_scope_id, file_size, file_mtime_ns,
               created_at_ms, updated_at_ms
             ) VALUES (
               'note-1', 'note.md', 'note.md', 'markdown', 'active',
               'team', 'space-a', 'space-b', 0, 0, 1, 1
             );
             INSERT INTO mutation_intents (
               op_id, note_id, mutation_kind, source, journal_relative_path,
               payload_size, payload_sha256, state, created_at_ms
             ) VALUES (
               'op-1', 'note-1', 'move', 'team-space-move', 'none',
               0, 'hash', 'committed', 1
             );
             INSERT INTO outbox_operations (
               op_id, note_id, scope_kind, scope_id, client_sequence,
               payload_relative_path, state, created_at_ms, updated_at_ms
             ) VALUES (
               'op-1', 'note-1', 'team', 'space-b', 1,
               'outbox/op-1', 'pending', 1, 1
             );",
        )
        .unwrap();

        apply_migrations(&mut conn).unwrap();

        let source: String = conn
            .query_row(
                "SELECT move_source_scope_id FROM outbox_operations",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(source, "space-a");
    }

    #[test]
    fn one_live_note_owns_one_normalized_path() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        apply_migrations(&mut conn).unwrap();
        conn.execute(
            "INSERT INTO sync_scopes (
               scope_kind, scope_id, status, created_at_ms, updated_at_ms
             ) VALUES ('local_only', 'workspace', 'active', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO local_notes (
               note_id, relative_path, normalized_path_key, note_kind, status,
               scope_kind, scope_id, file_size, file_mtime_ns,
               created_at_ms, updated_at_ms
             ) VALUES (
               'note-1', 'Note.md', 'note.md', 'markdown', 'active',
               'local_only', 'workspace', 0, 0, 1, 1
             )",
            [],
        )
        .unwrap();

        let duplicate = conn.execute(
            "INSERT INTO local_notes (
               note_id, relative_path, normalized_path_key, note_kind, status,
               scope_kind, scope_id, file_size, file_mtime_ns,
               created_at_ms, updated_at_ms
             ) VALUES (
               'note-2', 'NOTE.md', 'note.md', 'markdown', 'active',
               'local_only', 'workspace', 0, 0, 1, 1
             )",
            [],
        );
        assert!(duplicate.is_err());
    }

    #[test]
    fn note_mutation_lock_allows_only_one_in_flight_operation() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        apply_migrations(&mut conn).unwrap();
        conn.execute_batch(
            r#"
INSERT INTO sync_scopes (
  scope_kind, scope_id, status, created_at_ms, updated_at_ms
) VALUES ('local_only', 'workspace', 'active', 1, 1);
INSERT INTO local_notes (
  note_id, relative_path, normalized_path_key, note_kind, status,
  scope_kind, scope_id, file_size, file_mtime_ns, created_at_ms, updated_at_ms
) VALUES (
  'note-1', 'note.md', 'note.md', 'markdown', 'active',
  'local_only', 'workspace', 0, 0, 1, 1
);
INSERT INTO mutation_intents (
  op_id, note_id, mutation_kind, source, journal_relative_path,
  payload_size, payload_sha256, state, created_at_ms
) VALUES
  ('op-1', 'note-1', 'write', 'editor', 'journal/op-1', 1, 'a', 'prepared', 1),
  ('op-2', 'note-1', 'write', 'editor', 'journal/op-2', 1, 'b', 'prepared', 2);
INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
VALUES ('note-1', 'op-1', 1);
"#,
        )
        .unwrap();

        let second = conn.execute(
            "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
             VALUES ('note-1', 'op-2', 2)",
            [],
        );
        assert!(second.is_err());
    }
}
