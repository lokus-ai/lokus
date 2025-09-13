# Word Count Plugin

A comprehensive word counting plugin for Lokus that provides real-time statistics about your document content.

## Features

- **Live Word Counting**: Real-time word count updates as you type
- **Character Count**: Shows total characters and characters without spaces
- **Reading Time Estimation**: Calculates estimated reading time based on configurable WPM
- **Paragraph & Sentence Count**: Tracks document structure statistics
- **Selection Statistics**: Shows word count for selected text
- **Sidebar Integration**: Detailed statistics panel in the sidebar
- **Status Bar Display**: Quick word count in the status bar
- **Export Statistics**: Copy all statistics to clipboard

## Installation

1. Copy this plugin folder to your Lokus plugins directory
2. Enable the plugin in Lokus settings
3. The plugin will automatically start counting words in your documents

## Configuration

The plugin supports several configuration options:

### Settings

- **Show Character Count** (default: `true`): Display character count in addition to word count
- **Show Reading Time** (default: `true`): Show estimated reading time
- **Reading Speed (WPM)** (default: `200`): Words per minute for reading time calculation (range: 100-500)
- **Exclude Code Blocks** (default: `false`): Don't count words in code blocks

### UI Options

- **Sidebar Position**: Right sidebar (configurable)
- **Status Bar Position**: Right side of status bar
- **Auto-open Sidebar**: Disabled by default

## Usage

### Basic Usage

Once installed, the plugin automatically starts counting words in your active document. You'll see:

- Current word count in the status bar
- Detailed statistics in the sidebar panel (click the counter icon to open)

### Sidebar Statistics

The sidebar panel shows:
- Word count
- Character count (with and without spaces)
- Estimated reading time
- Paragraph count
- Sentence count

### Action Buttons

- **Copy Stats**: Copies all statistics to clipboard in a formatted text block
- **Reset**: Recalculates statistics from current document content

### Selection Counting

When you select text in the editor, the plugin shows selection-specific word and character counts in a tooltip.

## API Integration

This plugin demonstrates several Lokus Plugin API features:

### Editor Integration
```javascript
// Listen for content changes
api.events.on('editor:content-change', this.handleContentChange);

// Get document content
const content = api.editor.getContent();

// Get selected text
const selection = api.editor.getSelection();
```

### UI Components
```javascript
// Create sidebar panel
const sidebar = api.ui.sidebar.create('word-count', {
  title: 'Word Count',
  position: 'right'
});

// Create status bar item
const statusBar = api.ui.statusbar.create('word-count', {
  position: 'right',
  priority: 10
});
```

### Settings Management
```javascript
// Load plugin settings
const settings = await api.settings.load();

// Settings are automatically managed through plugin.json
```

### Notifications
```javascript
// Show user notifications
api.notifications.show({
  type: 'success',
  title: 'Stats Copied',
  message: 'Statistics copied to clipboard',
  timeout: 2000
});
```

## Technical Implementation

### Text Processing

The plugin uses sophisticated text processing to accurately count words:

1. **HTML Stripping**: Removes HTML tags to get plain text
2. **Code Block Exclusion**: Optionally excludes code blocks from counts
3. **Whitespace Normalization**: Handles various whitespace characters
4. **Word Boundary Detection**: Uses regex patterns to identify word boundaries

### Performance Optimization

- **Debounced Updates**: Prevents excessive calculations during rapid typing
- **Efficient Text Extraction**: Optimized DOM manipulation for text content extraction
- **Minimal Re-rendering**: Only updates changed UI elements

### Text Statistics Algorithm

```javascript
// Word counting
const words = cleanText.split(/\s+/).filter(word => word.length > 0);

// Reading time calculation
const readingTime = Math.ceil(wordCount / wordsPerMinute);

// Paragraph detection
const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

// Sentence counting (approximate)
const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
```

## Customization

### Styling

The plugin includes comprehensive CSS that adapts to light and dark themes. You can customize the appearance by modifying the injected styles in `index.js`.

### Settings Schema

Add new settings by extending the `plugin.json` manifest:

```json
{
  "settings": {
    "newSetting": {
      "type": "boolean",
      "default": false,
      "label": "New Setting",
      "description": "Description of the new setting"
    }
  }
}
```

## Troubleshooting

### Plugin Not Loading
- Ensure `plugin.json` is valid JSON
- Check browser console for error messages
- Verify all required permissions are granted

### Incorrect Word Counts
- Check if "Exclude Code Blocks" setting affects your content
- Verify text extraction is working correctly for your document format

### Performance Issues
- Increase debounce delay in `setupEventListeners()`
- Consider disabling real-time updates for very large documents

## Development

### Plugin Structure
```
word-count-plugin/
├── plugin.json          # Plugin manifest and metadata
├── index.js            # Main plugin implementation
└── README.md           # Documentation (this file)
```

### Key Classes and Methods

- `WordCountPlugin`: Main plugin class
- `activate()`: Plugin initialization
- `updateCount()`: Core counting logic
- `calculateStats()`: Text analysis algorithms
- `setupUI()`: UI component creation

### Testing

To test this plugin during development:

1. Enable developer mode in Lokus
2. Load the plugin from the examples directory
3. Test with various document types and content
4. Verify statistics accuracy with known word counts

## License

This plugin is part of the Lokus examples and is provided under the same license as the main Lokus application.