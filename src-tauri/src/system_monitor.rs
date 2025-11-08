use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sysinfo::{System, Networks, Disks};
use tauri::{AppHandle, Emitter, Manager};
use tokio::time;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub memory_percent: f32,
    pub disk_read_bytes: u64,
    pub disk_write_bytes: u64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
    pub process_count: usize,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub kernel_version: String,
    pub hostname: String,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub total_memory: u64,
    pub boot_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupMetrics {
    pub app_start_time: u64,
    pub tauri_init_time: Option<u64>,
    pub window_create_time: Option<u64>,
    pub frontend_load_time: Option<u64>,
    pub total_startup_time: Option<u64>,
    pub phases: Vec<StartupPhase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupPhase {
    pub name: String,
    pub duration_ms: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LokusMetrics {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceEvent {
    pub event_type: String,
    pub operation: String,
    pub duration_ms: u64,
    pub timestamp: u64,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceEventInput {
    pub event_type: String,
    pub operation: String,
    pub duration_ms: u64,
    pub metadata: Option<String>,
}

// Global state for the monitoring broadcaster
pub struct BroadcasterState {
    pub is_running: bool,
}

impl BroadcasterState {
    fn new() -> Self {
        Self { is_running: false }
    }
}

// Global state for startup and performance tracking
pub struct PerformanceTracker {
    pub app_start_time: u64,
    pub startup_phases: Vec<StartupPhase>,
    pub performance_events: Vec<PerformanceEvent>,
}

impl PerformanceTracker {
    pub fn new() -> Self {
        let app_start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            app_start_time,
            startup_phases: Vec::new(),
            performance_events: Vec::new(),
        }
    }

    pub fn add_startup_phase(&mut self, name: String, duration_ms: u64) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.startup_phases.push(StartupPhase {
            name,
            duration_ms,
            timestamp,
        });
    }

    pub fn add_performance_event(&mut self, event_type: String, operation: String, duration_ms: u64, metadata: Option<String>) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.performance_events.push(PerformanceEvent {
            event_type,
            operation,
            duration_ms,
            timestamp,
            metadata,
        });

        // Keep only last 500 events (increased from 100)
        if self.performance_events.len() > 500 {
            self.performance_events.remove(0);
        }
    }

    pub fn add_performance_events_batch(&mut self, events: Vec<PerformanceEventInput>) {
        let timestamp_base = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        for event_input in events {
            self.performance_events.push(PerformanceEvent {
                event_type: event_input.event_type,
                operation: event_input.operation,
                duration_ms: event_input.duration_ms,
                timestamp: timestamp_base,
                metadata: event_input.metadata,
            });
        }

        // Keep only last 500 events
        if self.performance_events.len() > 500 {
            let excess = self.performance_events.len() - 500;
            self.performance_events.drain(0..excess);
        }
    }
}

pub struct SystemMonitor {
    sys: System,
    networks: Networks,
    disks: Disks,
}

impl SystemMonitor {
    pub fn new() -> Self {
        Self {
            sys: System::new_all(),
            networks: Networks::new_with_refreshed_list(),
            disks: Disks::new_with_refreshed_list(),
        }
    }

    pub fn collect_metrics(&mut self) -> Result<SystemMetrics, String> {
        // Refresh system information
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();
        self.networks.refresh();

        // Get CPU usage (average across all cores)
        let cpu_usage = self.sys.global_cpu_usage();

        // Get memory info
        let memory_used = self.sys.used_memory();
        let memory_total = self.sys.total_memory();
        let memory_percent = if memory_total > 0 {
            (memory_used as f32 / memory_total as f32) * 100.0
        } else {
            0.0
        };

        // Get disk I/O (sum across all disks) - sysinfo doesn't provide I/O rates directly
        let (disk_read_bytes, disk_write_bytes) = (0u64, 0u64);

        // Get network I/O (sum across all interfaces)
        let (network_rx_bytes, network_tx_bytes) = self.networks.iter().fold(
            (0u64, 0u64),
            |(rx_acc, tx_acc), (_name, network)| {
                (
                    rx_acc + network.received(),
                    tx_acc + network.transmitted(),
                )
            },
        );

        // Get process count
        let process_count = self.sys.processes().len();

        // Get timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(SystemMetrics {
            cpu_usage,
            memory_used,
            memory_total,
            memory_percent,
            disk_read_bytes,
            disk_write_bytes,
            network_rx_bytes,
            network_tx_bytes,
            process_count,
            timestamp,
        })
    }

    pub fn list_processes(&mut self, limit: usize) -> Result<Vec<ProcessInfo>, String> {
        use sysinfo::ProcessesToUpdate;
        self.sys.refresh_processes(ProcessesToUpdate::All);

        let mut processes: Vec<ProcessInfo> = self
            .sys
            .processes()
            .iter()
            .map(|(pid, process)| ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_str().unwrap_or("Unknown").to_string(),
                cpu_usage: process.cpu_usage(),
                memory_usage: process.memory(),
                status: format!("{:?}", process.status()),
            })
            .collect();

        // Sort by CPU usage (descending)
        processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap());

        // Take top N processes
        processes.truncate(limit);

        Ok(processes)
    }

    pub fn get_system_info(&mut self) -> Result<SystemInfo, String> {
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();

        let os = System::name().unwrap_or_else(|| "Unknown".to_string());
        let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
        let kernel_version = System::kernel_version().unwrap_or_else(|| "Unknown".to_string());
        let hostname = System::host_name().unwrap_or_else(|| "Unknown".to_string());

        let cpu_count = self.sys.cpus().len();
        let cpu_brand = self
            .sys
            .cpus()
            .first()
            .map(|cpu| cpu.brand().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let total_memory = self.sys.total_memory();
        let boot_time = System::boot_time();

        Ok(SystemInfo {
            os,
            os_version,
            kernel_version,
            hostname,
            cpu_count,
            cpu_brand,
            total_memory,
            boot_time,
        })
    }

    pub fn get_lokus_metrics(&mut self) -> Result<LokusMetrics, String> {
        use sysinfo::{Pid, ProcessesToUpdate};

        // Get current process PID
        let current_pid = std::process::id();
        let pid = Pid::from_u32(current_pid);

        // Refresh process info
        self.sys.refresh_processes(ProcessesToUpdate::All);

        // Get process info for current PID
        if let Some(process) = self.sys.process(pid) {
            let cpu_usage = process.cpu_usage();
            let memory_usage = process.memory();
            let memory_total = self.sys.total_memory();
            let memory_percent = if memory_total > 0 {
                (memory_usage as f32 / memory_total as f32) * 100.0
            } else {
                0.0
            };

            Ok(LokusMetrics {
                cpu_usage,
                memory_usage,
                memory_percent,
            })
        } else {
            Err("Failed to find Lokus process".to_string())
        }
    }
}

// Tauri commands
#[tauri::command]
pub fn monitor_get_metrics() -> Result<SystemMetrics, String> {
    let mut monitor = SystemMonitor::new();
    monitor.collect_metrics()
}

#[tauri::command]
pub fn monitor_get_processes(limit: Option<usize>) -> Result<Vec<ProcessInfo>, String> {
    let mut monitor = SystemMonitor::new();
    monitor.list_processes(limit.unwrap_or(20))
}

#[tauri::command]
pub fn monitor_get_system_info() -> Result<SystemInfo, String> {
    let mut monitor = SystemMonitor::new();
    monitor.get_system_info()
}

#[tauri::command]
pub async fn monitor_start_broadcast(
    app: AppHandle,
    interval_ms: u64,
) -> Result<(), String> {
    let state: tauri::State<'_, Arc<Mutex<BroadcasterState>>> = app.state();
    let mut broadcaster_state = state.lock().unwrap();

    if broadcaster_state.is_running {
        return Ok(()); // Already running
    }

    broadcaster_state.is_running = true;
    drop(broadcaster_state); // Release lock

    let state_clone = state.inner().clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(interval_ms));

        loop {
            interval.tick().await;

            // Check if still running
            let is_running = {
                let broadcaster_state = state_clone.lock().unwrap();
                broadcaster_state.is_running
            };

            if !is_running {
                break;
            }

            // Collect and emit metrics
            let mut monitor = SystemMonitor::new();
            if let Ok(metrics) = monitor.collect_metrics() {
                let _ = app_clone.emit("system:metrics", metrics);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn monitor_stop_broadcast(app: AppHandle) -> Result<(), String> {
    let state: tauri::State<'_, Arc<Mutex<BroadcasterState>>> = app.state();
    let mut broadcaster_state = state.lock().unwrap();
    broadcaster_state.is_running = false;

    Ok(())
}

// Initialize the broadcaster state
pub fn init_broadcaster_state() -> Arc<Mutex<BroadcasterState>> {
    Arc::new(Mutex::new(BroadcasterState::new()))
}

// Initialize the performance tracker
pub fn init_performance_tracker() -> Arc<Mutex<PerformanceTracker>> {
    Arc::new(Mutex::new(PerformanceTracker::new()))
}

#[tauri::command]
pub fn monitor_get_lokus_metrics() -> Result<LokusMetrics, String> {
    let mut monitor = SystemMonitor::new();
    monitor.get_lokus_metrics()
}

#[tauri::command]
pub fn monitor_get_startup_metrics(app: AppHandle) -> Result<StartupMetrics, String> {
    let state: tauri::State<'_, Arc<Mutex<PerformanceTracker>>> = app.state();
    let tracker = state.lock().unwrap();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // Always return time since app started
    let total_startup_time = Some(now - tracker.app_start_time);

    Ok(StartupMetrics {
        app_start_time: tracker.app_start_time,
        tauri_init_time: tracker.startup_phases.iter()
            .find(|p| p.name == "Tauri Initialization")
            .map(|p| p.duration_ms),
        window_create_time: tracker.startup_phases.iter()
            .find(|p| p.name == "Window Creation")
            .map(|p| p.duration_ms),
        frontend_load_time: tracker.startup_phases.iter()
            .find(|p| p.name == "Frontend Load")
            .map(|p| p.duration_ms),
        total_startup_time,
        phases: tracker.startup_phases.clone(),
    })
}

#[tauri::command]
pub fn monitor_add_startup_phase(
    app: AppHandle,
    name: String,
    duration_ms: u64,
) -> Result<(), String> {
    let state: tauri::State<'_, Arc<Mutex<PerformanceTracker>>> = app.state();
    let mut tracker = state.lock().unwrap();
    tracker.add_startup_phase(name, duration_ms);
    Ok(())
}

#[tauri::command]
pub fn monitor_log_performance_event(
    app: AppHandle,
    event_type: String,
    operation: String,
    duration_ms: u64,
    metadata: Option<String>,
) -> Result<(), String> {
    let state: tauri::State<'_, Arc<Mutex<PerformanceTracker>>> = app.state();
    let mut tracker = state.lock().unwrap();
    tracker.add_performance_event(event_type, operation, duration_ms, metadata);
    Ok(())
}

#[tauri::command]
pub fn monitor_get_performance_events(app: AppHandle) -> Result<Vec<PerformanceEvent>, String> {
    let state: tauri::State<'_, Arc<Mutex<PerformanceTracker>>> = app.state();
    let tracker = state.lock().unwrap();
    Ok(tracker.performance_events.clone())
}

#[tauri::command]
pub fn monitor_log_performance_events_batch(
    app: AppHandle,
    events: Vec<PerformanceEventInput>,
) -> Result<(), String> {
    let state: tauri::State<'_, Arc<Mutex<PerformanceTracker>>> = app.state();
    let mut tracker = state.lock().unwrap();
    tracker.add_performance_events_batch(events);
    Ok(())
}
