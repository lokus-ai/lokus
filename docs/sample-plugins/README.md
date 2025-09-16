# Sample Plugins

This directory contains working example plugins that demonstrate different aspects of the Lokus Plugin System. Each plugin showcases specific capabilities and patterns you can use in your own plugins.

## Available Samples

### 1. Simple Text Transformer Plugin
**File**: `simple-text-transformer.js`  
**Demonstrates**: Basic editor operations, slash commands, text manipulation  
**Level**: Beginner  

A straightforward plugin that adds text transformation commands like uppercase, lowercase, and title case. Perfect for learning the basics of plugin development.

### 2. Advanced Note Organizer Plugin
**File**: `note-organizer/`  
**Demonstrates**: Complex UI, file operations, settings management, event handling  
**Level**: Intermediate  

A comprehensive plugin that helps organize notes with tagging, categorization, and search functionality. Shows how to build more complex plugins with multiple features.

### 3. Live Collaboration Plugin
**File**: `live-collaboration/`  
**Demonstrates**: Network operations, real-time updates, custom extensions, WebSocket integration  
**Level**: Advanced  

An advanced plugin that enables real-time collaboration between multiple users. Demonstrates network permissions, complex state management, and custom editor extensions.

## How to Use These Samples

1. **Copy the plugin directory** to your Lokus plugins folder (`~/.lokus/plugins/`)
2. **Install dependencies** if the plugin has a `package.json`
3. **Restart Lokus** to load the plugin
4. **Check the plugin documentation** in each directory for specific usage instructions

## Learning Path

1. Start with the **Simple Text Transformer** to understand basic concepts
2. Progress to the **Note Organizer** to learn about UI and data management
3. Advance to the **Live Collaboration** plugin for complex integrations

## Modifying the Samples

Each sample includes detailed comments explaining the code. Feel free to:

- Modify the functionality to suit your needs
- Use parts of the code in your own plugins
- Experiment with different API methods
- Combine features from multiple samples

## Getting Help

If you have questions about the samples:

1. Check the inline code comments
2. Review the [Plugin Development Guide](../plugin-development-guide.md)
3. Consult the [API Reference](../plugin-api-reference.md)
4. Visit the [Troubleshooting Guide](../plugin-troubleshooting.md)

## Contributing

If you create interesting plugins, consider contributing them as samples to help other developers!