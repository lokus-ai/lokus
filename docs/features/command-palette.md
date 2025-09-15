# Command Palette

The Command Palette is a powerful feature inspired by VS Code that provides quick access to all application functions through a searchable interface. It's the fastest way to navigate files, execute commands, and access recent documents.

## Overview

The Command Palette opens a modal dialog with a search interface that allows you to:
- Search and open files instantly
- Execute application commands
- **Access and insert templates** with built-in variables
- **Create templates** from selected text or full file content
- Access recent files and command history
- Navigate the entire file tree
- Perform file operations without using menus

## Activation

**Keyboard Shortcut:** `⌘K` (macOS) / `Ctrl+K` (Windows/Linux)

The Command Palette can be opened from anywhere in the application, making it always accessible regardless of your current focus.

## Interface Elements

### Search Input
- **Placeholder:** "Type a command or search files... (try 'template')"
- **Fuzzy Search:** Supports partial matching for commands, file names, and templates
- **Live Results:** Updates in real-time as you type
- **Template Search:** Type "template" to see all available templates

### Command Groups

The Command Palette organizes results into distinct groups:

#### 1. Command History
Intelligent tracking of your recent actions:

- **Recent Commands:** Shows the 8 most recent commands and file operations
- **File Access History:** Quick access to recently opened files from history
- **Template Usage:** Recently used templates appear in history
- **Time Stamps:** Displays relative time (e.g., "2 minutes ago", "1 hour ago")
- **Individual Removal:** Remove specific items from history with X button
- **Clear History:** Remove all history items with "Clear History" command
- **Re-execution:** Click any history item to repeat the action

#### 2. Template System
Powerful template management and insertion:

- **Individual Template Commands:** Each template appears as "Template: [Name]"
- **Category Tags:** Templates show their category as a shortcut tag
- **Smart Search:** Type "template" to filter only template commands
- **Instant Processing:** Templates are processed with built-in variables when selected
- **Cursor Positioning:** Templates with `{{cursor}}` place cursor automatically
- **Save as Template:** Create templates from selected text or full file content

**Built-in Template Variables:**
- `{{date}}`, `{{time}}`, `{{datetime}}` - Current date/time
- `{{user}}` - Current username
- `{{cursor}}` - Cursor position placeholder
- `{{title}}`, `{{filename}}` - Document context
- `{{uuid}}`, `{{random}}` - Generated values

#### 3. File Commands
Commands for creating and managing files:

- **New File** (`⌘N`)
  - Creates a new untitled file
  - Opens immediately in the editor
  
- **New Folder** 
  - Creates a new folder in the current directory
  - Prompts for folder name
  
- **Save File** (`⌘S`)
  - Saves the currently active file
  - Only appears when a file is open
  
- **Close Tab** 
  - Closes the currently active tab
  - Only appears when a file is open

- **Save as Template**
  - Creates a template from selected text or entire file
  - Opens template creation dialog with live preview
  - Supports categories, tags, and built-in variables
  - Available when text is selected or file is open

#### 4. View Commands
Commands for controlling the interface:

- **Toggle Sidebar**
  - Shows/hides the file explorer sidebar
  - Provides more space for editing when hidden
  
- **Open Preferences** (`⌘,`)
  - Opens the application settings dialog
  - Access to all customization options

#### 5. Recent Files
Quick access to recently opened files:

- Shows the 5 most recently opened files
- Displays file name and full path
- Includes file path as a subtitle for context
- Automatically updates based on file access patterns

#### 6. File Search
Comprehensive file navigation:

- **Live File Tree Search:** Shows all files matching your search
- **Path Context:** Displays full file paths for disambiguation
- **Fuzzy Matching:** Finds files even with partial or out-of-order characters
- **Limit Display:** Shows first 10 matches with indication of additional files
- **Hierarchical Search:** Searches through nested folders automatically

## Template Workflows

### Creating Templates from Selection

1. **Select Text:** Highlight the content you want to use as a template
2. **Open Command Palette:** Press `⌘K` (macOS) / `Ctrl+K` (Windows/Linux)
3. **Find Save Command:** Type "Save as Template" or use the command directly
4. **Configure Template:** Fill in name, category, tags, and preview the result
5. **Save:** Template becomes immediately available in Command Palette

### Creating Templates from Full File

1. **Open Command Palette:** Press `⌘K` without any text selected
2. **Use Save Command:** "Save as Template" will use entire file content
3. **Configure Template:** Set up template metadata and preview
4. **Save:** Template is ready for reuse across any file

### Using Templates

1. **Open Command Palette:** `⌘K`
2. **Search Templates:** Type "template" or the template name
3. **Select Template:** Click on "Template: [Name]" command
4. **Automatic Processing:** Template variables are resolved instantly
5. **Content Insertion:** Processed content appears at cursor position

### Template Variable Resolution

When templates are selected, all built-in variables are automatically processed:

- **Date/Time Variables:** `{{date}}` becomes current date, `{{time}}` becomes current time
- **Context Variables:** `{{filename}}` resolves to current file name
- **Cursor Positioning:** `{{cursor}}` marks where cursor will be placed after insertion
- **User Variables:** `{{user}}` resolves to current username
- **Random Values:** `{{uuid}}` generates unique identifier

## Search Behavior

### File Search Algorithm
The Command Palette uses a sophisticated search algorithm that:

1. **Flattens the file tree** - Converts nested folder structure into searchable list
2. **Fuzzy matching** - Matches partial strings and out-of-order characters
3. **Path inclusion** - Searches both file names and their full paths
4. **Relevance ranking** - Prioritizes closer matches and recent files

### Example Searches

#### File Searches
- `readme` → Finds "README.md", "readme.txt", etc.
- `src/comp` → Finds files in src/components/
- `test` → Finds all test files across the project
- `config` → Finds configuration files anywhere in the tree

#### Template Searches
- `template` → Shows all available templates
- `template daily` → Finds templates with "daily" in the name
- `meeting` → Finds templates tagged with "meeting"
- `work` → Shows templates in the "Work" category

#### Command Searches
- `new` → Shows "New File", "New Folder" commands
- `save` → Shows "Save File", "Save as Template" commands
- `close` → Shows "Close Tab" command
- `preferences` → Shows "Open Preferences" command

## Keyboard Navigation

### Within the Command Palette
- **↑/↓ Arrow Keys:** Navigate between items
- **Enter:** Execute selected command or open selected file
- **Escape:** Close the Command Palette
- **Tab:** Move between different groups (if applicable)

### Quick Selection
- **Type to filter:** Start typing to immediately filter results
- **Direct command execution:** Commands execute immediately on selection
- **File opening:** Files open immediately when selected

## Integration with Other Features

### Shortcut Integration
The Command Palette displays keyboard shortcuts for all commands, providing a learning tool for power users. Shortcuts are dynamically loaded from the shortcut registry and formatted appropriately for the current platform.

### File System Integration
- **Real-time updates:** File tree changes are reflected immediately
- **Path resolution:** Handles complex nested folder structures
- **File type recognition:** Displays appropriate icons for different file types

### Recent Files Tracking
- **Automatic tracking:** No setup required
- **Intelligent ordering:** Most recently accessed files appear first
- **Session persistence:** Recent files persist across application restarts

### Template System Integration
- **Direct Access:** Templates appear as individual commands in the palette
- **Smart Processing:** Built-in variables are resolved automatically when selected
- **Universal Compiler:** Uses the same markdown engine as paste operations
- **Creation Workflow:** Create templates directly from Command Palette
- **Category Organization:** Templates organized by categories for easy browsing
- **History Tracking:** Template usage tracked in command history

### Command History System
- **Persistent Memory:** Remembers recent commands and file operations
- **Time-based Ordering:** Shows most recent actions first with timestamps
- **Action Re-execution:** Click any history item to repeat the action
- **Intelligent Grouping:** Similar actions grouped for better organization
- **Cleanup Controls:** Remove individual items or clear entire history

## Performance Considerations

### Optimization Features
- **Lazy loading:** File tree is processed on-demand
- **Result limiting:** Large directories show limited results to maintain responsiveness
- **Efficient rendering:** Uses virtualization for large file lists
- **Debounced search:** Prevents excessive filtering during rapid typing

### Large Project Handling
For projects with thousands of files:
- Search results are limited to first 10 matches
- Additional files are indicated with a count
- Search algorithm prioritizes exact matches
- Folder hierarchy is preserved in search context

## Accessibility

### Screen Reader Support
- **ARIA labels:** All interface elements have appropriate labels
- **Keyboard navigation:** Fully accessible without mouse
- **Focus management:** Proper focus indication and trapping
- **Semantic markup:** Uses proper heading and list structures

### Visual Accessibility
- **High contrast support:** Respects system accessibility settings
- **Scalable fonts:** Text scales with system font size preferences
- **Clear visual hierarchy:** Distinct sections and groupings
- **Icon alternatives:** Text labels accompany all icons

## Tips and Best Practices

### Power User Tips
1. **Learn the shortcuts:** Memorize common command shortcuts shown in the palette
2. **Use partial matching:** Don't type full file names - partial matches work great
3. **Navigate by path:** Use folder names to narrow down file searches
4. **Recent files workflow:** Access frequently used files through recent files section

### Workflow Integration
1. **Quick file switching:** Use Command Palette instead of clicking through folders
2. **Command discovery:** Browse available commands to learn new features
3. **Muscle memory:** Practice using `⌘K` to make it second nature
4. **File organization:** Use meaningful file names that are easy to search for
5. **Template workflow:** Create templates from frequently used content patterns
6. **History utilization:** Use command history to quickly repeat recent actions

### Template Power Tips
1. **Selection-based creation:** Select text before `⌘K` → "Save as Template" for quick template creation
2. **Strategic variable placement:** Use `{{cursor}}` to position cursor optimally after insertion
3. **Category organization:** Group related templates in same category for easier discovery
4. **Smart naming:** Use descriptive template names that will be easy to search for
5. **Date/time automation:** Leverage built-in date variables for timestamped content
6. **Content reuse:** Turn commonly used text patterns into reusable templates

## Troubleshooting

### Common Issues

**Command Palette not opening:**
- Verify `⌘K` shortcut is not conflicting with other applications
- Check if focus is trapped in another modal dialog
- Restart application if shortcuts become unresponsive

**Files not appearing in search:**
- Ensure file is saved and part of the current project
- Check if file is in a hidden directory
- Verify file has a supported extension

**Search results too broad:**
- Use more specific search terms
- Include folder names in your search
- Use partial path matching for better targeting

**Template not appearing in Command Palette:**
- Verify template was saved successfully (check for save confirmation)
- Ensure template name doesn't contain special characters
- Check if template was saved to correct category
- Try typing "template" to filter only template commands

**Template variables not resolving:**
- Verify variable syntax uses double curly braces: `{{variable}}`
- Check that variable names match built-in variables exactly
- Ensure template processing completed successfully
- Try recreating template if variables appear corrupted

**Template content not inserting correctly:**
- Check cursor positioning in editor before inserting template
- Verify template content was compiled properly in preview
- Ensure editor has focus when inserting template
- Try inserting template in a new file to isolate issues

### Performance Issues
**Slow search in large projects:**
- Search results are automatically limited
- Consider organizing files into more specific folders
- Use more targeted search terms

## Related Features

- **[Template System](./template-system.md)** - Comprehensive template management and usage
- **[Universal Markdown Compiler](../developer/markdown-compiler.md)** - Markdown processing engine
- **[File Context Menus](./context-menus.md)** - Right-click file operations
- **[Keyboard Shortcuts](./shortcuts.md)** - Complete shortcut reference
- **[File Management](./file-management.md)** - File system operations
- **[Search and Navigation](./search.md)** - Advanced search features