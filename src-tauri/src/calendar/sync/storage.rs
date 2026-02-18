//! Sync Storage
//!
//! Persistent storage for sync-related data:
//! - Event mappings (fingerprint -> event IDs across providers)
//! - Sync state (last sync times, pending changes)
//! - Sync configuration (enabled pairs, conflict resolution)

use std::path::PathBuf;
use std::collections::HashMap;
use crate::calendar::models::{
    CalendarError, EventMapping, SyncState, SyncConfig,
};

/// Storage path: ~/.lokus/calendar/sync/
const SYNC_DIR: &str = "sync";

pub struct SyncStorage;

impl SyncStorage {
    // ============== Path Helpers ==============

    fn get_sync_base_path() -> Result<PathBuf, CalendarError> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| CalendarError::Storage("Failed to get home directory".to_string()))?;
        let sync_dir = home_dir.join(".lokus").join("calendar").join(SYNC_DIR);
        if !sync_dir.exists() {
            std::fs::create_dir_all(&sync_dir)
                .map_err(|e| CalendarError::Storage(format!("Failed to create sync directory: {}", e)))?;
        }
        Ok(sync_dir)
    }

    fn get_mappings_path() -> Result<PathBuf, CalendarError> {
        let base = Self::get_sync_base_path()?;
        Ok(base.join("mappings.json"))
    }

    fn get_sync_state_path() -> Result<PathBuf, CalendarError> {
        let base = Self::get_sync_base_path()?;
        Ok(base.join("state.json"))
    }

    fn get_sync_config_path() -> Result<PathBuf, CalendarError> {
        let base = Self::get_sync_base_path()?;
        Ok(base.join("config.json"))
    }

    fn get_fingerprint_index_path() -> Result<PathBuf, CalendarError> {
        let base = Self::get_sync_base_path()?;
        Ok(base.join("fingerprint_index.json"))
    }

    // ============== Event Mappings ==============

    /// Store all event mappings
    pub fn store_mappings(mappings: &[EventMapping]) -> Result<(), CalendarError> {
        let path = Self::get_mappings_path()?;
        let json = serde_json::to_string_pretty(mappings)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize mappings: {}", e)))?;

        std::fs::write(&path, json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write mappings file: {}", e)))?;

        // Also update the fingerprint index for fast lookups
        Self::update_fingerprint_index(mappings)?;

        Ok(())
    }

    /// Get all event mappings
    pub fn get_mappings() -> Result<Vec<EventMapping>, CalendarError> {
        let path = Self::get_mappings_path()?;

        if !path.exists() {
            return Ok(Vec::new());
        }

        let json = std::fs::read_to_string(&path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read mappings file: {}", e)))?;

        let mappings: Vec<EventMapping> = serde_json::from_str(&json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize mappings: {}", e)))?;

        Ok(mappings)
    }

    /// Get a mapping by fingerprint
    #[allow(dead_code)]
    pub fn get_mapping_by_fingerprint(fingerprint: &str) -> Result<Option<EventMapping>, CalendarError> {
        let mappings = Self::get_mappings()?;
        Ok(mappings.into_iter().find(|m| m.fingerprint == fingerprint))
    }

    /// Get a mapping by event ID (checks primary and linked events)
    #[allow(dead_code)]
    pub fn get_mapping_by_event_id(event_id: &str) -> Result<Option<EventMapping>, CalendarError> {
        let mappings = Self::get_mappings()?;
        Ok(mappings.into_iter().find(|m| {
            m.primary_event_id == event_id ||
            m.linked_events.iter().any(|le| le.event_id == event_id)
        }))
    }

    /// Add or update a mapping
    #[allow(dead_code)]
    pub fn upsert_mapping(mapping: EventMapping) -> Result<(), CalendarError> {
        let mut mappings = Self::get_mappings()?;

        if let Some(idx) = mappings.iter().position(|m| m.id == mapping.id) {
            mappings[idx] = mapping;
        } else {
            mappings.push(mapping);
        }

        Self::store_mappings(&mappings)
    }

    /// Delete a mapping by ID
    #[allow(dead_code)]
    pub fn delete_mapping(mapping_id: &str) -> Result<(), CalendarError> {
        let mut mappings = Self::get_mappings()?;
        mappings.retain(|m| m.id != mapping_id);
        Self::store_mappings(&mappings)
    }

    // ============== Fingerprint Index ==============

    /// Update the fingerprint -> mapping_id index for fast lookups
    fn update_fingerprint_index(mappings: &[EventMapping]) -> Result<(), CalendarError> {
        let path = Self::get_fingerprint_index_path()?;

        let index: HashMap<String, String> = mappings
            .iter()
            .map(|m| (m.fingerprint.clone(), m.id.clone()))
            .collect();

        let json = serde_json::to_string(&index)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize index: {}", e)))?;

        std::fs::write(&path, json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write index file: {}", e)))?;

        Ok(())
    }

    /// Get the fingerprint index for fast lookups
    #[allow(dead_code)]
    pub fn get_fingerprint_index() -> Result<HashMap<String, String>, CalendarError> {
        let path = Self::get_fingerprint_index_path()?;

        if !path.exists() {
            return Ok(HashMap::new());
        }

        let json = std::fs::read_to_string(&path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read index file: {}", e)))?;

        let index: HashMap<String, String> = serde_json::from_str(&json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize index: {}", e)))?;

        Ok(index)
    }

    // ============== Sync State ==============

    /// Store sync state
    pub fn store_sync_state(state: &SyncState) -> Result<(), CalendarError> {
        let path = Self::get_sync_state_path()?;
        let json = serde_json::to_string_pretty(state)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize state: {}", e)))?;

        std::fs::write(&path, json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write state file: {}", e)))?;

        Ok(())
    }

    /// Get sync state
    pub fn get_sync_state() -> Result<SyncState, CalendarError> {
        let path = Self::get_sync_state_path()?;

        if !path.exists() {
            return Ok(SyncState::default());
        }

        let json = std::fs::read_to_string(&path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read state file: {}", e)))?;

        let state: SyncState = serde_json::from_str(&json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize state: {}", e)))?;

        Ok(state)
    }

    // ============== Sync Config ==============

    /// Store sync configuration
    pub fn store_sync_config(config: &SyncConfig) -> Result<(), CalendarError> {
        let path = Self::get_sync_config_path()?;
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize config: {}", e)))?;

        std::fs::write(&path, json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write config file: {}", e)))?;

        Ok(())
    }

    /// Get sync configuration
    pub fn get_sync_config() -> Result<SyncConfig, CalendarError> {
        let path = Self::get_sync_config_path()?;

        if !path.exists() {
            return Ok(SyncConfig::default());
        }

        let json = std::fs::read_to_string(&path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read config file: {}", e)))?;

        let config: SyncConfig = serde_json::from_str(&json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize config: {}", e)))?;

        Ok(config)
    }

    // ============== Utility ==============

    /// Clear all sync data (mappings, state, but keep config)
    #[allow(dead_code)]
    pub fn clear_sync_data() -> Result<(), CalendarError> {
        let base = Self::get_sync_base_path()?;

        // Delete mappings
        let mappings_path = base.join("mappings.json");
        if mappings_path.exists() {
            let _ = std::fs::remove_file(mappings_path);
        }

        // Delete fingerprint index
        let index_path = base.join("fingerprint_index.json");
        if index_path.exists() {
            let _ = std::fs::remove_file(index_path);
        }

        // Reset state
        Self::store_sync_state(&SyncState::default())?;

        Ok(())
    }

    /// Clear everything including config
    #[allow(dead_code)]
    pub fn clear_all() -> Result<(), CalendarError> {
        let base = Self::get_sync_base_path()?;

        if base.exists() {
            std::fs::remove_dir_all(&base)
                .map_err(|e| CalendarError::Storage(format!("Failed to remove sync directory: {}", e)))?;
        }

        Ok(())
    }
}
