use std::sync::Mutex;
use tauri::{State, AppHandle, Emitter};
use chrono::{DateTime, Utc};
use crate::calendar::models::{
    Calendar, CalendarEvent, CalendarAccount, CalendarProvider,
    CreateEventRequest, UpdateEventRequest, SyncStatus, SyncResult, ICalSubscription, CalDAVAccount,
};
use crate::calendar::storage::CalendarStorage;
use crate::calendar::google::{GoogleCalendarAuth, GoogleCalendarApi, PKCEData};
use crate::calendar::ical;
use crate::calendar::caldav;

/// Shared state for calendar authentication
pub struct CalendarAuthState {
    pub pkce_data: Option<PKCEData>,
}

impl Default for CalendarAuthState {
    fn default() -> Self {
        Self {
            pkce_data: None,
        }
    }
}

pub type SharedCalendarAuthState = Mutex<CalendarAuthState>;

// File-based PKCE storage for persistence across restarts
fn get_pkce_file_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".lokus").join("temp").join("calendar_pkce.json"))
}

fn save_pkce_to_file(pkce: &PKCEData) -> Result<(), String> {
    let path = get_pkce_file_path().ok_or("Could not get home directory")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::json!({
        "code_verifier": pkce.code_verifier,
        "code_challenge": pkce.code_challenge,
        "state": pkce.state
    });
    std::fs::write(&path, serde_json::to_string(&json).unwrap()).map_err(|e| e.to_string())
}

fn load_pkce_from_file() -> Option<PKCEData> {
    let path = get_pkce_file_path()?;
    let content = std::fs::read_to_string(&path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    Some(PKCEData {
        code_verifier: json["code_verifier"].as_str()?.to_string(),
        code_challenge: json["code_challenge"].as_str()?.to_string(),
        state: json["state"].as_str()?.to_string(),
    })
}

fn delete_pkce_file() {
    if let Some(path) = get_pkce_file_path() {
        let _ = std::fs::remove_file(path);
    }
}

// ============== Authentication Commands ==============

/// Start Google Calendar OAuth flow
#[tauri::command]
pub async fn google_calendar_auth_start(
    calendar_state: State<'_, SharedCalendarAuthState>,
) -> Result<String, String> {
    let auth = GoogleCalendarAuth::new()
        .map_err(|e| e.to_string())?;

    let (code_verifier, code_challenge) = GoogleCalendarAuth::generate_pkce_pair();
    let state = GoogleCalendarAuth::generate_state();

    let pkce_data = PKCEData {
        code_verifier,
        code_challenge,
        state,
    };

    let auth_url = auth.generate_auth_url(&pkce_data)
        .map_err(|e| e.to_string())?;

    // Store PKCE data for callback verification (both in memory and file for persistence)
    save_pkce_to_file(&pkce_data).map_err(|e| format!("Failed to save PKCE: {}", e))?;
    {
        let mut calendar_state_guard = calendar_state.lock().unwrap();
        calendar_state_guard.pkce_data = Some(pkce_data);
    }

    Ok(auth_url)
}

/// Complete Google Calendar OAuth flow with callback data
#[tauri::command]
pub async fn google_calendar_auth_complete(
    code: String,
    state: String,
    calendar_state: State<'_, SharedCalendarAuthState>,
    app_handle: AppHandle,
) -> Result<CalendarAccount, String> {
    let pkce_data = {
        let calendar_state_guard = calendar_state.lock().unwrap();
        calendar_state_guard.pkce_data.clone()
    };

    let pkce_data = pkce_data
        .ok_or_else(|| "No pending authentication".to_string())?;

    // Verify state parameter
    if state != pkce_data.state {
        return Err("Invalid state parameter".to_string());
    }

    let auth = GoogleCalendarAuth::new()
        .map_err(|e| e.to_string())?;

    // Exchange code for token
    let token = auth.exchange_code_for_token(&code, &pkce_data.code_verifier)
        .await
        .map_err(|e| e.to_string())?;

    // Fetch and store account info
    let account = auth.fetch_and_store_account(&token)
        .await
        .map_err(|e| e.to_string())?;

    // Clear PKCE data (both memory and file)
    delete_pkce_file();
    {
        let mut calendar_state_guard = calendar_state.lock().unwrap();
        calendar_state_guard.pkce_data = None;
    }

    // Emit success event
    let _ = app_handle.emit("calendar-auth-success", serde_json::json!({
        "provider": "google",
        "email": account.email
    }));

    Ok(account)
}

/// Check for OAuth callback and complete auth if available
#[tauri::command]
pub async fn google_calendar_check_auth_callback(
    calendar_state: State<'_, SharedCalendarAuthState>,
    app_handle: AppHandle,
) -> Result<Option<CalendarAccount>, String> {
    // Check if there's a pending auth (try memory first, then file)
    let pkce_data = {
        let calendar_state_guard = calendar_state.lock().unwrap();
        calendar_state_guard.pkce_data.clone()
    }.or_else(|| load_pkce_from_file());

    if pkce_data.is_none() {
        return Ok(None);
    }

    // Check for callback file
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;
    let callback_file = home_dir.join(".lokus").join("temp").join("calendar_auth_callback.json");

    if !callback_file.exists() {
        return Ok(None);
    }

    // Read callback data
    let callback_content = std::fs::read_to_string(&callback_file)
        .map_err(|e| format!("Failed to read callback file: {}", e))?;

    let callback_data: serde_json::Value = serde_json::from_str(&callback_content)
        .map_err(|e| format!("Failed to parse callback data: {}", e))?;

    let code = callback_data["code"]
        .as_str()
        .ok_or_else(|| "Missing code in callback".to_string())?;
    let state = callback_data["state"]
        .as_str()
        .ok_or_else(|| "Missing state in callback".to_string())?;

    // Delete callback file
    let _ = std::fs::remove_file(&callback_file);

    let pkce_data = pkce_data.unwrap();

    // Verify state parameter
    if state != pkce_data.state {
        return Err("Invalid state parameter".to_string());
    }

    let auth = GoogleCalendarAuth::new()
        .map_err(|e| e.to_string())?;

    // Exchange code for token
    let token = auth.exchange_code_for_token(code, &pkce_data.code_verifier)
        .await
        .map_err(|e| e.to_string())?;

    // Fetch and store account info
    let account = auth.fetch_and_store_account(&token)
        .await
        .map_err(|e| e.to_string())?;

    // Clear PKCE data (both memory and file)
    delete_pkce_file();
    {
        let mut calendar_state_guard = calendar_state.lock().unwrap();
        calendar_state_guard.pkce_data = None;
    }

    // Emit success event
    let _ = app_handle.emit("calendar-auth-success", serde_json::json!({
        "provider": "google",
        "email": account.email.clone()
    }));

    Ok(Some(account))
}

/// Check if Google Calendar is authenticated
#[tauri::command]
pub fn google_calendar_auth_status() -> Result<bool, String> {
    let auth = GoogleCalendarAuth::new()
        .map_err(|e| e.to_string())?;

    auth.is_authenticated()
        .map_err(|e| e.to_string())
}

/// Get the connected Google Calendar account
#[tauri::command]
pub fn google_calendar_get_account() -> Result<Option<CalendarAccount>, String> {
    CalendarStorage::get_google_account()
        .map_err(|e| e.to_string())
}

/// Disconnect calendar provider (Google or CalDAV)
#[tauri::command]
pub async fn calendar_disconnect(provider: String, app_handle: AppHandle) -> Result<(), String> {
    println!("[Calendar] Disconnecting provider: {}", provider);

    match provider.as_str() {
        "google" => {
            // IMPORTANT: Get the token BEFORE deleting storage, so we can revoke it
            let token_to_revoke = CalendarStorage::get_google_token()
                .ok()
                .flatten()
                .map(|t| t.access_token.clone());

            // Clear Google storage FIRST to prevent race conditions with token refresh
            // This ensures no background task can refresh/restore the token
            let _ = CalendarStorage::delete_google_token();
            let _ = CalendarStorage::delete_google_account();

            // Remove Google calendars from storage (keep CalDAV ones)
            let mut calendars = CalendarStorage::get_calendars().unwrap_or_default();
            calendars.retain(|c| c.provider != CalendarProvider::Google);
            let _ = CalendarStorage::store_calendars(&calendars);

            // Try to revoke the token with Google (optional, can fail without issue)
            // This is done AFTER local storage is cleared to prevent race conditions
            if let Some(access_token) = token_to_revoke {
                if let Ok(auth) = GoogleCalendarAuth::new() {
                    // Ignore revocation errors - local cleanup is already done
                    let _ = auth.revoke_token_only(&access_token).await;
                }
            }

            // Emit disconnect event
            let _ = app_handle.emit("calendar-disconnected", serde_json::json!({
                "provider": "google"
            }));

            Ok(())
        }
        "caldav" => {
            // Remove CalDAV calendars from storage (keep Google ones)
            let mut calendars = CalendarStorage::get_calendars().unwrap_or_default();
            calendars.retain(|c| c.provider != CalendarProvider::CalDAV);
            let _ = CalendarStorage::store_calendars(&calendars);

            // Delete CalDAV account credentials
            CalendarStorage::delete_caldav_account()
                .map_err(|e| e.to_string())?;

            // Emit disconnect event
            let _ = app_handle.emit("calendar-disconnected", serde_json::json!({
                "provider": "caldav"
            }));

            println!("[Calendar] CalDAV disconnected successfully");
            Ok(())
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

// ============== Calendar Commands ==============

/// Get all calendars from connected accounts (Google + CalDAV)
#[tauri::command]
pub async fn get_calendars() -> Result<Vec<Calendar>, String> {
    let mut all_calendars = Vec::new();

    // Check if Google Calendar is connected
    let auth = GoogleCalendarAuth::new()
        .map_err(|e| e.to_string())?;

    if auth.is_authenticated().unwrap_or(false) {
        if let Ok(api) = GoogleCalendarApi::new() {
            if let Ok(google_calendars) = api.list_calendars().await {
                println!("[Calendar] Fetched {} Google calendars", google_calendars.len());
                all_calendars.extend(google_calendars);
            }
        }
    }

    // Check if CalDAV is connected
    if let Ok(Some(account)) = CalendarStorage::get_caldav_account() {
        if account.is_connected {
            if let Ok(client) = caldav::CalDAVClient::new(account) {
                if let Ok(caldav_calendars) = client.list_calendars().await {
                    println!("[Calendar] Fetched {} CalDAV calendars", caldav_calendars.len());
                    all_calendars.extend(caldav_calendars);
                }
            }
        }
    }

    println!("[Calendar] Total calendars: {}", all_calendars.len());

    // Store calendars locally
    if !all_calendars.is_empty() {
        let _ = CalendarStorage::store_calendars(&all_calendars);
    }

    Ok(all_calendars)
}

/// Get cached calendars (doesn't make API call)
#[tauri::command]
pub fn get_cached_calendars() -> Result<Vec<Calendar>, String> {
    CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())
}

// ============== Event Commands ==============

/// Get events from a calendar within a time range
#[tauri::command]
pub async fn get_events(
    calendar_id: String,
    start: String,
    end: String,
    max_results: Option<u32>,
) -> Result<Vec<CalendarEvent>, String> {
    let start_time: DateTime<Utc> = start.parse()
        .map_err(|e| format!("Invalid start time: {}", e))?;
    let end_time: DateTime<Utc> = end.parse()
        .map_err(|e| format!("Invalid end time: {}", e))?;

    // Look up calendar to determine provider
    let calendars = CalendarStorage::get_calendars().map_err(|e| e.to_string())?;
    let calendar = calendars.iter()
        .find(|c| c.id == calendar_id)
        .ok_or_else(|| "Calendar not found".to_string())?;

    match calendar.provider {
        CalendarProvider::Google => {
            let api = GoogleCalendarApi::new()
                .map_err(|e| e.to_string())?;
            api.get_events(&calendar_id, start_time, end_time, max_results)
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::CalDAV => {
            let account = CalendarStorage::get_caldav_account()
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "CalDAV not connected".to_string())?;
            let client = caldav::CalDAVClient::new(account)
                .map_err(|e| e.to_string())?;
            client.get_events(&calendar_id, start_time, end_time)
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::ICal => {
            // iCal events are stored locally, filter by time range
            let events = CalendarStorage::get_ical_events(&calendar_id)
                .map_err(|e| e.to_string())?;
            Ok(events.into_iter()
                .filter(|e| e.start <= end_time && e.end >= start_time)
                .collect())
        }
        CalendarProvider::ICloud => {
            // ICloud uses CalDAV protocol
            let account = CalendarStorage::get_caldav_account()
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "iCloud not connected".to_string())?;
            let client = caldav::CalDAVClient::new(account)
                .map_err(|e| e.to_string())?;
            client.get_events(&calendar_id, start_time, end_time)
                .await
                .map_err(|e| e.to_string())
        }
    }
}

/// Get events from all visible calendars (Google + iCal)
#[tauri::command]
pub async fn get_all_events(
    start: String,
    end: String,
) -> Result<Vec<CalendarEvent>, String> {
    println!("[Calendar] get_all_events called: {} to {}", start, end);

    let start_time: DateTime<Utc> = start.parse()
        .map_err(|e| format!("Invalid start time: {}", e))?;
    let end_time: DateTime<Utc> = end.parse()
        .map_err(|e| format!("Invalid end time: {}", e))?;

    let calendars = CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())?;

    println!("[Calendar] Found {} calendars, {} visible",
        calendars.len(),
        calendars.iter().filter(|c| c.visible).count());

    let mut all_events = Vec::new();

    // Fetch Google Calendar events
    let google_calendars: Vec<_> = calendars.iter()
        .filter(|c| c.visible && c.provider == CalendarProvider::Google)
        .collect();

    if !google_calendars.is_empty() {
        if let Ok(api) = GoogleCalendarApi::new() {
            for calendar in google_calendars {
                println!("[Calendar] Fetching events from Google calendar: {} ({})", calendar.name, calendar.id);
                match api.get_events(&calendar.id, start_time, end_time, None).await {
                    Ok(events) => {
                        println!("[Calendar] Got {} events from {}", events.len(), calendar.name);
                        all_events.extend(events);
                    },
                    Err(e) => {
                        println!("[Calendar] ERROR fetching from {}: {}", calendar.name, e);
                    }
                }
            }
        }
    }

    // Fetch iCal events from visible iCal calendars
    let ical_calendars: Vec<_> = calendars.iter()
        .filter(|c| c.visible && c.provider == CalendarProvider::ICal)
        .collect();

    for calendar in ical_calendars {
        println!("[Calendar] Fetching events from iCal calendar: {} ({})", calendar.name, calendar.id);
        match CalendarStorage::get_ical_events(&calendar.id) {
            Ok(events) => {
                // Filter events within the requested time range
                let filtered: Vec<_> = events.into_iter()
                    .filter(|e| e.start <= end_time && e.end >= start_time)
                    .collect();
                println!("[Calendar] Got {} events from {}", filtered.len(), calendar.name);
                all_events.extend(filtered);
            },
            Err(e) => {
                println!("[Calendar] ERROR fetching from {}: {}", calendar.name, e);
            }
        }
    }

    // Fetch CalDAV events from visible CalDAV calendars
    let caldav_calendars: Vec<_> = calendars.iter()
        .filter(|c| c.visible && c.provider == CalendarProvider::CalDAV)
        .collect();

    if !caldav_calendars.is_empty() {
        if let Ok(Some(account)) = CalendarStorage::get_caldav_account() {
            if let Ok(client) = caldav::CalDAVClient::new(account) {
                for calendar in caldav_calendars {
                    println!("[Calendar] Fetching events from CalDAV calendar: {} ({})", calendar.name, calendar.id);
                    match client.get_events(&calendar.id, start_time, end_time).await {
                        Ok(events) => {
                            println!("[Calendar] Got {} events from {}", events.len(), calendar.name);
                            all_events.extend(events);
                        },
                        Err(e) => {
                            println!("[Calendar] ERROR fetching from {}: {}", calendar.name, e);
                        }
                    }
                }
            }
        }
    }

    // Sort by start time
    all_events.sort_by(|a, b| a.start.cmp(&b.start));

    println!("[Calendar] Total events: {}", all_events.len());
    Ok(all_events)
}

/// Create a new event
#[tauri::command]
pub async fn create_event(
    calendar_id: String,
    event: CreateEventRequest,
) -> Result<CalendarEvent, String> {
    // Look up calendar to determine provider
    let calendars = CalendarStorage::get_calendars().map_err(|e| e.to_string())?;
    let calendar = calendars.iter()
        .find(|c| c.id == calendar_id)
        .ok_or_else(|| "Calendar not found".to_string())?;

    match calendar.provider {
        CalendarProvider::Google => {
            let api = GoogleCalendarApi::new()
                .map_err(|e| e.to_string())?;
            api.create_event(&calendar_id, &event)
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::CalDAV | CalendarProvider::ICloud => {
            let account = CalendarStorage::get_caldav_account()
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "CalDAV not connected".to_string())?;
            let client = caldav::CalDAVClient::new(account)
                .map_err(|e| e.to_string())?;
            client.create_event(&calendar_id, &event)
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::ICal => {
            Err("iCal subscriptions are read-only".to_string())
        }
    }
}

/// Update an existing event
#[tauri::command]
pub async fn update_event(
    calendar_id: String,
    event_id: String,
    updates: UpdateEventRequest,
    etag: Option<String>,
) -> Result<CalendarEvent, String> {
    // Look up calendar to determine provider
    let calendars = CalendarStorage::get_calendars().map_err(|e| e.to_string())?;
    let calendar = calendars.iter()
        .find(|c| c.id == calendar_id)
        .ok_or_else(|| "Calendar not found".to_string())?;

    match calendar.provider {
        CalendarProvider::Google => {
            let api = GoogleCalendarApi::new()
                .map_err(|e| e.to_string())?;
            api.update_event(&calendar_id, &event_id, &updates)
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::CalDAV | CalendarProvider::ICloud => {
            let account = CalendarStorage::get_caldav_account()
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "CalDAV not connected".to_string())?;
            let client = caldav::CalDAVClient::new(account)
                .map_err(|e| e.to_string())?;
            client.update_event(&calendar_id, &event_id, &updates, etag.as_deref())
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::ICal => {
            Err("iCal subscriptions are read-only".to_string())
        }
    }
}

/// Delete an event
#[tauri::command]
pub async fn delete_event(
    calendar_id: String,
    event_id: String,
    etag: Option<String>,
) -> Result<(), String> {
    // Look up calendar to determine provider
    let calendars = CalendarStorage::get_calendars().map_err(|e| e.to_string())?;
    let calendar = calendars.iter()
        .find(|c| c.id == calendar_id)
        .ok_or_else(|| "Calendar not found".to_string())?;

    match calendar.provider {
        CalendarProvider::Google => {
            let api = GoogleCalendarApi::new()
                .map_err(|e| e.to_string())?;
            api.delete_event(&calendar_id, &event_id)
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::CalDAV | CalendarProvider::ICloud => {
            let account = CalendarStorage::get_caldav_account()
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "CalDAV not connected".to_string())?;
            let client = caldav::CalDAVClient::new(account)
                .map_err(|e| e.to_string())?;
            client.delete_event(&calendar_id, &event_id, etag.as_deref())
                .await
                .map_err(|e| e.to_string())
        }
        CalendarProvider::ICal => {
            Err("iCal subscriptions are read-only".to_string())
        }
    }
}

// ============== Sync Commands ==============

/// Get sync status
#[tauri::command]
pub fn get_sync_status() -> Result<SyncStatus, String> {
    // For now, return a basic status
    Ok(SyncStatus::default())
}

/// Manually trigger a sync
#[tauri::command]
pub async fn sync_calendars(app_handle: AppHandle) -> Result<SyncResult, String> {
    let start = Utc::now();

    // Refresh calendars list
    let calendars = get_calendars().await?;

    let result = SyncResult {
        success: true,
        events_added: 0,
        events_updated: 0,
        events_deleted: 0,
        errors: Vec::new(),
        synced_at: Utc::now(),
    };

    // Emit sync complete event
    let _ = app_handle.emit("calendar-sync-complete", serde_json::json!({
        "success": true,
        "calendars_synced": calendars.len(),
        "duration_ms": (Utc::now() - start).num_milliseconds()
    }));

    Ok(result)
}

/// Update calendar visibility
#[tauri::command]
pub fn update_calendar_visibility(
    calendar_id: String,
    visible: bool,
) -> Result<(), String> {
    let mut calendars = CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())?;

    if let Some(calendar) = calendars.iter_mut().find(|c| c.id == calendar_id) {
        calendar.visible = visible;
        CalendarStorage::store_calendars(&calendars)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============== iCal Commands ==============

/// Add an iCal subscription from URL
#[tauri::command]
pub async fn ical_add_subscription(
    url: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<ICalSubscription, String> {
    // Fetch and validate the ICS content
    let content = ical::fetch_ics_from_url(&url)
        .await
        .map_err(|e| e.to_string())?;

    // Try to extract calendar name from content if not provided
    let calendar_name = name.or_else(|| ical::extract_calendar_name(&content))
        .unwrap_or_else(|| "iCal Calendar".to_string());

    // Create subscription
    let subscription = ical::create_subscription(&url, Some(calendar_name), color);

    // Parse events
    let events = ical::parse_ics_content(&content, &subscription.id)
        .map_err(|e| e.to_string())?;

    // Store subscription
    let mut subscriptions = CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())?;
    subscriptions.push(subscription.clone());
    CalendarStorage::store_ical_subscriptions(&subscriptions)
        .map_err(|e| e.to_string())?;

    // Store events
    CalendarStorage::store_ical_events(&subscription.id, &events)
        .map_err(|e| e.to_string())?;

    // Also add to calendars list for UI
    let calendar = Calendar {
        id: subscription.id.clone(),
        provider: CalendarProvider::ICal,
        name: subscription.name.clone(),
        description: Some(format!("iCal subscription: {}", url)),
        color: subscription.color.clone(),
        is_primary: false,
        is_writable: false, // iCal subscriptions are read-only
        sync_token: None,
        last_synced: Some(Utc::now()),
        visible: true,
    };

    let mut calendars = CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())?;
    calendars.push(calendar);
    CalendarStorage::store_calendars(&calendars)
        .map_err(|e| e.to_string())?;

    Ok(subscription)
}

/// Import iCal from local file
#[tauri::command]
pub fn ical_import_file(
    path: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<ICalSubscription, String> {
    let path = std::path::Path::new(&path);

    // Read file content
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Try to extract calendar name
    let calendar_name = name.or_else(|| ical::extract_calendar_name(&content))
        .or_else(|| path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| "Imported Calendar".to_string());

    // Create subscription (with file:// URL)
    let file_url = format!("file://{}", path.display());
    let subscription = ical::create_subscription(&file_url, Some(calendar_name), color);

    // Parse events
    let events = ical::parse_ics_content(&content, &subscription.id)
        .map_err(|e| e.to_string())?;

    // Store subscription
    let mut subscriptions = CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())?;
    subscriptions.push(subscription.clone());
    CalendarStorage::store_ical_subscriptions(&subscriptions)
        .map_err(|e| e.to_string())?;

    // Store events
    CalendarStorage::store_ical_events(&subscription.id, &events)
        .map_err(|e| e.to_string())?;

    // Add to calendars list
    let calendar = Calendar {
        id: subscription.id.clone(),
        provider: CalendarProvider::ICal,
        name: subscription.name.clone(),
        description: Some(format!("Imported from: {}", path.display())),
        color: subscription.color.clone(),
        is_primary: false,
        is_writable: false,
        sync_token: None,
        last_synced: Some(Utc::now()),
        visible: true,
    };

    let mut calendars = CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())?;
    calendars.push(calendar);
    CalendarStorage::store_calendars(&calendars)
        .map_err(|e| e.to_string())?;

    Ok(subscription)
}

/// Remove an iCal subscription
#[tauri::command]
pub fn ical_remove_subscription(subscription_id: String) -> Result<(), String> {
    // Remove from subscriptions
    let mut subscriptions = CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())?;
    subscriptions.retain(|s| s.id != subscription_id);
    CalendarStorage::store_ical_subscriptions(&subscriptions)
        .map_err(|e| e.to_string())?;

    // Remove cached events
    let _ = CalendarStorage::delete_ical_events(&subscription_id);

    // Remove from calendars list
    let mut calendars = CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())?;
    calendars.retain(|c| c.id != subscription_id);
    CalendarStorage::store_calendars(&calendars)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get all iCal subscriptions
#[tauri::command]
pub fn ical_get_subscriptions() -> Result<Vec<ICalSubscription>, String> {
    CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())
}

/// Sync a single iCal subscription
#[tauri::command]
pub async fn ical_sync_subscription(subscription_id: String) -> Result<ICalSubscription, String> {
    let mut subscriptions = CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())?;

    let subscription = subscriptions.iter_mut()
        .find(|s| s.id == subscription_id)
        .ok_or_else(|| "Subscription not found".to_string())?;

    // Skip file:// URLs (can't sync local files)
    if subscription.url.starts_with("file://") {
        return Ok(subscription.clone());
    }

    // Fetch fresh content
    let content = ical::fetch_ics_from_url(&subscription.url)
        .await
        .map_err(|e| e.to_string())?;

    // Parse events
    let events = ical::parse_ics_content(&content, &subscription.id)
        .map_err(|e| e.to_string())?;

    // Update stored events
    CalendarStorage::store_ical_events(&subscription.id, &events)
        .map_err(|e| e.to_string())?;

    // Update last synced time
    subscription.last_synced = Some(Utc::now());

    CalendarStorage::store_ical_subscriptions(&subscriptions)
        .map_err(|e| e.to_string())?;

    Ok(subscriptions.into_iter()
        .find(|s| s.id == subscription_id)
        .unwrap())
}

/// Sync all iCal subscriptions
#[tauri::command]
pub async fn ical_sync_all() -> Result<Vec<ICalSubscription>, String> {
    let subscriptions = CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())?;

    let mut updated = Vec::new();

    for sub in subscriptions {
        if sub.enabled && !sub.url.starts_with("file://") {
            match ical_sync_subscription(sub.id.clone()).await {
                Ok(s) => updated.push(s),
                Err(e) => {
                    tracing::warn!("Failed to sync iCal subscription {}: {}", sub.name, e);
                    updated.push(sub);
                }
            }
        } else {
            updated.push(sub);
        }
    }

    Ok(updated)
}

/// Update iCal subscription settings
#[tauri::command]
pub fn ical_update_subscription(
    subscription_id: String,
    name: Option<String>,
    color: Option<String>,
    enabled: Option<bool>,
    sync_interval_minutes: Option<u32>,
) -> Result<ICalSubscription, String> {
    let mut subscriptions = CalendarStorage::get_ical_subscriptions()
        .map_err(|e| e.to_string())?;

    let subscription = subscriptions.iter_mut()
        .find(|s| s.id == subscription_id)
        .ok_or_else(|| "Subscription not found".to_string())?;

    if let Some(n) = name {
        subscription.name = n.clone();
        // Also update in calendars list
        let mut calendars = CalendarStorage::get_calendars()
            .map_err(|e| e.to_string())?;
        if let Some(cal) = calendars.iter_mut().find(|c| c.id == subscription_id) {
            cal.name = n;
        }
        CalendarStorage::store_calendars(&calendars)
            .map_err(|e| e.to_string())?;
    }
    if let Some(c) = color {
        subscription.color = Some(c.clone());
        // Also update in calendars list
        let mut calendars = CalendarStorage::get_calendars()
            .map_err(|e| e.to_string())?;
        if let Some(cal) = calendars.iter_mut().find(|c| c.id == subscription_id) {
            cal.color = Some(c);
        }
        CalendarStorage::store_calendars(&calendars)
            .map_err(|e| e.to_string())?;
    }
    if let Some(e) = enabled {
        subscription.enabled = e;
    }
    if let Some(i) = sync_interval_minutes {
        subscription.sync_interval_minutes = i;
    }

    CalendarStorage::store_ical_subscriptions(&subscriptions)
        .map_err(|e| e.to_string())?;

    Ok(subscriptions.into_iter()
        .find(|s| s.id == subscription_id)
        .unwrap())
}

/// Get iCal events for a subscription
#[tauri::command]
pub fn ical_get_events(subscription_id: String) -> Result<Vec<CalendarEvent>, String> {
    CalendarStorage::get_ical_events(&subscription_id)
        .map_err(|e| e.to_string())
}

// ============== CalDAV Commands ==============

/// Connect to a CalDAV server (iCloud, Fastmail, etc.)
#[tauri::command]
pub async fn caldav_connect(
    server_url: String,
    username: String,
    password: String,
    app_handle: AppHandle,
) -> Result<CalDAVAccount, String> {
    // Test connection and discover endpoints
    let account = caldav::test_connection(&server_url, &username, &password)
        .await
        .map_err(|e| e.to_string())?;

    // Store account credentials securely
    CalendarStorage::store_caldav_account(&account)
        .map_err(|e| e.to_string())?;

    // Fetch and store calendars
    let client = caldav::CalDAVClient::new(account.clone())
        .map_err(|e| e.to_string())?;

    let calendars = client.list_calendars()
        .await
        .map_err(|e| e.to_string())?;

    // Add CalDAV calendars to the calendars list
    let mut all_calendars = CalendarStorage::get_calendars()
        .unwrap_or_default();

    // Remove any existing CalDAV calendars
    all_calendars.retain(|c| c.provider != CalendarProvider::CalDAV);

    // Add new CalDAV calendars
    all_calendars.extend(calendars);

    CalendarStorage::store_calendars(&all_calendars)
        .map_err(|e| e.to_string())?;

    // Emit success event
    let _ = app_handle.emit("caldav-connected", serde_json::json!({
        "username": account.username
    }));

    Ok(account)
}

/// Check if CalDAV is connected
#[tauri::command]
pub fn caldav_is_connected() -> Result<bool, String> {
    println!("[CalDAV] caldav_is_connected called");
    match CalendarStorage::get_caldav_account() {
        Ok(Some(account)) => {
            println!("[CalDAV] Account found, is_connected: {}", account.is_connected);
            Ok(account.is_connected)
        },
        Ok(None) => {
            println!("[CalDAV] No account found");
            Ok(false)
        },
        Err(e) => {
            println!("[CalDAV] Error getting account: {}", e);
            Err(e.to_string())
        },
    }
}

/// Get CalDAV account info
#[tauri::command]
pub fn caldav_get_account() -> Result<Option<CalDAVAccount>, String> {
    // Return account without password
    match CalendarStorage::get_caldav_account() {
        Ok(Some(mut account)) => {
            account.password = String::new(); // Don't expose password
            Ok(Some(account))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Disconnect CalDAV
#[tauri::command]
pub async fn caldav_disconnect(app_handle: AppHandle) -> Result<(), String> {
    // Remove CalDAV calendars from storage
    let mut calendars = CalendarStorage::get_calendars()
        .unwrap_or_default();
    calendars.retain(|c| c.provider != CalendarProvider::CalDAV);
    let _ = CalendarStorage::store_calendars(&calendars);

    // Delete account credentials
    CalendarStorage::delete_caldav_account()
        .map_err(|e| e.to_string())?;

    // Emit disconnect event
    let _ = app_handle.emit("caldav-disconnected", serde_json::json!({}));

    Ok(())
}

/// Refresh CalDAV calendars
#[tauri::command]
pub async fn caldav_refresh_calendars() -> Result<Vec<Calendar>, String> {
    println!("[Calendar] caldav_refresh_calendars called");

    let account = CalendarStorage::get_caldav_account()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "CalDAV not connected".to_string())?;

    println!("[Calendar] Got CalDAV account: {}", account.username);

    let client = caldav::CalDAVClient::new(account)
        .map_err(|e| e.to_string())?;

    let caldav_calendars = client.list_calendars()
        .await
        .map_err(|e| e.to_string())?;

    println!("[Calendar] Listed {} CalDAV calendars", caldav_calendars.len());

    // Update calendars storage
    let mut all_calendars = CalendarStorage::get_calendars()
        .unwrap_or_default();

    println!("[Calendar] Existing calendars: {}", all_calendars.len());

    // Remove existing CalDAV calendars
    all_calendars.retain(|c| c.provider != CalendarProvider::CalDAV);

    println!("[Calendar] After removing CalDAV: {} calendars", all_calendars.len());

    // Add new CalDAV calendars
    all_calendars.extend(caldav_calendars.clone());

    println!("[Calendar] After adding CalDAV: {} calendars", all_calendars.len());

    match CalendarStorage::store_calendars(&all_calendars) {
        Ok(_) => println!("[Calendar] Successfully stored {} calendars", all_calendars.len()),
        Err(e) => {
            println!("[Calendar] ERROR storing calendars: {}", e);
            return Err(e.to_string());
        }
    }

    Ok(caldav_calendars)
}

/// Get CalDAV events
#[tauri::command]
pub async fn caldav_get_events(
    calendar_url: String,
    start: String,
    end: String,
) -> Result<Vec<CalendarEvent>, String> {
    let start_time: DateTime<Utc> = start.parse()
        .map_err(|e| format!("Invalid start time: {}", e))?;
    let end_time: DateTime<Utc> = end.parse()
        .map_err(|e| format!("Invalid end time: {}", e))?;

    let account = CalendarStorage::get_caldav_account()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "CalDAV not connected".to_string())?;

    let client = caldav::CalDAVClient::new(account)
        .map_err(|e| e.to_string())?;

    client.get_events(&calendar_url, start_time, end_time)
        .await
        .map_err(|e| e.to_string())
}

/// Create CalDAV event
#[tauri::command]
pub async fn caldav_create_event(
    calendar_url: String,
    event: CreateEventRequest,
) -> Result<CalendarEvent, String> {
    let account = CalendarStorage::get_caldav_account()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "CalDAV not connected".to_string())?;

    let client = caldav::CalDAVClient::new(account)
        .map_err(|e| e.to_string())?;

    client.create_event(&calendar_url, &event)
        .await
        .map_err(|e| e.to_string())
}

/// Update CalDAV event
#[tauri::command]
pub async fn caldav_update_event(
    calendar_url: String,
    event_id: String,
    updates: UpdateEventRequest,
    etag: Option<String>,
) -> Result<CalendarEvent, String> {
    let account = CalendarStorage::get_caldav_account()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "CalDAV not connected".to_string())?;

    let client = caldav::CalDAVClient::new(account)
        .map_err(|e| e.to_string())?;

    client.update_event(&calendar_url, &event_id, &updates, etag.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Delete CalDAV event
#[tauri::command]
pub async fn caldav_delete_event(
    calendar_url: String,
    event_id: String,
    etag: Option<String>,
) -> Result<(), String> {
    let account = CalendarStorage::get_caldav_account()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "CalDAV not connected".to_string())?;

    let client = caldav::CalDAVClient::new(account)
        .map_err(|e| e.to_string())?;

    client.delete_event(&calendar_url, &event_id, etag.as_deref())
        .await
        .map_err(|e| e.to_string())
}

// ============== Sync Commands ==============

use crate::calendar::models::{
    DeduplicatedEvent, SyncConfig, FullSyncResult,
};
use crate::calendar::sync::{SyncStorage, SyncEngine, deduplicate_events};

/// Get all events from all providers, deduplicated
#[tauri::command]
pub async fn get_all_events_deduplicated(
    start: String,
    end: String,
) -> Result<Vec<DeduplicatedEvent>, String> {
    println!("[Calendar] get_all_events_deduplicated called: {} to {}", start, end);

    let start_time: DateTime<Utc> = start.parse()
        .map_err(|e| format!("Invalid start time: {}", e))?;
    let end_time: DateTime<Utc> = end.parse()
        .map_err(|e| format!("Invalid end time: {}", e))?;

    // Check if deduplication is enabled
    let config = SyncStorage::get_sync_config().unwrap_or_default();
    if !config.deduplication_enabled {
        // Return regular events wrapped as DeduplicatedEvent
        let events = get_all_events(start, end).await?;
        let calendars = CalendarStorage::get_calendars().map_err(|e| e.to_string())?;
        let calendar_map: std::collections::HashMap<String, &Calendar> = calendars.iter()
            .map(|c| (c.id.clone(), c))
            .collect();

        let deduplicated: Vec<DeduplicatedEvent> = events.into_iter()
            .map(|event| {
                let is_read_only = calendar_map.get(&event.calendar_id)
                    .map(|c| !c.is_writable)
                    .unwrap_or(true);
                let fingerprint = crate::calendar::sync::compute_fingerprint(&event);
                DeduplicatedEvent {
                    event,
                    also_in: Vec::new(),
                    is_read_only,
                    fingerprint,
                }
            })
            .collect();

        return Ok(deduplicated);
    }

    let calendars = CalendarStorage::get_calendars()
        .map_err(|e| e.to_string())?;

    println!("[Calendar] Found {} calendars, {} visible",
        calendars.len(),
        calendars.iter().filter(|c| c.visible).count());

    let mut all_events = Vec::new();

    // Fetch Google Calendar events
    let google_calendars: Vec<_> = calendars.iter()
        .filter(|c| c.visible && c.provider == CalendarProvider::Google)
        .collect();

    if !google_calendars.is_empty() {
        if let Ok(api) = GoogleCalendarApi::new() {
            for calendar in google_calendars {
                println!("[Calendar] Fetching events from Google calendar: {} ({})", calendar.name, calendar.id);
                match api.get_events(&calendar.id, start_time, end_time, None).await {
                    Ok(events) => {
                        println!("[Calendar] Got {} events from {}", events.len(), calendar.name);
                        all_events.extend(events);
                    },
                    Err(e) => {
                        println!("[Calendar] ERROR fetching from {}: {}", calendar.name, e);
                    }
                }
            }
        }
    }

    // Fetch iCal events from visible iCal calendars
    let ical_calendars: Vec<_> = calendars.iter()
        .filter(|c| c.visible && c.provider == CalendarProvider::ICal)
        .collect();

    for calendar in ical_calendars {
        println!("[Calendar] Fetching events from iCal calendar: {} ({})", calendar.name, calendar.id);
        match CalendarStorage::get_ical_events(&calendar.id) {
            Ok(events) => {
                // Filter events within the requested time range
                let filtered: Vec<_> = events.into_iter()
                    .filter(|e| e.start <= end_time && e.end >= start_time)
                    .collect();
                println!("[Calendar] Got {} events from {}", filtered.len(), calendar.name);
                all_events.extend(filtered);
            },
            Err(e) => {
                println!("[Calendar] ERROR fetching from {}: {}", calendar.name, e);
            }
        }
    }

    // Fetch CalDAV events from visible CalDAV calendars
    let caldav_calendars: Vec<_> = calendars.iter()
        .filter(|c| c.visible && c.provider == CalendarProvider::CalDAV)
        .collect();

    if !caldav_calendars.is_empty() {
        if let Ok(Some(account)) = CalendarStorage::get_caldav_account() {
            if let Ok(client) = caldav::CalDAVClient::new(account) {
                for calendar in caldav_calendars {
                    println!("[Calendar] Fetching events from CalDAV calendar: {} ({})", calendar.name, calendar.id);
                    match client.get_events(&calendar.id, start_time, end_time).await {
                        Ok(events) => {
                            println!("[Calendar] Got {} events from {}", events.len(), calendar.name);
                            all_events.extend(events);
                        },
                        Err(e) => {
                            println!("[Calendar] ERROR fetching from {}: {}", calendar.name, e);
                        }
                    }
                }
            }
        }
    }

    // Deduplicate events
    let deduplicated = deduplicate_events(all_events, &calendars);

    println!("[Calendar] Total deduplicated events: {}", deduplicated.len());
    Ok(deduplicated)
}

/// Perform a full sync across all configured calendar pairs
#[tauri::command]
pub async fn sync_calendars_full(app_handle: AppHandle) -> Result<FullSyncResult, String> {
    println!("[Calendar] sync_calendars_full called");

    let engine = SyncEngine::new()
        .map_err(|e| e.to_string())?;

    let result = engine.full_sync()
        .await
        .map_err(|e| e.to_string())?;

    // Emit sync complete event
    let _ = app_handle.emit("calendar-sync-complete", serde_json::json!({
        "success": result.success,
        "events_created": result.events_created,
        "events_updated": result.events_updated,
        "events_deleted": result.events_deleted,
        "duplicates_found": result.duplicates_found,
        "conflicts_resolved": result.conflicts_resolved,
        "errors": result.errors
    }));

    Ok(result)
}

/// Get sync configuration
#[tauri::command]
pub fn get_sync_config() -> Result<SyncConfig, String> {
    SyncStorage::get_sync_config()
        .map_err(|e| e.to_string())
}

/// Set sync configuration
#[tauri::command]
pub fn set_sync_config(config: SyncConfig) -> Result<(), String> {
    SyncStorage::store_sync_config(&config)
        .map_err(|e| e.to_string())
}

/// Get sync state
#[tauri::command]
pub fn get_sync_state() -> Result<crate::calendar::models::SyncState, String> {
    SyncStorage::get_sync_state()
        .map_err(|e| e.to_string())
}
