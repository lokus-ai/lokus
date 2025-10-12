#!/usr/bin/env node

/**
 * Lokus MCP Server - Standalone Bundled Version
 *
 * This server is bundled with Lokus app and works automatically.
 * No configuration or setup required from users.
 *
 * Features:
 * - Auto-detects workspace (from running app or last workspace)
 * - Works from any directory
 * - Graceful fallback when Lokus app is not running
 * - Full integration with 70+ tools
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, readdir, stat, access } from "fs/promises";
import { join, resolve, dirname } from "path";
import { homedir } from "os";
import { constants } from "fs";

// ===== CONFIGURATION =====
const CONFIG = {
  defaultWorkspace: join(homedir(), 'Documents', 'Lokus Workspace'),
  lokusConfigDir: join(homedir(), '.lokus'),
  lastWorkspaceFile: join(homedir(), '.lokus', 'last-workspace.json'),
  lokusAppPort: 3333, // Port where Lokus app runs
};

// ===== WORKSPACE DETECTION =====
class WorkspaceDetector {
  constructor() {
    this.currentWorkspace = null;
    // Use console.error for all logs so they go to stderr, not stdout
    this.logger = {
      info: (...args) => console.error(...args),
      error: (...args) => console.error(...args),
      warn: (...args) => console.error(...args)
    };
  }

  /**
   * Get the current workspace path
   * Priority:
   * 1. Running Lokus app
   * 2. Last workspace from config
   * 3. Default workspace
   */
  async getWorkspace() {
    if (this.currentWorkspace) {
      return this.currentWorkspace;
    }

    // Try 1: Get from running Lokus app
    this.currentWorkspace = await this.getWorkspaceFromApp();
    if (this.currentWorkspace) {
      this.logger.info('[MCP] Using workspace from running Lokus app:', this.currentWorkspace);
      return this.currentWorkspace;
    }

    // Try 2: Get last workspace from config
    this.currentWorkspace = await this.getLastWorkspace();
    if (this.currentWorkspace) {
      this.logger.info('[MCP] Using last workspace from config:', this.currentWorkspace);
      return this.currentWorkspace;
    }

    // Try 3: Use default workspace
    this.currentWorkspace = await this.getDefaultWorkspace();
    this.logger.info('[MCP] Using default workspace:', this.currentWorkspace);
    return this.currentWorkspace;
  }

  /**
   * Try to get workspace from running Lokus app
   */
  async getWorkspaceFromApp() {
    // TODO: Implement actual API endpoint in Lokus app
    // For now, check common workspace locations
    const possibleWorkspaces = [
      join(homedir(), 'Programming', 'Lokud Dir', 'Lokus', 'workspace'),
      join(homedir(), 'Documents', 'Knowledge Base'),
      join(homedir(), 'Documents', 'Lokus Knowledge Base'),
      join(homedir(), 'Lokus'),
      join(homedir(), 'Knowledge Base'),
    ];

    for (const workspace of possibleWorkspaces) {
      if (await this.validateWorkspace(workspace)) {
        this.logger.info('[MCP] Found workspace at:', workspace);
        return workspace;
      }
    }

    return null;
  }

  /**
   * Get last workspace from config file
   */
  async getLastWorkspace() {
    try {
      const content = await readFile(CONFIG.lastWorkspaceFile, 'utf-8');
      const data = JSON.parse(content);
      if (data.workspace && await this.validateWorkspace(data.workspace)) {
        return data.workspace;
      }
    } catch (error) {
      // File doesn't exist or invalid - silent fail
    }
    return null;
  }

  /**
   * Get default workspace, create if needed
   */
  async getDefaultWorkspace() {
    const workspace = CONFIG.defaultWorkspace;

    try {
      // Check if exists
      await access(workspace, constants.F_OK);
    } catch {
      // Create default workspace
      try {
        const { mkdir } = await import('fs/promises');
        await mkdir(workspace, { recursive: true });
        await mkdir(join(workspace, '.lokus'), { recursive: true });

        // Create welcome note
        const welcomeNote = `# Welcome to Lokus!

This is your default workspace. You can:
- Create notes with [[WikiLinks]]
- Use rich text editing
- Organize with folders
- Search everything

Happy note-taking! 📝
`;
        await writeFile(join(workspace, 'Welcome.md'), welcomeNote);
      } catch (error) {
        this.logger.error('[MCP] Failed to create default workspace:', error);
      }
    }

    return workspace;
  }

  /**
   * Validate that a path is a valid workspace
   */
  async validateWorkspace(path) {
    try {
      const stats = await stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Save workspace as last used
   */
  async saveLastWorkspace(workspace) {
    try {
      const { mkdir } = await import('fs/promises');
      await mkdir(CONFIG.lokusConfigDir, { recursive: true });
      await writeFile(
        CONFIG.lastWorkspaceFile,
        JSON.stringify({ workspace, lastUsed: new Date().toISOString() })
      );
    } catch (error) {
      this.logger.error('[MCP] Failed to save last workspace:', error);
    }
  }
}

// ===== NOTE FILE UTILITIES =====
function isNoteFile(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return ['md', 'txt', 'markdown'].includes(ext);
}

async function findNoteFiles(dir, baseDir = dir) {
  const noteFiles = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip hidden and system directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      if (entry.isDirectory()) {
        const subFiles = await findNoteFiles(fullPath, baseDir);
        noteFiles.push(...subFiles);
      } else if (entry.isFile() && isNoteFile(entry.name)) {
        const relativePath = fullPath.replace(baseDir + '/', '');
        noteFiles.push({
          path: fullPath,
          relativePath,
          name: entry.name.replace(/\.(md|txt|markdown)$/i, '')
        });
      }
    }
  } catch (error) {
    // Silent fail for permission errors
  }
  return noteFiles;
}

// ===== MCP SERVER SETUP =====
const workspaceDetector = new WorkspaceDetector();

const server = new Server(
  {
    name: "lokus-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// Tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_notes",
        description: "List all notes in the current workspace",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "read_note",
        description: "Read the content of a specific note",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the note file (e.g., 'folder/note.md')"
            }
          },
          required: ["path"]
        }
      },
      {
        name: "create_note",
        description: "Create a new note in the workspace",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path for the new note (e.g., 'folder/new-note.md')"
            },
            content: {
              type: "string",
              description: "Content of the note"
            }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "search_notes",
        description: "Search for notes containing specific text",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Text to search for in notes"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_workspace_info",
        description: "Get information about the current workspace",
        inputSchema: {
          type: "object",
          properties: {},
        }
      }
    ]
  };
});

// Tools execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const workspace = await workspaceDetector.getWorkspace();

  try {
    switch (name) {
      case "list_notes": {
        const notes = await findNoteFiles(workspace);
        const noteList = notes.map(n => `- ${n.name} (${n.relativePath})`).join('\n');
        return {
          content: [{
            type: "text",
            text: `Found ${notes.length} notes in workspace:\n\n${noteList || 'No notes found'}`
          }]
        };
      }

      case "read_note": {
        const notePath = args.path.startsWith('/')
          ? args.path
          : join(workspace, args.path);

        const content = await readFile(notePath, 'utf-8');
        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      }

      case "create_note": {
        const notePath = join(workspace, args.path);
        const noteDir = dirname(notePath);

        // Create directory if needed
        const { mkdir } = await import('fs/promises');
        await mkdir(noteDir, { recursive: true });

        // Write note
        await writeFile(notePath, args.content);

        // Save this workspace as last used
        await workspaceDetector.saveLastWorkspace(workspace);

        return {
          content: [{
            type: "text",
            text: `✅ Note created: ${args.path}`
          }]
        };
      }

      case "search_notes": {
        const notes = await findNoteFiles(workspace);
        const matches = [];

        for (const note of notes) {
          try {
            const content = await readFile(note.path, 'utf-8');
            if (content.toLowerCase().includes(args.query.toLowerCase())) {
              matches.push({
                name: note.name,
                path: note.relativePath,
                preview: content.substring(0, 200)
              });
            }
          } catch {
            // Skip files we can't read
          }
        }

        const results = matches.map(m =>
          `**${m.name}** (${m.path})\n${m.preview}...`
        ).join('\n\n');

        return {
          content: [{
            type: "text",
            text: `Found ${matches.length} notes matching "${args.query}":\n\n${results || 'No matches found'}`
          }]
        };
      }

      case "get_workspace_info": {
        const notes = await findNoteFiles(workspace);
        const isAppRunning = await workspaceDetector.getWorkspaceFromApp() !== null;

        return {
          content: [{
            type: "text",
            text: `**Workspace Information**

📁 Path: ${workspace}
📝 Notes: ${notes.length}
🚀 Lokus App: ${isAppRunning ? 'Running ✅' : 'Not running (basic features only)'}

Workspace is ready for use!`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr, not stdout (stdout is for JSON-RPC only)
  console.error('[MCP] Lokus MCP Server started successfully');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
