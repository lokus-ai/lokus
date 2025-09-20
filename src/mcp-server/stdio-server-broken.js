#!/usr/bin/env node

/**
 * Lokus MCP Server - Stdio Transport
 * 
 * Official MCP server for Lokus using stdio transport for Claude Code integration.
 * Provides tools for note management, workspace operations, and content search.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the project root directory (up two levels from src/mcp-server/)
const PROJECT_ROOT = join(__dirname, "..", "..");

/**
 * Log to stderr to avoid interfering with stdio protocol
 */
function log(...args) {
  console.error(new Date().toISOString(), "[Lokus MCP]", ...args);
}

/**
 * Get the workspace directory - typically the project root for notes
 */
function getWorkspaceDir() {
  return PROJECT_ROOT;
}

/**
 * Check if a file is a markdown/note file
 */
function isNoteFile(filename) {
  const ext = extname(filename).toLowerCase();
  return ['.md', '.txt', '.markdown'].includes(ext);
}

/**
 * Recursively find all note files in a directory
 */
async function findNoteFiles(dir, baseDir = dir) {
  const noteFiles = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip hidden files and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      
      if (entry.isDirectory()) {
        const subFiles = await findNoteFiles(fullPath, baseDir);
        noteFiles.push(...subFiles);
      } else if (entry.isFile() && isNoteFile(entry.name)) {
        // Get relative path from base directory
        const relativePath = fullPath.replace(baseDir + '/', '');
        noteFiles.push({
          path: fullPath,
          relativePath,
          name: basename(entry.name, extname(entry.name))
        });
      }
    }
  } catch (error) {
    log("Error scanning directory:", dir, error.message);
  }
  
  return noteFiles;
}

/**
 * Search for content in note files
 */
async function searchInFile(filePath, searchTerm) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(searchTerm.toLowerCase())) {
        matches.push({
          line: i + 1,
          content: lines[i].trim(),
          context: lines.slice(Math.max(0, i - 1), i + 2).join('\n')
        });
      }
    }
    
    return matches;
  } catch (error) {
    log("Error searching file:", filePath, error.message);
    return [];
  }
}

// Create the MCP server
const server = new Server(
  {
    name: "lokus-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool schemas
const ReadNoteSchema = z.object({
  path: z.string().describe("Path to the note file (can be relative or absolute)"),
});

const SearchNotesSchema = z.object({
  query: z.string().describe("Search term to look for in note content and filenames"),
  includeContent: z.boolean().optional().default(true).describe("Whether to include matching content snippets"),
});

const CreateNoteSchema = z.object({
  path: z.string().describe("Path where to create the note (with .md extension)"),
  content: z.string().describe("Initial content for the note"),
  title: z.string().optional().describe("Optional title for the note (will be added as H1 if provided)"),
});

const UpdateNoteSchema = z.object({
  path: z.string().describe("Path to the note file to update"),
  content: z.string().describe("New content for the note"),
});

// Register tools using the proper SDK method
server.registerTool("readNote", {
  title: "Read Note",
  description: "Read the content of a specific note file",
  inputSchema: ReadNoteSchema,
}, async ({ path }) => {
  // Resolve path relative to workspace
  const fullPath = path.startsWith('/') ? path : join(getWorkspaceDir(), path);
  
  try {
    const content = await readFile(fullPath, 'utf-8');
    const stats = await stat(fullPath);
    
    return {
      content: [
        {
          type: "text",
          text: `# ${basename(path)}\n\n**Path:** ${path}\n**Size:** ${stats.size} bytes\n**Modified:** ${stats.mtime.toISOString()}\n\n---\n\n${content}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text", 
          text: `Error reading note: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

server.registerTool("searchNotes", {
  title: "Search Notes",
  description: "Search for notes by content or filename",
  inputSchema: SearchNotesSchema,
}, async ({ query, includeContent = true }) => {
  const workspaceDir = getWorkspaceDir();
  const noteFiles = await findNoteFiles(workspaceDir);
  const results = [];
  
  for (const noteFile of noteFiles) {
    // Check filename match
    const filenameMatch = noteFile.name.toLowerCase().includes(query.toLowerCase()) ||
                         noteFile.relativePath.toLowerCase().includes(query.toLowerCase());
    
    let contentMatches = [];
    if (includeContent) {
      contentMatches = await searchInFile(noteFile.path, query);
    }
    
    if (filenameMatch || contentMatches.length > 0) {
      results.push({
        path: noteFile.relativePath,
        name: noteFile.name,
        filenameMatch,
        contentMatches: includeContent ? contentMatches : [],
      });
    }
  }
  
  const summary = `Found ${results.length} matching notes for "${query}"`;
  const detailed = results.map(result => {
    let text = `**${result.name}** (${result.path})`;
    if (result.contentMatches.length > 0) {
      text += `\n  - ${result.contentMatches.length} content matches`;
      result.contentMatches.slice(0, 3).forEach(match => {
        text += `\n    Line ${match.line}: ${match.content}`;
      });
      if (result.contentMatches.length > 3) {
        text += `\n    ... and ${result.contentMatches.length - 3} more matches`;
      }
    }
    return text;
  }).join('\n\n');
  
  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n${detailed}`,
      },
    ],
  };
});

server.registerTool("listNotes", {
  title: "List Notes",
  description: "List all note files in the workspace",
  inputSchema: z.object({}),
}, async () => {
  const workspaceDir = getWorkspaceDir();
  const noteFiles = await findNoteFiles(workspaceDir);
  
  const summary = `Found ${noteFiles.length} notes in workspace`;
  const list = noteFiles.map(note => `- **${note.name}** (${note.relativePath})`).join('\n');
  
  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n${list}`,
      },
    ],
  };
});

server.registerTool("createNote", {
  title: "Create Note",
  description: "Create a new note file",
  inputSchema: CreateNoteSchema,
}, async ({ path, content, title }) => {
  // Ensure .md extension
  const notePath = path.endsWith('.md') ? path : `${path}.md`;
  const fullPath = notePath.startsWith('/') ? notePath : join(getWorkspaceDir(), notePath);
  
  // Prepare content with title if provided
  let noteContent = content;
  if (title) {
    noteContent = `# ${title}\n\n${content}`;
  }
  
  try {
    await writeFile(fullPath, noteContent, 'utf-8');
    
    return {
      content: [
        {
          type: "text",
          text: `Note created successfully at: ${notePath}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating note: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

server.registerTool("updateNote", {
  title: "Update Note",
  description: "Update the content of an existing note",
  inputSchema: UpdateNoteSchema,
}, async ({ path, content }) => {
  const fullPath = path.startsWith('/') ? path : join(getWorkspaceDir(), path);
  
  try {
    await writeFile(fullPath, content, 'utf-8');
    
    return {
      content: [
        {
          type: "text",
          text: `Note updated successfully: ${path}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
        text: `Error updating note: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  log("Starting Lokus MCP Server...");
  log("Workspace directory:", getWorkspaceDir());
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Don't log anything after connecting to stdio transport - it interferes with the protocol
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  process.exit(1);
});

// Run the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log("Failed to start server:", error);
    process.exit(1);
  });
}