#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lokus_lib::run();
}


#[tauri::command]
fn open_file_in_os(app: tauri::AppHandle, path: String) -> Result<(), String> {
    println!("[Backend] Attempting to open file: {}", path);
    // Use the AppHandle to access the shell API, which is the current best practice,
    // requires the `shell-open-api` feature to be enabled in `tauri.conf.json`.
    match app.shell().open(&path, None) {
        Ok(_) => {
            println!("[Backend] Successfully opened file: {}", path);
            Ok(())
        }
        Err(e) => {
            eprintln!("[Backend] Failed to open file '{}': {}", path, e);
            Err(format!("Failed to open file: {}", e))
        }
    }
}