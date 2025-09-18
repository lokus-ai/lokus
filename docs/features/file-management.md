# File Management

Lokus provides comprehensive file management capabilities that allow you to organize, navigate, and manipulate your workspace files efficiently. The file management system includes a sophisticated file explorer, workspace organization, and seamless integration with all application features.

## Overview

The file management system offers:
- **Hierarchical file explorer** - Navigate files and folders in a tree structure
- **Workspace management** - Organize projects and collections of related files
- **File operations** - Create, rename, delete, move, and copy files
- **Multi-tab interface** - Work with multiple files simultaneously
- **Real-time sync** - Changes reflect immediately across all views
- **System integration** - Seamless integration with operating system file operations

## File Explorer

### Interface Layout
The file explorer appears in the left sidebar and includes:
- **Workspace Header** - Current workspace name and controls
- **File Tree** - Hierarchical view of all files and folders
- **File Actions** - Buttons for common file operations
- **Context Menus** - Right-click access to file operations
- **Search Integration** - Quick file search within explorer

### File Tree Navigation
- **Expand/Collapse** - Click arrows to expand or collapse folders
- **Click to Select** - Single-click to select files or folders
- **Double-click to Open** - Double-click files to open in editor
- **Keyboard Navigation** - Use arrow keys to navigate tree structure
- **Drag and Drop** - Reorganize files by dragging them to new locations

## Workspace Management

### Creating Workspaces
1. **New Workspace** - File → New Workspace
2. **Open Folder** - File → Open Folder to create workspace from existing directory
3. **Clone Workspace** - Duplicate existing workspace structure
4. **Import Workspace** - Import workspace from backup or export

### Workspace Features
- **Workspace Settings** - Configure workspace-specific preferences
- **Workspace Search** - Search limited to current workspace files
- **Workspace Isolation** - Each workspace maintains independent settings
- **Recent Workspaces** - Quick access to recently used workspaces

### Multi-Workspace Support
- **Switch Workspaces** - File → Switch Workspace
- **Parallel Workspaces** - Work with multiple workspaces simultaneously
- **Workspace Comparison** - Compare files across different workspaces
- **Workspace Backup** - Automatic and manual workspace backups

## File Operations

### Creating Files and Folders

#### New File Creation
- **Command Palette** - `⌘K` → "New File"
- **Keyboard Shortcut** - `⌘N` (macOS) / `Ctrl+N` (Windows/Linux)
- **Context Menu** - Right-click in file explorer → "New File"
- **File Menu** - File → New File

#### New Folder Creation
- **Context Menu** - Right-click in file explorer → "New Folder"
- **Command Palette** - `⌘K` → "New Folder"
- **Folder Button** - Click folder+ icon in file explorer
- **Keyboard Shortcut** - `⌘⇧N` (macOS) / `Ctrl+Shift+N` (Windows/Linux)

### File Manipulation

#### Renaming Files
1. **Context Menu** - Right-click file → "Rename"
2. **Keyboard Shortcut** - Select file → `⌘⇧R` (macOS) / `Ctrl+Shift+R` (Windows/Linux)
3. **Inline Editing** - File name becomes editable
4. **Confirm/Cancel** - Press Enter to confirm, Escape to cancel

#### Moving and Copying Files
- **Drag and Drop** - Drag files to new locations within workspace
- **Cut and Paste** - `⌘X` then `⌘V` (macOS) / `Ctrl+X` then `Ctrl+V` (Windows/Linux)
- **Copy and Paste** - `⌘C` then `⌘V` (macOS) / `Ctrl+C` then `Ctrl+V` (Windows/Linux)
- **Duplicate** - Right-click → "Duplicate" to create copy in same location

#### Deleting Files
- **Delete Key** - Select file → Delete key
- **Context Menu** - Right-click → "Delete"
- **Keyboard Shortcut** - `⌘⌫` (macOS) / `Ctrl+Delete` (Windows/Linux)
- **Move to Trash** - Files moved to system trash/recycle bin for safety

### Bulk Operations
- **Multi-Selection** - Hold Ctrl/Cmd and click multiple files
- **Range Selection** - Hold Shift and click to select range
- **Select All** - `⌘A` (macOS) / `Ctrl+A` (Windows/Linux) in file explorer
- **Bulk Actions** - Apply operations to multiple selected files

## Tab Management

### Tab Interface
The multi-tab interface provides:
- **Tab Bar** - Shows all open files as tabs
- **Active Tab** - Currently visible file highlighted
- **Tab Controls** - Close buttons and file status indicators
- **Tab Overflow** - Scroll through tabs when many files are open
- **Tab Grouping** - Group related tabs together (future feature)

### Tab Operations

#### Opening Files in Tabs
- **Single Click** - Opens file in existing tab or new tab
- **Double Click** - Always opens in new tab
- **Middle Click** - Opens in new tab in background
- **Ctrl/Cmd + Click** - Opens in new tab

#### Tab Navigation
- **Click Tab** - Switch to that file
- **Keyboard Navigation** - `⌘⌥←/→` (macOS) / `Ctrl+Alt+Left/Right` (Windows/Linux)
- **Tab List** - View all open tabs in Command Palette
- **Recent Files** - Quick access to recently closed files

#### Closing Tabs
- **Close Button** - Click X on tab
- **Keyboard Shortcut** - `⌘W` (macOS) / `Ctrl+W` (Windows/Linux)
- **Middle Click** - Middle-click tab to close
- **Close All** - Command Palette → "Close All Tabs"
- **Close Others** - Right-click tab → "Close Others"

### Tab Features
- **Unsaved Indicator** - Dot indicator for files with unsaved changes
- **Drag Reordering** - Drag tabs to reorder them
- **Split View** - Open files side-by-side (future feature)
- **Pin Tabs** - Pin frequently used files (future feature)

## File Status and Indicators

### File State Indicators
- **Modified** - Bold filename for unsaved changes
- **Saved** - Normal filename for saved files
- **Error** - Red indicator for files with errors
- **Readonly** - Lock icon for read-only files
- **Linked** - Special indicator for files with wiki links

### File Type Recognition
- **File Icons** - Different icons for different file types
- **Syntax Highlighting** - Automatic language detection
- **File Associations** - Custom handling for specific file types
- **Preview Support** - Preview capabilities for supported formats

## Advanced File Features

### File Search and Filtering
- **Quick Filter** - Type to filter visible files in explorer
- **File Type Filter** - Show only specific file types
- **Modified Date Filter** - Filter by when files were last modified
- **Size Filter** - Filter by file size ranges

### File Metadata
- **Creation Date** - When file was created
- **Modification Date** - When file was last modified
- **File Size** - Size of file content
- **Word Count** - Word count for text files
- **Character Count** - Character count including whitespace

### File History and Versions
- **Auto-save History** - Automatic backup of file changes
- **Version Comparison** - Compare different versions of files
- **Restore Previous** - Restore file to previous version
- **Change Timeline** - Visual timeline of file changes

## System Integration

### Operating System Integration
- **Reveal in Finder/Explorer** - Show file in system file manager
- **Open with System App** - Open file in default system application
- **System File Operations** - Copy, move, delete operations sync with OS
- **File Permissions** - Respect system file permissions and restrictions

### External Applications
- **Open With** - Choose specific application to open file
- **Default Applications** - Set default apps for file types
- **Terminal Integration** - Open terminal in file location
- **Version Control** - Integration with Git and other VCS systems

### Import and Export
- **Drag and Drop Import** - Drag files from system into workspace
- **Bulk Import** - Import multiple files or folders at once
- **Export Options** - Export files in various formats
- **Backup and Restore** - Full workspace backup and restore capabilities

## File Organization Strategies

### Folder Structure Best Practices
1. **Hierarchical Organization** - Use folders to group related content
2. **Consistent Naming** - Develop and follow naming conventions
3. **Project-based Structure** - Organize by projects or topics
4. **Date-based Organization** - Use dates for time-sensitive content
5. **Tag-based System** - Use tags as alternative to folder hierarchy

### File Naming Conventions
- **Descriptive Names** - Use clear, descriptive file names
- **No Special Characters** - Avoid characters that cause system issues
- **Consistent Formatting** - Use consistent date formats and separators
- **Version Numbers** - Include version information when appropriate
- **Category Prefixes** - Use prefixes to group related files

### Workspace Organization
- **Separate Workspaces** - Use different workspaces for different projects
- **Shared Resources** - Common files accessible across workspaces
- **Archive Strategy** - Move completed projects to archive workspaces
- **Template Workspaces** - Create template workspaces for new projects

## Performance and Optimization

### Large File Handling
- **Lazy Loading** - Load file content only when needed
- **Streaming** - Stream large files for better performance
- **Background Processing** - Process large operations in background
- **Memory Management** - Efficient memory usage for large files

### File System Monitoring
- **Real-time Updates** - Detect external file changes automatically
- **Change Notifications** - Notify when files change outside application
- **Conflict Resolution** - Handle conflicts when same file modified externally
- **Sync Status** - Show status of file synchronization

### Performance Optimization
- **File Indexing** - Index files for faster search and access
- **Cache Management** - Cache frequently accessed files
- **Thumbnail Generation** - Generate previews for supported file types
- **Background Cleanup** - Clean up temporary files and caches

## Accessibility

### Keyboard Navigation
- **Full Keyboard Access** - All file operations accessible via keyboard
- **Tab Navigation** - Navigate through file explorer using Tab key
- **Arrow Key Navigation** - Navigate file tree with arrow keys
- **Keyboard Shortcuts** - Comprehensive shortcuts for all operations

### Screen Reader Support
- **File Tree Announcements** - Announce file tree structure and navigation
- **File Status** - Announce file status and metadata
- **Operation Feedback** - Announce results of file operations
- **Context Information** - Provide context about current file location

### Visual Accessibility
- **High Contrast** - File explorer supports high contrast modes
- **Icon Alternatives** - Text alternatives for file type icons
- **Focus Indicators** - Clear visual focus indicators
- **Scalable Interface** - Interface scales with system settings

## Security and Permissions

### File Permissions
- **Read/Write Control** - Respect system file permissions
- **Access Restrictions** - Honor file access restrictions
- **Permission Indicators** - Show file permission status
- **Safe Operations** - Prevent accidental data loss

### Security Features
- **Safe Delete** - Move to trash instead of permanent deletion
- **Backup Before Operations** - Automatic backup before risky operations
- **Undo Support** - Undo file operations when possible
- **Confirmation Dialogs** - Confirm destructive operations

## Troubleshooting

### Common Issues

**Files not appearing in explorer:**
- Check if workspace is properly loaded
- Verify file permissions and access rights
- Look for hidden files or system files
- Try refreshing the file explorer

**Cannot create or modify files:**
- Check file system permissions
- Verify available disk space
- Ensure files are not locked by other applications
- Check if workspace directory is read-only

**File operations slow or failing:**
- Check available system resources
- Verify network connectivity for remote files
- Look for antivirus software interference
- Try closing other resource-intensive applications

**Tabs not updating correctly:**
- Check if files have been moved or deleted externally
- Try closing and reopening affected tabs
- Verify file synchronization status
- Restart application if tabs become corrupted

### Performance Tips
1. **Organize efficiently** - Use clear folder structure to reduce clutter
2. **Close unused tabs** - Keep only necessary files open
3. **Regular cleanup** - Remove or archive old, unused files
4. **Monitor workspace size** - Very large workspaces may impact performance
5. **Use appropriate file types** - Choose efficient formats for your content

## Related Features

- **[Command Palette](./command-palette.md)** - Quick access to file operations
- **[Search](./search.md)** - Finding files and content
- **[Context Menus](./context-menus.md)** - Right-click file operations
- **[Workspace Settings](./workspace-settings.md)** - Workspace configuration
- **[Template System](./template-system.md)** - File creation from templates

---

*For technical file management implementation details, see the [File System API Documentation](../api/filesystem.md).*