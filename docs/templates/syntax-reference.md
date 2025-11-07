# Template Syntax Reference

Complete reference for Lokus template syntax and features.

## Variables

### Basic Variables

```markdown
{{date}}          - Current date (YYYY-MM-DD)
{{time}}          - Current time (HH:mm:ss)
{{datetime}}      - Current date and time
{{timestamp}}     - Unix timestamp
{{user}}          - Current username
{{uuid}}          - Unique identifier
{{random}}        - Random number (0-1)
{{cursor}}        - Places cursor here after insertion
```

### Date Operations

#### Formatting

```markdown
{{date.format('MMMM do, yyyy')}}     - November 6th, 2025
{{date.format('yyyy-MM-dd')}}        - 2025-11-06
{{date.format('dddd, MMM D')}}       - Wednesday, Nov 6
```

Format tokens:
- `yyyy` - 4-digit year
- `MM` - 2-digit month
- `dd` - 2-digit day
- `MMMM` - Full month name
- `MMM` - Short month name
- `dddd` - Full day name
- `ddd` - Short day name

#### Arithmetic

```markdown
{{date.add(7, 'days')}}              - 7 days from now
{{date.subtract(2, 'weeks')}}        - 2 weeks ago
{{date.addMonths(3)}}                - 3 months from now
{{date.subtractYears(1)}}            - 1 year ago
```

Units: `'days'`, `'weeks'`, `'months'`, `'years'`

#### Relative Dates

```markdown
{{date.tomorrow}}        - Tomorrow's date
{{date.yesterday}}       - Yesterday's date
{{date.nextWeek}}        - Same day next week
{{date.lastWeek}}        - Same day last week
{{date.nextMonth}}       - Same day next month
{{date.lastMonth}}       - Same day last month
{{date.nextMonday}}      - Next Monday
{{date.previousFriday}}  - Previous Friday
```

#### Date Properties

```markdown
{{date.week}}            - Week number (1-53)
{{date.quarter}}         - Quarter (1-4)
{{date.weekday}}         - Day of week (0-6, 0=Sunday)
{{date.daysInMonth}}     - Days in current month
{{date.isLeapYear}}      - true/false
```

#### Boundaries

```markdown
{{date.startOfWeek}}     - Start of current week
{{date.endOfWeek}}       - End of current week
{{date.startOfMonth}}    - Start of current month
{{date.endOfMonth}}      - End of current month
{{date.startOfYear}}     - Start of current year
{{date.endOfYear}}       - End of current year
```

### Chaining Operations

Combine multiple operations:

```markdown
{{date.add(7, 'days').format('MMMM do, yyyy')}}
{{date.nextMonday.format('yyyy-MM-dd')}}
{{date.startOfMonth.format('dddd')}}
```

## Conditionals

### If/Else

```markdown
{{#if condition}}
  Content shown when condition is true
{{/if}}

{{#if condition}}
  True branch
{{else}}
  False branch
{{/if}}

{{#if condition1}}
  First condition
{{else if condition2}}
  Second condition
{{else}}
  Default
{{/if}}
```

### Comparison Operators

```markdown
{{#if priority == 'High'}}          - Equals
{{#if count != 0}}                  - Not equals
{{#if age > 18}}                    - Greater than
{{#if score >= 90}}                 - Greater than or equal
{{#if temperature < 32}}            - Less than
{{#if grade <= 59}}                 - Less than or equal
```

### Logical Operators

```markdown
{{#if priority == 'High' && urgent == true}}
  High priority AND urgent
{{/if}}

{{#if status == 'done' || status == 'archived'}}
  Done OR archived
{{/if}}
```

### Nesting

```markdown
{{#if category == 'Work'}}
  Work category
  {{#if priority == 'High'}}
    High priority work item
  {{/if}}
{{/if}}
```

## Loops

### Basic Loop

```markdown
{{#each items}}
  {{this}}
{{/each}}
```

### Loop with Index

```markdown
{{#each tasks}}
  {{@index}}. {{this.title}}
{{/each}}
```

### Special Variables

```markdown
{{@index}}      - Current index (0-based)
{{@first}}      - true on first iteration
{{@last}}       - true on last iteration
{{@length}}     - Total number of items
{{@key}}        - Current key (for objects)
```

### Nested Loops

```markdown
{{#each categories}}
  ## {{this.name}}
  {{#each this.items}}
    - {{this.title}}
  {{/each}}
{{/each}}
```

### Loop with Arithmetic

```markdown
{{#each items}}
  {{@index + 1}}. {{this}}
{{/each}}
```

## Filters

Filters transform values using the pipe (`|`) operator.

### String Filters

```markdown
{{text | upper}}              - UPPERCASE
{{text | lower}}              - lowercase
{{text | capitalize}}         - Capitalize first letter
{{text | title}}              - Title Case
{{text | slug}}               - url-friendly-slug
{{text | truncate(50)}}       - Truncate to 50 chars
{{text | trim}}               - Remove whitespace
{{text | replace('old', 'new')}} - Replace text
```

### Array Filters

```markdown
{{items | join(', ')}}        - Join with comma
{{items | first}}             - First item
{{items | last}}              - Last item
{{items | length}}            - Number of items
{{items | sort}}              - Sort alphabetically
{{items | unique}}            - Remove duplicates
```

### Number Filters

```markdown
{{price | round}}             - Round to nearest integer
{{price | floor}}             - Round down
{{price | ceil}}              - Round up
{{price | format}}            - Format with commas (1,000)
{{value | abs}}               - Absolute value
```

### Date Filters

```markdown
{{date | dateFormat('yyyy-MM-dd')}}
{{date | timeAgo}}            - "3 days ago"
{{date | fromNow}}            - "in 5 days"
```

### Utility Filters

```markdown
{{value | default('N/A')}}    - Default value if empty
{{obj | json}}                - JSON string
{{value | typeOf}}            - Get type
{{value | isEmpty}}           - Check if empty
```

### Chaining Filters

```markdown
{{name | trim | upper | truncate(20)}}
{{date | dateFormat('yyyy-MM-dd') | default('No date')}}
```

## Template Includes

Reuse templates inside other templates:

```markdown
{{include:header}}
{{include:footer}}
{{include:signature}}
```

### With Variables

```markdown
{{include:greeting:name=John,time=morning}}
```

The included template can use `{{name}}` and `{{time}}` variables.

## JavaScript Execution

Execute JavaScript for complex logic:

```markdown
{{js: return 2 + 2}}
{{js: return new Date().getFullYear()}}
{{js: return Math.random() > 0.5 ? 'Yes' : 'No'}}
```

Available JavaScript APIs:
- Math, Date, JSON
- String, Number, Array, Object methods
- Helper functions: `uuid()`, `format()`, `slugify()`

## Escaping

To show literal template syntax without processing:

```markdown
Use backslash: \{{date}}
Or use code blocks:
\`\`\`
{{date}}
\`\`\`
```

## Best Practices

1. **Use meaningful variable names** in conditionals and loops
2. **Chain operations** for cleaner templates
3. **Add comments** using regular markdown comments
4. **Test templates** before saving
5. **Organize with categories and tags** for easy discovery
6. **Use includes** for repeated content
7. **Keep templates focused** - one template per use case

## Examples

### Meeting Notes

```markdown
# Meeting: {{prompt:title:Meeting title:Team Sync}}

**Date:** {{date.format('MMMM do, yyyy')}}
**Time:** {{time}}

## Attendees
{{prompt:attendees:Who attended?:}}

## Agenda
{{#each [1, 2, 3]}}
{{@index + 1}}.
{{/each}}

## Notes
{{cursor}}

## Action Items
- [ ]
```

### Weekly Report

```markdown
# Week {{date.week}} Report - {{date.format('yyyy')}}

**Week of:** {{date.startOfWeek.format('MMM do')}} - {{date.endOfWeek.format('MMM do')}}

## Completed
{{#each completed}}
- [x] {{this.title}}
{{/each}}

## In Progress
{{#each inProgress}}
- [ ] {{this.title}}
{{/each}}

## Next Week
{{date.nextWeek.format('MMMM do')}}
```

### Project Template

```markdown
# {{prompt:name:Project name:}}

**Status:** {{suggest:status:Status:Planning,In Progress,Review,Done:Planning}}
**Priority:** {{suggest:priority:Priority:Low,Medium,High:Medium}}
**Due:** {{date.add(14, 'days').format('yyyy-MM-dd')}}

{{#if priority == 'High'}}
⚠️ HIGH PRIORITY PROJECT
{{/if}}

## Description
{{cursor}}

## Timeline
- Start: {{date}}
- End: {{date.add(14, 'days')}}
- Duration: 2 weeks

## Resources
-

---
*Created {{datetime | dateFormat('MMM do, yyyy')}}*
```
