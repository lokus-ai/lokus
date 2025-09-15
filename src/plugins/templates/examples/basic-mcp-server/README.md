# Basic File Server MCP Plugin

A simple example demonstrating how to create an MCP server plugin that provides file system access through resources and tools.

## Features

- **File System Resources**: Expose workspace files and documents as MCP resources
- **File Operations**: Read, write, list files and directories through MCP tools
- **Security**: Path validation and file type restrictions for safe operation
- **Monitoring**: Real-time file system monitoring and resource updates

## MCP Resources

### Workspace Files
- **URI**: `file:///workspace`
- **Type**: Directory
- **Description**: All files in the workspace directory
- **Capabilities**: Read, Write, Watch

### Documents
- **URI**: `file:///workspace/documents`
- **Type**: Collection
- **Description**: Document files in the workspace
- **Supported Types**: `.md`, `.txt`, `.doc`, `.docx`, `.pdf`

## MCP Tools

### read_file
Read the contents of a file.

**Parameters:**
- `path` (string, required): Absolute or relative path to the file
- `encoding` (string, optional): File encoding (default: utf8)

**Example:**
```json
{
  "path": "/workspace/README.md",
  "encoding": "utf8"
}
```

### write_file
Write content to a file.

**Parameters:**
- `path` (string, required): Absolute or relative path to the file
- `content` (string, required): Content to write to the file
- `encoding` (string, optional): File encoding (default: utf8)
- `createDirectories` (boolean, optional): Create parent directories if they don't exist

**Example:**
```json
{
  "path": "/workspace/new-file.txt",
  "content": "Hello, World!",
  "createDirectories": true
}
```

### list_directory
List the contents of a directory.

**Parameters:**
- `path` (string, required): Absolute or relative path to the directory
- `recursive` (boolean, optional): List subdirectories recursively
- `includeHidden` (boolean, optional): Include hidden files and directories
- `filter` (string, optional): File extension filter

**Example:**
```json
{
  "path": "/workspace",
  "recursive": true,
  "filter": ".md"
}
```

### file_info
Get information about a file or directory.

**Parameters:**
- `path` (string, required): Absolute or relative path to the file or directory

**Example:**
```json
{
  "path": "/workspace/README.md"
}
```

## Commands

### Show File Server Status
- **Command**: `fileServer.status`
- **Description**: Display the current status of the file server
- **Usage**: Access through command palette or toolbar

### Refresh File Resources
- **Command**: `fileServer.refresh`
- **Description**: Refresh the file system resources and notify MCP clients
- **Usage**: Access through command palette or toolbar

## Installation

1. Copy this plugin to your Lokus plugins directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Activate the plugin in Lokus settings

## Configuration

The plugin uses the following default configuration:

- **Base Directory**: `/workspace`
- **Allowed Extensions**: `.md`, `.txt`, `.json`, `.js`, `.ts`, `.jsx`, `.tsx`, `.html`, `.css`, `.scss`, `.less`, `.xml`, `.yaml`, `.yml`, `.csv`, `.log`, `.ini`, `.conf`, `.env`
- **Security**: Path traversal protection, file type restrictions

## Security Considerations

- All file operations are restricted to the workspace directory
- Only specific file types are allowed for read/write operations
- Path traversal attempts are blocked
- File permissions are validated before operations

## Development

### Project Structure
```
src/
├── index.js       # Main plugin class
├── FileServer.js  # File server implementation
└── utils.js       # Utility functions (if needed)

tests/
├── unit/          # Unit tests
└── integration/   # Integration tests
```

### Testing
```bash
npm test
```

### Building
```bash
npm run build
```

## API Reference

### FileServer Class

The `FileServer` class handles all file system operations:

```javascript
import { FileServer } from './FileServer.js'

const server = new FileServer(api)
await server.initialize()

// Read a file
const result = await server.readFile('/workspace/README.md')

// Write a file
await server.writeFile('/workspace/output.txt', 'Hello!')

// List directory
const entries = await server.listDirectory('/workspace')
```

### Plugin Integration

The plugin integrates with Lokus through the MCP API:

```javascript
// Register resources
this.mcpAPI.registerResource(resource)

// Register tools
this.mcpAPI.registerTool(tool)

// Handle tool execution
const result = await tool.execute(arguments)
```

## Examples

### Reading Configuration Files
```javascript
// Tool call to read a config file
{
  "tool": "read_file",
  "arguments": {
    "path": "/workspace/config/app.json",
    "encoding": "utf8"
  }
}
```

### Batch File Processing
```javascript
// List all markdown files
{
  "tool": "list_directory",
  "arguments": {
    "path": "/workspace/docs",
    "recursive": true,
    "filter": ".md"
  }
}

// Process each file found
// (Multiple read_file calls)
```

### Creating Project Structure
```javascript
// Create a new project file
{
  "tool": "write_file",
  "arguments": {
    "path": "/workspace/projects/new-project/README.md",
    "content": "# New Project\n\nDescription of the project...",
    "createDirectories": true
  }
}
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check that the plugin has file system permissions
2. **Path Not Found**: Ensure the path exists and is within the workspace
3. **File Type Not Allowed**: Verify the file extension is in the allowed list
4. **MCP Connection**: Ensure the MCP server is properly initialized

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=lokus:file-server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.