/**
 * Workspace Management Tools for MCP
 * Tools for managing Lokus workspaces and getting information
 */

import { readdir, stat, readFile } from "fs/promises";
import { join } from "path";
import fetch from "node-fetch";

export const workspaceTools = [
  {
    name: "get_workspace_info",
    description: "Get comprehensive information about the current workspace",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "get_workspace_stats",
    description: "Get statistics about the workspace (note count, size, etc)",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "list_folders",
    description: "List all folders in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        maxDepth: {
          type: "number",
          description: "Maximum depth to traverse"
        }
      },
    }
  },
  {
    name: "get_workspace_settings",
    description: "Get workspace-specific settings",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "search_workspace",
    description: "Global search across all workspace content",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        fileTypes: {
          type: "array",
          items: { type: "string" },
          description: "File types to search (md, txt, json, etc)"
        },
        limit: {
          type: "number",
          description: "Maximum results to return"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_recent_files",
    description: "Get recently modified files in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of files to return"
        },
        fileTypes: {
          type: "array",
          items: { type: "string" },
          description: "Filter by file types"
        }
      },
    }
  }
];

export async function executeWorkspaceTool(tool, args, workspace, apiUrl) {
  switch (tool) {
    case "get_workspace_info":
      return await getWorkspaceInfo(workspace, apiUrl);

    case "get_workspace_stats":
      return await getWorkspaceStats(workspace);

    case "list_folders":
      return await listFolders(workspace, args.maxDepth || 3);

    case "get_workspace_settings":
      return await getWorkspaceSettings(workspace);

    case "search_workspace":
      return await searchWorkspace(workspace, args);

    case "get_recent_files":
      return await getRecentFiles(workspace, args);

    default:
      throw new Error(`Unknown workspace tool: ${tool}`);
  }
}

async function getWorkspaceInfo(workspace, apiUrl) {
  // Try to get info from API server first
  if (apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/api/workspace`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return {
            content: [{
              type: "text",
              text: `**Workspace Information**\n
📁 Path: ${data.data.workspace}
📝 Name: ${data.data.name}
📊 Total Notes: ${data.data.total_notes}
${data.data.has_bases ? '✅ Bases enabled' : '❌ Bases not configured'}
${data.data.has_canvas ? '✅ Canvas enabled' : '❌ Canvas not configured'}
${data.data.has_tasks ? '✅ Tasks enabled' : '❌ Tasks not configured'}`
            }]
          };
        }
      }
    } catch (e) {
      // Fall back to local detection
    }
  }

  // Local detection
  const stats = await getWorkspaceStats(workspace);
  const lokusDir = join(workspace, '.lokus');
  const hasLokus = await exists(lokusDir);

  return {
    content: [{
      type: "text",
      text: `**Workspace Information**\n
📁 Path: ${workspace}
📝 Notes: ${stats.noteCount}
📂 Folders: ${stats.folderCount}
💾 Total Size: ${formatBytes(stats.totalSize)}
🔧 Lokus Features: ${hasLokus ? 'Configured' : 'Not configured'}`
    }]
  };
}

async function getWorkspaceStats(workspace) {
  const stats = {
    noteCount: 0,
    folderCount: 0,
    totalSize: 0,
    fileTypes: {}
  };

  async function traverse(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        stats.folderCount++;
        await traverse(fullPath);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        stats.totalSize += fileStat.size;

        const ext = entry.name.split('.').pop();
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;

        if (['md', 'txt'].includes(ext)) {
          stats.noteCount++;
        }
      }
    }
  }

  await traverse(workspace);

  return stats;
}

async function listFolders(workspace, maxDepth) {
  const folders = [];

  async function traverse(dir, depth = 0, relativePath = '') {
    if (depth >= maxDepth) return;

    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        const folderPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        folders.push({
          name: entry.name,
          path: folderPath,
          depth
        });

        await traverse(join(dir, entry.name), depth + 1, folderPath);
      }
    }
  }

  await traverse(workspace);

  const tree = folders
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(f => '  '.repeat(f.depth) + '📁 ' + f.name)
    .join('\n');

  return {
    content: [{
      type: "text",
      text: `**Workspace Folders:**\n\n${tree}`
    }]
  };
}

async function getWorkspaceSettings(workspace) {
  const settingsPath = join(workspace, '.lokus', 'settings.json');

  try {
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    return {
      content: [{
        type: "text",
        text: `**Workspace Settings:**\n\n${JSON.stringify(settings, null, 2)}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: "No workspace settings found. This workspace may not be configured for Lokus."
      }]
    };
  }
}

async function searchWorkspace(workspace, { query, fileTypes = ['md', 'txt'], limit = 20 }) {
  const results = [];

  async function searchDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await searchDir(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop();
        if (fileTypes.includes(ext)) {
          try {
            const content = await readFile(fullPath, 'utf-8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
              const index = content.toLowerCase().indexOf(query.toLowerCase());
              const start = Math.max(0, index - 50);
              const end = Math.min(content.length, index + query.length + 50);
              const context = content.substring(start, end).replace(/\n/g, ' ');

              results.push({
                file: fullPath.replace(workspace + '/', ''),
                context
              });

              if (results.length >= limit) return;
            }
          } catch (e) {
            // Skip files we can't read
          }
        }
      }
    }
  }

  await searchDir(workspace);

  return {
    content: [{
      type: "text",
      text: `Found ${results.length} matches for "${query}":\n\n${
        results.map(r => `**${r.file}**\n  ...${r.context}...`).join('\n\n')
      }`
    }]
  };
}

async function getRecentFiles(workspace, { count = 10, fileTypes = null }) {
  const files = [];

  async function collectFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await collectFiles(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop();
        if (!fileTypes || fileTypes.includes(ext)) {
          const stats = await stat(fullPath);
          files.push({
            path: fullPath.replace(workspace + '/', ''),
            name: entry.name,
            modified: stats.mtime,
            size: stats.size
          });
        }
      }
    }
  }

  await collectFiles(workspace);

  // Sort by modified date
  files.sort((a, b) => b.modified - a.modified);

  const recent = files.slice(0, count);

  return {
    content: [{
      type: "text",
      text: `**Recently Modified Files:**\n\n${
        recent.map(f => `- ${f.name} (${f.path})\n  Modified: ${f.modified.toISOString()}`).join('\n')
      }`
    }]
  };
}

// Utility functions
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}