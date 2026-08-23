use rusqlite::{params, Transaction};

use super::store::NoteStore;

pub fn allocate_client_sequence(
    tx: &Transaction<'_>,
    scope_kind: &str,
    scope_id: &str,
    now_ms: i64,
) -> rusqlite::Result<i64> {
    if scope_kind == "team" {
        let sequence: i64 = tx.query_row(
            "SELECT next_sequence FROM team_sequence_state WHERE singleton_id=1",
            [],
            |row| row.get(0),
        )?;
        tx.execute(
            "UPDATE team_sequence_state
                SET next_sequence=?1, updated_at_ms=?2
              WHERE singleton_id=1",
            params![sequence + 1, now_ms],
        )?;
        return Ok(sequence);
    }
    tx.query_row(
        "SELECT COALESCE(max(client_sequence), 0) + 1
           FROM outbox_operations
          WHERE scope_kind=?1 AND scope_id=?2",
        params![scope_kind, scope_id],
        |row| row.get(0),
    )
}

pub fn set_team_sequence_high_water(
    store: &NoteStore,
    finalized_sequence: i64,
    now_ms: i64,
) -> Result<i64, String> {
    if finalized_sequence < 0 {
        return Err("team sequence high-water mark cannot be negative".to_string());
    }
    store.with_blocking(move |conn| {
        let next = finalized_sequence + 1;
        conn.execute(
            "UPDATE team_sequence_state
                SET next_sequence=max(next_sequence, ?1), updated_at_ms=?2
              WHERE singleton_id=1",
            params![next, now_ms],
        )?;
        conn.query_row(
            "SELECT next_sequence FROM team_sequence_state WHERE singleton_id=1",
            [],
            |row| row.get(0),
        )
    })
}

#[cfg(test)]
mod tests {
    use rusqlite::TransactionBehavior;

    use super::*;

    #[test]
    fn team_sequences_resume_above_the_server_high_water_mark() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();

        assert_eq!(set_team_sequence_high_water(&store, 9, 1).unwrap(), 10);
        let allocated = store
            .with_blocking(|conn| {
                let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
                let sequence = allocate_client_sequence(&tx, "team", "space-1", 2)?;
                tx.commit()?;
                Ok(sequence)
            })
            .unwrap();
        assert_eq!(allocated, 10);
    }
}
