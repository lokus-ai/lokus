# Code Snippets Plugin

A powerful code snippets plugin for Lokus that provides customizable code templates, slash commands, and text expansion functionality.

## Features

- **Pre-built Snippets**: Includes popular code templates for JavaScript, Python, HTML, CSS, and more
- **Text Expansion**: Automatically expand snippets using configurable triggers (default: `::`)
- **Slash Commands**: Insert snippets using slash commands in the editor
- **Template Variables**: Support for placeholders and variable substitution
- **Custom Snippets**: Create and manage your own custom code snippets
- **Language Support**: Snippets organized by programming language
- **Management Panel**: Visual interface for browsing and managing snippets

## Installation

1. Copy this plugin folder to your Lokus plugins directory
2. Enable the plugin in Lokus settings
3. Start using snippets with slash commands or text expansion

## Usage

### Text Expansion

Type the expansion trigger (default `::`) followed by a snippet name:
```
::js-func → JavaScript function template
::py-class → Python class template  
::html5 → HTML5 boilerplate
::log → Console.log statement
```

### Slash Commands

Use slash commands in the editor:
- `/snippet` - Show snippet selector
- `/js-func` - Insert JavaScript function
- `/py-func` - Insert Python function
- `/html5` - Insert HTML5 boilerplate
- `/log` - Insert console.log statement

### Management Panel

Access the Code Snippets panel from the sidebar to:
- Browse all available snippets
- Insert snippets directly
- View snippet descriptions and languages
- Manage custom snippets

## Built-in Snippets

### JavaScript
- `js-func` - Basic function template
- `js-arrow` - Arrow function template
- `js-class` - ES6 class template
- `log` - Console.log statement

### Python
- `py-func` - Function with docstring
- `py-class` - Class template

### HTML/CSS
- `html5` - HTML5 boilerplate
- `css-flex` - Flexbox container

### Generic
- `comment` - Multi-line comment block
- `todo` - TODO comment

## Template Variables

Snippets support template variables using `{{variable}}` syntax:

```javascript
function {{name}}({{params}}) {
  {{cursor}}
  return {{return_value}};
}
```

Common variables:
- `{{cursor}}` - Cursor position after insertion
- `{{name}}` - Function/class name
- `{{params}}` - Parameters
- `{{description}}` - Description text

## Configuration

### Settings

- **Enable Text Expansion** (default: `true`): Automatically expand snippet triggers
- **Expansion Trigger** (default: `::`): Characters that trigger snippet expansion
- **Show Preview** (default: `true`): Show snippet preview in menus
- **Auto Indent** (default: `true`): Automatically indent snippets

### Commands

- `code-snippets.insert` - Insert Code Snippet (Ctrl+Shift+S)
- `code-snippets.manage` - Manage Code Snippets
- `code-snippets.create` - Create New Snippet

## API Integration

This plugin demonstrates several Lokus Plugin API features:

### Slash Commands
```javascript
// Register slash command
this.registerCommand({
  name: 'snippet',
  description: 'Insert a code snippet',
  action: (args) => this.insertSnippet(args)
});
```

### Text Expansion
```javascript
// Listen for editor input
this.addEventListener('editor:input', (event) => {
  this.checkForExpansion(event);
});
```

### Content Insertion
```javascript
// Insert content at cursor
this.insertContent(processedContent);

// Replace text range
this.api.editor.replaceRange(from, to, content);
```

### Settings Management
```javascript
// Load plugin settings
const trigger = await this.getSetting('expansionTrigger', '::');

// Save custom snippets
await this.setSetting('customSnippets', snippets);
```

## Creating Custom Snippets

Custom snippets use this structure:

```javascript
{
  name: 'My Snippet',
  description: 'Description of what it does',
  language: 'javascript',
  content: `const {{name}} = {{value}};{{cursor}}`,
  variables: ['name', 'value']
}
```

### Snippet Properties

- `name` - Display name for the snippet
- `description` - Brief description of the snippet
- `language` - Programming language (for syntax highlighting and organization)
- `content` - The actual template content with variables
- `variables` - Array of variable names used in the template

### Variable Substitution

Variables in snippets are automatically replaced with default values:
- `{{cursor}}` - Removed, cursor positioned here
- `{{name}}` - Default: 'myFunction'
- `{{params}}` - Default: '' (empty)
- `{{description}}` - Default: 'Description here'
- Custom variables get `[variable_name]` as placeholder

## Technical Implementation

### Text Processing

The plugin uses sophisticated text processing for expansion:

1. **Trigger Detection**: Monitors editor input for expansion triggers
2. **Pattern Matching**: Uses regex to identify snippet triggers
3. **Variable Substitution**: Replaces template variables with values
4. **Cursor Positioning**: Places cursor at designated position

### Performance Optimization

- **Debounced Input**: Prevents excessive processing during typing
- **Lazy Loading**: Snippets loaded on demand
- **Efficient Storage**: Only custom snippets stored, defaults regenerated

### Code Structure

```
code-snippets-plugin/
├── plugin.json          # Plugin manifest and configuration
├── index.js            # Main plugin implementation
└── README.md           # Documentation (this file)
```

### Key Classes and Methods

- `CodeSnippetsPlugin`: Main plugin class extending BasePlugin
- `loadSnippets()`: Load and merge default and custom snippets
- `setupTextExpansion()`: Initialize text expansion functionality
- `insertSnippet()`: Insert snippet at cursor position
- `processSnippetContent()`: Handle variable substitution

## Troubleshooting

### Snippets Not Expanding
- Check that text expansion is enabled in settings
- Verify the expansion trigger characters
- Ensure snippet names match exactly

### Custom Snippets Not Saving
- Check plugin permissions for file write access
- Verify snippet format matches the schema
- Check browser console for error messages

### Performance Issues
- Reduce debounce delay if expansion feels slow
- Limit number of custom snippets for better performance

## Development

### Adding New Default Snippets

1. Edit the `getDefaultSnippets()` method in `index.js`
2. Add new snippet with proper structure
3. Include in popular snippets list for slash commands

### Testing Snippets

1. Enable developer mode in Lokus
2. Load the plugin from examples directory
3. Test text expansion and slash commands
4. Verify variable substitution works correctly

## License

This plugin is part of the Lokus examples and is provided under the same license as the main Lokus application.