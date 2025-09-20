# Lokus Editor Tools for MCP

Comprehensive editor tools that integrate with Lokus's TipTap editor through the Model Context Protocol (MCP). These tools provide direct manipulation of the editor content, formatting, and functionality.

## Overview

The editor tools bridge MCP clients with Lokus's rich text editor, enabling AI assistants and external tools to:

- Apply text formatting (bold, italic, strikethrough, etc.)
- Insert rich content (math equations, tables, code blocks)
- Create interactive elements (task lists, wiki links)
- Query editor state and selection
- Export document content in various formats

## Available Tools

### 1. `format_text`
Apply text formatting to selected text or insert formatted text.

**Supported formats:**
- `bold` - Bold text
- `italic` - Italic text  
- `strikethrough` - ~~Strikethrough~~ text
- `highlight` - ==Highlighted== text (with optional color)
- `superscript` - Text^superscript^
- `subscript` - Text~subscript~
- `code` - `Inline code`
- `clear` - Remove all formatting

**Example:**
```javascript
{
  "format": "bold",
  "text": "Important message",
  "color": "#ffff00" // optional, for highlights
}
```

### 2. `insert_link`
Insert wiki links or regular hyperlinks.

**Link types:**
- `wiki` - Lokus wiki links `[[Page Name]]`
- `regular` - Standard hyperlinks

**Example:**
```javascript
{
  "type": "wiki",
  "target": "Meeting Notes",
  "text": "Today's meeting", // optional display text
  "embed": false // optional, for image embeds
}
```

### 3. `insert_math`
Insert KaTeX mathematical equations.

**Display modes:**
- `inline` - Inline math $E=mc^2$
- `block` - Block math $$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$

**Example:**
```javascript
{
  "formula": "\\frac{d}{dx}[x^2] = 2x",
  "display": "block"
}
```

### 4. `insert_table`
Create and manipulate tables.

**Actions:**
- `create` - Create new table
- `addRow` - Add row after current
- `addColumn` - Add column after current
- `deleteRow` - Delete current row
- `deleteColumn` - Delete current column

**Example:**
```javascript
{
  "action": "create",
  "rows": 4,
  "cols": 3,
  "withHeaderRow": true
}
```

### 5. `insert_code_block`
Insert syntax-highlighted code blocks.

**Example:**
```javascript
{
  "code": "function hello() {\n  console.log('Hello, World!');\n}",
  "language": "javascript"
}
```

### 6. `create_task_list`
Create interactive checkbox task lists.

**Example:**
```javascript
{
  "tasks": [
    { "text": "Complete project setup", "checked": true },
    { "text": "Write documentation", "checked": false },
    { "text": "Deploy to production", "checked": false }
  ]
}
```

### 7. `get_selection`
Get current editor selection and cursor information.

**Returns:**
- Selection range (from/to positions)
- Selected text content
- Current node type and attributes
- Active formatting marks

**Example:**
```javascript
{} // No parameters needed
```

### 8. `replace_selection`
Replace selected text or insert content at cursor.

**Content types:**
- `text` - Plain text
- `html` - HTML content
- `markdown` - Markdown (converted to HTML)

**Example:**
```javascript
{
  "content": "# New Section\n\nThis is **important** content.",
  "contentType": "markdown",
  "selectNew": false
}
```

### 9. `get_document_stats`
Get document statistics and metrics.

**Returns:**
- Character count (with/without spaces)
- Word count
- Sentence count
- Paragraph count
- Estimated reading time

**Example:**
```javascript
{
  "includeSpaces": true
}
```

### 10. `export_document`
Export document content in various formats.

**Formats:**
- `markdown` - Markdown text
- `html` - HTML content
- `text` - Plain text
- `json` - TipTap JSON structure

**Example:**
```javascript
{
  "format": "markdown",
  "includeMetadata": true
}
```

## Integration

### Basic Usage

```javascript
import { editorTools } from './editorTools.js';
import { registerEditorTools } from './editorToolsDemo.js';

// Register with MCP server
registerEditorTools(mcpServer);

// Use individual tools
const result = await editorTools.find(t => t.name === 'format_text')
  .handler({ format: 'bold', text: 'Hello World' });
```

### Plugin Integration

```javascript
import { EditorToolsPlugin } from './editorToolsDemo.js';

// In your plugin
class MyPlugin extends BasePlugin {
  async onActivated() {
    this.editorTools = new EditorToolsPlugin(this.pluginAPI);
    await this.editorTools.initialize();
  }
  
  async onDeactivated() {
    this.editorTools.dispose();
  }
}
```

### MCP Client Usage

```javascript
// From an MCP client
const response = await mcpClient.callTool('format_text', {
  format: 'bold',
  text: 'Important note'
});

console.log(response.content[0].text); // "Applied bold formatting to 'Important note'"
```

## Architecture

### Editor Instance Access

The tools automatically discover the active TipTap editor instance through multiple fallback methods:

1. Global `__LOKUS_EDITOR_INSTANCE__`
2. Plugin API `editorAPI.getEditorInstance()`
3. DOM element lookup (`.tiptap-area`)

### Command Execution

- All commands use TipTap's chain API for atomic operations
- Commands include retry logic and graceful fallbacks
- Undo/redo integration is maintained automatically

### Error Handling

- Comprehensive error handling with descriptive messages
- Graceful fallbacks for missing extensions
- All responses follow MCP content format

## Dependencies

### Required Extensions

The tools work with Lokus's standard TipTap extensions:

- **StarterKit** - Basic formatting and structure
- **Math** - Inline and block math equations  
- **WikiLink** - Wiki-style links and embeds
- **TaskList/TaskItem** - Interactive checkboxes
- **Table extensions** - Table creation and manipulation
- **Highlight** - Text highlighting with colors
- **Superscript/Subscript** - Text positioning

### Optional Features

- **Markdown compiler** - For markdown content processing
- **Syntax highlighting** - For code block languages
- **File index** - For wiki link suggestions

## Testing

```javascript
import { testEditorTools } from './editorToolsDemo.js';

// Test all tools with example data
const results = await testEditorTools();
console.log(`${results.successful}/${results.total} tools passed`);
```

## Security Considerations

- All content is processed through TipTap's secure parsing
- HTML content is sanitized by the editor
- Math equations use KaTeX's safe rendering
- File operations respect workspace boundaries

## Performance

- Tools use lazy loading for markdown compiler
- Commands are optimized for minimal re-renders
- Selection operations are performed synchronously
- Export operations are streaming-compatible

## Browser Compatibility

- Modern browsers with ES2020+ support
- TipTap editor compatibility
- KaTeX math rendering support
- File API for export functionality

## Contributing

When adding new editor tools:

1. Follow the existing tool structure
2. Include comprehensive input validation
3. Provide meaningful error messages
4. Add usage examples to demo file
5. Test with actual TipTap editor instance
6. Document any new dependencies

---

*Part of the Lokus Editor ecosystem - enabling rich text editing through MCP integration.*