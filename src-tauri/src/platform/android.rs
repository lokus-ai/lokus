/// Android platform implementation

use super::{
    errors::PlatformError, FileSystemOperations, PlatformConfig, PlatformFeature,
    PlatformProvider, SystemIntegration,
};
use std::path::Path;

pub struct AndroidPlatform {
    initialized: bool,
}

impl AndroidPlatform {
    pub fn new() -> Self {
        Self { initialized: false }
    }
}

impl FileSystemOperations for AndroidPlatform {
    fn reveal_in_file_manager(&self, _path: &Path) -> Result<(), PlatformError> {
        // Android doesn't have a consistent file manager API
        Err(PlatformError::unsupported("File manager reveal"))
    }

    fn open_terminal(&self, _path: &Path) -> Result<(), PlatformError> {
        // Android doesn't have terminal access by default
        Err(PlatformError::unsupported("Terminal"))
    }
}

impl SystemIntegration for AndroidPlatform {
    fn platform_name(&self) -> &'static str {
        "android"
    }

    fn supports_feature(&self, feature: PlatformFeature) -> bool {
        match feature {
            PlatformFeature::FileManagerReveal => false,
            PlatformFeature::TerminalLaunch => false,
            PlatformFeature::CustomTerminal => false,
            PlatformFeature::QuickLook => false,
            PlatformFeature::ContextMenus => true, // Android supports context menus
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

impl PlatformProvider for AndroidPlatform {
    fn initialize(&mut self) -> Result<(), PlatformError> {
        self.initialized = true;
        Ok(())
    }

    fn cleanup(&mut self) -> Result<(), PlatformError> {
        self.initialized = false;
        Ok(())
    }
}
