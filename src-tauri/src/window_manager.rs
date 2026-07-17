use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Emitter, TitleBarStyle};
use std::path::Path;

fn base_label_from_path(path: &str) -> String {
  use std::collections::hash_map::DefaultHasher;
  use std::hash::{Hash, Hasher};

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

  // Append a short stable hash of the FULL path so two folders that share a basename
  // (e.g. /work/notes and /personal/notes) get distinct labels instead of both
  // collapsing to "ws-notes" and focusing the wrong window.
  let mut hasher = DefaultHasher::new();
  path.hash(&mut hasher);
  s.push('-');
  s.push_str(&format!("{:08x}", hasher.finish() as u32));
  s
}

fn focus(win: &WebviewWindow) {
  let _ = win.set_focus();
}

#[tauri::command]
pub fn open_workspace_window(app: AppHandle, workspace_path: String) -> Result<(), String> {

  // One workspace per window: check if this workspace is already open and
  // focus its window instead of opening a duplicate.
  let label = base_label_from_path(&workspace_path);
  if let Some(existing_win) = app.get_webview_window(&label) {
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

  // Not open yet: create a real window for this workspace.
  let encoded_path = urlencoding::encode(&workspace_path);
  let url_string = format!("/index.html?workspacePath={}", encoded_path);
  let url = WebviewUrl::App(url_string.into());

  // Use Path for cross-platform window title
  let workspace_name = Path::new(&workspace_path)
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("Workspace");

  // Build window with platform-specific titlebar style to match main window
  #[cfg(target_os = "macos")]
  let win = WebviewWindowBuilder::new(&app, &label, url)
    .title(format!("Lokus — {}", workspace_name))
    .inner_size(1200.0, 800.0)
    .title_bar_style(TitleBarStyle::Overlay)
    .build()
    .map_err(|e| e.to_string())?;

  #[cfg(not(target_os = "macos"))]
  let win = WebviewWindowBuilder::new(&app, &label, url)
    .title(format!("Lokus — {}", workspace_name))
    .inner_size(1200.0, 800.0)
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;

  // Emit workspace:activate as backup method
  let _ = win.emit("workspace:activate", workspace_path.clone());

  // Update API server with the new workspace
  let workspace_for_api = workspace_path.clone();
  let app_handle_for_api = app.clone();
  tauri::async_runtime::spawn(async move {
    crate::api_server::update_workspace(&app_handle_for_api, Some(workspace_for_api)).await;
  });


  Ok(())
}

#[tauri::command]
pub fn open_preferences_window(app: AppHandle, workspace_path: Option<String>, section: Option<String>) -> Result<(), String> {
  let label = "prefs";
  if let Some(win) = app.get_webview_window(label) {
    focus(&win);
    // If section is provided, emit event to navigate to that section
    if let Some(s) = section {
      let _ = win.emit("preferences:navigate", s);
    }
    return Ok(());
  }
  // Pass a query param so the frontend can render the Preferences view immediately
  // Also pass workspace path and section if available
  let mut url_string = "index.html?view=prefs".to_string();
  if let Some(path) = workspace_path {
    let encoded_path = urlencoding::encode(&path);
    url_string = format!("{}&workspacePath={}", url_string, encoded_path);
  }
  if let Some(s) = section {
    let encoded_section = urlencoding::encode(&s);
    url_string = format!("{}&section={}", url_string, encoded_section);
  }
  let url = WebviewUrl::App(url_string.into());

  // Build window with platform-specific titlebar style to match main window
  #[cfg(target_os = "macos")]
  let _win = WebviewWindowBuilder::new(&app, label, url)
    .title("Preferences")
    .inner_size(760.0, 560.0)
    .resizable(true)
    .title_bar_style(TitleBarStyle::Overlay)
    .build()
    .map_err(|e| e.to_string())?;

  #[cfg(not(target_os = "macos"))]
  let _win = WebviewWindowBuilder::new(&app, label, url)
    .title("Preferences")
    .inner_size(760.0, 560.0)
    .resizable(true)
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;

  Ok(())
}

/// Build a launcher (welcome) window. Shared by the `open_launcher_window`
/// command, the macOS Reopen handler and the tray handlers, all of which may
/// need to create one when no window exists.
pub fn build_launcher_window(app: &AppHandle) -> Result<WebviewWindow, String> {
  // Generate unique label with timestamp
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_millis();
  let label = format!("launcher-{}", timestamp);

  // Pass forceWelcome parameter so the frontend shows welcome screen
  let url = WebviewUrl::App("index.html?forceWelcome=true".into());

  // Build window with platform-specific titlebar style to match main window
  #[cfg(target_os = "macos")]
  let builder = WebviewWindowBuilder::new(app, &label, url)
    .title("Lokus")
    .inner_size(900.0, 700.0)
    .min_inner_size(600.0, 500.0)
    .center()
    .title_bar_style(TitleBarStyle::Overlay);

  #[cfg(not(target_os = "macos"))]
  let builder = WebviewWindowBuilder::new(app, &label, url)
    .title("Lokus")
    .inner_size(900.0, 700.0)
    .min_inner_size(600.0, 500.0)
    .center()
    .decorations(true);

  builder.build().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_launcher_window(app: AppHandle) -> Result<(), String> {
  build_launcher_window(&app).map(|_| ())
}

#[tauri::command]
pub fn sync_window_theme(window: tauri::Window, is_dark: bool, _bg_color: String) -> Result<(), String> {

  #[cfg(target_os = "macos")]
  {
    use cocoa::base::id;
    use objc::{msg_send, sel, sel_impl, class};

    let ns_window = window.ns_window().map_err(|e| format!("Failed to get NSWindow: {}", e))? as id;
    unsafe {
      let appearance_name = if is_dark {
        cocoa::appkit::NSAppearanceNameVibrantDark
      } else {
        cocoa::appkit::NSAppearanceNameVibrantLight
      };

      let appearance_class = class!(NSAppearance);
      let appearance: id = msg_send![appearance_class, appearanceNamed: appearance_name];
      let _: () = msg_send![ns_window, setAppearance: appearance];
    }
  }

  #[cfg(target_os = "windows")]
  {
    use tauri::window::Color;

    // Parse RGB color from string like "15 23 42"
    let parts: Vec<&str> = _bg_color.split_whitespace().collect();
    if parts.len() == 3 {
      if let (Ok(r), Ok(g), Ok(b)) = (
        parts[0].parse::<u8>(),
        parts[1].parse::<u8>(),
        parts[2].parse::<u8>()
      ) {
        let _ = window.set_background_color(Some(Color(r, g, b, 255)));
      } else {
      }
    } else {
    }
  }

  #[cfg(target_os = "linux")]
  {
    // Linux doesn't need titlebar theming as it uses system decorations
  }

  Ok(())
}


#[cfg(test)]
mod tests {
  use super::base_label_from_path;

  #[test]
  fn label_is_stable_for_dedup() {
    // The workspace dedup branch relies on the same path always producing the
    // same window label.
    assert_eq!(
      base_label_from_path("/Users/me/Notes"),
      base_label_from_path("/Users/me/Notes")
    );
  }

  #[test]
  fn label_has_ws_prefix_and_slug() {
    let label = base_label_from_path("/Users/me/My Notes");
    assert!(label.starts_with("ws-my-notes-"), "got: {}", label);
  }

  #[test]
  fn same_basename_different_dirs_get_distinct_labels() {
    // Two folders named "notes" must not collapse onto one window.
    assert_ne!(
      base_label_from_path("/work/notes"),
      base_label_from_path("/personal/notes")
    );
  }

  #[test]
  fn trailing_separators_and_empty_names_are_safe() {
    let root = base_label_from_path("/");
    assert!(root.starts_with("ws-"), "got: {}", root);
    let trailing = base_label_from_path("/Users/me/notes/");
    assert!(trailing.starts_with("ws-"), "got: {}", trailing);
  }
}
