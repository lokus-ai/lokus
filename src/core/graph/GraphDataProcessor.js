import { invoke } from "@tauri-apps/api/core";
import { GraphDatabase } from "./GraphDatabase.js";
import { createNodeId, normalizePath, wikiLinkToPath, createPhantomNodeId } from "./PathUtils.js";

/**
 * GraphDataProcessor - Extracts and processes graph data from workspace files
 * 
 * Features:
 * - Reads workspace files using Tauri file system commands
 * - Parses wiki links [[link]] and [[link|alias]] from markdown content
 * - Builds nodes (files) and edges (links) for graph visualization
 * - Handles large workspaces efficiently with streaming and batching
 * - Provides file type detection and metadata extraction
 * - Supports real-time updates when files change
 */
export class GraphDataProcessor {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.fileIndex = [];
    
    // Initialize new GraphDatabase instead of Maps
    this.graphDatabase = new GraphDatabase({
      maxNodes: 100000,
      maxEdgesPerNode: 10000,
      enableMetrics: true,
      enableValidation: true,
      cacheTimeout: 30000
    });
    
    this.processingStats = {
      totalFiles: 0,
      processedFiles: 0,
      totalLinks: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
    
    // Performance settings
    this.batchSize = 50; // Process files in batches
    this.maxFileSize = 10 * 1024 * 1024; // 10MB max file size
    
    // Supported file extensions for processing
    this.supportedExtensions = new Set([
      '.md', '.txt', '.markdown', '.mdown', '.mkd', '.mkdn',
      '.org', '.rst', '.tex', '.wiki', '.mediawiki'
    ]);
    
    // File type colors for visualization
    this.fileTypeColors = {
      '.md': '#10b981',      // Green for markdown
      '.txt': '#6b7280',     // Gray for text
      '.org': '#f59e0b',     // Orange for org-mode
      '.rst': '#8b5cf6',     // Purple for reStructuredText
      '.tex': '#ef4444',     // Red for LaTeX
      'folder': '#3b82f6',   // Blue for folders
      'unknown': '#6366f1'   // Indigo for unknown types
    };
    
    // Set up event listeners for real-time updates
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for real-time graph updates
   */
  setupEventListeners() {
    // Listen for file link updates from GraphDatabase
    this.graphDatabase.on('fileLinksUpdated', (event) => {
    });
    
    // Listen for connection changes
    this.graphDatabase.on('connectionAdded', (event) => {
    });
    
    this.graphDatabase.on('connectionRemoved', (event) => {
    });
    
    // Listen for node changes
    this.graphDatabase.on('nodeAdded', (event) => {
    });
    
    this.graphDatabase.on('nodeRemoved', (event) => {
    });
  }

  /**
   * Main method to build graph data from workspace
   * @param {Object} options - Processing options
   * @returns {Promise<{nodes: Array, edges: Array, stats: Object}>}
   */
  async buildGraphFromWorkspace(options = {}) {
    const {
      includeNonMarkdown = false,
      maxDepth = 10,
      excludePatterns = ['.git', 'node_modules', '.lokus'],
      onProgress = null
    } = options;

    this.processingStats.startTime = Date.now();

    try {
      // Step 1: Read workspace file structure
      await this.buildFileIndex(maxDepth, excludePatterns);
      
      // Step 2: Process files in batches
      await this.processFilesInBatches(includeNonMarkdown, onProgress);
      
      // Step 3: Build final graph structure
      const graphData = this.buildGraphStructure();
      
      this.processingStats.endTime = Date.now();
      const processingTime = this.processingStats.endTime - this.processingStats.startTime;
      
      
      return graphData;
      
    } catch (error) {
      this.processingStats.errors++;
      throw new Error(`Graph processing failed: ${error.message}`);
    }
  }

  /**
   * Build file index from workspace using Tauri commands
   * @param {number} maxDepth - Maximum directory depth to traverse
   * @param {Array<string>} excludePatterns - Patterns to exclude from processing
   */
  async buildFileIndex(maxDepth = 10, excludePatterns = []) {
    try {
      
      // Use Tauri command to read workspace files
      const workspaceFiles = await invoke('read_workspace_files', {
        workspacePath: this.workspacePath
      });
      
      
      // Flatten the hierarchical structure and build index
      this.fileIndex = this.flattenFileStructure(workspaceFiles, excludePatterns, maxDepth);
      this.processingStats.totalFiles = this.fileIndex.length;
      
      
      // Store globally for wiki link resolution
      if (typeof globalThis !== 'undefined') {
        globalThis.__LOKUS_FILE_INDEX__ = this.fileIndex;
        globalThis.__LOKUS_WORKSPACE_PATH__ = this.workspacePath;
      }
      
      // If no files found, this is a problem
      if (this.fileIndex.length === 0) {
      }
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Flatten hierarchical file structure into a flat array
   * @param {Array} files - Hierarchical file structure from Tauri
   * @param {Array<string>} excludePatterns - Patterns to exclude
   * @param {number} maxDepth - Maximum depth to traverse
   * @param {number} currentDepth - Current traversal depth
   * @returns {Array} Flat array of file objects
   */
  flattenFileStructure(files, excludePatterns = [], maxDepth = 10, currentDepth = 0) {
    const result = [];
    
    if (currentDepth >= maxDepth) {
      return result;
    }
    
    for (const file of files) {
      // Skip excluded patterns
      if (excludePatterns.some(pattern => file.name.includes(pattern))) {
        continue;
      }
      
      const fileExtension = this.getFileExtension(file.name);
      const fileObj = {
        name: file.name,
        path: file.path,
        isDirectory: file.is_directory,
        extension: fileExtension,
        size: 0, // Will be populated when reading content
        lastModified: null // Will be populated when reading content
      };
      
      result.push(fileObj);
      
      // Recursively process children if it's a directory
      if (file.is_directory && file.children) {
        const childFiles = this.flattenFileStructure(
          file.children, 
          excludePatterns, 
          maxDepth, 
          currentDepth + 1
        );
        result.push(...childFiles);
      }
    }
    
    return result;
  }

  /**
   * Process files in batches to avoid overwhelming the system
   * @param {boolean} includeNonMarkdown - Whether to process non-markdown files
   * @param {Function} onProgress - Progress callback function
   */
  async processFilesInBatches(includeNonMarkdown = false, onProgress = null) {
    
    // Filter files to process
    const filesToProcess = this.fileIndex.filter(file => {
      if (file.isDirectory) return false;
      if (!includeNonMarkdown && !this.supportedExtensions.has(file.extension)) {
        return false;
      }
      return true;
    });
    
    
    // Process in batches
    for (let i = 0; i < filesToProcess.length; i += this.batchSize) {
      const batch = filesToProcess.slice(i, i + this.batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(file => this.processFile(file));
      await Promise.allSettled(batchPromises);
      
      this.processingStats.processedFiles += batch.length;
      
      // Report progress
      if (onProgress) {
        const progress = (this.processingStats.processedFiles / filesToProcess.length) * 100;
        onProgress({
          progress: Math.round(progress),
          processedFiles: this.processingStats.processedFiles,
          totalFiles: filesToProcess.length,
          currentFile: batch[batch.length - 1]?.name || ''
        });
      }
      
      // Small delay between batches to prevent overwhelming the system
      if (i + this.batchSize < filesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Process a single file to extract nodes and links
   * @param {Object} file - File object from index
   */
  async processFile(file) {
    try {
      // Create node for this file
      this.createFileNode(file);
      
      // Skip content processing for non-text files
      if (!this.supportedExtensions.has(file.extension)) {
        return;
      }
      
      // Read file content using Tauri command
      let content;
      try {
        content = await invoke('read_file_content', { path: file.path });
      } catch (error) {
        this.processingStats.errors++;
        return;
      }
      
      // Skip very large files
      if (content.length > this.maxFileSize) {
        return;
      }
      
      // Extract wiki links from content
      const links = this.extractWikiLinks(content);
      
      if (links.length > 0) {
      } else {
      }
      
      // Create edges for each link
      for (const link of links) {
        this.createLinkEdge(file, link);
      }
      
      // Update file metadata
      this.updateFileMetadata(file, content);
      
    } catch (error) {
      this.processingStats.errors++;
    }
  }

  /**
   * Extract wiki links from file content
   * @param {string} content - File content to parse
   * @returns {Array<{target: string, alias?: string, type: string}>} Array of extracted links
   */
  extractWikiLinks(content) {
    const links = [];
    
    // Regular expressions for different link types
    const patterns = [
      // Standard wiki links: [[Page]] or [[Page|Alias]]
      {
        regex: /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        type: 'wiki'
      },
      // Markdown links: [text](url)
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/g,
        type: 'markdown'
      },
      // Reference links: [text][ref]
      {
        regex: /\[([^\]]+)\]\[([^\]]*)\]/g,
        type: 'reference'
      },
      // HTML wiki links (from saved content): <a target="..." ...>
      {
        regex: /<a[^>]+target="([^"]+)"[^>]*>/g,
        type: 'html-wiki'
      }
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        let target, alias;
        
        if (pattern.type === 'wiki') {
          target = match[1].trim();
          alias = match[2] ? match[2].trim() : null;
        } else if (pattern.type === 'markdown') {
          alias = match[1].trim();
          target = match[2].trim();
        } else if (pattern.type === 'reference') {
          alias = match[1].trim();
          target = match[2].trim() || match[1].trim();
        } else if (pattern.type === 'html-wiki') {
          target = match[1].trim();
          alias = null; // Extract from inner text if needed
        }
        
        // Skip empty targets or external URLs
        if (!target || this.isExternalUrl(target)) {
          continue;
        }
        
        links.push({
          target: target,
          alias: alias,
          type: pattern.type,
          position: match.index
        });
        
        this.processingStats.totalLinks++;
      }
    }
    
    return links;
  }

  /**
   * Check if a target is an external URL
   * @param {string} target - Target to check
   * @returns {boolean} True if external URL
   */
  isExternalUrl(target) {
    return /^https?:\/\//.test(target) || /^mailto:/.test(target) || /^data:/.test(target);
  }

  /**
   * Create a node for a file using GraphDatabase
   * @param {Object} file - File object
   */
  createFileNode(file) {
    const nodeId = createNodeId(file.path); // Use centralized node ID generation
    const fileType = file.isDirectory ? 'folder' : file.extension;
    
    
    const nodeData = {
      title: file.name,
      type: fileType,
      path: file.path,
      isDirectory: file.isDirectory,
      size: this.calculateNodeSize(file),
      color: this.getNodeColor(fileType),
      extension: file.extension,
      isMarkdown: this.supportedExtensions.has(file.extension),
      lastModified: file.lastModified,
      metadata: {} // Initialize empty metadata object
    };
    
    this.graphDatabase.addNode(nodeId, nodeData);
  }

  /**
   * Create an edge for a wiki link using GraphDatabase
   * @param {Object} sourceFile - Source file object
   * @param {Object} link - Link object with target and metadata
   */
  createLinkEdge(sourceFile, link) {
    
    // Resolve the target file path
    let targetPath = this.resolveLinkTarget(link.target, sourceFile.path);
    
    if (!targetPath) {
      // Create a phantom node for unresolved links
      this.createPhantomNode(link.target);
      // Still create connection to phantom node
      targetPath = createPhantomNodeId(link.target);
    } else {
    }
    
    const sourceId = createNodeId(sourceFile.path);
    const targetId = targetPath.startsWith('phantom:') ? targetPath : createNodeId(targetPath);
    
    // Skip self-references
    if (sourceId === targetId) {
      return;
    }
    
    
    const connectionMetadata = {
      type: link.type,
      weight: 1,
      alias: link.alias,
      linkType: link.type,
      position: link.position,
      context: `Link from ${sourceFile.name}`,
      lineNumber: link.lineNumber || 0
    };
    
    this.graphDatabase.addConnection(sourceId, targetId, connectionMetadata);
  }

  /**
   * Create a phantom node for unresolved links using GraphDatabase
   * @param {string} target - Target that couldn't be resolved
   */
  createPhantomNode(target) {
    const nodeId = createPhantomNodeId(target);
    
    const nodeData = {
      title: target,
      type: 'phantom',
      path: null,
      isDirectory: false,
      size: 4, // Smaller size for phantom nodes
      color: '#ef4444', // Red for missing files
      isPhantom: true,
      originalTarget: target,
      metadata: {} // Initialize empty metadata object
    };
    
    this.graphDatabase.addNode(nodeId, nodeData);
  }

  /**
   * Resolve a wiki link target to an actual file path
   * @param {string} target - The link target to resolve
   * @param {string} sourcePath - Path of the file containing the link
   * @returns {string|null} Resolved file path or null if not found
   */
  resolveLinkTarget(target, sourcePath) {
    // Use PathUtils to get the expected normalized path
    const expectedPath = wikiLinkToPath(target, sourcePath);
    if (!expectedPath) return null;
    
    // First try exact match with the expected path
    const exactMatch = this.fileIndex.find(file => {
      const normalizedFilePath = normalizePath(file.path);
      return normalizedFilePath === expectedPath;
    });
    
    if (exactMatch) {
      return exactMatch.path;
    }
    
    // If no exact match, try alternative matching strategies
    const cleanTarget = target.split('|')[0].trim();
    
    // Find candidates by filename
    const candidates = this.fileIndex.filter(file => {
      const fileName = file.name;
      const fileNameWithoutExt = fileName.replace(/\.[^.]*$/, '');
      
      return fileName === cleanTarget || 
             fileName === `${cleanTarget}.md` ||
             fileNameWithoutExt === cleanTarget ||
             normalizePath(file.path).endsWith(expectedPath);
    });
    
    if (candidates.length === 0) {
      return null;
    }
    
    if (candidates.length === 1) {
      return candidates[0].path;
    }
    
    // Multiple candidates - prefer same directory
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const sameDir = candidates.find(file => file.path.startsWith(sourceDir));
    return sameDir ? sameDir.path : candidates[0].path;
  }

  /**
   * Calculate appropriate node size based on file properties
   * @param {Object} file - File object
   * @returns {number} Node size for visualization
   */
  calculateNodeSize(file) {
    if (file.isDirectory) {
      return 12; // Larger for directories
    }
    
    // Base size with some variation based on file type
    const baseSizes = {
      '.md': 8,
      '.txt': 6,
      '.org': 10,
      '.rst': 9,
      '.tex': 11
    };
    
    return baseSizes[file.extension] || 6;
  }

  /**
   * Get node color based on file type
   * @param {string} fileType - File type or extension
   * @returns {string} Hex color code
   */
  getNodeColor(fileType) {
    return this.fileTypeColors[fileType] || this.fileTypeColors.unknown;
  }

  /**
   * Update file metadata after processing content
   * @param {Object} file - File object to update
   * @param {string} content - File content
   */
  updateFileMetadata(file, content) {
    // Check if node exists in GraphDatabase using consistent node ID
    const nodeId = createNodeId(file.path);
    if (!this.graphDatabase.nodes.has(nodeId)) return;

    const node = this.graphDatabase.nodes.get(nodeId);

    // Update size based on content length
    const contentLength = content.length;
    const sizeMultiplier = Math.log10(Math.max(contentLength, 100)) / 5;
    node.size = Math.max(4, Math.min(20, node.size * sizeMultiplier));

    // Ensure metadata object exists
    if (!node.metadata) {
      node.metadata = {};
    }

    // Additional metadata
    node.metadata.content = content; // Store content for backlinks detection
    node.metadata.contentLength = contentLength;
    node.metadata.lineCount = content.split('\n').length;
    node.metadata.wordCount = content.split(/\s+/).length;
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename to analyze
   * @returns {string} File extension including the dot
   */
  getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '';
  }

  /**
   * Build final graph structure for visualization using GraphDatabase
   * @returns {Object} Graph data with nodes, edges, and statistics
   */
  buildGraphStructure() {
    // Export graph data from GraphDatabase
    const graphData = this.graphDatabase.exportGraphData({
      includeMetadata: true,
      includeWeights: true
    });
    
    
    // Transform nodes to match expected format
    const nodes = graphData.nodes.map(node => ({
      key: node.id,
      attributes: {
        label: node.label,
        x: Math.random() * 1000, // Will be positioned by layout algorithm
        y: Math.random() * 1000,
        size: node.size,
        color: node.color,
        type: node.type,
        path: node.path,
        isDirectory: node.isDirectory,
        extension: node.extension,
        isMarkdown: node.isMarkdown,
        isPhantom: node.isPhantom,
        lastModified: node.lastModified
      }
    }));
    
    // Transform edges to match expected format
    const edges = graphData.edges.map(edge => {
      const transformedEdge = {
        key: edge.id,
        source: edge.source,
        target: edge.target,
        attributes: {
          type: edge.type,
          weight: edge.size,
          size: edge.size || 4, // Edge thickness based on weight
          color: this.getEdgeColor(edge.type),
          alias: edge.alias,
          linkType: edge.linkType,
          position: edge.position,
          context: edge.context,
          lineNumber: edge.lineNumber
        }
      };
      return transformedEdge;
    });
    
    // Get statistics from GraphDatabase
    const dbStats = this.graphDatabase.getStatistics();
    
    const stats = {
      ...this.processingStats,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      fileTypeDistribution: dbStats.nodes.typeDistribution,
      averageConnections: dbStats.nodes.avgConnections,
      processingTimeMs: this.processingStats.endTime - this.processingStats.startTime,
      performance: dbStats.performance,
      health: dbStats.health
    };
    
    return {
      nodes,
      edges,
      stats
    };
  }

  /**
   * Get edge color based on link type
   * @param {string} linkType - Type of link
   * @returns {string} Hex color code
   */
  getEdgeColor(linkType) {
    // Make all edges white for visibility as requested
    return '#ffffff';
  }

  /**
   * Get processing statistics including GraphDatabase metrics
   * @returns {Object} Current processing statistics
   */
  getStats() {
    const dbStats = this.graphDatabase.getStatistics();
    return {
      ...this.processingStats,
      nodeCount: dbStats.nodes.total,
      edgeCount: dbStats.edges.total,
      performance: dbStats.performance,
      health: dbStats.health
    };
  }

  /**
   * Clear all processed data
   */
  clear() {
    this.fileIndex = [];
    this.graphDatabase.clear();
    this.processingStats = {
      totalFiles: 0,
      processedFiles: 0,
      totalLinks: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
  }
  
  /**
   * Get the GraphDatabase instance for external access
   * @returns {GraphDatabase} The graph database instance
   */
  getGraphDatabase() {
    return this.graphDatabase;
  }
  
  /**
   * Destroy the processor and clean up resources
   */
  destroy() {
    this.graphDatabase.destroy();
  }

  /**
   * Update graph data when files change using real-time GraphDatabase updates
   * @param {Array<string>} changedFiles - Paths of files that changed
   * @returns {Promise<Object>} Updated graph data
   */
  async updateChangedFiles(changedFiles) {
    
    const updatedFiles = [];
    
    for (const filePath of changedFiles) {
      try {
        // First try to find the file in existing index
        let fileObj = this.fileIndex.find(file => file.path === filePath);
        
        // If not found in index, create a file object manually
        if (!fileObj) {
          const fileName = filePath.split('/').pop();
          const extension = this.getFileExtension(fileName);
          
          fileObj = {
            name: fileName,
            path: filePath,
            isDirectory: false,
            extension: extension,
            size: 0,
            lastModified: new Date().toISOString()
          };
          
          // Add to file index for future reference
          this.fileIndex.push(fileObj);
        }
        
        // Read file content to extract new links
        let content = '';
        try {
          content = await invoke('read_file_content', { path: filePath });
        } catch (error) {
          continue;
        }
        
        // Extract new links from content
        const newLinks = this.extractWikiLinks(content).map(link => {
          const resolvedTarget = this.resolveLinkTarget(link.target, filePath);
          return resolvedTarget || `phantom:${link.target}`;
        });
        
        // Use GraphDatabase's real-time update method
        const updateResult = this.graphDatabase.updateFileLinks(filePath, newLinks);
        
        // Ensure the file node exists with updated metadata
        this.createFileNode(fileObj);
        
        updatedFiles.push(filePath);
        
      } catch (error) {
        this.processingStats.errors++;
      }
    }
    
    return this.buildGraphStructure();
  }
  
  /**
   * Real-time update for a single file when content changes
   * @param {string} filePath - Path of the file that changed
   * @param {string} content - New content of the file
   * @returns {Promise<Object>} Update result
   */
  async updateFileContent(filePath, content) {

    try {
      // Extract new links from content
      const newLinks = this.extractWikiLinks(content).map(link => {
        const resolvedTarget = this.resolveLinkTarget(link.target, filePath);
        return resolvedTarget || `phantom:${link.target}`;
      });

      // Use GraphDatabase's real-time update method
      const updateResult = this.graphDatabase.updateFileLinks(filePath, newLinks);

      // Update node metadata with new content for backlinks detection
      const nodeId = createNodeId(filePath);
      if (this.graphDatabase.nodes.has(nodeId)) {
        const node = this.graphDatabase.nodes.get(nodeId);
        if (!node.metadata) {
          node.metadata = {};
        }
        node.metadata.content = content;
        node.metadata.contentLength = content.length;
        node.metadata.lineCount = content.split('\n').length;
        node.metadata.wordCount = content.split(/\s+/).length;
      }

      return updateResult;

    } catch (error) {
      throw error;
    }
  }
}

export default GraphDataProcessor;