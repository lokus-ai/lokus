use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreBuilder;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleBlock {
    pub id: String,
    pub task_id: String,
    pub start: String,       // ISO 8601 datetime
    pub end: String,         // ISO 8601 datetime
    pub created_at: i64,     // Unix timestamp in milliseconds
    pub updated_at: i64,     // Unix timestamp in milliseconds
}

impl ScheduleBlock {
    pub fn new(task_id: String, start: String, end: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            task_id,
            start,
            end,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduleBlockStore {
    pub blocks: HashMap<String, ScheduleBlock>,
}

impl Default for ScheduleBlockStore {
    fn default() -> Self {
        Self {
            blocks: HashMap::new(),
        }
    }
}

impl ScheduleBlockStore {
    pub fn add_block(&mut self, block: ScheduleBlock) {
        self.blocks.insert(block.id.clone(), block);
    }

    pub fn update_block(&mut self, block_id: &str, block: ScheduleBlock) -> Result<(), String> {
        if self.blocks.contains_key(block_id) {
            self.blocks.insert(block_id.to_string(), block);
            Ok(())
        } else {
            Err(format!("Schedule block with id {} not found", block_id))
        }
    }

    pub fn delete_block(&mut self, block_id: &str) -> Result<(), String> {
        if self.blocks.remove(block_id).is_some() {
            Ok(())
        } else {
            Err(format!("Schedule block with id {} not found", block_id))
        }
    }

    pub fn get_block(&self, block_id: &str) -> Option<&ScheduleBlock> {
        self.blocks.get(block_id)
    }

    pub fn get_all_blocks(&self) -> Vec<&ScheduleBlock> {
        self.blocks.values().collect()
    }

    pub fn get_blocks_for_task(&self, task_id: &str) -> Vec<&ScheduleBlock> {
        self.blocks
            .values()
            .filter(|block| block.task_id == task_id)
            .collect()
    }

    pub fn get_blocks_in_range(&self, range_start: &str, range_end: &str) -> Vec<&ScheduleBlock> {
        self.blocks
            .values()
            .filter(|block| block.end > range_start.to_string() && block.start < range_end.to_string())
            .collect()
    }

    pub fn delete_blocks_for_task(&mut self, task_id: &str) -> Vec<String> {
        let ids_to_remove: Vec<String> = self.blocks
            .iter()
            .filter(|(_, block)| block.task_id == task_id)
            .map(|(id, _)| id.clone())
            .collect();

        for id in &ids_to_remove {
            self.blocks.remove(id);
        }

        ids_to_remove
    }
}

fn get_schedule_block_store(app: &AppHandle) -> Result<ScheduleBlockStore, String> {
    let store = StoreBuilder::new(app, PathBuf::from(".schedule-blocks.dat"))
        .build()
        .map_err(|e| format!("Failed to build schedule block store: {}", e))?;

    let _ = store.reload();

    match store.get("schedule_blocks") {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to deserialize schedule blocks: {}", e)),
        None => Ok(ScheduleBlockStore::default()),
    }
}

fn save_schedule_block_store(app: &AppHandle, store_data: &ScheduleBlockStore) -> Result<(), String> {
    let store = StoreBuilder::new(app, PathBuf::from(".schedule-blocks.dat"))
        .build()
        .map_err(|e| format!("Failed to build schedule block store: {}", e))?;

    let _ = store.reload();

    let serialized = serde_json::to_value(store_data)
        .map_err(|e| format!("Failed to serialize schedule blocks: {}", e))?;

    store.set("schedule_blocks".to_string(), serialized);

    store
        .save()
        .map_err(|e| format!("Failed to save schedule block store: {}", e))?;

    Ok(())
}

// Tauri commands

#[tauri::command]
pub async fn create_schedule_block(
    app: AppHandle,
    task_id: String,
    start: String,
    end: String,
) -> Result<ScheduleBlock, String> {
    let block = ScheduleBlock::new(task_id, start, end);

    let mut store_data = get_schedule_block_store(&app)?;
    store_data.add_block(block.clone());
    save_schedule_block_store(&app, &store_data)?;

    Ok(block)
}

#[tauri::command]
pub async fn update_schedule_block(
    app: AppHandle,
    block_id: String,
    start: Option<String>,
    end: Option<String>,
) -> Result<ScheduleBlock, String> {
    let mut store_data = get_schedule_block_store(&app)?;

    let mut block = store_data
        .get_block(&block_id)
        .ok_or_else(|| format!("Schedule block with id {} not found", block_id))?
        .clone();

    if let Some(new_start) = start {
        block.start = new_start;
    }
    if let Some(new_end) = end {
        block.end = new_end;
    }
    block.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    store_data.update_block(&block_id, block.clone())?;
    save_schedule_block_store(&app, &store_data)?;

    Ok(block)
}

#[tauri::command]
pub async fn delete_schedule_block(app: AppHandle, block_id: String) -> Result<(), String> {
    let mut store_data = get_schedule_block_store(&app)?;
    store_data.delete_block(&block_id)?;
    save_schedule_block_store(&app, &store_data)?;
    Ok(())
}

#[tauri::command]
pub async fn get_all_schedule_blocks(app: AppHandle) -> Result<Vec<ScheduleBlock>, String> {
    let store_data = get_schedule_block_store(&app)?;
    Ok(store_data.get_all_blocks().into_iter().cloned().collect())
}

#[tauri::command]
pub async fn get_schedule_blocks_for_task(
    app: AppHandle,
    task_id: String,
) -> Result<Vec<ScheduleBlock>, String> {
    let store_data = get_schedule_block_store(&app)?;
    Ok(store_data
        .get_blocks_for_task(&task_id)
        .into_iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn get_schedule_blocks_in_range(
    app: AppHandle,
    range_start: String,
    range_end: String,
) -> Result<Vec<ScheduleBlock>, String> {
    let store_data = get_schedule_block_store(&app)?;
    Ok(store_data
        .get_blocks_in_range(&range_start, &range_end)
        .into_iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn delete_schedule_blocks_for_task(
    app: AppHandle,
    task_id: String,
) -> Result<Vec<String>, String> {
    let mut store_data = get_schedule_block_store(&app)?;
    let deleted_ids = store_data.delete_blocks_for_task(&task_id);
    save_schedule_block_store(&app, &store_data)?;
    Ok(deleted_ids)
}

// UUID generation - same pattern as tasks module
mod uuid {
    use std::fmt;

    pub struct Uuid([u8; 16]);

    impl Uuid {
        pub fn new_v4() -> Self {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            use std::time::SystemTime;

            let mut hasher = DefaultHasher::new();
            SystemTime::now().hash(&mut hasher);
            std::thread::current().id().hash(&mut hasher);

            let hash = hasher.finish();
            let mut bytes = [0u8; 16];
            bytes[0..8].copy_from_slice(&hash.to_be_bytes());
            bytes[8..16].copy_from_slice(&hash.to_le_bytes());

            // Set version (4) and variant bits
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;

            Uuid(bytes)
        }

        pub fn to_string(&self) -> String {
            format!(
                "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                self.0[0], self.0[1], self.0[2], self.0[3],
                self.0[4], self.0[5],
                self.0[6], self.0[7],
                self.0[8], self.0[9],
                self.0[10], self.0[11], self.0[12], self.0[13], self.0[14], self.0[15]
            )
        }
    }

    impl fmt::Display for Uuid {
        fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
            write!(f, "{}", self.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schedule_block_creation() {
        let block = ScheduleBlock::new(
            "task-123".to_string(),
            "2026-02-16T09:00:00Z".to_string(),
            "2026-02-16T10:00:00Z".to_string(),
        );
        assert_eq!(block.task_id, "task-123");
        assert_eq!(block.start, "2026-02-16T09:00:00Z");
        assert_eq!(block.end, "2026-02-16T10:00:00Z");
        assert!(!block.id.is_empty());
    }

    #[test]
    fn test_schedule_block_store_operations() {
        let mut store = ScheduleBlockStore::default();
        let block = ScheduleBlock::new(
            "task-123".to_string(),
            "2026-02-16T09:00:00Z".to_string(),
            "2026-02-16T10:00:00Z".to_string(),
        );
        let block_id = block.id.clone();

        // Add block
        store.add_block(block);
        assert!(store.get_block(&block_id).is_some());

        // Update block
        let mut updated_block = store.get_block(&block_id).unwrap().clone();
        updated_block.end = "2026-02-16T11:00:00Z".to_string();
        store.update_block(&block_id, updated_block).unwrap();
        assert_eq!(store.get_block(&block_id).unwrap().end, "2026-02-16T11:00:00Z");

        // Delete block
        store.delete_block(&block_id).unwrap();
        assert!(store.get_block(&block_id).is_none());
    }

    #[test]
    fn test_get_blocks_for_task() {
        let mut store = ScheduleBlockStore::default();

        let block1 = ScheduleBlock::new(
            "task-1".to_string(),
            "2026-02-16T09:00:00Z".to_string(),
            "2026-02-16T10:00:00Z".to_string(),
        );
        let block2 = ScheduleBlock::new(
            "task-1".to_string(),
            "2026-02-17T14:00:00Z".to_string(),
            "2026-02-17T15:00:00Z".to_string(),
        );
        let block3 = ScheduleBlock::new(
            "task-2".to_string(),
            "2026-02-16T11:00:00Z".to_string(),
            "2026-02-16T12:00:00Z".to_string(),
        );

        store.add_block(block1);
        store.add_block(block2);
        store.add_block(block3);

        let task1_blocks = store.get_blocks_for_task("task-1");
        assert_eq!(task1_blocks.len(), 2);

        let task2_blocks = store.get_blocks_for_task("task-2");
        assert_eq!(task2_blocks.len(), 1);
    }

    #[test]
    fn test_get_blocks_in_range() {
        let mut store = ScheduleBlockStore::default();

        let block1 = ScheduleBlock::new(
            "task-1".to_string(),
            "2026-02-16T09:00:00Z".to_string(),
            "2026-02-16T10:00:00Z".to_string(),
        );
        let block2 = ScheduleBlock::new(
            "task-2".to_string(),
            "2026-02-17T14:00:00Z".to_string(),
            "2026-02-17T15:00:00Z".to_string(),
        );
        let block3 = ScheduleBlock::new(
            "task-3".to_string(),
            "2026-02-20T11:00:00Z".to_string(),
            "2026-02-20T12:00:00Z".to_string(),
        );

        store.add_block(block1);
        store.add_block(block2);
        store.add_block(block3);

        // Range covering only Feb 16
        let feb16_blocks = store.get_blocks_in_range(
            "2026-02-16T00:00:00Z",
            "2026-02-16T23:59:59Z",
        );
        assert_eq!(feb16_blocks.len(), 1);

        // Range covering Feb 16-17
        let week_blocks = store.get_blocks_in_range(
            "2026-02-16T00:00:00Z",
            "2026-02-17T23:59:59Z",
        );
        assert_eq!(week_blocks.len(), 2);
    }

    #[test]
    fn test_delete_blocks_for_task() {
        let mut store = ScheduleBlockStore::default();

        let block1 = ScheduleBlock::new(
            "task-1".to_string(),
            "2026-02-16T09:00:00Z".to_string(),
            "2026-02-16T10:00:00Z".to_string(),
        );
        let block2 = ScheduleBlock::new(
            "task-1".to_string(),
            "2026-02-17T14:00:00Z".to_string(),
            "2026-02-17T15:00:00Z".to_string(),
        );
        let block3 = ScheduleBlock::new(
            "task-2".to_string(),
            "2026-02-16T11:00:00Z".to_string(),
            "2026-02-16T12:00:00Z".to_string(),
        );

        store.add_block(block1);
        store.add_block(block2);
        store.add_block(block3);

        let deleted = store.delete_blocks_for_task("task-1");
        assert_eq!(deleted.len(), 2);
        assert_eq!(store.get_all_blocks().len(), 1);
    }
}
