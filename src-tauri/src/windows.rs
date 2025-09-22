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
  
  // On Windows, use the existing window instead of creating a new one
  #[cfg(target_os = "windows")]
  {
    println!("[Backend] Windows: Using existing window for workspace");
    // Find the main window (launcher)
    if let Some(main_window) = app.get_webview_window("main") {
      println!("[Backend] Found main window, emitting workspace:activate");
      let _ = main_window.emit("workspace:activate", workspace_path);
      focus(&main_window);
      return Ok(());
    }
  }
  
  // On macOS and Linux, continue with the original multi-window approach
  #[cfg(not(target_os = "windows"))]
  {
    let label = base_label_from_path(&workspace_path);
    println!("[Backend] Generated window label: {}", label);

    if let Some(win) = app.get_webview_window(&label) {
      println!("[Backend] Window already exists, focusing and activating");
      focus(&win);
      // If the window already exists, we still need to tell it to activate the path.
      // The URL method is only for creation.
      let _ = win.emit("workspace:activate", workspace_path);
      return Ok(());
    }
  }

  // Only create new windows on non-Windows platforms
  #[cfg(not(target_os = "windows"))]
  {
    let label = base_label_from_path(&workspace_path);
    
    // CORRECTED: Encode the path and add it as a query parameter to the URL.
    let encoded_path = urlencoding::encode(&workspace_path);
    // Try with absolute path starting with /
    let url_string = format!("/index.html?workspacePath={}", encoded_path);
    println!("[Backend] Creating new window with URL: {}", url_string);
    println!("[Backend] Encoded path: {}", encoded_path);
    println!("[Backend] Raw workspace path: {}", workspace_path);
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

    // Emit the workspace path immediately after window creation
    // This provides a backup method if URL parameters fail
    println!("[Backend] Emitting workspace:activate event to new window");
    let _ = win.emit("workspace:activate", workspace_path.clone());
    
    // Also store the path in window's data (another backup method)
    println!("[Backend] Window created successfully");
  }
  
  // On Windows, if we couldn't find the main window, return an error
  #[cfg(target_os = "windows")]
  {
    return Err("Could not find main window".to_string());
  }
  
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
