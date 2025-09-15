# Hello World Plugin

A simple example plugin for Lokus that demonstrates basic plugin development concepts.

## Features

- 👋 **Say Hello**: Shows a friendly greeting message
- 🕐 **Show Time**: Displays the current date and time
- ✍️ **Insert Greeting**: Inserts a greeting at the cursor position

## Installation

### From Source

1. Clone or download this plugin
2. Open Lokus
3. Go to `File > Install Plugin` 
4. Select this plugin folder
5. The plugin will be activated automatically

### From Package

1. Download the `.lpkg` file
2. Open Lokus
3. Go to `File > Install Plugin`
4. Select the `.lpkg` file

## Usage

Once installed, you can access the plugin features through:

### Command Palette
- `Hello World: Say Hello` - Shows a greeting message
- `Hello World: Show Time` - Displays current time
- `Hello World: Insert Greeting` - Inserts greeting text

### Menu
Look for the "Hello World" menu item in the application menu.

## Development

This plugin serves as a template for developing your own Lokus plugins.

### Key Concepts Demonstrated

1. **Plugin Structure**: Basic file organization and manifest
2. **Command Registration**: How to register and handle commands
3. **UI Integration**: Adding menu items and showing messages
4. **Editor Interaction**: Inserting text at cursor position
5. **Error Handling**: Proper error handling and user feedback

### File Structure

```
hello-world-plugin/
├── plugin.json         # Plugin manifest
├── package.json        # Node.js package configuration
├── src/
│   └── index.js        # Main plugin implementation
└── README.md          # This file
```

### Customizing

You can use this plugin as a starting point for your own plugins:

1. Copy this folder to create your new plugin
2. Update `plugin.json` with your plugin details
3. Modify `src/index.js` to implement your functionality
4. Update `package.json` with your package details
5. Test and package your plugin

## API Reference

This plugin uses the following Lokus Plugin API features:

- `api.commands.registerCommand()` - Register commands
- `api.ui.showMessage()` - Show user messages
- `api.ui.addMenuItem()` - Add menu items
- `api.editor.getActiveEditor()` - Get current editor
- `editor.insertText()` - Insert text at cursor

## License

MIT License - Feel free to use this as a template for your own plugins!

## Support

For questions about plugin development:
- Check the [Plugin Development Guide](../PLUGIN_DEVELOPMENT.md)
- Visit our [Discord community](https://discord.gg/lokus)
- Open an issue on [GitHub](https://github.com/lokus-editor/lokus/issues)