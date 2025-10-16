# Lokus Bases: Complete Guide

> **Transform your markdown files into powerful databases**

**Version:** 1.3.1
**Status:** Production Ready
**Last Updated:** October 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Working with Properties](#working-with-properties)
5. [Views and Filtering](#views-and-filtering)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

### What are Bases?

Bases are Lokus's answer to database views for markdown files. Inspired by Notion and Airtable, Bases let you:

- **Query your notes** like a database
- **Visualize data** in table, list, gallery, and calendar views
- **Add metadata** without leaving markdown
- **Filter and sort** with powerful operators
- **Keep full control** - still just markdown files

### Why Use Bases?

**Before Bases:**
```markdown
/notes/project-a.md
/notes/task-123.md
/notes/meeting-2025-10-15.md
```
😕 Hard to find what you need
😕 No overview of status
😕 Manual organization

**With Bases:**
- ✅ See all projects in table view
- ✅ Filter by status, priority, owner
- ✅ Sort by due date, last modified
- ✅ Group by category or tags
- ✅ Track progress at a glance

[📹 Placeholder: Bases introduction video]

### Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Table View** | Spreadsheet-like display | ✅ Available |
| **Properties** | YAML frontmatter metadata | ✅ Available |
| **Sorting** | Multi-column sorting | ✅ Available |
| **Filtering** | Advanced filter builder | ✅ Available |
| **Grouping** | Group by any property | 🚧 Coming Soon |
| **Gallery View** | Card-based display | 🚧 Coming Soon |
| **Calendar View** | Date-based calendar | 🚧 Coming Soon |
| **Formulas** | Calculated fields | 🚧 Coming Soon |

---

## Getting Started

### Creating Your First Base

#### Method 1: Automatic Default Base

On first launch, Lokus creates a default "All Notes" base automatically:

1. Click **"Bases"** in the sidebar
2. You'll see all your notes in a table
3. Start exploring!

#### Method 2: Create Custom Base

1. Click **"Bases"** in sidebar
2. Click **"New Base"** button
3. Enter configuration:
   ```yaml
   name: "My Projects"
   description: "Active project tracking"
   sourceFolder: "/projects"
   ```
4. Click **"Create"**

[📹 Placeholder: Creating a base walkthrough]

### Understanding Base Files

Bases are stored as `.base` files in your workspace:

```
workspace/
├── .lokus/
│   └── bases/
│       ├── all-notes.base      # Default base
│       ├── projects.base       # Custom base
│       └── reading-list.base   # Another base
```

**Base File Structure:**
```yaml
name: "Project Tracker"
description: "Track all active projects"
sourceFolder: "/projects"

# Include/exclude patterns
include:
  - "**/*.md"
exclude:
  - "archive/**"
  - ".lokus/**"

# Define columns
columns:
  - key: "title"
    label: "Title"
    type: "text"
    width: 300
    sortable: true

  - key: "status"
    label: "Status"
    type: "select"
    options: ["Todo", "In Progress", "Done"]
    colorMap:
      "Todo": "#ff6b6b"
      "In Progress": "#4ecdc4"
      "Done": "#95e1d3"

  - key: "priority"
    label: "Priority"
    type: "select"
    options: ["High", "Medium", "Low"]

  - key: "tags"
    label: "Tags"
    type: "tags"

  - key: "due_date"
    label: "Due Date"
    type: "date"

# Define views
views:
  - id: "all_items"
    name: "All Projects"
    type: "table"
    default: true
    sortBy: "due_date"
    sortOrder: "asc"

  - id: "active"
    name: "Active"
    type: "table"
    filters:
      - property: "status"
        operator: "equals"
        value: "In Progress"
```

---

## Core Concepts

### Properties

Properties are metadata fields added to your notes via YAML frontmatter.

#### Adding Properties to Notes

Edit your markdown file:

```markdown
---
title: Build Landing Page
status: In Progress
priority: High
tags:
  - web
  - design
due_date: 2025-10-30
owner: John Doe
completed: false
---

# Build Landing Page

Project content here...
```

#### Property Types

| Type | YAML Format | Example | Use Case |
|------|------------|---------|----------|
| **Text** | `key: "value"` | `title: "My Note"` | Names, descriptions |
| **Number** | `key: 42` | `score: 85` | Ratings, counts |
| **Date** | `key: YYYY-MM-DD` | `due_date: 2025-10-30` | Deadlines, dates |
| **Select** | `key: "option"` | `status: "In Progress"` | Status, category |
| **Tags** | `key: ["tag1", "tag2"]` | `tags: ["work", "urgent"]` | Categories, labels |
| **Checkbox** | `key: true` | `completed: true` | Toggles, flags |
| **URL** | `key: "https://..."` | `link: "https://example.com"` | Web references |
| **Email** | `key: "user@..."` | `contact: "john@email.com"` | Contact info |

[📹 Placeholder: Adding properties to notes]

### Views

Views are different perspectives on the same data.

#### Default View

Every base has a default view showing all items with base configuration.

#### Custom Views

Create views for specific purposes:

**Examples:**
- **This Week** - Due dates in next 7 days
- **High Priority** - Priority = "High" AND Status ≠ "Done"
- **By Owner** - Grouped by owner property
- **Archive** - Completed items

**Creating a View:**
```yaml
views:
  - id: "this_week"
    name: "This Week"
    type: "table"
    filters:
      - property: "due_date"
        operator: "between"
        value: ["{{today}}", "{{today+7d}}"]
      - property: "status"
        operator: "not_equals"
        value: "Done"
    sortBy: "due_date"
    sortOrder: "asc"
```

### Columns

Columns define what properties appear in table view.

#### Column Configuration

```yaml
columns:
  - key: "title"           # Property key
    label: "Task"          # Display name
    type: "text"           # Data type
    width: 300             # Column width (px)
    sortable: true         # Can be sorted
    filterable: true       # Can be filtered
    visible: true          # Show by default
    pinned: false          # Pin to left
```

#### Column Management in UI

**Reorder:**
- Drag column headers left/right

**Resize:**
- Drag column edge

**Show/Hide:**
- Click "Properties" dropdown
- Toggle column visibility

**Pin:**
- Right-click column header → Pin
- Pinned columns stay visible when scrolling

[📹 Placeholder: Column management demo]

---

## Working with Properties

### Property Scanning

Lokus automatically scans your notes to detect properties:

1. Reads YAML frontmatter from all notes
2. Extracts property keys and types
3. Indexes values for fast filtering
4. Updates when files change

**Manual Refresh:**
- Click "Refresh" button in Bases view
- Or use MCP tool: `refresh_base_index`

### Inline Editing

#### Editing Cells

1. **Click cell** to enter edit mode
2. **Type new value**
3. **Press Enter** or click away
4. Auto-saves after 300ms

#### Different Input Types

**Text:**
- Click → Type → Enter

**Select:**
- Click → Dropdown appears
- Choose option or type to search

**Date:**
- Click → Date picker opens
- Select date or type `YYYY-MM-DD`

**Tags:**
- Click → Tag editor
- Type tag name, press Enter to add
- Click X to remove

**Checkbox:**
- Click to toggle

**Number:**
- Click → Type number
- Validates numeric input

[📹 Placeholder: Inline editing demo]

### Bulk Operations

#### Selecting Multiple Notes

- Click checkbox on rows
- Or use Shift+Click for range
- Or Cmd/Ctrl+A for all visible

#### Bulk Edit

1. Select multiple notes
2. Right-click → "Edit Selected"
3. Choose property to edit
4. Enter new value
5. Apply to all selected

#### Bulk Operations

- **Move** - Move to different folder
- **Delete** - Remove from workspace
- **Archive** - Move to archive folder
- **Tag** - Add/remove tags
- **Export** - Export selected to CSV/JSON

[📹 Placeholder: Bulk operations demo]

---

## Views and Filtering

### Sorting

#### Single Column Sort

1. Click column header
2. First click: Ascending (↑)
3. Second click: Descending (↓)
4. Third click: Remove sort

#### Multi-Column Sort

1. Hold **Shift**
2. Click column headers in order
3. Primary sort → Secondary sort → Tertiary sort

**Example:**
- Sort by Status (primary)
- Then by Priority (secondary)
- Then by Due Date (tertiary)

### Filtering

#### Filter Operators

**Text Operators:**
```
equals           - Exact match
not_equals       - Not equal
contains         - Contains substring
not_contains     - Doesn't contain
starts_with      - Starts with text
ends_with        - Ends with text
is_empty         - No value
is_not_empty     - Has value
```

**Number Operators:**
```
equals           - Equal to
not_equals       - Not equal to
greater_than     - >
greater_than_or_equal - >=
less_than        - <
less_than_or_equal - <=
between          - Between two values
```

**Date Operators:**
```
equals           - Exact date
before           - Before date
after            - After date
between          - Between two dates
relative         - Relative to today
  - last 7 days
  - last 30 days
  - this week
  - this month
  - next week
  - next month
```

**Array Operators (Tags):**
```
contains_any     - Contains any of values
contains_all     - Contains all values
is_empty         - Empty array
is_not_empty     - Has items
```

[📹 Placeholder: Filtering basics]

#### Creating Filters

**Method 1: Filter Dropdown**
1. Click "Filter" button
2. Click "+ Add Filter"
3. Choose property
4. Choose operator
5. Enter value
6. Apply

**Method 2: YAML Configuration**
```yaml
filters:
  - property: "status"
    operator: "equals"
    value: "In Progress"
  - property: "priority"
    operator: "in"
    value: ["High", "Medium"]
```

#### Filter Logic

**AND Logic:**
```yaml
filters:
  - property: "status"
    operator: "equals"
    value: "In Progress"
  - property: "priority"
    operator: "equals"
    value: "High"
# Shows: In Progress AND High Priority
```

**OR Logic (Advanced):**
```yaml
filterGroups:
  - logic: "OR"
    filters:
      - property: "status"
        operator: "equals"
        value: "In Progress"
      - property: "status"
        operator: "equals"
        value: "Todo"
# Shows: In Progress OR Todo
```

[📹 Placeholder: Advanced filtering]

### Grouping

> 🚧 Coming Soon in v1.4

Group notes by any property:

**Examples:**
- Group by Status → See all todos, in progress, done
- Group by Owner → See each person's tasks
- Group by Tags → Organize by categories
- Group by Month → Timeline view

**Features:**
- Collapsible groups
- Group counts
- Aggregate calculations (sum, average, count)
- Nested grouping (group by status, then priority)

[📹 Placeholder: Grouping demo]

---

## Advanced Features

### Search within Base

**Quick Search:**
1. Click search box at top
2. Type query
3. Filters table in real-time
4. Searches across all visible columns

**Search Options:**
- Case-sensitive toggle
- Regex mode
- Search specific column
- Highlight matches

### Aggregations

> 🚧 Coming Soon

View statistics at bottom of table:

| Aggregation | Description | Example |
|-------------|-------------|---------|
| **Count** | Number of items | 42 tasks |
| **Sum** | Total of numeric values | Total hours: 120 |
| **Average** | Mean of values | Avg score: 8.5 |
| **Min/Max** | Smallest/largest | Min: 1, Max: 100 |
| **Empty/Not Empty** | Count of filled cells | 38 have due dates |

### Formulas

> 🚧 Coming Soon

Create calculated properties:

**Examples:**
```yaml
columns:
  - key: "days_until_due"
    label: "Days Until Due"
    type: "formula"
    formula: "dateDiff(prop('due_date'), now(), 'days')"

  - key: "is_overdue"
    label: "Overdue"
    type: "formula"
    formula: "if(prop('due_date') < now() && prop('status') != 'Done', true, false)"
```

**Available Functions:**
- `prop(key)` - Get property value
- `now()` - Current date/time
- `dateDiff(date1, date2, unit)` - Date difference
- `if(condition, trueValue, falseValue)` - Conditional
- `sum(values)` - Sum array
- `avg(values)` - Average array
- `count(values)` - Count items
- `concat(str1, str2)` - Concatenate
- `length(str)` - String length

### Export Options

**Export Table:**
1. Click "Export" button
2. Choose format:
   - **CSV** - Import to Excel/Sheets
   - **JSON** - Structured data
   - **Markdown Table** - Copy to notes
   - **PDF** - Print or share

**Export Options:**
- All rows or filtered only
- Include/exclude columns
- Formatting (dates, numbers)
- Headers and metadata

[📹 Placeholder: Exporting data]

### Integration with Other Features

#### Kanban Integration

Convert base to Kanban board:
1. Right-click base → "Open as Kanban"
2. Select column for board columns (e.g., Status)
3. Drag cards between columns
4. Changes sync back to notes

#### Graph Integration

Visualize base relationships:
1. Click "Graph View" button
2. Nodes colored by base properties
3. Filter graph by base filters
4. Click node to open in base

#### MCP Tool Integration

AI assistants can query bases:

```javascript
// AI can run queries like:
search_base({
  base: "projects",
  filter: "status = 'In Progress' AND priority = 'High'",
  sort: "due_date ASC"
})

// Or create base views:
create_base_view({
  base: "projects",
  name: "Urgent Tasks",
  filters: [...],
  sort: [...]
})
```

[📹 Placeholder: Bases integrations]

---

## Best Practices

### Organizing Bases

**One Base per Domain:**
```
/projects/ → Projects Base
/reading/ → Reading List Base
/contacts/ → Contacts Base
/journal/ → Journal Base
```

**Or by Purpose:**
```
All Notes Base → Everything
Active Work Base → Current tasks
Archive Base → Completed items
```

### Property Design

**Use Consistent Naming:**
```yaml
# Good
due_date, start_date, completed_date

# Inconsistent
due_date, startDate, date_completed
```

**Choose Appropriate Types:**
```yaml
# Good
status: "In Progress"    # Select type
priority: "High"         # Select type

# Bad
status: "in progress"    # Inconsistent casing
priority: 3              # Number when should be select
```

**Limit Properties:**
- Too many properties = cluttered view
- Use 5-10 core properties
- Add more only when needed
- Hide rarely-used columns

### View Organization

**Create Purpose-Driven Views:**

```yaml
# Good: Clear purpose
- "Active Projects"
- "Due This Week"
- "High Priority Backlog"

# Bad: Unclear purpose
- "View 1"
- "Miscellaneous"
- "Other Stuff"
```

**Use Filters Effectively:**
```yaml
# Good: Specific, actionable
filters:
  - property: "status"
    operator: "equals"
    value: "In Progress"
  - property: "owner"
    operator: "equals"
    value: "{{current_user}}"

# Bad: Too broad or meaningless
filters:
  - property: "title"
    operator: "contains"
    value: "a"
```

### Performance Optimization

**For Large Workspaces (1000+ notes):**

1. **Use Specific Source Folders**
   ```yaml
   sourceFolder: "/projects"  # Good
   sourceFolder: "/"          # Slow for large workspaces
   ```

2. **Exclude Unnecessary Folders**
   ```yaml
   exclude:
     - "archive/**"
     - ".lokus/**"
     - "node_modules/**"
   ```

3. **Limit Default View**
   ```yaml
   views:
     - id: "default"
       name: "Recent"
       filters:
         - property: "modified_date"
           operator: "after"
           value: "{{today-30d}}"
   ```

4. **Enable Quantum Indexing**
   - Preferences → Performance → Enable Quantum Search
   - Dramatically improves large-base performance

### Workflow Examples

#### Project Management

```yaml
name: "Project Tracker"
columns:
  - key: "title"
  - key: "status"
    options: ["Planning", "Active", "On Hold", "Done"]
  - key: "priority"
    options: ["Critical", "High", "Medium", "Low"]
  - key: "owner"
  - key: "due_date"
  - key: "progress"
    type: "number"
    min: 0
    max: 100

views:
  - name: "Active Sprint"
    filters:
      - property: "status"
        operator: "equals"
        value: "Active"
    sortBy: "priority"

  - name: "By Owner"
    groupBy: "owner"
    sortBy: "due_date"
```

#### Reading List

```yaml
name: "Reading List"
columns:
  - key: "title"
  - key: "author"
  - key: "status"
    options: ["To Read", "Reading", "Finished"]
  - key: "rating"
    type: "number"
    min: 1
    max: 5
  - key: "genre"
    type: "tags"
  - key: "date_finished"
    type: "date"

views:
  - name: "To Read"
    filters:
      - property: "status"
        operator: "equals"
        value: "To Read"
    sortBy: "title"

  - name: "Best Books"
    filters:
      - property: "rating"
        operator: "greater_than_or_equal"
        value: 4
    sortBy: "rating"
    sortOrder: "desc"
```

[📹 Placeholder: Workflow examples walkthrough]

---

## API Reference

### BasesContext

React context for base state management.

```javascript
import { useBases } from '@/bases/BasesContext';

function MyComponent() {
  const {
    activeBase,
    activeView,
    bases,
    executeQuery,
    switchView,
    createBase,
    updateBase,
    deleteBase
  } = useBases();

  // Use bases functionality
}
```

#### Methods

**`executeQuery(viewConfig)`**
- Execute a base query
- Returns: `{ rows: [], total: number }`

**`switchView(viewId)`**
- Switch to different view
- Updates UI immediately

**`createBase(config)`**
- Create new base
- Returns: `baseId`

**`updateBase(baseId, updates)`**
- Update base configuration
- Auto-refreshes views

**`deleteBase(baseId)`**
- Delete base
- Removes `.base` file

### BasesDataManager

Low-level data management.

```javascript
import BasesDataManager from '@/bases/data';

const manager = new BasesDataManager();
await manager.initialize(workspacePath);

// Get all files with properties
const files = await manager.getAllFiles();

// Execute query
const results = await manager.executeQuery(viewConfig);

// Update file property
await manager.updateFileProperty(filePath, 'status', 'Done');
```

### MCP Tools for Bases

AI assistants can use these tools:

```javascript
// Search bases
mcp.call('search_base', {
  base: 'projects',
  query: 'status:Active AND priority:High',
  limit: 20
});

// Create base view
mcp.call('create_base_view', {
  base: 'projects',
  name: 'Urgent',
  config: {...}
});

// Update base property
mcp.call('update_base_property', {
  base: 'projects',
  file: 'project-a.md',
  property: 'status',
  value: 'Done'
});
```

---

## Troubleshooting

### Base Won't Load

**Symptoms:**
- Base shows "Loading..." forever
- Error message appears
- Blank table

**Solutions:**
1. **Check .base file format**
   ```bash
   # Validate YAML
   cat .lokus/bases/my-base.base
   ```

2. **Verify source folder exists**
   ```yaml
   sourceFolder: "/projects"  # Must exist
   ```

3. **Rebuild index**
   - Click "Refresh" in base view
   - Or restart app

4. **Check console errors**
   - Open Dev Tools (Cmd/Ctrl+Shift+I)
   - Look for error messages

### Properties Not Showing

**Symptoms:**
- Properties in frontmatter don't appear in base
- Columns are empty

**Solutions:**
1. **Check frontmatter format**
   ```markdown
   ---
   title: "My Note"
   status: Active
   ---
   ```
   Must have `---` delimiters

2. **Verify property types**
   ```yaml
   # In .base file
   columns:
     - key: "status"  # Must match frontmatter key exactly
       type: "text"
   ```

3. **Refresh base index**
   - Click "Refresh" button
   - Rebuilds property index

4. **Check file encoding**
   - Must be UTF-8
   - No BOM characters

### Slow Performance

**Symptoms:**
- Base takes long to load
- UI freezes when filtering
- Scrolling is laggy

**Solutions:**
1. **Enable Quantum Search**
   - Preferences → Performance → Enable

2. **Reduce source folder scope**
   ```yaml
   sourceFolder: "/specific-folder"  # Not "/"
   ```

3. **Add exclude patterns**
   ```yaml
   exclude:
     - "archive/**"
     - "large-media/**"
   ```

4. **Limit default view**
   ```yaml
   views:
     - name: "Default"
       limit: 100  # Show only 100 items
   ```

5. **Close unused bases**
   - Each open base uses memory
   - Close tabs you're not using

### Editing Not Saving

**Symptoms:**
- Edit cell, but changes disappear
- File not updated after edit
- Error on save

**Solutions:**
1. **Check file permissions**
   - Ensure write access to workspace
   - Not on read-only volume

2. **Verify file not open elsewhere**
   - Close file in other editors
   - Only edit in one place

3. **Check frontmatter syntax**
   ```markdown
   ---
   title: "Valid"       # Good
   title: Not quoted    # Bad if contains spaces
   ---
   ```

4. **Review console errors**
   - Dev Tools → Console
   - Look for save errors

### Filters Not Working

**Symptoms:**
- Filter applied but no results
- Wrong items showing
- Filter seems ignored

**Solutions:**
1. **Check filter syntax**
   ```yaml
   filters:
     - property: "status"      # Must match property key
       operator: "equals"      # Valid operator
       value: "In Progress"    # Exact value match
   ```

2. **Verify property values**
   - Check actual values in notes
   - Match casing exactly

3. **Test filters individually**
   - Remove all filters
   - Add one at a time
   - Find problematic filter

4. **Clear filter cache**
   - Click "Clear Filters"
   - Reapply filters

---

## Future Roadmap

### v1.4 (Q1 2026)
- ✅ Grouping by properties
- ✅ Gallery view
- ✅ Calendar view
- ✅ Formula support
- ✅ Rollup fields

### v1.5 (Q2 2026)
- ✅ Relations between bases
- ✅ Linked database views
- ✅ Advanced automations
- ✅ Template-based creation
- ✅ Mobile views

### v2.0 (Q3 2026)
- ✅ Real-time collaboration
- ✅ Comment system
- ✅ Change history
- ✅ Permissions & sharing
- ✅ API for third-party integrations

---

## Additional Resources

- **Video Tutorials**: https://www.youtube.com/@lokus-ai
- **Community Forum**: https://github.com/lokus-ai/lokus/discussions
- **Example Bases**: `/examples/bases/` in repository
- **API Documentation**: `/docs/developer/bases-api.md`

---

**Last Updated:** October 2025
**Version:** 1.3.1
**Feedback:** https://github.com/lokus-ai/lokus/issues

[📹 Note: Replace all video placeholders with actual tutorials]
