# Theme System

Lokus features a sophisticated theme system that provides comprehensive customization of the application's appearance. The system includes built-in light and dark themes, custom theme creation, and seamless integration with system preferences.

## Overview

The theme system provides:
- **Built-in themes** - Professional light and dark themes
- **System integration** - Automatic system theme detection and switching
- **Custom themes** - Create and share custom color schemes
- **Real-time switching** - Instant theme changes without restart
- **CSS custom properties** - Modern, flexible theming architecture
- **Accessibility support** - High contrast and reduced motion support

## Built-in Themes

### Light Theme
The default light theme features:
- **Clean white background** - Easy on the eyes in bright environments
- **Dark text** - High contrast text for excellent readability
- **Subtle accents** - Blue accent colors for interactive elements
- **Soft borders** - Light gray borders and dividers
- **Professional appearance** - Suitable for professional environments

### Dark Theme
The dark theme provides:
- **Dark backgrounds** - Reduces eye strain in low-light environments
- **Light text** - High contrast against dark backgrounds
- **Vibrant accents** - Bright blue accents for better visibility
- **Consistent styling** - All interface elements follow dark theme
- **OLED optimization** - True black backgrounds for OLED displays

### System Theme
Automatic system theme detection:
- **OS Integration** - Follows system light/dark mode preferences
- **Automatic Switching** - Changes theme when system theme changes
- **Time-based** - Can follow system's automatic day/night switching
- **Cross-platform** - Works on macOS, Windows, and Linux

## Theme Switching

### Manual Theme Selection
- **Theme Toggle** - Click theme toggle button in interface
- **Keyboard Shortcut** - `⌘⇧T` (macOS) / `Ctrl+Shift+T` (Windows/Linux)
- **Command Palette** - Search for "Toggle Theme" (`⌘K`)
- **Preferences** - Select theme in application preferences

### Automatic Theme Switching
- **System Sync** - Automatically follow system theme changes
- **Schedule-based** - Switch themes at specific times (future feature)
- **Location-based** - Switch based on sunrise/sunset (future feature)
- **App-specific** - Different themes for different workspaces (future feature)

## Theme Architecture

### CSS Custom Properties
Themes use modern CSS custom properties for flexibility:

```css
:root {
  /* Base colors with RGB values for alpha support */
  --bg: 255, 255, 255;              /* Main background */
  --panel: 250, 250, 250;           /* Panel backgrounds */
  --border: 229, 229, 229;          /* Border colors */
  --text: 51, 51, 51;               /* Primary text */
  --muted: 115, 115, 115;           /* Secondary text */
  --accent: 59, 130, 246;           /* Accent color */
  --accent-fg: 255, 255, 255;       /* Accent foreground */
  
  /* Application-specific colors */
  --app-bg: rgb(var(--bg));
  --app-panel: rgb(var(--panel));
  --app-border: rgb(var(--border));
  --app-text: rgb(var(--text));
  --app-muted: rgb(var(--muted));
  --app-accent: rgb(var(--accent));
  --app-accent-fg: rgb(var(--accent-fg));
  
  /* Utility colors with alpha support */
  --app-bg-alpha: rgba(var(--bg), 0.8);
  --app-panel-alpha: rgba(var(--panel), 0.9);
  --app-accent-alpha: rgba(var(--accent), 0.1);
}
```

### Theme Structure
Each theme defines:
- **Primary Colors** - Background, text, and accent colors
- **Secondary Colors** - Borders, shadows, and subtle elements
- **State Colors** - Hover, active, and focus states
- **Semantic Colors** - Success, warning, error, and info colors
- **Component Colors** - Specific colors for UI components

### Color System
The color system provides:
- **Consistent Palette** - Limited, carefully chosen color set
- **Alpha Support** - Transparent colors using RGBA
- **Accessibility** - WCAG-compliant contrast ratios
- **Extensibility** - Easy to add new colors and variations

## Custom Theme Creation

### Theme Definition Format
Custom themes are defined in JSON format:

```json
{
  "name": "Custom Theme",
  "type": "custom",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "A custom theme with unique colors",
  "colors": {
    "bg": "255, 255, 255",
    "panel": "248, 250, 252", 
    "border": "226, 232, 240",
    "text": "15, 23, 42",
    "muted": "100, 116, 139",
    "accent": "79, 70, 229",
    "accent-fg": "255, 255, 255"
  },
  "variants": {
    "dark": {
      "bg": "15, 23, 42",
      "panel": "30, 41, 59",
      "border": "51, 65, 85",
      "text": "248, 250, 252",
      "muted": "148, 163, 184",
      "accent": "129, 140, 248",
      "accent-fg": "15, 23, 42"
    }
  }
}
```

### Theme Creation Process
1. **Define Base Colors** - Choose primary color palette
2. **Create Variants** - Define light and dark variations
3. **Test Accessibility** - Verify contrast ratios meet standards
4. **Export Theme** - Save as JSON file for sharing
5. **Import and Apply** - Load custom theme into application

### Theme Editor (Future Feature)
Visual theme editor will provide:
- **Color Picker** - Visual color selection interface
- **Live Preview** - Real-time preview of theme changes
- **Accessibility Check** - Automatic contrast ratio validation
- **Export Options** - Multiple export formats for sharing

## Theme Customization

### Color Customization
Users can customize individual theme colors:
- **Accent Color** - Change primary accent color
- **Background Tint** - Adjust background color temperature
- **Text Contrast** - Modify text contrast levels
- **Border Intensity** - Adjust border visibility

### Component Theming
Specific interface components can be themed:
- **Editor Background** - Custom editor background colors
- **Sidebar Styling** - File explorer appearance
- **Tab Styling** - Tab bar and tab appearance
- **Button Styling** - Button colors and effects

### Typography Integration
Themes integrate with typography settings:
- **Font Scaling** - Theme-aware font size adjustments
- **Font Weight** - Appropriate font weights for theme
- **Line Height** - Optimal line spacing for readability
- **Font Color** - Proper contrast for chosen fonts

## Accessibility Features

### High Contrast Support
- **System High Contrast** - Automatic detection and support
- **Enhanced Borders** - Stronger borders and outlines
- **Increased Contrast** - Higher contrast ratios for better visibility
- **Focus Indicators** - More prominent focus indicators

### Reduced Motion Support
- **Motion Preferences** - Respect system motion preferences
- **Minimal Animation** - Reduced animations when requested
- **Static Elements** - Disable moving or changing elements
- **Simplified Transitions** - Simpler state transitions

### Color Blindness Support
- **Color Independence** - Information not conveyed through color alone
- **Pattern Alternatives** - Use patterns in addition to colors
- **High Contrast Modes** - Alternative high contrast themes
- **Colorblind-friendly Palettes** - Tested with colorblind simulation

## Theme Performance

### Efficient Switching
- **CSS Variables** - Instant theme switching using CSS custom properties
- **No Reflow** - Theme changes don't trigger layout recalculation
- **Cached Styles** - Pre-computed theme styles for fast application
- **Progressive Enhancement** - Graceful fallbacks for older browsers

### Memory Efficiency
- **Single Stylesheet** - All themes in one optimized stylesheet
- **Variable Reuse** - Shared variables between themes
- **Minimal Overhead** - Lightweight theme system
- **Dynamic Loading** - Load only active theme resources

## Integration with Other Features

### Editor Integration
- **Syntax Highlighting** - Theme-aware code syntax highlighting
- **Selection Colors** - Consistent text selection appearance
- **Cursor Styling** - Theme-appropriate cursor colors
- **Line Numbers** - Proper contrast for line numbers

### Plugin Integration
- **Plugin Theming** - Plugins can extend theme system
- **Custom Properties** - Plugins can define their own theme variables
- **Theme Events** - Plugins can respond to theme change events
- **Consistent Styling** - Plugin UI follows application theme

### Component Integration
- **Modal Dialogs** - Themed dialog appearances
- **Tooltips** - Consistent tooltip styling
- **Notifications** - Theme-appropriate notification colors
- **Context Menus** - Properly themed context menus

## Advanced Theming

### Theme Variants
Support for theme variations:
- **Seasonal Themes** - Holiday or seasonal color schemes
- **Brand Themes** - Company or organization brand colors
- **Accessibility Themes** - Specialized accessibility-focused themes
- **Mood Themes** - Themes for different working moods

### Dynamic Theming
Advanced dynamic theming features:
- **Time-based Colors** - Colors that change throughout the day
- **Activity-based** - Different themes for different types of work
- **Context-aware** - Themes that adapt to current content
- **Adaptive Contrast** - Automatic contrast adjustment

### Theme Synchronization
- **Cross-device Sync** - Sync themes across multiple devices
- **Cloud Backup** - Backup custom themes to cloud storage
- **Team Sharing** - Share themes with team members
- **Version Control** - Track theme changes over time

## Troubleshooting

### Common Issues

**Theme not applying correctly:**
- Check if browser supports CSS custom properties
- Verify theme file format is correct
- Clear browser cache and reload application
- Check for conflicting custom CSS

**Colors appear incorrect:**
- Verify monitor color calibration
- Check system color profile settings
- Ensure proper contrast settings
- Test with different color temperatures

**Performance issues with themes:**
- Check if custom themes have complex CSS
- Verify browser hardware acceleration is enabled
- Close other resource-intensive applications
- Try using built-in themes instead of custom ones

**Theme switching not working:**
- Check keyboard shortcut conflicts
- Verify theme toggle button is responsive
- Clear application preferences and restart
- Check for JavaScript errors in console

### Theme Development Tips
1. **Start with built-in themes** - Use as reference for color relationships
2. **Test accessibility** - Verify contrast ratios meet WCAG standards
3. **Consider context** - Test themes in different lighting conditions
4. **Use color tools** - Leverage online color palette generators
5. **Get feedback** - Share themes with others for feedback

## Theme Sharing and Distribution

### Sharing Custom Themes
- **Export JSON** - Export theme as JSON file for sharing
- **Theme URLs** - Share themes via URLs (future feature)
- **Social Sharing** - Share screenshots of custom themes
- **Community Gallery** - Upload themes to community gallery (future feature)

### Installing Shared Themes
- **Import JSON** - Import theme files from others
- **URL Installation** - Install themes from shared URLs (future feature)
- **Drag and Drop** - Drag theme files into application
- **Theme Marketplace** - Browse and install community themes (future feature)

### Theme Licensing
- **Open Source** - Many themes available under open licenses
- **Attribution** - Proper credit for theme creators
- **Modification Rights** - Ability to modify and redistribute themes
- **Commercial Use** - Clear guidelines for commercial theme use

## Related Features

- **[Accessibility](./accessibility.md)** - Accessibility features and theme integration
- **[Preferences](./preferences.md)** - Theme selection and customization
- **[Plugin System](./plugin-system.md)** - Plugin theming capabilities
- **[Editor](./editor.md)** - Editor theming and syntax highlighting

---

*For technical theming implementation details, see the [Theme API Documentation](../api/themes.md).*