/**
 * Workspace Resource Provider for Lokus
 * Integrates with Lokus's workspace management system to provide real-time access to:
 * - Active workspace path and configuration
 * - Open files and tabs
 * - Recent files and session state
 * - Workspace file tree
 */

import { invoke } from '@tauri-apps/api/core';
import { WorkspaceManager } from '../../core/workspace/manager.js';
import { logger } from '../../utils/logger.js';

export class WorkspaceProvider {
  constructor() {
    this.workspacePath = null;
    this.subscribers = new Set();
    this.fileTree = [];
    this.openTabs = [];
    this.activeFile = null;
    this.sessionState = null;
    
    // Initialize workspace monitoring
    this.initializeWorkspaceMonitoring();
  }

  /**
   * Initialize workspace monitoring and state synchronization
   */
  async initializeWorkspaceMonitoring() {
    try {
      // Get current workspace path
      this.workspacePath = await WorkspaceManager.getValidatedWorkspacePath();
      
      // Load session state if workspace exists
      if (this.workspacePath) {
        await this.loadWorkspaceData();
      }
      
      // Monitor for workspace changes
      this.setupWorkspaceListeners();
    } catch (error) {
      logger.warn('WorkspaceProvider', 'Failed to initialize workspace monitoring:', error);
    }
  }

  /**
   * Load workspace data from Lokus backend
   */
  async loadWorkspaceData() {
    if (!this.workspacePath) return;

    try {
      // Load file tree
      const files = await invoke('read_workspace_files', { workspacePath: this.workspacePath });
      this.fileTree = this.filterIgnoredFiles(files);

      // Load session state (open tabs, active file, etc.)
      const session = await invoke('load_session_state', { workspacePath: this.workspacePath });
      if (session) {
        this.sessionState = session;
        this.openTabs = (session.open_tabs || []).map(path => ({
          path,
          name: path.split('/').pop(),
          uri: `lokus://workspace/file/${encodeURIComponent(path)}`
        }));
        this.activeFile = this.openTabs.length > 0 ? this.openTabs[0].path : null;
      }

      // Notify subscribers of workspace data update
      this.notifySubscribers('workspace:updated');
    } catch (error) {
      logger.error('WorkspaceProvider', 'Failed to load workspace data:', error);
    }
  }

  /**
   * Filter out ignored files and directories
   */
  filterIgnoredFiles(entries) {
    const ignoredNames = ['.lokus', '.DS_Store', 'node_modules', '.git'];
    return entries
      .filter(entry => !ignoredNames.includes(entry.name))
      .map(entry => {
        if (entry.children) {
          return { ...entry, children: this.filterIgnoredFiles(entry.children) };
        }
        return entry;
      });
  }

  /**
   * Setup workspace event listeners
   */
  setupWorkspaceListeners() {
    try {
      // Listen for workspace activation events
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        // Tauri environment
        import('@tauri-apps/api/event').then(({ listen }) => {
          listen('workspace:activate', async (event) => {
            this.workspacePath = event.payload;
            await this.loadWorkspaceData();
          });
        });
      } else {
        // Browser environment - listen for custom events
        window.addEventListener('workspace:activate', async (event) => {
          this.workspacePath = event.detail;
          await this.loadWorkspaceData();
        });
      }

      // Monitor global workspace path changes
      if (typeof window !== 'undefined') {
        // Watch for workspace path changes on window object
        const checkWorkspaceChange = () => {
          const currentPath = window.__LOKUS_WORKSPACE_PATH__;
          if (currentPath && currentPath !== this.workspacePath) {
            this.workspacePath = currentPath;
            this.loadWorkspaceData();
          }
        };
        
        setInterval(checkWorkspaceChange, 1000);
      }
    } catch (error) {
      logger.warn('WorkspaceProvider', 'Failed to setup workspace listeners:', error);
    }
  }

  /**
   * Get all available resources
   */
  async listResources() {
    const resources = [
      {
        uri: 'lokus://workspace/info',
        name: 'Workspace Information',
        description: 'Current workspace path and basic information',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://workspace/files',
        name: 'Workspace Files',
        description: 'Complete file tree of the current workspace',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://workspace/open-tabs',
        name: 'Open Tabs',
        description: 'Currently open files in the workspace',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://workspace/session',
        name: 'Session State',
        description: 'Current session state including open tabs and expanded folders',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://workspace/recent',
        name: 'Recent Files',
        description: 'Recently accessed files in the workspace',
        mimeType: 'application/json'
      }
    ];

    // Add individual file resources for open tabs
    if (this.openTabs && this.openTabs.length > 0) {
      for (const tab of this.openTabs) {
        resources.push({
          uri: `lokus://workspace/file/${encodeURIComponent(tab.path)}`,
          name: `File: ${tab.name}`,
          description: `Content of file ${tab.path}`,
          mimeType: tab.name.endsWith('.md') ? 'text/markdown' : 'text/plain'
        });
      }
    }

    return resources;
  }

  /**
   * Read a specific resource
   */
  async readResource(uri) {
    try {
      const url = new URL(uri);
      const path = url.pathname;

      switch (path) {
        case '/info':
          return this.getWorkspaceInfo();
        
        case '/files':
          return this.getFileTree();
        
        case '/open-tabs':
          return this.getOpenTabs();
        
        case '/session':
          return this.getSessionState();
        
        case '/recent':
          return this.getRecentFiles();
        
        default:
          if (path.startsWith('/file/')) {
            const filePath = decodeURIComponent(path.substring(6));
            return this.getFileContent(filePath);
          }
          throw new Error(`Unknown resource path: ${path}`);
      }
    } catch (error) {
      logger.error('WorkspaceProvider', 'Error reading resource:', error);
      return {
        contents: [{
          type: 'text',
          text: `Error reading resource: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get workspace information
   */
  async getWorkspaceInfo() {
    const info = {
      workspacePath: this.workspacePath,
      isValid: this.workspacePath ? await WorkspaceManager.validatePath(this.workspacePath) : false,
      openTabsCount: this.openTabs.length,
      activeFile: this.activeFile,
      lastAccessed: new Date().toISOString(),
      fileCount: this.countFiles(this.fileTree)
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(info, null, 2)
      }]
    };
  }

  /**
   * Get file tree
   */
  async getFileTree() {
    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          workspacePath: this.workspacePath,
          fileTree: this.fileTree,
          totalFiles: this.countFiles(this.fileTree),
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get open tabs
   */
  async getOpenTabs() {
    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          activeFile: this.activeFile,
          openTabs: this.openTabs,
          tabCount: this.openTabs.length,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get session state
   */
  async getSessionState() {
    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          workspacePath: this.workspacePath,
          sessionState: this.sessionState,
          openTabs: this.openTabs,
          activeFile: this.activeFile,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get recent files
   */
  async getRecentFiles() {
    try {
      // Get recent files from session state or derive from open tabs
      const recentFiles = this.sessionState?.open_tabs || this.openTabs.map(tab => tab.path);
      
      return {
        contents: [{
          type: 'text',
          text: JSON.stringify({
            recentFiles: recentFiles.slice(0, 10), // Limit to 10 most recent
            lastUpdated: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: JSON.stringify({
            recentFiles: [],
            error: error.message,
            lastUpdated: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }

  /**
   * Get file content
   */
  async getFileContent(filePath) {
    try {
      const content = await invoke('read_file_content', { path: filePath });
      const fileInfo = {
        path: filePath,
        name: filePath.split('/').pop(),
        size: content.length,
        lastModified: new Date().toISOString(),
        isActive: filePath === this.activeFile
      };

      return {
        contents: [
          {
            type: 'text',
            text: `File: ${filePath}\n\n${content}`
          },
          {
            type: 'text',
            text: `\n\n--- File Information ---\n${JSON.stringify(fileInfo, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: `Error reading file ${filePath}: ${error.message}`
        }]
      };
    }
  }

  /**
   * Count total files in file tree
   */
  countFiles(entries) {
    let count = 0;
    for (const entry of entries) {
      if (entry.is_directory && entry.children) {
        count += this.countFiles(entry.children);
      } else if (!entry.is_directory) {
        count++;
      }
    }
    return count;
  }

  /**
   * Subscribe to workspace changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   */
  notifySubscribers(event, data = null) {
    for (const callback of this.subscribers) {
      try {
        callback(event, data);
      } catch (error) {
        logger.error('WorkspaceProvider', 'Error notifying subscriber:', error);
      }
    }
  }

  /**
   * Refresh workspace data
   */
  async refresh() {
    await this.loadWorkspaceData();
    this.notifySubscribers('workspace:refreshed');
  }

  /**
   * Get workspace provider metadata
   */
  getMetadata() {
    return {
      name: 'Lokus Workspace Provider',
      description: 'Provides access to Lokus workspace files, tabs, and session state',
      version: '1.0.0',
      capabilities: [
        'workspace-info',
        'file-tree',
        'open-tabs',
        'session-state',
        'file-content',
        'real-time-updates'
      ]
    };
  }
}