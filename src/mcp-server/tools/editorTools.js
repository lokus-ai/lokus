/**
 * Editor Tools for Lokus MCP Server
 * 
 * Provides comprehensive editor tools that work with markdown file content
 * instead of DOM manipulation. Designed to work in Node.js stdio server environment.
 */

import { readFile, writeFile, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { WorkspaceManager } from '../../core/workspace/manager.js';
import { EventEmitter } from 'events';

export class EditorTools extends EventEmitter {
  constructor(noteProvider, fileProvider, options = {}) {
    super();
    
    this.noteProvider = noteProvider;
    this.fileProvider = fileProvider;
    this.options = {
      defaultExtension: options.defaultExtension || '.md',
      createBackup: options.createBackup !== false,
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB
      autoSave: options.autoSave !== false,
      ...options
    };
    
    this.workspacePath = null;
    this.operationHistory = [];
    this.maxHistorySize = 100;
    this.logger = options.logger || console;
  }

  /**
   * Initialize editor tools
   */
  async initialize() {
    try {
      this.workspacePath = await WorkspaceManager.getValidatedWorkspacePath();
      
      if (!this.workspacePath) {
        throw new Error('No valid workspace path found');
      }
      
      this.logger.info('EditorTools initialized', {
        workspacePath: this.workspacePath,
        autoSave: this.options.autoSave
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize EditorTools:', error);
      throw error;
    }
  }

  /**
   * Get available editor tools
   */
  getTools() {
    return [
      {
        name: "format_text",
        description: "Apply markdown text formatting (bold, italic, strikethrough, highlight, superscript, subscript, code) to content in a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            format: {
              type: "string",
              enum: ["bold", "italic", "strikethrough", "highlight", "superscript", "subscript", "code", "clear"],
              description: "The formatting to apply"
            },
            text: {
              type: "string",
              description: "Text to format and insert (if not provided, formats selection or word at cursor)"
            },
            searchText: {
              type: "string",
              description: "Specific text to find and format in the file"
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "replace", "cursor"],
              description: "Where to insert formatted text",
              default: "append"
            }
          },
          required: ["filePath", "format"]
        }
      },
      {
        name: "insert_link",
        description: "Insert wiki links [[page]] or regular markdown links into a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            type: {
              type: "string",
              enum: ["wiki", "regular"],
              description: "Type of link to insert"
            },
            target: {
              type: "string",
              description: "Wiki page name or URL target"
            },
            text: {
              type: "string",
              description: "Display text for the link (optional, uses target if not provided)"
            },
            embed: {
              type: "boolean",
              description: "Whether to embed the wiki link as an image (for image files)",
              default: false
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the link",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath", "type", "target"]
        }
      },
      {
        name: "insert_math",
        description: "Insert KaTeX math equations (inline $ or block $$) into a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            formula: {
              type: "string",
              description: "LaTeX formula to insert"
            },
            display: {
              type: "string",
              enum: ["inline", "block"],
              description: "Display mode for the math equation",
              default: "inline"
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the math",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath", "formula"]
        }
      },
      {
        name: "insert_table",
        description: "Insert and manipulate markdown tables in a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            action: {
              type: "string",
              enum: ["create"],
              description: "Table action to perform",
              default: "create"
            },
            rows: {
              type: "number",
              description: "Number of rows for table creation",
              default: 3
            },
            cols: {
              type: "number", 
              description: "Number of columns for table creation",
              default: 3
            },
            headers: {
              type: "array",
              items: { type: "string" },
              description: "Column headers for the table"
            },
            data: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" }
              },
              description: "Table data as array of rows"
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the table",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath"]
        }
      },
      {
        name: "insert_code_block",
        description: "Insert markdown code blocks with syntax highlighting into a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            code: {
              type: "string",
              description: "Code content to insert"
            },
            language: {
              type: "string",
              description: "Programming language for syntax highlighting",
              default: ""
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the code block",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath", "code"]
        }
      },
      {
        name: "create_task_list",
        description: "Create markdown checkbox task lists in a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description: "Task text"
                  },
                  checked: {
                    type: "boolean",
                    description: "Whether task is checked",
                    default: false
                  }
                },
                required: ["text"]
              },
              description: "Array of tasks to create"
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the task list",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath", "tasks"]
        }
      },
      {
        name: "insert_heading",
        description: "Insert markdown headings into a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            text: {
              type: "string",
              description: "Heading text"
            },
            level: {
              type: "number",
              description: "Heading level (1-6)",
              minimum: 1,
              maximum: 6,
              default: 2
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the heading",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath", "text"]
        }
      },
      {
        name: "insert_list",
        description: "Insert markdown lists (bulleted or numbered) into a note file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            items: {
              type: "array",
              items: { type: "string" },
              description: "List items to insert"
            },
            listType: {
              type: "string",
              enum: ["bulleted", "numbered"],
              description: "Type of list to create",
              default: "bulleted"
            },
            insertPosition: {
              type: "string",
              enum: ["append", "prepend", "section"],
              description: "Where to insert the list",
              default: "append"
            },
            sectionTitle: {
              type: "string",
              description: "Section title to insert under (if insertPosition is 'section')"
            }
          },
          required: ["filePath", "items"]
        }
      },
      {
        name: "get_file_content",
        description: "Get the current content of a note file with metadata",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to read"
            },
            includeStats: {
              type: "boolean",
              description: "Include file statistics (word count, character count, etc.)",
              default: true
            }
          },
          required: ["filePath"]
        }
      },
      {
        name: "replace_content",
        description: "Replace specific content in a note file with new content",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the note file to modify"
            },
            searchText: {
              type: "string",
              description: "Text to search for and replace"
            },
            replaceText: {
              type: "string",
              description: "New text to replace with"
            },
            replaceAll: {
              type: "boolean",
              description: "Replace all occurrences (default: first occurrence only)",
              default: false
            }
          },
          required: ["filePath", "searchText", "replaceText"]
        }
      }
    ];
  }

  /**
   * Execute an editor tool
   */
  async executeTool(toolName, args) {
    try {
      let result;
      
      switch (toolName) {
        case 'format_text':
          result = await this.formatText(args);
          break;
        case 'insert_link':
          result = await this.insertLink(args);
          break;
        case 'insert_math':
          result = await this.insertMath(args);
          break;
        case 'insert_table':
          result = await this.insertTable(args);
          break;
        case 'insert_code_block':
          result = await this.insertCodeBlock(args);
          break;
        case 'create_task_list':
          result = await this.createTaskList(args);
          break;
        case 'insert_heading':
          result = await this.insertHeading(args);
          break;
        case 'insert_list':
          result = await this.insertList(args);
          break;
        case 'get_file_content':
          result = await this.getFileContent(args);
          break;
        case 'replace_content':
          result = await this.replaceContent(args);
          break;
        default:
          throw new Error(`Unknown editor tool: ${toolName}`);
      }
      
      // Record operation in history
      this.recordOperation(toolName, args, result, 'success');
      
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
      
    } catch (error) {
      this.recordOperation(toolName, args, null, 'error', error.message);
      this.logger.error(`Editor tool ${toolName} failed:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }]
      };
    }
  }

  /**
   * Format text with markdown syntax
   */
  async formatText(args) {
    const { filePath, format, text, searchText, insertPosition = 'append' } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    let formattedText = text || '';
    
    // Apply formatting
    switch (format) {
      case 'bold':
        formattedText = `**${formattedText}**`;
        break;
      case 'italic':
        formattedText = `*${formattedText}*`;
        break;
      case 'strikethrough':
        formattedText = `~~${formattedText}~~`;
        break;
      case 'highlight':
        formattedText = `==${formattedText}==`;
        break;
      case 'superscript':
        formattedText = `^${formattedText}^`;
        break;
      case 'subscript':
        formattedText = `~${formattedText}~`;
        break;
      case 'code':
        formattedText = `\`${formattedText}\``;
        break;
      case 'clear':
        // Remove formatting from text
        formattedText = formattedText
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/~~([^~]+)~~/g, '$1')
          .replace(/==([^=]+)==/g, '$1')
          .replace(/\^([^^]+)\^/g, '$1')
          .replace(/~([^~]+)~/g, '$1')
          .replace(/`([^`]+)`/g, '$1');
        break;
      default:
        throw new Error(`Unknown format: ${format}`);
    }
    
    let newContent;
    
    if (searchText) {
      // Replace specific text in the file
      if (format === 'clear') {
        newContent = content.replace(searchText, formattedText);
      } else {
        // Wrap the found text with formatting
        const replacement = formattedText.replace(text || '', searchText);
        newContent = content.replace(searchText, replacement);
      }
    } else {
      // Insert formatted text at specified position
      newContent = this.insertAtPosition(content, formattedText, insertPosition);
    }
    
    await this.writeFileContent(fullPath, newContent);
    
    const message = searchText 
      ? `Applied ${format} formatting to "${searchText}" in ${filePath}`
      : `Applied ${format} formatting and inserted into ${filePath}`;
    
    return {
      success: true,
      message,
      filePath,
      format,
      formattedText
    };
  }

  /**
   * Insert links (wiki or regular)
   */
  async insertLink(args) {
    const { 
      filePath, 
      type, 
      target, 
      text, 
      embed = false, 
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    let linkText;
    
    if (type === 'wiki') {
      const linkContent = text ? `${target}|${text}` : target;
      linkText = embed ? `![[${linkContent}]]` : `[[${linkContent}]]`;
    } else if (type === 'regular') {
      const displayText = text || target;
      linkText = `[${displayText}](${target})`;
    } else {
      throw new Error(`Unknown link type: ${type}`);
    }
    
    const newContent = this.insertAtPosition(
      content, 
      linkText, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Inserted ${type} link to "${target}" in ${filePath}`,
      filePath,
      linkType: type,
      linkText,
      embed
    };
  }

  /**
   * Insert math equations
   */
  async insertMath(args) {
    const { 
      filePath, 
      formula, 
      display = 'inline', 
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    const mathText = display === 'block' 
      ? `$$${formula}$$`
      : `$${formula}$`;
    
    const newContent = this.insertAtPosition(
      content, 
      mathText, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Inserted ${display} math equation in ${filePath}`,
      filePath,
      formula,
      display,
      mathText
    };
  }

  /**
   * Insert or create tables
   */
  async insertTable(args) {
    const { 
      filePath, 
      rows = 3, 
      cols = 3, 
      headers, 
      data,
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    let tableMarkdown = this.createMarkdownTable(rows, cols, headers, data);
    
    const newContent = this.insertAtPosition(
      content, 
      tableMarkdown, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Inserted ${rows}x${cols} table in ${filePath}`,
      filePath,
      rows,
      cols,
      tableMarkdown
    };
  }

  /**
   * Insert code blocks
   */
  async insertCodeBlock(args) {
    const { 
      filePath, 
      code, 
      language = '', 
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    const codeBlock = `\`\`\`${language}\n${code}\n\`\`\``;
    
    const newContent = this.insertAtPosition(
      content, 
      codeBlock, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Inserted code block${language ? ` with ${language} syntax` : ''} in ${filePath}`,
      filePath,
      language,
      codeBlock
    };
  }

  /**
   * Create task lists
   */
  async createTaskList(args) {
    const { 
      filePath, 
      tasks, 
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    const taskListMarkdown = tasks.map(task => 
      `- [${task.checked ? 'x' : ' '}] ${task.text}`
    ).join('\n');
    
    const newContent = this.insertAtPosition(
      content, 
      taskListMarkdown, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Created task list with ${tasks.length} tasks in ${filePath}`,
      filePath,
      taskCount: tasks.length,
      taskListMarkdown
    };
  }

  /**
   * Insert headings
   */
  async insertHeading(args) {
    const { 
      filePath, 
      text, 
      level = 2, 
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    const headingText = `${'#'.repeat(level)} ${text}`;
    
    const newContent = this.insertAtPosition(
      content, 
      headingText, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Inserted level ${level} heading "${text}" in ${filePath}`,
      filePath,
      text,
      level,
      headingText
    };
  }

  /**
   * Insert lists
   */
  async insertList(args) {
    const { 
      filePath, 
      items, 
      listType = 'bulleted', 
      insertPosition = 'append',
      sectionTitle
    } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    let listMarkdown;
    if (listType === 'numbered') {
      listMarkdown = items.map((item, index) => `${index + 1}. ${item}`).join('\n');
    } else {
      listMarkdown = items.map(item => `- ${item}`).join('\n');
    }
    
    const newContent = this.insertAtPosition(
      content, 
      listMarkdown, 
      insertPosition, 
      sectionTitle
    );
    
    await this.writeFileContent(fullPath, newContent);
    
    return {
      success: true,
      message: `Inserted ${listType} list with ${items.length} items in ${filePath}`,
      filePath,
      listType,
      itemCount: items.length,
      listMarkdown
    };
  }

  /**
   * Get file content with stats
   */
  async getFileContent(args) {
    const { filePath, includeStats = true } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    let stats = null;
    if (includeStats) {
      stats = await this.calculateFileStats(content, fullPath);
    }
    
    return {
      filePath,
      content,
      stats
    };
  }

  /**
   * Replace content in file
   */
  async replaceContent(args) {
    const { filePath, searchText, replaceText, replaceAll = false } = args;
    
    const fullPath = await this.getFullPath(filePath);
    const content = await this.readFileContent(fullPath);
    
    let newContent;
    let replacementCount = 0;
    
    if (replaceAll) {
      const regex = new RegExp(this.escapeRegExp(searchText), 'g');
      newContent = content.replace(regex, (match) => {
        replacementCount++;
        return replaceText;
      });
    } else {
      const index = content.indexOf(searchText);
      if (index !== -1) {
        newContent = content.substring(0, index) + replaceText + content.substring(index + searchText.length);
        replacementCount = 1;
      } else {
        newContent = content;
      }
    }
    
    if (replacementCount > 0) {
      await this.writeFileContent(fullPath, newContent);
    }
    
    return {
      success: true,
      message: `Replaced ${replacementCount} occurrence(s) of "${searchText}" in ${filePath}`,
      filePath,
      searchText,
      replaceText,
      replacementCount
    };
  }

  /**
   * Utility methods
   */

  async getFullPath(filePath) {
    if (!this.workspacePath) {
      throw new Error('Workspace not initialized');
    }
    
    return join(this.workspacePath, filePath);
  }

  async readFileContent(fullPath) {
    try {
      await stat(fullPath);
      return await readFile(fullPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${fullPath}`);
      }
      throw error;
    }
  }

  async writeFileContent(fullPath, content) {
    // Validate content size
    if (Buffer.byteLength(content, 'utf-8') > this.options.maxFileSize) {
      throw new Error('Content exceeds maximum file size limit');
    }
    
    // Create backup if enabled
    if (this.options.createBackup) {
      try {
        const existingContent = await readFile(fullPath, 'utf-8');
        const backupPath = `${fullPath}.backup-${Date.now()}`;
        await writeFile(backupPath, existingContent, 'utf-8');
      } catch (error) {
        // Ignore backup errors for new files
      }
    }
    
    await writeFile(fullPath, content, 'utf-8');
  }

  insertAtPosition(content, insertText, position, sectionTitle = null) {
    switch (position) {
      case 'prepend':
        return insertText + '\n\n' + content;
        
      case 'append':
        return content + '\n\n' + insertText;
        
      case 'section':
        if (!sectionTitle) {
          throw new Error('Section title required for section insertion');
        }
        return this.insertInSection(content, insertText, sectionTitle);
        
      default:
        return content + '\n\n' + insertText;
    }
  }

  insertInSection(content, insertText, sectionTitle) {
    const sectionRegex = new RegExp(`^(#{1,6})\\s+${this.escapeRegExp(sectionTitle)}\\s*$`, 'mi');
    const match = sectionRegex.exec(content);
    
    if (!match) {
      // Section not found, append at end
      return content + '\n\n' + insertText;
    }
    
    // Find the end of this section
    const sectionLevel = match[1].length;
    const afterSectionStart = match.index + match[0].length;
    
    // Look for next heading of same or higher level
    const nextSectionRegex = new RegExp(`^#{1,${sectionLevel}}\\s+`, 'gm');
    nextSectionRegex.lastIndex = afterSectionStart;
    const nextMatch = nextSectionRegex.exec(content);
    
    const insertPosition = nextMatch ? nextMatch.index : content.length;
    
    return content.slice(0, insertPosition) + '\n\n' + insertText + '\n' + content.slice(insertPosition);
  }

  createMarkdownTable(rows, cols, headers, data) {
    let table = '';
    
    // Create headers
    if (headers && headers.length > 0) {
      table += '| ' + headers.slice(0, cols).join(' | ') + ' |\n';
      table += '|' + ' --- |'.repeat(Math.min(headers.length, cols)) + '\n';
    } else {
      table += '| ' + Array.from({length: cols}, (_, i) => `Header ${i + 1}`).join(' | ') + ' |\n';
      table += '|' + ' --- |'.repeat(cols) + '\n';
    }
    
    // Create data rows
    const dataRows = data && data.length > 0 ? data : Array.from({length: rows - 1}, () => Array(cols).fill(' '));
    
    for (let i = 0; i < Math.min(dataRows.length, rows - 1); i++) {
      const row = dataRows[i].slice(0, cols);
      while (row.length < cols) {
        row.push(' ');
      }
      table += '| ' + row.join(' | ') + ' |\n';
    }
    
    return table.trim();
  }

  async calculateFileStats(content, fullPath) {
    const text = this.removeMarkdownFormatting(content);
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    
    try {
      const stats = await stat(fullPath);
      return {
        characterCount: content.length,
        characterCountNoSpaces: content.replace(/\s/g, '').length,
        wordCount: words.length,
        lineCount: content.split('\n').length,
        paragraphCount: content.split(/\n\s*\n/).filter(p => p.trim()).length,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        readingTime: Math.ceil(words.length / 225) // 225 words per minute
      };
    } catch (error) {
      return {
        characterCount: content.length,
        characterCountNoSpaces: content.replace(/\s/g, '').length,
        wordCount: words.length,
        lineCount: content.split('\n').length,
        paragraphCount: content.split(/\n\s*\n/).filter(p => p.trim()).length,
        readingTime: Math.ceil(words.length / 225)
      };
    }
  }

  removeMarkdownFormatting(content) {
    return content
      .replace(/^#{1,6}\s+/gm, '') // Remove headings
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
      .replace(/==([^=]+)==/g, '$1') // Remove highlights
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove wiki links
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/^\s*- \[[ x]\]\s+/gm, '') // Remove task list markers
      .trim();
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  recordOperation(operation, args, result, status, error = null) {
    const entry = {
      operation,
      args: { ...args },
      result: status === 'success' ? { success: result?.success, filePath: args.filePath } : null,
      status,
      error,
      timestamp: new Date().toISOString()
    };
    
    this.operationHistory.push(entry);
    
    // Trim history if too large
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }
  }

  /**
   * Get editor tool statistics
   */
  getStats() {
    const operationCounts = {};
    for (const entry of this.operationHistory) {
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
    }
    
    return {
      workspacePath: this.workspacePath,
      totalOperations: this.operationHistory.length,
      operationCounts,
      autoSave: this.options.autoSave,
      maxFileSize: this.options.maxFileSize
    };
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.operationHistory = [];
    this.removeAllListeners();
    
    this.logger.info('EditorTools disposed');
  }
}

export default EditorTools;