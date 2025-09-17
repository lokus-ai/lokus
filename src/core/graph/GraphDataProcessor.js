import { invoke } from "@tauri-apps/api/core";

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
    this.nodes = new Map();
    this.edges = new Map();
    this.fileTypes = new Map();
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
    console.log('🔍 Starting graph data processing for workspace:', this.workspacePath);

    try {
      // Step 1: Read workspace file structure
      await this.buildFileIndex(maxDepth, excludePatterns);
      
      // Step 2: Process files in batches
      await this.processFilesInBatches(includeNonMarkdown, onProgress);
      
      // Step 3: Build final graph structure
      const graphData = this.buildGraphStructure();
      
      this.processingStats.endTime = Date.now();
      const processingTime = this.processingStats.endTime - this.processingStats.startTime;
      
      console.log(`✅ Graph processing completed in ${processingTime}ms`, {
        nodes: graphData.nodes.length,
        edges: graphData.edges.length,
        stats: this.processingStats
      });
      
      return graphData;
      
    } catch (error) {
      console.error('❌ Failed to build graph from workspace:', error);
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
      console.log('📁 Building file index...');
      
      // Use Tauri command to read workspace files
      const workspaceFiles = await invoke('read_workspace_files', {
        workspacePath: this.workspacePath
      });
      
      // Flatten the hierarchical structure and build index
      this.fileIndex = this.flattenFileStructure(workspaceFiles, excludePatterns, maxDepth);
      this.processingStats.totalFiles = this.fileIndex.length;
      
      console.log(`📊 File index built: ${this.fileIndex.length} files found`);
      
      // Store globally for wiki link resolution
      if (typeof globalThis !== 'undefined') {
        globalThis.__LOKUS_FILE_INDEX__ = this.fileIndex;
        globalThis.__LOKUS_WORKSPACE_PATH__ = this.workspacePath;
      }
      
    } catch (error) {
      console.error('Failed to build file index:', error);
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
    console.log('🔄 Processing files in batches...');
    
    // Filter files to process
    const filesToProcess = this.fileIndex.filter(file => {
      if (file.isDirectory) return false;
      if (!includeNonMarkdown && !this.supportedExtensions.has(file.extension)) {
        return false;
      }
      return true;
    });
    
    console.log(`📝 Processing ${filesToProcess.length} files (batch size: ${this.batchSize})`);
    
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
        console.warn(`Could not read file ${file.path}:`, error.message);
        this.processingStats.errors++;
        return;
      }
      
      // Skip very large files
      if (content.length > this.maxFileSize) {
        console.warn(`Skipping large file ${file.path} (${content.length} bytes)`);
        return;
      }
      
      // Extract wiki links from content
      const links = this.extractWikiLinks(content);
      
      // Create edges for each link
      for (const link of links) {
        this.createLinkEdge(file, link);
      }
      
      // Update file metadata
      this.updateFileMetadata(file, content);
      
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
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
   * Create a node for a file
   * @param {Object} file - File object
   */
  createFileNode(file) {
    const nodeId = file.path;
    const fileType = file.isDirectory ? 'folder' : file.extension;
    
    const node = {
      id: nodeId,
      label: file.name,
      type: fileType,
      path: file.path,
      isDirectory: file.isDirectory,
      size: this.calculateNodeSize(file),
      color: this.getNodeColor(fileType),
      metadata: {
        extension: file.extension,
        isMarkdown: this.supportedExtensions.has(file.extension),
        linkCount: 0, // Will be updated as edges are created
        backlinks: [], // Files that link to this file
        lastModified: file.lastModified
      }
    };
    
    this.nodes.set(nodeId, node);
    this.fileTypes.set(nodeId, fileType);
  }

  /**
   * Create an edge for a wiki link
   * @param {Object} sourceFile - Source file object
   * @param {Object} link - Link object with target and metadata
   */
  createLinkEdge(sourceFile, link) {
    // Resolve the target file path
    const targetPath = this.resolveLinkTarget(link.target, sourceFile.path);
    
    if (!targetPath) {
      // Create a phantom node for unresolved links
      this.createPhantomNode(link.target);
      return;
    }
    
    const edgeId = `${sourceFile.path}:${targetPath}`;
    const sourceId = sourceFile.path;
    const targetId = targetPath;
    
    // Skip self-references
    if (sourceId === targetId) {
      return;
    }
    
    const edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: link.type,
      weight: 1, // Could be increased for multiple references
      metadata: {
        alias: link.alias,
        linkType: link.type,
        position: link.position
      }
    };
    
    this.edges.set(edgeId, edge);
    
    // Update node metadata
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    
    if (sourceNode) {
      sourceNode.metadata.linkCount++;
    }
    
    if (targetNode) {
      targetNode.metadata.backlinks.push(sourceId);
    }
  }

  /**
   * Create a phantom node for unresolved links
   * @param {string} target - Target that couldn't be resolved
   */
  createPhantomNode(target) {
    const nodeId = `phantom:${target}`;
    
    if (this.nodes.has(nodeId)) {
      return; // Already exists
    }
    
    const node = {
      id: nodeId,
      label: target,
      type: 'phantom',
      path: null,
      isDirectory: false,
      size: 4, // Smaller size for phantom nodes
      color: '#ef4444', // Red for missing files
      metadata: {
        isPhantom: true,
        originalTarget: target,
        linkCount: 0,
        backlinks: []
      }
    };
    
    this.nodes.set(nodeId, node);
  }

  /**
   * Resolve a wiki link target to an actual file path
   * @param {string} target - The link target to resolve
   * @param {string} sourcePath - Path of the file containing the link
   * @returns {string|null} Resolved file path or null if not found
   */
  resolveLinkTarget(target, sourcePath) {
    // Remove alias part if present
    const cleanTarget = target.split('|')[0].trim();
    
    if (!cleanTarget) return null;
    
    // If target includes path separators, try exact match
    if (/[/\\]/.test(cleanTarget)) {
      const exactMatch = this.fileIndex.find(file => 
        file.path.endsWith(cleanTarget) || file.path === cleanTarget
      );
      return exactMatch ? exactMatch.path : null;
    }
    
    // Get source directory for relative resolution
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    
    // Find candidates by filename
    const candidates = this.fileIndex.filter(file => {
      const fileName = file.name;
      const fileNameWithoutExt = fileName.replace(/\.[^.]*$/, '');
      
      return fileName === cleanTarget || 
             fileName === `${cleanTarget}.md` ||
             fileNameWithoutExt === cleanTarget;
    });
    
    if (candidates.length === 0) {
      return null;
    }
    
    if (candidates.length === 1) {
      return candidates[0].path;
    }
    
    // Multiple candidates - prefer same directory
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
    const node = this.nodes.get(file.path);
    if (!node) return;
    
    // Update size based on content length
    const contentLength = content.length;
    const sizeMultiplier = Math.log10(Math.max(contentLength, 100)) / 5;
    node.size = Math.max(4, Math.min(20, node.size * sizeMultiplier));
    
    // Additional metadata
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
   * Build final graph structure for visualization
   * @returns {Object} Graph data with nodes, edges, and statistics
   */
  buildGraphStructure() {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      key: node.id,
      attributes: {
        label: node.label,
        x: Math.random() * 1000, // Will be positioned by layout algorithm
        y: Math.random() * 1000,
        size: node.size,
        color: node.color,
        type: node.type,
        ...node.metadata
      }
    }));
    
    const edges = Array.from(this.edges.values()).map(edge => ({
      key: edge.id,
      source: edge.source,
      target: edge.target,
      attributes: {
        type: edge.type,
        weight: edge.weight,
        size: edge.weight, // Edge thickness based on weight
        color: this.getEdgeColor(edge.type),
        ...edge.metadata
      }
    }));
    
    // Calculate additional statistics
    const fileTypeStats = {};
    for (const [, type] of this.fileTypes) {
      fileTypeStats[type] = (fileTypeStats[type] || 0) + 1;
    }
    
    const stats = {
      ...this.processingStats,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      fileTypeDistribution: fileTypeStats,
      averageConnections: edges.length / Math.max(nodes.length, 1),
      processingTimeMs: this.processingStats.endTime - this.processingStats.startTime
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
    const colors = {
      'wiki': '#6b7280',
      'markdown': '#3b82f6',
      'reference': '#8b5cf6',
      'default': '#d1d5db'
    };
    
    return colors[linkType] || colors.default;
  }

  /**
   * Get processing statistics
   * @returns {Object} Current processing statistics
   */
  getStats() {
    return {
      ...this.processingStats,
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      fileTypeCount: this.fileTypes.size
    };
  }

  /**
   * Clear all processed data
   */
  clear() {
    this.fileIndex = [];
    this.nodes.clear();
    this.edges.clear();
    this.fileTypes.clear();
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
   * Update graph data when files change
   * @param {Array<string>} changedFiles - Paths of files that changed
   * @returns {Promise<Object>} Updated graph data
   */
  async updateChangedFiles(changedFiles) {
    console.log('🔄 Updating graph data for changed files:', changedFiles);
    
    // Remove old data for changed files
    for (const filePath of changedFiles) {
      this.nodes.delete(filePath);
      
      // Remove edges that involve this file
      for (const [edgeId, edge] of this.edges) {
        if (edge.source === filePath || edge.target === filePath) {
          this.edges.delete(edgeId);
        }
      }
    }
    
    // Re-process changed files
    const changedFileObjects = this.fileIndex.filter(file => 
      changedFiles.includes(file.path)
    );
    
    for (const file of changedFileObjects) {
      await this.processFile(file);
    }
    
    return this.buildGraphStructure();
  }
}

export default GraphDataProcessor;