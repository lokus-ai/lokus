# Template Prompts System

A comprehensive user interaction system for templates that allows collecting user input through prompts, dropdowns, and checkboxes.

## Overview

The Template Prompts system enables interactive templates that can ask users for input before generating content. It supports three types of user interactions:

1. **Text Input Prompts** - Free-form text entry
2. **Dropdown/Suggester** - Selection from predefined options
3. **Checkbox** - Boolean yes/no questions

## Syntax

### Text Input Prompt
```
{{prompt:variableName:question:defaultValue}}
```

**Example:**
```
{{prompt:name:What is your name?:John Doe}}
{{prompt:title:Enter document title:Untitled}}
```

### Dropdown/Suggester Prompt
```
{{suggest:variableName:question:option1,option2,option3:defaultValue}}
```

**Example:**
```
{{suggest:status:Select status:Todo,In Progress,Done:Todo}}
{{suggest:priority:Priority level:Low,Medium,High,Critical:Medium}}
```

### Checkbox Prompt
```
{{checkbox:variableName:question:defaultBoolValue}}
```

**Example:**
```
{{checkbox:public:Make this public?:false}}
{{checkbox:autosave:Enable auto-save?:true}}
```

## Usage

### Basic Usage (Core API)

```javascript
import { TemplatePrompts } from './core/templates/prompts';

const promptsParser = new TemplatePrompts();

// Parse prompts from template
const template = '{{prompt:name:Your name?:John}} {{checkbox:agree:Agree?:false}}';
const prompts = promptsParser.parsePrompts(template);

console.log(prompts);
// [
//   { type: 'prompt', varName: 'name', question: 'Your name?', defaultValue: 'John' },
//   { type: 'checkbox', varName: 'agree', question: 'Agree?', defaultValue: false }
// ]

// Replace prompts with values
const values = { name: 'Alice', agree: true };
const result = promptsParser.replacePrompts(template, values);
console.log(result); // "Alice true"
```

### React Hook Usage

```javascript
import { useTemplatePrompts } from './components/Templates';

function MyComponent() {
  const { showPrompts, PromptsManager } = useTemplatePrompts();

  const handleUseTemplate = async () => {
    const template = `
# {{prompt:title:Project title:New Project}}

Status: {{suggest:status:Select status:Planning,Active,Done:Planning}}
Public: {{checkbox:public:Make public?:false}}
    `;

    try {
      // Show prompts and collect user input
      const values = await showPrompts(template);

      // Process template with values
      const promptsParser = new TemplatePrompts();
      const result = promptsParser.replacePrompts(template, values);

      console.log('Generated content:', result);
    } catch (error) {
      console.log('User cancelled');
    }
  };

  return (
    <div>
      <button onClick={handleUseTemplate}>Create from Template</button>
      {PromptsManager}
    </div>
  );
}
```

## Features

### Multiple Prompts in Sequence

When a template has multiple prompts, they are shown one at a time in sequence with a progress indicator:

```javascript
const template = `
{{prompt:name:Your name?:John}}
{{prompt:email:Your email?:john@example.com}}
{{suggest:role:Your role?:Developer,Designer,Manager:Developer}}
{{checkbox:newsletter:Subscribe to newsletter?:false}}
`;

// Shows 4 prompts in sequence with "Question 1 of 4" indicator
```

### Default Values

All prompt types support default values:

```javascript
// Text prompt with default
{{prompt:author:Author name:Anonymous}}

// Dropdown with default (or uses first option if omitted)
{{suggest:status:Status:Active,Inactive:Active}}

// Checkbox with default (defaults to false if omitted)
{{checkbox:enabled:Enable feature?:true}}
```

### Validation

Validate templates before processing:

```javascript
const validation = promptsParser.validate(template);

if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
```

### Statistics

Get information about prompts in a template:

```javascript
const stats = promptsParser.getStatistics(template);

console.log(stats);
// {
//   total: 5,
//   byType: {
//     prompt: 2,
//     suggest: 2,
//     checkbox: 1
//   },
//   withDefaults: 5,
//   uniqueVariables: 5
// }
```

### Memory Feature

Remember previous values for convenience:

```javascript
// Remember a value
promptsParser.rememberValue('name', 'Alice');

// Get previous value
const previousName = promptsParser.getPreviousValue('name');

// Clear all remembered values
promptsParser.clearMemory();
```

## Components

### PromptDialog

Text input dialog component.

```jsx
<PromptDialog
  open={true}
  onOpenChange={setOpen}
  prompt={{
    type: 'prompt',
    varName: 'name',
    question: 'What is your name?',
    defaultValue: 'John'
  }}
  onSubmit={(value) => console.log(value)}
  onCancel={() => console.log('Cancelled')}
/>
```

### SuggestDialog

Dropdown selection dialog component.

```jsx
<SuggestDialog
  open={true}
  onOpenChange={setOpen}
  prompt={{
    type: 'suggest',
    varName: 'status',
    question: 'Select status',
    options: ['Todo', 'In Progress', 'Done'],
    defaultValue: 'Todo'
  }}
  onSubmit={(value) => console.log(value)}
  onCancel={() => console.log('Cancelled')}
/>
```

### CheckboxDialog

Boolean checkbox dialog component.

```jsx
<CheckboxDialog
  open={true}
  onOpenChange={setOpen}
  prompt={{
    type: 'checkbox',
    varName: 'public',
    question: 'Make this public?',
    defaultValue: false
  }}
  onSubmit={(value) => console.log(value)}
  onCancel={() => console.log('Cancelled')}
/>
```

### TemplatePromptsManager

Orchestrates showing all prompts in sequence.

```jsx
<TemplatePromptsManager
  template={templateString}
  onComplete={(values) => {
    console.log('All prompts completed:', values);
  }}
  onCancel={() => {
    console.log('User cancelled');
  }}
  remember={false}
/>
```

## Integration with Template System

The prompts system integrates seamlessly with the existing template system:

```javascript
import { TemplateProcessor } from './core/templates/processor';
import { TemplatePrompts } from './core/templates/prompts';

async function processTemplateWithPrompts(template, showPromptsFunc) {
  const promptsParser = new TemplatePrompts();

  // Check if template has prompts
  if (promptsParser.hasPrompts(template)) {
    // Collect user input
    const userValues = await showPromptsFunc(template);

    // Replace prompts with values
    template = promptsParser.replacePrompts(template, userValues);
  }

  // Process the template normally (variables, JS blocks, etc.)
  const processor = new TemplateProcessor();
  const result = await processor.process(template);

  return result;
}
```

## Examples

### Simple Meeting Notes

```markdown
# Meeting Notes - {{prompt:date:Meeting date:2024-01-15}}

**Attendees**: {{prompt:attendees:Who attended?:Team members}}
**Type**: {{suggest:type:Meeting type:Standup,Planning,Review:Standup}}
**Action Items**: {{checkbox:hasActions:Are there action items?:false}}

## Notes

{{prompt:notes:Meeting notes:Discussion topics...}}
```

### Project Template

```markdown
# {{prompt:projectName:Project Name:New Project}}

## Overview

**Status**: {{suggest:status:Project status:Planning,Active,On Hold,Completed:Planning}}
**Priority**: {{suggest:priority:Priority:Low,Medium,High:Medium}}
**Public**: {{checkbox:isPublic:Make project public?:false}}

## Team

**Lead**: {{prompt:lead:Project lead:Team Member}}
**Description**: {{prompt:description:Project description:Enter description...}}

## Settings

- Auto-save: {{checkbox:autosave:Enable auto-save?:true}}
- Notifications: {{checkbox:notifications:Enable notifications?:true}}
```

### Task Creation

```markdown
## Task: {{prompt:taskName:Task name:New Task}}

**Status**: {{suggest:status:Status:Todo,In Progress,Blocked,Done:Todo}}
**Priority**: {{suggest:priority:Priority:Low,Medium,High,Critical:Medium}}
**Assignee**: {{prompt:assignee:Assigned to:Unassigned}}

**Urgent**: {{checkbox:urgent:Mark as urgent?:false}}
**Description**: {{prompt:description:Task description:Enter details...}}
```

## API Reference

### TemplatePrompts Class

#### Methods

- `parsePrompts(template)` - Parse all prompts from template
- `parseTextPrompts(template)` - Parse text input prompts
- `parseSuggestPrompts(template)` - Parse dropdown prompts
- `parseCheckboxPrompts(template)` - Parse checkbox prompts
- `replacePrompts(template, values)` - Replace prompts with values
- `validate(template)` - Validate template syntax
- `getStatistics(template)` - Get prompt statistics
- `hasPrompts(template)` - Check if template has prompts
- `rememberValue(varName, value)` - Remember a value
- `getPreviousValue(varName)` - Get remembered value
- `clearMemory()` - Clear all remembered values

### React Hook

#### useTemplatePrompts()

Returns:
- `showPrompts(template)` - Show prompts and return promise with values
- `PromptsManager` - React component to render (handles dialogs)

## Testing

Run the test suite:

```bash
npm test src/core/templates/prompts.test.js
```

Test the UI components:

```bash
npm run tauri dev
# Navigate to the Template Prompts Example component
```

## Best Practices

1. **Use descriptive questions** - Make it clear what input you're asking for
2. **Provide sensible defaults** - Help users by pre-filling common values
3. **Keep prompts focused** - Don't overwhelm users with too many questions
4. **Group related prompts** - Organize prompts logically in your template
5. **Validate inputs** - Check user inputs after collection if needed
6. **Handle cancellation** - Always handle the case where users cancel

## Troubleshooting

### Prompts not showing

- Ensure you're using the correct syntax
- Check that the PromptsManager component is rendered
- Verify the template contains valid prompt syntax

### Values not replaced

- Make sure variable names match exactly
- Check that values object contains the correct keys
- Ensure you're calling `replacePrompts()` after collecting values

### Multiple prompts showing at once

- Only one TemplatePromptsManager should be active at a time
- Check that you're not rendering multiple managers

## Future Enhancements

Potential features for future versions:

- Date picker prompts
- Multi-select dropdowns
- Validation rules for text inputs
- Conditional prompts (show based on previous answers)
- Custom prompt types via plugins
- Prompt templates (reusable prompt definitions)
- Internationalization support
