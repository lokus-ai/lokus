use std::sync::Mutex;
use tauri::{State, AppHandle, Emitter};
use chrono::{DateTime, Utc};
use crate::calendar::models::{
    Calendar, CalendarEvent, CalendarAccount,
    CreateEventRequest, UpdateEventRequest, SyncStatus, SyncResult,
};
use crate::calendar::storage::CalendarStorage;
use crate::calendar::google::{GoogleCalendarAuth, GoogleCalendarApi, PKCEData};

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

/// Disconnect Google Calendar
#[tauri::command]
pub async fn calendar_disconnect(provider: String, app_handle: AppHandle) -> Result<(), String> {
    match provider.as_str() {
        "google" => {
            let auth = GoogleCalendarAuth::new()
                .map_err(|e| e.to_string())?;

            if let Ok(Some(token)) = CalendarStorage::get_google_token() {
                let _ = auth.revoke_token(&token.access_token).await;
            }

            // Clear storage
            let _ = CalendarStorage::delete_google_token();
            let _ = CalendarStorage::delete_google_account();
            let _ = CalendarStorage::delete_calendars();

            // Emit disconnect event
            let _ = app_handle.emit("calendar-disconnected", serde_json::json!({
                "provider": "google"
            }));

            Ok(())
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

// ============== Calendar Commands ==============

/// Get all calendars from connected accounts
#[tauri::command]
pub async fn get_calendars() -> Result<Vec<Calendar>, String> {
    // Check if Google Calendar is connected
    let auth = GoogleCalendarAuth::new()
        .map_err(|e| e.to_string())?;

    if !auth.is_authenticated().unwrap_or(false) {
        return Ok(Vec::new());
    }

    let api = GoogleCalendarApi::new()
        .map_err(|e| e.to_string())?;

    let calendars = api.list_calendars()
        .await
        .map_err(|e| e.to_string())?;

    // Store calendars locally
    let _ = CalendarStorage::store_calendars(&calendars);

    Ok(calendars)
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

    let api = GoogleCalendarApi::new()
        .map_err(|e| e.to_string())?;

    api.get_events(&calendar_id, start_time, end_time, max_results)
        .await
        .map_err(|e| e.to_string())
}

/// Get events from all visible calendars
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

    let api = GoogleCalendarApi::new()
        .map_err(|e| {
            println!("[Calendar] Failed to create API: {}", e);
            e.to_string()
        })?;

    let mut all_events = Vec::new();

    for calendar in calendars.iter().filter(|c| c.visible) {
        println!("[Calendar] Fetching events from calendar: {} ({})", calendar.name, calendar.id);
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
    let api = GoogleCalendarApi::new()
        .map_err(|e| e.to_string())?;

    api.create_event(&calendar_id, &event)
        .await
        .map_err(|e| e.to_string())
}

/// Update an existing event
#[tauri::command]
pub async fn update_event(
    calendar_id: String,
    event_id: String,
    updates: UpdateEventRequest,
) -> Result<CalendarEvent, String> {
    let api = GoogleCalendarApi::new()
        .map_err(|e| e.to_string())?;

    api.update_event(&calendar_id, &event_id, &updates)
        .await
        .map_err(|e| e.to_string())
}

/// Delete an event
#[tauri::command]
pub async fn delete_event(
    calendar_id: String,
    event_id: String,
) -> Result<(), String> {
    let api = GoogleCalendarApi::new()
        .map_err(|e| e.to_string())?;

    api.delete_event(&calendar_id, &event_id)
        .await
        .map_err(|e| e.to_string())
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
