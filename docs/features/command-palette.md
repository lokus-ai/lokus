# Command Palette

The Command Palette is a powerful feature inspired by VS Code that provides quick access to all application functions through a searchable interface. It's the fastest way to navigate files, execute commands, and access recent documents.

## Overview

The Command Palette opens a modal dialog with a search interface that allows you to:
- Search and open files instantly
- Execute application commands
- Access recent files
- Navigate the entire file tree
- Perform file operations without using menus

## Activation

**Keyboard Shortcut:** `⌘K` (macOS) / `Ctrl+K` (Windows/Linux)

The Command Palette can be opened from anywhere in the application, making it always accessible regardless of your current focus.

## Interface Elements

### Search Input
- **Placeholder:** "Type a command or search files..."
- **Fuzzy Search:** Supports partial matching for both commands and file names
- **Live Results:** Updates in real-time as you type

### Command Groups

The Command Palette organizes results into distinct groups:

#### 1. File Commands
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

#### 2. View Commands
Commands for controlling the interface:

- **Toggle Sidebar**
  - Shows/hides the file explorer sidebar
  - Provides more space for editing when hidden
  
- **Open Preferences** (`⌘,`)
  - Opens the application settings dialog
  - Access to all customization options

#### 3. Recent Files
Quick access to recently opened files:

- Shows the 5 most recently opened files
- Displays file name and full path
- Includes file path as a subtitle for context
- Automatically updates based on file access patterns

#### 4. File Search
Comprehensive file navigation:

- **Live File Tree Search:** Shows all files matching your search
- **Path Context:** Displays full file paths for disambiguation
- **Fuzzy Matching:** Finds files even with partial or out-of-order characters
- **Limit Display:** Shows first 10 matches with indication of additional files
- **Hierarchical Search:** Searches through nested folders automatically

## Search Behavior

### File Search Algorithm
The Command Palette uses a sophisticated search algorithm that:

1. **Flattens the file tree** - Converts nested folder structure into searchable list
2. **Fuzzy matching** - Matches partial strings and out-of-order characters
3. **Path inclusion** - Searches both file names and their full paths
4. **Relevance ranking** - Prioritizes closer matches and recent files

### Example Searches
- `readme` → Finds "README.md", "readme.txt", etc.
- `src/comp` → Finds files in src/components/
- `test` → Finds all test files across the project
- `config` → Finds configuration files anywhere in the tree

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

### Performance Issues
**Slow search in large projects:**
- Search results are automatically limited
- Consider organizing files into more specific folders
- Use more targeted search terms

## Related Features

- **[File Context Menus](./context-menus.md)** - Right-click file operations
- **[Keyboard Shortcuts](./shortcuts.md)** - Complete shortcut reference
- **[File Management](./file-management.md)** - File system operations
- **[Search and Navigation](./search.md)** - Advanced search features