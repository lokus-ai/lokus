# Template System

The Template System provides a powerful way to create, manage, and use reusable content templates directly within Lokus. Templates support dynamic variables, smart markdown compilation, and seamless integration with the Command Palette for an efficient workflow.

## Overview

The Template System allows you to:
- Create templates from selected text or entire files
- Use built-in variables for dynamic content (dates, user info, etc.)
- Access templates instantly through the Command Palette
- Smart markdown compilation for rich content
- Organize templates by categories and tags
- Live preview templates before saving

## Core Features

### Universal Markdown Compiler
The template system uses a sophisticated markdown compiler that works independently of TipTap:

- **Intelligent Detection**: Automatically detects markdown content using pattern matching
- **Aggressive Processing**: Configurable detection sensitivity for different content types
- **Rich Format Support**: Supports all standard markdown plus extensions like highlights (`==text==`) and strikethrough (`~~text~~`)
- **Template Variables**: Preserves special placeholders like `{{cursor}}` during compilation
- **Fallback Safety**: Returns original content if compilation fails

### Built-in Variables
Templates automatically have access to a comprehensive set of built-in variables:

#### Date & Time Variables
- `{{date}}` - Current date in local format
- `{{time}}` - Current time in local format  
- `{{datetime}}` - Current date and time
- `{{isodate}}` - ISO date format (YYYY-MM-DD)
- `{{date.short}}` - Short format (e.g., Jan 1, 2023)
- `{{date.long}}` - Long format (e.g., Monday, January 1, 2023)
- `{{date.year}}`, `{{date.month}}`, `{{date.day}}` - Individual components
- `{{date.weekday}}` - Day of the week

#### Content Variables
- `{{cursor}}` - Cursor position placeholder
- `{{selection}}` - Selected text placeholder
- `{{title}}` - Document title
- `{{filename}}` - Current file name
- `{{filepath}}` - Current file path

#### System & Utility Variables
- `{{user}}` - Current username
- `{{uuid}}` - Random UUID
- `{{random}}` - Random number (0-1)
- `{{randomInt}}` - Random integer (0-99)
- `{{app.name}}` - Application name
- `{{app.version}}` - Application version

## Template Creation Workflow

### Creating Templates from Selection

1. **Select Content**: Highlight the text you want to use as a template
2. **Open Command Palette**: Press `⌘K` (macOS) / `Ctrl+K` (Windows/Linux)
3. **Choose Save as Template**: Type "Save as Template" and select the command
4. **Configure Template**: Fill in the template details in the creation dialog

### Creating Templates from Full File

1. **Open Command Palette**: Press `⌘K` without selecting any text
2. **Choose Save as Template**: The entire file content will be used
3. **Configure Template**: Set up your template in the creation dialog

### Template Creation Dialog

The creation dialog provides:

#### Left Panel - Configuration
- **Template Name**: Required field for the template identifier
- **Category**: Organize templates (Personal, Work, Documentation, Notes, Projects)
- **Tags**: Comma-separated tags for better organization
- **Content**: The template content with variable support

#### Right Panel - Live Preview
- **Real-time Preview**: See how your template will look when compiled
- **Markdown Rendering**: Shows the final formatted output
- **Toggle View**: Show/hide preview as needed

## Using Templates

### Command Palette Integration

Templates are directly accessible through the Command Palette:

1. **Open Command Palette**: `⌘K` (macOS) / `Ctrl+K` (Windows/Linux)
2. **Search Templates**: Type "template" to see all available templates
3. **Individual Commands**: Each template appears as "Template: [Name]"
4. **Category Tags**: Templates show their category as a shortcut tag
5. **Instant Access**: Select any template to insert it immediately

### Template Processing

When you select a template:
1. **Variable Resolution**: All built-in variables are automatically resolved
2. **Markdown Compilation**: Content is processed through the universal compiler
3. **Cursor Positioning**: `{{cursor}}` placeholder positions your cursor
4. **Content Insertion**: Processed content is inserted at the current editor position

## Template Management

### Storage and Organization
- Templates are stored in the application's data directory
- Organized by categories for easy browsing
- Support for custom categories through the creation dialog
- Persistent across application sessions

### Command History
- Template usage is tracked in Command Palette history
- Recent templates appear in the history section
- Quick access to frequently used templates
- Individual history item removal supported

## Advanced Features

### Smart Markdown Detection

The Universal Markdown Compiler uses sophisticated detection:

```javascript
// Explicit markdown patterns
- **bold**, *italic*, ~~strikethrough~~
- ==highlights==, `code`, # headings
- > blockquotes, - lists, 1. numbered lists
- [links](url), ```code blocks```
- | tables |, - [x] task lists

// Likelihood scoring for ambiguous content
- Multi-line content analysis
- Structure pattern recognition
- Length-based scoring
- Configurable sensitivity
```

### Template Variables Support

Templates preserve special variables during processing:

```markdown
# {{title || "Default Title"}}

**Created:** {{date}}  
**By:** {{user}}

## Content
{{cursor}}

---
*Template ID: {{uuid}}*
```

### Integration Points

#### Editor Integration
- Selection-based template creation
- Smart content detection for templates vs regular text
- Cursor positioning after template insertion
- Undo/redo support for template operations

#### File System Integration
- Template creation from any file type
- Preservation of file context in variables
- Cross-file template usage
- Backup and restore capabilities

## Performance Considerations

### Optimization Features
- **Lazy Loading**: Templates loaded only when needed
- **Caching**: Compiled templates cached for repeated use
- **Efficient Search**: Fast template lookup in Command Palette
- **Minimal Memory**: Lightweight template storage format

### Large Template Handling
- Support for templates of any size
- Streaming compilation for large content
- Progressive rendering in preview
- Memory-efficient variable resolution

## Accessibility

### Keyboard Navigation
- Full keyboard support for template creation
- Accessible Command Palette integration
- Screen reader compatible dialogs
- Focus management in creation workflow

### Visual Accessibility
- High contrast support in preview panel
- Scalable interface elements
- Clear visual hierarchy in organization
- Icon alternatives with text labels

## Best Practices

### Template Design
1. **Use Descriptive Names**: Make templates easy to find in Command Palette
2. **Leverage Categories**: Organize templates logically by use case
3. **Include {{cursor}}**: Always indicate where user input should go
4. **Add Context Variables**: Use `{{date}}`, `{{user}}` for automatic context
5. **Test Preview**: Always preview templates before saving

### Variable Usage
1. **Built-in First**: Use built-in variables before creating custom ones
2. **Fallback Values**: Use `{{title || "Default"}}` pattern for robustness
3. **Cursor Placement**: Strategic `{{cursor}}` positioning for best UX
4. **Date Formatting**: Choose appropriate date format for your use case

### Organization Tips
1. **Consistent Naming**: Use clear, searchable template names
2. **Category Strategy**: Group related templates in same category
3. **Tag Effectively**: Use tags for cross-category organization
4. **Regular Cleanup**: Remove unused templates periodically

## Integration with Other Features

### Command Palette
- **Unified Search**: Templates appear alongside files and commands
- **History Tracking**: Template usage tracked with other commands
- **Keyboard Shortcuts**: Same shortcuts work for template access
- **Quick Switching**: Seamless transition between templates and files

### Markdown System
- **Shared Compiler**: Same engine powers paste and templates
- **Consistent Rendering**: Templates render exactly like pasted markdown
- **Extension Support**: All markdown extensions available in templates
- **Format Preservation**: Rich formatting maintained through compilation

### File Management
- **Context Awareness**: Templates understand current file context
- **Cross-File Usage**: Use templates in any file type
- **Workspace Integration**: Templates work across entire workspace
- **Backup Support**: Templates included in workspace backup/restore

## Troubleshooting

### Common Issues

**Template not appearing in Command Palette:**
- Verify template was saved successfully
- Check template name for special characters
- Ensure application restart if needed
- Verify template storage permissions

**Variables not resolving:**
- Check variable syntax (use `{{variable}}` format)
- Verify built-in variable names are correct
- Ensure proper template processing is enabled
- Check console for variable resolution errors

**Preview not showing correctly:**
- Verify markdown syntax in template content
- Check for conflicting HTML in content
- Ensure preview panel is visible
- Try toggling preview on/off

**Template creation fails:**
- Ensure both name and content are provided
- Check for invalid characters in template name
- Verify sufficient storage space
- Check application permissions

### Performance Issues

**Slow template creation:**
- Large content may take time to process
- Preview compilation is resource-intensive
- Consider breaking very large templates into smaller ones
- Use preview sparingly for complex content

**Command Palette lag with many templates:**
- Template search is optimized but may slow with hundreds of templates
- Consider organizing templates with clear naming patterns
- Use categories to group related templates
- Regular cleanup of unused templates

## Related Features

- **[Command Palette](./command-palette.md)** - Primary template access method
- **[Markdown System](./markdown-system.md)** - Underlying content processing
- **[File Management](./file-management.md)** - Workspace file operations
- **[Editor Features](./editor.md)** - Rich text editing capabilities

## API Reference

### Template Object Structure
```javascript
{
  id: "template-id",
  name: "Template Name",
  content: "Template content with {{variables}}",
  category: "Personal",
  tags: ["tag1", "tag2"],
  metadata: {
    description: "Template description",
    createdBy: "user",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z"
  }
}
```

### Built-in Variable Categories
- **Date**: Date and time related variables
- **Content**: Document and cursor positioning
- **System**: User and environment information  
- **Utility**: Random values and identifiers
- **Application**: Lokus-specific information
- **Document**: Current file context