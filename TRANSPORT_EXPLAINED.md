# Transport Methods Explained

## Current Setup

### Desktop App → **stdio Transport**
- Uses Node.js child process
- Desktop spawns `node index.js` directly
- Communication via stdin/stdout
- **Reason:** HTTP transport not supported in current Desktop version

### CLI Tool → **HTTP Transport**
- Uses HTTP URL connection
- Connects to `http://localhost:3456/mcp`
- Communication via HTTP requests
- **Reason:** HTTP transport is supported and more flexible

---

## Why Different Transports?

### Desktop (stdio)
The current Desktop app expects the traditional `command` + `args` format:
```json
{
  "mcpServers": {
    "lokus": {
      "command": "node",
      "args": ["/path/to/index.js"]
    }
  }
}
```

Each MCP server gets its own Node.js process spawned by Desktop.

### CLI (HTTP)
The CLI tool supports the newer HTTP transport:
```json
{
  "mcpServers": {
    "lokus": {
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

The CLI connects to a running HTTP server.

---

## How This Works for Users

### What Happens Behind the Scenes:

1. **Desktop App:**
   - User opens Desktop
   - Desktop reads config
   - Desktop spawns: `node /path/to/index.js`
   - MCP server starts using stdio transport
   - Desktop communicates via stdin/stdout

2. **CLI Tool:**
   - User opens VS Code
   - CLI reads config
   - CLI connects to `http://localhost:3456/mcp`
   - **Requires Lokus MCP HTTP server to be running**

### Important Note:
For CLI to work, users need to:
1. Start Lokus
2. Go to Preferences → MCP Integration
3. Click "Start" to start the HTTP server

Desktop works independently without the HTTP server.

---

## Future: When Desktop Supports HTTP

Once Desktop adds HTTP transport support, we can migrate both to HTTP:

```json
// Both Desktop and CLI (future)
{
  "mcpServers": {
    "lokus": {
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

**Benefits:**
- Single HTTP server serves both
- No duplicate Node.js processes
- Better resource usage
- Easier debugging

---

## Current User Experience

### Desktop Users:
✅ Works immediately after configuration
✅ No need to start Lokus server
✅ Desktop manages the MCP process automatically

### CLI Users:
✅ Works when Lokus MCP server is running
⚠️ Requires starting the server in Lokus
✅ Can work simultaneously with Desktop

### Both:
✅ One-click configuration
✅ No manual JSON editing
✅ Clear error messages
✅ User-friendly GUI

---

## Technical Implementation

### In `mcp_setup.rs`:

**Desktop Configuration:**
```rust
mcp_servers.insert("lokus".to_string(), json!({
    "command": "node",
    "args": [mcp_path.to_string_lossy()]
}));
```

**CLI Configuration:**
```rust
mcp_servers.insert("lokus".to_string(), json!({
    "url": "http://localhost:3456/mcp"
}));
```

### Entry Points:

**Desktop (stdio):** `/Users/pratham/.lokus/mcp-server/index.js`
- Uses `@modelcontextprotocol/sdk/server/stdio.js`
- Communicates via StdioServerTransport

**Lokus HTTP Server:** `/src/mcp-server/standalone.js`
- Uses Express.js HTTP server
- Serves MCP protocol over HTTP
- Used by CLI

---

## Debugging

### Desktop Issues:
```bash
# Check if index.js exists
ls -la ~/.lokus/mcp-server/index.js

# Test it manually
node ~/.lokus/mcp-server/index.js

# Check Desktop logs (look for MCP errors)
```

### CLI Issues:
```bash
# Check if HTTP server is running
curl http://localhost:3456/health

# Check Lokus MCP Integration status
# Should show "Running"

# Check CLI config
cat ~/Library/Application\ Support/Claude\ Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

---

## Summary

**Current Reality:**
- ✅ Desktop: stdio transport (required by Desktop app)
- ✅ CLI: HTTP transport (more modern, flexible)
- ✅ Both configured automatically
- ✅ Both work reliably

**User Impact:**
- Desktop works immediately
- CLI requires starting Lokus server first
- Both configured with one button click
- No technical knowledge required

**Future Path:**
When Desktop supports HTTP, we can migrate to pure HTTP for both, making it even simpler.
