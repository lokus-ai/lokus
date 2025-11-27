/**
 * Logging Infrastructure Module
 *
 * Provides centralized logging with daily rotation, Sentry integration,
 * and structured output for production debugging.
 */

use std::path::PathBuf;
use std::fs;
use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt};
use tracing_appender::rolling::{RollingFileAppender, Rotation};

pub struct LoggingConfig {
    pub log_dir: PathBuf,
    pub max_days_retained: u64,
    pub sentry_enabled: bool,
    pub environment: String,
}

/// Initialize the logging infrastructure
pub fn init_logging(config: LoggingConfig) -> Result<(), String> {
    // Create log directory if it doesn't exist
    if !config.log_dir.exists() {
        fs::create_dir_all(&config.log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;
    }

    // Clean up old log files (keep only last N days)
    cleanup_old_logs(&config.log_dir, config.max_days_retained)?;

    // Set up daily rotating file appender
    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("lokus")
        .filename_suffix("log")
        .build(&config.log_dir)
        .map_err(|e| format!("Failed to create file appender: {}", e))?;

    // Configure log format based on environment
    let is_dev = config.environment == "development";

    // Set up env filter
    // Default: INFO for production, DEBUG for development
    let env_filter = EnvFilter::try_from_default_env()
        .or_else(|_| {
            if is_dev {
                EnvFilter::try_new("debug")
            } else {
                EnvFilter::try_new("info")
            }
        })
        .map_err(|e| format!("Failed to create env filter: {}", e))?;

    // Build the subscriber with file logging
    let file_layer = fmt::layer()
        .with_writer(file_appender)
        .with_ansi(false)  // No ANSI colors in log files
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_target(true);

    // Set up the subscriber based on environment
    if is_dev {
        // Development: Add stdout logging
        let stdout_layer = fmt::layer()
            .pretty()
            .with_thread_ids(true)
            .with_target(true);

        let subscriber = tracing_subscriber::registry()
            .with(env_filter)
            .with(file_layer)
            .with(stdout_layer);

        tracing::subscriber::set_global_default(subscriber)
            .map_err(|e| format!("Failed to set global subscriber: {}", e))?;
    } else {
        // Production: File logging only
        let subscriber = tracing_subscriber::registry()
            .with(env_filter)
            .with(file_layer);

        tracing::subscriber::set_global_default(subscriber)
            .map_err(|e| format!("Failed to set global subscriber: {}", e))?;
    }

    tracing::info!(
        environment = %config.environment,
        log_dir = %config.log_dir.display(),
        "Logging initialized"
    );

    Ok(())
}

/// Clean up log files older than max_days_retained
fn cleanup_old_logs(log_dir: &PathBuf, max_days: u64) -> Result<(), String> {
    let now = std::time::SystemTime::now();
    let max_age = std::time::Duration::from_secs(max_days * 24 * 60 * 60);

    match fs::read_dir(log_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(age) = now.duration_since(modified) {
                            if age > max_age {
                                let path = entry.path();
                                if path.extension().and_then(|s| s.to_str()) == Some("log") {
                                    if let Err(e) = fs::remove_file(&path) {
                                        eprintln!("Failed to remove old log file {:?}: {}", path, e);
                                    } else {
                                        eprintln!("Removed old log file: {:?}", path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(())
        }
        Err(e) => {
            // If directory doesn't exist or can't be read, it's not critical
            eprintln!("Warning: Could not clean up old logs: {}", e);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logging_config_creation() {
        let config = LoggingConfig {
            log_dir: PathBuf::from("/tmp/lokus-test-logs"),
            max_days_retained: 7,
            sentry_enabled: false,
            environment: "test".to_string(),
        };

        assert_eq!(config.max_days_retained, 7);
        assert_eq!(config.environment, "test");
    }
}
