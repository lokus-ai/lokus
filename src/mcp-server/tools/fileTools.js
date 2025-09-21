/**
 * File Tools for Lokus MCP Server
 * 
 * Provides file system operations using Node.js APIs for the MCP server environment.
 * Replaces Tauri-based file operations with native Node.js filesystem operations.
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, dirname, basename, extname, resolve, relative, isAbsolute } from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import { WorkspaceManager } from '../utils/workspaceManager.js';

export class FileTools extends EventEmitter {
  constructor(noteProvider, fileProvider, options = {}) {
    super();
    
    this.noteProvider = noteProvider;
    this.fileProvider = fileProvider;
    this.options = {
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      allowedExtensions: options.allowedExtensions || ['.md', '.txt', '.json', '.yaml', '.yml'],
      maxSearchResults: options.maxSearchResults || 100,
      createWorkspaceIfMissing: options.createWorkspaceIfMissing !== false,
      ...options
    };
    
    this.workspacePath = null;
    this.logger = options.logger || console;
    this.workspaceManager = new WorkspaceManager(this.logger);
  }

  /**
   * Initialize file tools
   */
  async initialize() {
    try {
      // Use workspace manager to find current workspace
      this.workspacePath = await this.workspaceManager.initialize();
      
      if (!this.workspacePath) {
        this.logger.warn('No workspace found, creating default workspace directory');
        this.workspacePath = join(homedir(), 'Documents', 'Lokus-Workspace');
        await mkdir(this.workspacePath, { recursive: true });
        await this.workspaceManager.setCurrentWorkspace(this.workspacePath);
      }
      
      // Ensure workspace directory exists
      if (this.options.createWorkspaceIfMissing) {
        await mkdir(this.workspacePath, { recursive: true });
      }
      
      // Verify workspace exists
      try {
        const stats = await stat(this.workspacePath);
        if (!stats.isDirectory()) {
          throw new Error(`Workspace path is not a directory: ${this.workspacePath}`);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Workspace directory does not exist: ${this.workspacePath}`);
        }
        throw error;
      }
      
      this.logger.info('FileTools initialized', {
        workspacePath: this.workspacePath,
        maxFileSize: this.options.maxFileSize,
        allowedExtensions: this.options.allowedExtensions
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize FileTools:', error);
      throw error;
    }
  }

  /**
   * Get available file tools
   */
  getTools() {
    return [
      {
        name: 'read_file',
        description: 'Read a file from the workspace or filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'File path to read (absolute or relative to workspace)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file in the workspace or filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'File path to write (absolute or relative to workspace)'
            },
            content: { 
              type: 'string', 
              description: 'Content to write to the file'
            },
            createDirectories: {
              type: 'boolean',
              description: 'Create parent directories if they do not exist',
              default: true
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_files',
        description: 'List files and directories in workspace or specified path',
        inputSchema: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Directory path to list (defaults to workspace root)'
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to include subdirectories recursively',
              default: false
            },
            includeHidden: {
              type: 'boolean',
              description: 'Whether to include hidden files and directories',
              default: false
            }
          }
        }
      },
      {
        name: 'search_files',
        description: 'Search for content within files in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Search query text'
            },
            path: {
              type: 'string',
              description: 'Directory to search in (defaults to workspace root)'
            },
            caseSensitive: {
              type: 'boolean',
              description: 'Whether search should be case sensitive',
              default: false
            },
            wholeWord: {
              type: 'boolean',
              description: 'Whether to match whole words only',
              default: false
            },
            regex: {
              type: 'boolean',
              description: 'Whether query is a regular expression',
              default: false
            },
            fileTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'File extensions to search (e.g., ["md", "txt"])',
              default: ['md', 'txt']
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 100
            }
          },
          required: ['query']
        }
      },
      {
        name: 'create_note',
        description: 'Create a new note/markdown file in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            name: { 
              type: 'string', 
              description: 'Name of the note (without .md extension)'
            },
            content: {
              type: 'string',
              description: 'Initial content for the note',
              default: ''
            },
            path: {
              type: 'string',
              description: 'Subdirectory within workspace (optional)'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'get_file_metadata',
        description: 'Get metadata information about a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'File path to get metadata for'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'list_workspaces',
        description: 'List all available Lokus workspaces',
        inputSchema: {
          type: 'object',
          properties: {},
        }
      },
      {
        name: 'get_current_workspace',
        description: 'Get the currently active workspace',
        inputSchema: {
          type: 'object',
          properties: {},
        }
      },
      {
        name: 'set_workspace',
        description: 'Switch to a different workspace',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the workspace to switch to'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'scan_workspaces',
        description: 'Scan the system for Lokus workspaces',
        inputSchema: {
          type: 'object',
          properties: {},
        }
      }
    ];
  }

  /**
   * Execute a file tool
   */
  async executeTool(toolName, args) {
    try {
      let result;
      
      switch (toolName) {
        case 'read_file':
          result = await this.readFile(args);
          break;
        case 'write_file':
          result = await this.writeFile(args);
          break;
        case 'list_files':
          result = await this.listFiles(args);
          break;
        case 'search_files':
          result = await this.searchFiles(args);
          break;
        case 'create_note':
          result = await this.createNote(args);
          break;
        case 'get_file_metadata':
          result = await this.getFileMetadata(args);
          break;
        case 'list_workspaces':
          result = await this.listWorkspaces(args);
          break;
        case 'get_current_workspace':
          result = await this.getCurrentWorkspace(args);
          break;
        case 'set_workspace':
          result = await this.setWorkspace(args);
          break;
        case 'scan_workspaces':
          result = await this.scanWorkspaces(args);
          break;
        default:
          throw new Error(`Unknown file tool: ${toolName}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`File tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Read a file
   */
  async readFile(args) {
    try {
      const resolvedPath = await this.resolvePath(args.path);
      await this.validateFileAccess(resolvedPath, 'read');
      
      const content = await readFile(resolvedPath, 'utf-8');
      
      return {
        content: [{
          type: 'text',
          text: content
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading file: ${error.message}`
        }]
      };
    }
  }

  /**
   * Write a file
   */
  async writeFile(args) {
    try {
      const resolvedPath = await this.resolvePath(args.path);
      await this.validateFileAccess(resolvedPath, 'write');
      
      // Validate content size
      if (Buffer.byteLength(args.content, 'utf-8') > this.options.maxFileSize) {
        throw new Error('File content exceeds maximum size limit');
      }
      
      // Create directories if needed
      if (args.createDirectories !== false) {
        await mkdir(dirname(resolvedPath), { recursive: true });
      }
      
      await writeFile(resolvedPath, args.content, 'utf-8');
      
      // Get file stats
      const stats = await stat(resolvedPath);
      const relativePath = relative(this.workspacePath, resolvedPath);
      
      this.emit('fileWritten', {
        path: relativePath,
        size: stats.size
      });
      
      return {
        content: [{
          type: 'text',
          text: `File written successfully: ${relativePath}\nSize: ${this.formatFileSize(stats.size)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error writing file: ${error.message}`
        }]
      };
    }
  }

  /**
   * List files and directories
   */
  async listFiles(args) {
    try {
      let targetPath;
      if (args.path) {
        targetPath = await this.resolvePath(args.path);
      } else {
        targetPath = this.workspacePath;
      }
      
      await this.validateFileAccess(targetPath, 'read');
      
      const files = await this.listDirectory(targetPath, args.recursive, args.includeHidden);
      const fileList = JSON.stringify(files, null, 2);
      
      return {
        content: [{
          type: 'text',
          text: `Files in ${relative(this.workspacePath, targetPath) || 'workspace root'}:\n\n${fileList}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing files: ${error.message}`
        }]
      };
    }
  }

  /**
   * Search files for content
   */
  async searchFiles(args) {
    try {
      let searchPath;
      if (args.path) {
        searchPath = await this.resolvePath(args.path);
      } else {
        searchPath = this.workspacePath;
      }
      
      await this.validateFileAccess(searchPath, 'read');
      
      const searchOptions = {
        caseSensitive: args.caseSensitive || false,
        wholeWord: args.wholeWord || false,
        regex: args.regex || false,
        fileTypes: args.fileTypes || ['md', 'txt'],
        maxResults: Math.min(args.maxResults || 100, this.options.maxSearchResults)
      };
      
      const results = await this.performSearch(args.query, searchPath, searchOptions);
      
      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No results found for "${args.query}" in ${relative(this.workspacePath, searchPath) || 'workspace'}`
          }]
        };
      }

      // Format search results
      const relativePath = relative(this.workspacePath, searchPath) || 'workspace';
      let output = `Search results for "${args.query}" in ${relativePath}:\n\n`;
      
      for (const result of results) {
        output += `📄 **${result.fileName}** (${result.matchCount} matches)\n`;
        output += `   Path: ${result.relativePath}\n\n`;
        
        for (const match of result.matches.slice(0, 3)) { // Show first 3 matches per file
          output += `   Line ${match.line}: ${match.text}\n`;
          if (match.context && match.context.length > 0) {
            output += `   Context:\n`;
            for (const ctx of match.context) {
              const marker = ctx.isMatch ? '→ ' : '  ';
              output += `     ${marker}${ctx.lineNumber}: ${ctx.text}\n`;
            }
          }
          output += '\n';
        }
        
        if (result.matches.length > 3) {
          output += `   ... and ${result.matches.length - 3} more matches\n`;
        }
        output += '\n';
      }
      
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching files: ${error.message}`
        }]
      };
    }
  }

  /**
   * Create a note
   */
  async createNote(args) {
    try {
      // Ensure name has .md extension
      let fileName = args.name;
      if (!fileName.endsWith('.md')) {
        fileName += '.md';
      }

      // Create file path
      let notePath;
      if (args.path) {
        const subDirPath = await this.resolvePath(args.path);
        notePath = join(subDirPath, fileName);
      } else {
        notePath = join(this.workspacePath, fileName);
      }

      // Check if note already exists
      try {
        await stat(notePath);
        throw new Error(`Note already exists: ${relative(this.workspacePath, notePath)}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Create directory if needed
      await mkdir(dirname(notePath), { recursive: true });

      // Use provided content or create basic note template
      const content = args.content || this.createBasicNoteContent(args.name);
      
      // Validate content size
      if (Buffer.byteLength(content, 'utf-8') > this.options.maxFileSize) {
        throw new Error('Note content exceeds maximum size limit');
      }

      // Write note file
      await writeFile(notePath, content, 'utf-8');

      // Get file stats
      const stats = await stat(notePath);
      const relativePath = relative(this.workspacePath, notePath);

      this.emit('noteCreated', {
        path: relativePath,
        name: args.name,
        size: stats.size
      });

      return {
        content: [{
          type: 'text',
          text: `Note created successfully: ${relativePath}\nSize: ${this.formatFileSize(stats.size)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating note: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(args) {
    try {
      const resolvedPath = await this.resolvePath(args.path);
      await this.validateFileAccess(resolvedPath, 'read');
      
      const stats = await stat(resolvedPath);
      const relativePath = relative(this.workspacePath, resolvedPath);
      
      let content = `File metadata for: ${relativePath}\n\n`;
      content += `- Exists: Yes\n`;
      content += `- Size: ${this.formatFileSize(stats.size)} (${stats.size} bytes)\n`;
      content += `- Type: ${stats.isDirectory() ? 'Directory' : 'File'}\n`;
      content += `- Created: ${stats.birthtime.toISOString()}\n`;
      content += `- Modified: ${stats.mtime.toISOString()}\n`;
      content += `- Accessed: ${stats.atime.toISOString()}\n`;
      
      if (stats.isFile()) {
        const ext = extname(resolvedPath).toLowerCase();
        const fileType = this.getFileType(ext);
        content += `- File Type: ${fileType}\n`;
        
        if (this.isTextFile(ext)) {
          try {
            const fileContent = await readFile(resolvedPath, 'utf-8');
            const lines = fileContent.split('\n').length;
            const words = fileContent.trim().split(/\s+/).filter(w => w.length > 0).length;
            content += `- Lines: ${lines}\n`;
            content += `- Words: ${words}\n`;
          } catch (error) {
            content += `- Text analysis: Failed (${error.message})\n`;
          }
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: content
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error getting file metadata: ${error.message}`
        }]
      };
    }
  }

  /**
   * Utility methods
   */

  async resolvePath(inputPath) {
    if (!inputPath) {
      throw new Error('Path is required');
    }

    // If path is already absolute, return as-is
    if (isAbsolute(inputPath)) {
      return resolve(inputPath);
    }

    // Join with workspace path for relative paths
    return resolve(join(this.workspacePath, inputPath));
  }

  async validateFileAccess(filePath, operation) {
    // Ensure path is within workspace or explicitly allowed
    const resolvedPath = resolve(filePath);
    const resolvedWorkspace = resolve(this.workspacePath);
    
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error(`Access denied: Path is outside workspace (${relative(resolvedWorkspace, resolvedPath)})`);
    }

    // Check file extension for write operations
    if (operation === 'write') {
      const ext = extname(resolvedPath).toLowerCase();
      if (ext && !this.options.allowedExtensions.includes(ext)) {
        throw new Error(`File extension not allowed: ${ext}`);
      }
    }

    return true;
  }

  async listDirectory(dirPath, recursive = false, includeHidden = false) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      // Skip hidden files/directories unless requested
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(this.workspacePath, fullPath);
      
      const item = {
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory()
      };

      if (entry.isFile()) {
        try {
          const stats = await stat(fullPath);
          item.size = stats.size;
          item.sizeFormatted = this.formatFileSize(stats.size);
          item.modified = stats.mtime.toISOString();
        } catch (error) {
          // Continue if we can't get stats
        }
      }

      if (recursive && entry.isDirectory()) {
        try {
          item.children = await this.listDirectory(fullPath, true, includeHidden);
        } catch (error) {
          // Continue if we can't read subdirectory
          item.error = error.message;
        }
      }

      results.push(item);
    }

    return results.sort((a, b) => {
      // Directories first, then files, both alphabetically
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async performSearch(query, searchPath, options) {
    const results = [];
    const searchRegex = this.createSearchRegex(query, options);
    
    async function searchInDirectory(dirPath) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // Recursively search subdirectories
            await searchInDirectory(fullPath);
          } else if (entry.isFile()) {
            // Check if file type should be searched
            const ext = extname(entry.name).slice(1).toLowerCase(); // Remove the dot
            if (options.fileTypes.includes(ext)) {
              await searchInFile(fullPath);
            }
          }
        }
      } catch (error) {
        // Continue searching other directories if one fails
      }
    }

    async function searchInFile(filePath) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const matches = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = searchRegex.exec(line);
          
          if (match) {
            matches.push({
              line: i + 1,
              text: line.trim(),
              context: [] // Could add context lines here if needed
            });
          }
          
          // Reset regex lastIndex for global searches
          if (searchRegex.global) {
            searchRegex.lastIndex = 0;
          }
        }
        
        if (matches.length > 0) {
          const relativePath = relative(searchPath, filePath);
          results.push({
            file: filePath,
            fileName: basename(filePath),
            relativePath,
            matchCount: matches.length,
            matches
          });
        }
      } catch (error) {
        // Continue if we can't read the file
      }
    }

    await searchInDirectory(searchPath);
    
    return results.slice(0, options.maxResults);
  }

  createSearchRegex(query, options) {
    let pattern = query;
    
    // Escape regex special characters if not using regex mode
    if (!options.regex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Add word boundaries for whole word search
    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }
    
    const flags = options.caseSensitive ? 'g' : 'gi';
    
    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      // Fall back to literal search if regex is invalid
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escapedQuery, flags);
    }
  }

  createBasicNoteContent(title) {
    const now = new Date().toISOString().split('T')[0];
    return `---
title: "${title}"
created: ${now}
---

# ${title}

## Overview

<!-- Add your content here -->

## Notes

- `;
  }

  getFileType(extension) {
    const types = {
      '.md': 'Markdown',
      '.txt': 'Text',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.html': 'HTML',
      '.css': 'CSS',
      '.xml': 'XML'
    };
    
    return types[extension] || 'Unknown';
  }

  isTextFile(extension) {
    const textExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.js', '.ts', '.html', '.css', '.xml'];
    return textExtensions.includes(extension);
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * List all available workspaces
   */
  async listWorkspaces(args) {
    try {
      const workspaces = await this.workspaceManager.getWorkspaces();
      const current = await this.workspaceManager.getCurrentWorkspace();
      
      return {
        content: [{
          type: 'text',
          text: `# Available Lokus Workspaces\n\n**Current workspace:** ${current || 'None'}\n\n**All workspaces:**\n${workspaces.map((w, i) => 
            `${i + 1}. **${w.name}** ${w.path === current ? '(current)' : ''}\n   Path: ${w.path}\n   Last accessed: ${new Date(w.lastAccessed).toLocaleString()}`
          ).join('\n\n')}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing workspaces: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get current workspace info
   */
  async getCurrentWorkspace(args) {
    try {
      const current = await this.workspaceManager.getCurrentWorkspace();
      
      if (!current) {
        return {
          content: [{
            type: 'text',
            text: 'No current workspace set. Use `list_workspaces` to see available workspaces or `scan_workspaces` to find them.'
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `# Current Workspace\n\n**Path:** ${current}\n**Name:** ${current.split('/').pop()}\n**Status:** Active`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error getting current workspace: ${error.message}`
        }]
      };
    }
  }

  /**
   * Switch to a different workspace
   */
  async setWorkspace(args) {
    try {
      const { path } = args;
      
      if (!path) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Workspace path is required'
          }]
        };
      }

      const success = await this.workspaceManager.setCurrentWorkspace(path);
      
      if (success) {
        // Update our current workspace path
        this.workspacePath = path;
        
        return {
          content: [{
            type: 'text',
            text: `✅ **Successfully switched to workspace**\n\nPath: ${path}\nName: ${path.split('/').pop()}\n\nAll future file operations will use this workspace.`
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `❌ **Failed to switch workspace**\n\nThe path '${path}' is not a valid workspace. Please check:\n- The directory exists\n- You have read/write permissions\n- It's a valid Lokus workspace or can be initialized as one`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error switching workspace: ${error.message}`
        }]
      };
    }
  }

  /**
   * Scan system for Lokus workspaces
   */
  async scanWorkspaces(args) {
    try {
      const foundWorkspaces = await this.workspaceManager.scanForWorkspaces();
      
      if (foundWorkspaces.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No Lokus workspaces found on the system. You can create a new workspace by:\n1. Creating a folder\n2. Opening it in Lokus\n3. Or using the `write_file` tool to create files in a directory'
          }]
        };
      }

      // Add found workspaces to tracking
      const state = await this.workspaceManager.readWorkspaceState() || { workspaces: [], current: null };
      
      for (const workspace of foundWorkspaces) {
        const exists = state.workspaces.some(w => w.path === workspace.path);
        if (!exists) {
          state.workspaces.push(workspace);
        }
      }
      
      // Set first workspace as current if none is set
      if (!state.current && foundWorkspaces.length > 0) {
        state.current = foundWorkspaces[0].path;
        this.workspacePath = foundWorkspaces[0].path;
      }
      
      await this.workspaceManager.writeWorkspaceState(state);

      return {
        content: [{
          type: 'text',
          text: `# Workspace Scan Results\n\n**Found ${foundWorkspaces.length} workspace(s):**\n\n${foundWorkspaces.map((w, i) => 
            `${i + 1}. **${w.name}**\n   Path: ${w.path}`
          ).join('\n\n')}\n\n${foundWorkspaces.length > 0 ? 'These workspaces have been added to your available list.' : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error scanning for workspaces: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get file tool statistics
   */
  getStats() {
    return {
      workspacePath: this.workspacePath,
      maxFileSize: this.options.maxFileSize,
      allowedExtensions: this.options.allowedExtensions,
      maxSearchResults: this.options.maxSearchResults
    };
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.removeAllListeners();
    this.logger.info('FileTools disposed');
  }
}

export default FileTools;