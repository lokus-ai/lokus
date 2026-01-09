//! Mobile platform implementation (Android/iOS)
//!
//! This module provides mobile-specific implementations with limited functionality
//! compared to desktop platforms.

use super::{
    errors::PlatformError,
    FileSystemOperations, SystemIntegration, PlatformProvider, PlatformFeature, PlatformConfig
};
use std::path::Path;

/// Mobile platform implementation
pub struct MobilePlatform {
    platform_name: &'static str,
}

impl MobilePlatform {
    pub fn new() -> Self {
        #[cfg(target_os = "android")]
        let platform_name = "android";

        #[cfg(target_os = "ios")]
        let platform_name = "ios";

        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        let platform_name = "mobile";

        Self { platform_name }
    }
}

impl FileSystemOperations for MobilePlatform {
    fn reveal_in_file_manager(&self, _path: &Path) -> Result<(), PlatformError> {
        // Mobile platforms don't have traditional file managers
        Err(PlatformError::unsupported("File manager reveal not available on mobile"))
    }

    fn open_terminal(&self, _path: &Path) -> Result<(), PlatformError> {
        // Mobile platforms don't have terminals
        Err(PlatformError::unsupported("Terminal not available on mobile"))
    }
}

impl SystemIntegration for MobilePlatform {
    fn platform_name(&self) -> &'static str {
        self.platform_name
    }

    fn supports_feature(&self, feature: PlatformFeature) -> bool {
        match feature {
            PlatformFeature::FileManagerReveal => false,
            PlatformFeature::TerminalLaunch => false,
            PlatformFeature::CustomTerminal => false,
            PlatformFeature::QuickLook => false,
            PlatformFeature::ContextMenus => false,
        }
    }

    fn get_platform_config(&self) -> PlatformConfig {
        PlatformConfig {
            preferred_terminal: None,
            file_manager_name: "Files".to_string(),
            native_dialogs: true,
            path_separator: '/',
        }
    }
}

impl PlatformProvider for MobilePlatform {
    fn initialize(&mut self) -> Result<(), PlatformError> {
        Ok(())
    }

    fn cleanup(&mut self) -> Result<(), PlatformError> {
        Ok(())
    }
}
