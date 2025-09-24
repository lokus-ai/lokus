# Platform Architecture Guide

This directory contains all platform-specific code for Lokus, ensuring clean separation between different operating systems while maintaining shared functionality.

## Directory Structure

```
src/platform/
├── index.js           # Main platform detection and exports
├── common/            # Shared cross-platform utilities
│   └── index.js
├── windows/           # Windows-specific implementations
│   └── index.js
├── macos/            # macOS-specific implementations
│   └── index.js
└── README.md         # This file
```

## Usage

### Basic Platform Detection

```javascript
import { getPlatform, isWindows, isMacOS } from '../platform';

// Get current platform
const platform = getPlatform(); // 'windows', 'macos', or 'linux'

// Check specific platform
if (isWindows()) {
  // Windows-specific code
}
```

### Using Platform Service

```javascript
import platformService from '../services/platform/PlatformService';

// Get platform-specific shortcuts
const shortcuts = await platformService.getShortcuts();

// Validate filename
const isValid = await platformService.isValidFilename('my-file.md');

// Get platform styles
const styles = await platformService.getPlatformStyles();
```

### Platform Configuration

```javascript
import { getPlatformConfig, getConfigValue } from '../config/platforms';

// Get entire platform config
const config = getPlatformConfig();

// Get specific value
const borderRadius = getConfigValue('ui.borderRadius', '4px');
```

### Feature Flags

```javascript
import { isFeatureAvailable, FEATURES } from '../core/features/flags';

// Check if a feature is available
if (isFeatureAvailable(FEATURES.DARK_MODE_SYNC)) {
  // Enable dark mode sync
}

// Check multiple features
if (areFeaturesAvailable(FEATURES.SHELL_INTEGRATION, FEATURES.CONTEXT_MENUS)) {
  // Enable shell features
}
```

## Adding Platform-Specific Features

### 1. Add to Platform Module

For Windows features, edit `src/platform/windows/index.js`:

```javascript
export const windowsFeatures = {
  // ... existing features ...
  
  // Add your new feature
  myNewFeature: () => {
    // Windows-specific implementation
  }
};
```

### 2. Update Configuration

Add configuration in `src/config/platforms/windows.config.js`:

```javascript
export const windowsConfig = {
  // ... existing config ...
  
  myFeature: {
    enabled: true,
    // feature-specific settings
  }
};
```

### 3. Add Feature Flag

Update `src/core/features/flags.js`:

```javascript
export const FEATURES = {
  // ... existing features ...
  MY_NEW_FEATURE: 'myNewFeature'
};
```

### 4. Implement in Platform Service

Update `src/services/platform/PlatformService.js` if needed:

```javascript
async getMyFeature() {
  await this.initialize();
  
  if (isWindows()) {
    return this.platformModule.windowsFeatures.myNewFeature;
  } else if (isMacOS()) {
    return this.platformModule.macosFeatures.myNewFeature;
  }
  
  return null; // Not supported on this platform
}
```

## Platform-Specific Guidelines

### Windows
- Use backslashes for paths: `C:\Users\...`
- Check for reserved filenames (CON, PRN, AUX, etc.)
- Support Windows 11 UI features (rounded corners, snap layouts)
- Use Windows Terminal when available, fallback to PowerShell/CMD

### macOS
- Use forward slashes for paths: `/Users/...`
- Support macOS UI features (vibrancy, traffic lights)
- Integrate with Finder and Quick Look
- Support Touch Bar on compatible devices

### Cross-Platform
- Always normalize paths using platform utilities
- Provide fallbacks for unsupported features
- Test on all platforms before merging
- Use generic keyboard shortcuts (CommandOrControl+X)

## Testing

### Unit Tests
Create platform-specific tests:
```
tests/platform/
├── windows/
├── macos/
└── common/
```

### Manual Testing
1. Test keyboard shortcuts on both platforms
2. Verify file operations work correctly
3. Check UI adaptations match platform guidelines
4. Ensure features degrade gracefully when unsupported

## Common Pitfalls

1. **Path Separators**: Always use `path.join()` or platform utilities
2. **Case Sensitivity**: Windows is case-insensitive, macOS/Linux are case-sensitive
3. **Hidden Files**: Different conventions (`.` prefix on Unix, file attributes on Windows)
4. **Line Endings**: CRLF (Windows) vs LF (Unix)
5. **Keyboard Shortcuts**: Cmd vs Ctrl, different conventions

## Contributing

When adding platform-specific code:
1. Keep implementations in appropriate platform directories
2. Update this README with new features
3. Add tests for platform-specific behavior
4. Document any platform limitations
5. Ensure graceful degradation on unsupported platforms