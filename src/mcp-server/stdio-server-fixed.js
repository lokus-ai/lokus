#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "readNote",
        description: "Read the content of a specific note file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to the note file" }
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
      }
    ]
  };
});

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "readNote") {
    const { path } = args;
    const fullPath = path.startsWith('/') ? path : join(getWorkspaceDir(), path);
    
    try {
      const content = await readFile(fullPath, 'utf-8');
      return {
        content: [{ type: "text", text: content }]
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
    const list = noteFiles.map(note => `- ${note.name} (${note.relativePath})`).join('\n');
    return {
      content: [{ type: "text", text: `Found ${noteFiles.length} notes:\n\n${list}` }]
    };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => process.exit(1));