//! Sync Engine
//!
//! Handles bidirectional synchronization between calendar providers:
//! - Full sync: Fetch all events, reconcile duplicates, propagate changes
//! - Incremental sync: Only sync changes since last sync
//! - Conflict resolution based on configuration

use chrono::{Utc, Duration};
use std::collections::HashMap;
use uuid::Uuid;

use crate::calendar::models::{
    CalendarEvent, CalendarProvider, Calendar, CalendarError,
    EventMapping, LinkedEvent, SyncEventStatus, SyncConfig,
    FullSyncResult, ConflictResolution, CreateEventRequest, UpdateEventRequest,
};
use crate::calendar::storage::CalendarStorage;
use crate::calendar::google::GoogleCalendarApi;
use crate::calendar::caldav::CalDAVClient;
use super::fingerprint::compute_fingerprint;
use super::storage::SyncStorage;

pub struct SyncEngine {
    config: SyncConfig,
}

impl SyncEngine {
    pub fn new() -> Result<Self, CalendarError> {
        let config = SyncStorage::get_sync_config()?;
        Ok(Self { config })
    }

    #[allow(dead_code)]
    pub fn with_config(config: SyncConfig) -> Self {
        Self { config }
    }

    /// Performs a full sync across all configured calendar pairs.
    ///
    /// Algorithm:
    /// 1. Fetch all events from all providers (time range: -30 days to +90 days)
    /// 2. Compute fingerprint for each event
    /// 3. Group events by fingerprint
    /// 4. For duplicates: reconcile and update mappings
    /// 5. For configured sync pairs: propagate changes bidirectionally
    pub async fn full_sync(&self) -> Result<FullSyncResult, CalendarError> {
        let mut result = FullSyncResult {
            success: false,
            events_created: 0,
            events_updated: 0,
            events_deleted: 0,
            duplicates_found: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            synced_at: Utc::now(),
        };

        // Update sync state to "in progress"
        let mut state = SyncStorage::get_sync_state()?;
        state.sync_in_progress = true;
        SyncStorage::store_sync_state(&state)?;

        // Define time range: -30 days to +90 days
        let now = Utc::now();
        let start = now - Duration::days(30);
        let end = now + Duration::days(90);

        // Step 1: Fetch all events from all providers
        let (events, calendars) = match self.fetch_all_events(start, end).await {
            Ok(data) => data,
            Err(e) => {
                result.errors.push(format!("Failed to fetch events: {}", e));
                state.sync_in_progress = false;
                state.last_error = Some(e.to_string());
                SyncStorage::store_sync_state(&state)?;
                return Ok(result);
            }
        };

        // Step 2 & 3: Group by fingerprint
        let mut fingerprint_groups: HashMap<String, Vec<CalendarEvent>> = HashMap::new();
        for event in events {
            let fp = compute_fingerprint(&event);
            fingerprint_groups.entry(fp).or_default().push(event);
        }

        // Step 4: Reconcile duplicates and update mappings
        let mut mappings = SyncStorage::get_mappings()?;
        let existing_fps: HashMap<String, usize> = mappings.iter()
            .enumerate()
            .map(|(i, m)| (m.fingerprint.clone(), i))
            .collect();

        for (fingerprint, group) in &fingerprint_groups {
            if group.len() > 1 {
                result.duplicates_found += 1;

                // Check for existing mapping
                if let Some(&idx) = existing_fps.get(fingerprint) {
                    // Update existing mapping
                    self.update_mapping(&mut mappings[idx], group, &calendars)?;
                } else {
                    // Create new mapping
                    let mapping = self.create_mapping(fingerprint.clone(), group, &calendars)?;
                    mappings.push(mapping);
                }
            }
        }

        SyncStorage::store_mappings(&mappings)?;

        // Step 5: Propagate changes for configured sync pairs
        if self.config.enabled {
            for pair in &self.config.sync_pairs {
                if !pair.enabled {
                    continue;
                }

                match self.propagate_for_pair(pair, &fingerprint_groups, &calendars).await {
                    Ok((created, updated, deleted, conflicts)) => {
                        result.events_created += created;
                        result.events_updated += updated;
                        result.events_deleted += deleted;
                        result.conflicts_resolved += conflicts;
                    }
                    Err(e) => {
                        result.errors.push(format!(
                            "Sync pair {} failed: {}",
                            pair.id, e
                        ));
                    }
                }
            }
        }

        // Update sync state
        state.sync_in_progress = false;
        state.last_full_sync = Some(Utc::now());
        state.last_error = if result.errors.is_empty() {
            None
        } else {
            Some(result.errors.join("; "))
        };
        SyncStorage::store_sync_state(&state)?;

        result.success = result.errors.is_empty();
        Ok(result)
    }

    /// Fetch all events from all connected providers
    async fn fetch_all_events(
        &self,
        start: chrono::DateTime<Utc>,
        end: chrono::DateTime<Utc>,
    ) -> Result<(Vec<CalendarEvent>, Vec<Calendar>), CalendarError> {
        let calendars = CalendarStorage::get_calendars()?;
        let mut all_events = Vec::new();

        // Fetch from Google Calendar
        if let Ok(api) = GoogleCalendarApi::new() {
            for calendar in calendars.iter().filter(|c| c.provider == CalendarProvider::Google && c.visible) {
                match api.get_events(&calendar.id, start, end, None).await {
                    Ok(events) => all_events.extend(events),
                    Err(e) => {
                        tracing::warn!("Failed to fetch Google events from {}: {}", calendar.id, e);
                    }
                }
            }
        }

        // Fetch from CalDAV
        if let Ok(Some(account)) = CalendarStorage::get_caldav_account() {
            if let Ok(client) = CalDAVClient::new(account) {
                for calendar in calendars.iter().filter(|c| c.provider == CalendarProvider::CalDAV && c.visible) {
                    match client.get_events(&calendar.id, start, end).await {
                        Ok(events) => all_events.extend(events),
                        Err(e) => {
                            tracing::warn!("Failed to fetch CalDAV events from {}: {}", calendar.id, e);
                        }
                    }
                }
            }
        }

        // Fetch from iCal subscriptions (read-only)
        for calendar in calendars.iter().filter(|c| c.provider == CalendarProvider::ICal && c.visible) {
            match CalendarStorage::get_ical_events(&calendar.id) {
                Ok(events) => {
                    // Filter to time range
                    let filtered: Vec<_> = events.into_iter()
                        .filter(|e| e.start <= end && e.end >= start)
                        .collect();
                    all_events.extend(filtered);
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch iCal events from {}: {}", calendar.id, e);
                }
            }
        }

        Ok((all_events, calendars))
    }

    /// Create a new mapping for a group of duplicate events
    fn create_mapping(
        &self,
        fingerprint: String,
        events: &[CalendarEvent],
        calendars: &[Calendar],
    ) -> Result<EventMapping, CalendarError> {
        // Select primary event
        let primary = self.select_primary(events, calendars);

        // Build linked events list
        let linked_events: Vec<LinkedEvent> = events.iter()
            .filter(|e| e.id != primary.id)
            .map(|e| LinkedEvent {
                event_id: e.id.clone(),
                calendar_id: e.calendar_id.clone(),
                provider: e.provider,
                last_synced_at: Utc::now(),
                last_modified_at: e.updated_at,
                sync_status: SyncEventStatus::Synced,
            })
            .collect();

        Ok(EventMapping {
            id: Uuid::new_v4().to_string(),
            fingerprint,
            primary_event_id: primary.id.clone(),
            primary_provider: primary.provider,
            primary_calendar_id: primary.calendar_id.clone(),
            linked_events,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Update an existing mapping with new event data
    fn update_mapping(
        &self,
        mapping: &mut EventMapping,
        events: &[CalendarEvent],
        calendars: &[Calendar],
    ) -> Result<(), CalendarError> {
        // Re-select primary (might have changed)
        let primary = self.select_primary(events, calendars);

        mapping.primary_event_id = primary.id.clone();
        mapping.primary_provider = primary.provider;
        mapping.primary_calendar_id = primary.calendar_id.clone();
        mapping.updated_at = Utc::now();

        // Update linked events
        mapping.linked_events = events.iter()
            .filter(|e| e.id != primary.id)
            .map(|e| {
                // Check if this was already linked
                let existing = mapping.linked_events.iter()
                    .find(|le| le.event_id == e.id);

                LinkedEvent {
                    event_id: e.id.clone(),
                    calendar_id: e.calendar_id.clone(),
                    provider: e.provider,
                    last_synced_at: existing.map(|le| le.last_synced_at).unwrap_or(Utc::now()),
                    last_modified_at: e.updated_at,
                    sync_status: SyncEventStatus::Synced,
                }
            })
            .collect();

        Ok(())
    }

    /// Select the primary event from a group
    fn select_primary<'a>(&self, events: &'a [CalendarEvent], calendars: &[Calendar]) -> &'a CalendarEvent {
        let calendar_map: HashMap<String, &Calendar> = calendars.iter()
            .map(|c| (c.id.clone(), c))
            .collect();

        events.iter()
            .max_by_key(|e| {
                let mut score = 0i64;
                let cal = calendar_map.get(&e.calendar_id);

                // Prefer writable
                if cal.map(|c| c.is_writable).unwrap_or(false) {
                    score += 1000;
                }

                // Prefer non-iCal
                if e.provider != CalendarProvider::ICal {
                    score += 500;
                }

                // Prefer Google (typically most feature-rich)
                if e.provider == CalendarProvider::Google {
                    score += 100;
                }

                // Prefer primary calendar
                if cal.map(|c| c.is_primary).unwrap_or(false) {
                    score += 50;
                }

                // Prefer more recently modified
                if let Some(updated) = e.updated_at {
                    score += updated.timestamp() / 86400; // Days as score
                }

                score
            })
            .unwrap()
    }

    /// Propagate changes for a configured sync pair
    async fn propagate_for_pair(
        &self,
        pair: &crate::calendar::models::SyncPair,
        fingerprint_groups: &HashMap<String, Vec<CalendarEvent>>,
        calendars: &[Calendar],
    ) -> Result<(u32, u32, u32, u32), CalendarError> {
        let mut created = 0u32;
        let mut updated = 0u32;
        let deleted = 0u32;
        let mut conflicts = 0u32;

        // Get calendars for this pair
        let source_cal = calendars.iter().find(|c| c.id == pair.source_calendar_id);
        let target_cal = calendars.iter().find(|c| c.id == pair.target_calendar_id);

        if source_cal.is_none() || target_cal.is_none() {
            return Err(CalendarError::NotFound("Sync pair calendar not found".to_string()));
        }

        // Find events in source that should be synced to target
        for (_fingerprint, events) in fingerprint_groups {
            let source_events: Vec<_> = events.iter()
                .filter(|e| e.calendar_id == pair.source_calendar_id)
                .collect();
            let target_events: Vec<_> = events.iter()
                .filter(|e| e.calendar_id == pair.target_calendar_id)
                .collect();

            match (source_events.first(), target_events.first()) {
                (Some(source), None) => {
                    // Event exists in source but not target -> create in target
                    if target_cal.map(|c| c.is_writable).unwrap_or(false) {
                        match self.create_event_in_calendar(
                            source,
                            &pair.target_calendar_id,
                            pair.target_provider,
                        ).await {
                            Ok(_) => created += 1,
                            Err(e) => {
                                tracing::warn!("Failed to create event in target: {}", e);
                            }
                        }
                    }
                }
                (None, Some(target)) if pair.bidirectional => {
                    // Event exists in target but not source (bidirectional) -> create in source
                    if source_cal.map(|c| c.is_writable).unwrap_or(false) {
                        match self.create_event_in_calendar(
                            target,
                            &pair.source_calendar_id,
                            pair.source_provider,
                        ).await {
                            Ok(_) => created += 1,
                            Err(e) => {
                                tracing::warn!("Failed to create event in source: {}", e);
                            }
                        }
                    }
                }
                (Some(source), Some(target)) => {
                    // Event exists in both -> check for updates
                    let (source_newer, target_newer) = self.compare_timestamps(source, target);

                    if source_newer || target_newer {
                        match self.resolve_conflict(source, target, &self.config.conflict_resolution).await {
                            Ok(true) => {
                                updated += 1;
                                conflicts += 1;
                            }
                            Ok(false) => {}
                            Err(e) => {
                                tracing::warn!("Failed to resolve conflict: {}", e);
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok((created, updated, deleted, conflicts))
    }

    /// Compare timestamps to determine which event is newer
    fn compare_timestamps(&self, a: &CalendarEvent, b: &CalendarEvent) -> (bool, bool) {
        match (a.updated_at, b.updated_at) {
            (Some(a_time), Some(b_time)) => (a_time > b_time, b_time > a_time),
            (Some(_), None) => (true, false),
            (None, Some(_)) => (false, true),
            (None, None) => (false, false),
        }
    }

    /// Create an event in a specific calendar
    async fn create_event_in_calendar(
        &self,
        source_event: &CalendarEvent,
        target_calendar_id: &str,
        target_provider: CalendarProvider,
    ) -> Result<CalendarEvent, CalendarError> {
        let request = CreateEventRequest {
            title: source_event.title.clone(),
            description: source_event.description.clone(),
            start: source_event.start,
            end: source_event.end,
            all_day: source_event.all_day,
            location: source_event.location.clone(),
            attendees: None, // Don't copy attendees
            recurrence_rule: source_event.recurrence_rule.clone(),
        };

        match target_provider {
            CalendarProvider::Google => {
                let api = GoogleCalendarApi::new()?;
                api.create_event(target_calendar_id, &request).await
            }
            CalendarProvider::CalDAV | CalendarProvider::ICloud => {
                let account = CalendarStorage::get_caldav_account()?
                    .ok_or_else(|| CalendarError::NotConnected)?;
                let client = CalDAVClient::new(account)?;
                client.create_event(target_calendar_id, &request).await
            }
            CalendarProvider::ICal => {
                Err(CalendarError::InvalidRequest("Cannot create events in iCal subscriptions".to_string()))
            }
        }
    }

    /// Resolve a conflict between two versions of an event
    async fn resolve_conflict(
        &self,
        source: &CalendarEvent,
        target: &CalendarEvent,
        resolution: &ConflictResolution,
    ) -> Result<bool, CalendarError> {
        let (source_newer, _target_newer) = self.compare_timestamps(source, target);

        let winner = match resolution {
            ConflictResolution::LastModifiedWins => {
                if source_newer { source } else { target }
            }
            ConflictResolution::PreferGoogle => {
                if source.provider == CalendarProvider::Google { source } else { target }
            }
            ConflictResolution::PreferCalDAV => {
                if source.provider == CalendarProvider::CalDAV { source } else { target }
            }
            ConflictResolution::PrimaryWins => source, // Source is considered primary
            ConflictResolution::Manual => {
                // Don't auto-resolve, mark as conflict
                return Ok(false);
            }
        };

        let loser = if std::ptr::eq(winner, source) { target } else { source };

        // Update the loser with winner's data
        let updates = UpdateEventRequest {
            title: Some(winner.title.clone()),
            description: winner.description.clone(),
            start: Some(winner.start),
            end: Some(winner.end),
            all_day: Some(winner.all_day),
            location: winner.location.clone(),
            attendees: None,
            recurrence_rule: winner.recurrence_rule.clone(),
            status: Some(winner.status.clone()),
        };

        match loser.provider {
            CalendarProvider::Google => {
                let api = GoogleCalendarApi::new()?;
                api.update_event(&loser.calendar_id, &loser.id, &updates).await?;
            }
            CalendarProvider::CalDAV | CalendarProvider::ICloud => {
                let account = CalendarStorage::get_caldav_account()?
                    .ok_or_else(|| CalendarError::NotConnected)?;
                let client = CalDAVClient::new(account)?;
                client.update_event(&loser.calendar_id, &loser.id, &updates, loser.etag.as_deref()).await?;
            }
            CalendarProvider::ICal => {
                // Can't update iCal events
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Performs an incremental sync (only changes since last sync)
    #[allow(dead_code)]
    pub async fn incremental_sync(&self) -> Result<FullSyncResult, CalendarError> {
        // For now, just do a full sync
        // TODO: Implement proper incremental sync using sync tokens
        self.full_sync().await
    }
}

impl Default for SyncEngine {
    fn default() -> Self {
        Self {
            config: SyncConfig::default(),
        }
    }
}
