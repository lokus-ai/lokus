# Example MCP Plugin

An example MCP (Model Context Protocol) plugin for Lokus that demonstrates how to create AI-powered plugins with resources, tools, and prompts.

## What is MCP?

MCP (Model Context Protocol) is a standard protocol that enables AI assistants to interact with plugins through:
- **Resources**: Data sources the AI can access
- **Tools**: Functions the AI can execute  
- **Prompts**: Reusable templates for AI interactions

## Features

### 🗂️ Resources
- **Workspace Files**: Access to project files and documents
- **Project Information**: Live project structure and metadata
- **Code Snippets**: Collection of reusable code snippets

### 🛠️ Tools
- **Code Formatter**: Format code in multiple languages
- **File Search**: Search workspace files by name or content
- **Documentation Generator**: Generate docs for code functions

### 📝 Prompts
- **Code Review**: Comprehensive code review template
- **Bug Fixing**: Structured bug fixing assistance
- **API Documentation**: Generate API documentation

## Installation

### From Plugin Marketplace
1. Open Lokus
2. Go to Marketplace (Package icon in sidebar)
3. Search for "Example MCP Plugin"
4. Click Install

### Manual Installation
1. Download or clone this plugin
2. Open Lokus
3. Go to `File > Install Plugin`
4. Select this plugin folder

## Usage

Once installed, AI assistants can use this plugin to:

### Access Resources
```
AI: Can you show me the workspace files?
Plugin: [Returns list of files and folders]

AI: What's the current project structure?
Plugin: [Returns project metadata and organization]
```

### Execute Tools
```
AI: Format this JavaScript code for me
Plugin: [Executes format_code tool with provided code]

AI: Search for all Python files containing "database"
Plugin: [Executes search_files tool with query and filter]
```

### Use Prompts
```
AI: Review this code for issues
Plugin: [Uses code_review prompt template for structured review]

AI: Help me fix this bug
Plugin: [Uses fix_bug prompt template for systematic debugging]
```

## Development

This plugin demonstrates key MCP concepts:

### Resource Registration
```javascript
const resource = new MCPResourceBuilder()
  .setUri('lokus://project/info')
  .setName('Project Information')
  .setDescription('Current project structure and metadata')
  .setType('structured')
  .build()

mcpAPI.server?.registerResource(resource)
```

### Tool Implementation
```javascript
const tool = new MCPToolBuilder()
  .setName('format_code')
  .setDescription('Format code using various formatters')
  .setInputSchema({
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string' }
    }
  })
  .setExecutor(async (args) => {
    return await this.formatCode(args.code, args.language)
  })
  .build()

mcpAPI.server?.registerTool(tool)
```

### Prompt Templates
```javascript
const prompt = new MCPPromptBuilder()
  .setName('code_review')
  .setDescription('Perform comprehensive code review')
  .setArguments([
    { name: 'code', required: true },
    { name: 'language', required: true }
  ])
  .setTemplate(`
    Review this {{language}} code:
    \`\`\`{{language}}
    {{code}}
    \`\`\`
  `)
  .build()

mcpAPI.server?.registerPrompt(prompt)
```

## Configuration

The plugin supports various configuration options in `plugin.json`:

```json
{
  "type": "mcp-server",
  "mcp": {
    "capabilities": {
      "resources": { "subscribe": true },
      "tools": { "listChanged": true },
      "prompts": {}
    },
    "enableResourceSubscriptions": true,
    "enableToolExecution": true
  },
  "permissions": [
    "mcp:serve",
    "mcp:resources",
    "mcp:tools",
    "mcp:prompts"
  ]
}
```

## Extending

You can extend this plugin by:

### Adding New Resources
```javascript
const customResource = new MCPResourceBuilder()
  .setUri('custom://my-data')
  .setName('My Custom Data')
  .setDescription('Custom data source')
  .build()
```

### Creating New Tools
```javascript
const customTool = new MCPToolBuilder()
  .setName('my_tool')
  .setDescription('My custom tool')
  .setExecutor(async (args) => {
    // Your tool logic here
    return { result: 'success' }
  })
  .build()
```

### Adding Prompt Templates
```javascript
const customPrompt = new MCPPromptBuilder()
  .setName('my_prompt')
  .setDescription('My custom prompt')
  .setTemplate('Custom template with {{variables}}')
  .build()
```

## Testing

Test your MCP plugin:

```bash
# Run unit tests
npm test

# Test with MCP client
lokus-plugin test-mcp

# Debug MCP communication
lokus-plugin debug-mcp --verbose
```

## Best Practices

1. **Resource Design**
   - Use clear, descriptive URIs
   - Include proper MIME types
   - Add relevant annotations

2. **Tool Implementation**
   - Validate input schemas thoroughly
   - Handle errors gracefully
   - Return structured results

3. **Prompt Templates**
   - Use clear variable names
   - Include helpful instructions
   - Support conditional content

4. **Security**
   - Request minimal permissions
   - Validate all inputs
   - Sanitize outputs

## Troubleshooting

### Common Issues

1. **Plugin not registering with MCP**
   - Check `type: "mcp-server"` in manifest
   - Verify MCP permissions
   - Check console for errors

2. **Tools not executing**
   - Validate input schemas
   - Check tool executor implementation
   - Verify proper error handling

3. **Resources not accessible**
   - Check resource URIs
   - Verify resource registration
   - Check subscription settings

## License

MIT License - Feel free to use as a template for your own MCP plugins!

## Related

- [Basic Plugin Example](../example-plugin/) - Simple plugin without MCP
- [Plugin Development Guide](../PLUGIN_DEVELOPMENT.md) - Comprehensive development guide
- [MCP Specification](https://modelcontextprotocol.io/) - Official MCP documentation