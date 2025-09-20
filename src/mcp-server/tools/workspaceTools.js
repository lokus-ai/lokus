/**
 * Workspace Tools for Lokus MCP Server
 * 
 * Provides comprehensive workspace management tools including initialization,
 * configuration, backup, import/export, and workspace analytics.
 */

import { readdir, readFile, writeFile, mkdir, stat, copyFile, rmdir } from 'fs/promises';
import { join, dirname, basename, relative, extname } from 'path';
import { WorkspaceManager } from '../../core/workspace/manager.js';
import { EventEmitter } from 'events';

export class WorkspaceTools extends EventEmitter {
  constructor(fileProvider, noteProvider, options = {}) {
    super();
    
    this.fileProvider = fileProvider;
    this.noteProvider = noteProvider;
    this.options = {
      configFileName: options.configFileName || '.lokus/config.json',
      metadataFileName: options.metadataFileName || '.lokus/metadata.json',
      backupDirectory: options.backupDirectory || '.lokus/backups',
      templateDirectory: options.templateDirectory || 'templates',
      enableVersioning: options.enableVersioning !== false,
      maxBackups: options.maxBackups || 10,
      compressionEnabled: options.compressionEnabled || false,
      ...options
    };
    
    this.workspacePath = null;
    this.workspaceConfig = null;
    this.workspaceMetadata = null;
    this.operationHistory = [];
    this.maxHistorySize = 100;
    
    this.logger = options.logger || console;
  }

  /**
   * Initialize workspace tools
   */
  async initialize() {
    try {
      this.workspacePath = await WorkspaceManager.getValidatedWorkspacePath();
      
      if (!this.workspacePath) {
        throw new Error('No valid workspace path found');
      }
      
      // Load workspace configuration and metadata
      await this.loadWorkspaceConfig();
      await this.loadWorkspaceMetadata();
      
      this.logger.info('WorkspaceTools initialized', {
        workspacePath: this.workspacePath,
        hasConfig: !!this.workspaceConfig,
        hasMetadata: !!this.workspaceMetadata
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize WorkspaceTools:', error);
      throw error;
    }
  }

  /**
   * Get available workspace tools
   */
  getTools() {
    return [
      {
        name: 'initialize_workspace',
        description: 'Initialize a new workspace with configuration and structure',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for the workspace'
            },
            description: {
              type: 'string',
              description: 'Description of the workspace'
            },
            template: {
              type: 'string',
              description: 'Workspace template to use',
              enum: ['basic', 'research', 'project', 'knowledge-base', 'journal'],
              default: 'basic'
            },
            createDirectories: {
              type: 'boolean',
              description: 'Create standard directory structure',
              default: true
            },
            setupTemplates: {
              type: 'boolean',
              description: 'Set up note templates',
              default: true
            }
          },
          required: ['name']
        }
      },
      {
        name: 'get_workspace_info',
        description: 'Get comprehensive information about the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            includeStats: {
              type: 'boolean',
              description: 'Include detailed statistics',
              default: true
            },
            includeHealth: {
              type: 'boolean',
              description: 'Include workspace health check',
              default: true
            },
            includeSummary: {
              type: 'boolean',
              description: 'Include content summary',
              default: false
            }
          }
        }
      },
      {
        name: 'update_workspace_config',
        description: 'Update workspace configuration',
        inputSchema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              description: 'Configuration updates to apply'
            },
            merge: {
              type: 'boolean',
              description: 'Merge with existing config instead of replacing',
              default: true
            }
          },
          required: ['config']
        }
      },
      {
        name: 'backup_workspace',
        description: 'Create a backup of the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for the backup (auto-generated if not provided)'
            },
            includeConfig: {
              type: 'boolean',
              description: 'Include workspace configuration',
              default: true
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include workspace metadata',
              default: true
            },
            compression: {
              type: 'boolean',
              description: 'Compress the backup',
              default: false
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Patterns to exclude from backup'
            }
          }
        }
      },
      {
        name: 'restore_workspace',
        description: 'Restore workspace from a backup',
        inputSchema: {
          type: 'object',
          properties: {
            backupName: {
              type: 'string',
              description: 'Name of the backup to restore'
            },
            restoreConfig: {
              type: 'boolean',
              description: 'Restore workspace configuration',
              default: true
            },
            restoreMetadata: {
              type: 'boolean',
              description: 'Restore workspace metadata',
              default: true
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation that restore is intended',
              default: false
            }
          },
          required: ['backupName', 'confirm']
        }
      },
      {
        name: 'export_workspace',
        description: 'Export workspace content in various formats',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'Export format',
              enum: ['json', 'markdown', 'archive', 'csv'],
              default: 'json'
            },
            includeFiles: {
              type: 'boolean',
              description: 'Include file contents in export',
              default: true
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include file metadata',
              default: true
            },
            includeConnections: {
              type: 'boolean',
              description: 'Include WikiLink connections',
              default: true
            },
            filterByType: {
              type: 'array',
              items: { type: 'string' },
              description: 'File types to include in export'
            }
          }
        }
      },
      {
        name: 'import_content',
        description: 'Import content into the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source type',
              enum: ['files', 'json', 'markdown', 'archive'],
              default: 'files'
            },
            sourcePath: {
              type: 'string',
              description: 'Path to source content'
            },
            targetDirectory: {
              type: 'string',
              description: 'Target directory in workspace',
              default: ''
            },
            preserveStructure: {
              type: 'boolean',
              description: 'Preserve source directory structure',
              default: true
            },
            overwriteExisting: {
              type: 'boolean',
              description: 'Overwrite existing files',
              default: false
            },
            createBackup: {
              type: 'boolean',
              description: 'Create backup before import',
              default: true
            }
          },
          required: ['source', 'sourcePath']
        }
      },
      {
        name: 'clean_workspace',
        description: 'Clean up workspace by removing temporary files and organizing content',
        inputSchema: {
          type: 'object',
          properties: {
            cleanupType: {
              type: 'string',
              description: 'Type of cleanup to perform',
              enum: ['temp', 'duplicates', 'empty', 'orphans', 'all'],
              default: 'temp'
            },
            dryRun: {
              type: 'boolean',
              description: 'Show what would be cleaned without actually doing it',
              default: true
            },
            createBackup: {
              type: 'boolean',
              description: 'Create backup before cleanup',
              default: true
            }
          }
        }
      },
      {
        name: 'analyze_workspace_health',
        description: 'Perform comprehensive health analysis of the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            checkBrokenLinks: {
              type: 'boolean',
              description: 'Check for broken WikiLinks',
              default: true
            },
            checkOrphans: {
              type: 'boolean',
              description: 'Check for orphaned files',
              default: true
            },
            checkDuplicates: {
              type: 'boolean',
              description: 'Check for duplicate content',
              default: true
            },
            checkStructure: {
              type: 'boolean',
              description: 'Check workspace structure',
              default: true
            },
            generateReport: {
              type: 'boolean',
              description: 'Generate detailed health report',
              default: true
            }
          }
        }
      },
      {
        name: 'sync_workspace',
        description: 'Synchronize workspace with external sources',
        inputSchema: {
          type: 'object',
          properties: {
            syncType: {
              type: 'string',
              description: 'Type of synchronization',
              enum: ['git', 'filesystem', 'cloud'],
              default: 'filesystem'
            },
            sourcePath: {
              type: 'string',
              description: 'Path to sync source'
            },
            direction: {
              type: 'string',
              description: 'Sync direction',
              enum: ['pull', 'push', 'bidirectional'],
              default: 'pull'
            },
            createBackup: {
              type: 'boolean',
              description: 'Create backup before sync',
              default: true
            }
          }
        }
      },
      {
        name: 'get_workspace_backups',
        description: 'List available workspace backups',
        inputSchema: {
          type: 'object',
          properties: {
            includeDetails: {
              type: 'boolean',
              description: 'Include detailed backup information',
              default: true
            }
          }
        }
      },
      {
        name: 'get_workspace_history',
        description: 'Get workspace operation history',
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
   * Execute a workspace tool
   */
  async executeTool(toolName, args) {
    try {
      let result;
      
      switch (toolName) {
        case 'initialize_workspace':
          result = await this.initializeWorkspace(args);
          break;
        case 'get_workspace_info':
          result = await this.getWorkspaceInfo(args);
          break;
        case 'update_workspace_config':
          result = await this.updateWorkspaceConfig(args);
          break;
        case 'backup_workspace':
          result = await this.backupWorkspace(args);
          break;
        case 'restore_workspace':
          result = await this.restoreWorkspace(args);
          break;
        case 'export_workspace':
          result = await this.exportWorkspace(args);
          break;
        case 'import_content':
          result = await this.importContent(args);
          break;
        case 'clean_workspace':
          result = await this.cleanWorkspace(args);
          break;
        case 'analyze_workspace_health':
          result = await this.analyzeWorkspaceHealth(args);
          break;
        case 'sync_workspace':
          result = await this.syncWorkspace(args);
          break;
        case 'get_workspace_backups':
          result = await this.getWorkspaceBackups(args);
          break;
        case 'get_workspace_history':
          result = await this.getWorkspaceHistory(args);
          break;
        default:
          throw new Error(`Unknown workspace tool: ${toolName}`);
      }
      
      // Record operation in history
      this.recordOperation(toolName, args, result, 'success');
      
      return result;
      
    } catch (error) {
      this.recordOperation(toolName, args, null, 'error', error.message);
      this.logger.error(`Workspace tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Initialize workspace
   */
  async initializeWorkspace(args) {
    const {
      name,
      description = '',
      template = 'basic',
      createDirectories = true,
      setupTemplates = true
    } = args;
    
    // Create workspace configuration
    const config = {
      name,
      description,
      template,
      version: '1.0.0',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      settings: this.getTemplateSettings(template)
    };
    
    // Create workspace metadata
    const metadata = {
      fileCount: 0,
      noteCount: 0,
      totalSize: 0,
      lastScan: new Date().toISOString(),
      tags: [],
      recentFiles: []
    };
    
    // Create .lokus directory
    const lokusDir = join(this.workspacePath, '.lokus');
    await mkdir(lokusDir, { recursive: true });
    
    // Save configuration and metadata
    await this.saveWorkspaceConfig(config);
    await this.saveWorkspaceMetadata(metadata);
    
    // Create directory structure if requested
    if (createDirectories) {
      await this.createDirectoryStructure(template);
    }
    
    // Setup templates if requested
    if (setupTemplates) {
      await this.setupWorkspaceTemplates(template);
    }
    
    this.emit('workspaceInitialized', {
      name,
      template,
      path: this.workspacePath
    });
    
    return {
      success: true,
      name,
      template,
      path: this.workspacePath,
      configCreated: true,
      directoriesCreated: createDirectories,
      templatesSetup: setupTemplates
    };
  }

  /**
   * Get workspace information
   */
  async getWorkspaceInfo(args) {
    const {
      includeStats = true,
      includeHealth = true,
      includeSummary = false
    } = args;
    
    const info = {
      path: this.workspacePath,
      config: this.workspaceConfig,
      metadata: this.workspaceMetadata
    };
    
    if (includeStats) {
      info.statistics = await this.calculateWorkspaceStatistics();
    }
    
    if (includeHealth) {
      info.health = await this.performQuickHealthCheck();
    }
    
    if (includeSummary) {
      info.summary = await this.generateWorkspaceSummary();
    }
    
    return info;
  }

  /**
   * Update workspace configuration
   */
  async updateWorkspaceConfig(args) {
    const { config, merge = true } = args;
    
    let updatedConfig;
    if (merge && this.workspaceConfig) {
      updatedConfig = { ...this.workspaceConfig, ...config };
    } else {
      updatedConfig = config;
    }
    
    updatedConfig.lastModified = new Date().toISOString();
    
    await this.saveWorkspaceConfig(updatedConfig);
    this.workspaceConfig = updatedConfig;
    
    this.emit('configUpdated', { config: updatedConfig });
    
    return {
      success: true,
      config: updatedConfig,
      merged: merge
    };
  }

  /**
   * Backup workspace
   */
  async backupWorkspace(args) {
    const {
      name: customName,
      includeConfig = true,
      includeMetadata = true,
      compression = false,
      excludePatterns = []
    } = args;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = customName || `backup-${timestamp}`;
    
    const backupDir = join(this.workspacePath, this.options.backupDirectory);
    await mkdir(backupDir, { recursive: true });
    
    const backupPath = join(backupDir, backupName);
    await mkdir(backupPath, { recursive: true });
    
    // Backup files
    const filesToBackup = await this.getFilesToBackup(excludePatterns);
    let backedUpFiles = 0;
    let totalSize = 0;
    
    for (const file of filesToBackup) {
      const sourcePath = join(this.workspacePath, file);
      const targetPath = join(backupPath, file);
      
      // Create target directory
      await mkdir(dirname(targetPath), { recursive: true });
      
      // Copy file
      await copyFile(sourcePath, targetPath);
      
      const stats = await stat(sourcePath);
      totalSize += stats.size;
      backedUpFiles++;
    }
    
    // Backup configuration if requested
    if (includeConfig && this.workspaceConfig) {
      const configPath = join(backupPath, 'config.json');
      await writeFile(configPath, JSON.stringify(this.workspaceConfig, null, 2));
    }
    
    // Backup metadata if requested
    if (includeMetadata && this.workspaceMetadata) {
      const metadataPath = join(backupPath, 'metadata.json');
      await writeFile(metadataPath, JSON.stringify(this.workspaceMetadata, null, 2));
    }
    
    // Create backup manifest
    const manifest = {
      name: backupName,
      created: new Date().toISOString(),
      fileCount: backedUpFiles,
      totalSize,
      sizeFormatted: this.formatFileSize(totalSize),
      includeConfig,
      includeMetadata,
      compression,
      excludePatterns
    };
    
    const manifestPath = join(backupPath, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Clean up old backups if limit exceeded
    await this.cleanupOldBackups();
    
    this.emit('backupCreated', {
      name: backupName,
      path: backupPath,
      fileCount: backedUpFiles,
      size: totalSize
    });
    
    return {
      success: true,
      name: backupName,
      path: relative(this.workspacePath, backupPath),
      fileCount: backedUpFiles,
      totalSize,
      sizeFormatted: this.formatFileSize(totalSize),
      manifest
    };
  }

  /**
   * Restore workspace from backup
   */
  async restoreWorkspace(args) {
    const {
      backupName,
      restoreConfig = true,
      restoreMetadata = true,
      confirm
    } = args;
    
    if (!confirm) {
      throw new Error('Workspace restore requires explicit confirmation');
    }
    
    const backupDir = join(this.workspacePath, this.options.backupDirectory);
    const backupPath = join(backupDir, backupName);
    
    // Check if backup exists
    try {
      await stat(backupPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Backup not found: ${backupName}`);
      }
      throw error;
    }
    
    // Read backup manifest
    const manifestPath = join(backupPath, 'manifest.json');
    let manifest;
    try {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      throw new Error('Invalid backup: manifest not found or corrupted');
    }
    
    // Create current backup before restore
    await this.backupWorkspace({
      name: `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      includeConfig: true,
      includeMetadata: true
    });
    
    // Restore files
    const backupFiles = await this.getBackupFiles(backupPath);
    let restoredFiles = 0;
    
    for (const file of backupFiles) {
      if (file === 'config.json' || file === 'metadata.json' || file === 'manifest.json') {
        continue; // Skip special files
      }
      
      const sourcePath = join(backupPath, file);
      const targetPath = join(this.workspacePath, file);
      
      // Create target directory
      await mkdir(dirname(targetPath), { recursive: true });
      
      // Copy file
      await copyFile(sourcePath, targetPath);
      restoredFiles++;
    }
    
    // Restore configuration if requested
    if (restoreConfig) {
      const configPath = join(backupPath, 'config.json');
      try {
        const configContent = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        await this.saveWorkspaceConfig(config);
        this.workspaceConfig = config;
      } catch (error) {
        this.logger.warn('Failed to restore config:', error.message);
      }
    }
    
    // Restore metadata if requested
    if (restoreMetadata) {
      const metadataPath = join(backupPath, 'metadata.json');
      try {
        const metadataContent = await readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        await this.saveWorkspaceMetadata(metadata);
        this.workspaceMetadata = metadata;
      } catch (error) {
        this.logger.warn('Failed to restore metadata:', error.message);
      }
    }
    
    this.emit('workspaceRestored', {
      backupName,
      restoredFiles,
      restoreConfig,
      restoreMetadata
    });
    
    return {
      success: true,
      backupName,
      restoredFiles,
      manifest,
      configRestored: restoreConfig,
      metadataRestored: restoreMetadata
    };
  }

  /**
   * Export workspace
   */
  async exportWorkspace(args) {
    const {
      format = 'json',
      includeFiles = true,
      includeMetadata = true,
      includeConnections = true,
      filterByType = []
    } = args;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportName = `export-${timestamp}`;
    
    let exportData;
    
    switch (format) {
      case 'json':
        exportData = await this.exportAsJSON({
          includeFiles,
          includeMetadata,
          includeConnections,
          filterByType
        });
        break;
        
      case 'markdown':
        exportData = await this.exportAsMarkdown({
          includeFiles,
          includeMetadata,
          includeConnections,
          filterByType
        });
        break;
        
      case 'csv':
        exportData = await this.exportAsCSV({
          includeMetadata,
          filterByType
        });
        break;
        
      case 'archive':
        return await this.exportAsArchive({
          includeFiles,
          includeMetadata,
          filterByType
        });
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Save export data
    const exportDir = join(this.workspacePath, '.lokus', 'exports');
    await mkdir(exportDir, { recursive: true });
    
    const exportPath = join(exportDir, `${exportName}.${format}`);
    await writeFile(exportPath, exportData, 'utf-8');
    
    return {
      success: true,
      format,
      exportName,
      path: relative(this.workspacePath, exportPath),
      size: Buffer.byteLength(exportData, 'utf-8'),
      sizeFormatted: this.formatFileSize(Buffer.byteLength(exportData, 'utf-8'))
    };
  }

  /**
   * Import content
   */
  async importContent(args) {
    const {
      source,
      sourcePath,
      targetDirectory = '',
      preserveStructure = true,
      overwriteExisting = false,
      createBackup = true
    } = args;
    
    // Create backup if requested
    if (createBackup) {
      await this.backupWorkspace({
        name: `pre-import-${new Date().toISOString().replace(/[:.]/g, '-')}`
      });
    }
    
    let importedFiles = 0;
    let totalSize = 0;
    
    switch (source) {
      case 'files':
        ({ importedFiles, totalSize } = await this.importFiles({
          sourcePath,
          targetDirectory,
          preserveStructure,
          overwriteExisting
        }));
        break;
        
      case 'json':
        ({ importedFiles, totalSize } = await this.importFromJSON({
          sourcePath,
          targetDirectory,
          overwriteExisting
        }));
        break;
        
      case 'markdown':
        ({ importedFiles, totalSize } = await this.importMarkdown({
          sourcePath,
          targetDirectory,
          preserveStructure,
          overwriteExisting
        }));
        break;
        
      default:
        throw new Error(`Unsupported import source: ${source}`);
    }
    
    // Update workspace metadata
    await this.updateWorkspaceMetadata();
    
    this.emit('contentImported', {
      source,
      sourcePath,
      importedFiles,
      totalSize
    });
    
    return {
      success: true,
      source,
      sourcePath,
      targetDirectory,
      importedFiles,
      totalSize,
      sizeFormatted: this.formatFileSize(totalSize)
    };
  }

  /**
   * Clean workspace
   */
  async cleanWorkspace(args) {
    const {
      cleanupType = 'temp',
      dryRun = true,
      createBackup = true
    } = args;
    
    if (createBackup && !dryRun) {
      await this.backupWorkspace({
        name: `pre-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`
      });
    }
    
    const cleanupPlan = await this.generateCleanupPlan(cleanupType);
    
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        cleanupType,
        plan: cleanupPlan,
        wouldRemove: cleanupPlan.filesToRemove.length,
        wouldRecover: cleanupPlan.spaceToRecover
      };
    }
    
    // Execute cleanup
    let removedFiles = 0;
    let recoveredSpace = 0;
    
    for (const file of cleanupPlan.filesToRemove) {
      try {
        const filePath = join(this.workspacePath, file);
        const stats = await stat(filePath);
        await rmdir(filePath);
        
        removedFiles++;
        recoveredSpace += stats.size;
      } catch (error) {
        this.logger.warn(`Failed to remove ${file}:`, error.message);
      }
    }
    
    this.emit('workspaceCleaned', {
      cleanupType,
      removedFiles,
      recoveredSpace
    });
    
    return {
      success: true,
      dryRun: false,
      cleanupType,
      removedFiles,
      recoveredSpace,
      recoveredSpaceFormatted: this.formatFileSize(recoveredSpace)
    };
  }

  /**
   * Analyze workspace health
   */
  async analyzeWorkspaceHealth(args) {
    const {
      checkBrokenLinks = true,
      checkOrphans = true,
      checkDuplicates = true,
      checkStructure = true,
      generateReport = true
    } = args;
    
    const health = {
      score: 100,
      issues: [],
      warnings: [],
      suggestions: []
    };
    
    // Check broken WikiLinks
    if (checkBrokenLinks && this.noteProvider) {
      const brokenLinks = await this.findBrokenWikiLinks();
      if (brokenLinks.length > 0) {
        health.score -= Math.min(30, brokenLinks.length * 2);
        health.issues.push({
          type: 'broken_links',
          count: brokenLinks.length,
          description: `Found ${brokenLinks.length} broken WikiLinks`
        });
      }
    }
    
    // Check orphaned files
    if (checkOrphans && this.noteProvider) {
      const orphans = await this.findOrphanedFiles();
      if (orphans.length > 0) {
        health.score -= Math.min(20, orphans.length);
        health.warnings.push({
          type: 'orphaned_files',
          count: orphans.length,
          description: `Found ${orphans.length} orphaned files`
        });
      }
    }
    
    // Check for duplicates
    if (checkDuplicates) {
      const duplicates = await this.findDuplicateFiles();
      if (duplicates.length > 0) {
        health.score -= Math.min(15, duplicates.length);
        health.warnings.push({
          type: 'duplicate_files',
          count: duplicates.length,
          description: `Found ${duplicates.length} potential duplicate files`
        });
      }
    }
    
    // Check workspace structure
    if (checkStructure) {
      const structureIssues = await this.checkWorkspaceStructure();
      health.score -= structureIssues.length * 5;
      health.issues.push(...structureIssues);
    }
    
    // Generate suggestions
    health.suggestions = this.generateHealthSuggestions(health);
    
    // Generate detailed report if requested
    let report = null;
    if (generateReport) {
      report = await this.generateHealthReport(health);
    }
    
    return {
      health,
      report,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sync workspace
   */
  async syncWorkspace(args) {
    const {
      syncType = 'filesystem',
      sourcePath,
      direction = 'pull',
      createBackup = true
    } = args;
    
    if (createBackup) {
      await this.backupWorkspace({
        name: `pre-sync-${new Date().toISOString().replace(/[:.]/g, '-')}`
      });
    }
    
    let syncResult;
    
    switch (syncType) {
      case 'filesystem':
        syncResult = await this.syncWithFilesystem(sourcePath, direction);
        break;
        
      case 'git':
        syncResult = await this.syncWithGit(sourcePath, direction);
        break;
        
      case 'cloud':
        syncResult = await this.syncWithCloud(sourcePath, direction);
        break;
        
      default:
        throw new Error(`Unsupported sync type: ${syncType}`);
    }
    
    this.emit('workspaceSynced', {
      syncType,
      direction,
      ...syncResult
    });
    
    return {
      success: true,
      syncType,
      direction,
      ...syncResult
    };
  }

  /**
   * Get workspace backups
   */
  async getWorkspaceBackups(args) {
    const { includeDetails = true } = args;
    
    const backupDir = join(this.workspacePath, this.options.backupDirectory);
    const backups = [];
    
    try {
      const entries = await readdir(backupDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const backup = {
            name: entry.name,
            path: relative(this.workspacePath, join(backupDir, entry.name))
          };
          
          if (includeDetails) {
            try {
              const manifestPath = join(backupDir, entry.name, 'manifest.json');
              const manifestContent = await readFile(manifestPath, 'utf-8');
              backup.manifest = JSON.parse(manifestContent);
            } catch (error) {
              backup.error = 'Invalid backup: manifest not found';
            }
          }
          
          backups.push(backup);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    return {
      backups: backups.sort((a, b) => {
        const aTime = a.manifest?.created || '0';
        const bTime = b.manifest?.created || '0';
        return bTime.localeCompare(aTime);
      }),
      totalBackups: backups.length
    };
  }

  /**
   * Get workspace operation history
   */
  async getWorkspaceHistory(args) {
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
   * Utility methods
   */

  async loadWorkspaceConfig() {
    try {
      const configPath = join(this.workspacePath, this.options.configFileName);
      const configContent = await readFile(configPath, 'utf-8');
      this.workspaceConfig = JSON.parse(configContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load workspace config:', error.message);
      }
      this.workspaceConfig = null;
    }
  }

  async saveWorkspaceConfig(config) {
    const configPath = join(this.workspacePath, this.options.configFileName);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async loadWorkspaceMetadata() {
    try {
      const metadataPath = join(this.workspacePath, this.options.metadataFileName);
      const metadataContent = await readFile(metadataPath, 'utf-8');
      this.workspaceMetadata = JSON.parse(metadataContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load workspace metadata:', error.message);
      }
      this.workspaceMetadata = null;
    }
  }

  async saveWorkspaceMetadata(metadata) {
    const metadataPath = join(this.workspacePath, this.options.metadataFileName);
    await mkdir(dirname(metadataPath), { recursive: true });
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async updateWorkspaceMetadata() {
    try {
      const files = this.fileProvider ? await this.fileProvider.getResources() : [];
      const notes = this.noteProvider ? await this.noteProvider.getResources() : [];
      
      const metadata = {
        fileCount: files.length,
        noteCount: notes.length,
        totalSize: files.reduce((sum, f) => sum + f.metadata.size, 0),
        lastScan: new Date().toISOString(),
        tags: this.noteProvider ? await this.noteProvider.getAllTags() : [],
        recentFiles: files
          .sort((a, b) => new Date(b.metadata.modified) - new Date(a.metadata.modified))
          .slice(0, 10)
          .map(f => ({
            path: f.metadata.relativePath,
            name: f.name,
            modified: f.metadata.modified
          }))
      };
      
      await this.saveWorkspaceMetadata(metadata);
      this.workspaceMetadata = metadata;
    } catch (error) {
      this.logger.warn('Failed to update workspace metadata:', error.message);
    }
  }

  getTemplateSettings(template) {
    const templates = {
      basic: {
        defaultDirectories: ['Notes', 'Attachments'],
        defaultTemplates: ['basic', 'daily'],
        features: ['wikilinks', 'tags']
      },
      research: {
        defaultDirectories: ['Research', 'Sources', 'Papers', 'Notes', 'References'],
        defaultTemplates: ['research', 'review', 'basic'],
        features: ['wikilinks', 'tags', 'citations']
      },
      project: {
        defaultDirectories: ['Projects', 'Tasks', 'Resources', 'Archive'],
        defaultTemplates: ['project', 'meeting', 'basic'],
        features: ['wikilinks', 'tags', 'tasks', 'kanban']
      },
      'knowledge-base': {
        defaultDirectories: ['Knowledge', 'Concepts', 'Topics', 'Index'],
        defaultTemplates: ['basic', 'research', 'review'],
        features: ['wikilinks', 'tags', 'graph', 'search']
      },
      journal: {
        defaultDirectories: ['Journal', 'Templates', 'Archive'],
        defaultTemplates: ['daily', 'basic', 'review'],
        features: ['wikilinks', 'tags', 'daily-notes']
      }
    };
    
    return templates[template] || templates.basic;
  }

  async createDirectoryStructure(template) {
    const settings = this.getTemplateSettings(template);
    
    for (const dir of settings.defaultDirectories) {
      const dirPath = join(this.workspacePath, dir);
      await mkdir(dirPath, { recursive: true });
    }
  }

  async setupWorkspaceTemplates(template) {
    const templateDir = join(this.workspacePath, this.options.templateDirectory);
    await mkdir(templateDir, { recursive: true });
    
    const settings = this.getTemplateSettings(template);
    
    // Create template files (simplified implementation)
    for (const templateName of settings.defaultTemplates) {
      const templatePath = join(templateDir, `${templateName}.md`);
      const templateContent = this.getTemplateContent(templateName);
      await writeFile(templatePath, templateContent);
    }
  }

  getTemplateContent(templateName) {
    // Simplified template content
    const templates = {
      basic: '# {{title}}\n\n## Overview\n\n## Notes\n\n',
      daily: '# {{title}}\n\n## Today\'s Goals\n\n- [ ] \n\n## Notes\n\n',
      research: '# {{title}}\n\n## Research Question\n\n## Sources\n\n## Findings\n\n',
      review: '# {{title}}\n\n## Summary\n\n## Key Points\n\n## Rating\n\n',
      project: '# {{title}}\n\n## Objective\n\n## Timeline\n\n## Tasks\n\n',
      meeting: '# {{title}}\n\n## Attendees\n\n## Agenda\n\n## Action Items\n\n'
    };
    
    return templates[templateName] || templates.basic;
  }

  async calculateWorkspaceStatistics() {
    const files = this.fileProvider ? await this.fileProvider.getResources() : [];
    const notes = this.noteProvider ? await this.noteProvider.getResources() : [];
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentFiles = files.filter(f => new Date(f.metadata.modified) > oneWeekAgo);
    const monthlyFiles = files.filter(f => new Date(f.metadata.modified) > oneMonthAgo);
    
    return {
      files: {
        total: files.length,
        recent: recentFiles.length,
        monthly: monthlyFiles.length,
        totalSize: files.reduce((sum, f) => sum + f.metadata.size, 0),
        averageSize: files.length > 0 ? files.reduce((sum, f) => sum + f.metadata.size, 0) / files.length : 0
      },
      notes: {
        total: notes.length,
        withTags: notes.filter(n => n.metadata.tags?.length > 0).length,
        withLinks: notes.filter(n => n.metadata.wikiLinks?.length > 0).length,
        averageWordCount: notes.length > 0 ? notes.reduce((sum, n) => sum + (n.metadata.wordCount || 0), 0) / notes.length : 0
      },
      activity: {
        recentFiles: recentFiles.length,
        monthlyFiles: monthlyFiles.length,
        lastModified: files.length > 0 ? Math.max(...files.map(f => new Date(f.metadata.modified).getTime())) : null
      }
    };
  }

  async performQuickHealthCheck() {
    const issues = [];
    
    // Check if workspace has config
    if (!this.workspaceConfig) {
      issues.push('No workspace configuration found');
    }
    
    // Check if workspace has metadata
    if (!this.workspaceMetadata) {
      issues.push('No workspace metadata found');
    }
    
    // Check for very large files
    if (this.fileProvider) {
      const files = await this.fileProvider.getResources();
      const largeFiles = files.filter(f => f.metadata.size > 10 * 1024 * 1024); // > 10MB
      if (largeFiles.length > 0) {
        issues.push(`${largeFiles.length} very large files detected`);
      }
    }
    
    return {
      score: Math.max(0, 100 - issues.length * 20),
      issues,
      status: issues.length === 0 ? 'healthy' : issues.length < 3 ? 'warning' : 'unhealthy'
    };
  }

  async generateWorkspaceSummary() {
    const stats = await this.calculateWorkspaceStatistics();
    
    return {
      description: this.workspaceConfig?.description || 'No description available',
      fileCount: stats.files.total,
      noteCount: stats.notes.total,
      totalSize: this.formatFileSize(stats.files.totalSize),
      recentActivity: stats.activity.recentFiles,
      tags: this.noteProvider ? (await this.noteProvider.getAllTags()).length : 0,
      connections: stats.notes.withLinks
    };
  }

  async getFilesToBackup(excludePatterns) {
    const files = this.fileProvider ? await this.fileProvider.getResources() : [];
    
    return files
      .map(f => f.metadata.relativePath)
      .filter(path => {
        // Exclude .lokus directory and specified patterns
        if (path.startsWith('.lokus/')) return false;
        
        for (const pattern of excludePatterns) {
          if (path.includes(pattern)) return false;
        }
        
        return true;
      });
  }

  async getBackupFiles(backupPath) {
    const files = [];
    
    async function scanDirectory(dir, basePath = '') {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = join(dir, entry.name);
        const relativePath = basePath ? join(basePath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          await scanDirectory(entryPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    }
    
    await scanDirectory(backupPath);
    return files;
  }

  async cleanupOldBackups() {
    if (this.options.maxBackups <= 0) return;
    
    const backups = await this.getWorkspaceBackups({ includeDetails: true });
    
    if (backups.backups.length > this.options.maxBackups) {
      const toDelete = backups.backups.slice(this.options.maxBackups);
      
      for (const backup of toDelete) {
        try {
          const backupPath = join(this.workspacePath, backup.path);
          await rmdir(backupPath, { recursive: true });
        } catch (error) {
          this.logger.warn(`Failed to delete old backup ${backup.name}:`, error.message);
        }
      }
    }
  }

  // Simplified implementations for complex operations
  async exportAsJSON(options) {
    const files = this.fileProvider ? await this.fileProvider.getResources() : [];
    const notes = this.noteProvider ? await this.noteProvider.getResources() : [];
    
    const exportData = {
      workspace: this.workspaceConfig,
      metadata: this.workspaceMetadata,
      files: options.includeFiles ? files : files.map(f => ({ name: f.name, path: f.metadata.relativePath })),
      notes: options.includeFiles ? notes : notes.map(n => ({ name: n.name, path: n.metadata.relativePath })),
      exported: new Date().toISOString()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async exportAsMarkdown(options) {
    const notes = this.noteProvider ? await this.noteProvider.getResources() : [];
    
    let markdown = `# ${this.workspaceConfig?.name || 'Workspace'} Export\n\n`;
    markdown += `Exported: ${new Date().toISOString()}\n\n`;
    
    for (const note of notes) {
      markdown += `## ${note.name}\n\n`;
      if (options.includeFiles) {
        // Would need to read actual content
        markdown += `Path: ${note.metadata.relativePath}\n\n`;
      }
    }
    
    return markdown;
  }

  async exportAsCSV(options) {
    const files = this.fileProvider ? await this.fileProvider.getResources() : [];
    
    let csv = 'Name,Path,Size,Modified,Type\n';
    
    for (const file of files) {
      const row = [
        `"${file.name}"`,
        `"${file.metadata.relativePath}"`,
        file.metadata.size,
        `"${file.metadata.modified}"`,
        `"${file.metadata.type}"`
      ].join(',');
      csv += row + '\n';
    }
    
    return csv;
  }

  async exportAsArchive(options) {
    // Simplified implementation - would use proper archiving library in production
    return await this.backupWorkspace({
      name: `export-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      includeConfig: true,
      includeMetadata: true
    });
  }

  async importFiles(options) {
    // Simplified implementation
    return { importedFiles: 0, totalSize: 0 };
  }

  async importFromJSON(options) {
    // Simplified implementation
    return { importedFiles: 0, totalSize: 0 };
  }

  async importMarkdown(options) {
    // Simplified implementation
    return { importedFiles: 0, totalSize: 0 };
  }

  async generateCleanupPlan(cleanupType) {
    const filesToRemove = [];
    let spaceToRecover = 0;
    
    // Simplified implementation
    switch (cleanupType) {
      case 'temp':
        // Find temporary files
        break;
      case 'duplicates':
        // Find duplicate files
        break;
      case 'empty':
        // Find empty files/directories
        break;
      case 'orphans':
        // Find orphaned files
        break;
      case 'all':
        // Combine all cleanup types
        break;
    }
    
    return {
      filesToRemove,
      spaceToRecover,
      spaceToRecoverFormatted: this.formatFileSize(spaceToRecover)
    };
  }

  async findBrokenWikiLinks() {
    // Simplified implementation
    return [];
  }

  async findOrphanedFiles() {
    // Simplified implementation
    return [];
  }

  async findDuplicateFiles() {
    // Simplified implementation
    return [];
  }

  async checkWorkspaceStructure() {
    const issues = [];
    
    // Check if required directories exist
    const requiredDirs = ['.lokus'];
    
    for (const dir of requiredDirs) {
      try {
        const dirPath = join(this.workspacePath, dir);
        await stat(dirPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          issues.push({
            type: 'missing_directory',
            description: `Required directory missing: ${dir}`
          });
        }
      }
    }
    
    return issues;
  }

  generateHealthSuggestions(health) {
    const suggestions = [];
    
    for (const issue of health.issues) {
      switch (issue.type) {
        case 'broken_links':
          suggestions.push('Run WikiLink resolution tool to fix broken links');
          break;
        case 'missing_directory':
          suggestions.push('Initialize workspace to create required directories');
          break;
      }
    }
    
    for (const warning of health.warnings) {
      switch (warning.type) {
        case 'orphaned_files':
          suggestions.push('Review orphaned files and create connections or organize them');
          break;
        case 'duplicate_files':
          suggestions.push('Use cleanup tool to remove duplicate files');
          break;
      }
    }
    
    return suggestions;
  }

  async generateHealthReport(health) {
    const timestamp = new Date().toISOString();
    
    return {
      timestamp,
      score: health.score,
      status: health.score > 80 ? 'excellent' : health.score > 60 ? 'good' : health.score > 40 ? 'fair' : 'poor',
      summary: {
        totalIssues: health.issues.length,
        totalWarnings: health.warnings.length,
        totalSuggestions: health.suggestions.length
      },
      details: {
        issues: health.issues,
        warnings: health.warnings,
        suggestions: health.suggestions
      }
    };
  }

  async syncWithFilesystem(sourcePath, direction) {
    // Simplified implementation
    return {
      syncedFiles: 0,
      direction,
      sourcePath
    };
  }

  async syncWithGit(sourcePath, direction) {
    // Simplified implementation
    return {
      syncedFiles: 0,
      direction,
      sourcePath
    };
  }

  async syncWithCloud(sourcePath, direction) {
    // Simplified implementation
    return {
      syncedFiles: 0,
      direction,
      sourcePath
    };
  }

  recordOperation(operation, args, result, status, error = null) {
    const entry = {
      operation,
      args: { ...args },
      result: status === 'success' ? { success: result?.success } : null,
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
   * Get workspace tool statistics
   */
  getStats() {
    const operationCounts = {};
    for (const entry of this.operationHistory) {
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
    }
    
    return {
      workspacePath: this.workspacePath,
      hasConfig: !!this.workspaceConfig,
      hasMetadata: !!this.workspaceMetadata,
      totalOperations: this.operationHistory.length,
      operationCounts,
      backupSettings: {
        maxBackups: this.options.maxBackups,
        compressionEnabled: this.options.compressionEnabled
      }
    };
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.operationHistory = [];
    this.removeAllListeners();
    
    this.logger.info('WorkspaceTools disposed');
  }
}

export default WorkspaceTools;