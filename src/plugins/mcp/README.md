# MCP (Model Context Protocol) Plugin System

This module implements comprehensive support for the Model Context Protocol (MCP) in Lokus, enabling developers to create AI-powered plugins with standardized resource discovery, tool execution, and prompt template management.

## Overview

The MCP Plugin System provides:

- **Resource Management**: Expose and access structured data (files, databases, APIs, etc.)
- **Tool Execution**: Define and execute functions that AI assistants can call
- **Prompt Templates**: Create reusable prompt templates with parameter substitution
- **Secure Communication**: JSON-RPC 2.0 based protocol with security sandboxing
- **Cross-Plugin Discovery**: Find and use resources/tools from other plugins

## Quick Start

### 1. Create an MCP Plugin

```javascript
// my-mcp-plugin.js
import { MCPResourceBuilder, MCPToolBuilder } from '@lokus/plugins/mcp'

export class MyMCPPlugin {
  async activate(mcpAPI) {
    this.mcpAPI = mcpAPI
    
    // Register a resource
    const resource = new MCPResourceBuilder()
      .setUri('file:///my-data')
      .setName('My Data')
      .setDescription('Access to my plugin data')
      .setType('file')
      .build()
    
    this.mcpAPI.server?.registerResource(resource)
    
    // Register a tool
    const tool = new MCPToolBuilder()
      .setName('process_data')
      .setDescription('Process data using my algorithm')
      .setInputSchema({
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data to process' }
        },
        required: ['data']
      })
      .setExecutor(async (args) => {
        return { result: `Processed: ${args.data}` }
      })
      .build()
    
    this.mcpAPI.server?.registerTool(tool)
  }
  
  async deactivate() {
    // Cleanup happens automatically
  }
}
```

### 2. Plugin Manifest

```json
{
  "id": "my-mcp-plugin",
  "name": "My MCP Plugin",
  "version": "1.0.0",
  "type": "mcp-server",
  "mcp": {
    "type": "mcp-server",
    "capabilities": {
      "resources": { "subscribe": true },
      "tools": { "listChanged": true }
    },
    "enableResourceSubscriptions": true,
    "enableToolExecution": true
  },
  "permissions": [
    "mcp:serve",
    "mcp:resources",
    "mcp:tools"
  ],
  "categories": ["MCP Server"],
  "main": "my-mcp-plugin.js"
}
```

## Architecture

### Core Components

1. **MCPProtocol**: JSON-RPC 2.0 implementation with MCP extensions
2. **MCPPluginManager**: Manages MCP plugin lifecycle and discovery
3. **MCPServerHost**: Hosts MCP servers (internal, external, embedded)
4. **MCPClient**: Client-side API for connecting to MCP servers

### Plugin Types

- **mcp-server**: Provides resources, tools, and prompts to other plugins
- **mcp-client**: Consumes resources and tools from other plugins
- **mcp-hybrid**: Both server and client capabilities

## API Reference

### MCPResourceBuilder

Create structured resource definitions:

```javascript
const resource = new MCPResourceBuilder()
  .setUri('file:///path/to/resource')
  .setName('Resource Name')
  .setDescription('Resource description')
  .setType('file') // file, directory, database, api, memory, web, custom
  .setMimeType('text/plain')
  .setContent('Resource content')
  .setMetadata({ readable: true, writable: false })
  .build()
```

### MCPToolBuilder

Create executable tools:

```javascript
const tool = new MCPToolBuilder()
  .setName('my_tool')
  .setDescription('Tool description')
  .setInputSchema({
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' }
    },
    required: ['input']
  })
  .setExecutor(async (args) => {
    // Tool implementation
    return { output: `Processed: ${args.input}` }
  })
  .build()
```

### MCPPromptBuilder

Create prompt templates:

```javascript
const prompt = new MCPPromptBuilder()
  .setName('code_review')
  .setDescription('Generate code review prompt')
  .setTemplate('Review this {{language}} code: {{code}}')
  .setArguments([
    { name: 'code', required: true, type: 'string' },
    { name: 'language', required: true, type: 'string' }
  ])
  .build()
```

### Client API

Connect to and use MCP servers:

```javascript
// In your plugin
async activate(mcpAPI) {
  // List available resources
  const resources = await mcpAPI.client?.listResources()
  
  // Read a resource
  const content = await mcpAPI.client?.readResource('file:///some/resource')
  
  // Call a tool
  const result = await mcpAPI.client?.callTool('process_data', { data: 'test' })
  
  // Get a prompt template
  const prompt = await mcpAPI.client?.getPrompt('code_review', {
    code: 'function test() {}',
    language: 'javascript'
  })
}
```

### Global Discovery

Find resources and tools across all plugins:

```javascript
// Find all file resources
const fileResources = mcpAPI.global?.findResources({ type: 'file' })

// Find text processing tools
const textTools = mcpAPI.global?.findTools({ search: 'text' })

// Find code-related prompts
const codePrompts = mcpAPI.global?.findPrompts({ search: 'code' })
```

## Resource Types

### File Resources
```javascript
MCPResourceHelper.createFileResource('/path/to/file', {
  name: 'My File',
  description: 'Important data file',
  mimeType: 'application/json'
})
```

### Web Resources
```javascript
MCPResourceHelper.createWebResource('https://api.example.com/data', {
  name: 'API Data',
  description: 'External API endpoint',
  mimeType: 'application/json'
})
```

### Database Resources
```javascript
MCPResourceHelper.createDatabaseResource('sqlite:///data.db', {
  name: 'Local Database',
  description: 'SQLite database',
  mimeType: 'application/sql'
})
```

## Security

### Permissions

MCP plugins require specific permissions:

- `mcp:serve` - Host MCP servers
- `mcp:connect` - Connect to MCP servers
- `mcp:resources` - Access MCP resources
- `mcp:tools` - Execute MCP tools
- `mcp:prompts` - Access MCP prompts

### Sandboxing

MCP plugins run in secure sandboxes with:

- Memory limits
- CPU time limits
- API call rate limiting
- Network access restrictions
- File system access controls

### Configuration

```json
{
  "mcp": {
    "memoryLimit": 50000000,     // 50MB
    "cpuTimeLimit": 5000,        // 5 seconds
    "maxApiCalls": 1000,         // Per time window
    "requireSignature": false    // Code signing requirement
  }
}
```

## Error Handling

MCP uses standard JSON-RPC 2.0 error codes plus MCP-specific codes:

- `-32001` - Resource not found
- `-32002` - Resource access denied
- `-32003` - Resource unavailable
- `-32011` - Tool not found
- `-32012` - Tool execution error
- `-32021` - Prompt not found

```javascript
try {
  const result = await mcpAPI.client.callTool('my_tool', { data: 'test' })
} catch (error) {
  if (error.code === -32011) {
    console.error('Tool not found:', error.message)
  }
}
```

## Best Practices

### Resource Design

1. **Use descriptive URIs**: `file:///workspace/documents` not `file:///docs`
2. **Provide rich metadata**: Include file sizes, permissions, timestamps
3. **Handle subscriptions**: Notify subscribers of resource changes
4. **Validate access**: Check permissions before exposing resources

### Tool Design

1. **Clear descriptions**: Explain what the tool does and when to use it
2. **Comprehensive schemas**: Define all parameters with types and descriptions
3. **Error handling**: Return meaningful error messages
4. **Idempotent operations**: Tools should be safe to call multiple times

### Prompt Templates

1. **Flexible parameters**: Support optional parameters with defaults
2. **Clear instructions**: Make prompts self-explanatory
3. **Context-aware**: Include relevant context in templates
4. **Versioning**: Update prompts carefully to maintain compatibility

### Performance

1. **Lazy loading**: Only load resources when needed
2. **Caching**: Cache frequently accessed data
3. **Batch operations**: Group related operations when possible
4. **Resource cleanup**: Dispose of resources properly

## Examples

See `examples/example-mcp-plugin.js` for a comprehensive example demonstrating:

- Resource registration and management
- Tool creation and execution
- Prompt template usage
- Client-side resource discovery
- Cross-plugin communication

## Integration

### With Existing Plugins

Add MCP support to existing plugins:

```javascript
// Add to existing plugin
export class ExistingPlugin {
  async activate(api) {
    // Existing activation code...
    
    // Add MCP support if available
    if (api.mcp) {
      await this.setupMCP(api.mcp)
    }
  }
  
  async setupMCP(mcpAPI) {
    // Register MCP resources and tools
  }
}
```

### Plugin Manifest Updates

```json
{
  "type": "mcp-hybrid",
  "mcp": {
    "type": "mcp-hybrid",
    "capabilities": {
      "resources": { "subscribe": true },
      "tools": { "listChanged": true }
    }
  },
  "permissions": [
    "existing_permission",
    "mcp:serve",
    "mcp:connect"
  ]
}
```

## Troubleshooting

### Common Issues

1. **Plugin not recognized as MCP**: Ensure `type` or `mcp` field in manifest
2. **Permission denied**: Add required MCP permissions
3. **Resource not found**: Check URI format and accessibility
4. **Tool execution fails**: Validate input schema and error handling

### Debugging

Enable MCP logging:

```javascript
// In plugin
console.log('MCP Stats:', mcpAPI.getStats?.())

// Check resource registration
const resources = mcpAPI.global?.findResources({ pluginId: 'my-plugin' })
console.log('My resources:', resources)
```

### Validation

Use the enhanced manifest validator:

```javascript
import { validateManifestEnhanced } from '@lokus/plugins/core/PluginManifest'

const result = validateManifestEnhanced(manifest)
if (!result.valid) {
  console.error('Manifest errors:', result.errors)
}
```

## Protocol Specification

This implementation follows the MCP specification version 2024-11-05. For detailed protocol information, see the [official MCP specification](https://modelcontextprotocol.io/).

## Contributing

When contributing to the MCP system:

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure backward compatibility when possible
5. Validate against the MCP specification

## License

This MCP implementation is part of the Lokus project and follows the same license terms.