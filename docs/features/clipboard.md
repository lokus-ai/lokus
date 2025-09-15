# Clipboard Integration

Lokus features intelligent clipboard integration that provides smart paste functionality, automatic format conversion, and seamless content transfer between applications. The clipboard system enhances productivity by understanding content types and applying appropriate transformations.

## Overview

The clipboard system provides:
- **Smart paste detection** - Automatically detects and converts pasted content types
- **Format preservation** - Maintains rich formatting from external applications
- **Markdown conversion** - Converts HTML and rich text to clean markdown
- **Image handling** - Paste images directly into notes
- **Table conversion** - Convert spreadsheet data to markdown tables
- **Code block detection** - Automatically format pasted code

## Smart Paste Features

### Automatic Format Detection
The system analyzes clipboard content and applies appropriate transformations:

#### HTML to Markdown Conversion
When pasting from web browsers or rich text applications:
- **Heading Conversion** - `<h1>` becomes `# Heading`
- **Text Formatting** - `<strong>` becomes `**bold**`, `<em>` becomes `*italic*`
- **Link Preservation** - `<a href="...">` becomes `[text](url)`
- **List Conversion** - `<ul>/<ol>` becomes markdown lists
- **Code Blocks** - `<pre><code>` becomes fenced code blocks
- **Clean Output** - Removes unnecessary HTML tags and attributes

#### Rich Text Processing
Content from word processors and text editors:
- **Style Mapping** - Maps rich text styles to markdown equivalents
- **Font Formatting** - Converts bold, italic, underline to markdown
- **Paragraph Handling** - Preserves paragraph structure
- **Table Conversion** - Converts formatted tables to markdown tables

#### Plain Text Enhancement
Even plain text gets intelligent processing:
- **URL Detection** - Converts URLs to clickable links
- **List Recognition** - Detects and formats lists properly
- **Code Detection** - Recognizes and formats code snippets
- **Structure Analysis** - Identifies headers and sections

### Content Type Handlers

#### Web Content
Pasting from websites and web applications:
- **Article Text** - Extracts main content, removes navigation/ads
- **Code Snippets** - Preserves syntax highlighting information
- **Documentation** - Maintains structure of technical documentation
- **Social Media** - Formats tweets, posts with proper attribution

#### Spreadsheet Data
Pasting from Excel, Google Sheets, Numbers:
- **Table Generation** - Creates markdown tables automatically
- **Column Alignment** - Preserves column alignment preferences
- **Header Detection** - Identifies and formats header rows
- **Data Type Preservation** - Maintains numbers, dates, formulas as text

#### Code and Development
Pasting from IDEs and development tools:
- **Language Detection** - Identifies programming language automatically
- **Syntax Highlighting** - Applies appropriate syntax highlighting
- **Indentation Preservation** - Maintains code indentation
- **Comment Handling** - Preserves code comments and documentation

## Image and Media Handling

### Image Pasting
Direct image paste support from various sources:
- **Screenshot Paste** - Paste screenshots directly from clipboard
- **Image Files** - Paste images copied from file managers
- **Web Images** - Paste images from web browsers
- **Application Images** - Paste from image editing applications

### Image Processing
Automatic image optimization and handling:
- **Format Conversion** - Convert to web-friendly formats (PNG, JPEG)
- **Size Optimization** - Compress images for better performance
- **Local Storage** - Save images to workspace automatically
- **Alt Text Generation** - Prompt for accessibility alt text
- **Caption Support** - Add captions below images

### File Attachment
Handle various file types pasted from system:
- **Document Files** - PDF, Word documents, presentations
- **Media Files** - Audio, video files
- **Archive Files** - ZIP, RAR archives
- **Link Generation** - Create links to attached files

## Advanced Paste Features

### Contextual Pasting
Smart pasting based on cursor context:
- **In Tables** - Paste data as new table rows/columns
- **In Code Blocks** - Paste as code without markdown conversion
- **In Math Mode** - Paste LaTeX expressions directly
- **In Lists** - Extend existing lists with pasted items

### Batch Paste Operations
Handle multiple items from clipboard:
- **Multiple Images** - Paste several images as gallery
- **File Collections** - Paste multiple files as attachment list
- **URL Collections** - Convert multiple URLs to link list
- **Text Blocks** - Paste multiple text items as separate sections

### Paste History
Track and reuse clipboard history:
- **Recent Pastes** - Access recently pasted content
- **Paste Variants** - Different format options for same content
- **Search History** - Search through paste history
- **Favorites** - Mark frequently used paste items

## Markdown Compiler Integration

### Universal Markdown Processing
The clipboard system uses the same markdown compiler as templates:
- **Consistent Processing** - Same conversion rules across features
- **Extension Support** - Supports all markdown extensions
- **Variable Preservation** - Preserves template variables in pasted content
- **Error Handling** - Graceful handling of invalid markdown

### Paste Configuration
Customize paste behavior:
- **Aggressiveness Settings** - Control how aggressive markdown conversion is
- **Format Preferences** - Choose preferred formats for ambiguous content
- **Auto-detection Sensitivity** - Adjust content type detection sensitivity
- **Fallback Behavior** - What to do when detection fails

### Processing Pipeline
Multi-stage content processing:
1. **Content Analysis** - Analyze clipboard content type and structure
2. **Format Detection** - Determine source format and target conversion
3. **Preprocessing** - Clean and prepare content for conversion
4. **Conversion** - Apply appropriate format transformations
5. **Postprocessing** - Final cleanup and optimization
6. **Insertion** - Insert processed content into editor

## Clipboard Operations

### Copy Operations
Enhanced copying from within Lokus:
- **Rich Copy** - Copy with formatting preserved
- **Markdown Copy** - Copy as clean markdown source
- **HTML Copy** - Copy as formatted HTML
- **Plain Text Copy** - Copy without any formatting

### Cut Operations
Advanced cut functionality:
- **Selection Cut** - Cut selected text with formatting
- **Block Cut** - Cut entire blocks (paragraphs, lists, etc.)
- **Structured Cut** - Cut maintaining document structure
- **Undo Support** - Full undo support for cut operations

### Multiple Clipboard Support
Work with multiple clipboard items:
- **Clipboard Ring** - Cycle through multiple copied items
- **Named Clipboards** - Save content to named clipboard slots
- **Clipboard Manager** - Visual interface for clipboard management
- **Cross-session Persistence** - Clipboard content persists across sessions

## Integration with Other Features

### Template System Integration
Clipboard works seamlessly with templates:
- **Template Variables** - Paste content with template variable processing
- **Template Creation** - Create templates from clipboard content
- **Variable Detection** - Detect potential variables in pasted content
- **Smart Replacement** - Replace content with template placeholders

### Search Integration
Find and work with clipboard content:
- **Content Search** - Search within clipboard history
- **Pattern Matching** - Find clipboard items matching patterns
- **Metadata Search** - Search by source, date, content type
- **Quick Access** - Quickly access recent clipboard items

### File System Integration
Clipboard operations with file system:
- **File Path Copying** - Copy file paths to clipboard
- **File Content Paste** - Paste file contents directly
- **Bulk File Operations** - Copy/paste multiple files
- **File Metadata** - Include file metadata in paste operations

## Performance and Optimization

### Large Content Handling
Efficiently handle large clipboard content:
- **Streaming Processing** - Process large content in chunks
- **Background Conversion** - Convert content in background
- **Memory Management** - Efficient memory usage for large pastes
- **Progress Indication** - Show progress for long operations

### Cache Management
Optimize clipboard performance:
- **Conversion Caching** - Cache converted content for reuse
- **History Optimization** - Optimize clipboard history storage
- **Memory Limits** - Prevent memory issues with large history
- **Cleanup Strategies** - Automatic cleanup of old clipboard data

### Real-time Processing
Responsive clipboard operations:
- **Instant Preview** - Preview paste results before confirming
- **Incremental Processing** - Process content as it's typed
- **Debounced Operations** - Prevent excessive processing
- **User Feedback** - Immediate feedback on paste operations

## Security and Privacy

### Content Sanitization
Ensure pasted content is safe:
- **Script Removal** - Remove potentially harmful scripts
- **Link Validation** - Validate and sanitize URLs
- **Content Filtering** - Filter out suspicious content
- **Safe Defaults** - Use safe defaults for unknown content

### Privacy Protection
Protect sensitive information:
- **Sensitive Data Detection** - Detect and warn about sensitive data
- **Content Masking** - Option to mask sensitive clipboard content
- **History Encryption** - Encrypt clipboard history storage
- **Automatic Cleanup** - Clear sensitive content automatically

### Permission Management
Control clipboard access:
- **Clipboard Permissions** - Request appropriate clipboard permissions
- **Content Type Restrictions** - Restrict certain content types
- **Application Restrictions** - Control which apps can access clipboard
- **User Consent** - Get user consent for sensitive operations

## Accessibility

### Keyboard Operations
Full keyboard support for clipboard operations:
- **Standard Shortcuts** - `Ctrl+C`, `Ctrl+V`, `Ctrl+X` work as expected
- **Enhanced Shortcuts** - Additional shortcuts for advanced operations
- **Context-aware** - Shortcuts adapt to current context
- **Customizable** - Allow customization of clipboard shortcuts

### Screen Reader Support
Accessibility for clipboard operations:
- **Operation Announcements** - Announce clipboard operations
- **Content Descriptions** - Describe clipboard content types
- **Status Updates** - Announce processing status
- **Error Reporting** - Accessible error messages

### Visual Accessibility
Visual aids for clipboard operations:
- **Paste Indicators** - Visual indicators for paste operations
- **Format Preview** - Preview how content will appear
- **High Contrast** - High contrast support for clipboard UI
- **Progress Indicators** - Visual progress for long operations

## Troubleshooting

### Common Issues

**Paste not working:**
- Check clipboard permissions in browser/system
- Verify content is actually in clipboard
- Try pasting as plain text first
- Check for JavaScript errors in console

**Formatting lost during paste:**
- Check paste format settings in preferences
- Try different paste options (rich text vs markdown)
- Verify source application copied with formatting
- Check if content type is supported

**Images not pasting:**
- Verify browser supports image paste operations
- Check available disk space for image storage
- Try copying image differently from source
- Check image format compatibility

**Performance issues with large paste:**
- Break large content into smaller pieces
- Check available system memory
- Disable real-time processing for large content
- Try pasting as plain text for faster processing

### Best Practices
1. **Test paste behavior** - Try paste operations with different content types
2. **Use appropriate formats** - Choose right format for your content type
3. **Check results** - Review pasted content for accuracy
4. **Customize settings** - Adjust paste settings for your workflow
5. **Monitor performance** - Watch for performance impact with large pastes

## Advanced Configuration

### Paste Preferences
Customize clipboard behavior in preferences:
- **Default Paste Format** - Choose default format for ambiguous content
- **Auto-detection Settings** - Configure content type detection
- **Processing Options** - Enable/disable specific processing features
- **Performance Settings** - Adjust performance vs. quality trade-offs

### Custom Handlers
Advanced users can configure custom handlers:
- **Content Type Handlers** - Custom handlers for specific content types
- **Format Converters** - Custom format conversion rules
- **Processing Hooks** - Custom processing steps
- **Integration Scripts** - Scripts for external tool integration

## Related Features

- **[Editor](./editor.md)** - Rich text editing with paste support
- **[Template System](./template-system.md)** - Template creation from clipboard
- **[Markdown Compiler](./markdown-compiler.md)** - Content processing engine
- **[File Management](./file-management.md)** - File operations and attachments

---

*For technical clipboard implementation details, see the [Clipboard API Documentation](../api/clipboard.md).*