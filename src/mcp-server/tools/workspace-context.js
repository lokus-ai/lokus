/**
 * Workspace Context Management Tools for MCP
 * Provides smart workspace detection and context switching
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import fetch from "node-fetch";
import { matchWorkspace, matchMultipleWorkspaces, extractWorkspaceReferences } from "../workspace-matcher.js";

// Context file location in user's home directory
const CONTEXT_FILE = join(homedir(), '.lokus', 'mcp-context.json');

export const workspaceContextTools = [
  {
    name: "list_all_workspaces",
    description: "List all available Lokus workspaces. Use this when you need to see what workspaces are available or when the user mentions a workspace name.",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "set_workspace_context",
    description: "Set the active workspace context for all subsequent operations. This ensures all tools operate on the correct workspace. Always use this before performing workspace-specific operations.",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: {
          type: "string",
          description: "Full path to the workspace to set as active"
        }
      },
      required: ["workspacePath"]
    }
  },
  {
    name: "get_current_context",
    description: "Get the currently active workspace context. Use this to verify which workspace you're operating on.",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "match_workspace_by_name",
    description: "Smart workspace detection from natural language. Use this when the user refers to a workspace by name (e.g., 'my knowledge base', 'work notes'). Returns the best matching workspace.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language workspace reference (e.g., 'knowledge base', 'work notes', 'personal workspace')"
        },
        autoSet: {
          type: "boolean",
          description: "Automatically set the matched workspace as active context (default: true)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "clear_workspace_context",
    description: "Clear the active workspace context. Use this when you need to reset or when switching between different tasks.",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "detect_workspace_from_text",
    description: "Analyze text to automatically detect workspace references and provide suggestions. Useful when the user's message contains workspace-related context.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to analyze for workspace references"
        }
      },
      required: ["text"]
    }
  }
];

export async function executeWorkspaceContextTool(tool, args, apiUrl) {
  switch (tool) {
    case "list_all_workspaces":
      return await listAllWorkspaces(apiUrl);

    case "set_workspace_context":
      return await setWorkspaceContext(args.workspacePath);

    case "get_current_context":
      return await getCurrentContext();

    case "match_workspace_by_name":
      return await matchWorkspaceByName(args.query, args.autoSet !== false, apiUrl);

    case "clear_workspace_context":
      return await clearWorkspaceContext();

    case "detect_workspace_from_text":
      return await detectWorkspaceFromText(args.text, apiUrl);

    default:
      throw new Error(`Unknown workspace context tool: ${tool}`);
  }
}

/**
 * List all available workspaces from the API
 */
async function listAllWorkspaces(apiUrl) {
  if (!apiUrl) {
    return {
      content: [{
        type: "text",
        text: "❌ API server not available. Cannot list workspaces.\n\nPlease ensure Lokus is running."
      }]
    };
  }

  try {
    const response = await fetch(`${apiUrl}/api/workspaces/all`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch workspaces');
    }

    const workspaces = data.data;

    if (workspaces.length === 0) {
      return {
        content: [{
          type: "text",
          text: "📂 No workspaces found.\n\nYou may need to open a workspace in Lokus first."
        }]
      };
    }

    // Get current context to highlight it
    const context = await loadContext();

    const workspaceList = workspaces.map(ws => {
      const isCurrent = context.currentWorkspace === ws.path;
      const marker = isCurrent ? '👉 ' : '   ';
      const noteInfo = ws.note_count !== null ? ` (${ws.note_count} notes)` : '';
      return `${marker}📁 **${ws.name}**${noteInfo}\n      Path: ${ws.path}`;
    }).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `**Available Workspaces:**\n\n${workspaceList}\n\n${context.currentWorkspace ? '👉 = Currently active workspace' : '💡 Use \`match_workspace_by_name\` or \`set_workspace_context\` to set active workspace'}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to list workspaces: ${error.message}\n\nPlease ensure Lokus is running and the API server is accessible.`
      }]
    };
  }
}

/**
 * Set the active workspace context
 */
async function setWorkspaceContext(workspacePath) {
  try {
    const context = await loadContext();
    context.currentWorkspace = workspacePath;
    context.lastUpdated = new Date().toISOString();
    await saveContext(context);

    return {
      content: [{
        type: "text",
        text: `✅ Workspace context set to:\n📁 **${workspacePath}**\n\nAll subsequent operations will use this workspace.`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to set workspace context: ${error.message}`
      }]
    };
  }
}

/**
 * Get the current workspace context
 */
async function getCurrentContext() {
  try {
    const context = await loadContext();

    if (!context.currentWorkspace) {
      return {
        content: [{
          type: "text",
          text: "⚠️ No workspace context is currently set.\n\n💡 Use `list_all_workspaces` to see available workspaces, then use `match_workspace_by_name` or `set_workspace_context` to set one."
        }]
      };
    }

    const timeSince = new Date() - new Date(context.lastUpdated);
    const minutesAgo = Math.floor(timeSince / 60000);
    const timeStr = minutesAgo < 1 ? 'just now' : `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;

    return {
      content: [{
        type: "text",
        text: `**Current Workspace Context:**\n\n📁 ${context.currentWorkspace}\n⏱️ Last updated: ${timeStr}\n\n✅ All operations will use this workspace.`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to get context: ${error.message}`
      }]
    };
  }
}

/**
 * Match workspace by natural language query
 */
async function matchWorkspaceByName(query, autoSet, apiUrl) {
  if (!apiUrl) {
    return {
      content: [{
        type: "text",
        text: "❌ API server not available. Cannot match workspaces."
      }]
    };
  }

  try {
    // Fetch all workspaces
    const response = await fetch(`${apiUrl}/api/workspaces/all`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch workspaces');
    }

    const workspaces = data.data;

    if (workspaces.length === 0) {
      return {
        content: [{
          type: "text",
          text: "📂 No workspaces available to match against."
        }]
      };
    }

    // Try to match
    const match = matchWorkspace(query, workspaces, 0.6);

    if (!match) {
      // Get top 3 closest matches to suggest
      const suggestions = matchMultipleWorkspaces(query, workspaces, 0.4, 3);

      if (suggestions.length > 0) {
        const suggestionList = suggestions.map(s =>
          `  - ${s.workspace.name} (${Math.round(s.confidence * 100)}% match)`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `❌ No strong match found for "${query}".\n\nDid you mean:\n${suggestionList}\n\n💡 Try being more specific or use \`list_all_workspaces\` to see all available workspaces.`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `❌ No workspace matches "${query}".\n\n💡 Use \`list_all_workspaces\` to see all available workspaces.`
        }]
      };
    }

    // Found a match!
    const confidencePercent = Math.round(match.confidence * 100);
    const matchTypeEmoji = match.matchType === 'exact' ? '🎯' : match.matchType === 'substring' ? '✅' : '🔍';

    let resultText = `${matchTypeEmoji} **Match Found** (${confidencePercent}% confidence)\n\n📁 **${match.workspace.name}**\n   Path: ${match.workspace.path}\n   Match type: ${match.matchType}`;

    // Auto-set context if requested
    if (autoSet) {
      await setWorkspaceContext(match.workspace.path);
      resultText += '\n\n✅ Workspace context has been automatically set.\nAll subsequent operations will use this workspace.';
    } else {
      resultText += '\n\n💡 Use `set_workspace_context` to activate this workspace.';
    }

    return {
      content: [{
        type: "text",
        text: resultText
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to match workspace: ${error.message}`
      }]
    };
  }
}

/**
 * Clear the workspace context
 */
async function clearWorkspaceContext() {
  try {
    const context = await loadContext();
    const previousWorkspace = context.currentWorkspace;
    context.currentWorkspace = null;
    context.lastUpdated = new Date().toISOString();
    await saveContext(context);

    return {
      content: [{
        type: "text",
        text: previousWorkspace
          ? `✅ Workspace context cleared.\nPreviously: ${previousWorkspace}`
          : "✅ Workspace context cleared (no context was set)."
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to clear context: ${error.message}`
      }]
    };
  }
}

/**
 * Detect workspace references from text
 */
async function detectWorkspaceFromText(text, apiUrl) {
  if (!apiUrl) {
    return {
      content: [{
        type: "text",
        text: "❌ API server not available."
      }]
    };
  }

  try {
    // Extract potential workspace references from text
    const references = extractWorkspaceReferences(text);

    if (references.length === 0) {
      return {
        content: [{
          type: "text",
          text: "🔍 No workspace references detected in the text.\n\n💡 Try phrases like 'in my knowledge base' or 'from work notes'."
        }]
      };
    }

    // Fetch all workspaces
    const response = await fetch(`${apiUrl}/api/workspaces/all`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch workspaces');
    }

    const workspaces = data.data;

    // Try to match each reference
    const matches = [];
    for (const ref of references) {
      const match = matchWorkspace(ref, workspaces, 0.5);
      if (match) {
        matches.push({ reference: ref, match });
      }
    }

    if (matches.length === 0) {
      return {
        content: [{
          type: "text",
          text: `🔍 Found potential workspace references but couldn't match them:\n${references.map(r => `  - "${r}"`).join('\n')}\n\n💡 Use \`list_all_workspaces\` to see available workspaces.`
        }]
      };
    }

    const matchList = matches.map(m =>
      `  - "${m.reference}" → **${m.match.workspace.name}** (${Math.round(m.match.confidence * 100)}% confidence)`
    ).join('\n');

    // Auto-set the best match
    const bestMatch = matches.sort((a, b) => b.match.confidence - a.match.confidence)[0];
    await setWorkspaceContext(bestMatch.match.workspace.path);

    return {
      content: [{
        type: "text",
        text: `🔍 **Workspace References Detected:**\n\n${matchList}\n\n✅ Automatically set context to: **${bestMatch.match.workspace.name}**`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to detect workspace: ${error.message}`
      }]
    };
  }
}

/**
 * Load context from file
 */
async function loadContext() {
  try {
    const content = await readFile(CONTEXT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid, return default context
    return {
      currentWorkspace: null,
      lastUpdated: null
    };
  }
}

/**
 * Save context to file
 */
async function saveContext(context) {
  const lokusDir = join(homedir(), '.lokus');

  // Ensure .lokus directory exists
  try {
    await mkdir(lokusDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  await writeFile(CONTEXT_FILE, JSON.stringify(context, null, 2), 'utf-8');
}

/**
 * Get the current workspace context (for use by other tools)
 * This is a helper function that other tool modules can import
 */
export async function getWorkspaceContext() {
  const context = await loadContext();
  return context.currentWorkspace;
}

/**
 * Validate and display workspace context
 * This is a helper function that other tools can use to show which workspace they're operating on
 */
export function formatWorkspaceContext(workspacePath) {
  if (!workspacePath) {
    return '⚠️ **No workspace context set** - Using default or last workspace';
  }

  const workspaceName = workspacePath.split('/').pop();
  return `🎯 **Operating on:** ${workspaceName} (${workspacePath})`;
}
