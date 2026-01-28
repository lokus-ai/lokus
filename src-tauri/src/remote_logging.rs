use std::net::UdpSocket;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

static UDP_SOCKET: Mutex<Option<UdpSocket>> = Mutex::new(None);
static TARGET_ADDR: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize, Deserialize)]
struct LogEntry {
    timestamp: String,
    level: String,
    message: String,
}

/// Initialize remote logging with a specific host IP
/// Called from JavaScript which knows the dev server IP from window.location
fn init_with_host(host: &str) {
    // Extract IP from host (might be "192.168.1.100:1420" or just "192.168.1.100")
    let ip = host.split(':').next().unwrap_or(host);

    // Skip localhost - no point in remote logging to localhost
    if ip == "localhost" || ip == "127.0.0.1" {
        println!("[RemoteLog] Skipping localhost");
        return;
    }

    let target = format!("{}:9999", ip);

    // Create UDP socket (bind to any port)
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
            socket.set_nonblocking(true).ok();
            if let Ok(mut addr) = TARGET_ADDR.lock() {
                *addr = Some(target.clone());
            }
            if let Ok(mut sock) = UDP_SOCKET.lock() {
                *sock = Some(socket);
            }
            println!("[RemoteLog] Initialized, sending to {}", target);
        }
        Err(e) => {
            println!("[RemoteLog] Failed to create socket: {}", e);
        }
    }
}

/// Send a log message to the dev machine (non-blocking)
fn send_log(level: &str, message: &str) {
    let addr = TARGET_ADDR.lock().ok().and_then(|a| a.clone());
    let socket_guard = UDP_SOCKET.lock().ok();

    if let (Some(ref socket), Some(ref addr)) = (socket_guard.as_ref().and_then(|s| s.as_ref()), addr.as_ref()) {
        let entry = LogEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: level.to_string(),
            message: message.to_string(),
        };

        if let Ok(json) = serde_json::to_string(&entry) {
            // Fire and forget - don't care if it fails
            let _ = socket.send_to(json.as_bytes(), addr.as_str());
        }
    }
}

/// Tauri command for JS to initialize remote logging with the dev server host
#[tauri::command]
pub fn remote_log_init(host: String) {
    init_with_host(&host);
}

/// Tauri command for JS to send logs
#[tauri::command]
pub fn remote_log(level: String, message: String) {
    send_log(&level, &message);
}
