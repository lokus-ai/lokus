# @lokus/plugin-cli

Official CLI tool for developing Lokus plugins.

## Installation

```bash
npm install -g @lokus/plugin-cli
```

## Usage

```bash
# Create a new plugin
lokus-plugin create my-plugin

# Interactive creation
lokus-plugin create interactive

# Create MCP plugin
lokus-plugin create mcp-server --name "AI Helper"

# Build plugin
lokus-plugin build

# Package for distribution
lokus-plugin package

# Validate manifest
lokus-plugin validate

# Test plugin
lokus-plugin test

# Development mode
lokus-plugin dev
```

## Templates

- `basic` - Simple plugin template
- `mcp-server` - MCP server plugin template
- `theme` - Theme plugin template
- `language` - Language support plugin

## Documentation

For complete documentation, see the [Plugin Development Guide](../../PLUGIN_DEVELOPMENT.md).

## License

MIT