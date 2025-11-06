# Template System - Conditionals and Loops

This document describes the conditional and loop features added to the Lokus template system.

## Overview

The template system now supports:
- **Conditionals**: if/else if/else blocks for conditional rendering
- **Loops**: each loops for iterating over arrays and objects

## Conditionals

### Syntax

```
{{#if condition}}
  content when true
{{/if}}
```

```
{{#if condition}}
  content when true
{{else}}
  content when false
{{/if}}
```

```
{{#if condition1}}
  content 1
{{else if condition2}}
  content 2
{{else}}
  default content
{{/if}}
```

### Supported Operators

- **Comparison**: `==`, `!=`, `<`, `>`, `<=`, `>=`, `===`, `!==`
- **Logical**: `&&` (AND), `||` (OR)
- **Truthiness**: Simple variable checks

### Examples

#### Simple Equality Check

```javascript
Template: {{#if status == "Done"}}✅ Complete{{else}}⏳ Pending{{/if}}
Variables: { status: "Done" }
Output: ✅ Complete
```

#### Multiple Conditions (else if)

```javascript
Template: {{#if priority == "High"}}🔴 High{{else if priority == "Medium"}}🟡 Medium{{else}}🟢 Low{{/if}}
Variables: { priority: "Medium" }
Output: 🟡 Medium
```

#### Logical Operators

```javascript
Template: {{#if age >= 18 && hasLicense == true}}Can drive{{else}}Cannot drive{{/if}}
Variables: { age: 20, hasLicense: true }
Output: Can drive
```

#### Nested Conditionals

```javascript
Template: {{#if isLoggedIn == true}}Welcome! {{#if isPremium == true}}Premium{{else}}Free{{/if}}{{else}}Login{{/if}}
Variables: { isLoggedIn: true, isPremium: true }
Output: Welcome! Premium
```

#### Dot Notation Support

```javascript
Template: {{#if user.status == "active"}}Active User{{/if}}
Variables: { user: { status: "active" } }
Output: Active User
```

### Usage

```javascript
import { TemplateConditionals } from './conditionals.js';

const conditionals = new TemplateConditionals();
const template = '{{#if status == "Done"}}✅ Complete{{else}}⏳ Pending{{/if}}';
const variables = { status: 'Done' };
const result = conditionals.processTemplate(template, variables);
console.log(result); // "✅ Complete"
```

### Configuration Options

```javascript
const conditionals = new TemplateConditionals({
  strictMode: true,        // Throw errors on undefined variables (default: true)
  maxNestingDepth: 10      // Maximum nesting depth for conditionals (default: 10)
});
```

## Loops

### Syntax

```
{{#each arrayName}}
  content with {{this}}
{{/each}}
```

```
{{#each arrayName as item}}
  content with {{item}}
{{/each}}
```

### Special Loop Variables

- `{{@index}}` - Current iteration index (0-based)
- `{{@first}}` - Boolean, true for first item
- `{{@last}}` - Boolean, true for last item
- `{{@length}}` - Total number of items
- `{{this}}` - Current item
- `{{this.property}}` - Property of current item

### Index Arithmetic

You can perform simple arithmetic on `@index`:

```
{{@index + 1}}  // 1-based indexing
{{@index * 2}}  // Double the index
{{@index - 1}}  // Offset
```

### Examples

#### Simple Array Iteration

```javascript
Template: {{#each items}}{{this}} {{/each}}
Variables: { items: ['a', 'b', 'c'] }
Output: a b c
```

#### Array of Objects

```javascript
Template: {{#each tasks}}{{this.title}} - {{this.status}}\n{{/each}}
Variables: {
  tasks: [
    { title: 'Task 1', status: 'Done' },
    { title: 'Task 2', status: 'Pending' }
  ]
}
Output: Task 1 - Done
Task 2 - Pending
```

#### Using @index

```javascript
Template: {{#each items}}{{@index}}: {{this}}\n{{/each}}
Variables: { items: ['a', 'b', 'c'] }
Output: 0: a
1: b
2: c
```

#### 1-Based Numbering

```javascript
Template: {{#each tasks}}{{@index + 1}}. {{this.title}}\n{{/each}}
Variables: {
  tasks: [
    { title: 'First' },
    { title: 'Second' },
    { title: 'Third' }
  ]
}
Output: 1. First
2. Second
3. Third
```

#### Using Aliases

```javascript
Template: {{#each tasks as task}}{{task.title}} - {{task.status}}\n{{/each}}
Variables: {
  tasks: [
    { title: 'Task 1', status: 'Done' },
    { title: 'Task 2', status: 'Pending' }
  ]
}
Output: Task 1 - Done
Task 2 - Pending
```

#### Object Iteration

```javascript
Template: {{#each data}}{{this.key}}: {{this.value}}\n{{/each}}
Variables: {
  data: {
    name: 'John',
    age: 30,
    city: 'NYC'
  }
}
Output: name: John
age: 30
city: NYC
```

#### Markdown Table

```javascript
Template: | Name | Status |\n{{#each items}}| {{this.name}} | {{this.status}} |\n{{/each}}
Variables: {
  items: [
    { name: 'Item 1', status: '✅' },
    { name: 'Item 2', status: '⏳' }
  ]
}
Output: | Name | Status |
| Item 1 | ✅ |
| Item 2 | ⏳ |
```

#### Dot Notation in Arrays

```javascript
Template: {{#each users}}{{this.profile.name}}: {{this.profile.email}}\n{{/each}}
Variables: {
  users: [
    { profile: { name: 'Alice', email: 'alice@example.com' } },
    { profile: { name: 'Bob', email: 'bob@example.com' } }
  ]
}
Output: Alice: alice@example.com
Bob: bob@example.com
```

### Usage

```javascript
import { TemplateLoops } from './loops.js';

const loops = new TemplateLoops();
const template = '{{#each tasks}}{{@index + 1}}. {{this.title}}\n{{/each}}';
const variables = {
  tasks: [
    { title: 'Write code' },
    { title: 'Write tests' }
  ]
};
const result = loops.processTemplate(template, variables);
console.log(result);
// 1. Write code
// 2. Write tests
```

### Configuration Options

```javascript
const loops = new TemplateLoops({
  strictMode: true,          // Throw errors on undefined variables (default: true)
  maxNestingDepth: 10,       // Maximum nesting depth (default: 10)
  maxIterations: 10000       // Maximum items per loop (default: 10000)
});
```

## Combining Conditionals and Loops

You can combine conditionals and loops for powerful templates:

```javascript
Template: {{#each tasks}}{{@index + 1}}. {{this.title}} - {{#if this.status == "Done"}}✅{{else}}⏳{{/if}}\n{{/each}}
Variables: {
  tasks: [
    { title: 'Task 1', status: 'Done' },
    { title: 'Task 2', status: 'Pending' }
  ]
}
Output: 1. Task 1 - ✅
2. Task 2 - ⏳
```

## Validation

Both classes provide validation methods to check template syntax:

```javascript
// Validate conditionals
const conditionalsResult = conditionals.validate(template);
console.log(conditionalsResult.valid); // true or false
console.log(conditionalsResult.errors); // Array of error messages
console.log(conditionalsResult.warnings); // Array of warnings

// Validate loops
const loopsResult = loops.validate(template);
console.log(loopsResult.valid);
console.log(loopsResult.errors);
console.log(loopsResult.warnings);
```

## Statistics

Get statistics about template complexity:

```javascript
// Conditionals statistics
const condStats = conditionals.getStatistics(template);
console.log(condStats);
// {
//   totalConditionals: 2,
//   maxNestingDepth: 1,
//   elseIfCount: 1,
//   elseCount: 2,
//   averageBranches: 2.5
// }

// Loops statistics
const loopStats = loops.getStatistics(template);
console.log(loopStats);
// {
//   totalLoops: 2,
//   maxNestingDepth: 0,
//   specialVarsUsed: 3,
//   averageContentLength: 45
// }
```

## Error Handling

### Strict Mode (default)

In strict mode, errors are thrown for:
- Undefined variables
- Invalid syntax
- Unclosed blocks

```javascript
const processor = new TemplateConditionals({ strictMode: true });
try {
  processor.processTemplate(template, variables);
} catch (error) {
  console.error('Template error:', error.message);
}
```

### Non-Strict Mode

In non-strict mode, errors are silently handled and original template is returned:

```javascript
const processor = new TemplateConditionals({ strictMode: false });
const result = processor.processTemplate(template, variables);
// Returns original template if errors occur
```

## Performance Considerations

- **Iteration Limits**: Loops are limited to 10,000 iterations by default
- **Nesting Depth**: Maximum nesting depth of 10 levels
- **Processing Iterations**: Templates are processed in multiple passes (max 50) to handle nested blocks
- **Large Arrays**: Performance tested with arrays up to 1,000 items

## Limitations

### Nested Loops with Dynamic Scope

The current implementation processes templates in multiple passes. Complex nested loops that reference properties of items from outer loops (e.g., `{{#each this.items}}` inside another loop) have limited support.

For best results:
- Use separate top-level variables for nested iterations
- Access nested data through direct property access (`{{this.property}}`)
- Use aliases for clearer code

### Example of Supported Pattern

```javascript
// Instead of this (limited support):
{{#each categories}}
  {{#each this.items}}
    {{this.name}}
  {{/each}}
{{/each}}

// Use this pattern:
{{#each categories}}
  Category: {{this.name}}
  (Process items separately or access via {{this.items}})
{{/each}}
```

## Future Enhancements

Potential improvements for future versions:
- Enhanced variable scoping for nested loops
- Additional loop helpers (reverse, filter, sort)
- Break/continue statements
- Range loops ({{#each 1..10}})
- Custom helper functions
- Performance optimizations for very large templates

## Testing

The implementation includes comprehensive test coverage:
- **Conditionals**: 42 tests covering all operators and edge cases
- **Loops**: 45 tests covering arrays, objects, and special variables
- **Total**: 87 tests with 100% pass rate

Run tests with:
```bash
npm test -- src/core/templates/conditionals.test.js
npm test -- src/core/templates/loops.test.js
```

## API Reference

### TemplateConditionals

#### Constructor
```javascript
new TemplateConditionals(options)
```

#### Methods
- `processTemplate(template, variables)` - Process template with conditionals
- `parseCondition(conditionString)` - Parse condition into structured object
- `evaluateCondition(conditionObj, variables)` - Evaluate a parsed condition
- `findConditionalBlocks(template)` - Find all conditional blocks
- `validate(template)` - Validate template syntax
- `getStatistics(template)` - Get template statistics

### TemplateLoops

#### Constructor
```javascript
new TemplateLoops(options)
```

#### Methods
- `processTemplate(template, variables)` - Process template with loops
- `parseLoop(loopString)` - Parse loop declaration
- `findLoopBlocks(template)` - Find all loop blocks
- `processLoop(block, variables)` - Process a single loop block
- `validate(template)` - Validate template syntax
- `getStatistics(template)` - Get template statistics
- `previewLoop(template, variables)` - Preview what loops will generate

## License

Part of the Lokus project.
