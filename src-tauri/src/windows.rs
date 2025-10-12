use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Emitter};
use std::path::Path;

fn base_label_from_path(path: &str) -> String {
  // Use Path for cross-platform path handling
  let path_obj = Path::new(path);
  let last = path_obj.file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("workspace");
  
  let mut s = String::from("ws-");
  for ch in last.chars() {
    if ch.is_ascii_alphanumeric() { s.push(ch.to_ascii_lowercase()); } else { s.push('-'); }
  }
  while s.ends_with('-') { s.pop(); }
  if s.len() < 3 { s.push_str("workspace"); }
  s
}

fn focus(win: &WebviewWindow) {
  let _ = win.set_focus();
}

#[tauri::command]
pub fn open_workspace_window(app: AppHandle, workspace_path: String) -> Result<(), String> {
  println!("[Backend] open_workspace_window called with path: {}", workspace_path);

  // VSCode-style behavior: REPLACE current window instead of creating new ones
  // This prevents duplicate workspaces and follows industry standard UX

  // First, check if this workspace is already open in another window
  let label = base_label_from_path(&workspace_path);
  if let Some(existing_win) = app.get_webview_window(&label) {
    println!("[Backend] Workspace already open in another window, focusing it");
    focus(&existing_win);
    // Re-activate just in case the workspace needs to refresh
    let _ = existing_win.emit("workspace:activate", workspace_path.clone());

    // Update API server with the workspace
    let workspace_for_api = workspace_path.clone();
    let app_handle_for_api = app.clone();
    tauri::async_runtime::spawn(async move {
      crate::api_server::update_workspace(&app_handle_for_api, Some(workspace_for_api)).await;
    });

    return Ok(());
  }

  // Find the current window (could be launcher or any window)
  // Try common window labels in order of likelihood
  let current_window = app.get_webview_window("main")
    .or_else(|| {
      // Try to find launcher windows (they have format "launcher-{timestamp}")
      app.webview_windows().into_iter()
        .find(|(label, _)| label.starts_with("launcher-"))
        .map(|(_, win)| win)
    });

  if let Some(win) = current_window {
    println!("[Backend] Found current window, replacing with workspace (VSCode-style)");
    // Show window first (in case it was hidden)
    let _ = win.show();
    // Navigate to workspace by emitting activation event
    let _ = win.emit("workspace:activate", workspace_path.clone());
    // Bring window to focus
    focus(&win);

    // Update API server with the workspace
    let workspace_for_api = workspace_path.clone();
    let app_handle_for_api = app.clone();
    tauri::async_runtime::spawn(async move {
      crate::api_server::update_workspace(&app_handle_for_api, Some(workspace_for_api)).await;
    });

    return Ok(());
  }

  // Fallback: If no existing window found, create a new one
  // This only happens on app startup or if all windows were closed
  println!("[Backend] No existing window found, creating new workspace window");
  let encoded_path = urlencoding::encode(&workspace_path);
  let url_string = format!("/index.html?workspacePath={}", encoded_path);
  println!("[Backend] Creating new window with URL: {}", url_string);
  let url = WebviewUrl::App(url_string.into());

  // Use Path for cross-platform window title
  let workspace_name = Path::new(&workspace_path)
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("Workspace");

  let win = WebviewWindowBuilder::new(&app, &label, url)
    .title(format!("Lokus — {}", workspace_name))
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;

  // Emit workspace:activate as backup method
  println!("[Backend] Emitting workspace:activate event to new window");
  let _ = win.emit("workspace:activate", workspace_path.clone());

  // Update API server with the new workspace
  let workspace_for_api = workspace_path.clone();
  let app_handle_for_api = app.clone();
  tauri::async_runtime::spawn(async move {
    crate::api_server::update_workspace(&app_handle_for_api, Some(workspace_for_api)).await;
  });

  println!("[Backend] Window created successfully");

  Ok(())
}

#[tauri::command]
pub fn open_preferences_window(app: AppHandle) -> Result<(), String> {
  let label = "prefs";
  if let Some(win) = app.get_webview_window(label) {
    focus(&win);
    return Ok(());
  }
  // Pass a query param so the frontend can render the Preferences view immediately
  let url = WebviewUrl::App("index.html?view=prefs".into());
  let _win = WebviewWindowBuilder::new(&app, label, url)
    .title("Preferences")
    .inner_size(760.0, 560.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn open_launcher_window(app: AppHandle) -> Result<(), String> {
  // Generate unique label with timestamp
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_millis();
  let label = format!("launcher-{}", timestamp);

  // Pass forceWelcome parameter so the frontend shows welcome screen
  let url = WebviewUrl::App("index.html?forceWelcome=true".into());
  let _win = WebviewWindowBuilder::new(&app, &label, url)
    .title("Lokus")
    .inner_size(900.0, 700.0)
    .min_inner_size(600.0, 500.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}
