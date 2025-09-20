# Lokus MCP Server API Documentation

## Overview

The Lokus Model Context Protocol (MCP) server provides a standardized interface for AI assistants to interact with Lokus's knowledge management system. This includes access to workspace content, plugin capabilities, and intelligent tools for content manipulation and discovery.

## Quick Start

### 1. Server Setup

```bash
# Start Lokus with MCP server enabled
npm run tauri dev

# The MCP server will be available at:
# WebSocket: ws://localhost:3001/mcp
# HTTP: http://localhost:3001/api/mcp
```

### 2. Basic Connection

```javascript
// WebSocket connection (recommended for interactive use)
const ws = new WebSocket('ws://localhost:3001/mcp');

// HTTP connection (for stateless operations)
const response = await fetch('http://localhost:3001/api/mcp/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    protocolVersion: '2024-11-05',
    capabilities: {
      resources: { subscribe: true },
      tools: { listChanged: true }
    },
    clientInfo: {
      name: 'My AI Assistant',
      version: '1.0.0'
    }
  })
});
```

### 3. Authentication

```bash
# Get API key from Lokus preferences
# Set in request headers:
X-API-Key: your-api-key-here

# Or use JWT token:
Authorization: Bearer your-jwt-token
```

## Core Concepts

### Resources

Resources represent accessible content within Lokus:

- **Files**: Markdown documents, images, attachments
- **Workspace Data**: Project information, tags, metadata  
- **Plugin Data**: Custom data sources from plugins
- **API Endpoints**: External integrations

Each resource has:
- **URI**: Unique identifier (e.g., `file:///workspace/notes/meeting.md`)
- **Type**: Classification (file, directory, database, etc.)
- **Content**: Actual data (text, binary, structured)
- **Metadata**: Additional properties and tags

### Tools

Tools are executable functions that can:

- Search and filter content
- Create, modify, or delete resources
- Execute plugin-provided operations
- Perform system tasks

### Prompts

Prompt templates provide pre-configured AI interactions:

- Content summarization
- Question answering
- Writing assistance
- Code generation

## API Reference

### Initialize Session

Start a new MCP session with capability negotiation.

**Endpoint:** `POST /initialize`

**Request:**
```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "resources": {
      "subscribe": true
    },
    "tools": {
      "listChanged": true
    }
  },
  "clientInfo": {
    "name": "AI Assistant",
    "version": "1.0.0"
  }
}
```

**Response:**
```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "resources": {
      "subscribe": true,
      "listChanged": true
    },
    "tools": {
      "listChanged": true
    },
    "prompts": {
      "listChanged": true
    },
    "logging": {
      "enabled": true
    }
  },
  "serverInfo": {
    "name": "Lokus MCP Server",
    "version": "1.0.0"
  }
}
```

### List Resources

Get available resources with optional filtering and pagination.

**Endpoint:** `GET /resources/list`

**Parameters:**
- `cursor` (optional): Pagination cursor
- `type` (optional): Filter by resource type
- `search` (optional): Search query

**Response:**
```json
{
  "resources": [
    {
      "uri": "file:///workspace/notes/project-plan.md",
      "name": "Project Plan",
      "description": "Main project planning document",
      "type": "file",
      "mimeType": "text/markdown",
      "lastModified": "2024-01-15T10:30:00Z",
      "metadata": {
        "tags": ["project", "planning"],
        "size": 2048
      }
    }
  ],
  "nextCursor": "page2"
}
```

### Read Resource Content

Read the content of one or more resources.

**Endpoint:** `POST /resources/read`

**Request:**
```json
{
  "uri": "file:///workspace/notes/project-plan.md"
}
```

**Response:**
```json
{
  "contents": [
    {
      "uri": "file:///workspace/notes/project-plan.md",
      "mimeType": "text/markdown",
      "text": "# Project Plan\n\n## Overview\n...",
      "metadata": {
        "wordCount": 512,
        "readingTime": "3 minutes"
      }
    }
  ]
}
```

### Subscribe to Resource Changes

Subscribe to real-time updates for a resource (WebSocket only).

**Endpoint:** `POST /resources/subscribe`

**Request:**
```json
{
  "uri": "file:///workspace/notes/project-plan.md"
}
```

**Response:**
```json
{
  "subscribed": true
}
```

**Update Event:**
```json
{
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file:///workspace/notes/project-plan.md",
    "content": "# Updated Project Plan\n...",
    "metadata": {
      "lastModified": "2024-01-15T11:00:00Z"
    }
  }
}
```

### List Tools

Get available tools with their schemas.

**Endpoint:** `GET /tools/list`

**Response:**
```json
{
  "tools": [
    {
      "name": "search_files",
      "description": "Search for files in the workspace",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          },
          "path": {
            "type": "string",
            "description": "Path to search in",
            "default": "/workspace"
          },
          "fileTypes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "File extensions to include"
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

### Execute Tool

Call a tool with arguments.

**Endpoint:** `POST /tools/call`

**Request:**
```json
{
  "name": "search_files",
  "arguments": {
    "query": "meeting notes",
    "path": "/workspace/notes",
    "fileTypes": ["md", "txt"]
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 files matching 'meeting notes':\n- /workspace/notes/weekly-meeting.md\n- /workspace/notes/project-meeting.txt\n- /workspace/notes/standup-notes.md"
    }
  ],
  "isError": false
}
```

### List Prompts

Get available prompt templates.

**Endpoint:** `GET /prompts/list`

**Response:**
```json
{
  "prompts": [
    {
      "name": "summarize_content",
      "description": "Summarize the given content",
      "arguments": [
        {
          "name": "content",
          "description": "Content to summarize",
          "required": true
        },
        {
          "name": "maxLength",
          "description": "Maximum summary length",
          "required": false
        }
      ]
    }
  ]
}
```

### Get Rendered Prompt

Get a prompt template rendered with arguments.

**Endpoint:** `POST /prompts/get`

**Request:**
```json
{
  "name": "summarize_content",
  "arguments": {
    "content": "Long article content here...",
    "maxLength": 200
  }
}
```

**Response:**
```json
{
  "description": "Summarize the given content",
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Please summarize the following content in no more than 200 words:\n\nLong article content here..."
      }
    }
  ]
}
```

## Available Tools

### File Operations

#### `search_files`
Search for files in the workspace.

**Arguments:**
- `query` (string, required): Search query
- `path` (string): Directory to search in
- `fileTypes` (array): File extensions to include
- `includeContent` (boolean): Include file content in results

#### `create_file`
Create a new file.

**Arguments:**
- `path` (string, required): File path
- `content` (string, required): File content
- `overwrite` (boolean): Overwrite if exists

#### `read_file`
Read file content.

**Arguments:**
- `path` (string, required): File path
- `encoding` (string): Text encoding (default: utf-8)

#### `update_file`
Update existing file.

**Arguments:**
- `path` (string, required): File path
- `content` (string, required): New content
- `backup` (boolean): Create backup before updating

### Content Operations

#### `extract_links`
Extract links from content.

**Arguments:**
- `content` (string, required): Content to analyze
- `types` (array): Link types to extract (wiki, http, file)

#### `analyze_content`
Analyze content structure and metadata.

**Arguments:**
- `content` (string, required): Content to analyze
- `includeStats` (boolean): Include word count, reading time
- `extractKeywords` (boolean): Extract keywords and topics

### Search Operations

#### `semantic_search`
Perform semantic search across workspace.

**Arguments:**
- `query` (string, required): Search query
- `limit` (number): Maximum results
- `threshold` (number): Similarity threshold
- `scope` (array): Content types to search

#### `full_text_search`
Full-text search with advanced options.

**Arguments:**
- `query` (string, required): Search query
- `filters` (object): Search filters
- `sort` (string): Sort order
- `highlight` (boolean): Highlight matches

### Plugin Operations

#### `list_plugins`
List available plugins.

#### `execute_plugin_tool`
Execute a plugin-provided tool.

**Arguments:**
- `pluginId` (string, required): Plugin identifier
- `toolName` (string, required): Tool name
- `arguments` (object): Tool arguments

## Available Resources

### File System Resources

- `file://` - Individual files
- `directory://` - Directory contents
- `workspace://` - Workspace root

### Content Resources

- `content://notes/` - Note documents
- `content://attachments/` - File attachments
- `content://templates/` - Document templates

### Plugin Resources

- `plugin://[id]/` - Plugin-provided resources
- `api://[name]/` - External API endpoints

### Memory Resources

- `memory://recent/` - Recently accessed content
- `memory://bookmarks/` - Bookmarked items
- `memory://search/` - Saved searches

## WebSocket Events

### Resource Updates
```json
{
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file:///workspace/notes/example.md",
    "content": "Updated content...",
    "metadata": {}
  }
}
```

### List Changes
```json
{
  "method": "notifications/resources/list_changed",
  "params": {
    "type": "resources"
  }
}
```

### Tool Updates
```json
{
  "method": "notifications/tools/list_changed",
  "params": {
    "type": "tools"
  }
}
```

### Log Messages
```json
{
  "method": "notifications/logging/message",
  "params": {
    "level": "info",
    "message": "File updated",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {
      "file": "/workspace/notes/example.md"
    }
  }
}
```

## Error Handling

### Error Response Format
```json
{
  "code": -32601,
  "message": "Method not found",
  "data": {
    "method": "invalid_method",
    "availableMethods": ["initialize", "resources/list", ...]
  }
}
```

### Common Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32600 | Invalid Request | Malformed JSON-RPC request |
| -32601 | Method Not Found | Unknown method name |
| -32602 | Invalid Params | Invalid method parameters |
| -32603 | Internal Error | Server internal error |
| -32001 | Resource Not Found | Requested resource does not exist |
| -32002 | Resource Access Denied | Insufficient permissions |
| -32003 | Resource Unavailable | Resource temporarily unavailable |
| -32011 | Tool Not Found | Requested tool does not exist |
| -32012 | Tool Execution Error | Tool execution failed |
| -32013 | Tool Invalid Input | Invalid tool arguments |
| -32021 | Prompt Not Found | Requested prompt does not exist |
| -32022 | Prompt Invalid Arguments | Invalid prompt arguments |

## Rate Limiting

The MCP server implements rate limiting to ensure fair usage:

- **Requests per minute**: 1000
- **Concurrent connections**: 50
- **Resource subscriptions per client**: 100
- **Tool executions per minute**: 500

Rate limit headers are included in HTTP responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Security

### Authentication
- API keys for programmatic access
- JWT tokens for user sessions
- OAuth2 for third-party integrations

### Authorization
- Resource-level permissions
- Tool execution policies
- Plugin security sandboxing

### Best Practices
- Use HTTPS in production
- Rotate API keys regularly
- Implement request validation
- Monitor for unusual activity
- Keep client libraries updated

## Performance Optimization

### Caching
- Resource content caching
- Tool result caching
- Prompt template caching

### Pagination
- Use cursor-based pagination for large datasets
- Implement client-side caching
- Request only needed fields

### WebSocket Usage
- Prefer WebSocket for interactive applications
- Use HTTP for stateless operations
- Implement connection pooling

### Resource Management
- Close unused subscriptions
- Limit concurrent tool executions
- Implement request timeouts

## Troubleshooting

### Connection Issues
```bash
# Check server status
curl http://localhost:3001/api/mcp/health

# Test WebSocket connection
wscat -c ws://localhost:3001/mcp
```

### Authentication Problems
```bash
# Verify API key
curl -H "X-API-Key: your-key" http://localhost:3001/api/mcp/resources/list

# Check token validity
curl -H "Authorization: Bearer your-token" http://localhost:3001/api/mcp/tools/list
```

### Debug Mode
```bash
# Enable debug logging
curl -X POST http://localhost:3001/api/mcp/logging/setLevel \
  -H "Content-Type: application/json" \
  -d '{"level": "debug"}'
```

## SDK and Libraries

### Official SDKs
- **JavaScript/TypeScript**: `@lokus/mcp-client`
- **Python**: `lokus-mcp-client`
- **Rust**: `lokus-mcp`

### Community Libraries
- **Go**: `github.com/user/lokus-mcp-go`
- **Java**: `com.example:lokus-mcp-java`
- **C#**: `Lokus.MCP.Client`

### Installation
```bash
# JavaScript
npm install @lokus/mcp-client

# Python
pip install lokus-mcp-client

# Rust
cargo add lokus-mcp
```

## Examples

See the [examples directory](./examples/) for complete code samples:

- [Python Client](./examples/python-client.py)
- [Node.js Client](./examples/nodejs-client.js)
- [Claude Desktop Integration](./examples/claude-desktop-config.json)
- [WebSocket Chat Bot](./examples/websocket-bot.js)
- [File Sync Tool](./examples/file-sync.py)

## Change Log

### Version 1.0.0 (Current)
- Initial MCP protocol implementation
- Resource discovery and access
- Tool execution framework
- Prompt template system
- WebSocket real-time updates

### Planned Features
- GraphQL-style resource queries
- Batch operation support
- Enhanced security model
- Plugin marketplace integration
- Advanced caching mechanisms

## Support

- **Documentation**: [docs.lokus.ai/mcp](https://docs.lokus.ai/mcp)
- **GitHub Issues**: [github.com/lokus-ai/lokus/issues](https://github.com/lokus-ai/lokus/issues)
- **Discord**: [discord.gg/lokus](https://discord.gg/lokus)
- **Email**: support@lokus.ai

## License

This API is released under the MIT License. See [LICENSE](../../LICENSE) for details.