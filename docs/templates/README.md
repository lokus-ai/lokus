# Template System

Lokus includes a powerful template system that helps you create reusable content with dynamic variables, conditional logic, and advanced date operations.

## Quick Start

### Creating a Template

1. Open a note with content you want to save as a template
2. Press `Cmd+K` (or `Ctrl+K` on Windows/Linux)
3. Select "Create Template from Selection"
4. Fill in the template details:
   - **Name**: A descriptive name for your template
   - **Category**: Organize templates by category
   - **Tags**: Add comma-separated tags for easy filtering
   - **Content**: Your template content with variables
5. Click "Save Template"

### Using a Template

1. Press `Cmd+K` to open the command palette
2. Type the template name or browse the list
3. Select your template
4. The template will be inserted at your cursor position

## Features

### Dynamic Variables

Insert dynamic values that update when you use the template:

```markdown
Today is {{date}}
Current time: {{time}}
Created by: {{user}}
```

### Date Operations

Perform powerful date calculations and formatting:

```markdown
Tomorrow: {{date.tomorrow}}
Next week: {{date.nextWeek}}
Due date: {{date.add(7, 'days').format('MMMM do, yyyy')}}
Week number: {{date.week}}
```

### Conditional Logic

Show or hide content based on conditions:

```markdown
{{#if priority == 'High'}}
This is a high priority task!
{{else if priority == 'Medium'}}
This is a medium priority task.
{{else}}
This is a low priority task.
{{/if}}
```

### Loops

Iterate over arrays or lists:

```markdown
{{#each tasks}}
{{@index}}. {{this.title}} ({{this.status}})
{{/each}}
```

### Text Filters

Transform text with built-in filters:

```markdown
{{name | upper}}
{{description | truncate(100)}}
{{date | dateFormat('yyyy-MM-dd')}}
```

## Template Storage

Templates are stored as individual markdown files in your templates directory:
- Default location: `/Users/[username]/Desktop/My Knowledge Base/templates/`
- Each template is a `.md` file with YAML frontmatter
- Edit templates directly in any text editor
- Changes sync automatically with Lokus

## Template Structure

A template file consists of:

1. **YAML Frontmatter** (metadata)
2. **Markdown Content** (template body)

Example template file:

```markdown
---
id: daily-standup
name: "Daily Standup Notes"
category: Work
tags:
  - meeting
  - daily
  - standup
createdAt: 2025-11-06T00:00:00.000Z
updatedAt: 2025-11-06T00:00:00.000Z
---

# Daily Standup - {{date.format('MMMM do, yyyy')}}

## What I did yesterday
{{cursor}}

## What I'll do today


## Blockers

```

## Next Steps

- [Syntax Reference](./syntax-reference.md) - Complete template syntax guide
- [Examples](./examples.md) - Real-world template examples
- [Advanced Features](./advanced-features.md) - Deep dive into advanced capabilities
