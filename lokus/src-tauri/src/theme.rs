use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemePayload {
  pub tokens: Option<HashMap<String, String>>, // CSS vars like {"--bg":"15 23 42", ...}
  pub mode:   Option<String>,                   // "light" | "dark" | "system"
  pub accent: Option<String>,                   // preset key or "r g b"
  pub scope:  Option<String>,                   // "global" (we’ll use this now)
}

#[tauri::command]
pub fn theme_broadcast(app: AppHandle, payload: ThemePayload) -> Result<(), String> {
  app.emit("theme:apply", payload).map_err(|e| e.to_string())
}
