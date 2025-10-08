#!/usr/bin/env node

/**
 * Lokus MCP Server - Stdio Transport
 * 
 * Properly implemented MCP server using the official SDK 0.5.0 API.
 * Provides tools for note management, workspace operations, and content search.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, readdir, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import all MCP tool classes
import { NoteTools } from "./tools/noteTools.js";
import { WorkspaceTools } from "./tools/workspaceTools.js";
import { SearchTools } from "./tools/searchTools.js";
import { AITools } from "./tools/aiTools.js";
import { FileTools } from "./tools/fileTools.js";
import { EditorTools } from "./tools/editorTools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

function getWorkspaceDir() {
  return PROJECT_ROOT;
}

function isNoteFile(filename) {
  const ext = extname(filename).toLowerCase();
  return ['.md', '.txt', '.markdown'].includes(ext);
}

async function findNoteFiles(dir, baseDir = dir) {
  const noteFiles = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      if (entry.isDirectory()) {
        const subFiles = await findNoteFiles(fullPath, baseDir);
        noteFiles.push(...subFiles);
      } else if (entry.isFile() && isNoteFile(entry.name)) {
        const relativePath = fullPath.replace(baseDir + '/', '');
        noteFiles.push({
          path: fullPath,
          relativePath,
          name: basename(entry.name, extname(entry.name))
        });
      }
    }
  } catch (error) {
    // Silent fail
  }
  return noteFiles;
}

// Create the MCP server with proper capabilities
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

// Initialize tool class instances
let noteTools, workspaceTools, searchTools, aiTools, fileTools, editorTools;
let allToolInstances = [];
let allTools = [];

async function initializeTools() {
  try {
    // Create tool instances with basic configuration
    // Use stderr for logging to avoid interfering with stdio protocol
    const logger = {
      info: (msg, data) => console.error(`[INFO] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`),
      warn: (msg, data) => console.error(`[WARN] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`),
      error: (msg, data) => console.error(`[ERROR] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`)
    };

    // Initialize each tool class
    noteTools = new NoteTools(null, null, { logger });
    workspaceTools = new WorkspaceTools(null, null, { logger });
    searchTools = new SearchTools(null, null, { logger });
    aiTools = new AITools({ logger });
    fileTools = new FileTools(null, null, { logger });
    editorTools = new EditorTools(null, null, { logger });

    allToolInstances = [
      { name: 'NoteTools', instance: noteTools },
      { name: 'WorkspaceTools', instance: workspaceTools },
      { name: 'SearchTools', instance: searchTools },
      { name: 'AITools', instance: aiTools },
      { name: 'FileTools', instance: fileTools },
      { name: 'EditorTools', instance: editorTools }
    ];

    // Initialize all tool instances
    for (const toolClass of allToolInstances) {
      try {
        await toolClass.instance.initialize();
        console.error(`[SUCCESS] ${toolClass.name} initialized`);
      } catch (error) {
        console.warn(`[WARN] Failed to initialize ${toolClass.name}:`, error.message);
        // Continue with other tools even if one fails
      }
    }

    // Collect all tools from all classes
    allTools = [];
    
    // Add legacy tools first (maintain backward compatibility)
    const legacyTools = [
      {
        name: "readNote",
        description: "Read the content of a specific note file",
        inputSchema: {
          type: "object",
          properties: {
            path: { 
              type: "string", 
              description: "Path to the note file (relative or absolute)" 
            }
          },
          required: ["path"]
        }
      },
      {
        name: "listNotes", 
        description: "List all note files in the workspace",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "searchNotes",
        description: "Search for notes by content or filename",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term to look for in note content and filenames"
            }
          },
          required: ["query"]
        }
      }
    ];

    allTools.push(...legacyTools);

    // Add tools from each tool class and build routing map
    for (const toolClass of allToolInstances) {
      try {
        const classTools = toolClass.instance.getTools();
        if (Array.isArray(classTools)) {
          allTools.push(...classTools);
          
          // Build routing map for this tool class
          const instanceName = toolClass.name.charAt(0).toLowerCase() + toolClass.name.slice(1).replace('Tools', 'Tools');
          classTools.forEach(tool => {
            toolRouting[tool.name] = instanceName;
          });
          
          console.error(`[SUCCESS] Added ${classTools.length} tools from ${toolClass.name}`);
        }
      } catch (error) {
        console.warn(`[WARN] Failed to get tools from ${toolClass.name}:`, error.message);
      }
    }

    console.error(`[SUCCESS] Total tools available: ${allTools.length}`);
    
  } catch (error) {
    console.error('[ERROR] Failed to initialize tools:', error);
    throw error;
  }
}

// Register tools/list handler using proper SDK API
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    // Ensure tools are initialized
    if (allTools.length === 0) {
      console.log('[INFO] Tools not initialized, initializing now...');
      await initializeTools();
    }
    
    console.log(`[INFO] Returning ${allTools.length} tools to client`);
    return {
      tools: allTools
    };
  } catch (error) {
    console.error('[ERROR] Failed to list tools:', error);
    // Return at least the legacy tools if initialization fails
    return {
      tools: [
        {
          name: "readNote",
          description: "Read the content of a specific note file",
          inputSchema: {
            type: "object",
            properties: {
              path: { 
                type: "string", 
                description: "Path to the note file (relative or absolute)" 
              }
            },
            required: ["path"]
          }
        },
        {
          name: "listNotes", 
          description: "List all note files in the workspace",
          inputSchema: {
            type: "object",
            properties: {},
          }
        },
        {
          name: "searchNotes",
          description: "Search for notes by content or filename",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search term to look for in note content and filenames"
              }
            },
            required: ["query"]
          }
        }
      ]
    };
  }
});

// Tool routing map - will be built dynamically from actual tool classes
let toolRouting = {};

// Register tools/call handler using proper SDK API  
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.log(`[INFO] Tool call: ${name}`, args ? `with args: ${JSON.stringify(args)}` : 'no args');
  
  try {
    // Ensure tools are initialized
    if (allTools.length === 0) {
      console.log('[INFO] Tools not initialized for call, initializing now...');
      await initializeTools();
    }

    // Handle legacy tools first for backward compatibility
    if (name === "readNote") {
      const { path } = args;
      const fullPath = path.startsWith('/') ? path : join(getWorkspaceDir(), path);
      
      try {
        const content = await readFile(fullPath, 'utf-8');
        const stats = await stat(fullPath);
        return {
          content: [{ 
            type: "text", 
            text: `# ${basename(path)}\n\n**Path:** ${path}\n**Size:** ${stats.size} bytes\n**Modified:** ${stats.mtime.toISOString()}\n\n---\n\n${content}`
          }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error reading note: ${error.message}` }],
          isError: true
        };
      }
    }

    if (name === "listNotes") {
      const noteFiles = await findNoteFiles(getWorkspaceDir());
      const summary = `Found ${noteFiles.length} notes in workspace`;
      const list = noteFiles.map(note => `- **${note.name}** (${note.relativePath})`).join('\n');
      return {
        content: [{ type: "text", text: `${summary}\n\n${list}` }]
      };
    }

    if (name === "searchNotes") {
      const { query } = args;
      const noteFiles = await findNoteFiles(getWorkspaceDir());
      const results = [];
      
      for (const noteFile of noteFiles) {
        // Check filename match
        const filenameMatch = noteFile.name.toLowerCase().includes(query.toLowerCase()) ||
                             noteFile.relativePath.toLowerCase().includes(query.toLowerCase());
        
        // Check content match
        let contentMatches = [];
        try {
          const content = await readFile(noteFile.path, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              contentMatches.push({
                line: index + 1,
                content: line.trim()
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
        }
        
        if (filenameMatch || contentMatches.length > 0) {
          results.push({
            name: noteFile.name,
            path: noteFile.relativePath,
            filenameMatch,
            contentMatches: contentMatches.slice(0, 3) // Limit to first 3 matches
          });
        }
      }
      
      const summary = `Found ${results.length} matching notes for "${query}"`;
      const detailed = results.map(result => {
        let text = `**${result.name}** (${result.path})`;
        if (result.contentMatches.length > 0) {
          text += `\n  - ${result.contentMatches.length} content matches`;
          result.contentMatches.forEach(match => {
            text += `\n    Line ${match.line}: ${match.content}`;
          });
        }
        return text;
      }).join('\n\n');
      
      return {
        content: [{ type: "text", text: `${summary}\n\n${detailed}` }]
      };
    }

    // Route to appropriate tool class
    const toolClassName = toolRouting[name];
    if (!toolClassName) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Get the appropriate tool instance
    const toolInstance = eval(toolClassName); // noteTools, workspaceTools, etc.
    if (!toolInstance) {
      throw new Error(`Tool class ${toolClassName} not initialized`);
    }

    // Execute the tool
    console.log(`[INFO] Routing ${name} to ${toolClassName}`);
    const result = await toolInstance.executeTool(name, args);
    
    // Format the response for MCP
    if (result && typeof result === 'object') {
      // If result has success property, format as text response
      if (result.success !== undefined) {
        const responseText = formatToolResponse(name, result);
        return {
          content: [{ type: "text", text: responseText }]
        };
      }
      
      // If result is already formatted, return as-is
      if (result.content) {
        return result;
      }
      
      // Otherwise format as JSON
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
    
    // Fallback for string results
    return {
      content: [{ type: "text", text: String(result) }]
    };

  } catch (error) {
    console.error(`[ERROR] Tool ${name} failed:`, error);
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${error.message}` }],
      isError: true
    };
  }
});

/**
 * Format tool response for better readability
 */
function formatToolResponse(toolName, result) {
  if (!result) return 'Tool executed successfully';
  
  let response = `# ${toolName} Result\n\n`;
  
  if (result.success) {
    response += '✅ **Success**\n\n';
  }
  
  // Add key information
  if (result.path) {
    response += `**Path:** ${result.path}\n`;
  }
  
  if (result.title) {
    response += `**Title:** ${result.title}\n`;
  }
  
  if (result.size !== undefined) {
    response += `**Size:** ${result.sizeFormatted || result.size}\n`;
  }
  
  if (result.created) {
    response += `**Created:** ${result.created}\n`;
  }
  
  if (result.modified) {
    response += `**Modified:** ${result.modified}\n`;
  }
  
  // Add arrays/lists
  if (result.tools && Array.isArray(result.tools)) {
    response += `\n**Tools (${result.tools.length}):**\n`;
    result.tools.forEach(tool => {
      response += `- ${tool.name || tool.id}: ${tool.description || ''}\n`;
    });
  }
  
  if (result.files && Array.isArray(result.files)) {
    response += `\n**Files (${result.files.length}):**\n`;
    result.files.slice(0, 10).forEach(file => {
      response += `- ${file.name || file.path}\n`;
    });
    if (result.files.length > 10) {
      response += `... and ${result.files.length - 10} more\n`;
    }
  }
  
  if (result.matches && Array.isArray(result.matches)) {
    response += `\n**Matches (${result.matches.length}):**\n`;
    result.matches.slice(0, 5).forEach(match => {
      response += `- ${match.path || match.file}: ${match.content || match.text || ''}\n`;
    });
    if (result.matches.length > 5) {
      response += `... and ${result.matches.length - 5} more\n`;
    }
  }
  
  // Add summary or content
  if (result.summary) {
    response += `\n**Summary:**\n${result.summary}\n`;
  }
  
  if (result.content && typeof result.content === 'string') {
    response += `\n**Content:**\n${result.content}\n`;
  }
  
  // Add error information
  if (result.error) {
    response += `\n❌ **Error:** ${result.error}\n`;
  }
  
  if (result.warnings && Array.isArray(result.warnings)) {
    response += `\n⚠️ **Warnings:**\n`;
    result.warnings.forEach(warning => {
      response += `- ${warning}\n`;
    });
  }
  
  return response;
}

async function main() {
  try {
    console.error('[INFO] Starting Lokus MCP Server...');

    // Initialize all tools before connecting
    await initializeTools();

    console.error('[INFO] All tools initialized, connecting to transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('[SUCCESS] Lokus MCP Server connected and ready!');

  } catch (error) {
    console.error('[FATAL] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[INFO] Shutting down gracefully...');

  // Clean up tool instances if needed
  try {
    for (const toolClass of allToolInstances) {
      if (toolClass.instance && typeof toolClass.instance.dispose === 'function') {
        await toolClass.instance.dispose();
      }
    }
  } catch (error) {
    console.error('[WARN] Error during cleanup:', error.message);
  }

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[INFO] Received SIGTERM, shutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('[FATAL] Unhandled error:', error);
  process.exit(1);
});