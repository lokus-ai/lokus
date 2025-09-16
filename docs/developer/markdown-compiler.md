# Universal Markdown Compiler

The Universal Markdown Compiler is a sophisticated middleware system that provides intelligent markdown detection and compilation capabilities across the entire Lokus application. It operates independently of TipTap to ensure reliable and consistent markdown processing for both paste operations and template systems.

## Architecture Overview

The compiler follows a middleware pattern that can be used by any component requiring markdown processing:

```javascript
import { getMarkdownCompiler } from '../core/markdown/compiler.js'

const compiler = getMarkdownCompiler()
const html = compiler.process(text)
```

## Core Components

### MarkdownCompiler Class

The main compiler class provides the core functionality:

```javascript
export class MarkdownCompiler {
  constructor(options = {}) {
    // Initialize MarkdownIt with custom configuration
    this.md = new MarkdownIt({
      html: true,           // Enable HTML tags
      linkify: true,        // Auto-convert URLs to links
      typographer: true,    // Smart quotes and dashes
      breaks: true,         // Convert line breaks
      ...options.markdownIt
    })
      .use(markdownItMark)           // ==highlight== support
      .use(markdownItStrikethrough)  // ~~strikethrough~~ support
    
    this.options = {
      aggressive: true,    // Aggressively detect markdown
      minLength: 5,       // Minimum text length to process
      debugLogs: true,    // Show debug information
      ...options
    }
  }
}
```

### Singleton Pattern

The compiler uses a singleton pattern to ensure consistent behavior across the application:

```javascript
let compiler = null

export function getMarkdownCompiler(options = {}) {
  if (!compiler) {
    compiler = new MarkdownCompiler(options)
  }
  return compiler
}
```

## Intelligent Markdown Detection

### Explicit Pattern Matching

The compiler uses a comprehensive set of patterns to detect explicit markdown syntax:

```javascript
const explicitPatterns = [
  /\*\*[^*]+\*\*/,        // **bold**
  /\*[^*]+\*/,            // *italic*
  /~~[^~]+~~/,            // ~~strikethrough~~
  /==[^=]+=/,             // ==highlight==
  /`[^`]+`/,              // `code`
  /^#{1,6}\s/m,           // # headings (space required)
  /^>\s/m,                // > blockquotes
  /^[-*+]\s/m,            // - lists
  /^\d+\.\s/m,            // 1. numbered lists
  /^\|.+\|/m,             // | table |
  /\[[^\]]*\]\([^)]*\)/,  // [link](url)
  /```[\s\S]*?```/,       // ```code blocks```
  /^\s*- \[[x\s]\]/m,     // - [x] task lists
]
```

### Likelihood Scoring System

For ambiguous content, the compiler uses a sophisticated scoring system:

```javascript
// Multi-line content analysis
const lineCount = text.split('\n').length
if (lineCount > 2) score += 2
if (lineCount > 5) score += 2

// Length-based scoring
if (text.length > 50) score += 1
if (text.length > 200) score += 1

// Structure pattern recognition
if (/\n\s*\n/.test(text)) score += 2  // Double line breaks
if (/^[A-Z][^\n]*$/m.test(text)) score += 1  // Lines starting with capitals
if (/\w+:\s*\w+/.test(text)) score += 1  // Key-value pairs

// Aggressive mode bonus
if (this.options.aggressive && lineCount > 1 && text.length > 20) {
  score += 3
}
```

### Detection Modes

The compiler supports different detection sensitivity levels:

- **Aggressive Mode** (default): Processes most multi-line content with minimal markdown indicators
- **Conservative Mode**: Only processes content with explicit markdown patterns
- **Custom Threshold**: Configurable scoring threshold for detection

## Template-Specific Processing

### Cursor Placeholder Handling

The compiler provides special handling for template cursor placeholders:

```javascript
processTemplate(content) {
  const cursorPlaceholder = '{{cursor}}'
  const hasCursor = content.includes(cursorPlaceholder)
  
  if (hasCursor) {
    // Process parts separately to preserve cursor position
    const parts = content.split(cursorPlaceholder)
    const processedParts = parts.map(part => this.process(part))
    return processedParts.join(cursorPlaceholder)
  }
  
  return this.process(content)
}
```

### Variable Preservation

Template variables are preserved during compilation:
- `{{cursor}}` - Cursor position marker
- `{{selection}}` - Selected text placeholder  
- `{{variable}}` - Any template variable

## Integration Points

### Paste System Integration

The compiler is integrated with the markdown paste extension:

```javascript
// In MarkdownPaste extension
import { getMarkdownCompiler } from '../../core/markdown/compiler.js'

const compiler = getMarkdownCompiler()

if (text) {
  // Check if HTML is actually rich content or just bloated markup
  if (html && html.trim()) {
    const isMarkdownText = compiler.isMarkdown(text)
    const htmlTextRatio = html.length / (text?.length || 1)
    
    // If text is clearly markdown, process it even if HTML is present
    if (isMarkdownText) {
      console.log('[MarkdownPaste] Processing as markdown')
      const processedHtml = compiler.compile(text)
      
      // Insert processed HTML
      editor.commands.insertContent(processedHtml)
      return true
    }
  }
}
```

### Template System Integration

Templates use the compiler for content processing:

```javascript
// In CreateTemplate component
import { getMarkdownCompiler } from '../core/markdown/compiler.js'

const getPreview = () => {
  if (!content) return 'No content to preview'
  
  try {
    const compiler = getMarkdownCompiler()
    return compiler.process(content)
  } catch (err) {
    return content // Fallback to raw content
  }
}
```

## Configuration Options

### MarkdownIt Configuration

```javascript
const compiler = new MarkdownCompiler({
  markdownIt: {
    html: true,           // Allow HTML tags
    linkify: true,        // Auto-convert URLs
    typographer: true,    // Smart quotes
    breaks: true,         // Line break conversion
    quotes: '""''',       // Quote characters
    langPrefix: 'language-', // CSS class prefix for code blocks
  }
})
```

### Compiler Options

```javascript
const compiler = new MarkdownCompiler({
  aggressive: true,       // Aggressive detection mode
  minLength: 5,          // Minimum text length to process
  debugLogs: true,       // Enable debug logging
})
```

## Performance Characteristics

### Optimization Features
- **Singleton Pattern**: Single instance across application
- **Lazy Initialization**: Compiler created only when needed
- **Efficient Patterns**: Optimized regex patterns for detection
- **Minimal Processing**: Only processes detected markdown content

### Memory Management
- **Shared Instance**: Reduces memory footprint
- **Pattern Caching**: Compiled regex patterns cached
- **Cleanup Handling**: Proper error handling prevents memory leaks

## Debugging and Logging

### Debug Output

When `debugLogs` is enabled, the compiler provides detailed logging:

```javascript
log(...args) {
  if (this.options.debugLogs) {
    console.log('[MarkdownCompiler]', ...args)
  }
}

// Example output:
// [MarkdownCompiler] Explicit markdown detected
// [MarkdownCompiler] Markdown likelihood score: 5/3, likely: true
// [MarkdownCompiler] Compiling markdown: # Hello World...
// [MarkdownCompiler] Compiled HTML: <h1>Hello World</h1>...
```

### Error Handling

The compiler includes robust error handling:

```javascript
compile(text) {
  try {
    const html = this.md.render(text)
    return html
  } catch (error) {
    console.error('[MarkdownCompiler] Compilation failed:', error)
    return text // Fallback to original text
  }
}
```

## Extension Support

### Current Extensions
- **markdown-it-mark**: Highlight (`==text==`) support
- **markdown-it-strikethrough-alt**: Enhanced strikethrough (`~~text~~`)

### Adding New Extensions

```javascript
constructor(options = {}) {
  this.md = new MarkdownIt(config)
    .use(markdownItMark)
    .use(markdownItStrikethrough)
    .use(newExtension, extensionOptions) // Add new extension
}
```

## Testing Strategy

### Unit Testing Areas
- Markdown detection accuracy
- Compilation output verification
- Template variable preservation
- Error handling robustness
- Performance benchmarks

### Integration Testing
- Paste system integration
- Template system integration
- Cross-component consistency
- Memory usage patterns

## Best Practices

### Usage Guidelines
1. **Use Singleton**: Always use `getMarkdownCompiler()` for consistency
2. **Handle Errors**: Wrap compilation in try-catch blocks
3. **Test Detection**: Verify detection logic for edge cases
4. **Debug Logging**: Enable logging during development
5. **Performance Monitoring**: Monitor compilation performance for large content

### Performance Tips
1. **Batch Processing**: Process multiple items in batches when possible
2. **Cache Results**: Cache compiled results for repeated content
3. **Limit Input Size**: Consider size limits for very large content
4. **Async Processing**: Use async processing for large compilations

### Security Considerations
1. **Input Validation**: Validate input before processing
2. **HTML Sanitization**: Consider HTML sanitization for user-generated content
3. **Resource Limits**: Implement limits to prevent DoS attacks
4. **Error Information**: Avoid exposing sensitive information in error messages

## Future Enhancements

### Planned Features
- **Custom Extension Registry**: Plugin system for markdown extensions
- **Compilation Caching**: Intelligent caching for repeated content
- **Streaming Processing**: Support for very large documents
- **Syntax Highlighting**: Enhanced code block highlighting

### Extension Opportunities
- **Math Support**: KaTeX integration for mathematical expressions
- **Diagram Support**: Mermaid or similar diagram rendering
- **Table Enhancements**: Advanced table formatting options
- **Custom Containers**: Support for custom content containers

## API Reference

### MarkdownCompiler Methods

```javascript
// Detection
isMarkdown(text): boolean
process(text): string
processTemplate(content): string

// Compilation
compile(text): string

// Utilities
log(...args): void
```

### Static Methods

```javascript
getMarkdownCompiler(options?): MarkdownCompiler
```

### Configuration Interface

```javascript
interface CompilerOptions {
  markdownIt?: MarkdownItOptions
  aggressive?: boolean
  minLength?: number
  debugLogs?: boolean
}
```

## Related Documentation

- **[Template System](../features/template-system.md)** - Primary consumer of compiler
- **[Editor Extensions](./editor-extensions.md)** - Paste system integration
- **[Performance Guide](./performance.md)** - Optimization strategies
- **[Testing Guide](./testing.md)** - Testing methodologies