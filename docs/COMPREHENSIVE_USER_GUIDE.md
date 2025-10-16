# Lokus Comprehensive User Guide

**Version:** 1.3.1
**Last Updated:** October 2025
**Status:** Production Ready

> **Note:** This guide covers all features as of v1.3.1. Lokus has evolved significantly with major new capabilities including Bases (database views), MCP AI integration, OAuth authentication, and advanced performance optimizations.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Features](#core-features)
4. [Bases - Database System](#bases---database-system)
5. [MCP AI Integration](#mcp-ai-integration)
6. [Advanced Editor Features](#advanced-editor-features)
7. [Knowledge Graph](#knowledge-graph)
8. [Kanban Task Management](#kanban-task-management)
9. [Canvas & Visual Thinking](#canvas--visual-thinking)
10. [Authentication & Sync](#authentication--sync)
11. [Customization & Themes](#customization--themes)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Tips & Best Practices](#tips--best-practices)

---

## Introduction

### What is Lokus?

Lokus is a **lightning-fast, privacy-first knowledge management system** built with Tauri (Rust) and React. It combines the power of local-first markdown editing with advanced features like database views, AI integration, and knowledge graphs—all without requiring plugins or cloud dependencies.

### Why Lokus?

| Traditional Tools | Lokus |
|-------------------|-------|
| ❌ Requires 10+ plugins | ✅ Everything built-in |
| ❌ Slow, bloated (100MB+) | ✅ Fast, lightweight (~10MB) |
| ❌ Electron-based | ✅ Rust-powered (Tauri) |
| ❌ Cloud lock-in | ✅ Your files, your storage |
| ❌ Plugin dependencies | ✅ Core features included |

### Key Differentiators

- **🚀 Native Performance** - Rust backend for sub-second operations
- **🗄️ Built-in Database Views** - Notion-like tables without plugins
- **🤖 AI Integration** - MCP protocol support for AI assistants
- **🕸️ Advanced Graphs** - 2D/3D knowledge visualization
- **⌨️ Keyboard-First** - Optimized for power users
- **🔒 Privacy-First** - All data local, optional cloud sync
- **🎨 Deeply Customizable** - Themes, layouts, workflows

---

## Getting Started

### Installation

#### macOS

```bash
# Download .dmg from releases
# Or use Homebrew (coming soon)
brew install lokus
```

#### Windows

```bash
# Download installer from releases
# Portable version available
```

#### Linux

```bash
# AppImage (universal)
wget https://github.com/lokus-ai/lokus/releases/latest/download/lokus.AppImage
chmod +x lokus.AppImage
./lokus.AppImage
```

#### Build from Source

```bash
git clone https://github.com/lokus-ai/lokus.git
cd lokus
npm install
npm run tauri dev  # Development
npm run tauri build  # Production
```

### First Launch

1. **Welcome Screen** - Choose to create a new workspace or open existing
2. **Workspace Setup** - Select a folder for your knowledge base
3. **Initial Configuration** - Set preferences (theme, editor settings)
4. **Start Creating** - Begin with your first note!

### Workspace Structure

```
my-workspace/
├── notes/              # Your markdown files
├── kanban/            # Kanban board data
├── canvas/            # Canvas files
├── templates/         # Note templates
├── .lokus/            # Lokus metadata (hidden)
│   ├── bases/        # Database configurations
│   ├── graph/        # Graph data cache
│   └── config.json   # Workspace settings
```

---

## Core Features

### Rich Markdown Editor

#### Supported Syntax

- **Headers** - `#` through `######`
- **Emphasis** - `**bold**`, `*italic*`, `~~strikethrough~~`, `==highlight==`
- **Lists** - Unordered (`-`), ordered (`1.`), task lists (`- [ ]`)
- **Links** - Web links, WikiLinks `[[Note Name]]`, internal references
- **Images** - Local and web images
- **Code** - Inline \`code\` and blocks with syntax highlighting
- **Math** - Inline `$x^2$` and block `$$E=mc^2$$` with KaTeX
- **Tables** - GitHub Flavored Markdown tables
- **Blockquotes** - `> Quote text`
- **Horizontal Rules** - `---` or `***`
- **Footnotes** - `[^1]` with definitions

[📹 Placeholder: Video tutorial on markdown editing]

#### Advanced Features

**Smart Paste**
- Paste formatted text → automatically converts to markdown
- Paste URLs → creates proper links
- Paste images → saves and embeds locally

**Auto-completion**
- WikiLink suggestions as you type `[[`
- Tag completions with `#`
- Template insertion with `/`

**Real-time Preview**
- WYSIWYG editing experience
- Live math rendering
- Syntax highlighting in code blocks

### WikiLinks & Backlinks

#### Creating Links

```markdown
[[Note Name]]                 # Basic link
[[Note Name|Display Text]]    # Link with custom text
[[Note Name#Heading]]         # Link to specific heading
```

#### Backlinks Panel

View all notes that link to the current note:
- Automatic backlink detection
- Context snippets
- Click to navigate

[📹 Placeholder: Video on WikiLinks and navigation]

### File Management

#### Creating Notes

- **Quick Create**: `Cmd/Ctrl+N`
- **From Template**: Use command palette
- **In Folder**: Right-click in file explorer

#### Organization

- **Folders**: Unlimited nesting
- **Tags**: Use `#tag` in frontmatter or content
- **Favorites**: Star important notes
- **Recent**: Access recently edited notes

#### File Operations

- **Rename**: F2 or right-click
- **Move**: Drag & drop in file explorer
- **Delete**: Delete key or right-click
- **Duplicate**: Right-click → Duplicate

---

## Bases - Database System

> **New in v1.3!** Bases bring Notion-like database views to your markdown files.

### What are Bases?

Bases transform your markdown files into queryable databases with:
- **Table Views** - Spreadsheet-like display with sorting & filtering
- **Custom Properties** - Add metadata via YAML frontmatter
- **Multiple Views** - Different perspectives on the same data
- **Real-time Updates** - Changes reflect immediately
- **No Vendor Lock-in** - Still plain markdown files

[📹 Placeholder: Bases overview and demo]

### Creating Your First Base

1. **Open Bases View** - Click "Bases" in sidebar or `Cmd/Ctrl+Shift+B`
2. **Create New Base** - Click "New Base" button
3. **Configure Source** - Select folder to query
4. **Add Properties** - Define columns (tags, status, dates, etc.)
5. **Customize View** - Set default sorting, filters

### Working with Properties

#### Property Types

| Type | Description | Example |
|------|-------------|---------|
| **Text** | Single-line text | "Project Name" |
| **Number** | Numeric values | 42 |
| **Date** | Date/datetime | 2025-10-15 |
| **Select** | Single choice | Status: "In Progress" |
| **Multi-select** | Multiple choices | Tags: ["work", "urgent"] |
| **Checkbox** | Boolean value | Completed: true |
| **URL** | Web links | https://example.com |
| **Email** | Email addresses | user@example.com |

#### Adding Properties via Frontmatter

```markdown
---
title: My Project Note
status: In Progress
priority: High
tags:
  - work
  - project
due_date: 2025-12-31
completed: false
---

# Note content here...
```

### Table View Features

#### Sorting

- **Single Column**: Click column header
- **Multiple Columns**: Hold Shift + click headers
- **Direction**: Click again to toggle ascending/descending
- **Persist**: Sorting preferences saved per base

#### Filtering

**Basic Filters:**
```
Text: contains, equals, starts with, ends with
Number: =, >, <, >=, <=, between
Date: before, after, between, relative (last 7 days)
Tags: contains any, contains all
```

**Advanced Filters:**
- Combine with AND/OR logic
- Nested filter groups
- Save filter presets
- Export filtered results

[📹 Placeholder: Advanced filtering tutorial]

#### Column Management

- **Reorder**: Drag column headers
- **Resize**: Drag column edges
- **Show/Hide**: Toggle in Properties dropdown
- **Pin**: Freeze columns to left
- **Width Presets**: Auto, fit content, custom

### Multiple Views

Create different perspectives:
- **All Notes**: Default view of everything
- **Active Projects**: Filter for in-progress work
- **This Week**: Date-filtered view
- **By Priority**: Sorted and grouped
- **Archive**: Completed items

### Advanced Features

#### Grouping
- Group by any property
- Collapsible groups
- Aggregate counts
- Nested grouping support

#### Calculated Fields
- Formula support (coming soon)
- Rollup values from linked notes
- Automatic calculations

#### Export Options
- CSV export
- JSON export
- Markdown table export

[📹 Placeholder: Advanced Bases features walkthrough]

---

## MCP AI Integration

> **New in v1.3!** Model Context Protocol enables AI assistants to interact with Lokus.

### What is MCP?

MCP (Model Context Protocol) is a standardized way for AI tools to interact with applications. Lokus includes a built-in MCP server with **68+ tools** for AI assistants.

### Supported AI Tools

- **Desktop (Stdio)** - Direct AI assistant integration
- **CLI Tools (HTTP)** - Command-line AI tools
- **Custom Integrations** - Build your own with MCP SDK

### Auto-Start Feature

**Zero Configuration Required!**
- MCP server starts automatically when Lokus launches
- Desktop config created at `~/.lokus/mcp-server/`
- HTTP server runs on `localhost:3456`
- Both transports available simultaneously

### Available Tool Categories

#### 1. Note Management (11 tools)

- `create_note` - Create notes with templates
- `update_note` - Edit existing notes
- `link_notes` - Create WikiLinks between notes
- `resolve_wikilinks` - Fix broken links
- `extract_note_outline` - Generate outline from headers
- `generate_note_summary` - AI-powered summaries
- `organize_note_sections` - Reorder content intelligently
- `convert_tasks_to_kanban` - Extract tasks to boards
- `duplicate_note` - Smart duplication with link updates
- `get_note_templates` - List available templates
- `get_note_history` - Track note changes

#### 2. Workspace Management (12 tools)

- `initialize_workspace` - Set up new workspace
- `get_workspace_info` - Analyze workspace structure
- `backup_workspace` - Create versioned backups
- `restore_workspace` - Restore from backup
- `export_workspace` - Export to various formats
- `import_content` - Import from external sources
- `clean_workspace` - Remove orphaned files
- `analyze_workspace_health` - Health checks
- `sync_workspace` - Sync with external storage
- `update_workspace_config` - Modify settings
- `get_workspace_backups` - List available backups
- `get_workspace_history` - Activity timeline

#### 3. Advanced Search (16 tools)

- `search_content` - Full-text search with regex
- `search_wiki_links` - Find link relationships
- `find_broken_links` - Detect broken references
- `get_graph_data` - Generate knowledge graph
- `search_by_tags` - Tag-based discovery
- `search_recent` - Recently modified files
- `search_favorites` - Bookmarked content
- `get_file_links` - Relationship mapping
- `get_backlinks` - Reverse link analysis
- `navigate_to` - Smart navigation
- `search_files` - Advanced file discovery
- `find_similar` - Content similarity detection
- `analyze_workspace` - Pattern analysis
- `get_search_suggestions` - AI recommendations
- `get_search_history` - Search analytics
- Plus more specialized tools

#### 4. AI Analysis (10 tools)

- `analyze_content` - Deep content analysis
- `generate_insights` - Pattern detection
- `suggest_connections` - Intelligent linking
- `analyze_writing_patterns` - Style analysis
- `detect_knowledge_gaps` - Gap identification
- `optimize_structure` - Organization tips
- `analyze_collaboration_patterns` - Team insights
- `predict_content_needs` - Predictive planning
- `analyze_content_quality` - Quality assessment
- `get_ai_history` - AI operation tracking

#### 5. File Operations (6 tools)

- `read_file` - Read file contents
- `write_file` - Create/update files
- `list_files` - Directory browsing
- `get_file_metadata` - File information
- Plus standard file operations

#### 6. Editor Enhancements (10 tools)

- `format_text` - Apply formatting (bold, italic, code)
- `insert_link` - Add WikiLinks or URLs
- `insert_math` - Insert LaTeX equations
- `insert_table` - Create tables
- `create_task_list` - Generate task lists
- `insert_heading` - Add headers
- `insert_list` - Create lists
- `get_file_content` - Read with statistics
- `replace_content` - Search & replace
- `insert_code_block` - Add code with syntax highlighting

[📹 Placeholder: MCP integration setup and usage]

### Using AI Assistants with Lokus

#### Example Workflows

**Research Assistant:**
```
AI: "Analyze my research notes and suggest connections"
→ Uses: analyze_content, suggest_connections, create_note
```

**Content Organizer:**
```
AI: "Reorganize my project notes by priority"
→ Uses: search_by_tags, update_note, organize_note_sections
```

**Knowledge Curator:**
```
AI: "Find gaps in my knowledge base about [topic]"
→ Uses: search_content, detect_knowledge_gaps, generate_insights
```

### Configuration

#### Desktop Configuration
Automatically created at:
```
~/.lokus/mcp-server/claude_desktop_config.json
```

#### CLI Configuration
```
~/.lokus/mcp-server/cline_mcp_settings.json
```

[📹 Placeholder: Advanced MCP workflows]

---

## Advanced Editor Features

### Split Pane System

> **New in v1.3!** Professional split-pane editing like VS Code.

#### Features

- **Vertical Split** - Side-by-side editing
- **Horizontal Split** - Top/bottom layout
- **Independent Scrolling** - Each pane scrolls separately
- **Synchronized Scrolling** - Optional linked scrolling
- **Resizable Panes** - Drag divider to adjust
- **Different File Types** - Markdown, Kanban, Canvas, Graph in each pane

#### Keyboard Shortcuts

- `Cmd/Ctrl+\` - Toggle split view
- `Cmd/Ctrl+Shift+\` - Change split direction
- `Cmd/Ctrl+0` - Reset pane sizes to 50/50
- `Cmd/Ctrl+Shift+S` - Toggle synchronized scrolling

[📹 Placeholder: Split pane editing demo]

### Markdown Syntax Customization

> **New in v1.3!** Customize how markdown renders in the editor.

#### Custom Syntax Options

- **WikiLink Style** - Choose bracket style and colors
- **Heading Sizes** - Adjust relative sizes
- **Code Block Themes** - Light/dark syntax highlighting
- **Math Rendering** - KaTeX customization
- **List Styles** - Bullet and number formatting

#### Access Settings

Preferences → Editor → Markdown Syntax

[📹 Placeholder: Customizing markdown syntax]

### Command Palette

**Quick Actions**: `Cmd/Ctrl+P`

Available commands:
- File operations (create, rename, delete)
- View switching (Editor, Graph, Kanban, Bases)
- Tool activation (search, command palette)
- Layout changes (split pane, focus mode)
- Workspace actions (backup, export, sync)

### Templates

#### Using Templates

1. Create template files in `templates/` folder
2. Use command palette → "New from Template"
3. Or use slash command `/template` in editor

#### Template Variables

```markdown
---
title: {{title}}
date: {{date}}
author: {{author}}
---

# {{title}}

Created on {{date}}
```

Supported variables:
- `{{title}}` - Note title
- `{{date}}` - Current date
- `{{time}}` - Current time
- `{{author}}` - Your name (from settings)
- `{{uuid}}` - Unique identifier

[📹 Placeholder: Creating and using templates]

---

## Knowledge Graph

### Graph Visualization

Lokus includes powerful graph visualization for understanding connections between your notes.

#### Graph Types

**2D Graph**
- Fast, flat visualization
- Clear node labels
- Color-coded by type/tag
- Interactive exploration

**3D Graph**
- Spatial relationships
- Depth perception
- Immersive navigation
- Physics simulation

[📹 Placeholder: Navigating the knowledge graph]

### Graph Features

#### Node Customization

- **Size** - Based on backlink count or manual
- **Color** - By tags, folders, or custom rules
- **Labels** - Show/hide, adjust size
- **Icons** - File type indicators

#### Link Visualization

- **Link Strength** - Visual weight based on connections
- **Directional** - Show link direction
- **Grouped** - Cluster by similarity
- **Filtered** - Show only relevant links

#### Interaction

- **Click** - Open note
- **Hover** - Preview content
- **Drag** - Rearrange nodes
- **Zoom** - Mouse wheel or pinch
- **Pan** - Click and drag background

### Graph Filters

Filter by:
- **Tags** - Show only specific tags
- **Folders** - Limit to folder
- **Link Type** - WikiLinks, citations, etc.
- **Date Range** - Recent connections
- **Depth** - Limit connection hops

[📹 Placeholder: Advanced graph filtering and navigation]

### Graph Layouts

- **Force-directed** - Physics-based automatic layout
- **Hierarchical** - Tree structure
- **Circular** - Ring arrangement
- **Grid** - Organized grid
- **Custom** - Manual positioning (saved)

---

## Kanban Task Management

> **Enhanced in v1.3!** Keyboard-first task management with HashMap backend.

### Kanban Boards

#### Creating Boards

1. Click "Kanban" in sidebar or `Cmd/Ctrl+K`
2. Create new board or open existing
3. Boards saved as `.kanban` files in workspace

#### Board Structure

```
kanban/
├── personal.kanban
├── work-project.kanban
└── reading-list.kanban
```

### Working with Cards

#### Creating Cards

- **Mouse**: Click "Add Card" in column
- **Keyboard**: `N` on focused column
- **Quick Add**: `Q` for quick entry
- **From Note**: Drag markdown note to board

#### Card Properties

- **Title** - Card name
- **Description** - Detailed markdown content
- **Tags** - Categorize cards
- **Due Date** - Deadline tracking
- **Priority** - High/Medium/Low
- **Assignee** - Who's responsible
- **Links** - Related notes

#### Moving Cards

- **Drag & Drop** - Visual reordering
- **Keyboard**:
  - `H/L` - Move left/right between columns
  - `J/K` - Move up/down within column
  - `Enter` - Edit card
  - `Delete` - Remove card

[📹 Placeholder: Keyboard-first Kanban workflow]

### Column Management

#### Default Columns

- Todo
- In Progress
- Done

#### Custom Columns

- Add: Click "+" at top
- Rename: Click column title
- Reorder: Drag column headers
- Delete: Right-click → Delete (moves cards to previous column)
- Color: Set column color for visual organization

### Advanced Features

#### Filtering & Search

- Search cards by title/content
- Filter by tags
- Filter by due date
- Filter by assignee
- Filter by priority

#### Archiving

- Archive completed columns
- View archived cards
- Restore from archive
- Bulk archive operations

#### Export & Sync

- Export to JSON
- Export to Markdown checklist
- Sync with calendar (coming soon)
- Integrate with Bases views

[📹 Placeholder: Advanced Kanban features]

---

## Canvas & Visual Thinking

### Infinite Canvas

Lokus includes an infinite canvas for visual brainstorming and diagram creation.

#### Canvas Features

- **Infinite Space** - Unlimited canvas size
- **Pan & Zoom** - Navigate smoothly
- **Multiple Tools** - Drawing, shapes, text, arrows
- **Embed Notes** - Link to markdown files
- **Images** - Add visual references
- **Connections** - Link elements with arrows

[📹 Placeholder: Canvas basics and features]

### Canvas Elements

#### Drawing Tools

- **Pen** - Freehand drawing
- **Shapes** - Rectangles, circles, diamonds
- **Lines & Arrows** - Connections
- **Text** - Labels and annotations
- **Sticky Notes** - Quick thoughts

#### Organization

- **Groups** - Organize elements
- **Layers** - Z-index management
- **Alignment** - Snap to grid or align tools
- **Distribution** - Even spacing

### Exporting

- **PNG** - Raster export
- **SVG** - Vector export
- **PDF** - Print-ready format
- **JSON** - Canvas data for backup

[📹 Placeholder: Creating diagrams on Canvas]

---

## Authentication & Sync

> **New in v1.3!** OAuth 2.0 authentication for cloud features.

### OAuth Authentication

#### Signing In

1. Click "Sign In" in status bar
2. Browser opens to Lokus web platform
3. Complete authentication
4. Automatically returns to app
5. Authenticated! ✓

#### Features

- **PKCE Security** - Industry-standard OAuth flow
- **Secure Storage** - Tokens in system keychain
- **Auto-Refresh** - Seamless token renewal
- **Cross-Device** - Same account on all devices

[📹 Placeholder: Authentication and cloud setup]

### Cloud Sync (Optional)

When authenticated:
- **Workspace Sync** - Sync workspace across devices
- **Settings Sync** - Preferences follow you
- **Backup** - Automatic cloud backups
- **Collaboration** - Share workspaces (coming soon)

### Privacy

**Your Data, Your Control:**
- Local-first - everything works offline
- Cloud sync is optional
- Choose what syncs
- End-to-end encryption (coming soon)
- Export anytime

---

## Customization & Themes

### Theme System

#### Built-in Themes

- **Light** - Clean, bright workspace
- **Dark** - Easy on the eyes
- **Auto** - Follow system preference
- **Custom** - Create your own

#### Theme Editor

Access: Preferences → Appearance → Edit Theme

Customize:
- **Colors** - All UI elements
- **Typography** - Fonts and sizes
- **Spacing** - Padding and margins
- **Borders** - Radius and colors
- **Animations** - Transition speeds

[📹 Placeholder: Creating custom themes]

### Editor Customization

#### Font Settings

- **Editor Font** - Mono or proportional
- **UI Font** - Interface typeface
- **Font Size** - Adjustable for accessibility
- **Line Height** - Reading comfort
- **Letter Spacing** - Fine-tuning

#### Editor Behavior

- **Auto-save** - Interval or on blur
- **Spell Check** - Enable/disable
- **Line Numbers** - Show/hide
- **Word Wrap** - Soft wrap long lines
- **Tab Size** - Spaces per tab
- **Vim Mode** - Modal editing (coming soon)

### Layout Options

- **Sidebar Position** - Left or right
- **Status Bar** - Show/hide elements
- **Tab Bar** - Always show, auto-hide
- **File Explorer** - Tree depth, sorting
- **Panel Sizes** - Adjust all panels

[📹 Placeholder: Customizing your workspace]

---

## Keyboard Shortcuts

### Essential Shortcuts

#### File Operations
- `Cmd/Ctrl+N` - New note
- `Cmd/Ctrl+O` - Open note
- `Cmd/Ctrl+S` - Save note
- `Cmd/Ctrl+W` - Close tab
- `Cmd/Ctrl+Shift+N` - New workspace

#### Editor
- `Cmd/Ctrl+B` - Bold
- `Cmd/Ctrl+I` - Italic
- `Cmd/Ctrl+K` - Insert link
- `Cmd/Ctrl+Shift+K` - Insert WikiLink
- `Cmd/Ctrl+/` - Toggle comment

#### Navigation
- `Cmd/Ctrl+P` - Command palette
- `Cmd/Ctrl+E` - Recent files
- `Cmd/Ctrl+Shift+F` - Global search
- `Cmd/Ctrl+\` - Toggle split pane
- `Cmd/Ctrl+1-9` - Switch tabs

#### Views
- `Cmd/Ctrl+Shift+G` - Graph view
- `Cmd/Ctrl+Shift+B` - Bases view
- `Cmd/Ctrl+Shift+K` - Kanban view
- `Cmd/Ctrl+Shift+C` - Canvas view

#### Advanced
- `Cmd/Ctrl+Shift+P` - Command palette (alternative)
- `Cmd/Ctrl+F` - Find in note
- `Cmd/Ctrl+H` - Find and replace
- `Cmd/Ctrl+G` - Go to line

[📹 Placeholder: Keyboard shortcuts mastery]

### Custom Shortcuts

Create your own shortcuts:
1. Preferences → Keyboard → Shortcuts
2. Find command
3. Click to record new shortcut
4. Save

---

## Tips & Best Practices

### Organization

**Folder Structure**
```
workspace/
├── 00-inbox/          # Quick capture
├── 01-projects/       # Active work
├── 02-areas/          # Ongoing responsibilities
├── 03-resources/      # Reference materials
├── 04-archive/        # Completed items
└── templates/         # Note templates
```

**Naming Conventions**
- Use descriptive names: `project-planning-2025.md`
- Dates: `YYYY-MM-DD` format for sorting
- Tags: Use frontmatter for better Bases integration
- Avoid special characters in filenames

### WikiLinking Best Practices

1. **Link generously** - Create connections as you think of them
2. **Use descriptive text** - `[[Project|My Great Project]]` vs `[[Project]]`
3. **Review backlinks** - Discover unexpected connections
4. **Fix broken links** - Use MCP tools or Bases filters

### Bases Workflows

**Project Management**
- Create base for all project notes
- Properties: status, priority, due_date, owner
- Views: Active Projects, This Week, By Owner
- Filter: In Progress + High Priority

**Knowledge Base**
- Base for all notes by topic
- Properties: category, tags, last_reviewed
- Views: By Category, Needs Review, Favorites
- Group by: category or tags

**Reading List**
- Base for articles/books
- Properties: status (to-read, reading, done), rating, source
- Sort by: rating, date_added
- Filter: status = "to-read"

[📹 Placeholder: Bases workflow examples]

### Performance Tips

1. **Quantum Features** - Enable for large workspaces (Preferences → Performance)
2. **Index Management** - Rebuild search index periodically
3. **Workspace Size** - Consider splitting very large workspaces (10,000+ notes)
4. **Image Optimization** - Use compressed images for faster loading
5. **Clean Workspace** - Use MCP tools to remove orphaned files

### Backup Strategy

**Local Backups**
- Regular backups to external drive
- Use MCP `backup_workspace` tool
- Export important bases periodically

**Cloud Backups**
- Use your preferred cloud storage (Dropbox, Drive, iCloud)
- Point workspace to synced folder
- Or use built-in OAuth sync (authenticated users)

**Version Control**
- Advanced: Use Git for workspace
- Markdown files are Git-friendly
- Track meaningful changes

### Collaboration

**Sharing Workspaces**
- Share via cloud storage (read-only or collaborative)
- Use consistent folder structure
- Document conventions in README.md
- Consider using bases for task assignment

**Team Workflows**
- Kanban boards for project tracking
- Bases for knowledge sharing
- Graph view for exploring team knowledge
- MCP tools for AI-assisted coordination

---

## Troubleshooting

### Common Issues

**App Won't Start**
- Check system requirements
- Verify no conflicting processes
- Clear cache: `~/.lokus/cache/`
- Reinstall if needed

**Workspace Won't Open**
- Verify folder exists and is accessible
- Check permissions (read/write)
- Look for corrupted `.lokus` folder
- Try creating new workspace

**Slow Performance**
- Enable Quantum optimizations
- Rebuild search index
- Close unused tabs
- Reduce graph node count
- Check for large images

**Bases Not Loading**
- Verify `.base` file format (valid YAML)
- Check source folder path
- Rebuild property index
- Review console for errors

**MCP Tools Not Working**
- Verify MCP server is running (check logs)
- Restart app to restart server
- Check port 3456 not in use
- Review MCP config files

**Authentication Issues**
- Clear browser cache and try again
- Check internet connection
- Verify not behind restrictive firewall
- Try file-based fallback (development)

### Getting Help

- **Documentation**: https://docs.lokus.ai
- **GitHub Issues**: https://github.com/lokus-ai/lokus/issues
- **Community**: https://discord.gg/lokus
- **Email**: support@lokus.ai

---

## Appendix

### File Formats

**Markdown (.md)**
- Standard markdown files
- Optional YAML frontmatter
- UTF-8 encoding

**Kanban (.kanban)**
```json
{
  "columns": [...],
  "cards": [...]
}
```

**Canvas (.canvas)**
```json
{
  "nodes": [...],
  "edges": [...]
}
```

**Base (.base)**
```yaml
name: "Base Name"
sourceFolder: "/path"
columns: [...]
```

### Environment Variables

See `docs/ENVIRONMENT_VARIABLES.md` for complete list.

### API Reference

For plugin development, see:
- `docs/PLUGIN_DEVELOPMENT.md`
- `docs/ui-plugin-development-guide.md`
- `docs/developer/` folder

---

**Last Updated:** October 2025
**Version:** 1.3.1
**Contributors:** Lokus Development Team

[📹 Note: All video placeholders should be replaced with actual video tutorials]
