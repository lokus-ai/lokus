# MCP Plugin Templates System

A comprehensive template system for generating MCP-enabled plugins for Lokus. This system provides developer-friendly templates, CLI integration, and example projects to make MCP plugin development easy and efficient.

## Overview

The MCP Plugin Templates System consists of several components:

- **Template Generator**: Core template generation functionality
- **Template Configuration**: Metadata and validation for templates
- **CLI Integration**: Command-line tools for template usage
- **Example Projects**: Complete working examples for different use cases
- **Type Definitions**: TypeScript support for template development

## Features

### 🚀 Template Types

- **Basic MCP Server**: Simple resource and tool providers
- **AI Assistant Plugin**: Chat/AI integration with prompts
- **Data Provider**: Database/API resource providers
- **Tool Collection**: Utility functions exposed as MCP tools
- **Multi-Server Plugin**: Complex plugins with multiple MCP servers

### 🛠️ Development Tools

- **Interactive CLI**: `lokus-plugin create` with guided setup
- **Template Validation**: Comprehensive validation and error checking
- **TypeScript Support**: Full TypeScript definitions and templates
- **Build Configuration**: Automated build setup (package.json, tsconfig, etc.)
- **Testing Scaffolding**: Unit and integration test templates

### 📚 Example Projects

- **Basic File Server**: File system access example
- **Smart Writing Assistant**: AI-powered writing tools
- **Database Connector**: Data provider patterns
- **Developer Tools**: Tool collection examples
- **Enterprise Workspace**: Advanced multi-server architecture

## Quick Start

### Installation

The template system is built into Lokus and automatically available when the plugin system is initialized:

```javascript
import { initializePluginSystem } from '@lokus/plugins'

// Initialize with template support (enabled by default)
const { pluginManager, templateSystem } = await initializePluginSystem(editorAPI, {
  enableTemplates: true
})
```

### Generate a Plugin

#### Using the CLI (Recommended)

```bash
# Interactive generation
lokus-plugin create interactive

# Direct generation
lokus-plugin create basic-mcp-server --name "My File Server" --id "my-file-server"

# With options
lokus-plugin create ai-assistant \
  --name "Writing Helper" \
  --id "writing-helper" \
  --typescript \
  --include-tests \
  --api-provider openai
```

#### Using the API

```javascript
import { generateMCPPlugin, TEMPLATE_TYPES } from '@lokus/plugins'

const pluginStructure = await generateMCPPlugin(TEMPLATE_TYPES.BASIC_MCP_SERVER, {
  pluginId: 'my-file-server',
  pluginName: 'My File Server',
  description: 'A simple file server plugin',
  author: 'Your Name',
  useTypeScript: true,
  includeTests: true,
  includeDocumentation: true,
  
  // Template-specific options
  serverName: 'file-server',
  includeResources: true,
  includeTools: true
})
```

### Download Examples

```bash
# List available examples
lokus-plugin list examples

# Download an example
lokus-plugin download example basic-file-server ./my-plugin

# Browse examples by category
lokus-plugin list examples --category getting-started
```

## Template Types

### Basic MCP Server
Perfect for beginners learning MCP concepts.

**Features**: File system resources, basic tools, simple commands
**Complexity**: Beginner
**Use Cases**: File access, simple data providers, learning MCP

```bash
lokus-plugin create basic-mcp-server --name "File Manager"
```

### AI Assistant Plugin
AI-powered plugins with chat interfaces and prompt templates.

**Features**: AI integration, chat UI, prompt management, tool execution
**Complexity**: Intermediate
**Use Cases**: Writing assistants, code helpers, content generation

```bash
lokus-plugin create ai-assistant --name "Code Assistant" --api-provider openai
```

### Data Provider
Connect to databases and APIs with caching and synchronization.

**Features**: Database connections, API clients, caching, resource management
**Complexity**: Intermediate
**Use Cases**: Database integrations, API wrappers, data synchronization

```bash
lokus-plugin create data-provider --name "DB Connector" --data-source database
```

### Tool Collection
Collections of utility tools and functions.

**Features**: Multiple tools, validation, error handling, composition
**Complexity**: Beginner
**Use Cases**: Development utilities, text processing, file operations

```bash
lokus-plugin create tool-collection --name "Dev Tools" --tool-category dev
```

### Multi-Server Plugin
Advanced plugins with multiple coordinated MCP servers.

**Features**: Server coordination, shared state, event bus, monitoring
**Complexity**: Advanced
**Use Cases**: Enterprise systems, complex integrations, microservices

```bash
lokus-plugin create multi-server --name "Workspace Manager" --server-count 3
```

## CLI Commands

### Create
Generate new plugins from templates.

```bash
# Interactive mode
lokus-plugin create interactive

# Direct creation
lokus-plugin create <template-type> [options]

# Options:
#   --name, -n         Plugin name
#   --id, -i           Plugin ID
#   --directory, -d    Target directory
#   --typescript, -t   Use TypeScript
#   --no-tests         Skip test files
#   --no-docs          Skip documentation
#   --no-install       Skip dependency installation
#   --no-git           Skip git initialization
```

### List
List available templates and examples.

```bash
# List templates
lokus-plugin list

# List by category
lokus-plugin list --category basic

# List by complexity
lokus-plugin list --complexity beginner

# List examples
lokus-plugin list examples
```

### Show
Show detailed information about templates.

```bash
# Show template details
lokus-plugin show basic-mcp-server

# Show all template info
lokus-plugin show --all
```

### Download
Download example projects.

```bash
# Download example
lokus-plugin download example <example-id> <target-directory>

# List available examples
lokus-plugin download list
```

## API Reference

### Template Generation

```typescript
import { 
  generateMCPPlugin, 
  getAvailableMCPTemplates,
  TEMPLATE_TYPES,
  TEMPLATE_COMPLEXITY
} from '@lokus/plugins'

// Generate plugin
const structure = await generateMCPPlugin(templateType, options)

// List templates
const templates = getAvailableMCPTemplates()

// Filter by complexity
const beginnerTemplates = templates.filter(t => 
  t.complexity === TEMPLATE_COMPLEXITY.BEGINNER
)
```

### Example Projects

```typescript
import { initializeExampleRegistry } from '@lokus/plugins'

const registry = await initializeExampleRegistry()

// List examples
const examples = registry.listExamples()

// Get by category
const aiExamples = registry.getExamplesByFeature('ai-integration')

// Download example
await registry.downloadExample('basic-file-server', './my-plugin')
```

### Template Configuration

```typescript
import { TemplateConfig, TEMPLATE_FEATURES } from '@lokus/plugins'

const config = new TemplateConfig()

// Register custom template
config.registerTemplate('my-template', {
  name: 'My Custom Template',
  description: 'Custom template description',
  category: 'custom',
  version: '1.0.0',
  files: {
    'src/index.js': 'console.log("Hello from {{pluginName}}")'
  }
})

// Validate options
const validation = config.validateGenerationOptions('my-template', {
  pluginId: 'test-plugin',
  pluginName: 'Test Plugin'
})
```

## File Structure

Generated plugins follow this structure:

```
my-plugin/
├── plugin.json              # Plugin manifest
├── package.json             # Dependencies and scripts
├── README.md                # Plugin documentation
├── CHANGELOG.md             # Version history
├── .gitignore               # Git ignore rules
├── .eslintrc.json           # ESLint configuration
├── tsconfig.json            # TypeScript config (if using TS)
├── .lokus-template.json     # Template metadata
├── src/
│   ├── index.js|ts          # Main plugin file
│   ├── server.js|ts         # MCP server implementation
│   ├── resources.js|ts      # Resource definitions
│   ├── tools.js|ts          # Tool implementations
│   └── utils.js|ts          # Utility functions
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── setup.js|ts          # Test setup
└── docs/
    ├── API.md               # API documentation
    ├── DEVELOPMENT.md       # Development guide
    └── DEPLOYMENT.md        # Deployment guide
```

## Template Customization

Templates support extensive customization through options:

### Common Options

```typescript
interface TemplateGenerationOptions {
  // Core plugin information
  pluginId: string              // Required
  pluginName: string            // Required
  displayName?: string          // Display name
  version?: string              // Plugin version
  description?: string          // Plugin description
  publisher?: string            // Publisher name
  author?: string               // Author name
  license?: string              // License type
  
  // Development options
  useTypeScript?: boolean       // Use TypeScript
  includeTests?: boolean        // Include test files
  includeDocumentation?: boolean // Include docs
  includeBuildConfig?: boolean  // Include build config
  
  // Template-specific options
  [key: string]: any           // Custom template options
}
```

### Template-Specific Options

Each template type supports additional customization:

#### Basic MCP Server
```typescript
{
  serverName: string           // MCP server name
  includeResources: boolean    // Include resource examples
  includeTools: boolean        // Include tool examples
  includePrompts: boolean      // Include prompt examples
}
```

#### AI Assistant
```typescript
{
  assistantName: string        // Assistant display name
  includeChat: boolean         // Include chat interface
  includePromptLibrary: boolean // Include prompt library
  aiProvider: 'openai' | 'anthropic' | 'local' | 'custom'
}
```

#### Data Provider
```typescript
{
  dataSource: 'database' | 'api' | 'file' | 'memory'
  includeCache: boolean        // Include caching layer
  includeSync: boolean         // Include synchronization
  authRequired: boolean        // Include authentication
}
```

## Best Practices

### Template Selection

1. **Start Simple**: Begin with basic templates for learning
2. **Match Use Case**: Choose templates that align with your goals
3. **Consider Complexity**: Pick appropriate complexity level
4. **Review Examples**: Study example projects before starting

### Development Workflow

1. **Generate Template**: Use CLI or API to generate plugin structure
2. **Review Generated Code**: Understand the generated patterns
3. **Customize Implementation**: Modify for your specific needs
4. **Test Thoroughly**: Use included test scaffolding
5. **Document Changes**: Update README and API docs

### Plugin Architecture

1. **Follow MCP Patterns**: Use established MCP resource/tool patterns
2. **Implement Security**: Validate inputs and handle errors properly
3. **Design for Reuse**: Create modular, composable components
4. **Monitor Performance**: Consider resource limits and optimization
5. **Plan for Updates**: Design for backward compatibility

## Advanced Usage

### Custom Templates

Create your own templates by extending the base system:

```typescript
import { MCPPluginTemplateGenerator, TemplateConfig } from '@lokus/plugins'

const generator = new MCPPluginTemplateGenerator()

// Register custom template
generator.registerTemplate('my-custom-template', {
  name: 'My Custom Template',
  description: 'Custom template for specific use case',
  category: 'custom',
  complexity: 'intermediate',
  features: ['mcp-server', 'custom-feature'],
  files: {
    'src/index.js': customMainFileTemplate,
    'src/custom.js': customFeatureTemplate
  },
  customization: {
    customOption: {
      type: 'string',
      required: true,
      description: 'Custom configuration option'
    }
  }
})
```

### Integration with Build Systems

Templates can be integrated with existing build systems:

```javascript
// webpack.config.js
const { generateMCPPlugin } = require('@lokus/plugins')

module.exports = async (env) => {
  if (env.generatePlugin) {
    await generateMCPPlugin(env.template, {
      ...env.options,
      outputPath: './generated-plugins'
    })
  }
  
  return {
    // Your webpack config
  }
}
```

### CI/CD Integration

Automate plugin generation in CI/CD pipelines:

```yaml
# .github/workflows/generate-plugins.yml
name: Generate Plugins
on:
  workflow_dispatch:
    inputs:
      template:
        description: 'Template type'
        required: true
        type: choice
        options:
          - basic-mcp-server
          - ai-assistant
          - data-provider

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: |
          npx lokus-plugin create ${{ github.event.inputs.template }} \
            --name "Generated Plugin" \
            --id "generated-plugin" \
            --no-install \
            --no-git
```

## Troubleshooting

### Common Issues

1. **Template Not Found**
   - Check template name spelling
   - Ensure template system is initialized
   - Verify template is registered

2. **Generation Fails**
   - Validate required options are provided
   - Check file permissions in target directory
   - Review error messages for specific issues

3. **Missing Dependencies**
   - Run `npm install` in generated plugin directory
   - Check package.json for correct dependencies
   - Verify Node.js version compatibility

4. **TypeScript Errors**
   - Ensure TypeScript is installed
   - Check tsconfig.json configuration
   - Verify type definitions are available

### Debug Mode

Enable debug logging for detailed information:

```bash
DEBUG=lokus:templates lokus-plugin create basic-mcp-server
```

```javascript
process.env.DEBUG = 'lokus:templates'
const structure = await generateMCPPlugin(templateType, options)
```

## Contributing

### Adding New Templates

1. Create template files in `src/plugins/templates/`
2. Register template in `MCPPluginTemplate.js`
3. Add TypeScript definitions
4. Create example project
5. Update documentation
6. Add tests

### Example Project Guidelines

1. Include complete, working implementation
2. Add comprehensive README
3. Follow coding best practices
4. Include tests and documentation
5. Provide clear learning objectives

## Migration Guide

### From Manual Plugin Creation

If you have existing manually created plugins:

1. **Generate Similar Template**: Create template matching your plugin type
2. **Compare Structures**: Review differences in file organization
3. **Migrate Gradually**: Move code to template structure incrementally
4. **Update Manifest**: Ensure plugin.json follows v2 format
5. **Add MCP Integration**: Integrate with MCP protocol if needed

### Template Version Updates

When templates are updated:

1. **Check Changelog**: Review template changes
2. **Regenerate if Needed**: Consider regenerating for major updates
3. **Merge Changes**: Manually merge improvements
4. **Test Thoroughly**: Ensure compatibility with changes

## Roadmap

### Planned Features

- **Visual Template Builder**: GUI for creating custom templates
- **Template Marketplace**: Share and discover community templates
- **Advanced Validation**: Enhanced validation and linting
- **Performance Optimization**: Faster generation and better caching
- **Additional Examples**: More complex real-world examples

### Version History

- **v1.0.0**: Initial release with basic templates
- **v1.1.0**: Added AI assistant and data provider templates
- **v1.2.0**: CLI integration and example projects
- **v1.3.0**: TypeScript support and advanced templates

## License

MIT License - see LICENSE file for details.

## Support

For questions and support:

- Documentation: `/docs/plugins/templates/`
- Issues: GitHub Issues
- Community: Discord #plugin-development
- Email: plugins@lokus.dev