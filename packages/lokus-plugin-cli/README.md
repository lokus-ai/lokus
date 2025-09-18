# Lokus Plugin CLI

Advanced CLI toolkit for developing Lokus plugins with interactive templates, hot-reload, and comprehensive tooling.

## Installation

```bash
npm install -g lokus-plugin-cli
```

## Usage

### Create a new plugin

```bash
lokus-plugin create my-awesome-plugin
```

Interactive prompts will guide you through:
- Plugin type (Editor, UI Panel, Data Provider, Theme, Integration)
- TypeScript or JavaScript
- Description and author information

### Development

```bash
cd my-awesome-plugin
lokus-plugin dev
```

### Build

```bash
lokus-plugin build
```

## Plugin Types

- **📝 Editor Extension** - Add custom editor functionality
- **🎨 UI Panel** - Add sidebar/bottom panels  
- **🔗 Data Provider** - Extend kanban/graph/search
- **🎭 Theme Plugin** - Custom themes and styling
- **🔌 Integration** - External service integration

## Features

- ✅ Interactive plugin generator
- ✅ Multiple plugin types and templates
- ✅ TypeScript and JavaScript support
- ✅ Professional project structure
- ⏳ Hot-reload development server (coming soon)
- ⏳ Build optimization (coming soon)
- ⏳ Plugin marketplace integration (coming soon)

## License

MIT