# Rich Text Editor

Lokus features a powerful rich text editor built on TipTap that provides a seamless writing experience with comprehensive formatting options, markdown support, and advanced features like math rendering and wiki links.

## Overview

The Lokus editor combines the best of rich text editing with markdown compatibility:
- **TipTap-powered** rich text editing with modern UI
- **Complete markdown support** with extensions
- **Math equation rendering** using KaTeX
- **Wiki-style linking** between notes
- **Smart paste functionality** with automatic format conversion
- **Real-time collaboration** support
- **Extensible architecture** for custom functionality

## Core Features

### Rich Text Formatting

#### Basic Text Formatting
- **Bold** (`⌘B` / `Ctrl+B`) - Make text bold with `**text**` or toolbar
- **Italic** (`⌘I` / `Ctrl+I`) - Italicize text with `*text*` or toolbar  
- **Strikethrough** (`⌘⇧X` / `Ctrl+Shift+X`) - Cross out text with `~~text~~`
- **Underline** (`⌘U` / `Ctrl+U`) - Underline text
- **Code** (`⌘E` / `Ctrl+E`) - Inline code with `` `code` `` or toolbar

#### Advanced Formatting
- **Highlight** - Mark important text with `==highlighted text==`
- **Superscript** - Create superscript text like H^2^O 
- **Subscript** - Create subscript text like H~2~O
- **Hyperlinks** - Create links with `[text](url)` syntax or toolbar

### Structural Elements

#### Headings
Create structured documents with six heading levels:
- **Heading 1** (`⌘⌥1` / `Ctrl+Alt+1`) - `# Heading 1`
- **Heading 2** (`⌘⌥2` / `Ctrl+Alt+2`) - `## Heading 2` 
- **Heading 3** (`⌘⌥3` / `Ctrl+Alt+3`) - `### Heading 3`
- **Heading 4-6** - Continue with `####`, `#####`, `######`

#### Lists and Organization
- **Bullet Lists** (`⌘⇧8` / `Ctrl+Shift+8`) - Unordered lists with `-` or `*`
- **Numbered Lists** (`⌘⇧7` / `Ctrl+Shift+7`) - Ordered lists with `1.`
- **Task Lists** - Interactive checkboxes with `- [ ]` and `- [x]`
- **Blockquotes** (`⌘⇧.` / `Ctrl+Shift+.`) - Quote blocks with `>`

#### Advanced Structures
- **Code Blocks** - Syntax-highlighted code with ``` ```
- **Tables** - Structured data with markdown table syntax
- **Horizontal Rules** - Section dividers with `---`
- **Line Breaks** - Hard breaks with double space or `⇧⏎`

### Math Equation Support

#### Inline Math
Create inline mathematical expressions using KaTeX:
- **Syntax**: `$equation$`
- **Example**: `$E = mc^2$` renders as $E = mc^2$
- **Shortcut**: Type `$` to start inline math mode

#### Block Math
Create display-style mathematical expressions:
- **Syntax**: `$$equation$$`
- **Example**: 
  ```
  $$
  \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
  $$
  ```
- **Features**: Multi-line equations, complex formatting, automatic centering

#### Math Features
- **LaTeX Compatibility** - Standard LaTeX math syntax supported
- **Real-time Rendering** - Equations render as you type
- **Error Handling** - Invalid syntax shows helpful error messages
- **Copy/Paste** - Math equations copy as LaTeX and render on paste

### Wiki Links and Cross-References

#### Creating Wiki Links
Link between notes using wiki-style syntax:
- **Basic Link**: `[[Note Name]]` - Links to note with that title
- **With Display Text**: `[[Note Name|Display Text]]` - Custom link text
- **Autocomplete**: Type `[[` to get note suggestions
- **Case Insensitive**: Links work regardless of case differences

#### Wiki Link Features
- **Automatic Suggestions** - Dropdown appears as you type note names
- **Fuzzy Matching** - Finds notes even with partial or misspelled names
- **Create on Click** - Clicking non-existent note creates it
- **Backlink Tracking** - System tracks which notes link to each other
- **Visual Indicators** - Different styling for existing vs. non-existent notes

#### Link Navigation
- **Click to Follow** - Click any wiki link to open the target note
- **Hover Preview** - Hover over links to see note preview (planned feature)
- **Breadcrumb Navigation** - Track navigation history between linked notes
- **Back/Forward** - Browser-style navigation between visited notes

### Smart Paste System

#### Markdown Auto-Conversion
The editor intelligently converts pasted content:
- **HTML to Markdown** - Web content automatically converts to clean markdown
- **Rich Text Preservation** - Formatting maintained when pasting between rich text editors
- **Plain Text Enhancement** - Plain text URLs automatically become clickable links
- **Smart Detection** - System determines content type and applies appropriate conversion

#### Paste Behavior
- **Format Detection** - Analyzes clipboard content to determine format
- **Conflict Resolution** - User can choose format when multiple formats available
- **Undo Support** - Paste operations fully support undo/redo
- **Large Content Handling** - Efficient processing of large pasted content

## Editor Interface

### Toolbar
The floating toolbar appears when text is selected:
- **Format Buttons** - Quick access to bold, italic, code, etc.
- **Link Creation** - Convert selection to link with URL input
- **Math Mode** - Convert selection to inline or block math
- **Context Sensitive** - Shows relevant options based on selection

### Slash Commands
Type `/` to access quick formatting commands:
- **`/h1`** - Convert to Heading 1
- **`/h2`** - Convert to Heading 2  
- **`/h3`** - Convert to Heading 3
- **`/ul`** - Create bullet list
- **`/ol`** - Create numbered list
- **`/task`** - Create task list
- **`/quote`** - Create blockquote
- **`/code`** - Create code block
- **`/math`** - Create math block
- **`/table`** - Insert table
- **`/hr`** - Insert horizontal rule

### Context Menus
Right-click in the editor for contextual options:
- **Cut/Copy/Paste** - Standard clipboard operations
- **Format Selection** - Apply formatting to selected text
- **Insert Elements** - Add tables, math, links, etc.
- **Text Tools** - Word count, find/replace, etc.

## Advanced Features

### Table Editing
Comprehensive table support with:
- **Visual Editing** - Click to edit cells directly
- **Column Resizing** - Drag column borders to adjust width
- **Row/Column Management** - Add, delete, or rearrange rows and columns
- **Table Navigation** - Tab to move between cells
- **Markdown Export** - Tables export as standard markdown tables

#### Table Features
- **Header Rows** - First row automatically styled as header
- **Cell Formatting** - Apply text formatting within table cells
- **Alignment** - Left, center, right alignment for columns
- **Sorting** - Click headers to sort table data (planned feature)

### Code Block Syntax Highlighting
Enhanced code editing with:
- **Language Detection** - Automatic language detection from content
- **Syntax Highlighting** - Full syntax highlighting for 100+ languages
- **Line Numbers** - Optional line numbering
- **Copy Code** - One-click code copying
- **Language Selector** - Dropdown to change syntax highlighting language

#### Supported Languages
Popular languages include:
- **Web**: JavaScript, TypeScript, HTML, CSS, SCSS
- **Backend**: Python, Java, C++, C#, Go, Rust, PHP
- **Data**: SQL, JSON, YAML, XML, CSV
- **Config**: Dockerfile, NGINX, Apache, .env
- **Docs**: Markdown, LaTeX, reStructuredText

### Smart Task Lists
Interactive task management with:
- **Clickable Checkboxes** - Check/uncheck tasks by clicking
- **Nested Tasks** - Support for subtasks and hierarchical organization
- **Task States** - Multiple task states beyond simple done/undone
- **Progress Tracking** - Visual progress indicators for task groups
- **Due Dates** - Optional due date tracking (planned feature)

#### Task Syntax
- **Incomplete**: `- [ ] Task description`
- **Complete**: `- [x] Task description`  
- **In Progress**: `- [-] Task in progress`
- **Canceled**: `- [~] Canceled task`

### Image Support
Comprehensive image handling:
- **Drag & Drop** - Drag images directly into the editor
- **Paste Images** - Paste images from clipboard
- **Local Images** - Reference local image files
- **Web Images** - Embed images from URLs
- **Resizing** - Visual resizing handles for images
- **Alt Text** - Accessibility alt text support

#### Image Features
- **Auto-copying** - Dragged images automatically copied to workspace
- **Format Support** - PNG, JPEG, GIF, SVG, WebP support
- **Optimization** - Automatic image optimization for performance
- **Lazy Loading** - Images load only when visible

## Customization and Settings

### Editor Preferences
Access editor settings through Preferences (`⌘,` / `Ctrl+,`):

#### Appearance
- **Font Family** - Choose from system fonts or custom fonts
- **Font Size** - Adjustable font size (12px - 24px)
- **Line Height** - Comfortable reading line height
- **Editor Width** - Maximum content width for readability
- **Theme Integration** - Editor follows application theme

#### Behavior  
- **Auto-save** - Automatic saving with configurable delay
- **Word Wrap** - Soft word wrapping for long lines
- **Spell Check** - Built-in spell checking (system-dependent)
- **Auto-pairs** - Automatic closing of brackets, quotes, etc.
- **Smart Quotes** - Convert straight quotes to smart quotes

#### Markdown
- **Strict Mode** - Enforce strict markdown syntax
- **Extensions** - Enable/disable markdown extensions
- **Math Rendering** - KaTeX rendering options
- **Link Behavior** - Configure wiki link behavior

### Keyboard Shortcuts
Comprehensive keyboard shortcuts for efficient editing:

#### Text Formatting
- `⌘B` / `Ctrl+B` - Bold
- `⌘I` / `Ctrl+I` - Italic  
- `⌘U` / `Ctrl+U` - Underline
- `⌘⇧X` / `Ctrl+Shift+X` - Strikethrough
- `⌘E` / `Ctrl+E` - Inline code
- `⌘K` / `Ctrl+K` - Create link

#### Structure
- `⌘⌥1-6` / `Ctrl+Alt+1-6` - Headings 1-6
- `⌘⇧8` / `Ctrl+Shift+8` - Bullet list
- `⌘⇧7` / `Ctrl+Shift+7` - Numbered list
- `⌘⇧.` / `Ctrl+Shift+.` - Blockquote
- `⌘⇧K` / `Ctrl+Shift+K` - Code block

#### Navigation
- `⌘Z` / `Ctrl+Z` - Undo
- `⌘⇧Z` / `Ctrl+Shift+Z` - Redo
- `⌘A` / `Ctrl+A` - Select all
- `⌘F` / `Ctrl+F` - Find in document
- `⌘G` / `Ctrl+G` - Find next

## Performance and Optimization

### Large Document Handling
The editor is optimized for large documents:
- **Virtual Scrolling** - Efficient rendering of long documents
- **Lazy Rendering** - Content rendered only when visible
- **Memory Management** - Automatic cleanup of unused elements
- **Background Processing** - Heavy operations run in background

### Real-time Features
- **Auto-save** - Changes saved automatically without blocking
- **Live Preview** - Math and markdown render in real-time
- **Collaborative Cursors** - See other users' cursors in real-time (planned)
- **Conflict Resolution** - Automatic conflict resolution for simultaneous edits

### Accessibility

#### Screen Reader Support
- **Semantic Markup** - Proper HTML semantics for screen readers
- **ARIA Labels** - Comprehensive ARIA labeling
- **Keyboard Navigation** - Full keyboard accessibility
- **Focus Management** - Proper focus indication and trapping

#### Visual Accessibility
- **High Contrast** - Support for high contrast system themes
- **Scalable Text** - Respects system font size preferences
- **Color Independence** - Information not conveyed through color alone
- **Focus Indicators** - Clear visual focus indicators

#### Motor Accessibility
- **Keyboard-only Operation** - All features accessible via keyboard
- **Configurable Shortcuts** - Customizable keyboard shortcuts
- **Click Targets** - Large click targets for easier interaction
- **Gesture Alternatives** - Alternative input methods for gestures

## Extension and Development

### Custom Extensions
The editor supports custom TipTap extensions:
- **Plugin Architecture** - Add functionality through plugins
- **Custom Nodes** - Define new content types
- **Custom Marks** - Create new text formatting options
- **Event Handlers** - Respond to editor events
- **API Integration** - Connect to external services

### Developer Tools
Built-in tools for development and debugging:
- **Content Inspector** - Inspect document structure
- **Performance Monitor** - Track editor performance
- **Error Console** - Debug extension issues
- **API Explorer** - Explore available editor APIs

## Troubleshooting

### Common Issues

**Math equations not rendering:**
- Check KaTeX syntax is correct
- Ensure equations are properly wrapped with `$` or `$$`
- Look for console errors indicating KaTeX issues
- Try refreshing the editor

**Wiki links not working:**
- Verify note names match exactly (case insensitive)
- Check that target notes exist in workspace
- Ensure proper wiki link syntax `[[Note Name]]`
- Clear editor cache if links appear broken

**Paste not working correctly:**
- Check if content is coming from a supported source
- Try pasting as plain text first
- Look for JavaScript errors in console
- Restart application if paste functionality breaks

**Performance issues with large documents:**
- Break very large documents into smaller files
- Use wiki links to connect related content
- Disable expensive features like real-time math rendering
- Check available system memory

### Performance Tips
1. **Break up large documents** - Use multiple linked notes instead of one massive file
2. **Limit math equations** - Heavy math rendering can slow performance
3. **Optimize images** - Compress images before adding to notes
4. **Regular saves** - Don't rely solely on auto-save for important work
5. **Clear cache** - Occasionally clear editor cache to free memory

## Related Features

- **[Template System](./template-system.md)** - Reusable content templates
- **[Command Palette](./command-palette.md)** - Quick access to editor commands
- **[Math Rendering](./math.md)** - LaTeX/KaTeX equation support
- **[Wiki Links](./wiki-links.md)** - Note interconnection system
- **[Markdown Compiler](./markdown-compiler.md)** - Markdown processing engine
- **[File Management](./file-management.md)** - File operations and workspace

---

*For technical details on editor extensions and APIs, see the [Editor API Documentation](../api/editor.md).*