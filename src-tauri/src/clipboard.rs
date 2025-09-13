use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub async fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clipboard_read_text(app: AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clipboard_write_html(app: AppHandle, html: String) -> Result<(), String> {
    app.clipboard()
        .write_html(html, None)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clipboard_read_html(app: AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clipboard_has_text(app: AppHandle) -> Result<bool, String> {
    // Check if clipboard has text by trying to read it
    match app.clipboard().read_text() {
        Ok(text) => Ok(!text.is_empty()),
        Err(_) => Ok(false)
    }
}

#[tauri::command]
pub async fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    app.clipboard()
        .clear()
        .map_err(|e| e.to_string())
}