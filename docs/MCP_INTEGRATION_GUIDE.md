# Lokus MCP Integration Guide

> **Connect AI assistants to your knowledge base**

**Version:** 1.3.1
**Last Updated:** October 2025
**Status:** Production Ready

---

## Table of Contents

1. [Introduction](#introduction)
2. [What is MCP?](#what-is-mcp)
3. [Getting Started](#getting-started)
4. [Tool Categories](#tool-categories)
5. [Configuration](#configuration)
6. [Usage Examples](#usage-examples)
7. [Development](#development)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

Lokus includes a built-in MCP (Model Context Protocol) server that provides **68+ sophisticated tools** for AI assistants to interact with your knowledge base. The server auto-starts with Lokus and requires zero configuration.

### Key Features

- ✅ **Auto-start** - Server launches automatically
- ✅ **Dual Transport** - Supports both stdio (Desktop) and HTTP (CLI)
- ✅ **68+ Tools** - Comprehensive workspace operations
- ✅ **Zero Config** - Works out of the box
- ✅ **Cross-platform** - macOS, Windows, Linux support
- ✅ **Secure** - Local-only connections by default

[📹 Placeholder: MCP overview and quick start]

---

## What is MCP?

### Model Context Protocol

MCP is an open standard created for AI assistants to interact with external tools and data sources. Think of it as a universal adapter that lets any AI assistant talk to Lokus.

### Why MCP?

**Without MCP:**
- 🚫 AI can't read your notes
- 🚫 Can't create or edit files
- 🚫 No workspace awareness
- 🚫 Limited to what you paste

**With MCP:**
- ✅ AI can search your entire knowledge base
- ✅ Create and update notes automatically
- ✅ Understand workspace structure
- ✅ Analyze patterns and suggest connections
- ✅ Automate repetitive tasks
- ✅ Backup, export, and organize content

### Architecture

```
┌─────────────────────────────────────┐
│     AI Assistant (Your AI CLI/Desktop)     │
│     (Uses Lokus MCP tools)          │
└──────────────┬──────────────────────┘
               │
               │ MCP Protocol
               │
┌──────────────▼──────────────────────┐
│      Lokus MCP Server               │
│      (Auto-starts with Lokus)       │
├─────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐     │
│  │  Stdio    │  │   HTTP    │     │
│  │ Transport │  │ Transport │     │
│  │ (Desktop) │  │  (CLI)    │     │
│  └────┬──────┘  └─────┬─────┘     │
│       │                │            │
│  ┌────▼────────────────▼─────┐    │
│  │   Tool Router (68 tools)   │    │
│  │  - Note Management         │    │
│  │  - Workspace Ops           │    │
│  │  - Search & Analysis       │    │
│  │  - AI Features             │    │
│  └──────────┬─────────────────┘    │
└─────────────┼──────────────────────┘
              │
     ┌────────▼─────────┐
     │ Your Workspace   │
     │ (Markdown Files) │
     └──────────────────┘
```

---

## Getting Started

### Automatic Setup

**On first launch, Lokus automatically:**

1. ✅ Extracts MCP server to `~/.lokus/mcp-server/`
2. ✅ Creates Desktop AI config (if applicable)
3. ✅ Creates CLI config (if applicable)
4. ✅ Starts HTTP server on port 3456
5. ✅ Registers 68+ tools

**You don't need to do anything!** The server just works.

[📹 Placeholder: First-time setup walkthrough]

### Verify Installation

#### Check Server Status

**In Lokus:**
- Look at status bar (bottom)
- Should show "MCP: Running" with green indicator
- If red, click for diagnostics

**Via Terminal:**
```bash
# Check if HTTP server is running
curl http://localhost:3456/health

# Should return:
# {"status":"ok","server":"lokus-mcp","version":"1.3.1"}
```

#### Check Configuration Files

**Desktop Config (stdio):**
```bash
cat ~/.lokus/mcp-server/claude_desktop_config.json
```

Should contain:
```json
{
  "mcpServers": {
    "lokus": {
      "command": "node",
      "args": [
        "/Users/yourname/.lokus/mcp-server/index.js"
      ]
    }
  }
}
```

**CLI Config (HTTP):**
```bash
cat ~/.lokus/mcp-server/cline_mcp_settings.json
```

Should contain:
```json
{
  "mcpServers": {
    "lokus": {
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

[📹 Placeholder: Verifying MCP setup]

### First Use with AI Assistant

1. **Open AI assistant**
2. **Ask it to list available tools:**
   ```
   "What tools do you have from Lokus?"
   ```
3. **Try a simple command:**
   ```
   "List all notes in my workspace"
   ```
4. **Success!** AI should show your notes

---

## Tool Categories

Lokus provides 68+ tools across 6 categories:

### 1. Note Management (11 tools)

Tools for creating, editing, and organizing notes.

| Tool | Description | Example Use |
|------|-------------|-------------|
| `create_note` | Create new note with template | "Create a project note for Web Redesign" |
| `update_note` | Edit existing note content | "Add task list to project-a.md" |
| `link_notes` | Create WikiLinks between notes | "Link all project notes to main index" |
| `resolve_wikilinks` | Find and fix broken links | "Fix all broken links in workspace" |
| `extract_note_outline` | Generate outline from headers | "Show me outline of design-doc.md" |
| `generate_note_summary` | AI-powered summary | "Summarize my meeting notes" |
| `organize_note_sections` | Reorder content intelligently | "Organize project-plan.md by priority" |
| `convert_tasks_to_kanban` | Extract tasks to board | "Convert TODO.md tasks to kanban" |
| `duplicate_note` | Smart copy with link updates | "Duplicate template-project.md" |
| `get_note_templates` | List available templates | "What templates are available?" |
| `get_note_history` | Track changes | "Show history of README.md" |

[📹 Placeholder: Note management tools demo]

### 2. Workspace Management (12 tools)

Tools for workspace operations and maintenance.

| Tool | Description | Example Use |
|------|-------------|-------------|
| `initialize_workspace` | Set up new workspace | "Create new workspace in ~/documents/knowledge" |
| `get_workspace_info` | Analyze workspace structure | "Tell me about my workspace" |
| `backup_workspace` | Create versioned backup | "Backup my workspace" |
| `restore_workspace` | Restore from backup | "Restore from yesterday's backup" |
| `export_workspace` | Export to various formats | "Export workspace to JSON" |
| `import_content` | Import from external sources | "Import my Obsidian vault" |
| `clean_workspace` | Remove orphaned files | "Clean up unused attachments" |
| `analyze_workspace_health` | Health diagnostics | "Check workspace for issues" |
| `sync_workspace` | External sync operations | "Sync workspace with cloud" |
| `update_workspace_config` | Modify settings | "Change workspace theme to dark" |
| `get_workspace_backups` | List available backups | "Show all backups" |
| `get_workspace_history` | Activity timeline | "Show recent workspace activity" |

[📹 Placeholder: Workspace tools demo]

### 3. Advanced Search (16 tools)

Powerful search and discovery tools.

| Tool | Description | Example Use |
|------|-------------|-------------|
| `search_content` | Full-text search with regex | "Find all notes mentioning 'AI'" |
| `search_wiki_links` | Find link relationships | "Find all notes linking to index" |
| `find_broken_links` | Detect broken references | "Find all broken WikiLinks" |
| `get_graph_data` | Generate knowledge graph | "Show my knowledge graph" |
| `search_by_tags` | Tag-based discovery | "Find all #project notes" |
| `search_recent` | Recently modified files | "Show notes from last week" |
| `search_favorites` | Bookmarked content | "List my starred notes" |
| `get_file_links` | Relationship mapping | "Show all connections for note-x" |
| `get_backlinks` | Reverse link analysis | "What links to this note?" |
| `navigate_to` | Smart navigation | "Open note about React" |
| `search_files` | Advanced file discovery | "Find PDFs in /resources/" |
| `find_similar` | Content similarity | "Find notes similar to this" |
| `analyze_workspace` | Pattern analysis | "Analyze my note-taking patterns" |
| `get_search_suggestions` | AI recommendations | "What should I search for?" |
| `get_search_history` | Search analytics | "Show my search history" |
| More | Additional specialized tools | Various use cases |

[📹 Placeholder: Search tools demo]

### 4. AI Analysis (10 tools)

Intelligent content analysis powered by AI.

| Tool | Description | Example Use |
|------|-------------|-------------|
| `analyze_content` | Deep content analysis | "Analyze this research paper" |
| `generate_insights` | Pattern detection | "What insights from my notes?" |
| `suggest_connections` | Intelligent linking | "Suggest connections for this note" |
| `analyze_writing_patterns` | Style analysis | "Analyze my writing style" |
| `detect_knowledge_gaps` | Gap identification | "What topics am I missing?" |
| `optimize_structure` | Organization tips | "Suggest better organization" |
| `analyze_collaboration_patterns` | Team insights | "Analyze team contribution" |
| `predict_content_needs` | Predictive planning | "What content should I create next?" |
| `analyze_content_quality` | Quality assessment | "Rate quality of my documentation" |
| `get_ai_history` | AI operation tracking | "Show AI analysis history" |

[📹 Placeholder: AI analysis tools demo]

### 5. File Operations (6 tools)

Standard file system operations.

| Tool | Description | Example Use |
|------|-------------|-------------|
| `read_file` | Read file contents | "Read config.json" |
| `write_file` | Create/update files | "Write new file test.md" |
| `list_files` | Directory browsing | "List all markdown files" |
| `get_file_metadata` | File information | "Get metadata for note.md" |
| `move_file` | Move/rename files | "Move note to /archive/" |
| `delete_file` | Remove files | "Delete old-draft.md" |

### 6. Editor Enhancements (10 tools)

Tools for content creation and formatting.

| Tool | Description | Example Use |
|------|-------------|-------------|
| `format_text` | Apply formatting | "Make this text bold" |
| `insert_link` | Add links | "Insert link to project" |
| `insert_math` | Insert equations | "Add equation for E=mc^2" |
| `insert_table` | Create tables | "Create 3x5 table" |
| `create_task_list` | Generate task lists | "Create task list for project" |
| `insert_heading` | Add headers | "Add H2 heading" |
| `insert_list` | Create lists | "Create bullet list" |
| `get_file_content` | Read with statistics | "Get content stats for note" |
| `replace_content` | Search & replace | "Replace 'old' with 'new'" |
| `insert_code_block` | Add code blocks | "Insert JavaScript code block" |

[📹 Placeholder: Editor tools demo]

---

## Configuration

### Server Settings

Located at: `~/.lokus/mcp-server/config.json`

```json
{
  "server": {
    "http": {
      "enabled": true,
      "port": 3456,
      "host": "localhost"
    },
    "stdio": {
      "enabled": true
    }
  },
  "logging": {
    "level": "info",
    "file": "~/.lokus/mcp-server/logs/server.log"
  },
  "workspace": {
    "autoDetect": true,
    "defaultPath": "~"
  }
}
```

### Desktop AI Configuration

**Location:** `~/.lokus/mcp-server/claude_desktop_config.json`

**Default Configuration:**
```json
{
  "mcpServers": {
    "lokus": {
      "command": "node",
      "args": [
        "~/.lokus/mcp-server/index.js"
      ],
      "env": {
        "LOKUS_WORKSPACE": "/path/to/your/workspace"
      }
    }
  }
}
```

**Custom Options:**
```json
{
  "mcpServers": {
    "lokus": {
      "command": "node",
      "args": ["~/.lokus/mcp-server/index.js"],
      "env": {
        "LOKUS_WORKSPACE": "/custom/workspace",
        "LOKUS_LOG_LEVEL": "debug",
        "LOKUS_CACHE_SIZE": "1000"
      }
    }
  }
}
```

[📹 Placeholder: Configuration walkthrough]

### CLI Configuration

**Location:** `~/.lokus/mcp-server/cline_mcp_settings.json`

**Default Configuration:**
```json
{
  "mcpServers": {
    "lokus": {
      "url": "http://localhost:3456/mcp",
      "transport": "http"
    }
  }
}
```

**Custom Port:**
```json
{
  "mcpServers": {
    "lokus": {
      "url": "http://localhost:9999/mcp",
      "transport": "http",
      "headers": {
        "X-Workspace": "/path/to/workspace"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOKUS_WORKSPACE` | Workspace path | Auto-detected |
| `LOKUS_MCP_PORT` | HTTP server port | 3456 |
| `LOKUS_LOG_LEVEL` | Logging level | info |
| `LOKUS_CACHE_SIZE` | Cache size (MB) | 500 |
| `LOKUS_AUTO_START` | Auto-start server | true |

**Set environment variables:**
```bash
# In your shell config (~/.bashrc, ~/.zshrc)
export LOKUS_WORKSPACE="/path/to/workspace"
export LOKUS_MCP_PORT=3456
export LOKUS_LOG_LEVEL="debug"
```

---

## Usage Examples

### Example 1: Research Assistant

**User:** "Analyze my research notes and suggest connections"

**AI Response:**
```
I'll analyze your research notes using Lokus tools:

1. Using search_content to find all research notes...
   Found 24 research notes

2. Using analyze_content to understand topics...
   Main themes: Machine Learning, Natural Language Processing, Ethics

3. Using suggest_connections to find relationships...
   Suggested 12 new connections:
   - [[ml-fundamentals]] ↔ [[neural-networks]]
   - [[ethics-in-ai]] ↔ [[bias-detection]]
   - [[nlp-basics]] ↔ [[transformers]]
   ...

4. Using create_note to create index...
   Created: /research/research-index.md

Would you like me to create these links?
```

[📹 Placeholder: Research assistant workflow]

### Example 2: Content Organizer

**User:** "Reorganize my project notes by priority"

**AI Response:**
```
I'll organize your project notes:

1. Using search_by_tags to find project notes...
   Found 18 project notes

2. Using get_file_metadata to check properties...
   Properties: priority, status, due_date

3. Using organize_note_sections to reorder...
   Organizing by: High → Medium → Low priority

   High Priority (5 notes):
   - [[project-website-redesign]]
   - [[api-integration]]
   ...

4. Using update_note to update index...
   Updated: /projects/README.md

Organization complete! All projects now sorted by priority.
```

[📹 Placeholder: Content organization workflow]

### Example 3: Knowledge Curator

**User:** "Find gaps in my knowledge base about machine learning"

**AI Response:**
```
Analyzing your machine learning knowledge:

1. Using search_content to find ML notes...
   Found 42 notes on machine learning

2. Using analyze_workspace to understand coverage...

   Strong coverage:
   ✓ Neural Networks (12 notes)
   ✓ Deep Learning (15 notes)
   ✓ Computer Vision (8 notes)

   Weak coverage:
   ⚠ Reinforcement Learning (2 notes)
   ⚠ Transfer Learning (1 note)
   ⚠ Model Optimization (0 notes)

3. Using detect_knowledge_gaps...

   Suggested topics to research:
   - Reinforcement Learning basics
   - Q-Learning and Policy Gradients
   - Transfer Learning techniques
   - Model pruning and quantization
   - Hyperparameter optimization

4. Using create_note to create learning path...
   Created: /learning/ml-gaps-to-fill.md

Would you like me to create template notes for these topics?
```

[📹 Placeholder: Knowledge curation workflow]

### Example 4: Backup & Maintenance

**User:** "Backup my workspace and clean up unused files"

**AI Response:**
```
Running workspace maintenance:

1. Using backup_workspace...
   Created backup: lokus-backup-2025-10-15-14-30.zip
   Location: ~/.lokus/backups/
   Size: 45.2 MB

2. Using analyze_workspace_health...

   Health Report:
   ✓ 342 markdown files
   ✓ 89 images
   ⚠ 12 broken links found
   ⚠ 5 orphaned attachments

3. Using resolve_wikilinks...
   Fixed 12 broken links

4. Using clean_workspace...
   Removed 5 orphaned files (2.3 MB freed)

Workspace maintenance complete!
- Backup created: ✓
- Broken links fixed: 12
- Space freed: 2.3 MB
```

[📹 Placeholder: Backup and maintenance workflow]

### Example 5: Export & Convert

**User:** "Export all my #project notes to a PDF document"

**AI Response:**
```
Exporting project notes:

1. Using search_by_tags to find #project notes...
   Found 18 project notes

2. Using export_workspace with filter...

   Export Options:
   - Format: PDF
   - Filter: tag:#project
   - Include: Table of contents
   - Include: Linked images

3. Generating PDF...
   Processing 18 notes...
   Resolving WikiLinks...
   Embedding images...

4. Export complete!
   File: /exports/projects-2025-10-15.pdf
   Size: 12.4 MB
   Pages: 47

PDF exported successfully! Would you like me to open it?
```

[📹 Placeholder: Export workflow]

---

## Development

### Building Custom Tools

You can extend Lokus MCP with custom tools.

#### Tool Structure

```javascript
// ~/.lokus/mcp-server/tools/custom/myTool.js

export default class MyCustomTool {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
  }

  getTools() {
    return [
      {
        name: "my_custom_tool",
        description: "Does something custom",
        inputSchema: {
          type: "object",
          properties: {
            param1: {
              type: "string",
              description: "First parameter"
            },
            param2: {
              type: "number",
              description: "Second parameter"
            }
          },
          required: ["param1"]
        }
      }
    ];
  }

  async executeTool(toolName, args) {
    if (toolName === "my_custom_tool") {
      return await this.myCustomTool(args);
    }
  }

  async myCustomTool({ param1, param2 = 0 }) {
    // Your custom logic here
    const result = `Processed ${param1} with ${param2}`;

    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  }
}
```

#### Registering Custom Tools

```javascript
// ~/.lokus/mcp-server/index.js

import MyCustomTool from './tools/custom/myTool.js';

// Add to tool registry
const customTool = new MyCustomTool(workspacePath);
server.registerTools(customTool.getTools());
```

[📹 Placeholder: Building custom tools]

### Tool Development Best Practices

1. **Clear Descriptions** - AI needs to understand what tool does
2. **Input Validation** - Validate all parameters
3. **Error Handling** - Graceful failures with helpful messages
4. **Async Operations** - Use async/await for file operations
5. **Return Structured Data** - Consistent response format
6. **Add Tests** - Test with real AI interactions
7. **Document Examples** - Provide usage examples

### Testing Tools

```bash
# Test tool via HTTP
curl -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "my_custom_tool",
      "arguments": {
        "param1": "test value",
        "param2": 42
      }
    },
    "id": 1
  }'
```

[📹 Placeholder: Testing MCP tools]

---

## Troubleshooting

### Server Won't Start

**Symptoms:**
- Status bar shows "MCP: Stopped"
- AI can't connect to tools
- Error in console

**Solutions:**

1. **Check port availability**
   ```bash
   lsof -i :3456
   # If in use, kill process or change port
   ```

2. **Verify Node.js installed**
   ```bash
   node --version
   # Should show v18.0.0 or higher
   ```

3. **Check server logs**
   ```bash
   tail -f ~/.lokus/mcp-server/logs/server.log
   ```

4. **Restart Lokus**
   - Quit completely (Cmd/Ctrl+Q)
   - Relaunch

5. **Rebuild server**
   - Delete `~/.lokus/mcp-server/`
   - Restart Lokus (rebuilds automatically)

[📹 Placeholder: Troubleshooting server issues]

### Tools Not Working

**Symptoms:**
- AI doesn't see Lokus tools
- Tools return errors
- Partial results

**Solutions:**

1. **Verify AI configuration**
   ```bash
   # Check config exists
   cat ~/.lokus/mcp-server/claude_desktop_config.json
   ```

2. **Test tool individually**
   ```bash
   curl http://localhost:3456/mcp/tools
   # Should list all 68 tools
   ```

3. **Check workspace path**
   - Verify workspace exists
   - Check read/write permissions
   - No special characters in path

4. **Review tool logs**
   ```bash
   grep ERROR ~/.lokus/mcp-server/logs/server.log
   ```

5. **Clear tool cache**
   ```bash
   rm -rf ~/.lokus/mcp-server/cache/
   ```

### Performance Issues

**Symptoms:**
- Slow tool responses
- Timeouts
- High CPU/memory usage

**Solutions:**

1. **Reduce cache size**
   ```bash
   export LOKUS_CACHE_SIZE=250  # Default: 500 MB
   ```

2. **Lower log level**
   ```bash
   export LOKUS_LOG_LEVEL=error  # Default: info
   ```

3. **Limit workspace scope**
   - Use smaller workspace folders
   - Exclude large media folders
   - Archive old content

4. **Enable Quantum indexing**
   - Preferences → Performance → Enable Quantum

5. **Update Lokus**
   - Latest version has performance improvements

[📹 Placeholder: Performance optimization]

### Connection Refused

**Symptoms:**
- "Connection refused" errors
- Can't reach localhost:3456
- Timeout errors

**Solutions:**

1. **Verify server running**
   ```bash
   curl http://localhost:3456/health
   ```

2. **Check firewall**
   - Allow localhost connections
   - Verify port 3456 not blocked

3. **Try alternative port**
   ```bash
   export LOKUS_MCP_PORT=9999
   # Restart Lokus
   ```

4. **Check for port conflicts**
   ```bash
   lsof -i :3456
   # Kill conflicting process
   ```

---

## Advanced Topics

### Security Considerations

1. **Local-only by default** - Server only listens on localhost
2. **No authentication required** - Trusts local processes
3. **File system permissions** - Respects OS permissions
4. **No external connections** - Doesn't call external APIs
5. **Audit logging** - All tool calls logged

### Production Deployment

For exposing MCP server beyond localhost:

⚠️ **Not recommended** - Security risks

If required:
1. Add authentication middleware
2. Use HTTPS/TLS
3. Implement rate limiting
4. Add IP whitelisting
5. Monitor and log access

### Performance Tuning

**For large workspaces (10,000+ files):**

```json
{
  "performance": {
    "indexing": {
      "quantum": true,
      "batchSize": 100,
      "workers": 4
    },
    "caching": {
      "enabled": true,
      "maxSize": 1000,
      "ttl": 3600
    },
    "search": {
      "fuzzy": true,
      "maxResults": 100
    }
  }
}
```

[📹 Placeholder: Advanced configuration]

---

## Additional Resources

- **MCP Specification**: https://modelcontextprotocol.io/
- **Tool Reference**: `/docs/mcp-server/API.md`
- **Development Guide**: `/docs/mcp-server/development-guide.md`
- **Community Examples**: https://github.com/lokus-ai/lokus/discussions

---

**Last Updated:** October 2025
**Version:** 1.3.1
**Support:** https://github.com/lokus-ai/lokus/issues

[📹 Note: Replace all video placeholders with actual tutorials]
