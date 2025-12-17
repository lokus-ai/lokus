# Lokus Plugin CLI

Advanced CLI toolkit for developing Lokus plugins with interactive templates, hot-reload, and comprehensive tooling.

## Installation

```bash
npm install -g lokus-plugin-cli
```

> **Note:** This CLI automatically installs the `@lokus/plugin-sdk` (or `lokus-plugin-sdk`) for you when you create a new project. You don't need to install the SDK manually unless you are adding it to an existing project.

## Usage

### Creating a Plugin

You can create a new plugin interactively or using command-line flags.

**Interactive Mode:**
```bash
lokus-plugin create my-plugin
```

**Non-Interactive Mode (using flags):**
```bash
lokus-plugin create my-plugin \
  --template basic-typescript \
  --author "Lokus Team" \
  --publisher "lokus" \
  --description "My awesome plugin" \
  --skip-prompts
```

**Partial Interactivity:**
You can provide some flags and let the CLI prompt for the rest:
```bash
lokus-plugin create my-plugin --template react-ui-panel
# CLI will skip template selection and ask for other details
```

**Available Flags:**

| Flag | Description |
|------|-------------|
| `-t, --template <id>` | Plugin template to use (e.g., `basic-typescript`, `react-ui-panel`) |
| `-a, --author <name>` | Plugin author name |
| `-p, --publisher <id>` | Publisher ID (lowercase, alphanumeric) |
| `-d, --description <text>` | Plugin description |
| `--skip-prompts` | Skip all prompts and use defaults/flags |
| `--no-typescript` | Use JavaScript instead of TypeScript |
| `--no-git` | Skip Git initialization |
| `--no-install` | Skip dependency installation |
| `--testing <framework>` | `jest`, `vitest`, or `none` |
| `--linting <tool>` | `eslint`, `biome`, or `none` |
| `--formatting <tool>` | `prettier`, `biome`, or `none` |
| `--bundler <tool>` | `esbuild`, `webpack`, `rollup`, or `vite` |
| `--cicd <platform>` | `github`, `gitlab`, or `none` |
| `--documentation <tool>` | `typedoc`, `jsdoc`, or `none` |
| `--examples` | Include example code |
| `--storybook` | Include Storybook (UI templates only) |
| `--workspace` | Setup as monorepo workspace |

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