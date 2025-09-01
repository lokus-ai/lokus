use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Emitter};

fn base_label_from_path(path: &str) -> String {
  let last = path.split('/').filter(|s| !s.is_empty()).last().unwrap_or("workspace");
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
  let label = base_label_from_path(&workspace_path);

  if let Some(win) = app.get_webview_window(&label) {
    focus(&win);
    // If the window already exists, we still need to tell it to activate the path.
    // The URL method is only for creation.
    let _ = win.emit("workspace:activate", workspace_path);
    return Ok(());
  }

  // CORRECTED: Encode the path and add it as a query parameter to the URL.
  let encoded_path = urlencoding::encode(&workspace_path);
  let url = WebviewUrl::App(format!("index.html?workspacePath={}", encoded_path).into());

  let _win = WebviewWindowBuilder::new(&app, &label, url)
    .title(format!("Lokus — {}", workspace_path.split('/').last().unwrap_or("Workspace")))
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;

  // The unreliable emit on creation is no longer needed.
  Ok(())
}

pub fn open_preferences_window(app: AppHandle) -> Result<(), String> {
  let label = "prefs";
  if let Some(win) = app.get_webview_window(label) {
    focus(&win);
    return Ok(());
  }
  let url = WebviewUrl::App("index.html".into());
  let _win = WebviewWindowBuilder::new(&app, label, url)
    .title("Preferences")
    .inner_size(760.0, 560.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}
