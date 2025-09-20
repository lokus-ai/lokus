/**
 * Note Tools for Lokus MCP Server
 * 
 * Provides comprehensive note creation, editing, and management tools
 * with WikiLink support, template handling, and intelligent content generation.
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { WorkspaceManager } from '../../core/workspace/manager.js';
import { taskManager } from '../../core/tasks/manager.js';
import { EventEmitter } from 'events';

export class NoteTools extends EventEmitter {
  constructor(noteProvider, fileProvider, options = {}) {
    super();
    
    this.noteProvider = noteProvider;
    this.fileProvider = fileProvider;
    this.options = {
      defaultExtension: options.defaultExtension || '.md',
      templateDirectory: options.templateDirectory || 'templates',
      autoLinkResolution: options.autoLinkResolution !== false,
      generateFrontmatter: options.generateFrontmatter !== false,
      autoCreateDirectories: options.autoCreateDirectories !== false,
      backupOnEdit: options.backupOnEdit !== false,
      validateWikiLinks: options.validateWikiLinks !== false,
      maxNoteSize: options.maxNoteSize || 1024 * 1024, // 1MB
      ...options
    };
    
    this.workspacePath = null;
    this.operationHistory = [];
    this.maxHistorySize = 100;
    
    // Built-in templates
    this.builtInTemplates = {
      basic: {
        name: 'Basic Note',
        description: 'Simple note with title and content sections',
        content: this.getBasicTemplate()
      },
      daily: {
        name: 'Daily Note',
        description: 'Daily journal template with tasks and reflections',
        content: this.getDailyTemplate()
      },
      meeting: {
        name: 'Meeting Notes',
        description: 'Meeting notes with attendees, agenda, and action items',
        content: this.getMeetingTemplate()
      },
      project: {
        name: 'Project Plan',
        description: 'Project planning template with objectives and timeline',
        content: this.getProjectTemplate()
      },
      research: {
        name: 'Research Note',
        description: 'Research note with sources, questions, and findings',
        content: this.getResearchTemplate()
      },
      review: {
        name: 'Book/Article Review',
        description: 'Review template for books, articles, or resources',
        content: this.getReviewTemplate()
      }
    };
    
    this.logger = options.logger || console;
  }

  /**
   * Initialize note tools
   */
  async initialize() {
    try {
      this.workspacePath = await WorkspaceManager.getValidatedWorkspacePath();
      
      if (!this.workspacePath) {
        throw new Error('No valid workspace path found');
      }
      
      this.logger.info('NoteTools initialized', {
        workspacePath: this.workspacePath,
        autoLinkResolution: this.options.autoLinkResolution,
        templateCount: Object.keys(this.builtInTemplates).length
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize NoteTools:', error);
      throw error;
    }
  }

  /**
   * Get available note tools
   */
  getTools() {
    return [
      {
        name: 'create_note',
        description: 'Create a new note with optional template and content',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title for the new note'
            },
            path: {
              type: 'string',
              description: 'Optional custom path for the note (relative to workspace)'
            },
            template: {
              type: 'string',
              description: 'Template to use for the note',
              enum: ['basic', 'daily', 'meeting', 'project', 'research', 'review', 'empty'],
              default: 'basic'
            },
            content: {
              type: 'string',
              description: 'Initial content for the note (overrides template if provided)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to add to the note'
            },
            frontmatter: {
              type: 'object',
              description: 'Additional frontmatter metadata'
            },
            createDirectory: {
              type: 'boolean',
              description: 'Create parent directories if they do not exist',
              default: true
            }
          },
          required: ['title']
        }
      },
      {
        name: 'update_note',
        description: 'Update an existing note with new content or metadata',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note to update'
            },
            content: {
              type: 'string',
              description: 'New content for the note'
            },
            appendContent: {
              type: 'string',
              description: 'Content to append to the existing note'
            },
            prependContent: {
              type: 'string',
              description: 'Content to prepend to the existing note'
            },
            updateFrontmatter: {
              type: 'object',
              description: 'Frontmatter fields to update'
            },
            addTags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to add to the note'
            },
            removeTags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to remove from the note'
            },
            createBackup: {
              type: 'boolean',
              description: 'Create backup before updating',
              default: true
            }
          },
          required: ['path']
        }
      },
      {
        name: 'link_notes',
        description: 'Create WikiLinks between notes',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: {
              type: 'string',
              description: 'Path to the source note'
            },
            targetPath: {
              type: 'string',
              description: 'Path to the target note'
            },
            linkText: {
              type: 'string',
              description: 'Custom text for the link (uses filename if not provided)'
            },
            alias: {
              type: 'string',
              description: 'Alias for the WikiLink'
            },
            insertLocation: {
              type: 'string',
              description: 'Where to insert the link',
              enum: ['end', 'beginning', 'cursor', 'section'],
              default: 'end'
            },
            sectionTitle: {
              type: 'string',
              description: 'Section title to insert under (if insertLocation is "section")'
            },
            createTargetIfMissing: {
              type: 'boolean',
              description: 'Create target note if it does not exist',
              default: false
            }
          },
          required: ['sourcePath', 'targetPath']
        }
      },
      {
        name: 'resolve_wikilinks',
        description: 'Resolve and fix broken WikiLinks in a note',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note to process'
            },
            autoCreate: {
              type: 'boolean',
              description: 'Automatically create missing target notes',
              default: false
            },
            suggestAlternatives: {
              type: 'boolean',
              description: 'Suggest alternative targets for broken links',
              default: true
            }
          },
          required: ['path']
        }
      },
      {
        name: 'extract_note_outline',
        description: 'Extract hierarchical outline from note headings',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            },
            maxDepth: {
              type: 'integer',
              description: 'Maximum heading depth to include',
              default: 6
            },
            includeContent: {
              type: 'boolean',
              description: 'Include content snippets for each section',
              default: false
            }
          },
          required: ['path']
        }
      },
      {
        name: 'generate_note_summary',
        description: 'Generate a summary of note content',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            },
            summaryLength: {
              type: 'string',
              description: 'Length of summary to generate',
              enum: ['short', 'medium', 'long'],
              default: 'medium'
            },
            includeKeywords: {
              type: 'boolean',
              description: 'Include extracted keywords',
              default: true
            },
            includeTags: {
              type: 'boolean',
              description: 'Include note tags in summary',
              default: true
            }
          },
          required: ['path']
        }
      },
      {
        name: 'organize_note_sections',
        description: 'Reorganize note sections and content',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            },
            operation: {
              type: 'string',
              description: 'Organization operation',
              enum: ['sort_headings', 'merge_sections', 'split_section', 'reorder_sections'],
              default: 'sort_headings'
            },
            sectionTitle: {
              type: 'string',
              description: 'Section title for split/merge operations'
            },
            newOrder: {
              type: 'array',
              items: { type: 'string' },
              description: 'New order of section titles for reordering'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'convert_tasks_to_kanban',
        description: 'Extract tasks from notes and add to kanban board',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note containing tasks'
            },
            boardType: {
              type: 'string',
              description: 'Type of kanban board to add tasks to',
              enum: ['default', 'simple', 'priority'],
              default: 'default'
            },
            preserveInNote: {
              type: 'boolean',
              description: 'Keep tasks in the original note',
              default: true
            }
          },
          required: ['path']
        }
      },
      {
        name: 'duplicate_note',
        description: 'Create a copy of an existing note',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: {
              type: 'string',
              description: 'Path to the note to duplicate'
            },
            newTitle: {
              type: 'string',
              description: 'Title for the new note'
            },
            newPath: {
              type: 'string',
              description: 'Custom path for the duplicated note'
            },
            updateReferences: {
              type: 'boolean',
              description: 'Update internal references in the duplicated note',
              default: false
            }
          },
          required: ['sourcePath', 'newTitle']
        }
      },
      {
        name: 'get_note_templates',
        description: 'Get available note templates',
        inputSchema: {
          type: 'object',
          properties: {
            includeCustom: {
              type: 'boolean',
              description: 'Include custom templates from workspace',
              default: true
            }
          }
        }
      },
      {
        name: 'get_note_history',
        description: 'Get operation history for note tools',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              description: 'Maximum number of history entries',
              default: 20
            },
            operation: {
              type: 'string',
              description: 'Filter by operation type'
            }
          }
        }
      }
    ];
  }

  /**
   * Execute a note tool
   */
  async executeTool(toolName, args) {
    try {
      let result;
      
      switch (toolName) {
        case 'create_note':
          result = await this.createNote(args);
          break;
        case 'update_note':
          result = await this.updateNote(args);
          break;
        case 'link_notes':
          result = await this.linkNotes(args);
          break;
        case 'resolve_wikilinks':
          result = await this.resolveWikiLinks(args);
          break;
        case 'extract_note_outline':
          result = await this.extractNoteOutline(args);
          break;
        case 'generate_note_summary':
          result = await this.generateNoteSummary(args);
          break;
        case 'organize_note_sections':
          result = await this.organizeNoteSections(args);
          break;
        case 'convert_tasks_to_kanban':
          result = await this.convertTasksToKanban(args);
          break;
        case 'duplicate_note':
          result = await this.duplicateNote(args);
          break;
        case 'get_note_templates':
          result = await this.getNoteTemplates(args);
          break;
        case 'get_note_history':
          result = await this.getNoteHistory(args);
          break;
        default:
          throw new Error(`Unknown note tool: ${toolName}`);
      }
      
      // Record operation in history
      this.recordOperation(toolName, args, result, 'success');
      
      return result;
      
    } catch (error) {
      this.recordOperation(toolName, args, null, 'error', error.message);
      this.logger.error(`Note tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Create a new note
   */
  async createNote(args) {
    const {
      title,
      path: customPath,
      template = 'basic',
      content: customContent,
      tags = [],
      frontmatter = {},
      createDirectory = true
    } = args;
    
    // Generate note path
    const notePath = customPath || this.generateNotePath(title);
    const fullPath = join(this.workspacePath, notePath);
    
    // Check if note already exists
    try {
      await stat(fullPath);
      throw new Error(`Note already exists: ${notePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Create directory if needed
    if (createDirectory) {
      await mkdir(dirname(fullPath), { recursive: true });
    }
    
    // Generate note content
    let noteContent;
    if (customContent) {
      noteContent = customContent;
    } else {
      noteContent = this.generateNoteContent(title, template, tags, frontmatter);
    }
    
    // Validate content size
    if (Buffer.byteLength(noteContent, 'utf-8') > this.options.maxNoteSize) {
      throw new Error('Note content exceeds maximum size limit');
    }
    
    // Write note file
    await writeFile(fullPath, noteContent, 'utf-8');
    
    // Get file stats
    const stats = await stat(fullPath);
    
    this.emit('noteCreated', {
      path: notePath,
      title,
      template,
      size: stats.size
    });
    
    return {
      success: true,
      path: notePath,
      title,
      template,
      size: stats.size,
      sizeFormatted: this.formatFileSize(stats.size),
      created: stats.birthtime?.toISOString() || stats.ctime.toISOString()
    };
  }

  /**
   * Update an existing note
   */
  async updateNote(args) {
    const {
      path,
      content,
      appendContent,
      prependContent,
      updateFrontmatter,
      addTags = [],
      removeTags = [],
      createBackup = true
    } = args;
    
    const fullPath = join(this.workspacePath, path);
    
    // Check if note exists
    try {
      await stat(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Note not found: ${path}`);
      }
      throw error;
    }
    
    // Read current content
    const currentContent = await readFile(fullPath, 'utf-8');
    
    // Create backup if requested
    let backupPath = null;
    if (createBackup && this.options.backupOnEdit) {
      backupPath = await this.createBackup(fullPath);
    }
    
    // Parse current content
    const parsed = this.parseNoteContent(currentContent);
    let newContent = currentContent;
    
    // Update content
    if (content !== undefined) {
      newContent = content;
    } else {
      // Handle append/prepend operations
      if (appendContent) {
        newContent = currentContent + '\n\n' + appendContent;
      }
      if (prependContent) {
        const contentWithoutFrontmatter = this.removeFrontmatter(currentContent);
        const frontmatterSection = this.extractFrontmatter(currentContent);
        newContent = frontmatterSection + prependContent + '\n\n' + contentWithoutFrontmatter;
      }
    }
    
    // Update frontmatter
    if (updateFrontmatter || addTags.length > 0 || removeTags.length > 0) {
      newContent = this.updateNoteFrontmatter(newContent, {
        updateFrontmatter,
        addTags,
        removeTags
      });
    }
    
    // Validate content size
    if (Buffer.byteLength(newContent, 'utf-8') > this.options.maxNoteSize) {
      throw new Error('Updated note content exceeds maximum size limit');
    }
    
    // Write updated content
    await writeFile(fullPath, newContent, 'utf-8');
    
    // Get updated stats
    const stats = await stat(fullPath);
    
    this.emit('noteUpdated', {
      path,
      size: stats.size,
      backupPath
    });
    
    return {
      success: true,
      path,
      size: stats.size,
      sizeFormatted: this.formatFileSize(stats.size),
      modified: stats.mtime.toISOString(),
      backupCreated: !!backupPath,
      backupPath
    };
  }

  /**
   * Create WikiLinks between notes
   */
  async linkNotes(args) {
    const {
      sourcePath,
      targetPath,
      linkText,
      alias,
      insertLocation = 'end',
      sectionTitle,
      createTargetIfMissing = false
    } = args;
    
    const sourceFullPath = join(this.workspacePath, sourcePath);
    const targetFullPath = join(this.workspacePath, targetPath);
    
    // Check if source exists
    try {
      await stat(sourceFullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source note not found: ${sourcePath}`);
      }
      throw error;
    }
    
    // Check if target exists
    let targetExists = true;
    try {
      await stat(targetFullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        targetExists = false;
        if (createTargetIfMissing) {
          // Create target note
          const targetTitle = basename(targetPath, extname(targetPath));
          await this.createNote({
            title: targetTitle,
            path: targetPath,
            template: 'basic'
          });
          targetExists = true;
        }
      } else {
        throw error;
      }
    }
    
    if (!targetExists) {
      throw new Error(`Target note not found: ${targetPath}. Use createTargetIfMissing to create it.`);
    }
    
    // Read source content
    const sourceContent = await readFile(sourceFullPath, 'utf-8');
    
    // Generate WikiLink
    const targetName = basename(targetPath, extname(targetPath));
    const wikiLink = alias ? `[[${targetName}|${alias}]]` : `[[${targetName}]]`;
    const linkTextToUse = linkText || `Link to ${targetName}`;
    
    // Insert link based on location
    let updatedContent;
    switch (insertLocation) {
      case 'beginning':
        updatedContent = wikiLink + '\n\n' + sourceContent;
        break;
        
      case 'end':
        updatedContent = sourceContent + '\n\n' + wikiLink;
        break;
        
      case 'section':
        if (!sectionTitle) {
          throw new Error('Section title required for section insertion');
        }
        updatedContent = this.insertLinkInSection(sourceContent, wikiLink, sectionTitle);
        break;
        
      default:
        updatedContent = sourceContent + '\n\n' + wikiLink;
    }
    
    // Write updated source
    await writeFile(sourceFullPath, updatedContent, 'utf-8');
    
    this.emit('notesLinked', {
      sourcePath,
      targetPath,
      wikiLink,
      targetCreated: !targetExists && createTargetIfMissing
    });
    
    return {
      success: true,
      sourcePath,
      targetPath,
      wikiLink,
      insertLocation,
      targetCreated: !targetExists && createTargetIfMissing
    };
  }

  /**
   * Resolve broken WikiLinks
   */
  async resolveWikiLinks(args) {
    const {
      path,
      autoCreate = false,
      suggestAlternatives = true
    } = args;
    
    const fullPath = join(this.workspacePath, path);
    const content = await readFile(fullPath, 'utf-8');
    
    // Parse WikiLinks
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const [target, alias] = linkText.includes('|') 
        ? linkText.split('|', 2).map(s => s.trim())
        : [linkText.trim(), null];
      
      links.push({
        target,
        alias,
        text: linkText,
        position: match.index,
        fullMatch: match[0]
      });
    }
    
    // Check which links are broken
    const brokenLinks = [];
    const fixedLinks = [];
    
    for (const link of links) {
      const targetPath = this.resolveWikiLinkTarget(link.target);
      const targetFullPath = join(this.workspacePath, targetPath);
      
      try {
        await stat(targetFullPath);
        // Link is valid
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Link is broken
          const resolution = {
            originalTarget: link.target,
            originalText: link.text,
            position: link.position,
            suggestions: []
          };
          
          if (suggestAlternatives) {
            resolution.suggestions = await this.suggestLinkAlternatives(link.target);
          }
          
          if (autoCreate) {
            // Create the missing note
            const targetTitle = link.target;
            await this.createNote({
              title: targetTitle,
              path: targetPath,
              template: 'basic'
            });
            
            resolution.fixed = true;
            resolution.action = 'created';
            fixedLinks.push(resolution);
          } else {
            brokenLinks.push(resolution);
          }
        }
      }
    }
    
    return {
      path,
      totalLinks: links.length,
      brokenLinks,
      fixedLinks,
      autoCreateEnabled: autoCreate
    };
  }

  /**
   * Extract note outline
   */
  async extractNoteOutline(args) {
    const {
      path,
      maxDepth = 6,
      includeContent = false
    } = args;
    
    const fullPath = join(this.workspacePath, path);
    const content = await readFile(fullPath, 'utf-8');
    
    // Parse headings
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      
      if (level <= maxDepth) {
        const heading = {
          level,
          text,
          id: this.createHeadingId(text),
          position: match.index
        };
        
        if (includeContent) {
          heading.content = this.extractSectionContent(content, match.index, headingRegex);
        }
        
        headings.push(heading);
      }
    }
    
    // Build hierarchical structure
    const outline = this.buildOutlineHierarchy(headings);
    
    return {
      path,
      outline,
      totalHeadings: headings.length,
      maxDepth
    };
  }

  /**
   * Generate note summary
   */
  async generateNoteSummary(args) {
    const {
      path,
      summaryLength = 'medium',
      includeKeywords = true,
      includeTags = true
    } = args;
    
    const fullPath = join(this.workspacePath, path);
    const content = await readFile(fullPath, 'utf-8');
    
    // Parse note content
    const parsed = this.parseNoteContent(content);
    const cleanContent = this.removeMarkdownFormatting(parsed.content);
    
    // Generate summary based on length
    let summary;
    const lengths = {
      short: 100,
      medium: 250,
      long: 500
    };
    
    const maxLength = lengths[summaryLength] || lengths.medium;
    summary = this.extractSummary(cleanContent, maxLength);
    
    // Extract keywords
    let keywords = [];
    if (includeKeywords) {
      keywords = this.extractKeywords(cleanContent, 10);
    }
    
    // Get note metadata
    let tags = [];
    if (includeTags && parsed.frontmatter?.tags) {
      tags = Array.isArray(parsed.frontmatter.tags) 
        ? parsed.frontmatter.tags 
        : [parsed.frontmatter.tags];
    }
    
    return {
      path,
      summary,
      summaryLength,
      keywords,
      tags,
      wordCount: this.countWords(cleanContent),
      characterCount: cleanContent.length
    };
  }

  /**
   * Organize note sections
   */
  async organizeNoteSections(args) {
    const {
      path,
      operation = 'sort_headings',
      sectionTitle,
      newOrder = []
    } = args;
    
    const fullPath = join(this.workspacePath, path);
    const content = await readFile(fullPath, 'utf-8');
    
    let updatedContent = content;
    
    switch (operation) {
      case 'sort_headings':
        updatedContent = this.sortHeadings(content);
        break;
        
      case 'merge_sections':
        if (!sectionTitle) {
          throw new Error('Section title required for merge operation');
        }
        updatedContent = this.mergeSections(content, sectionTitle);
        break;
        
      case 'split_section':
        if (!sectionTitle) {
          throw new Error('Section title required for split operation');
        }
        updatedContent = this.splitSection(content, sectionTitle);
        break;
        
      case 'reorder_sections':
        if (newOrder.length === 0) {
          throw new Error('New order array required for reorder operation');
        }
        updatedContent = this.reorderSections(content, newOrder);
        break;
        
      default:
        throw new Error(`Unknown organization operation: ${operation}`);
    }
    
    // Write updated content if changed
    if (updatedContent !== content) {
      await writeFile(fullPath, updatedContent, 'utf-8');
    }
    
    return {
      success: true,
      path,
      operation,
      changed: updatedContent !== content
    };
  }

  /**
   * Convert tasks to kanban
   */
  async convertTasksToKanban(args) {
    const {
      path,
      boardType = 'default',
      preserveInNote = true
    } = args;
    
    const fullPath = join(this.workspacePath, path);
    const content = await readFile(fullPath, 'utf-8');
    
    // Extract tasks using the task manager
    const extractedTasks = await taskManager.extractTasksFromContent(content, path);
    
    // Convert to kanban tasks
    const kanbanTasks = [];
    for (const task of extractedTasks) {
      const kanbanTask = await taskManager.createTask(task.title, {
        description: task.description,
        status: task.status,
        notePath: path,
        notePosition: task.note_position
      });
      kanbanTasks.push(kanbanTask);
    }
    
    // Optionally remove tasks from note
    let updatedContent = content;
    if (!preserveInNote) {
      updatedContent = this.removeTasksFromContent(content);
      await writeFile(fullPath, updatedContent, 'utf-8');
    }
    
    return {
      success: true,
      path,
      extractedTasks: extractedTasks.length,
      createdKanbanTasks: kanbanTasks.length,
      boardType,
      preservedInNote: preserveInNote,
      tasks: kanbanTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status
      }))
    };
  }

  /**
   * Duplicate note
   */
  async duplicateNote(args) {
    const {
      sourcePath,
      newTitle,
      newPath: customNewPath,
      updateReferences = false
    } = args;
    
    const sourceFullPath = join(this.workspacePath, sourcePath);
    
    // Check if source exists
    try {
      await stat(sourceFullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source note not found: ${sourcePath}`);
      }
      throw error;
    }
    
    // Generate new path
    const newPath = customNewPath || this.generateNotePath(newTitle);
    const newFullPath = join(this.workspacePath, newPath);
    
    // Check if new path already exists
    try {
      await stat(newFullPath);
      throw new Error(`Target path already exists: ${newPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Read source content
    const sourceContent = await readFile(sourceFullPath, 'utf-8');
    
    // Update content with new title and references
    let newContent = sourceContent;
    
    // Update title in frontmatter or first heading
    newContent = this.updateNoteTitle(newContent, newTitle);
    
    // Update internal references if requested
    if (updateReferences) {
      newContent = this.updateInternalReferences(newContent, sourcePath, newPath);
    }
    
    // Create directory if needed
    await mkdir(dirname(newFullPath), { recursive: true });
    
    // Write new note
    await writeFile(newFullPath, newContent, 'utf-8');
    
    const stats = await stat(newFullPath);
    
    this.emit('noteDuplicated', {
      sourcePath,
      newPath,
      newTitle
    });
    
    return {
      success: true,
      sourcePath,
      newPath,
      newTitle,
      size: stats.size,
      sizeFormatted: this.formatFileSize(stats.size),
      updatedReferences: updateReferences
    };
  }

  /**
   * Get note templates
   */
  async getNoteTemplates(args) {
    const { includeCustom = true } = args;
    
    const templates = { ...this.builtInTemplates };
    
    // Load custom templates if requested
    if (includeCustom) {
      try {
        const customTemplates = await this.loadCustomTemplates();
        Object.assign(templates, customTemplates);
      } catch (error) {
        this.logger.warn('Failed to load custom templates:', error.message);
      }
    }
    
    return {
      templates: Object.entries(templates).map(([id, template]) => ({
        id,
        name: template.name,
        description: template.description
      })),
      builtInCount: Object.keys(this.builtInTemplates).length,
      totalCount: Object.keys(templates).length
    };
  }

  /**
   * Get note operation history
   */
  async getNoteHistory(args) {
    const { limit = 20, operation } = args;
    
    let history = [...this.operationHistory];
    
    if (operation) {
      history = history.filter(entry => entry.operation === operation);
    }
    
    return {
      history: history.slice(-limit).reverse(),
      totalEntries: this.operationHistory.length
    };
  }

  /**
   * Template generation methods
   */

  getBasicTemplate() {
    return `---
title: "{{title}}"
created: {{date}}
tags: {{tags}}
---

# {{title}}

## Overview

<!-- Add your content here -->

## Notes

- `;
  }

  getDailyTemplate() {
    return `---
title: "{{title}}"
date: {{date}}
type: daily-note
tags: [daily, {{tags}}]
---

# {{title}}

## Priorities for Today

- [ ] 
- [ ] 
- [ ] 

## Schedule

### Morning
- 

### Afternoon
- 

### Evening
- 

## Notes

## Reflections

### What went well?

### What could be improved?

### Tomorrow's focus

`;
  }

  getMeetingTemplate() {
    return `---
title: "{{title}}"
date: {{date}}
type: meeting-notes
tags: [meeting, {{tags}}]
---

# {{title}}

**Date:** {{date}}
**Time:** 
**Attendees:** 
**Location/Platform:** 

## Agenda

1. 
2. 
3. 

## Discussion

### Topic 1


### Topic 2


### Topic 3


## Action Items

- [ ] **[Owner]** 
- [ ] **[Owner]** 
- [ ] **[Owner]** 

## Next Meeting

**Date:** 
**Follow-up items:** 

`;
  }

  getProjectTemplate() {
    return `---
title: "{{title}}"
created: {{date}}
type: project-plan
status: planning
tags: [project, {{tags}}]
---

# {{title}}

## Project Overview

**Objective:** 
**Start Date:** {{date}}
**Target Completion:** 
**Priority:** Medium
**Status:** Planning

## Goals

### Primary Goals
- 
- 
- 

### Secondary Goals
- 
- 

## Scope

### In Scope
- 
- 

### Out of Scope
- 
- 

## Timeline

| Phase | Task | Due Date | Status |
|-------|------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Resources

### Team Members
- 
- 

### Tools/Technologies
- 
- 

### Budget/Resources
- 

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| | | | |

## Notes

`;
  }

  getResearchTemplate() {
    return `---
title: "{{title}}"
created: {{date}}
type: research-note
tags: [research, {{tags}}]
---

# {{title}}

## Research Question

## Background

## Sources

### Primary Sources
- 
- 

### Secondary Sources
- 
- 

## Key Findings

### Finding 1


### Finding 2


### Finding 3


## Methodology

## Analysis

## Conclusions

## Future Research

### Questions to Explore
- 
- 

### Potential Sources
- 
- 

## References

1. 
2. 
3. 

`;
  }

  getReviewTemplate() {
    return `---
title: "{{title}}"
created: {{date}}
type: review
rating: 
tags: [review, {{tags}}]
---

# {{title}}

**Author/Creator:** 
**Type:** Book/Article/Video/Course
**Date Consumed:** {{date}}
**Rating:** ⭐⭐⭐⭐⭐ (X/5)

## Summary

## Key Points

### Main Ideas
- 
- 
- 

### Important Quotes
> 

> 

## Personal Thoughts

### What I Liked
- 
- 

### What I Didn't Like
- 
- 

### Surprises/New Insights
- 
- 

## Actionable Items

- [ ] 
- [ ] 
- [ ] 

## Connections

### Related Books/Articles
- [[]]
- [[]]

### Related Notes
- [[]]
- [[]]

## Rating Breakdown

- **Content Quality:** X/5
- **Clarity:** X/5
- **Usefulness:** X/5
- **Engagement:** X/5

## Would I Recommend?

**Yes/No** - 

`;
  }

  /**
   * Utility methods
   */

  generateNotePath(title) {
    // Convert title to filename
    const filename = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + this.options.defaultExtension;
    
    return filename;
  }

  generateNoteContent(title, template, tags, frontmatter) {
    const templateContent = this.builtInTemplates[template]?.content || this.getBasicTemplate();
    const now = new Date().toISOString().split('T')[0];
    const tagsString = tags.length > 0 ? tags.join(', ') : '';
    
    // Replace template variables
    let content = templateContent
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{date\}\}/g, now)
      .replace(/\{\{tags\}\}/g, tagsString);
    
    // Add frontmatter if enabled
    if (this.options.generateFrontmatter) {
      const fm = {
        title,
        created: now,
        ...frontmatter
      };
      
      if (tags.length > 0) {
        fm.tags = tags;
      }
      
      content = this.addFrontmatter(content, fm);
    }
    
    return content;
  }

  addFrontmatter(content, frontmatter) {
    // Check if content already has frontmatter
    if (content.startsWith('---')) {
      return content;
    }
    
    const fm = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
        }
        return `${key}: "${value}"`;
      })
      .join('\n');
    
    return `---\n${fm}\n---\n\n${content}`;
  }

  parseNoteContent(content) {
    const result = {
      frontmatter: null,
      content: content
    };
    
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (frontmatterMatch) {
      try {
        result.frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
        result.content = content.slice(frontmatterMatch[0].length);
      } catch (error) {
        this.logger.warn('Failed to parse frontmatter:', error.message);
      }
    }
    
    return result;
  }

  parseFrontmatter(yamlContent) {
    // Simple YAML parser for basic frontmatter
    const lines = yamlContent.split('\n');
    const frontmatter = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        frontmatter[key] = arrayContent.split(',').map(item => 
          item.trim().replace(/^["']|["']$/g, '')
        );
      } else {
        // Remove quotes if present
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
      }
    }
    
    return frontmatter;
  }

  updateNoteFrontmatter(content, updates) {
    const { updateFrontmatter, addTags, removeTags } = updates;
    const parsed = this.parseNoteContent(content);
    
    let frontmatter = parsed.frontmatter || {};
    
    // Update frontmatter fields
    if (updateFrontmatter) {
      Object.assign(frontmatter, updateFrontmatter);
    }
    
    // Update tags
    if (addTags.length > 0 || removeTags.length > 0) {
      let tags = Array.isArray(frontmatter.tags) ? [...frontmatter.tags] : [];
      
      // Add new tags
      for (const tag of addTags) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
      
      // Remove tags
      tags = tags.filter(tag => !removeTags.includes(tag));
      
      frontmatter.tags = tags;
    }
    
    // Rebuild content with updated frontmatter
    const contentWithoutFrontmatter = parsed.content;
    return this.addFrontmatter(contentWithoutFrontmatter, frontmatter);
  }

  extractFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    return frontmatterMatch ? frontmatterMatch[0] : '';
  }

  removeFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    return frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content;
  }

  insertLinkInSection(content, wikiLink, sectionTitle) {
    const sectionRegex = new RegExp(`^(#{1,6})\\s+${sectionTitle}\\s*$`, 'mi');
    const match = sectionRegex.exec(content);
    
    if (!match) {
      // Section not found, append at end
      return content + '\n\n' + wikiLink;
    }
    
    // Find the end of this section
    const sectionLevel = match[1].length;
    const afterSectionStart = match.index + match[0].length;
    
    // Look for next heading of same or higher level
    const nextSectionRegex = new RegExp(`^#{1,${sectionLevel}}\\s+`, 'gm');
    nextSectionRegex.lastIndex = afterSectionStart;
    const nextMatch = nextSectionRegex.exec(content);
    
    const insertPosition = nextMatch ? nextMatch.index : content.length;
    
    return content.slice(0, insertPosition) + '\n\n' + wikiLink + '\n' + content.slice(insertPosition);
  }

  resolveWikiLinkTarget(target) {
    if (!target.includes('.')) {
      return target + this.options.defaultExtension;
    }
    return target;
  }

  async suggestLinkAlternatives(target) {
    if (!this.fileProvider) {
      return [];
    }
    
    const files = await this.fileProvider.getResources();
    const suggestions = [];
    
    const targetLower = target.toLowerCase();
    
    for (const file of files) {
      const name = basename(file.name, extname(file.name)).toLowerCase();
      
      // Exact match (different case)
      if (name === targetLower) {
        suggestions.push({
          path: file.metadata.relativePath,
          name: file.name,
          type: 'exact_case',
          confidence: 1.0
        });
      }
      // Partial match
      else if (name.includes(targetLower) || targetLower.includes(name)) {
        suggestions.push({
          path: file.metadata.relativePath,
          name: file.name,
          type: 'partial',
          confidence: 0.7
        });
      }
      // Similar (simplified)
      else if (this.calculateStringSimilarity(name, targetLower) > 0.6) {
        suggestions.push({
          path: file.metadata.relativePath,
          name: file.name,
          type: 'similar',
          confidence: 0.5
        });
      }
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  calculateStringSimilarity(str1, str2) {
    // Simple Jaccard similarity
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  createHeadingId(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  extractSectionContent(content, headingIndex, headingRegex) {
    // Find next heading
    headingRegex.lastIndex = headingIndex + 1;
    const nextMatch = headingRegex.exec(content);
    
    const sectionEnd = nextMatch ? nextMatch.index : content.length;
    const sectionContent = content.slice(headingIndex, sectionEnd);
    
    // Return first 200 characters as preview
    return sectionContent.slice(0, 200) + (sectionContent.length > 200 ? '...' : '');
  }

  buildOutlineHierarchy(headings) {
    const result = [];
    const stack = [];
    
    for (const heading of headings) {
      // Pop items from stack that are at same or deeper level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      
      const item = {
        ...heading,
        children: []
      };
      
      if (stack.length === 0) {
        result.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }
      
      stack.push(item);
    }
    
    return result;
  }

  removeMarkdownFormatting(content) {
    return content
      .replace(/^#{1,6}\s+/gm, '') // Remove headings
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove wiki links
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();
  }

  extractSummary(content, maxLength) {
    // Take first paragraph or specified length
    const firstParagraph = content.split('\n\n')[0];
    if (firstParagraph.length <= maxLength) {
      return firstParagraph;
    }
    
    return firstParagraph.slice(0, maxLength) + '...';
  }

  extractKeywords(content, count) {
    // Simple keyword extraction
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCounts = {};
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word]) => word);
  }

  countWords(content) {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Simplified implementations for section operations
  sortHeadings(content) {
    // This would need a more sophisticated implementation
    return content;
  }

  mergeSections(content, sectionTitle) {
    // This would need a more sophisticated implementation
    return content;
  }

  splitSection(content, sectionTitle) {
    // This would need a more sophisticated implementation
    return content;
  }

  reorderSections(content, newOrder) {
    // This would need a more sophisticated implementation
    return content;
  }

  removeTasksFromContent(content) {
    // Remove task list items
    return content.replace(/^\s*- \[[ x]\] .+$/gm, '');
  }

  updateNoteTitle(content, newTitle) {
    const parsed = this.parseNoteContent(content);
    
    // Update frontmatter title
    if (parsed.frontmatter && parsed.frontmatter.title) {
      const updatedFrontmatter = { ...parsed.frontmatter, title: newTitle };
      return this.addFrontmatter(parsed.content, updatedFrontmatter);
    }
    
    // Update first heading
    const firstHeadingMatch = parsed.content.match(/^#\s+(.+)$/m);
    if (firstHeadingMatch) {
      return content.replace(firstHeadingMatch[0], `# ${newTitle}`);
    }
    
    // Add title at the beginning
    return `# ${newTitle}\n\n${content}`;
  }

  updateInternalReferences(content, oldPath, newPath) {
    const oldName = basename(oldPath, extname(oldPath));
    const newName = basename(newPath, extname(newPath));
    
    // Update WikiLinks that reference the old name
    return content.replace(
      new RegExp(`\\[\\[${oldName}(\\|[^\\]]+)?\\]\\]`, 'g'),
      `[[${newName}$1]]`
    );
  }

  async loadCustomTemplates() {
    // Load custom templates from workspace template directory
    const templateDir = join(this.workspacePath, this.options.templateDirectory);
    const customTemplates = {};
    
    try {
      const files = await readdir(templateDir);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const templatePath = join(templateDir, file);
          const content = await readFile(templatePath, 'utf-8');
          const name = basename(file, '.md');
          
          customTemplates[name] = {
            name: name.charAt(0).toUpperCase() + name.slice(1),
            description: `Custom template: ${name}`,
            content,
            custom: true
          };
        }
      }
    } catch (error) {
      // Template directory doesn't exist or is not accessible
    }
    
    return customTemplates;
  }

  async createBackup(fullPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${fullPath}.backup-${timestamp}`;
    
    const content = await readFile(fullPath);
    await writeFile(backupPath, content);
    
    return relative(this.workspacePath, backupPath);
  }

  recordOperation(operation, args, result, status, error = null) {
    const entry = {
      operation,
      args: { ...args },
      result: status === 'success' ? { success: result?.success, path: args.path || args.sourcePath } : null,
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
   * Get note tool statistics
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
      templateCount: Object.keys(this.builtInTemplates).length,
      autoLinkResolution: this.options.autoLinkResolution,
      maxNoteSize: this.options.maxNoteSize
    };
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.operationHistory = [];
    this.removeAllListeners();
    
    this.logger.info('NoteTools disposed');
  }
}

export default NoteTools;