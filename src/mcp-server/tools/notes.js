/**
 * Notes Management Tools for MCP
 * Enhanced tools for working with notes in Lokus
 */

import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import { getWorkspaceContext, formatWorkspaceContext } from "./workspace-context.js";

export const notesTools = [
  {
    name: "list_notes",
    description: "List all notes in the workspace with metadata",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: "Folder to list notes from (optional)"
        },
        sortBy: {
          type: "string",
          enum: ["name", "modified", "created", "size"],
          description: "Sort notes by"
        },
        includeContent: {
          type: "boolean",
          description: "Include first 200 chars of content"
        }
      },
    }
  },
  {
    name: "read_note",
    description: "Read the full content of a note",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the note file"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "create_note",
    description: "Create a new note with optional frontmatter",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path for the new note"
        },
        content: {
          type: "string",
          description: "Note content"
        },
        frontmatter: {
          type: "object",
          description: "Optional frontmatter metadata"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "update_note",
    description: "Update an existing note's content",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the note"
        },
        content: {
          type: "string",
          description: "New content"
        },
        preserveFrontmatter: {
          type: "boolean",
          description: "Preserve existing frontmatter"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "delete_note",
    description: "Delete a note",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the note to delete"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "search_notes",
    description: "Search notes by content or metadata",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        searchIn: {
          type: "string",
          enum: ["content", "title", "tags", "all"],
          description: "Where to search"
        },
        regex: {
          type: "boolean",
          description: "Use regex search"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_note_links",
    description: "Get all wiki links in a note",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the note"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "get_note_backlinks",
    description: "Find all notes that link to a specific note",
    inputSchema: {
      type: "object",
      properties: {
        noteName: {
          type: "string",
          description: "Name of the note to find backlinks for"
        }
      },
      required: ["noteName"]
    }
  },
  {
    name: "extract_note_metadata",
    description: "Extract frontmatter and metadata from a note",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the note"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "rename_note",
    description: "Rename a note and update all references",
    inputSchema: {
      type: "object",
      properties: {
        oldPath: {
          type: "string",
          description: "Current path of the note"
        },
        newPath: {
          type: "string",
          description: "New path for the note"
        },
        updateLinks: {
          type: "boolean",
          description: "Update wiki links in other notes"
        }
      },
      required: ["oldPath", "newPath"]
    }
  }
];

export async function executeNoteTool(tool, args, workspace, apiUrl) {
  // Check for workspace context override
  const contextWorkspace = await getWorkspaceContext();
  const actualWorkspace = contextWorkspace || workspace;

  switch (tool) {
    case "list_notes":
      return await listNotes(actualWorkspace, args);

    case "read_note":
      return await readNote(actualWorkspace, args.path);

    case "create_note":
      return await createNote(actualWorkspace, args);

    case "update_note":
      return await updateNote(actualWorkspace, args);

    case "delete_note":
      return await deleteNote(actualWorkspace, args.path);

    case "search_notes":
      return await searchNotes(actualWorkspace, args);

    case "get_note_links":
      return await getNoteLinks(actualWorkspace, args.path);

    case "get_note_backlinks":
      return await getNoteBacklinks(actualWorkspace, args.noteName);

    case "extract_note_metadata":
      return await extractNoteMetadata(actualWorkspace, args.path);

    case "rename_note":
      return await renameNote(actualWorkspace, args);

    default:
      throw new Error(`Unknown notes tool: ${tool}`);
  }
}

// Implementation functions
async function listNotes(workspace, options = {}) {
  const notes = await findNotesRecursive(workspace);

  // Sort notes
  if (options.sortBy) {
    notes.sort((a, b) => {
      switch (options.sortBy) {
        case 'modified':
          return b.modified - a.modified;
        case 'created':
          return b.created - a.created;
        case 'size':
          return b.size - a.size;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }

  // Include content preview if requested
  if (options.includeContent) {
    for (const note of notes) {
      try {
        const content = await readFile(note.path, 'utf-8');
        note.preview = content.substring(0, 200).replace(/\n/g, ' ');
      } catch (e) {
        note.preview = null;
      }
    }
  }

  return {
    content: [{
      type: "text",
      text: `${formatWorkspaceContext(workspace)}\n\nFound ${notes.length} notes\n\n${notes.map(n =>
        `- ${n.name} (${n.relativePath})${n.preview ? '\n  ' + n.preview + '...' : ''}`
      ).join('\n')}`
    }]
  };
}

async function findNotesRecursive(dir, baseDir = dir) {
  const notes = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      const subNotes = await findNotesRecursive(fullPath, baseDir);
      notes.push(...subNotes);
    } else if (entry.isFile() && ['.md', '.txt'].includes(extname(entry.name))) {
      const stats = await stat(fullPath);
      notes.push({
        path: fullPath,
        relativePath: fullPath.replace(baseDir + '/', ''),
        name: basename(entry.name, extname(entry.name)),
        size: stats.size,
        created: stats.birthtime?.getTime(),
        modified: stats.mtime?.getTime()
      });
    }
  }

  return notes;
}

async function readNote(workspace, path) {
  const notePath = path.startsWith('/') ? path : join(workspace, path);
  const content = await readFile(notePath, 'utf-8');

  return {
    content: [{
      type: "text",
      text: content
    }]
  };
}

async function createNote(workspace, { path, content, frontmatter }) {
  const notePath = join(workspace, path);
  await mkdir(dirname(notePath), { recursive: true });

  let finalContent = content;
  if (frontmatter) {
    const yamlContent = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
    finalContent = `---\n${yamlContent}\n---\n\n${content}`;
  }

  await writeFile(notePath, finalContent);

  return {
    content: [{
      type: "text",
      text: `✅ Note created: ${path}`
    }]
  };
}

async function updateNote(workspace, { path, content, preserveFrontmatter }) {
  const notePath = join(workspace, path);

  if (preserveFrontmatter) {
    const existing = await readFile(notePath, 'utf-8');
    const frontmatterMatch = existing.match(/^---\n([\s\S]*?)\n---\n/);
    if (frontmatterMatch) {
      content = frontmatterMatch[0] + content;
    }
  }

  await writeFile(notePath, content);

  return {
    content: [{
      type: "text",
      text: `✅ Note updated: ${path}`
    }]
  };
}

async function deleteNote(workspace, path) {
  const notePath = join(workspace, path);
  const { unlink } = await import('fs/promises');
  await unlink(notePath);

  return {
    content: [{
      type: "text",
      text: `✅ Note deleted: ${path}`
    }]
  };
}

async function searchNotes(workspace, { query, searchIn = 'all', regex = false }) {
  const notes = await findNotesRecursive(workspace);
  const matches = [];

  const searchPattern = regex ? new RegExp(query, 'gi') : query.toLowerCase();

  for (const note of notes) {
    try {
      const content = await readFile(note.path, 'utf-8');
      let isMatch = false;
      let matchContext = '';

      if (searchIn === 'title' || searchIn === 'all') {
        if (regex ? searchPattern.test(note.name) : note.name.toLowerCase().includes(query.toLowerCase())) {
          isMatch = true;
          matchContext = `Title match: ${note.name}`;
        }
      }

      if (!isMatch && (searchIn === 'content' || searchIn === 'all')) {
        if (regex ? searchPattern.test(content) : content.toLowerCase().includes(query.toLowerCase())) {
          isMatch = true;
          const index = content.toLowerCase().indexOf(query.toLowerCase());
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + query.length + 50);
          matchContext = content.substring(start, end).replace(/\n/g, ' ');
        }
      }

      if (isMatch) {
        matches.push({
          note: note.name,
          path: note.relativePath,
          context: matchContext
        });
      }
    } catch (e) {
      // Skip files we can't read
    }
  }

  return {
    content: [{
      type: "text",
      text: `Found ${matches.length} matches for "${query}":\n\n${
        matches.map(m => `**${m.note}** (${m.path})\n  ${m.context}`).join('\n\n')
      }`
    }]
  };
}

async function getNoteLinks(workspace, path) {
  const notePath = join(workspace, path);
  const content = await readFile(notePath, 'utf-8');

  // Extract wiki links [[...]]
  const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
  const links = wikiLinks.map(link => link.slice(2, -2));

  return {
    content: [{
      type: "text",
      text: `Found ${links.length} wiki links in the note:\n${links.map(l => `- [[${l}]]`).join('\n')}`
    }]
  };
}

async function getNoteBacklinks(workspace, noteName) {
  const notes = await findNotesRecursive(workspace);
  const backlinks = [];

  for (const note of notes) {
    try {
      const content = await readFile(note.path, 'utf-8');
      if (content.includes(`[[${noteName}]]`)) {
        backlinks.push({
          note: note.name,
          path: note.relativePath
        });
      }
    } catch (e) {
      // Skip files we can't read
    }
  }

  return {
    content: [{
      type: "text",
      text: `Found ${backlinks.length} backlinks to "${noteName}":\n${
        backlinks.map(b => `- ${b.note} (${b.path})`).join('\n')
      }`
    }]
  };
}

async function extractNoteMetadata(workspace, path) {
  const notePath = join(workspace, path);
  const content = await readFile(notePath, 'utf-8');

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter = {};

  if (frontmatterMatch) {
    // Simple YAML parsing (basic implementation)
    const yamlContent = frontmatterMatch[1];
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }
  }

  // Extract other metadata
  const stats = await stat(notePath);
  const wordCount = content.split(/\s+/).length;
  const lineCount = content.split('\n').length;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        frontmatter,
        stats: {
          wordCount,
          lineCount,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      }, null, 2)
    }]
  };
}

async function renameNote(workspace, { oldPath, newPath, updateLinks = true }) {
  const oldNotePath = join(workspace, oldPath);
  const newNotePath = join(workspace, newPath);

  // Create directory if needed
  await mkdir(dirname(newNotePath), { recursive: true });

  // Rename the file
  const { rename } = await import('fs/promises');
  await rename(oldNotePath, newNotePath);

  // Update links if requested
  if (updateLinks) {
    const oldName = basename(oldPath, extname(oldPath));
    const newName = basename(newPath, extname(newPath));

    const notes = await findNotesRecursive(workspace);
    let updatedCount = 0;

    for (const note of notes) {
      try {
        const content = await readFile(note.path, 'utf-8');
        if (content.includes(`[[${oldName}]]`)) {
          const newContent = content.replace(
            new RegExp(`\\[\\[${oldName}\\]\\]`, 'g'),
            `[[${newName}]]`
          );
          await writeFile(note.path, newContent);
          updatedCount++;
        }
      } catch (e) {
        // Skip files we can't process
      }
    }

    return {
      content: [{
        type: "text",
        text: `✅ Note renamed from ${oldPath} to ${newPath}\n${
          updateLinks ? `Updated ${updatedCount} references` : ''
        }`
      }]
    };
  }

  return {
    content: [{
      type: "text",
      text: `✅ Note renamed from ${oldPath} to ${newPath}`
    }]
  };
}