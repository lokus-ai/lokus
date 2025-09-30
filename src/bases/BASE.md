# Lokus Bases - Database System Implementation

## Overview
Lokus Bases is a powerful database system for markdown files, inspired by Obsidian's database features. It provides table views, filtering, sorting, grouping, and more for your knowledge base.

## Current Implementation Status

### ✅ Phase 0: Foundation (Complete)
- [x] Basic table view with file listings
- [x] Sort functionality with multiple rules
- [x] Properties dropdown with column visibility
- [x] Custom dropdown components (premium styling)
- [x] Folder scope toggle (All Folders / Current Folder)
- [x] File opening integration
- [x] Recursive file loading from subdirectories
- [x] Scrollable table (X/Y axis)
- [x] Theme-synced UI components

### 🚧 Phase 1: YAML Frontmatter Integration (IN PROGRESS)
- [ ] Frontend YAML parser using `js-yaml`
- [ ] Read file content via Tauri `read_file_content`
- [ ] Parse frontmatter from markdown files
- [ ] Extract all properties (tags, status, dates, etc.)
- [ ] Display real data in table cells
- [ ] Cache parsed frontmatter for performance
- [ ] Handle missing/malformed frontmatter

**Files:**
- `src/bases/data/FrontmatterParser.js` (NEW)
- `src/bases/data/index.js` (MODIFY)
- `src/bases/ui/BaseTableView.jsx` (MODIFY)

### 🚧 Phase 2: Inline Cell Editing (IN PROGRESS)
- [ ] Editable cell component
- [ ] Different input types:
  - [ ] Text input
  - [ ] Select dropdown
  - [ ] Date picker
  - [ ] Tag editor
  - [ ] Number input
- [ ] YAML frontmatter writer
- [ ] Debounced auto-save (300ms)
- [ ] Save indicator
- [ ] Real-time table refresh

**Files:**
- `src/bases/data/FrontmatterWriter.js` (NEW)
- `src/bases/ui/BaseTableView.jsx` (MODIFY)
- `src/bases/ui/CellEditor.jsx` (NEW - optional)

### 🚧 Phase 3: Advanced Filtering (IN PROGRESS)
- [ ] Filter dropdown component
- [ ] Filter rule builder UI
- [ ] Filter operators:
  - [ ] Text: equals, contains, starts with, ends with
  - [ ] Number: =, >, <, >=, <=, between
  - [ ] Date: equals, before, after, between, relative
  - [ ] Tags: contains any, contains all
  - [ ] Status: equals, in list
- [ ] AND/OR logic between rules
- [ ] Apply filters to table data
- [ ] Show filtered count

**Files:**
- `src/bases/ui/FilterDropdown.jsx` (NEW)
- `src/bases/ui/BaseTableView.jsx` (MODIFY)

### 🚧 Phase 4: Column Management (IN PROGRESS)
- [ ] Column drag-and-drop reordering
- [ ] Column resize by dragging edge
- [ ] Pin/freeze columns
- [ ] Save column state to localStorage
- [ ] Visual drag feedback
- [ ] Min/max width constraints

**Files:**
- `src/bases/ui/BaseTableView.jsx` (MODIFY)

### ⏳ Phase 5: Grouping & Aggregation (TODO)
- [ ] Group by any column
- [ ] Collapsible groups
- [ ] Aggregate functions (count, sum, avg, min, max)
- [ ] Nested grouping support
- [ ] Group header styling

### ⏳ Phase 6: Search Functionality (TODO)
- [ ] Global search bar in header
- [ ] Real-time search filtering
- [ ] Search across all columns
- [ ] Case-insensitive search
- [ ] Highlight matches

### ⏳ Phase 7: Multiple View Types (TODO)
- [ ] List view
- [ ] Grid/Card view
- [ ] Calendar view
- [ ] View switcher UI

### ⏳ Phase 8: Calculated Fields (TODO)
- [ ] Formula engine
- [ ] Formula editor UI
- [ ] Built-in functions (IF, SUM, DATE, etc.)
- [ ] Preview calculated values

### ⏳ Phase 9: Export Functionality (TODO)
- [ ] CSV export
- [ ] JSON export
- [ ] Markdown table export

### ⏳ Phase 10: Performance (TODO)
- [ ] Virtual scrolling
- [ ] Pagination
- [ ] Lazy loading

### ⏳ Phase 11: Bulk Operations (TODO)
- [ ] Row selection
- [ ] Multi-select
- [ ] Bulk edit
- [ ] Bulk delete/move

### ⏳ Phase 12: View Management (TODO)
- [ ] Create new views
- [ ] Edit view settings
- [ ] Delete/duplicate views
- [ ] Save to `.base` file

---

## Architecture

### File Structure
```
src/bases/
├── BASE.md                    # This file
├── BasesContext.jsx          # React context for bases state
├── BasesView.jsx             # Main view component
├── core/                     # Core functionality
│   ├── BaseManager.js        # Base CRUD operations
│   ├── BaseParser.js         # Parse .base files
│   ├── BaseSchema.js         # Base configuration schema
│   └── BaseValidator.js      # Validate base definitions
├── data/                     # Data layer
│   ├── index.js              # BasesDataManager
│   ├── FrontmatterParser.js  # Parse YAML frontmatter (NEW)
│   ├── FrontmatterWriter.js  # Update YAML frontmatter (NEW)
│   ├── FileMetadata.js       # File metadata extraction
│   ├── PropertyIndexer.js    # Property indexing
│   ├── PropertyScanner.js    # Scan for properties
│   └── PropertyTypes.js      # Property type definitions
├── query/                    # Query & filtering
│   ├── FilterFunctions.js    # Filter operations
│   ├── FilterParser.js       # Parse filter expressions
│   ├── FormulaEngine.js      # Calculate formulas
│   └── QueryExecutor.js      # Execute queries
└── ui/                       # UI components
    ├── BaseTableView.jsx     # Table view
    ├── BaseSidebar.jsx       # Sidebar (unused)
    ├── ColumnManager.jsx     # Column management
    ├── CustomSelect.jsx      # Custom dropdown
    ├── FilterBuilder.jsx     # Filter builder (old)
    ├── FilterDropdown.jsx    # Filter dropdown (NEW)
    ├── PropertyEditor.jsx    # Property editor
    └── CellEditor.jsx        # Cell editing (NEW - optional)
```

### Data Flow

1. **File Loading**
   - Backend: `read_workspace_files` → Returns nested file tree
   - Frontend: Flatten tree → Extract markdown files
   - Frontend: Parse YAML frontmatter → Extract properties

2. **Display**
   - BasesView → BaseTableView → Render table
   - Apply scope filter (folder/global)
   - Apply sort rules
   - Apply filters
   - Apply grouping (future)

3. **Editing**
   - User clicks cell → Enter edit mode
   - User changes value → Debounced save
   - Frontend: Update YAML frontmatter
   - Backend: Write file content
   - Frontend: Refresh table data

### Base Configuration Format

`.base` files are YAML with this structure:

```yaml
name: "My Knowledge Base"
description: "Database view"
sourceFolder: "/path/to/folder"

include:
  - "**/*.md"

exclude:
  - ".lokus/**"
  - "node_modules/**"

columns:
  - key: "title"
    label: "Title"
    type: "text"
    width: 300
    sortable: true
    filterable: true

views:
  - id: "all_items"
    name: "All Items"
    type: "table"
    default: true
    columns: ["title", "status", "tags"]
    sortBy: "modified"
    sortOrder: "desc"
```

---

## API Documentation

### BasesContext

**Methods:**
- `executeQuery()` - Execute query and return data
- `switchView(viewName)` - Switch to different view
- `getAvailableProperties()` - Get all available properties
- `createBase(config)` - Create new base
- `loadBase(path)` - Load base from file
- `saveBase(base)` - Save base to file
- `deleteBase(name)` - Delete base

**State:**
- `activeBase` - Currently active base object
- `activeView` - Currently active view object
- `bases` - Array of all bases
- `isLoading` - Loading state
- `error` - Error message if any

### BasesDataManager

**Methods:**
- `initialize(workspacePath)` - Initialize data manager
- `getAllFiles()` - Get all files with properties
- `executeQuery(viewConfig)` - Execute query
- `parseFile(filePath)` - Parse file frontmatter (NEW)
- `updateFileProperty(filePath, key, value)` - Update property (NEW)

### FrontmatterParser (NEW)

**Methods:**
- `parseFile(content)` - Parse YAML frontmatter from content
- `extractProperties(frontmatter)` - Extract properties object
- `formatProperty(value, type)` - Format property for display

### FrontmatterWriter (NEW)

**Methods:**
- `updateProperty(content, key, value)` - Update single property
- `addProperty(content, key, value)` - Add new property
- `removeProperty(content, key)` - Remove property
- `ensureFrontmatter(content)` - Add frontmatter if missing

---

## Property Types

### Supported Types
1. **text** - Simple string
2. **number** - Integer or decimal
3. **date** - ISO date format
4. **select** - Single choice from options
5. **tags** - Array of strings
6. **boolean** - true/false
7. **url** - Web URL
8. **email** - Email address

### Type Definitions
Each property has:
- `key` - Property key in frontmatter
- `label` - Display name
- `type` - Data type
- `width` - Column width in px
- `sortable` - Can be sorted
- `filterable` - Can be filtered
- `options` - For select type
- `colorMap` - Color mapping for values

---

## Filter Operators

### Text Operators
- `equals` - Exact match
- `not_equals` - Not equal
- `contains` - Contains substring
- `not_contains` - Doesn't contain
- `starts_with` - Starts with
- `ends_with` - Ends with
- `is_empty` - Empty or null
- `is_not_empty` - Has value

### Number Operators
- `equals` - Equal to
- `not_equals` - Not equal to
- `greater_than` - >
- `greater_than_or_equal` - >=
- `less_than` - <
- `less_than_or_equal` - <=
- `between` - Between two values

### Date Operators
- `equals` - Exact date
- `before` - Before date
- `after` - After date
- `between` - Between two dates
- `relative` - Last N days/weeks/months

### Array Operators
- `contains_any` - Contains any of values
- `contains_all` - Contains all values
- `is_empty` - Empty array
- `is_not_empty` - Has items

---

## Performance Considerations

### Caching Strategy
- Cache parsed frontmatter in memory
- Invalidate cache when file changes
- Use file modified timestamp for cache key

### Lazy Loading
- Don't parse all files on initial load
- Parse on-demand when scrolling
- Use virtual scrolling for large datasets

### Debouncing
- Debounce search input (300ms)
- Debounce cell editing auto-save (300ms)
- Debounce filter changes (200ms)

---

## Testing Strategy

### Unit Tests
- FrontmatterParser parsing logic
- FrontmatterWriter update logic
- Filter operators
- Sort logic
- Formula engine

### Integration Tests
- File loading and parsing
- Cell editing end-to-end
- Filter application
- View switching

### Manual Testing
- Test with large datasets (1000+ files)
- Test with malformed YAML
- Test with missing properties
- Test concurrent edits

---

## Known Issues & Limitations

### Current Limitations
1. No virtual scrolling (performance issue with 1000+ files)
2. No pagination
3. No undo/redo for edits
4. No collaborative editing
5. No real-time file watching

### Future Improvements
1. Add file watcher for auto-refresh
2. Add conflict resolution for concurrent edits
3. Add undo/redo stack
4. Add keyboard shortcuts
5. Add bulk import from CSV
6. Add templates for common base types

---

## Contributing

When adding new features:
1. Update this BASE.md file
2. Add tests for new functionality
3. Update API documentation
4. Follow existing code style
5. Test with large datasets

---

## Roadmap

### Q4 2024
- [x] Phase 0: Foundation
- [ ] Phase 1-4: Core features
- [ ] Phase 5-6: Enhanced UX

### Q1 2025
- [ ] Phase 7: Multiple views
- [ ] Phase 8: Formulas
- [ ] Phase 9: Export

### Q2 2025
- [ ] Phase 10: Performance
- [ ] Phase 11: Bulk operations
- [ ] Phase 12: View management

---

Last Updated: 2024-09-29
Version: 0.1.0 (In Development)