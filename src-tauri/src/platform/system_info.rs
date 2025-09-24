/// System information gathering using platform-specific APIs
/// 
/// This module provides detailed system information that respects platform
/// differences and capabilities, useful for debugging, feature detection,
/// and user support.

use super::errors::PlatformError;
use serde::{Serialize, Deserialize};

/// Comprehensive system information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    /// Operating system name and version
    pub os_info: OsInfo,
    /// Hardware information
    pub hardware: HardwareInfo,
    /// Desktop environment details (Linux/Unix)
    pub desktop_environment: Option<DesktopEnvironmentInfo>,
    /// Available applications and tools
    pub available_apps: ApplicationInfo,
    /// System capabilities and features
    pub capabilities: SystemCapabilities,
    /// Performance and resource information
    pub resources: ResourceInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OsInfo {
    pub platform: String,
    pub version: String,
    pub build: Option<String>,
    pub architecture: String,
    pub kernel_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HardwareInfo {
    pub cpu_architecture: String,
    pub cpu_count: usize,
    pub total_memory: Option<u64>,
    pub available_memory: Option<u64>,
    pub disk_info: Vec<DiskInfo>,
    pub display_info: Option<DisplayInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiskInfo {
    pub mount_point: String,
    pub filesystem: Option<String>,
    pub total_space: Option<u64>,
    pub available_space: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DisplayInfo {
    pub primary_resolution: (u32, u32),
    pub scale_factor: f64,
    pub display_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DesktopEnvironmentInfo {
    pub name: String,
    pub version: Option<String>,
    pub session_type: String, // X11, Wayland, etc.
    pub window_manager: Option<String>,
    pub theme: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApplicationInfo {
    pub file_managers: Vec<String>,
    pub terminals: Vec<String>,
    pub editors: Vec<String>,
    pub browsers: Vec<String>,
    pub development_tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemCapabilities {
    pub supports_notifications: bool,
    pub supports_global_shortcuts: bool,
    pub supports_file_associations: bool,
    pub supports_system_tray: bool,
    pub supports_dark_mode: bool,
    pub supports_transparency: bool,
    pub supports_window_controls: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceInfo {
    pub uptime: Option<u64>, // seconds
    pub load_average: Option<(f64, f64, f64)>, // 1m, 5m, 15m
    pub process_count: Option<usize>,
    pub network_interfaces: Vec<String>,
}

/// Platform-specific system information collector
pub struct SystemInfoCollector;

impl SystemInfoCollector {
    /// Gather comprehensive system information
    pub fn collect() -> Result<SystemInfo, PlatformError> {
        Ok(SystemInfo {
            os_info: Self::collect_os_info()?,
            hardware: Self::collect_hardware_info()?,
            desktop_environment: Self::collect_desktop_environment(),
            available_apps: Self::collect_application_info(),
            capabilities: Self::collect_system_capabilities(),
            resources: Self::collect_resource_info(),
        })
    }
    
    /// Collect operating system information
    fn collect_os_info() -> Result<OsInfo, PlatformError> {
        #[cfg(target_os = "macos")]
        {
            Self::collect_macos_info()
        }
        
        #[cfg(target_os = "windows")]
        {
            Self::collect_windows_info()
        }
        
        #[cfg(target_os = "linux")]
        {
            Self::collect_linux_info()
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            Ok(OsInfo {
                platform: std::env::consts::OS.to_string(),
                version: "Unknown".to_string(),
                build: None,
                architecture: std::env::consts::ARCH.to_string(),
                kernel_version: None,
            })
        }
    }
    
    #[cfg(target_os = "macos")]
    fn collect_macos_info() -> Result<OsInfo, PlatformError> {
        use std::process::Command;
        
        let version_output = Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .map_err(|e| PlatformError::system(e.to_string(), "collect_macos_version"))?;
            
        let build_output = Command::new("sw_vers")
            .arg("-buildVersion")
            .output()
            .map_err(|e| PlatformError::system(e.to_string(), "collect_macos_build"))?;
            
        let uname_output = Command::new("uname")
            .arg("-r")
            .output()
            .map_err(|e| PlatformError::system(e.to_string(), "collect_kernel_version"))?;
        
        Ok(OsInfo {
            platform: "macOS".to_string(),
            version: String::from_utf8_lossy(&version_output.stdout).trim().to_string(),
            build: Some(String::from_utf8_lossy(&build_output.stdout).trim().to_string()),
            architecture: std::env::consts::ARCH.to_string(),
            kernel_version: Some(String::from_utf8_lossy(&uname_output.stdout).trim().to_string()),
        })
    }
    
    #[cfg(target_os = "windows")]
    fn collect_windows_info() -> Result<OsInfo, PlatformError> {
        use std::process::Command;
        
        let version_output = Command::new("ver")
            .output()
            .map_err(|e| PlatformError::system(e.to_string(), "collect_windows_version"))?;
        
        // Try to get more detailed Windows version info
        let wmic_output = Command::new("wmic")
            .args(&["os", "get", "Version,BuildNumber", "/format:list"])
            .output()
            .ok();
        
        let version = String::from_utf8_lossy(&version_output.stdout).trim().to_string();
        let build = wmic_output.and_then(|output| {
            let text = String::from_utf8_lossy(&output.stdout);
            text.lines()
                .find(|line| line.starts_with("BuildNumber="))
                .map(|line| line.replace("BuildNumber=", ""))
        });
        
        Ok(OsInfo {
            platform: "Windows".to_string(),
            version,
            build,
            architecture: std::env::consts::ARCH.to_string(),
            kernel_version: None,
        })
    }
    
    #[cfg(target_os = "linux")]
    fn collect_linux_info() -> Result<OsInfo, PlatformError> {
        use std::fs;
        use std::process::Command;
        
        // Try to read /etc/os-release for distribution info
        let os_release = fs::read_to_string("/etc/os-release")
            .or_else(|_| fs::read_to_string("/usr/lib/os-release"))
            .unwrap_or_default();
        
        let mut version = "Unknown".to_string();
        let mut platform = "Linux".to_string();
        
        for line in os_release.lines() {
            if let Some(value) = line.strip_prefix("PRETTY_NAME=") {
                platform = value.trim_matches('"').to_string();
            } else if let Some(value) = line.strip_prefix("VERSION=") {
                version = value.trim_matches('"').to_string();
            }
        }
        
        // Get kernel version
        let kernel_version = Command::new("uname")
            .arg("-r")
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
            .ok();
        
        Ok(OsInfo {
            platform,
            version,
            build: None,
            architecture: std::env::consts::ARCH.to_string(),
            kernel_version,
        })
    }
    
    /// Collect hardware information
    fn collect_hardware_info() -> Result<HardwareInfo, PlatformError> {
        let cpu_count = num_cpus::get();
        let cpu_architecture = std::env::consts::ARCH.to_string();
        
        // Basic memory info (this would be enhanced with platform-specific APIs)
        let (total_memory, available_memory) = Self::get_memory_info();
        
        // Disk information
        let disk_info = Self::get_disk_info();
        
        // Display information
        let display_info = Self::get_display_info();
        
        Ok(HardwareInfo {
            cpu_architecture,
            cpu_count,
            total_memory,
            available_memory,
            disk_info,
            display_info,
        })
    }
    
    /// Get memory information (simplified implementation)
    fn get_memory_info() -> (Option<u64>, Option<u64>) {
        #[cfg(target_os = "linux")]
        {
            if let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") {
                let mut total = None;
                let mut available = None;
                
                for line in meminfo.lines() {
                    if line.starts_with("MemTotal:") {
                        if let Some(kb) = line.split_whitespace().nth(1) {
                            total = kb.parse::<u64>().ok().map(|kb| kb * 1024);
                        }
                    } else if line.starts_with("MemAvailable:") {
                        if let Some(kb) = line.split_whitespace().nth(1) {
                            available = kb.parse::<u64>().ok().map(|kb| kb * 1024);
                        }
                    }
                }
                
                return (total, available);
            }
        }
        
        // Fallback or other platforms
        (None, None)
    }
    
    /// Get disk information
    fn get_disk_info() -> Vec<DiskInfo> {
        let mut disks = Vec::new();
        
        // This is a simplified implementation
        // In a real implementation, you'd use platform-specific APIs
        
        #[cfg(unix)]
        {
            if let Ok(output) = std::process::Command::new("df").arg("-h").output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines().skip(1) {
                    if let Some(mount_point) = line.split_whitespace().last() {
                        if mount_point.starts_with('/') {
                            disks.push(DiskInfo {
                                mount_point: mount_point.to_string(),
                                filesystem: None,
                                total_space: None,
                                available_space: None,
                            });
                        }
                    }
                }
            }
        }
        
        disks
    }
    
    /// Get display information
    fn get_display_info() -> Option<DisplayInfo> {
        // This would use platform-specific APIs to get actual display info
        // For now, return basic placeholder
        Some(DisplayInfo {
            primary_resolution: (1920, 1080), // Placeholder
            scale_factor: 1.0,                // Placeholder
            display_count: 1,                 // Placeholder
        })
    }
    
    /// Collect desktop environment information (Linux/Unix)
    fn collect_desktop_environment() -> Option<DesktopEnvironmentInfo> {
        #[cfg(target_os = "linux")]
        {
            let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
            let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
            
            if !desktop.is_empty() {
                return Some(DesktopEnvironmentInfo {
                    name: desktop,
                    version: None,
                    session_type,
                    window_manager: std::env::var("WINDOW_MANAGER").ok(),
                    theme: None,
                });
            }
        }
        
        None
    }
    
    /// Collect available application information
    fn collect_application_info() -> ApplicationInfo {
        ApplicationInfo {
            file_managers: Self::detect_file_managers(),
            terminals: Self::detect_terminals(),
            editors: Self::detect_editors(),
            browsers: Self::detect_browsers(),
            development_tools: Self::detect_development_tools(),
        }
    }
    
    /// Detect available file managers
    fn detect_file_managers() -> Vec<String> {
        let candidates = [
            "nautilus", "dolphin", "thunar", "nemo", "caja", 
            "pcmanfm", "ranger", "mc", "explorer", "finder"
        ];
        
        Self::filter_available_commands(&candidates)
    }
    
    /// Detect available terminal emulators
    fn detect_terminals() -> Vec<String> {
        let candidates = [
            "gnome-terminal", "konsole", "xfce4-terminal", "kitty",
            "alacritty", "tilix", "terminator", "xterm", "wt", "cmd"
        ];
        
        Self::filter_available_commands(&candidates)
    }
    
    /// Detect available text editors
    fn detect_editors() -> Vec<String> {
        let candidates = [
            "code", "vim", "nvim", "emacs", "nano", "gedit",
            "kate", "notepad", "sublime", "atom"
        ];
        
        Self::filter_available_commands(&candidates)
    }
    
    /// Detect available browsers
    fn detect_browsers() -> Vec<String> {
        let candidates = [
            "firefox", "chrome", "chromium", "safari", "edge",
            "brave", "opera", "vivaldi"
        ];
        
        Self::filter_available_commands(&candidates)
    }
    
    /// Detect development tools
    fn detect_development_tools() -> Vec<String> {
        let candidates = [
            "git", "cargo", "npm", "node", "python", "python3",
            "rustc", "gcc", "clang", "make", "cmake"
        ];
        
        Self::filter_available_commands(&candidates)
    }
    
    /// Filter commands that are actually available
    fn filter_available_commands(candidates: &[&str]) -> Vec<String> {
        candidates
            .iter()
            .filter(|&&cmd| Self::is_command_available(cmd))
            .map(|&cmd| cmd.to_string())
            .collect()
    }
    
    /// Check if a command is available
    fn is_command_available(command: &str) -> bool {
        #[cfg(unix)]
        {
            std::process::Command::new("which")
                .arg(command)
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
        
        #[cfg(windows)]
        {
            std::process::Command::new("where")
                .arg(command)
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
    }
    
    /// Collect system capabilities
    fn collect_system_capabilities() -> SystemCapabilities {
        SystemCapabilities {
            supports_notifications: Self::supports_notifications(),
            supports_global_shortcuts: Self::supports_global_shortcuts(),
            supports_file_associations: Self::supports_file_associations(),
            supports_system_tray: Self::supports_system_tray(),
            supports_dark_mode: Self::supports_dark_mode(),
            supports_transparency: Self::supports_transparency(),
            supports_window_controls: Self::supports_window_controls(),
        }
    }
    
    fn supports_notifications() -> bool {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        return true;
        
        #[cfg(target_os = "linux")]
        return Self::is_command_available("notify-send");
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return false;
    }
    
    fn supports_global_shortcuts() -> bool {
        // Most desktop platforms support global shortcuts
        #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
        return true;
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return false;
    }
    
    fn supports_file_associations() -> bool {
        // Most platforms support file associations
        true
    }
    
    fn supports_system_tray() -> bool {
        #[cfg(target_os = "macos")]
        return true; // Menu bar
        
        #[cfg(target_os = "windows")]
        return true; // System tray
        
        #[cfg(target_os = "linux")]
        {
            // Depends on desktop environment
            let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
            return !desktop.is_empty();
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return false;
    }
    
    fn supports_dark_mode() -> bool {
        #[cfg(target_os = "macos")]
        return true; // macOS has system-wide dark mode
        
        #[cfg(target_os = "windows")]
        return true; // Windows 10+ has dark mode
        
        #[cfg(target_os = "linux")]
        {
            // Most modern DEs support dark themes
            let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
            return desktop.to_lowercase().contains("gnome") || 
                   desktop.to_lowercase().contains("kde") ||
                   desktop.to_lowercase().contains("xfce");
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return false;
    }
    
    fn supports_transparency() -> bool {
        #[cfg(target_os = "macos")]
        return true; // macOS supports window transparency
        
        #[cfg(target_os = "windows")]
        return true; // Windows supports transparency
        
        #[cfg(target_os = "linux")]
        {
            // Depends on compositor
            return std::env::var("WAYLAND_DISPLAY").is_ok() ||
                   Self::is_command_available("picom") ||
                   Self::is_command_available("compton");
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return false;
    }
    
    fn supports_window_controls() -> bool {
        // Most desktop platforms support custom window controls
        true
    }
    
    /// Collect resource information
    fn collect_resource_info() -> ResourceInfo {
        ResourceInfo {
            uptime: Self::get_uptime(),
            load_average: Self::get_load_average(),
            process_count: Self::get_process_count(),
            network_interfaces: Self::get_network_interfaces(),
        }
    }
    
    fn get_uptime() -> Option<u64> {
        #[cfg(target_os = "linux")]
        {
            if let Ok(uptime_str) = std::fs::read_to_string("/proc/uptime") {
                return uptime_str
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.parse::<f64>().ok())
                    .map(|f| f as u64);
            }
        }
        
        None
    }
    
    fn get_load_average() -> Option<(f64, f64, f64)> {
        #[cfg(target_os = "linux")]
        {
            if let Ok(loadavg_str) = std::fs::read_to_string("/proc/loadavg") {
                let parts: Vec<&str> = loadavg_str.split_whitespace().collect();
                if parts.len() >= 3 {
                    if let (Ok(one), Ok(five), Ok(fifteen)) = (
                        parts[0].parse::<f64>(),
                        parts[1].parse::<f64>(),
                        parts[2].parse::<f64>(),
                    ) {
                        return Some((one, five, fifteen));
                    }
                }
            }
        }
        
        None
    }
    
    fn get_process_count() -> Option<usize> {
        #[cfg(target_os = "linux")]
        {
            if let Ok(entries) = std::fs::read_dir("/proc") {
                let count = entries
                    .filter_map(|entry| entry.ok())
                    .filter(|entry| {
                        entry.file_name()
                            .to_string_lossy()
                            .chars()
                            .all(|c| c.is_ascii_digit())
                    })
                    .count();
                return Some(count);
            }
        }
        
        None
    }
    
    fn get_network_interfaces() -> Vec<String> {
        let interfaces = Vec::new();
        
        #[cfg(target_os = "linux")]
        {
            if let Ok(entries) = std::fs::read_dir("/sys/class/net") {
                for entry in entries.filter_map(|e| e.ok()) {
                    if let Some(name) = entry.file_name().to_str() {
                        if name != "lo" { // Skip loopback
                            interfaces.push(name.to_string());
                        }
                    }
                }
            }
        }
        
        interfaces
    }
}

/// Tauri command to get system information
#[tauri::command]
pub fn get_system_information() -> Result<SystemInfo, String> {
    SystemInfoCollector::collect()
        .map_err(|err| err.user_message())
}

/// Tauri command to get specific system capability
#[tauri::command]
pub fn check_system_capability(capability: String) -> bool {
    let caps = SystemInfoCollector::collect_system_capabilities();
    
    match capability.as_str() {
        "notifications" => caps.supports_notifications,
        "global_shortcuts" => caps.supports_global_shortcuts,
        "file_associations" => caps.supports_file_associations,
        "system_tray" => caps.supports_system_tray,
        "dark_mode" => caps.supports_dark_mode,
        "transparency" => caps.supports_transparency,
        "window_controls" => caps.supports_window_controls,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_system_info_collection() {
        let info = SystemInfoCollector::collect();
        assert!(info.is_ok());
        
        let info = info.unwrap();
        assert!(!info.os_info.platform.is_empty());
        assert!(!info.os_info.architecture.is_empty());
        assert!(info.hardware.cpu_count > 0);
    }
    
    #[test]
    fn test_os_info_collection() {
        let os_info = SystemInfoCollector::collect_os_info();
        assert!(os_info.is_ok());
        
        let os_info = os_info.unwrap();
        assert!(!os_info.platform.is_empty());
        assert!(!os_info.version.is_empty());
    }
    
    #[test]
    fn test_capability_detection() {
        let _caps = SystemInfoCollector::collect_system_capabilities();
        
        // At least some capabilities should be supported on most platforms
        // This is a basic smoke test
    }
    
    #[test]
    fn test_command_availability() {
        // Test with a command that should exist on most systems
        #[cfg(unix)]
        assert!(SystemInfoCollector::is_command_available("ls"));
        
        #[cfg(windows)]
        assert!(SystemInfoCollector::is_command_available("dir"));
        
        // Test with a command that definitely doesn't exist
        assert!(!SystemInfoCollector::is_command_available("definitely_not_a_real_command_12345"));
    }
}