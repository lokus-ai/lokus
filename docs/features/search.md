# Search System

Lokus provides a comprehensive search system that enables you to quickly find information across your entire workspace. The search system includes global workspace search, in-file search, and advanced filtering capabilities.

## Overview

The search system offers:
- **Global workspace search** - Find content across all files and notes
- **In-file search** - Search within the current document
- **Advanced filters** - Filter by file type, date, tags, and more
- **Real-time results** - Search results update as you type
- **Full-text indexing** - Fast search across large workspaces
- **Smart ranking** - Relevant results prioritized intelligently

## Global Search

### Opening Global Search
- **Keyboard Shortcut**: `⌘⇧F` (macOS) / `Ctrl+Shift+F` (Windows/Linux)
- **Command Palette**: Search for "Search in Files" (`⌘K`)
- **Search Panel**: Click search icon in sidebar
- **Menu**: View → Search

### Search Interface
The search panel provides:
- **Search Input** - Main search query field
- **Results List** - Matching files and content snippets
- **Filter Controls** - Refine search with filters
- **Preview Pane** - Preview file content without opening
- **Replace Panel** - Find and replace across multiple files

### Basic Search Features

#### Text Search
- **Exact Match** - Search for exact phrases in quotes: `"specific phrase"`
- **Wildcard Search** - Use `*` for partial matches: `file*.md`
- **Case Sensitivity** - Toggle case-sensitive search
- **Whole Word** - Match complete words only
- **Regular Expressions** - Advanced pattern matching with regex

#### Search Operators
```
Simple text search:         hello world
Exact phrase:               "hello world"
Wildcard:                   hello*
Multiple terms (AND):       hello AND world
Alternative terms (OR):     hello OR hi
Exclusion (NOT):           hello NOT world
Parentheses for grouping:   (hello OR hi) AND world
```

#### File Type Filtering
- **Include Types** - Search only specific file types: `*.md`, `*.txt`
- **Exclude Types** - Exclude certain file types: `!*.log`
- **Multiple Types** - Combine multiple patterns: `*.md,*.txt`

### Advanced Search Features

#### Date-based Search
- **Modified Date** - Find files modified within date range
- **Created Date** - Search by file creation date
- **Relative Dates** - Use relative terms: "last week", "yesterday"
- **Date Ranges** - Specify exact date ranges: `2024-01-01 to 2024-12-31`

#### Content-based Filters
- **File Size** - Filter by file size ranges
- **Word Count** - Find files with specific word counts
- **Tag Search** - Search for files with specific tags
- **Link Search** - Find files that link to specific other files

#### Search Results

#### Results Display
- **File Path** - Full path to matching file
- **Content Preview** - Snippet showing search match in context
- **Match Count** - Number of matches found in each file
- **Relevance Score** - Relevance ranking based on multiple factors
- **Last Modified** - When the file was last changed

#### Results Interaction
- **Click to Open** - Click result to open file in editor
- **Preview on Hover** - Hover for expanded content preview
- **Jump to Match** - Navigate directly to search match location
- **Context Menu** - Right-click for file operations

## In-File Search

### Opening In-File Search
- **Keyboard Shortcut**: `⌘F` (macOS) / `Ctrl+F` (Windows/Linux)
- **Menu**: Edit → Find
- **Context Menu**: Right-click in editor → Find

### In-File Search Features

#### Basic Find
- **Find Input** - Search within current document
- **Match Highlighting** - All matches highlighted in editor
- **Navigation** - Previous/next match navigation
- **Match Counter** - Current match position and total count

#### Find and Replace
- **Replace Input** - Replacement text field
- **Replace One** - Replace current match
- **Replace All** - Replace all matches in document
- **Replace in Selection** - Replace only within selected text

#### Advanced In-File Options
- **Case Sensitive** - Toggle case-sensitive matching
- **Whole Word** - Match complete words only
- **Regular Expression** - Use regex patterns for complex searches
- **Search in Selection** - Limit search to selected text

### Search Navigation
- **Next Match** - `⌘G` (macOS) / `Ctrl+G` (Windows/Linux)
- **Previous Match** - `⌘⇧G` (macOS) / `Ctrl+Shift+G` (Windows/Linux)
- **Escape** - Close search panel
- **Enter** - Find next match

## Search Filters and Options

### Filter Types

#### File Filters
- **File Extension** - `.md`, `.txt`, `.js`, etc.
- **File Name Pattern** - Wildcard patterns for file names
- **Directory Path** - Search within specific folders
- **File Size Range** - Minimum and maximum file sizes

#### Content Filters
- **Contains Text** - Files containing specific text
- **Missing Text** - Files NOT containing specific text
- **Language Detection** - Search by detected content language
- **Encoding Type** - Filter by file encoding

#### Metadata Filters
- **Creation Date** - When file was created
- **Modification Date** - When file was last modified
- **Author Information** - Based on file metadata
- **Tag Categories** - Files tagged with specific categories

### Advanced Filter Combinations
Combine multiple filters for precise searches:
```
Text: "project planning"
File Type: *.md
Modified: last 30 days
Directory: /projects/
Size: > 1KB
```

## Search Performance and Indexing

### Full-Text Indexing
- **Automatic Indexing** - Files indexed automatically when added/modified
- **Background Processing** - Indexing doesn't block other operations
- **Incremental Updates** - Only changed files are re-indexed
- **Index Optimization** - Periodic optimization for better performance

### Performance Features
- **Real-time Search** - Results appear as you type
- **Debounced Queries** - Prevents excessive search requests
- **Result Caching** - Cache recent search results for faster access
- **Lazy Loading** - Load additional results on demand

### Large Workspace Handling
- **Selective Indexing** - Choose which directories to index
- **File Type Exclusions** - Exclude large binary files from indexing
- **Index Size Monitoring** - Monitor index size and performance
- **Memory Management** - Efficient memory usage for large indexes

## Search Integration

### Command Palette Integration
- **Unified Search** - Search files, commands, and templates together
- **Recent Searches** - Access recent search queries quickly
- **Search History** - Navigate through previous searches
- **Quick Filters** - Apply common filters from Command Palette

### Note Integration
- **Wiki Link Search** - Find notes that link to current note
- **Backlink Discovery** - Find all notes linking to any note
- **Tag-based Search** - Search notes by assigned tags
- **Reference Search** - Find references to specific content

### Plugin Integration
- **Search Extensions** - Plugins can extend search functionality
- **Custom Filters** - Plugins can add custom search filters
- **Search Providers** - Alternative search backends through plugins
- **Results Enhancement** - Plugins can enhance search results

## Search Tips and Best Practices

### Effective Search Strategies

#### Query Construction
1. **Start Broad** - Begin with general terms, then narrow down
2. **Use Quotes** - Exact phrases for specific content
3. **Combine Terms** - Use AND/OR operators for complex queries
4. **Exclude Noise** - Use NOT operator to filter out irrelevant results

#### Filter Usage
1. **File Type First** - Narrow by file type before text search
2. **Date Ranges** - Use date filters for recent content
3. **Directory Focus** - Search within specific project folders
4. **Tag Organization** - Leverage tags for content categorization

### Search Optimization
1. **Consistent Naming** - Use consistent file naming conventions
2. **Tag Strategy** - Develop a systematic tagging approach
3. **Content Structure** - Organize content with clear headings
4. **Regular Cleanup** - Remove or archive outdated files

## Accessibility

### Keyboard Navigation
- **Full Keyboard Access** - All search features accessible via keyboard
- **Tab Navigation** - Move between search fields and results
- **Arrow Keys** - Navigate through search results
- **Enter to Open** - Open selected search result

### Screen Reader Support
- **Search Announcements** - Announce search progress and results
- **Result Descriptions** - Describe search result content
- **Navigation Hints** - Provide navigation instructions
- **Status Updates** - Announce search status changes

### Visual Accessibility
- **High Contrast** - Search interface supports high contrast modes
- **Focus Indicators** - Clear visual focus indicators
- **Scalable Text** - Text scales with system font size
- **Color Independence** - Information not conveyed through color alone

## Search Customization

### Search Preferences
Access search settings through Preferences:

#### Search Behavior
- **Search as You Type** - Enable/disable real-time search
- **Include Hidden Files** - Search in hidden files and folders
- **Follow Symlinks** - Include symbolic links in search
- **Case Sensitivity Default** - Default case sensitivity setting

#### Performance Settings
- **Index Size Limit** - Maximum size for search index
- **Background Indexing** - Enable/disable background indexing
- **Search Result Limit** - Maximum number of results to display
- **Cache Duration** - How long to cache search results

#### Display Options
- **Preview Length** - Length of content preview in results
- **Highlight Style** - How to highlight search matches
- **Result Grouping** - Group results by file type or directory
- **Sort Order** - Default sort order for search results

## Troubleshooting

### Common Issues

**Search not finding expected results:**
- Check if files are properly indexed
- Verify search terms and spelling
- Check if filters are excluding relevant files
- Try rebuilding the search index

**Slow search performance:**
- Reduce search scope with filters
- Check available system memory
- Limit search to specific directories
- Exclude large binary files from indexing

**Search index problems:**
- Clear and rebuild search index
- Check disk space for index storage
- Verify file permissions for indexing
- Restart application to reset index

**Regular expression errors:**
- Verify regex syntax is correct
- Test regex patterns in simple cases first
- Check for special characters that need escaping
- Use simpler patterns if complex ones fail

### Performance Tips
1. **Use specific terms** - More specific searches are faster
2. **Leverage filters** - File type and date filters improve performance
3. **Regular index maintenance** - Periodically rebuild search index
4. **Monitor index size** - Large indexes may impact performance
5. **Exclude unnecessary files** - Don't index files you won't search

## Advanced Search Techniques

### Regular Expression Examples
```
Find email addresses:    \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b
Find phone numbers:      \b\d{3}-\d{3}-\d{4}\b
Find URLs:              https?://[^\s]+
Find markdown links:     \[([^\]]+)\]\(([^)]+)\)
Find wiki links:         \[\[([^\]]+)\]\]
Find dates:             \b\d{4}-\d{2}-\d{2}\b
```

### Complex Query Examples
```
Find recent project files:
  Text: project AND (planning OR roadmap)
  Type: *.md
  Modified: last 7 days

Find TODO items:
  Text: TODO OR FIXME OR "action item"
  Type: *.md,*.txt
  
Find large documentation:
  Type: *.md
  Size: > 10KB
  Directory: /docs/

Find orphaned notes (no links):
  Text: NOT [[*
  Type: *.md
```

## Related Features

- **[Command Palette](./command-palette.md)** - Unified search interface
- **[File Management](./file-management.md)** - File organization and navigation
- **[Wiki Links](./wiki-links.md)** - Note connection and discovery
- **[Tags System](./tags.md)** - Content categorization and filtering

---

*For technical search implementation details, see the [Search API Documentation](../api/search.md).*