# Template System Architecture

Technical documentation for the Lokus template system implementation.

## Overview

The template system uses a file-based architecture where templates are stored as individual markdown files with YAML frontmatter. The system provides a comprehensive template language with variables, conditionals, loops, filters, and JavaScript execution.

## Architecture Components

### 1. File Storage (`file-storage.js`)

**Purpose**: Manages template storage as individual `.md` files with YAML frontmatter.

**Key Features**:
- File-based persistence using Tauri FS API
- YAML frontmatter parsing for metadata
- Template cache for performance
- Automatic filename sanitization

**Storage Location**:
```
/Users/[username]/Desktop/My Knowledge Base/templates/
  ├── daily-notes.md
  ├── meeting-notes.md
  └── project-brief.md
```

**Template File Format**:
```markdown
---
id: template-id
name: "Template Name"
category: Work
tags:
  - meeting
  - notes
createdAt: 2025-11-06T00:00:00.000Z
updatedAt: 2025-11-06T00:00:00.000Z
---

# Template Content

Markdown body with {{variables}}
```

### 2. HTML to Markdown Converter (`html-to-markdown.js`)

**Purpose**: Converts TipTap HTML output to clean markdown for template storage.

**Library**: `turndown` with custom rules

**Custom Rules**:
- Template variable preservation (`{{...}}`)
- Task list handling (`data-type="taskItem"`)
- Wiki link conversion (`data-type="wikiLink"`)
- Highlight support (`<mark>`)
- Strikethrough support (`<s>`, `<del>`)

**Integration**: Automatic conversion when creating templates from editor content.

### 3. Template Manager (`manager.js`)

**Purpose**: Orchestrates template CRUD operations and integrates with storage backend.

**Key Methods**:
- `initialize()` - Load templates from storage
- `create(templateData)` - Create new template
- `read(id)` - Get template by ID
- `update(id, updates)` - Update existing template
- `delete(id)` - Delete template and file
- `list(options)` - Query templates with filters

**Features**:
- Category and tag indexing
- Template validation
- Auto-save to file system
- Cache management

### 4. Template Processor (`processor-integrated.js`)

**Purpose**: Main template processing engine that orchestrates all template features.

**Processing Pipeline**:
1. **Initialization**: Setup context with built-in variables
2. **Inclusion**: Resolve `{{include:...}}` statements
3. **Prompts**: Parse user input prompts (backend only)
4. **Conditionals**: Process `{{#if}}` blocks
5. **Loops**: Process `{{#each}}` blocks
6. **Variables**: Resolve all `{{variable}}` references
7. **JavaScript**: Execute `{{js:...}}` code
8. **Filters**: Apply filter transformations

### 5. Date Operations (`dates.js`)

**Purpose**: Comprehensive date manipulation using date-fns.

**Features**:
- 70+ date functions
- Method chaining via Proxy
- Format customization
- Relative date calculations
- Timezone support

**Example Chain**:
```javascript
date.add(7, 'days').startOfWeek().format('yyyy-MM-dd')
```

**Implementation**: Proxy wrapper that returns chainable date objects.

### 6. Filters (`filters.js`)

**Purpose**: Text transformation and formatting utilities.

**Categories**:
- **String** (16 filters): upper, lower, capitalize, slug, truncate, etc.
- **Array** (12 filters): join, first, last, sort, unique, etc.
- **Number** (11 filters): round, floor, format, percentage, etc.
- **Date** (8 filters): dateFormat, timeAgo, fromNow, etc.
- **Object** (5 filters): json, keys, values, entries, etc.
- **Utility** (8 filters): default, typeOf, isEmpty, etc.

**Chaining**: `{{value | filter1 | filter2 | filter3}}`

### 7. Conditionals (`conditionals.js`)

**Purpose**: If/else/elseif logic processing.

**Supported Operators**:
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`

**Features**:
- Nested conditionals
- Multiple else-if branches
- Variable resolution with dot notation

### 8. Loops (`loops.js`)

**Purpose**: Array iteration with `{{#each}}` blocks.

**Special Variables**:
- `@index` - Current index (0-based)
- `@first` - First iteration boolean
- `@last` - Last iteration boolean
- `@length` - Total items
- `@key` - Object key

**Features**:
- Nested loops
- Object iteration
- Arithmetic expressions in loops

### 9. JavaScript Sandbox (`sandbox-isolated.js`)

**Purpose**: Safe JavaScript execution using isolated-vm.

**Security**:
- Isolated V8 context
- 128MB memory limit
- 5-second timeout
- No access to: file system, network, Node APIs, eval, require

**Available APIs**:
- Math, Date, JSON
- String, Number, Array, Object methods
- Custom helpers: uuid(), slugify(), format()

### 10. Template Inclusion (`inclusion.js`)

**Purpose**: Nested template composition.

**Features**:
- Recursive template loading
- Variable passing to included templates
- Circular dependency detection
- Max depth limiting (10 levels)

**Syntax**:
```markdown
{{include:header}}
{{include:footer:title=Hello,date=2025-11-06}}
```

## Data Flow

### Template Creation

```
User creates template in editor
         ↓
Editor content (HTML)
         ↓
HTML → Markdown conversion
         ↓
Template data + metadata
         ↓
TemplateManager.create()
         ↓
Validation
         ↓
FileStorage.saveTemplate()
         ↓
Generate YAML frontmatter
         ↓
Write .md file
         ↓
Update cache
         ↓
Template available in CMD+K
```

### Template Insertion

```
User selects template
         ↓
TemplateManager.read(id)
         ↓
Load template from cache/file
         ↓
TemplateProcessor.process()
         ↓
Pipeline: includes → conditionals → loops → variables → filters
         ↓
Rendered markdown
         ↓
Insert at cursor position
```

### Template Deletion

```
User deletes template
         ↓
TemplateManager.delete(id)
         ↓
Remove from indexes
         ↓
Delete from in-memory cache
         ↓
FileStorage.deleteTemplate(id)
         ↓
Delete .md file
         ↓
Template removed from CMD+K
```

## Storage Schema

### In-Memory Cache

```javascript
Map<string, Template> {
  'template-id': {
    id: 'template-id',
    name: 'Template Name',
    content: '# Content...',
    category: 'Work',
    tags: ['tag1', 'tag2'],
    metadata: {
      createdAt: '2025-11-06T00:00:00.000Z',
      updatedAt: '2025-11-06T00:00:00.000Z',
      createdBy: 'user'
    },
    stats: {
      variableCount: 5,
      conditionalCount: 2,
      loopCount: 1
    }
  }
}
```

### File System Structure

```
templates/
  ├── daily-notes.md           # Individual template file
  ├── meeting-notes.md         #
  └── project-brief.md         #
```

## Performance Optimizations

1. **In-Memory Cache**: Templates loaded once and cached
2. **Lazy Loading**: Templates loaded only when needed
3. **Indexed Categories/Tags**: O(1) lookups for filtered queries
4. **Proxy-based Chaining**: Efficient method chaining for dates
5. **Template Validation**: Early error detection before processing

## Security Considerations

1. **JavaScript Sandbox**: Isolated V8 context prevents malicious code
2. **Input Validation**: Template syntax validated before save
3. **File Path Sanitization**: Prevents directory traversal
4. **No Eval**: JavaScript execution in isolated environment only
5. **Timeout Protection**: Long-running scripts automatically terminated

## Error Handling

### Storage Errors
- File read/write failures → User notification
- Missing directory → Auto-create on initialization
- Corrupt YAML → Fallback to plain markdown parsing

### Processing Errors
- Invalid template syntax → Validation error on save
- Undefined variables → Replace with empty string
- Filter errors → Return original value
- JavaScript errors → Return error message in template

### Network Resilience
- File-based storage → No network dependency
- Local-only operations → Works offline
- Auto-recovery from crashes → Cache rebuilt from files

## Testing Strategy

### Unit Tests
- File storage operations
- HTML to Markdown conversion
- Duplicate detection logic
- Individual processors (dates, filters, etc.)

### Integration Tests
- End-to-end template creation
- Template processing pipeline
- CRUD operations
- Edge cases and error scenarios

### Test Coverage
- 390+ tests passing
- Core functionality: 100% coverage
- Edge cases and error handling included

## Migration from JSON Storage

The system previously used JSON-based storage. Migration to file-based storage:

1. **Old System**: `templates.json` with all templates in single file
2. **New System**: Individual `.md` files per template
3. **Migration**: Load from JSON, save as individual files
4. **Benefits**: User-editable files, version control friendly, native markdown

## Future Enhancements

Potential improvements:
- User prompt UI dialogs (backend ready)
- Template marketplace/sharing
- Version history for templates
- Template statistics and analytics
- Auto-sync with external directories
- Real-time collaboration
- Template snippets/shortcuts

## Dependencies

### Runtime Dependencies
- `turndown` - HTML to Markdown conversion
- `isolated-vm` - JavaScript sandboxing
- `date-fns` - Date manipulation
- `@tauri-apps/plugin-fs` - File system access

### Development Dependencies
- `vitest` - Testing framework
- `@testing-library/react` - Component testing

## API Reference

### FileBasedTemplateStorage

```javascript
constructor(options)
initialize()                      // Setup storage
saveTemplate(template)            // Save single template
load()                           // Load all templates
deleteTemplate(id)               // Delete template
getCache()                       // Get cached templates
refresh()                        // Reload from file system
```

### TemplateManager

```javascript
initialize()                     // Load templates
create(templateData)             // Create template
read(id)                        // Get template
update(id, updates)              // Update template
delete(id)                      // Delete template
list(options)                   // Query templates
process(template, context)      // Process template
```

### TemplateProcessor

```javascript
process(template, options)       // Main processing
validateTemplate(template)       // Syntax validation
getStatistics(template)         // Template analysis
```

## Performance Benchmarks

Typical performance metrics:
- Template load from file: <10ms
- Template processing: <50ms
- Large template (1000+ variables): <200ms
- Concurrent template processing: Scales linearly

## Debugging

Enable debug mode:

```javascript
const processor = new TemplateProcessor({
  debug: true
});
```

Debug output includes:
- Variable resolution steps
- Filter application
- Conditional evaluation
- Loop iterations
- Error traces
