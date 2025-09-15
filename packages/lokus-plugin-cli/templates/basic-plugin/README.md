# {{pluginNamePascalCase}}

{{description}}

## Features

- ✨ Basic plugin functionality
- 🔧 Configuration support
- 📝 Logging and debugging
- 🎯 Command registration example

## Installation

```bash
lokus-plugin install {{pluginName}}
```

## Development

### Prerequisites

- Node.js 16+
- npm 8+
- Lokus Plugin SDK

### Setup

```bash
# Clone/download the plugin
git clone <repository-url>
cd {{pluginName}}

# Install dependencies
npm install

# Start development server
lokus-plugin dev
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues
```

## Usage

After installation, the plugin adds the following features:

### Commands

- `{{pluginNamePascalCase}}: Hello World` - Shows a hello world message

### Configuration

The plugin can be configured through Lokus settings:

```json
{
  "{{pluginNameCamelCase}}": {
    "enabled": true,
    "debugMode": false
  }
}
```

## API

### Plugin Class: {{pluginNamePascalCase}}

The main plugin class that extends `BasePlugin` and provides:

- **activate()** - Plugin initialization
- **deactivate()** - Plugin cleanup
- **showHelloWorldMessage()** - Example functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

{{#if license}}{{license}}{{else}}MIT{{/if}}

## Author

{{author}}

---

*Built with [Lokus Plugin SDK](https://lokus.dev/docs/plugin-development)*