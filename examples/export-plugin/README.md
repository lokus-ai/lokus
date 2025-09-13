# Document Export Plugin

A comprehensive document export plugin for Lokus that demonstrates file system operations, format conversion, and document generation capabilities.

## Features

- **Multiple Formats**: Export to PDF, HTML, Markdown, and plain text
- **Customizable Themes**: Multiple HTML themes (GitHub, Minimal, Elegant)
- **PDF Generation**: Print-ready PDF export using browser print API
- **Metadata Support**: Include document metadata in exports
- **Export History**: Track recent exports with details
- **Toolbar Integration**: Quick access export button
- **File Downloads**: Automatic file download handling
- **Settings Management**: Configurable export preferences

## Installation

1. Copy this plugin folder to your Lokus plugins directory
2. Enable the plugin in Lokus settings
3. Access export functions through commands, toolbar, or sidebar panel

## Usage

### Export Commands

Use these commands to export your document:
- `/export to-pdf` - Export to PDF (Ctrl+Shift+P)
- `/export to-html` - Export to HTML with styling
- `/export to-markdown` - Export to Markdown format
- `/export to-text` - Export to plain text
- `/export show-panel` - Show the export panel

### Export Panel

Access the Export panel from the sidebar or toolbar to:
- Choose export format with visual previews
- Configure export settings
- View document statistics
- Browse export history
- Apply settings like themes and metadata inclusion

### Supported Formats

#### PDF Export
- **Format**: Portable Document Format
- **Features**: Print-ready formatting, configurable margins
- **Method**: Uses browser print dialog (save as PDF)
- **Best for**: Sharing, printing, archival

#### HTML Export  
- **Format**: Web page with CSS styling
- **Features**: Multiple themes, responsive design
- **Themes**: GitHub, Minimal, Elegant
- **Best for**: Web publishing, styled viewing

#### Markdown Export
- **Format**: Plain text with Markdown syntax
- **Features**: Preserves formatting, portable
- **Conversion**: Intelligent HTML to Markdown conversion
- **Best for**: Documentation, version control

#### Plain Text Export
- **Format**: Simple text without formatting
- **Features**: Clean text extraction
- **Method**: Strips all HTML and formatting
- **Best for**: Simple sharing, word processing

## Configuration

### Settings

- **Default Export Path** (default: `""`): Default directory for exports
- **Include Metadata** (default: `true`): Add document metadata to exports  
- **PDF Margins** (default: `"1in"`): PDF margin size in CSS units
- **HTML Theme** (default: `"github"`): Theme for HTML exports
- **Open After Export** (default: `false`): Automatically open exported files

### Export Themes

#### GitHub Theme
- Clean, modern design inspired by GitHub
- Responsive layout with proper spacing
- Code syntax highlighting support
- Professional appearance

#### Minimal Theme
- Elegant serif typography
- Generous whitespace
- Simple, distraction-free design
- Perfect for reading

#### Elegant Theme
- Sophisticated design with custom fonts
- Centered layout with beautiful typography
- Rich styling with elegant accents
- Ideal for presentations and formal documents

## API Integration

This plugin demonstrates several advanced Lokus Plugin API features:

### File Operations
```javascript
// Download generated content
const blob = new Blob([content], { type: mimeType });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = filename;
link.click();
```

### Content Processing
```javascript
// Get editor content
const content = this.getEditorContent();

// Convert HTML to Markdown
const markdown = this.htmlToMarkdown(content);

// Strip HTML for plain text
const text = this.htmlToText(content);
```

### Settings Persistence
```javascript
// Save export history
await this.setSetting('exportHistory', history);

// Load theme preference
const theme = await this.getSetting('htmlTheme', 'github');
```

### UI Integration
```javascript
// Register toolbar button
this.registerToolbarButton({
  name: 'export-document',
  title: 'Export Document',
  icon: '📤',
  action: () => this.toggleExportPanel()
});
```

## Document Processing

### HTML to Markdown Conversion

The plugin includes a sophisticated HTML to Markdown converter that handles:
- Headers (h1-h6) → # ## ### etc.
- Bold/italic → **text** *text*
- Links → [text](url)
- Code blocks → ```code```
- Lists → - item
- Paragraphs and line breaks

### PDF Generation

PDF export uses the browser's print functionality:
1. Creates temporary HTML document
2. Opens print dialog
3. User selects "Save as PDF"
4. Applies custom print styles

For programmatic PDF generation, integrate libraries like:
- jsPDF for client-side generation
- Puppeteer for server-side rendering
- Print.js for enhanced print handling

### Content Extraction

Text extraction process:
1. Get HTML content from editor
2. Create temporary DOM element
3. Extract text content
4. Normalize whitespace
5. Apply format-specific processing

## Technical Implementation

### Architecture

```
export-plugin/
├── plugin.json          # Plugin manifest
├── index.js            # Main implementation  
└── README.md           # Documentation
```

### Key Components

- **Format Registry**: Manages supported export formats
- **Content Processor**: Handles format conversion
- **File Generator**: Creates downloadable files
- **Theme Engine**: Applies styling to HTML exports
- **History Manager**: Tracks export operations

### Export Flow

1. User selects export format
2. Plugin retrieves editor content
3. Content processed based on format
4. File generated with appropriate styling
5. Download initiated
6. Export recorded in history

### Error Handling

The plugin includes comprehensive error handling for:
- Empty documents
- Popup blockers
- File generation failures
- Permission issues
- Network problems

## Customization

### Adding New Export Formats

1. Define format in `initializeFormats()`:
```javascript
this.exportFormats.set('docx', {
  name: 'Word Document',
  extension: 'docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  description: 'Microsoft Word format',
  icon: '📝',
  handler: (content, filename) => this.exportToDocx(content, filename)
});
```

2. Implement handler method:
```javascript
async exportToDocx(content, filename) {
  // Convert content to DOCX format
  // Use library like docx.js
}
```

3. Register command:
```javascript
this.registerCommand({
  name: 'to-docx',
  description: 'Export to Word',
  action: () => this.exportDocument('docx')
});
```

### Creating Custom HTML Themes

Add new themes to `getHTMLThemeCSS()`:
```javascript
const themes = {
  // ... existing themes
  custom: `
    body {
      font-family: 'Your Font', sans-serif;
      background: #your-color;
      /* Custom styles */
    }
  `
};
```

### Extending Metadata

Modify `generateMetadata()` to include additional information:
```javascript
generateMetadata() {
  return `---
title: ${this.getDocumentTitle()}
author: ${this.getAuthor()}
tags: ${this.getTags()}
word_count: ${this.getWordCount()}
---`;
}
```

## Troubleshooting

### PDF Export Not Working
- Ensure popup blockers are disabled
- Check if browser supports print API
- Verify print dialog appears
- Try different browsers

### Files Not Downloading
- Check browser download settings
- Verify popup/download permissions
- Test with different file sizes
- Clear browser cache

### HTML Export Issues
- Validate HTML content structure
- Check CSS theme application
- Test with different content types
- Verify theme selection

### Format Conversion Problems
- Test with simple content first
- Check HTML structure validity
- Verify regex patterns in converters
- Debug with console logging

## Performance Considerations

### Large Documents
- Implement streaming for large files
- Show progress indicators
- Add cancellation support
- Optimize conversion algorithms

### Memory Usage
- Clean up temporary objects
- Release blob URLs after download
- Limit export history size
- Monitor memory consumption

## Development

### Testing

Test the plugin with various content types:
- Plain text documents
- Rich formatted content
- Code blocks and syntax
- Tables and lists
- Images and media
- Very large documents

### Debugging

Use browser developer tools to:
- Monitor file generation
- Debug conversion algorithms
- Test download mechanisms
- Verify theme application

## License

This plugin is part of the Lokus examples and is provided under the same license as the main Lokus application.