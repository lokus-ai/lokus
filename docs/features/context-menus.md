# Context Menus

Lokus features comprehensive VS Code-style context menus that provide quick access to file operations, sharing options, and advanced functionality. These context menus appear when you right-click on files or folders in the file explorer, offering contextual actions based on the selected item.

## Overview

Context menus in Lokus are designed to match the familiar VS Code experience while adding enhanced functionality for note-taking workflows. They provide immediate access to the most common operations without navigating through application menus.

## Activation

**Right-click** (or **Control+click** on macOS) on any file or folder in the file explorer to open the context menu.

## File Context Menu

When right-clicking on a file, the following options are available:

### File Operations

#### Open
- **Action:** Opens the file in the main editor
- **Behavior:** Switches to existing tab if file is already open
- **Icon:** File text icon

#### Open to the Side
- **Shortcut:** `⌘⇧Enter` (macOS) / `Ctrl+Shift+Enter` (Windows/Linux)
- **Action:** Opens the file in a new tab adjacent to the current tab
- **Use Case:** Compare files side-by-side or work with multiple related files
- **Icon:** Folder open icon

#### Open With...
- **Action:** Shows system dialog to choose external application
- **Behavior:** Launches the selected file in external applications like system text editors, image viewers, etc.
- **Icon:** External link icon

### System Integration

#### Reveal in Finder
- **Shortcut:** `⌥⌘R` (macOS) / `Alt+Ctrl+R` (Windows/Linux)
- **Action:** Opens the system file manager (Finder/Explorer) and highlights the selected file
- **Use Case:** Quick access to file location for external operations
- **Icon:** Eye icon

#### Open in Integrated Terminal
- **Action:** Opens the terminal/command prompt in the file's directory
- **Behavior:** Focuses on the folder containing the file
- **Use Case:** Quick access to command-line operations in the file's context
- **Icon:** Terminal icon

### Sharing Options

The **Share** submenu provides multiple ways to share file references:

#### Email Link
- **Action:** Copies a file link formatted for email
- **Format:** `file://[absolute-path]` 
- **Use Case:** Sharing file references in email communications

#### Copy Link for Slack
- **Action:** Copies a Slack-formatted file link
- **Format:** Optimized for Slack's link parsing
- **Use Case:** Quick sharing in Slack channels and DMs

#### Copy Link for Teams
- **Action:** Copies a Microsoft Teams-formatted file link  
- **Format:** Compatible with Teams link sharing
- **Use Case:** Corporate environments using Microsoft Teams

### File Comparison

#### Select for Compare
- **Action:** Marks the file for comparison with another file
- **Behavior:** File is stored in comparison queue
- **Use Case:** Diff operations between two files
- **Icon:** Git compare icon
- **Note:** Only available for files, not folders

### Clipboard Operations

#### Cut
- **Shortcut:** `⌘X` (macOS) / `Ctrl+X` (Windows/Linux)
- **Action:** Marks file for move operation
- **Visual Feedback:** File appears dimmed in the explorer
- **Icon:** Scissors icon

#### Copy
- **Shortcut:** `⌘C` (macOS) / `Ctrl+C` (Windows/Linux)  
- **Action:** Copies file to clipboard for duplication
- **Behavior:** File can be pasted in same or different location
- **Icon:** Copy icon

#### Copy Path
- **Shortcut:** `⌥⌘C` (macOS) / `Alt+Ctrl+C` (Windows/Linux)
- **Action:** Copies the absolute file path to clipboard
- **Format:** Full system path (e.g., `/Users/username/Documents/file.md`)
- **Use Case:** Referencing files in external tools or scripts

#### Copy Relative Path
- **Shortcut:** `⌥⌘⇧C` (macOS) / `Alt+Ctrl+Shift+C` (Windows/Linux)
- **Action:** Copies the path relative to the project root
- **Format:** Project-relative path (e.g., `docs/features/file.md`)
- **Use Case:** Internal project references, documentation links

### File Management

#### Rename...
- **Shortcut:** `⌘⇧R` (macOS) / `Ctrl+Shift+R` (Windows/Linux)
- **Action:** Enables inline renaming of the file
- **Behavior:** 
  - File name becomes editable in place
  - Press Enter to confirm, Escape to cancel
  - Updates all references to the file automatically
- **Icon:** Edit icon

#### Delete
- **Shortcut:** `⌘⌫` (macOS) / `Ctrl+Delete` (Windows/Linux)
- **Action:** Moves file to system trash/recycle bin
- **Safety:** Requires confirmation dialog for irreversible action
- **Visual:** Menu item appears in red to indicate destructive action
- **Icon:** Trash icon

## Folder Context Menu

When right-clicking on a folder, the context menu shows folder-specific options:

### Folder Operations
- **Reveal in Finder** - Opens system file manager
- **Open in Integrated Terminal** - Opens terminal in this directory
- **Share** submenu - Same sharing options as files
- **Cut/Copy/Copy Path/Copy Relative Path** - Same clipboard operations
- **Rename/Delete** - Same file management operations

### Folder-Specific Features
- **Open** action opens/expands the folder in the file tree
- **Open to the Side** not available (folder-specific)
- **Select for Compare** not available (file-specific)

## Context Menu Behavior

### Visual Design
- **Modern styling** with clean icons and clear typography
- **Proper spacing** for easy target acquisition
- **Keyboard shortcuts displayed** on the right side of menu items
- **Grouped sections** with visual separators for logical organization
- **Destructive actions** (like Delete) highlighted in red

### Responsive Layout
- **Fixed width** (256px) for consistent appearance
- **Adaptive height** based on available options
- **Proper scrolling** for very long menus (rare)
- **Platform-appropriate** styling matching system conventions

### Keyboard Navigation
- **Arrow keys** to navigate menu items
- **Enter** to activate selected item
- **Escape** to close menu
- **Letter keys** for quick item selection (mnemonic access)

## Accessibility Features

### Screen Reader Support
- **ARIA labels** for all menu items
- **Role definitions** for proper semantic understanding
- **Keyboard announcements** for menu state changes
- **Context information** about the selected file/folder

### Motor Accessibility
- **Large click targets** for easy selection
- **Keyboard-only operation** without requiring precise mouse control
- **Consistent activation patterns** across all menu types

## Integration with Other Features

### Command Palette Integration
Many context menu actions are also available through the Command Palette (`⌘K`), providing alternative access methods for the same functionality.

### Shortcut System
All keyboard shortcuts shown in context menus are managed through the central shortcut registry, ensuring consistency across the application.

### File System Monitoring
Context menu actions that modify files (rename, delete, move) trigger file system updates that are reflected throughout the application in real-time.

## Platform Differences

### macOS Specific
- Uses `⌘` (Command) key in shortcuts
- "Reveal in Finder" instead of "Show in Explorer"
- Native macOS context menu styling

### Windows/Linux Specific  
- Uses `Ctrl` key in shortcuts
- "Show in Explorer"/"Show in Files" as appropriate
- Platform-native context menu appearance

## Performance Considerations

### Menu Generation
- **Lazy evaluation** - Menu items computed only when menu opens
- **Conditional rendering** - Only relevant items are shown
- **Fast activation** - Menu appears immediately on right-click

### File Operations
- **Background processing** for potentially slow operations
- **Progress indication** for long-running tasks like large file copies
- **Error handling** with user-friendly messages

## Troubleshooting

### Common Issues

**Context menu not appearing:**
- Ensure you're right-clicking directly on a file/folder name
- Check if another modal dialog is capturing input
- Verify mouse/trackpad right-click is configured correctly

**Missing menu items:**
- Some items are context-dependent (file vs folder)
- Check file permissions for operations like delete/rename
- Verify external applications are installed for "Open With" functionality

**Keyboard shortcuts not working:**
- Ensure shortcuts aren't captured by other applications
- Check system accessibility settings on macOS
- Verify focus is in the file explorer when using shortcuts

## Best Practices

### Workflow Efficiency
1. **Learn the shortcuts** - Memorize frequently used keyboard shortcuts
2. **Use appropriate actions** - Choose "Open to the Side" for file comparison
3. **Leverage sharing features** - Use formatted links for better collaboration
4. **Organize with paths** - Use Copy Relative Path for documentation

### File Management
1. **Confirm destructive actions** - Always verify before deleting files
2. **Use rename carefully** - Be aware that renaming updates internal links
3. **Leverage system integration** - Use "Reveal in Finder" for complex file operations
4. **Group related operations** - Use cut/copy for efficient file organization

## Related Features

- **[Command Palette](./command-palette.md)** - Alternative access to many context menu actions
- **[File Management](./file-management.md)** - Detailed file operation documentation
- **[Keyboard Shortcuts](./shortcuts.md)** - Complete shortcut reference
- **[System Integration](./system-integration.md)** - External application integration