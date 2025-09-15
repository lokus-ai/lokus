# Kanban Boards

Lokus includes a sophisticated Kanban board system for task management and project organization. The system supports both mini inline Kanban boards for quick task tracking and full-featured Kanban views for comprehensive project management.

## Overview

The Kanban system provides:
- **Dual Kanban modes** - Mini boards for quick tasks, full boards for projects
- **Drag-and-drop interface** - Intuitive task movement between columns
- **Customizable columns** - Create custom workflow stages
- **Smart task management** - Rich task cards with metadata
- **Integration with notes** - Tasks can reference and link to notes
- **Real-time updates** - Changes sync across all views instantly

## Kanban Modes

### Mini Kanban
Lightweight task boards embedded in your workspace:
- **Quick Access** - Always visible in sidebar or workspace
- **Simple Workflow** - Basic To Do → In Progress → Done columns
- **Fast Entry** - Rapid task creation and movement
- **Note Integration** - Tasks can link to related notes
- **Compact Design** - Minimal space usage

### Full Kanban
Comprehensive project management boards:
- **Custom Columns** - Create unlimited custom workflow stages
- **Rich Task Cards** - Detailed task information and metadata
- **Advanced Features** - Due dates, priorities, assignments
- **Board Management** - Multiple boards for different projects
- **Full Screen Mode** - Dedicated workspace for project management

## Opening Kanban Views

### Access Methods
- **Mini Kanban**: Toggle in workspace sidebar
- **Full Kanban**: 
  - Command Palette → "Open Kanban Board"
  - Workspace toolbar → Kanban icon
  - Keyboard shortcut: `⌘⇧K` (macOS) / `Ctrl+Shift+K` (Windows/Linux)

### Interface Layout
#### Mini Kanban
- **Column Headers** - Clearly labeled workflow stages
- **Task Cards** - Compact task representation
- **Add Buttons** - Quick task creation in each column
- **Collapse Toggle** - Hide/show to save space

#### Full Kanban
- **Board Navigation** - Switch between multiple boards
- **Column Management** - Add, edit, delete, reorder columns
- **Task Details Panel** - Expanded task information
- **Filter and Search** - Find specific tasks across board

## Task Management

### Creating Tasks

#### Quick Task Creation
1. **Click Add Button** - In any column of mini or full Kanban
2. **Enter Task Title** - Simple one-line task description
3. **Press Enter** - Task is created and added to column
4. **Optional Details** - Click task to add more information

#### Detailed Task Creation
For full Kanban boards:
1. **Task Title** - Main task description
2. **Description** - Detailed task notes and requirements
3. **Due Date** - Optional deadline for task completion
4. **Priority** - High, medium, low priority levels
5. **Tags** - Categorize tasks with custom tags
6. **Assignee** - Assign tasks to team members (future feature)

### Task Cards

#### Mini Kanban Cards
Simplified task representation:
- **Task Title** - Main task description
- **Priority Indicator** - Color-coded priority level
- **Link Icon** - Shows if task links to notes
- **Due Date** - Compact date display if set

#### Full Kanban Cards
Rich task information:
- **Task Title and Description** - Full task details
- **Metadata Bar** - Due date, priority, tags, assignee
- **Progress Indicators** - Subtask completion, attachments
- **Action Buttons** - Quick edit, delete, duplicate
- **Link References** - Connected notes and files

### Task Movement

#### Drag and Drop
- **Click and Drag** - Grab task card and move to new column
- **Visual Feedback** - Drop zones highlight during drag
- **Auto-scroll** - Board scrolls when dragging near edges
- **Snap to Position** - Tasks snap to proper positions in columns

#### Keyboard Movement
- **Arrow Keys** - Move selected task between columns
- **Tab/Shift+Tab** - Navigate between tasks
- **Enter** - Edit selected task
- **Delete** - Remove selected task (with confirmation)

## Column Management

### Default Columns
#### Mini Kanban
- **To Do** - Tasks that need to be started
- **In Progress** - Currently active tasks
- **Done** - Completed tasks

#### Full Kanban
- **Backlog** - Future tasks and ideas
- **To Do** - Ready to start tasks
- **In Progress** - Active work
- **Review** - Tasks awaiting review or testing
- **Done** - Completed tasks

### Custom Columns

#### Creating Columns
1. **Add Column Button** - Click + button in board header
2. **Column Name** - Enter descriptive column title
3. **Column Color** - Choose color theme for visual organization
4. **Work in Progress Limit** - Optional limit on tasks in column
5. **Column Type** - Regular, done, or archive column types

#### Column Configuration
- **Rename Columns** - Edit column titles and descriptions
- **Reorder Columns** - Drag columns to change workflow order
- **Delete Columns** - Remove unused columns (moves tasks to default)
- **Column Rules** - Set automatic behaviors and constraints

### Workflow Customization
Create workflows that match your process:
- **Development Workflow** - Backlog → To Do → In Progress → Testing → Done
- **Content Workflow** - Ideas → Research → Writing → Review → Published
- **Support Workflow** - New → Assigned → In Progress → Waiting → Resolved
- **Personal Workflow** - Someday → This Week → Today → Doing → Done

## Advanced Features

### Task Details and Metadata

#### Core Properties
- **Title and Description** - Basic task information
- **Due Date** - Task deadline with calendar picker
- **Priority** - High (red), medium (yellow), low (blue)
- **Status** - Current workflow stage
- **Creation Date** - Automatically tracked
- **Completion Date** - Automatically set when moved to done

#### Extended Properties
- **Tags** - Custom labels for categorization
- **Estimated Time** - Time estimation for task completion
- **Actual Time** - Time tracking for completed tasks
- **Subtasks** - Break large tasks into smaller components
- **Dependencies** - Link tasks that depend on others
- **Attachments** - Files and notes related to the task

### Task Relationships

#### Note Integration
- **Link to Notes** - Associate tasks with relevant workspace notes
- **Create from Notes** - Convert note content into tasks
- **Reference Tasks** - Reference tasks from within notes
- **Bidirectional Links** - Tasks and notes link to each other

#### Task Dependencies
- **Predecessor Tasks** - Tasks that must complete before this one
- **Successor Tasks** - Tasks that depend on this one completing
- **Blocked Status** - Visual indication when task is blocked
- **Dependency Chains** - View complex dependency relationships

### Filtering and Search

#### Filter Options
- **By Column** - Show/hide specific workflow stages
- **By Priority** - Filter by high, medium, or low priority
- **By Due Date** - Show overdue, due today, or upcoming tasks
- **By Tags** - Filter by specific task categories
- **By Assignee** - Show tasks for specific team members

#### Search Capabilities
- **Text Search** - Search task titles and descriptions
- **Advanced Search** - Combine multiple search criteria
- **Saved Searches** - Save frequently used search filters
- **Quick Filters** - One-click access to common filters

## Board Management

### Multiple Boards
Organize different projects with separate boards:
- **Board Creation** - Create new boards for different projects
- **Board Templates** - Start with predefined board layouts
- **Board Navigation** - Quick switching between active boards
- **Board Settings** - Configure board-specific preferences

### Board Organization
- **Board Categories** - Group related boards together
- **Board Archiving** - Archive completed or inactive boards
- **Board Sharing** - Share boards with team members
- **Board Permissions** - Control who can view and edit boards

### Import and Export

#### Export Options
- **CSV Export** - Export task data for external analysis
- **JSON Export** - Complete board data with relationships
- **Markdown Export** - Tasks as formatted markdown lists
- **PDF Export** - Visual board snapshot for sharing

#### Import Sources
- **CSV Import** - Import tasks from spreadsheets
- **Trello Import** - Migrate boards from Trello
- **GitHub Issues** - Sync with GitHub project issues
- **Note Conversion** - Convert note task lists to Kanban

## Integration Features

### Note System Integration
- **Task from Selection** - Convert selected text to Kanban task
- **Note References** - Tasks can reference specific notes
- **Backlink Display** - See which tasks reference each note
- **Context Switching** - Jump between tasks and related notes

### Command Palette Integration
- **Quick Task Creation** - Create tasks via Command Palette
- **Board Navigation** - Switch boards using Command Palette
- **Task Search** - Find tasks across all boards
- **Bulk Operations** - Perform actions on multiple tasks

### Template System Integration
- **Task Templates** - Create reusable task structures
- **Board Templates** - Save board layouts as templates
- **Project Templates** - Complete project setups with tasks
- **Template Variables** - Dynamic task creation from templates

## Performance and Optimization

### Large Board Handling
- **Virtual Scrolling** - Efficient rendering of many tasks
- **Lazy Loading** - Load task details on demand
- **Background Sync** - Non-blocking updates and saves
- **Memory Management** - Efficient handling of large datasets

### Real-time Updates
- **Live Sync** - Changes appear immediately across views
- **Conflict Resolution** - Handle simultaneous edits gracefully
- **Offline Support** - Continue working without internet connection
- **Sync Recovery** - Reconcile changes when connection restored

## Accessibility

### Keyboard Navigation
- **Full Keyboard Support** - All features accessible via keyboard
- **Tab Navigation** - Move between boards, columns, and tasks
- **Arrow Key Navigation** - Navigate within board structure
- **Keyboard Shortcuts** - Quick actions for common operations

### Screen Reader Support
- **ARIA Labels** - Comprehensive labeling for screen readers
- **Structure Navigation** - Logical navigation through board hierarchy
- **Action Announcements** - Spoken feedback for user actions
- **Content Descriptions** - Detailed descriptions of visual information

### Visual Accessibility
- **High Contrast** - Support for high contrast display modes
- **Color Coding** - Multiple visual cues beyond color
- **Font Scaling** - Respects system font size preferences
- **Focus Indicators** - Clear visual focus indicators

## Customization

### Visual Customization
- **Column Colors** - Custom color schemes for columns
- **Task Card Themes** - Different visual styles for task cards
- **Board Backgrounds** - Custom background colors or images
- **Compact Mode** - Smaller cards for more tasks on screen

### Workflow Customization
- **Custom Columns** - Create workflow stages that match your process
- **Automation Rules** - Automatic task movement based on conditions
- **Due Date Handling** - Custom behaviors for overdue tasks
- **Priority Systems** - Define custom priority levels and colors

## Use Cases

### Software Development
- **Feature Development** - Track features from idea to deployment
- **Bug Tracking** - Manage bug reports and fixes
- **Sprint Planning** - Organize development sprints
- **Code Review** - Track review process and feedback

### Content Creation
- **Editorial Calendar** - Manage content pipeline from idea to publication
- **Research Projects** - Organize research tasks and findings
- **Publishing Workflow** - Track content through writing, editing, publishing
- **Content Planning** - Plan future content and campaigns

### Personal Productivity
- **Daily Tasks** - Organize daily work and personal tasks
- **Project Management** - Break large projects into manageable tasks
- **Goal Tracking** - Track progress toward personal goals
- **Learning Projects** - Organize study and skill development

### Team Collaboration
- **Project Coordination** - Coordinate team efforts on shared projects
- **Task Assignment** - Distribute work among team members
- **Progress Tracking** - Monitor team progress and bottlenecks
- **Status Reporting** - Visual status for stakeholders

## Troubleshooting

### Common Issues

**Tasks not moving between columns:**
- Check if column has work-in-progress limits
- Verify task isn't blocked by dependencies
- Ensure proper permissions for board editing
- Try refreshing the board view

**Performance issues with large boards:**
- Enable compact mode to show more tasks
- Use filters to reduce visible task count
- Archive completed tasks to separate boards
- Check available system memory

**Sync issues between views:**
- Verify internet connection stability
- Check for conflicting edits from other users
- Try refreshing the board or application
- Look for error messages in console

### Performance Tips
1. **Regular cleanup** - Archive or delete completed tasks
2. **Use filters** - Show only relevant tasks for current work
3. **Break large boards** - Split complex projects into multiple boards
4. **Optimize task details** - Keep task descriptions concise
5. **Monitor board size** - Very large boards may impact performance

## Related Features

- **[Template System](./template-system.md)** - Task and board templates
- **[File Management](./file-management.md)** - Integration with workspace files
- **[Search](./search.md)** - Advanced task search capabilities
- **[Command Palette](./command-palette.md)** - Quick access to Kanban features

---

*For technical implementation details, see the [Kanban API Documentation](../api/kanban.md).*