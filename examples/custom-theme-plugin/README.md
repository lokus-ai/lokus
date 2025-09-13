# Custom Theme Plugin

A comprehensive theme customization plugin for Lokus that demonstrates CSS injection, theme switching, and dynamic styling capabilities.

## Features

- **Built-in Themes**: Includes popular themes like Nord, Dracula, Monokai, and Custom Light
- **Theme Switching**: Easy theme switching with commands and UI panel
- **CSS Injection**: Inject custom CSS and themes dynamically
- **System Theme Integration**: Automatically switch themes based on system dark/light mode
- **Theme Persistence**: Remember theme choice between sessions
- **Custom CSS**: Add your own custom CSS rules
- **Smooth Animations**: Optional transitions when switching themes
- **Visual Theme Preview**: Preview themes with color palettes before applying

## Installation

1. Copy this plugin folder to your Lokus plugins directory
2. Enable the plugin in Lokus settings
3. Access themes through the sidebar panel or commands

## Usage

### Theme Commands

Use these commands to switch themes:
- `/apply-nord` - Apply Nord theme (Arctic, north-bluish)
- `/apply-dracula` - Apply Dracula theme (Dark with vibrant colors)
- `/apply-monokai` - Apply Monokai theme (Classic warm dark theme)
- `/reset-theme` - Reset to default Lokus theme
- `/toggle-theme-panel` - Show/hide the theme selection panel

### Theme Panel

Access the Custom Themes panel from the sidebar to:
- Browse available themes with visual previews
- See theme descriptions and color palettes
- Apply themes with one click
- Configure auto-switching and animations
- Add custom CSS rules

### Built-in Themes

#### Nord Theme
- **Type**: Dark
- **Style**: Arctic, clean, and elegant
- **Colors**: Blues and grays with muted tones
- **Best for**: Focus and reduced eye strain

#### Dracula Theme
- **Type**: Dark
- **Style**: Vibrant and modern
- **Colors**: Purple, pink, and cyan accents
- **Best for**: Creative work and personality

#### Monokai Theme
- **Type**: Dark
- **Style**: Warm and classic
- **Colors**: Green, yellow, and magenta
- **Best for**: Code editing and familiarity

#### Custom Light
- **Type**: Light
- **Style**: Clean and minimal
- **Colors**: Blues and grays on white
- **Best for**: Bright environments and readability

## Configuration

### Settings

- **Auto Switch Theme** (default: `false`): Automatically switch theme based on system preferences
- **Enable Animations** (default: `true`): Smooth transitions when switching themes
- **Persist Theme Choice** (default: `true`): Remember selected theme between sessions
- **Custom CSS** (default: `""`): Additional CSS rules to apply

### System Theme Integration

When auto-switch is enabled:
- System dark mode → Nord theme
- System light mode → Custom Light theme

## API Integration

This plugin demonstrates several advanced Lokus Plugin API features:

### CSS Injection
```javascript
// Inject theme styles
const styleElement = document.createElement('style');
styleElement.textContent = themeCSS;
document.head.appendChild(styleElement);

// Remove styles
styleElement.remove();
```

### Theme Management
```javascript
// Define theme structure
const theme = {
  name: 'Theme Name',
  description: 'Theme description',
  type: 'dark',
  colors: {
    primary: '#color',
    background: '#color',
    // ... more colors
  },
  styles: 'CSS rules here'
};

// Apply theme
this.injectThemeStyles(theme);
```

### System Integration
```javascript
// Watch for system theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', this.handleSystemThemeChange);
```

### Settings Persistence
```javascript
// Save theme choice
await this.setSetting('currentTheme', themeKey);

// Restore theme on activation
const savedTheme = await this.getSetting('currentTheme', null);
```

## Creating Custom Themes

### Theme Structure

```javascript
const customTheme = {
  name: 'My Theme',
  description: 'Description of the theme',
  type: 'dark', // or 'light'
  colors: {
    primary: '#hex-color',      // Primary accent color
    secondary: '#hex-color',    // Secondary accent color  
    background: '#hex-color',   // Main background
    surface: '#hex-color',      // Panel/card background
    accent: '#hex-color',       // Highlight color
    text: '#hex-color',         // Primary text
    textMuted: '#hex-color',    // Secondary text
    border: '#hex-color',       // Border color
    success: '#hex-color',      // Success state
    warning: '#hex-color',      // Warning state
    error: '#hex-color'         // Error state
  },
  styles: `
    /* CSS rules using theme colors */
    body {
      background-color: var(--custom-theme-background);
      color: var(--custom-theme-text);
    }
  `
};
```

### CSS Variables

The plugin automatically creates CSS variables for all theme colors:
- `--custom-theme-primary`
- `--custom-theme-secondary`
- `--custom-theme-background`
- `--custom-theme-surface`
- `--custom-theme-accent`
- `--custom-theme-text`
- `--custom-theme-text-muted`
- `--custom-theme-border`
- `--custom-theme-success`
- `--custom-theme-warning`
- `--custom-theme-error`

### Adding New Themes

1. Edit the `initializeThemes()` method in `index.js`
2. Add your theme to the themes Map
3. Create corresponding style methods
4. Update theme panel content

Example:
```javascript
// Add to initializeThemes()
this.themes.set('my-theme', {
  name: 'My Custom Theme',
  description: 'A theme I created',
  type: 'dark',
  colors: { /* ... */ },
  styles: this.getMyThemeStyles()
});

// Create style method
getMyThemeStyles() {
  return `
    body {
      background: var(--custom-theme-background);
      /* More styles... */
    }
  `;
}
```

## Custom CSS

### Adding Custom CSS

1. Open the theme panel in the sidebar
2. Scroll to the "Custom CSS" section
3. Enter your CSS rules in the textarea
4. Click "Apply CSS" to activate

Example custom CSS:
```css
/* Make editor text larger */
.editor-content {
  font-size: 16px !important;
  line-height: 1.6 !important;
}

/* Add custom border radius */
.btn {
  border-radius: 8px !important;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-thumb {
  background: var(--custom-theme-primary);
  border-radius: 4px;
}
```

### CSS Best Practices

- Use `!important` to override existing styles
- Leverage theme color variables for consistency
- Test custom CSS with different themes
- Use specific selectors to avoid conflicts

## Technical Implementation

### Architecture

```
custom-theme-plugin/
├── plugin.json          # Plugin manifest
├── index.js            # Main implementation
└── README.md           # Documentation
```

### Key Components

- **Theme Manager**: Handles theme loading and switching
- **CSS Injector**: Manages dynamic style injection
- **System Watcher**: Monitors system theme preferences
- **Settings Manager**: Persists theme choices and custom CSS
- **UI Panel**: Provides theme selection interface

### Performance Considerations

- **Lazy Loading**: Themes loaded on demand
- **CSS Optimization**: Minimal CSS injection
- **Event Debouncing**: System theme changes debounced
- **Memory Management**: Proper cleanup of event listeners

## Troubleshooting

### Themes Not Applying
- Check browser console for CSS errors
- Verify plugin permissions for UI modification
- Ensure theme key exists in themes map

### Custom CSS Not Working
- Use `!important` to override existing styles
- Check CSS syntax for errors
- Verify selectors target correct elements

### System Auto-Switch Not Working
- Check if browser supports `matchMedia`
- Verify auto-switch setting is enabled
- Test with manual system theme changes

### Performance Issues
- Disable animations if experiencing lag
- Reduce custom CSS complexity
- Check for CSS selector conflicts

## Development

### Testing Themes

1. Enable developer mode in Lokus
2. Load plugin from examples directory
3. Test theme switching with different content
4. Verify CSS variables are properly set
5. Test system theme integration

### Debugging

Use browser developer tools to:
- Inspect injected CSS
- Monitor theme variable values
- Debug style conflicts
- Test responsive behavior

## License

This plugin is part of the Lokus examples and is provided under the same license as the main Lokus application.