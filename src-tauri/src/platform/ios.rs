/// iOS platform implementation

use super::{
    errors::PlatformError, FileSystemOperations, PlatformConfig, PlatformFeature,
    PlatformProvider, SystemIntegration,
};
use std::path::Path;

pub struct IosPlatform {
    initialized: bool,
}

impl IosPlatform {
    pub fn new() -> Self {
        Self { initialized: false }
    }
}

impl FileSystemOperations for IosPlatform {
    fn reveal_in_file_manager(&self, _path: &Path) -> Result<(), PlatformError> {
        // iOS doesn't have a traditional file manager that can be opened programmatically
        Err(PlatformError::unsupported("File manager reveal"))
    }

    fn open_terminal(&self, _path: &Path) -> Result<(), PlatformError> {
        // iOS doesn't have terminal access
        Err(PlatformError::unsupported("Terminal"))
    }
}

impl SystemIntegration for IosPlatform {
    fn platform_name(&self) -> &'static str {
        "ios"
    }

    fn supports_feature(&self, feature: PlatformFeature) -> bool {
        match feature {
            PlatformFeature::FileManagerReveal => false,
            PlatformFeature::TerminalLaunch => false,
            PlatformFeature::CustomTerminal => false,
            PlatformFeature::QuickLook => true, // iOS supports Quick Look
            PlatformFeature::ContextMenus => true, // iOS supports context menus
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

impl PlatformProvider for IosPlatform {
    fn initialize(&mut self) -> Result<(), PlatformError> {
        self.initialized = true;
        Ok(())
    }

    fn cleanup(&mut self) -> Result<(), PlatformError> {
        self.initialized = false;
        Ok(())
    }
}
