# Lokus Plugin CLI - Advanced Plugin Development Toolkit

🚀 **Professional-grade CLI for developing Lokus plugins with modern tooling, comprehensive templates, and industry-standard development practices.**

## ✨ Features

### 🎯 Interactive Plugin Generator
- **Rich Template Library**: 8+ plugin types with comprehensive scaffolding
- **Smart Configuration**: Interactive prompts with intelligent defaults
- **Technology Choices**: TypeScript/JavaScript, multiple testing frameworks, build tools
- **Best Practices**: Pre-configured ESLint, Prettier, CI/CD pipelines

### ⚡ Advanced Development Tools
- **Hot Reload Server**: Instant feedback with WebSocket-based updates
- **Development Dashboard**: Real-time metrics, build status, and debugging tools
- **Source Maps**: Full debugging support with accurate line numbers
- **Performance Monitoring**: Build times, memory usage, and optimization hints

### 📦 Professional Packaging
- **Multi-format Support**: ZIP, TAR.GZ with compression options
- **Integrity Verification**: SHA-256 checksums and package validation
- **Marketplace Ready**: Optimized for Lokus, VS Code, Chrome Web Store
- **Digital Signing**: Package signing and verification support

### 🧪 Comprehensive Testing
- **Multi-framework Support**: Jest, Vitest, Mocha, AVA auto-detection
- **Coverage Reports**: Line, branch, function coverage with thresholds
- **Parallel Execution**: Optimized test runs with worker processes
- **Snapshot Testing**: UI component and API response snapshots

### 📚 Auto-generated Documentation
- **Multiple Generators**: TypeDoc, JSDoc, or custom documentation
- **Rich Templates**: Professional documentation with search and navigation
- **API Reference**: Auto-extracted from source code with examples
- **Development Server**: Live documentation with hot reload

## 🚀 Quick Start

### Installation

```bash
npm install -g @lokus/plugin-cli
```

### Create Your First Plugin

```bash
# Interactive plugin creation
lokus-plugin create

# Quick start with specific template
lokus-plugin create my-plugin --template react-ui-panel --author "Your Name"
```

### Development Workflow

```bash
# Start development server with hot reload
lokus-plugin dev

# Run tests with coverage
lokus-plugin test --coverage

# Build for production
lokus-plugin build --target production

# Generate documentation
lokus-plugin docs --serve

# Package for distribution
lokus-plugin package --format both --verify
```

## 📋 Plugin Templates

### 🚀 Basic TypeScript
Perfect for beginners and simple plugins
- **Complexity**: Beginner
- **Time**: 30 minutes
- **Features**: TypeScript, Jest testing, ESLint, Prettier

### ⚛️ React UI Panel
Create sophisticated user interfaces
- **Complexity**: Intermediate  
- **Time**: 2-3 hours
- **Features**: React 18, Styled Components, State Management, Storybook

### 🔤 Language Server
Full language support with LSP
- **Complexity**: Advanced
- **Time**: 1-2 days
- **Features**: Syntax highlighting, Code completion, Diagnostics

### 🎨 Custom Theme
Beautiful theme creation tools
- **Complexity**: Beginner
- **Time**: 1-2 hours
- **Features**: Color palette generator, Live preview, Theme validation

### 🔌 API Integration
Connect external services and APIs
- **Complexity**: Intermediate
- **Time**: 3-4 hours
- **Features**: HTTP client, Authentication, WebSocket support

### 📊 Data Visualization
Interactive charts and data displays
- **Complexity**: Advanced
- **Time**: 4-6 hours
- **Features**: D3.js, Chart.js, Real-time updates

### 🌿 Git Integration
Advanced Git workflow tools
- **Complexity**: Advanced
- **Time**: 1-2 days
- **Features**: Visual diff, Branch management, GitHub/GitLab integration

### 🤖 AI Assistant
AI-powered development features
- **Complexity**: Advanced
- **Time**: 2-3 days
- **Features**: Code completion, Documentation generation, Code review

## 🛠️ Commands Reference

### `create` - Interactive Plugin Generator

Create new plugins with rich templates and intelligent configuration.

```bash
lokus-plugin create [name] [options]

Options:
  -t, --template <template>     Plugin template to use
  -a, --author <author>         Plugin author
  -d, --description <desc>      Plugin description
  --category <category>         Plugin category
  --complexity <level>          Template complexity level
  --skip-prompts               Skip interactive prompts
  --no-typescript             Use JavaScript instead of TypeScript
  --no-git                     Skip Git repository initialization
  --no-install                 Skip dependency installation
  --testing <framework>        Testing framework (jest, vitest, none)
  --linting <tool>             Linting tool (eslint, biome, none)
  --formatting <tool>          Formatting tool (prettier, biome, none)
  --bundler <tool>             Build tool (esbuild, webpack, rollup, vite)
  --cicd <platform>            CI/CD platform (github, gitlab, none)
  --documentation <tool>       Documentation generator (typedoc, jsdoc, none)
  --examples                   Include example code
  --storybook                  Include Storybook for UI components
  --workspace                  Setup as monorepo workspace
```

### `dev` - Enhanced Development Server

Start development server with hot reload, debugging, and real-time monitoring.

```bash
lokus-plugin dev [options]

Options:
  -p, --port <port>            Server port (default: 3000)
  -h, --host <host>            Server host (default: localhost)
  --no-watch                   Disable file watching
  --no-hot                     Disable hot reload
  -o, --open                   Open browser after server start
  -v, --verbose                Verbose logging
  --https                      Use HTTPS
  --proxy <url>                Proxy API requests
  --tunnel                     Create public tunnel
  --inspect                    Enable Node.js inspector
  --coverage                   Enable code coverage
  --profiling                  Enable performance profiling
```

### `test` - Comprehensive Testing

Run tests with multi-framework support and advanced reporting.

```bash
lokus-plugin test [options]

Options:
  -w, --watch                  Watch files for changes
  -c, --coverage               Generate code coverage report
  -v, --verbose                Verbose output
  -p, --pattern <pattern>      Test file pattern
  -t, --testNamePattern <pattern>  Test name pattern
  --timeout <ms>               Test timeout in milliseconds
  --maxWorkers <num>           Maximum number of worker processes
  --bail                       Stop after first test failure
  --silent                     Suppress console output
  --reporter <name>            Test reporter to use
  --updateSnapshot             Update snapshots
  --detectOpenHandles          Detect open handles
  --forceExit                  Force exit after tests
  --passWithNoTests            Pass when no tests found
  --ci                         Run in CI mode
  --runInBand                  Run tests serially
  --onlyChanged                Only run tests for changed files
  --onlyFailures               Only run tests for failures
  --clearCache                 Clear test cache
  --debug                      Enable debug mode
```

### `package` - Professional Packaging

Package plugins for distribution with integrity verification and marketplace optimization.

```bash
lokus-plugin package [options]

Options:
  -o, --out-dir <dir>          Output directory (default: dist)
  -f, --format <format>        Package format (zip, tar, both)
  --no-minify                  Disable code minification
  --sourcemap                  Include source maps
  -t, --target <target>        Build target (production, development)
  --sign                       Sign the package
  --verify                     Verify package integrity
  --include-source             Include source code
  --include-docs               Include documentation
  --include-tests              Include tests
  --marketplace <name>         Target marketplace (lokus, vscode, chrome)
  --prerelease                 Mark as prerelease version
  --dry-run                    Perform dry run without creating files
```

### `docs` - Documentation Generation

Generate comprehensive documentation with multiple output formats and live preview.

```bash
lokus-plugin docs [options]

Options:
  -g, --generator <type>       Documentation generator (typedoc, jsdoc, custom)
  -o, --output <dir>           Output directory (default: docs)
  -w, --watch                  Watch files for changes
  -s, --serve                  Start development server
  -p, --port <port>            Server port (default: 8080)
  --include-source             Include source code
  --include-examples           Include examples
  --include-api                Include detailed API documentation
  --theme <theme>              Documentation theme
  -f, --format <format>        Output format (html, markdown, json)
  --coverage                   Generate documentation coverage report
  -v, --verbose                Verbose output
```

## 🏗️ Project Structure

### Generated Plugin Structure

```
my-plugin/
├── src/                     # Source code
│   ├── index.ts            # Main plugin entry point
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── components/         # UI components (if applicable)
├── test/                   # Test files
│   ├── setup.ts           # Test setup and configuration
│   └── *.test.ts          # Test suites
├── docs/                   # Documentation
├── examples/               # Usage examples
├── dist/                   # Built output
├── .github/                # GitHub Actions workflows
├── .storybook/             # Storybook configuration (if applicable)
├── plugin.json             # Plugin manifest
├── package.json            # NPM package configuration
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Jest configuration
├── .eslintrc.js           # ESLint configuration
├── .prettierrc            # Prettier configuration
└── README.md              # Generated documentation
```

## ⚙️ Configuration

### Plugin Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome Lokus plugin",
  "author": "Your Name",
  "main": "dist/index.js",
  "engines": {
    "lokus": "^1.0.0"
  },
  "categories": ["Editor"],
  "keywords": ["lokus", "plugin"],
  "permissions": [
    "editor:read",
    "editor:write"
  ],
  "contributes": {
    "commands": [
      {
        "command": "my-plugin.helloWorld",
        "title": "Hello World"
      }
    ]
  }
}
```

### TypeScript Configuration

The CLI generates optimized TypeScript configurations for different plugin types:

- **Strict mode enabled** for better code quality
- **Modern ES2020 target** for performance
- **Declaration files** for API documentation
- **Source maps** for debugging support

### Testing Configuration

Supports multiple testing frameworks with pre-configured setups:

- **Jest**: Popular testing framework with great TypeScript support
- **Vitest**: Fast Vite-native testing framework  
- **Mocha**: Flexible testing framework
- **AVA**: Concurrent test runner

## 🎯 Development Workflow

### 1. Create Plugin

```bash
lokus-plugin create awesome-plugin
```

Choose from interactive prompts:
- Plugin type and complexity
- Technology stack preferences
- Development tool configuration
- CI/CD and documentation setup

### 2. Start Development

```bash
cd awesome-plugin
lokus-plugin dev --open
```

Features:
- **Hot reload** for instant feedback
- **Development dashboard** at http://localhost:3000/dev-dashboard
- **WebSocket-based updates** for real-time communication
- **Build metrics** and performance monitoring

### 3. Write Tests

```bash
lokus-plugin test --coverage --watch
```

Capabilities:
- **Multi-framework support** with auto-detection
- **Coverage reporting** with thresholds
- **Snapshot testing** for UI components
- **Parallel execution** for performance

### 4. Generate Documentation

```bash
lokus-plugin docs --serve
```

Output:
- **API reference** extracted from source code
- **Usage examples** with live code samples  
- **Search functionality** for easy navigation
- **Responsive design** for mobile devices

### 5. Package for Distribution

```bash
lokus-plugin package --format both --verify --sign
```

Produces:
- **Optimized bundles** with minification
- **Integrity checksums** for verification
- **Marketplace metadata** for easy publishing
- **Digital signatures** for security

## 🔧 Advanced Features

### Hot Reload Development

The development server provides instant feedback:

```javascript
// Automatic injection of hot reload script
// WebSocket connection for real-time updates
// Build status indicators in the UI
// Error overlay with detailed information
```

### Plugin Debugging

Enhanced debugging capabilities:

```bash
# Enable Node.js inspector
lokus-plugin dev --inspect

# Enable verbose logging  
lokus-plugin dev --verbose

# Enable performance profiling
lokus-plugin dev --profiling
```

### Marketplace Integration

Optimized for multiple marketplaces:

```bash
# Lokus Marketplace
lokus-plugin package --marketplace lokus

# VS Code Marketplace  
lokus-plugin package --marketplace vscode

# Chrome Web Store
lokus-plugin package --marketplace chrome
```

### CI/CD Integration

Generated workflows for popular platforms:

- **GitHub Actions**: Automated testing, building, and publishing
- **GitLab CI**: Complete DevOps pipeline configuration
- **Quality Gates**: Code coverage, linting, and security checks

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/lokus/lokus-plugin-cli.git

# Install dependencies
cd lokus-plugin-cli
npm install

# Link for local development
npm link

# Run tests
npm test

# Build the CLI
npm run build
```

## 📄 License

MIT © [Lokus Team](https://lokus.dev)

---

## 🆘 Support

- **Documentation**: https://lokus.dev/docs/plugin-development
- **Community**: https://discord.gg/lokus
- **Issues**: https://github.com/lokus/lokus/issues
- **Examples**: https://github.com/lokus/plugin-examples

Built with ❤️ by the Lokus team and community.