/// Platform-specific error handling for Lokus
/// 
/// This module provides comprehensive error types and handling for different platforms,
/// ensuring appropriate error messages and codes for each operating system.

use std::fmt;

/// Main error type for platform-specific operations
#[derive(Debug, Clone)]
pub struct PlatformError {
    /// The kind of error that occurred
    pub kind: PlatformErrorKind,
    /// Human-readable error message appropriate for the platform
    pub message: String,
    /// Optional platform-specific error code
    pub code: Option<i32>,
    /// The operation that was being performed when the error occurred
    pub operation: String,
}

/// Categories of platform errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlatformErrorKind {
    /// File system operation failed
    FileSystem,
    /// Permission denied for the operation
    PermissionDenied,
    /// Required application or tool not found
    ApplicationNotFound,
    /// Network or external service error
    Network,
    /// Platform feature not supported
    Unsupported,
    /// Generic system error
    System,
    /// Invalid input or configuration
    InvalidInput,
}

impl PlatformError {
    /// Create a new platform error
    pub fn new(kind: PlatformErrorKind, message: impl Into<String>, operation: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            code: None,
            operation: operation.into(),
        }
    }
    
    /// Create a platform error with a specific error code
    pub fn with_code(
        kind: PlatformErrorKind, 
        message: impl Into<String>, 
        operation: impl Into<String>,
        code: i32
    ) -> Self {
        Self {
            kind,
            message: message.into(),
            code: Some(code),
            operation: operation.into(),
        }
    }
    
    /// Create a file system error
    pub fn file_system(message: impl Into<String>, operation: impl Into<String>) -> Self {
        Self::new(PlatformErrorKind::FileSystem, message, operation)
    }
    
    /// Create a permission denied error
    pub fn permission_denied(operation: impl Into<String>) -> Self {
        let op = operation.into();
        Self::new(
            PlatformErrorKind::PermissionDenied,
            format!("Permission denied for operation: {}", op),
            op
        )
    }
    
    /// Create an application not found error
    pub fn application_not_found(app_name: impl Into<String>, operation: impl Into<String>) -> Self {
        let app = app_name.into();
        Self::new(
            PlatformErrorKind::ApplicationNotFound,
            format!("Required application '{}' not found or not accessible", app),
            operation
        )
    }
    
    /// Create an unsupported feature error
    pub fn unsupported(feature: impl Into<String>) -> Self {
        let feat = feature.into();
        Self::new(
            PlatformErrorKind::Unsupported,
            format!("Feature '{}' is not supported on this platform", feat),
            feat
        )
    }
    
    /// Create an invalid input error
    pub fn invalid_input(message: impl Into<String>, operation: impl Into<String>) -> Self {
        Self::new(PlatformErrorKind::InvalidInput, message, operation)
    }
    
    /// Create a system error
    pub fn system(message: impl Into<String>, operation: impl Into<String>) -> Self {
        Self::new(PlatformErrorKind::System, message, operation)
    }
    
    /// Get a user-friendly error message
    pub fn user_message(&self) -> String {
        match self.kind {
            PlatformErrorKind::FileSystem => {
                format!("File operation failed: {}", self.message)
            }
            PlatformErrorKind::PermissionDenied => {
                "Access denied. Please check your permissions and try again.".to_string()
            }
            PlatformErrorKind::ApplicationNotFound => {
                format!("Required application not found: {}", self.message)
            }
            PlatformErrorKind::Network => {
                format!("Network error: {}", self.message)
            }
            PlatformErrorKind::Unsupported => {
                format!("This feature is not available: {}", self.message)
            }
            PlatformErrorKind::System => {
                format!("System error: {}", self.message)
            }
            PlatformErrorKind::InvalidInput => {
                format!("Invalid input: {}", self.message)
            }
        }
    }
}

impl fmt::Display for PlatformError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} (operation: {})", self.message, self.operation)?;
        if let Some(code) = self.code {
            write!(f, " [code: {}]", code)?;
        }
        Ok(())
    }
}

impl std::error::Error for PlatformError {}

/// Convert std::io::Error to PlatformError
impl From<std::io::Error> for PlatformError {
    fn from(err: std::io::Error) -> Self {
        let kind = match err.kind() {
            std::io::ErrorKind::PermissionDenied => PlatformErrorKind::PermissionDenied,
            std::io::ErrorKind::NotFound => PlatformErrorKind::FileSystem,
            _ => PlatformErrorKind::System,
        };
        
        PlatformError::new(kind, err.to_string(), "io_operation")
    }
}

/// Platform-specific error message helpers
pub struct ErrorMessages;

impl ErrorMessages {
    /// Get platform-appropriate file not found message
    pub fn file_not_found(path: &str) -> String {
        #[cfg(target_os = "windows")]
        return format!("The system cannot find the file specified: {}", path);
        
        #[cfg(target_os = "macos")]
        return format!("File not found: {}", path);
        
        #[cfg(target_os = "linux")]
        return format!("No such file or directory: {}", path);
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return format!("File not found: {}", path);
    }
    
    /// Get platform-appropriate permission denied message
    pub fn permission_denied_for_path(path: &str) -> String {
        #[cfg(target_os = "windows")]
        return format!("Access to the path '{}' is denied", path);
        
        #[cfg(target_os = "macos")]
        return format!("Permission denied: {}", path);
        
        #[cfg(target_os = "linux")]
        return format!("Permission denied: {}", path);
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return format!("Permission denied: {}", path);
    }
    
    /// Get platform-appropriate application launch failure message
    pub fn application_launch_failed(app: &str) -> String {
        #[cfg(target_os = "windows")]
        return format!("Failed to start application: {}", app);
        
        #[cfg(target_os = "macos")]
        return format!("Could not launch application: {}", app);
        
        #[cfg(target_os = "linux")]
        return format!("Failed to execute: {}", app);
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return format!("Failed to launch: {}", app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_error_creation() {
        let error = PlatformError::file_system("Test error", "test_operation");
        assert_eq!(error.kind, PlatformErrorKind::FileSystem);
        assert_eq!(error.operation, "test_operation");
        assert!(error.code.is_none());
    }
    
    #[test]
    fn test_platform_error_with_code() {
        let error = PlatformError::with_code(
            PlatformErrorKind::System, 
            "Test error", 
            "test_operation", 
            123
        );
        assert_eq!(error.code, Some(123));
    }
    
    #[test]
    fn test_user_message() {
        let error = PlatformError::permission_denied("test_operation");
        let message = error.user_message();
        assert!(message.contains("Access denied"));
    }
    
    #[test]
    fn test_io_error_conversion() {
        let io_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "test");
        let platform_error: PlatformError = io_error.into();
        assert_eq!(platform_error.kind, PlatformErrorKind::PermissionDenied);
    }
}