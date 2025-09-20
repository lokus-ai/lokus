/**
 * Enhanced Search Tools for Lokus MCP Server
 * 
 * Leverages Lokus's existing search infrastructure including:
 * - Node.js filesystem operations for file operations
 * - GraphData.js for WikiLink and graph analysis  
 * - WikiLink resolution logic from core/wiki/resolve.js
 * - Search patterns from SearchPanel.jsx
 * - Graph visualization from ProfessionalGraphView.jsx
 */

import { readFile, readdir, stat, access } from 'fs/promises';
import { join, extname, basename, dirname, relative } from 'path';
import { WorkspaceManager } from '../../core/workspace/manager.js';
import { GraphData } from '../../core/graph/GraphData.js';
import { resolveWikiTarget, isRemoteUrl, isDataUrl, hasImageExt } from '../../core/wiki/resolve.js';
import { searchInFiles, highlightText, debounce } from '../../core/search/index.js';
import { EventEmitter } from 'events';

export class SearchTools extends EventEmitter {
  constructor(noteProvider, fileProvider, options = {}) {
    super();
    
    this.noteProvider = noteProvider;
    this.fileProvider = fileProvider;
    this.options = {
      maxResults: options.maxResults || 100,
      maxContentLength: options.maxContentLength || 50000, // Increased for markdown files
      searchableExtensions: options.searchableExtensions || [
        '.md', '.txt', '.json', '.js', '.jsx', '.ts', '.tsx',
        '.html', '.css', '.yaml', '.yml', '.xml', '.csv'
      ],
      indexingEnabled: options.indexingEnabled !== false,
      caseSensitive: options.caseSensitive || false,
      enableRegex: options.enableRegex !== false,
      contextLength: options.contextLength || 100,
      contextLines: options.contextLines || 3,
      ...options
    };
    
    this.workspacePath = null;
    this.graphDataManager = null;
    this.searchIndex = new Map();
    this.searchHistory = [];
    this.maxHistorySize = 50;
    this.recentFiles = new Map(); // file -> last access time
    this.favoriteFiles = new Set(); // user bookmarked files
    this.fileIndex = new Map(); // path -> file metadata
    
    this.stats = {
      indexedFiles: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      lastIndexUpdate: null,
      wikiLinksProcessed: 0,
      graphNodesCreated: 0
    };
    
    this.logger = options.logger || console;
  }

  /**
   * Initialize search tools with Lokus infrastructure
   */
  async initialize() {
    try {
      this.workspacePath = await WorkspaceManager.getValidatedWorkspacePath();
      
      if (!this.workspacePath) {
        throw new Error('No valid workspace path found');
      }
      
      // Initialize GraphData manager for WikiLink analysis
      this.graphDataManager = new GraphData({
        enablePersistence: false, // Use memory-only for MCP server
        enableRealTimeSync: false, // Static analysis mode
        maxCacheSize: 5000
      });
      
      // Set up global context for wiki resolution
      if (typeof globalThis !== 'undefined') {
        globalThis.__LOKUS_WORKSPACE_PATH__ = this.workspacePath;
        globalThis.__LOKUS_FILE_INDEX__ = [];
      }
      
      this.logger.info('SearchTools initialized', {
        workspacePath: this.workspacePath,
        indexingEnabled: this.options.indexingEnabled,
        maxResults: this.options.maxResults,
        graphEnabled: !!this.graphDataManager
      });
      
      // Build comprehensive workspace index
      await this.buildWorkspaceIndex();
      
      // Build search index if enabled
      if (this.options.indexingEnabled) {
        await this.buildSearchIndex();
      }
      
    } catch (error) {
      this.logger.error('Failed to initialize SearchTools:', error);
      throw error;
    }
  }

  /**
   * Get available search tools leveraging Lokus infrastructure
   */
  getTools() {
    return [
      {
        name: 'search_content',
        description: 'Full-text search across all workspace files using Lokus search algorithms',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text'
            },
            caseSensitive: {
              type: 'boolean',
              description: 'Perform case-sensitive search',
              default: false
            },
            wholeWord: {
              type: 'boolean',
              description: 'Match whole words only',
              default: false
            },
            useRegex: {
              type: 'boolean',
              description: 'Treat query as regular expression',
              default: false
            },
            fileTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by file extensions (e.g., [".md", ".txt"])'
            },
            excludePaths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths to exclude from search'
            },
            maxResults: {
              type: 'integer',
              description: 'Maximum number of results to return',
              default: 50
            },
            contextLines: {
              type: 'integer',
              description: 'Number of context lines around matches',
              default: 3
            }
          },
          required: ['query']
        }
      },
      {
        name: 'search_wiki_links',
        description: 'Find wiki link references and backlinks using Lokus graph analysis',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'WikiLink target to search for (optional - searches all if not provided)'
            },
            mode: {
              type: 'string',
              description: 'Search mode',
              enum: ['references', 'backlinks', 'all'],
              default: 'references'
            },
            includeContext: {
              type: 'boolean',
              description: 'Include surrounding text context',
              default: true
            }
          }
        }
      },
      {
        name: 'find_broken_links',
        description: 'Identify broken wiki links and file references using graph analysis',
        inputSchema: {
          type: 'object',
          properties: {
            autoSuggestFixes: {
              type: 'boolean',
              description: 'Suggest potential fixes for broken links',
              default: true
            },
            includeImages: {
              type: 'boolean', 
              description: 'Include broken image references',
              default: true
            }
          }
        }
      },
      {
        name: 'get_graph_data',
        description: 'Generate knowledge graph data for visualization using ProfessionalGraphView infrastructure',
        inputSchema: {
          type: 'object',
          properties: {
            includeMetrics: {
              type: 'boolean',
              description: 'Include centrality metrics and importance scores',
              default: true
            },
            filterByType: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter nodes by type (document, placeholder, tag)',
              default: ['document', 'placeholder']
            },
            maxNodes: {
              type: 'integer',
              description: 'Maximum number of nodes to return',
              default: 500
            }
          }
        }
      },
      {
        name: 'search_by_tags',
        description: 'Search by hashtags or metadata tags with relationship analysis',
        inputSchema: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to search for (without # prefix)'
            },
            mode: {
              type: 'string',
              description: 'Tag search mode',
              enum: ['any', 'all', 'exact'],
              default: 'any'
            },
            includeRelated: {
              type: 'boolean',
              description: 'Include notes with related tags',
              default: true
            }
          },
          required: ['tags']
        }
      },
      {
        name: 'search_recent',
        description: 'Find recently accessed or modified files',
        inputSchema: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'string',
              description: 'Time range for recency',
              enum: ['1h', '1d', '1w', '1m'],
              default: '1w'
            },
            sortBy: {
              type: 'string',
              description: 'Sort criteria',
              enum: ['modified', 'accessed', 'created'],
              default: 'modified'
            },
            maxResults: {
              type: 'integer',
              description: 'Maximum number of results',
              default: 20
            }
          }
        }
      },
      {
        name: 'search_favorites',
        description: 'Search bookmarked or favorited content',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Optional search query within favorites'
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include metadata about favorites',
              default: true
            }
          }
        }
      },
      {
        name: 'get_file_links',
        description: 'Get all outgoing links from a specific file',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file to analyze'
            },
            linkTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Types of links to include',
              default: ['wikilink', 'markdown', 'image']
            }
          },
          required: ['filePath']
        }
      },
      {
        name: 'get_backlinks',
        description: 'Get all files linking to a specific file using graph analysis',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the target file'
            },
            includeContext: {
              type: 'boolean',
              description: 'Include context around the links',
              default: true
            },
            depth: {
              type: 'integer',
              description: 'Depth of backlink analysis (1 = direct, 2 = includes links to those files)',
              default: 1,
              minimum: 1,
              maximum: 3
            }
          },
          required: ['filePath']
        }
      },
      {
        name: 'navigate_to',
        description: 'Open specific files or sections in the Lokus editor',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file to open'
            },
            lineNumber: {
              type: 'integer',
              description: 'Specific line number to navigate to'
            },
            heading: {
              type: 'string',
              description: 'Heading to navigate to within the file'
            },
            createIfNotExists: {
              type: 'boolean',
              description: 'Create the file if it does not exist',
              default: false
            }
          },
          required: ['filePath']
        }
      },
      {
        name: 'search_tags',
        description: 'Search notes by tags and analyze tag relationships',
        inputSchema: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to search for'
            },
            mode: {
              type: 'string',
              description: 'Tag search mode',
              enum: ['any', 'all', 'exact'],
              default: 'any'
            },
            includeRelated: {
              type: 'boolean',
              description: 'Include notes with related tags',
              default: false
            }
          },
          required: ['tags']
        }
      },
      {
        name: 'search_files',
        description: 'Search files by name, path, or metadata',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'File name or path pattern to search for'
            },
            useGlob: {
              type: 'boolean',
              description: 'Use glob pattern matching',
              default: false
            },
            sizeRange: {
              type: 'object',
              properties: {
                min: { type: 'integer', description: 'Minimum file size in bytes' },
                max: { type: 'integer', description: 'Maximum file size in bytes' }
              },
              description: 'Filter by file size range'
            },
            dateRange: {
              type: 'object',
              properties: {
                from: { type: 'string', description: 'Start date (ISO string)' },
                to: { type: 'string', description: 'End date (ISO string)' }
              },
              description: 'Filter by modification date range'
            },
            extensions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by file extensions'
            }
          },
          required: ['pattern']
        }
      },
      {
        name: 'find_similar',
        description: 'Find files similar to a given file based on content or metadata',
        inputSchema: {
          type: 'object',
          properties: {
            referencePath: {
              type: 'string',
              description: 'Path to the reference file'
            },
            similarityType: {
              type: 'string',
              description: 'Type of similarity to analyze',
              enum: ['content', 'tags', 'links', 'structure', 'combined'],
              default: 'combined'
            },
            threshold: {
              type: 'number',
              description: 'Similarity threshold (0.0 to 1.0)',
              minimum: 0,
              maximum: 1,
              default: 0.3
            },
            maxResults: {
              type: 'integer',
              description: 'Maximum number of similar files to return',
              default: 10
            }
          },
          required: ['referencePath']
        }
      },
      {
        name: 'analyze_workspace',
        description: 'Analyze workspace content and provide insights',
        inputSchema: {
          type: 'object',
          properties: {
            analysisType: {
              type: 'string',
              description: 'Type of analysis to perform',
              enum: ['overview', 'connectivity', 'tags', 'orphans', 'duplicates', 'statistics'],
              default: 'overview'
            },
            includeDetails: {
              type: 'boolean',
              description: 'Include detailed analysis results',
              default: true
            }
          }
        }
      },
      {
        name: 'get_search_suggestions',
        description: 'Get search suggestions based on workspace content',
        inputSchema: {
          type: 'object',
          properties: {
            partial: {
              type: 'string',
              description: 'Partial search term for suggestions'
            },
            type: {
              type: 'string',
              description: 'Type of suggestions to provide',
              enum: ['content', 'files', 'tags', 'wikilinks'],
              default: 'content'
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of suggestions',
              default: 10
            }
          }
        }
      },
      {
        name: 'get_search_history',
        description: 'Get recent search history and statistics',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              description: 'Maximum number of history entries',
              default: 20
            },
            includeStats: {
              type: 'boolean',
              description: 'Include search statistics',
              default: true
            }
          }
        }
      }
    ];
  }

  /**
   * Execute a search tool with Lokus integration
   */
  async executeTool(toolName, args) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (toolName) {
        case 'search_content':
          result = await this.searchContent(args);
          break;
        case 'search_wiki_links':
          result = await this.searchWikiLinks(args);
          break;
        case 'find_broken_links':
          result = await this.findBrokenLinks(args);
          break;
        case 'get_graph_data':
          result = await this.getGraphData(args);
          break;
        case 'search_by_tags':
          result = await this.searchByTags(args);
          break;
        case 'search_recent':
          result = await this.searchRecent(args);
          break;
        case 'search_favorites':
          result = await this.searchFavorites(args);
          break;
        case 'get_file_links':
          result = await this.getFileLinks(args);
          break;
        case 'get_backlinks':
          result = await this.getBacklinks(args);
          break;
        case 'navigate_to':
          result = await this.navigateTo(args);
          break;
        case 'search_tags':
          result = await this.searchTags(args);
          break;
        case 'search_files':
          result = await this.searchFiles(args);
          break;
        case 'find_similar':
          result = await this.findSimilar(args);
          break;
        case 'analyze_workspace':
          result = await this.analyzeWorkspace(args);
          break;
        case 'get_search_suggestions':
          result = await this.getSearchSuggestions(args);
          break;
        case 'get_search_history':
          result = await this.getSearchHistory(args);
          break;
        default:
          throw new Error(`Unknown search tool: ${toolName}`);
      }
      
      // Record search in history
      const duration = Date.now() - startTime;
      this.recordSearch(toolName, args, result, duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordSearch(toolName, args, null, duration, error.message);
      this.logger.error(`Search tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Search content across files using Node.js filesystem operations
   */
  async searchContent(args) {
    const {
      query,
      caseSensitive = this.options.caseSensitive,
      wholeWord = false,
      useRegex = false,
      fileTypes = [],
      excludePaths = [],
      maxResults = this.options.maxResults,
      contextLines = this.options.contextLines
    } = args;
    
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }
    
    try {
      // Use Node.js implementation of search_in_files (replaces Tauri command)
      const searchOptions = {
        caseSensitive,
        wholeWord,
        regex: useRegex,
        fileTypes: fileTypes.length > 0 ? fileTypes : ['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'],
        maxResults,
        contextLines,
        excludePaths
      };
      
      const searchResults = await this.searchInFiles(query, this.workspacePath, searchOptions);
      
      if (!searchResults) {
        return {
          query,
          results: [],
          totalMatches: 0,
          searchedFiles: 0,
          options: searchOptions
        };
      }
      
      // Enhance results with additional metadata
      const enhancedResults = await Promise.all(searchResults.map(async (result) => {
        try {
          // Get file stats
          const fileStat = await this.getFileMetadata(result.file);
          
          return {
            file: result.file,
            fileName: result.fileName || result.file.split('/').pop(),
            name: result.fileName || result.file.split('/').pop(),
            matchCount: result.matchCount,
            matches: result.matches.map(match => ({
              line: match.line,
              column: match.column,
              text: match.text || '',
              context: match.context || [],
              lineNumber: match.line,
              relevanceScore: this.calculateMatchRelevance(match, query)
            })),
            size: fileStat?.size || 0,
            sizeFormatted: this.formatFileSize(fileStat?.size || 0),
            modified: fileStat?.modified || new Date().toISOString(),
            created: fileStat?.created || new Date().toISOString(),
            type: this.getFileType(result.file),
            relevanceScore: this.calculateFileRelevance(result, query)
          };
        } catch (error) {
          // Fallback if file metadata fails (handle Node.js fs errors)
          this.logger.warn(`Failed to get metadata for ${result.file}:`, error.message);
          return {
            file: result.file,
            fileName: result.fileName || result.file.split('/').pop(),
            name: result.fileName || result.file.split('/').pop(),
            matchCount: result.matchCount,
            matches: result.matches || [],
            relevanceScore: result.matchCount * 1.5,
            size: 0,
            sizeFormatted: '0 B',
            modified: new Date().toISOString(),
            created: new Date().toISOString(),
            type: this.getFileType(result.file)
          };
        }
      }));
      
      // Sort by relevance score
      enhancedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      const totalMatches = enhancedResults.reduce((sum, r) => sum + r.matchCount, 0);
      
      return {
        query,
        results: enhancedResults.slice(0, maxResults),
        totalMatches,
        totalFiles: enhancedResults.length,
        searchedFiles: enhancedResults.length,
        options: searchOptions,
        workspace: this.workspacePath
      };
      
    } catch (error) {
      this.logger.error('Search content failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search WikiLinks using Lokus's GraphData and WikiLink resolution
   */
  async searchWikiLinks(args) {
    const {
      target,
      mode = 'references',
      includeContext = true
    } = args;
    
    try {
      // Ensure we have a graph data manager
      if (!this.graphDataManager) {
        await this.initializeGraphData();
      }
      
      // Build graph from current workspace
      await this.buildWorkspaceGraph();
      
      const results = [];
      
      switch (mode) {
        case 'references':
          if (target) {
            // Find all files that reference this target
            const graphData = this.graphDataManager.getGraphData();
            
            for (const link of graphData.links) {
              const targetNode = graphData.nodes.find(n => n.id === link.target);
              if (targetNode && (targetNode.title === target || targetNode.id === target)) {
                const sourceNode = graphData.nodes.find(n => n.id === link.source);
                if (sourceNode && sourceNode.type === 'document') {
                  results.push({
                    file: sourceNode.documentId,
                    fileName: sourceNode.title,
                    targetTitle: targetNode.title,
                    linkType: link.type,
                    linkMetadata: link.metadata,
                    sourceNode: {
                      id: sourceNode.id,
                      title: sourceNode.title,
                      type: sourceNode.type,
                      wordCount: sourceNode.wordCount
                    },
                    targetNode: {
                      id: targetNode.id,
                      title: targetNode.title,
                      type: targetNode.type,
                      backlinkCount: targetNode.backlinkCount
                    }
                  });
                }
              }
            }
          } else {
            // Return all wiki link relationships
            const graphData = this.graphDataManager.getGraphData();
            for (const link of graphData.links) {
              if (link.type === 'wikilink') {
                const sourceNode = graphData.nodes.find(n => n.id === link.source);
                const targetNode = graphData.nodes.find(n => n.id === link.target);
                
                if (sourceNode && targetNode) {
                  results.push({
                    file: sourceNode.documentId,
                    fileName: sourceNode.title,
                    target: targetNode.title,
                    linkType: link.type,
                    linkMetadata: link.metadata
                  });
                }
              }
            }
          }
          break;
          
        case 'backlinks':
          if (target) {
            const backlinks = this.graphDataManager.getBacklinks(target);
            for (const backlinkNode of backlinks) {
              if (backlinkNode.type === 'document') {
                results.push({
                  file: backlinkNode.documentId,
                  fileName: backlinkNode.title,
                  wordCount: backlinkNode.wordCount,
                  linkCount: backlinkNode.linkCount,
                  type: backlinkNode.type
                });
              }
            }
          }
          break;
          
        case 'all':
          const graphData = this.graphDataManager.getGraphData();
          const wikiLinksByFile = new Map();
          
          for (const link of graphData.links) {
            if (link.type === 'wikilink') {
              const sourceNode = graphData.nodes.find(n => n.id === link.source);
              const targetNode = graphData.nodes.find(n => n.id === link.target);
              
              if (sourceNode && sourceNode.type === 'document') {
                if (!wikiLinksByFile.has(sourceNode.documentId)) {
                  wikiLinksByFile.set(sourceNode.documentId, {
                    file: sourceNode.documentId,
                    fileName: sourceNode.title,
                    wikiLinks: []
                  });
                }
                wikiLinksByFile.get(sourceNode.documentId).wikiLinks.push({
                  target: targetNode?.title || 'Unknown',
                  targetType: targetNode?.type || 'placeholder',
                  metadata: link.metadata
                });
              }
            }
          }
          
          results.push(...Array.from(wikiLinksByFile.values()));
          break;
      }
      
      // Add context if requested
      if (includeContext && results.length > 0) {
        for (const result of results) {
          if (result.file) {
            try {
              const content = await readFile(result.file, 'utf-8');
              result.context = this.extractLinkContext(content, target || result.target);
            } catch (error) {
              // Skip context if file can't be read (Node.js fs error)
              this.logger.warn(`Failed to read file for context ${result.file}:`, error.message);
            }
          }
        }
      }
      
      return {
        mode,
        target,
        results,
        totalResults: results.length,
        graphStats: this.graphDataManager.getStats()
      };
      
    } catch (error) {
      this.logger.error('WikiLink search failed:', error);
      throw new Error(`WikiLink search failed: ${error.message}`);
    }
  }

  /**
   * Find broken WikiLinks and file references
   */
  async findBrokenLinks(args) {
    const {
      autoSuggestFixes = true,
      includeImages = true
    } = args;
    
    try {
      // Ensure we have a graph data manager
      if (!this.graphDataManager) {
        await this.initializeGraphData();
      }
      
      // Build graph from current workspace
      await this.buildWorkspaceGraph();
      
      const graphData = this.graphDataManager.getGraphData();
      const brokenLinks = [];
      const suggestions = new Map();
      
      // Get all files in workspace for validation
      const allFiles = await this.readWorkspaceFiles(this.workspacePath);
      const existingFiles = new Set();
      
      const extractFiles = (entries) => {
        for (const entry of entries) {
          if (entry.is_directory && entry.children) {
            extractFiles(entry.children);
          } else {
            existingFiles.add(entry.path);
            existingFiles.add(entry.name);
            // Add without extension too
            if (entry.name.endsWith('.md')) {
              existingFiles.add(entry.name.replace('.md', ''));
            }
          }
        }
      };
      extractFiles(allFiles);
      
      // Check for broken WikiLinks in the graph
      for (const node of graphData.nodes) {
        if (node.type === 'placeholder') {
          // This is a placeholder node, meaning the target doesn't exist
          const backlinks = this.graphDataManager.getBacklinks(node.id);
          
          for (const backlinkNode of backlinks) {
            if (backlinkNode.type === 'document') {
              const brokenLink = {
                sourceFile: backlinkNode.documentId,
                sourceTitle: backlinkNode.title,
                brokenTarget: node.title,
                targetType: 'wikilink',
                reason: 'target-not-found'
              };
              
              // Add suggestions if enabled
              if (autoSuggestFixes) {
                const suggestions = this.suggestLinkFixes(node.title, existingFiles);
                if (suggestions.length > 0) {
                  brokenLink.suggestions = suggestions;
                }
              }
              
              brokenLinks.push(brokenLink);
            }
          }
        }
      }
      
      // Check for broken image links if requested
      if (includeImages) {
        for (const node of graphData.nodes) {
          if (node.type === 'document' && node.documentId) {
            try {
              const content = await readFile(node.documentId, 'utf-8');
              const imageLinks = this.extractImageLinks(content);
              
              for (const imageLink of imageLinks) {
                const resolvedPath = await this.resolveImagePath(imageLink.src, node.documentId);
                if (!resolvedPath || !await this.fileExists(resolvedPath)) {
                  brokenLinks.push({
                    sourceFile: node.documentId,
                    sourceTitle: node.title,
                    brokenTarget: imageLink.src,
                    targetType: 'image',
                    reason: 'image-not-found',
                    line: imageLink.line,
                    context: imageLink.context
                  });
                }
              }
            } catch (error) {
              // Skip files that can't be read (Node.js fs error)
              this.logger.warn(`Failed to read file for broken link analysis ${node.documentId}:`, error.message);
            }
          }
        }
      }
      
      return {
        brokenLinks,
        totalBroken: brokenLinks.length,
        suggestions: autoSuggestFixes ? Array.from(suggestions.entries()) : [],
        analysis: {
          wikiLinks: brokenLinks.filter(l => l.targetType === 'wikilink').length,
          imageLinks: brokenLinks.filter(l => l.targetType === 'image').length,
          totalFiles: existingFiles.size,
          graphNodes: graphData.nodes.length
        }
      };
      
    } catch (error) {
      this.logger.error('Find broken links failed:', error);
      throw new Error(`Find broken links failed: ${error.message}`);
    }
  }

  /**
   * Get graph data for visualization
   */
  async getGraphData(args) {
    const {
      includeMetrics = true,
      filterByType = ['document', 'placeholder'],
      maxNodes = 500
    } = args;
    
    try {
      // Ensure we have a graph data manager
      if (!this.graphDataManager) {
        await this.initializeGraphData();
      }
      
      // Build graph from current workspace
      await this.buildWorkspaceGraph();
      
      let graphData = this.graphDataManager.getGraphData();
      
      // Filter nodes by type if specified
      if (filterByType.length > 0) {
        graphData = {
          nodes: graphData.nodes.filter(node => filterByType.includes(node.type)),
          links: graphData.links
        };
        
        // Filter links to only include those between remaining nodes
        const nodeIds = new Set(graphData.nodes.map(n => n.id));
        graphData.links = graphData.links.filter(link => 
          nodeIds.has(link.source) && nodeIds.has(link.target)
        );
      }
      
      // Limit nodes if necessary
      if (graphData.nodes.length > maxNodes) {
        // Sort by importance (backlink count + word count)
        const sortedNodes = graphData.nodes.sort((a, b) => {
          const aScore = (a.backlinkCount || 0) * 10 + (a.wordCount || 0) / 100;
          const bScore = (b.backlinkCount || 0) * 10 + (b.wordCount || 0) / 100;
          return bScore - aScore;
        });
        
        graphData.nodes = sortedNodes.slice(0, maxNodes);
        const nodeIds = new Set(graphData.nodes.map(n => n.id));
        graphData.links = graphData.links.filter(link => 
          nodeIds.has(link.source) && nodeIds.has(link.target)
        );
      }
      
      // Add metrics if requested
      let metrics = null;
      if (includeMetrics) {
        metrics = this.calculateGraphMetrics(graphData);
      }
      
      return {
        nodes: graphData.nodes,
        links: graphData.links,
        metrics,
        stats: {
          totalNodes: graphData.nodes.length,
          totalLinks: graphData.links.length,
          nodeTypes: this.getNodeTypeDistribution(graphData.nodes),
          linkTypes: this.getLinkTypeDistribution(graphData.links)
        },
        workspace: this.workspacePath
      };
      
    } catch (error) {
      this.logger.error('Get graph data failed:', error);
      throw new Error(`Get graph data failed: ${error.message}`);
    }
  }

  /**
   * Search by tags
   */
  async searchByTags(args) {
    const {
      tags,
      mode = 'any',
      includeRelated = true
    } = args;
    
    try {
      // Ensure we have a graph data manager
      if (!this.graphDataManager) {
        await this.initializeGraphData();
      }
      
      // Build graph from current workspace
      await this.buildWorkspaceGraph();
      
      const results = [];
      const graphData = this.graphDataManager.getGraphData();
      
      // Search for nodes with matching tags
      for (const node of graphData.nodes) {
        if (node.type === 'document' && node.tags && node.tags.length > 0) {
          let matches = false;
          let matchedTags = [];
          
          switch (mode) {
            case 'any':
              matchedTags = node.tags.filter(tag => tags.includes(tag));
              matches = matchedTags.length > 0;
              break;
              
            case 'all':
              matchedTags = tags.filter(tag => node.tags.includes(tag));
              matches = matchedTags.length === tags.length;
              break;
              
            case 'exact':
              matches = node.tags.length === tags.length && 
                       tags.every(tag => node.tags.includes(tag));
              matchedTags = matches ? tags : [];
              break;
          }
          
          if (matches) {
            const result = {
              file: node.documentId,
              fileName: node.title,
              tags: node.tags,
              matchedTags,
              matchCount: matchedTags.length,
              totalTags: node.tags.length,
              wordCount: node.wordCount,
              linkCount: node.linkCount,
              backlinkCount: node.backlinkCount
            };
            
            // Get backlinks for context
            const backlinks = this.graphDataManager.getBacklinks(node.id);
            result.backlinks = backlinks.map(bl => ({
              file: bl.documentId,
              title: bl.title
            }));
            
            results.push(result);
          }
        }
      }
      
      // Add related tag analysis if requested
      let relatedTags = null;
      if (includeRelated) {
        relatedTags = this.analyzeRelatedTags(graphData.nodes, tags);
      }
      
      return {
        searchTags: tags,
        mode,
        results,
        totalResults: results.length,
        relatedTags,
        tagStats: this.analyzeTagUsage(graphData.nodes)
      };
      
    } catch (error) {
      this.logger.error('Search by tags failed:', error);
      throw new Error(`Search by tags failed: ${error.message}`);
    }
  }

  /**
   * Search by tags (legacy method for compatibility)
   */
  async searchTags(args) {
    const {
      tags,
      mode = 'any',
      includeRelated = false
    } = args;
    
    if (!this.noteProvider) {
      throw new Error('Note provider not available for tag search');
    }
    
    const notes = await this.noteProvider.getResources();
    const results = [];
    
    for (const note of notes) {
      const noteTags = note.metadata.tags || [];
      let matches = false;
      let matchedTags = [];
      
      switch (mode) {
        case 'any':
          matchedTags = noteTags.filter(tag => tags.includes(tag));
          matches = matchedTags.length > 0;
          break;
          
        case 'all':
          matchedTags = tags.filter(tag => noteTags.includes(tag));
          matches = matchedTags.length === tags.length;
          break;
          
        case 'exact':
          matches = noteTags.length === tags.length && 
                   tags.every(tag => noteTags.includes(tag));
          matchedTags = matches ? tags : [];
          break;
      }
      
      if (matches) {
        results.push({
          file: note.metadata.relativePath,
          name: note.name,
          tags: noteTags,
          matchedTags,
          matchCount: matchedTags.length,
          totalTags: noteTags.length,
          summary: note.metadata.summary
        });
      }
    }
    
    // Add related tag analysis if requested
    let relatedTags = null;
    if (includeRelated) {
      relatedTags = this.analyzeRelatedTags(notes, tags);
    }
    
    return {
      searchTags: tags,
      mode,
      results,
      totalResults: results.length,
      relatedTags
    };
  }

  /**
   * Search files by name/path
   */
  async searchFiles(args) {
    const {
      pattern,
      useGlob = false,
      sizeRange,
      dateRange,
      extensions = []
    } = args;
    
    const files = await this.fileProvider.getResources();
    const results = [];
    
    // Create search pattern
    let searchPattern;
    if (useGlob) {
      searchPattern = this.globToRegex(pattern);
    } else {
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchPattern = new RegExp(escapedPattern, 'i');
    }
    
    for (const file of files) {
      const metadata = file.metadata;
      
      // Name/path matching
      const nameMatch = searchPattern.test(file.name) || searchPattern.test(metadata.relativePath);
      if (!nameMatch) continue;
      
      // Extension filter
      if (extensions.length > 0 && !extensions.includes(metadata.extension)) {
        continue;
      }
      
      // Size filter
      if (sizeRange) {
        if (sizeRange.min && metadata.size < sizeRange.min) continue;
        if (sizeRange.max && metadata.size > sizeRange.max) continue;
      }
      
      // Date filter
      if (dateRange) {
        const modifiedDate = new Date(metadata.modified);
        if (dateRange.from && modifiedDate < new Date(dateRange.from)) continue;
        if (dateRange.to && modifiedDate > new Date(dateRange.to)) continue;
      }
      
      results.push({
        file: metadata.relativePath,
        name: file.name,
        size: metadata.size,
        sizeFormatted: metadata.sizeFormatted,
        modified: metadata.modified,
        extension: metadata.extension,
        type: metadata.type,
        directory: metadata.directory
      });
    }
    
    return {
      pattern,
      results,
      totalResults: results.length,
      filters: {
        sizeRange,
        dateRange,
        extensions
      }
    };
  }

  /**
   * Find similar files
   */
  async findSimilar(args) {
    const {
      referencePath,
      similarityType = 'combined',
      threshold = 0.3,
      maxResults = 10
    } = args;
    
    // Get reference file data
    const referenceNote = await this.noteProvider.getResource(referencePath);
    if (!referenceNote) {
      throw new Error(`Reference file not found: ${referencePath}`);
    }
    
    const notes = await this.noteProvider.getResources();
    const similarities = [];
    
    for (const note of notes) {
      if (note.metadata.relativePath === referencePath) continue;
      
      const similarity = this.calculateSimilarity(referenceNote, note, similarityType);
      
      if (similarity >= threshold) {
        similarities.push({
          file: note.metadata.relativePath,
          name: note.name,
          similarity,
          factors: this.getSimilarityFactors(referenceNote, note, similarityType)
        });
      }
    }
    
    // Sort by similarity score
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return {
      referencePath,
      similarityType,
      threshold,
      results: similarities.slice(0, maxResults),
      totalSimilar: similarities.length
    };
  }

  /**
   * Analyze workspace
   */
  async analyzeWorkspace(args) {
    const {
      analysisType = 'overview',
      includeDetails = true
    } = args;
    
    const files = await this.fileProvider.getResources();
    const notes = this.noteProvider ? await this.noteProvider.getResources() : [];
    
    let analysis = {};
    
    switch (analysisType) {
      case 'overview':
        analysis = this.analyzeOverview(files, notes);
        break;
        
      case 'connectivity':
        analysis = this.analyzeConnectivity(notes);
        break;
        
      case 'tags':
        analysis = this.analyzeTagUsage(notes);
        break;
        
      case 'orphans':
        analysis = this.analyzeOrphans(notes);
        break;
        
      case 'duplicates':
        analysis = await this.analyzeDuplicates(files);
        break;
        
      case 'statistics':
        analysis = this.analyzeStatistics(files, notes);
        break;
        
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
    
    return {
      analysisType,
      timestamp: new Date().toISOString(),
      workspacePath: this.workspacePath,
      ...analysis
    };
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(args) {
    const {
      partial = '',
      type = 'content',
      limit = 10
    } = args;
    
    const suggestions = [];
    
    switch (type) {
      case 'content':
        // Simple word-based suggestions from search index
        if (this.searchIndex.size > 0) {
          for (const [word, files] of this.searchIndex) {
            if (word.toLowerCase().includes(partial.toLowerCase()) && files.size > 0) {
              suggestions.push({
                text: word,
                type: 'word',
                frequency: files.size
              });
            }
          }
        }
        break;
        
      case 'files':
        const files = await this.fileProvider.getResources();
        for (const file of files) {
          if (file.name.toLowerCase().includes(partial.toLowerCase())) {
            suggestions.push({
              text: file.name,
              type: 'file',
              path: file.metadata.relativePath
            });
          }
        }
        break;
        
      case 'tags':
        if (this.noteProvider) {
          const allTags = await this.noteProvider.getAllTags();
          for (const tag of allTags) {
            if (tag.toLowerCase().includes(partial.toLowerCase())) {
              suggestions.push({
                text: tag,
                type: 'tag'
              });
            }
          }
        }
        break;
        
      case 'wikilinks':
        if (this.noteProvider) {
          const allTargets = await this.noteProvider.getAllWikiLinkTargets();
          for (const target of allTargets) {
            if (target.toLowerCase().includes(partial.toLowerCase())) {
              suggestions.push({
                text: target,
                type: 'wikilink'
              });
            }
          }
        }
        break;
    }
    
    return {
      partial,
      type,
      suggestions: suggestions
        .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
        .slice(0, limit)
    };
  }

  /**
   * Get search history
   */
  async getSearchHistory(args) {
    const {
      limit = 20,
      includeStats = true
    } = args;
    
    const history = this.searchHistory.slice(-limit).reverse();
    
    let stats = null;
    if (includeStats) {
      stats = this.calculateSearchStats();
    }
    
    return {
      history,
      stats,
      totalQueries: this.searchHistory.length
    };
  }

  /**
   * Build workspace index for search operations
   */
  async buildWorkspaceIndex() {
    try {
      this.logger.info('Building workspace index...');
      
      // Get all files in workspace
      const files = await this.readWorkspaceFiles(this.workspacePath);
      const fileIndex = [];
      
      const processFiles = (entries, parentPath = '') => {
        for (const entry of entries) {
          if (entry.is_directory && entry.children) {
            processFiles(entry.children, entry.path);
          } else {
            fileIndex.push({
              path: entry.path,
              name: entry.name,
              parent: parentPath,
              isDirectory: false
            });
            
            this.fileIndex.set(entry.path, {
              path: entry.path,
              name: entry.name,
              parent: parentPath,
              type: this.getFileType(entry.path),
              size: entry.size || 0,
              modified: entry.modified || new Date().toISOString()
            });
          }
        }
      };
      
      processFiles(files);
      
      // Set up global file index for wiki resolution
      if (typeof globalThis !== 'undefined') {
        globalThis.__LOKUS_FILE_INDEX__ = fileIndex;
      }
      
      this.logger.info(`Workspace index built: ${fileIndex.length} files indexed`);
      
    } catch (error) {
      this.logger.error('Failed to build workspace index:', error);
    }
  }

  /**
   * Build workspace graph using GraphData
   */
  async buildWorkspaceGraph() {
    try {
      if (!this.graphDataManager) {
        throw new Error('GraphData manager not initialized');
      }
      
      // Get all markdown files
      const files = await this.readWorkspaceFiles(this.workspacePath);
      const markdownFiles = [];
      
      const extractMarkdownFiles = (entries) => {
        for (const entry of entries) {
          if (entry.is_directory && entry.children) {
            extractMarkdownFiles(entry.children);
          } else if (entry.name.endsWith('.md')) {
            markdownFiles.push(entry);
          }
        }
      };
      extractMarkdownFiles(files);
      
      // Process each markdown file
      for (const file of markdownFiles) {
        try {
          const content = await readFile(file.path, 'utf-8');
          
          // Extract title from filename
          const title = file.name.replace('.md', '');
          
          // Process the document with GraphData
          await this.graphDataManager.handleDocumentChange({
            documentId: file.path,
            content: content,
            metadata: {
              title: title,
              path: file.path,
              wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
              created: Date.now()
            }
          });
          
          this.stats.wikiLinksProcessed++;
          
        } catch (error) {
          this.logger.warn(`Failed to process file ${file.path}:`, error.message);
        }
      }
      
      this.stats.graphNodesCreated = this.graphDataManager.getStats().nodeCount;
      
    } catch (error) {
      this.logger.error('Failed to build workspace graph:', error);
      throw error;
    }
  }

  /**
   * Initialize GraphData if not already done
   */
  async initializeGraphData() {
    if (!this.graphDataManager) {
      this.graphDataManager = new GraphData({
        enablePersistence: false,
        enableRealTimeSync: false,
        maxCacheSize: 5000
      });
    }
  }

  /**
   * Get file type from extension
   */
  getFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      'md': 'markdown',
      'txt': 'text',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    
    return typeMap[ext] || 'unknown';
  }

  /**
   * Calculate file relevance score
   */
  calculateFileRelevance(result, query) {
    let score = result.matchCount * 2;
    
    // Boost score for title matches
    if (result.fileName && result.fileName.toLowerCase().includes(query.toLowerCase())) {
      score += 10;
    }
    
    // Boost score for exact matches
    if (result.matches) {
      for (const match of result.matches) {
        if (match.text && match.text.toLowerCase() === query.toLowerCase()) {
          score += 5;
        }
      }
    }
    
    return score;
  }

  /**
   * Calculate match relevance score
   */
  calculateMatchRelevance(match, query) {
    let score = 1;
    
    if (match.text && match.text.toLowerCase() === query.toLowerCase()) {
      score += 3;
    }
    
    if (match.text && match.text.toLowerCase().includes(query.toLowerCase())) {
      score += 1;
    }
    
    return score;
  }

  /**
   * Extract link context from content
   */
  extractLinkContext(content, target) {
    const lines = content.split('\n');
    const contexts = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(target) || line.includes(`[[${target}]]`)) {
        const context = {
          lineNumber: i + 1,
          text: line.trim(),
          before: i > 0 ? lines[i - 1].trim() : '',
          after: i < lines.length - 1 ? lines[i + 1].trim() : ''
        };
        contexts.push(context);
      }
    }
    
    return contexts;
  }

  /**
   * Suggest fixes for broken links
   */
  suggestLinkFixes(brokenTarget, existingFiles) {
    const suggestions = [];
    const lowerTarget = brokenTarget.toLowerCase();
    
    for (const file of existingFiles) {
      const lowerFile = file.toLowerCase();
      
      // Exact match (case insensitive)
      if (lowerFile === lowerTarget || lowerFile === lowerTarget + '.md') {
        suggestions.push({ file, confidence: 1.0, reason: 'exact-match' });
        continue;
      }
      
      // Substring match
      if (lowerFile.includes(lowerTarget) || lowerTarget.includes(lowerFile)) {
        const confidence = Math.max(
          lowerTarget.length / lowerFile.length,
          lowerFile.length / lowerTarget.length
        ) * 0.8;
        suggestions.push({ file, confidence, reason: 'substring-match' });
        continue;
      }
      
      // Similar words (simple heuristic)
      const similarity = this.calculateStringSimilarity(lowerTarget, lowerFile);
      if (similarity > 0.6) {
        suggestions.push({ file, confidence: similarity * 0.7, reason: 'similar-name' });
      }
    }
    
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  calculateStringSimilarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(a, b);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Extract image links from content
   */
  extractImageLinks(content) {
    const imageLinks = [];
    const lines = content.split('\n');
    
    // Markdown image syntax: ![alt](src)
    const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    // HTML image syntax: <img src="...">
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check markdown images
      let match;
      while ((match = mdImageRegex.exec(line)) !== null) {
        imageLinks.push({
          src: match[2],
          alt: match[1],
          line: i + 1,
          context: line.trim(),
          type: 'markdown'
        });
      }
      
      // Check HTML images
      while ((match = htmlImageRegex.exec(line)) !== null) {
        imageLinks.push({
          src: match[1],
          line: i + 1,
          context: line.trim(),
          type: 'html'
        });
      }
    }
    
    return imageLinks;
  }

  /**
   * Resolve image path relative to file
   */
  async resolveImagePath(imageSrc, filePath) {
    try {
      if (isRemoteUrl(imageSrc) || isDataUrl(imageSrc)) {
        return imageSrc; // Remote URLs are always "resolved"
      }
      
      // For local paths, try to resolve relative to file
      const fileDir = dirname(filePath);
      return join(this.workspacePath, fileDir, imageSrc);
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate graph metrics
   */
  calculateGraphMetrics(graphData) {
    const metrics = {
      centrality: new Map(),
      clustering: new Map(),
      communities: [],
      hubs: [],
      authorities: []
    };
    
    // Calculate degree centrality
    for (const node of graphData.nodes) {
      const inDegree = graphData.links.filter(l => l.target === node.id).length;
      const outDegree = graphData.links.filter(l => l.source === node.id).length;
      const totalDegree = inDegree + outDegree;
      
      metrics.centrality.set(node.id, {
        in: inDegree,
        out: outDegree,
        total: totalDegree,
        normalized: totalDegree / Math.max(1, graphData.nodes.length - 1)
      });
      
      // Identify hubs (high out-degree) and authorities (high in-degree)
      if (outDegree >= 3) {
        metrics.hubs.push({ id: node.id, title: node.title, degree: outDegree });
      }
      if (inDegree >= 3) {
        metrics.authorities.push({ id: node.id, title: node.title, degree: inDegree });
      }
    }
    
    // Sort hubs and authorities
    metrics.hubs.sort((a, b) => b.degree - a.degree);
    metrics.authorities.sort((a, b) => b.degree - a.degree);
    
    return {
      centrality: Object.fromEntries(metrics.centrality),
      hubs: metrics.hubs.slice(0, 10),
      authorities: metrics.authorities.slice(0, 10),
      totalNodes: graphData.nodes.length,
      totalLinks: graphData.links.length,
      density: graphData.links.length / Math.max(1, (graphData.nodes.length * (graphData.nodes.length - 1)) / 2)
    };
  }

  /**
   * Get node type distribution
   */
  getNodeTypeDistribution(nodes) {
    const distribution = {};
    for (const node of nodes) {
      distribution[node.type] = (distribution[node.type] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Get link type distribution
   */
  getLinkTypeDistribution(links) {
    const distribution = {};
    for (const link of links) {
      distribution[link.type] = (distribution[link.type] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Analyze related tags
   */
  analyzeRelatedTags(nodes, searchTags) {
    const coOccurrence = new Map();
    
    for (const node of nodes) {
      if (node.type === 'document' && node.tags) {
        const hasSearchTag = searchTags.some(tag => node.tags.includes(tag));
        
        if (hasSearchTag) {
          for (const tag of node.tags) {
            if (!searchTags.includes(tag)) {
              coOccurrence.set(tag, (coOccurrence.get(tag) || 0) + 1);
            }
          }
        }
      }
    }
    
    return Array.from(coOccurrence.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * Analyze tag usage
   */
  analyzeTagUsage(nodes) {
    const tagCount = new Map();
    
    for (const node of nodes) {
      if (node.type === 'document' && node.tags) {
        for (const tag of node.tags) {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
        }
      }
    }
    
    return {
      totalTags: tagCount.size,
      mostUsedTags: Array.from(tagCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
      tagDistribution: Object.fromEntries(tagCount)
    };
  }

  /**
   * Utility methods
   */

  async buildSearchIndex() {
    try {
      this.logger.info('Building search index...');
      
      this.searchIndex.clear();
      const files = await this.getSearchableFiles();
      let indexedCount = 0;
      
      for (const file of files) {
        try {
          const content = await readFile(file.fullPath, 'utf-8');
          
          if (content.length <= this.options.maxContentLength) {
            this.indexFile(file.relativePath, content);
            indexedCount++;
          }
          
        } catch (error) {
          this.logger.warn(`Failed to index file ${file.relativePath}:`, error.message);
        }
      }
      
      this.stats.indexedFiles = indexedCount;
      this.stats.lastIndexUpdate = new Date().toISOString();
      
      this.logger.info(`Search index built: ${indexedCount} files indexed`);
      
    } catch (error) {
      this.logger.error('Failed to build search index:', error);
    }
  }

  indexFile(filePath, content) {
    // Simple word-based indexing
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    for (const word of words) {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
      }
      this.searchIndex.get(word).add(filePath);
    }
  }

  async getSearchableFiles(fileTypes = [], excludePaths = []) {
    const files = await this.fileProvider.getResources();
    const searchableFiles = [];
    
    for (const file of files) {
      const metadata = file.metadata;
      
      // Check extension
      if (!this.options.searchableExtensions.includes(metadata.extension)) {
        continue;
      }
      
      // Check file type filter
      if (fileTypes.length > 0 && !fileTypes.includes(metadata.extension)) {
        continue;
      }
      
      // Check exclude paths
      if (excludePaths.some(path => metadata.relativePath.includes(path))) {
        continue;
      }
      
      searchableFiles.push({
        relativePath: metadata.relativePath,
        fullPath: join(this.workspacePath, metadata.relativePath),
        name: file.name,
        type: metadata.type,
        size: metadata.size,
        modified: metadata.modified
      });
    }
    
    return searchableFiles;
  }

  findMatches(content, pattern, includeContext) {
    const matches = [];
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      const matchObj = {
        text: match[0],
        index: match.index,
        length: match[0].length
      };
      
      if (includeContext) {
        const contextStart = Math.max(0, match.index - this.options.contextLength);
        const contextEnd = Math.min(content.length, match.index + match[0].length + this.options.contextLength);
        
        matchObj.context = content.slice(contextStart, contextEnd);
        matchObj.contextStart = contextStart;
        matchObj.lineNumber = this.getLineNumber(content, match.index);
      }
      
      matches.push(matchObj);
      
      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }
    
    return matches;
  }

  getLineNumber(content, index) {
    return content.slice(0, index).split('\n').length;
  }

  calculateRelevanceScore(matches, contentLength) {
    const matchCount = matches.length;
    const density = matchCount / Math.max(contentLength / 1000, 1);
    return matchCount + density;
  }

  resolveWikiLinkTarget(target) {
    if (!target.includes('.')) {
      return target + '.md';
    }
    return target;
  }

  calculateSimilarity(ref, note, type) {
    switch (type) {
      case 'content':
        return this.calculateContentSimilarity(ref, note);
      case 'tags':
        return this.calculateTagSimilarity(ref, note);
      case 'links':
        return this.calculateLinkSimilarity(ref, note);
      case 'structure':
        return this.calculateStructureSimilarity(ref, note);
      case 'combined':
        const content = this.calculateContentSimilarity(ref, note) * 0.3;
        const tags = this.calculateTagSimilarity(ref, note) * 0.3;
        const links = this.calculateLinkSimilarity(ref, note) * 0.2;
        const structure = this.calculateStructureSimilarity(ref, note) * 0.2;
        return content + tags + links + structure;
      default:
        return 0;
    }
  }

  calculateContentSimilarity(ref, note) {
    const refWords = new Set(ref.metadata.summary?.toLowerCase().split(/\s+/) || []);
    const noteWords = new Set(note.metadata.summary?.toLowerCase().split(/\s+/) || []);
    
    const intersection = new Set([...refWords].filter(x => noteWords.has(x)));
    const union = new Set([...refWords, ...noteWords]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  calculateTagSimilarity(ref, note) {
    const refTags = new Set(ref.metadata.tags || []);
    const noteTags = new Set(note.metadata.tags || []);
    
    const intersection = new Set([...refTags].filter(x => noteTags.has(x)));
    const union = new Set([...refTags, ...noteTags]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  calculateLinkSimilarity(ref, note) {
    const refLinks = new Set(ref.metadata.wikiLinkTargets || []);
    const noteLinks = new Set(note.metadata.wikiLinkTargets || []);
    
    const intersection = new Set([...refLinks].filter(x => noteLinks.has(x)));
    const union = new Set([...refLinks, ...noteLinks]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  calculateStructureSimilarity(ref, note) {
    const refHeadings = ref.metadata.headings?.length || 0;
    const noteHeadings = note.metadata.headings?.length || 0;
    
    const diff = Math.abs(refHeadings - noteHeadings);
    const max = Math.max(refHeadings, noteHeadings);
    
    return max > 0 ? 1 - (diff / max) : 1;
  }

  getSimilarityFactors(ref, note, type) {
    return {
      content: this.calculateContentSimilarity(ref, note),
      tags: this.calculateTagSimilarity(ref, note),
      links: this.calculateLinkSimilarity(ref, note),
      structure: this.calculateStructureSimilarity(ref, note)
    };
  }

  // Analysis methods (simplified implementations)
  analyzeOverview(files, notes) {
    return {
      totalFiles: files.length,
      totalNotes: notes.length,
      fileTypes: this.getFileTypeDistribution(files),
      averageFileSize: this.calculateAverageFileSize(files),
      recentActivity: this.getRecentActivity(files)
    };
  }

  analyzeConnectivity(notes) {
    const linkGraph = new Map();
    
    for (const note of notes) {
      const path = note.metadata.relativePath;
      linkGraph.set(path, note.metadata.wikiLinkTargets || []);
    }
    
    return {
      totalConnections: Array.from(linkGraph.values()).reduce((sum, links) => sum + links.length, 0),
      mostConnected: this.getMostConnectedNotes(linkGraph),
      isolatedNotes: this.getIsolatedNotes(linkGraph)
    };
  }

  analyzeTagUsage(notes) {
    const tagCount = new Map();
    
    for (const note of notes) {
      for (const tag of note.metadata.tags || []) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      }
    }
    
    return {
      totalTags: tagCount.size,
      mostUsedTags: Array.from(tagCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      tagDistribution: Object.fromEntries(tagCount)
    };
  }

  analyzeOrphans(notes) {
    const incomingLinks = new Map();
    
    // Build incoming link map
    for (const note of notes) {
      for (const target of note.metadata.wikiLinkTargets || []) {
        if (!incomingLinks.has(target)) {
          incomingLinks.set(target, []);
        }
        incomingLinks.get(target).push(note.metadata.relativePath);
      }
    }
    
    const orphans = [];
    for (const note of notes) {
      const path = note.metadata.relativePath;
      if (!incomingLinks.has(path)) {
        orphans.push({
          file: path,
          name: note.name,
          outgoingLinks: note.metadata.wikiLinkTargets?.length || 0
        });
      }
    }
    
    return {
      orphanCount: orphans.length,
      orphans
    };
  }

  async analyzeDuplicates(files) {
    const duplicates = [];
    const sizeGroups = new Map();
    
    // Group files by size
    for (const file of files) {
      const size = file.metadata.size;
      if (!sizeGroups.has(size)) {
        sizeGroups.set(size, []);
      }
      sizeGroups.get(size).push(file);
    }
    
    // Check groups with multiple files
    for (const [size, groupFiles] of sizeGroups) {
      if (groupFiles.length > 1) {
        duplicates.push({
          size,
          sizeFormatted: this.formatFileSize(size),
          files: groupFiles.map(f => ({
            file: f.metadata.relativePath,
            name: f.name
          }))
        });
      }
    }
    
    return {
      duplicateGroups: duplicates.length,
      duplicates
    };
  }

  analyzeStatistics(files, notes) {
    return {
      files: {
        total: files.length,
        averageSize: this.calculateAverageFileSize(files),
        typeDistribution: this.getFileTypeDistribution(files)
      },
      notes: {
        total: notes.length,
        averageWordCount: this.calculateAverageWordCount(notes),
        averageLinks: this.calculateAverageLinks(notes),
        averageTags: this.calculateAverageTags(notes)
      }
    };
  }

  // Helper methods for analysis
  getFileTypeDistribution(files) {
    const distribution = {};
    for (const file of files) {
      const type = file.metadata.type;
      distribution[type] = (distribution[type] || 0) + 1;
    }
    return distribution;
  }

  calculateAverageFileSize(files) {
    if (files.length === 0) return 0;
    const totalSize = files.reduce((sum, f) => sum + f.metadata.size, 0);
    return Math.round(totalSize / files.length);
  }

  calculateAverageWordCount(notes) {
    if (notes.length === 0) return 0;
    const totalWords = notes.reduce((sum, n) => sum + (n.metadata.wordCount || 0), 0);
    return Math.round(totalWords / notes.length);
  }

  calculateAverageLinks(notes) {
    if (notes.length === 0) return 0;
    const totalLinks = notes.reduce((sum, n) => sum + (n.metadata.wikiLinkTargets?.length || 0), 0);
    return Math.round(totalLinks / notes.length);
  }

  calculateAverageTags(notes) {
    if (notes.length === 0) return 0;
    const totalTags = notes.reduce((sum, n) => sum + (n.metadata.tags?.length || 0), 0);
    return Math.round(totalTags / notes.length);
  }

  getRecentActivity(files) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return files.filter(f => new Date(f.metadata.modified) > oneWeekAgo).length;
  }

  getMostConnectedNotes(linkGraph) {
    const connectionCounts = new Map();
    
    for (const [source, targets] of linkGraph) {
      connectionCounts.set(source, targets.length);
    }
    
    return Array.from(connectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  getIsolatedNotes(linkGraph) {
    const isolated = [];
    
    for (const [source, targets] of linkGraph) {
      if (targets.length === 0) {
        isolated.push(source);
      }
    }
    
    return isolated;
  }

  analyzeRelatedTags(notes, searchTags) {
    const coOccurrence = new Map();
    
    for (const note of notes) {
      const tags = note.metadata.tags || [];
      const hasSearchTag = searchTags.some(tag => tags.includes(tag));
      
      if (hasSearchTag) {
        for (const tag of tags) {
          if (!searchTags.includes(tag)) {
            coOccurrence.set(tag, (coOccurrence.get(tag) || 0) + 1);
          }
        }
      }
    }
    
    return Array.from(coOccurrence.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }

  globToRegex(glob) {
    const pattern = glob
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp(pattern, 'i');
  }

  recordSearch(tool, args, result, duration, error = null) {
    const entry = {
      tool,
      query: args.query || args.pattern || args.target || JSON.stringify(args),
      duration,
      resultCount: result?.results?.length || result?.totalResults || 0,
      success: !error,
      error,
      timestamp: new Date().toISOString()
    };
    
    this.searchHistory.push(entry);
    
    // Trim history if too large
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory.shift();
    }
    
    // Update stats
    this.stats.totalQueries++;
    this.stats.averageQueryTime = 
      (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + duration) / this.stats.totalQueries;
  }

  calculateSearchStats() {
    const tools = {};
    let totalDuration = 0;
    let successCount = 0;
    
    for (const entry of this.searchHistory) {
      tools[entry.tool] = (tools[entry.tool] || 0) + 1;
      totalDuration += entry.duration;
      if (entry.success) successCount++;
    }
    
    return {
      totalQueries: this.searchHistory.length,
      averageQueryTime: this.searchHistory.length > 0 ? totalDuration / this.searchHistory.length : 0,
      successRate: this.searchHistory.length > 0 ? successCount / this.searchHistory.length : 0,
      toolUsage: tools,
      indexedFiles: this.stats.indexedFiles,
      lastIndexUpdate: this.stats.lastIndexUpdate
    };
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
   * Get search tool statistics
   */
  getStats() {
    return {
      ...this.stats,
      searchIndexSize: this.searchIndex.size,
      searchHistorySize: this.searchHistory.length,
      workspacePath: this.workspacePath,
      isIndexingEnabled: this.options.indexingEnabled
    };
  }

  /**
   * Refresh search index
   */
  async refresh() {
    if (this.options.indexingEnabled) {
      await this.buildSearchIndex();
    }
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.searchIndex.clear();
    this.searchHistory = [];
    this.removeAllListeners();
    
    this.logger.info('SearchTools disposed');
  }

  /**
   * Node.js implementation of search_in_files (replaces Tauri invoke)
   */
  async searchInFiles(query, workspacePath, options = {}) {
    const {
      caseSensitive = false,
      wholeWord = false,
      regex = false,
      fileTypes = ['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'],
      maxResults = 100,
      contextLines = 3,
      excludePaths = []
    } = options;

    try {
      const files = await this.readWorkspaceFiles(workspacePath);
      const searchResults = [];
      let searchedFiles = 0;

      // Convert file types to extensions
      const extensions = fileTypes.map(type => type.startsWith('.') ? type : `.${type}`);

      const processFiles = async (entries) => {
        for (const entry of entries) {
          if (entry.is_directory && entry.children) {
            await processFiles(entry.children);
          } else if (!entry.is_directory) {
            const fileExt = extname(entry.name);
            
            // Skip if extension not in allowed list
            if (extensions.length > 0 && !extensions.includes(fileExt)) {
              continue;
            }

            // Skip excluded paths
            if (excludePaths.some(excludePath => entry.path.includes(excludePath))) {
              continue;
            }

            try {
              const content = await readFile(entry.path, 'utf-8');
              const matches = this.findTextMatches(content, query, {
                caseSensitive,
                wholeWord,
                regex,
                contextLines
              });

              if (matches.length > 0) {
                searchResults.push({
                  file: entry.path,
                  fileName: entry.name,
                  matchCount: matches.length,
                  matches: matches
                });
              }

              searchedFiles++;
            } catch (error) {
              // Skip files that can't be read
              this.logger.warn(`Failed to read file ${entry.path}:`, error.message);
            }

            // Stop if we've reached max results
            if (searchResults.length >= maxResults) {
              break;
            }
          }
        }
      };

      await processFiles(files);

      return searchResults.slice(0, maxResults);

    } catch (error) {
      this.logger.error('Search in files failed:', error);
      throw error;
    }
  }

  /**
   * Find text matches in content
   */
  findTextMatches(content, query, options = {}) {
    const { caseSensitive = false, wholeWord = false, regex = false, contextLines = 3 } = options;
    const matches = [];
    const lines = content.split('\n');

    let searchPattern;
    try {
      if (regex) {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      // If regex is invalid, treat as literal string
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchPattern = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineMatches = [];
      let match;

      // Reset regex lastIndex for each line
      searchPattern.lastIndex = 0;

      while ((match = searchPattern.exec(line)) !== null) {
        lineMatches.push({
          line: i + 1,
          column: match.index + 1,
          text: line,
          context: this.getContextLines(lines, i, contextLines)
        });

        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          searchPattern.lastIndex++;
        }
      }

      matches.push(...lineMatches);
    }

    return matches;
  }

  /**
   * Get context lines around a match
   */
  getContextLines(lines, matchLineIndex, contextLines) {
    const context = [];
    const start = Math.max(0, matchLineIndex - contextLines);
    const end = Math.min(lines.length - 1, matchLineIndex + contextLines);

    for (let i = start; i <= end; i++) {
      context.push({
        line: i + 1,
        text: lines[i],
        isMatch: i === matchLineIndex
      });
    }

    return context;
  }

  /**
   * Node.js implementation of get_file_metadata (replaces Tauri invoke)
   */
  async getFileMetadata(filePath) {
    try {
      const stats = await stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      this.logger.warn(`Failed to get metadata for ${filePath}:`, error.message);
      return {
        size: 0,
        modified: new Date().toISOString(),
        created: new Date().toISOString(),
        isDirectory: false,
        isFile: true
      };
    }
  }

  /**
   * Node.js implementation of read_workspace_files (replaces Tauri invoke)
   */
  async readWorkspaceFiles(workspacePath, relativePath = '') {
    const files = [];
    
    try {
      const fullPath = join(workspacePath, relativePath);
      const entries = await readdir(fullPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = join(fullPath, entry.name);
        const relativeEntryPath = join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories and common exclude patterns
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === 'target' ||
              entry.name === 'dist' ||
              entry.name === 'build') {
            continue;
          }
          
          const dirEntry = {
            name: entry.name,
            path: entryPath,
            relative_path: relativeEntryPath,
            is_directory: true,
            children: await this.readWorkspaceFiles(workspacePath, relativeEntryPath)
          };
          files.push(dirEntry);
        } else {
          // Skip hidden files and common temp files
          if (entry.name.startsWith('.') || 
              entry.name.endsWith('.tmp') ||
              entry.name.endsWith('.swp') ||
              entry.name.endsWith('~')) {
            continue;
          }
          
          try {
            const stats = await stat(entryPath);
            const fileEntry = {
              name: entry.name,
              path: entryPath,
              relative_path: relativeEntryPath,
              is_directory: false,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              created: stats.birthtime.toISOString()
            };
            files.push(fileEntry);
          } catch (statError) {
            // Skip files we can't stat
            this.logger.warn(`Failed to stat file ${entryPath}:`, statError.message);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to read directory ${workspacePath}/${relativePath}:`, error);
      // Return empty array instead of throwing to allow partial results
    }
    
    return files;
  }
}

export default SearchTools;