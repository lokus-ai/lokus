/**
 * Workspace Manager for Lokus MCP Server
 * 
 * Manages workspace state shared between Lokus app and MCP server.
 * Uses a JSON file in the home directory to track active workspaces.
 */

import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const WORKSPACE_STATE_FILE = join(homedir(), '.lokus-active-workspaces.json');

export class WorkspaceManager {
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Read workspace state from file
   */
  async readWorkspaceState() {
    try {
      const content = await readFile(WORKSPACE_STATE_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return default state
        return {
          workspaces: [],
          current: null,
          lastUpdated: new Date().toISOString()
        };
      }
      this.logger.warn('Failed to read workspace state:', error.message);
      return null;
    }
  }

  /**
   * Write workspace state to file
   */
  async writeWorkspaceState(state) {
    try {
      state.lastUpdated = new Date().toISOString();
      const content = JSON.stringify(state, null, 2);
      await writeFile(WORKSPACE_STATE_FILE, content, 'utf-8');
      return true;
    } catch (error) {
      this.logger.error('Failed to write workspace state:', error.message);
      return false;
    }
  }

  /**
   * Validate if a workspace path exists and is valid
   */
  async validateWorkspace(workspacePath) {
    try {
      const stats = await stat(workspacePath);
      if (!stats.isDirectory()) {
        return false;
      }
      
      // Check if it's a Lokus workspace (has .lokus directory) 
      const lokusDir = join(workspacePath, '.lokus');
      try {
        const lokusStat = await stat(lokusDir);
        if (lokusStat.isDirectory()) {
          return true; // Confirmed Lokus workspace
        }
      } catch (error) {
        // .lokus doesn't exist, check if directory has markdown files (potential workspace)
        try {
          const { readdir } = await import('fs/promises');
          const contents = await readdir(workspacePath);
          const markdownFiles = contents.filter(file => file.endsWith('.md'));
          
          // Only consider it a workspace if it has a reasonable number of markdown files
          // and doesn't look like a system/config directory
          if (markdownFiles.length >= 2 && !workspacePath.includes('node_modules') && 
              !workspacePath.includes('.git') && !workspacePath.includes('.cache')) {
            return true; // Directory with multiple markdown files can be a workspace
          }
        } catch (readError) {
          // Can't read directory contents
        }
        
        // Only accept specific well-known workspace paths without markdown validation
        const knownWorkspacePaths = [
          '/Users/pratham/Documents/Lokus-Workspace',
          '/Users/pratham/Documents/Lokus Workspace',
          '/Users/pratham/Programming/Lokud Dir/Lokus/Lokus-Full-Scale-Test'
        ];
        
        return knownWorkspacePaths.includes(workspacePath);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current active workspace
   */
  async getCurrentWorkspace() {
    const state = await this.readWorkspaceState();
    if (!state || !state.current) {
      return null;
    }

    // Validate current workspace still exists
    const isValid = await this.validateWorkspace(state.current);
    if (!isValid) {
      // Current workspace is invalid, remove it
      await this.removeWorkspace(state.current);
      return null;
    }

    return state.current;
  }

  /**
   * Set current active workspace
   */
  async setCurrentWorkspace(workspacePath) {
    if (!workspacePath) {
      return false;
    }

    // Validate workspace
    const isValid = await this.validateWorkspace(workspacePath);
    if (!isValid) {
      this.logger.warn(`Invalid workspace path: ${workspacePath}`);
      return false;
    }

    const state = await this.readWorkspaceState() || {
      workspaces: [],
      current: null
    };

    // Update or add workspace
    const existingIndex = state.workspaces.findIndex(w => w.path === workspacePath);
    const workspaceEntry = {
      path: workspacePath,
      lastAccessed: new Date().toISOString(),
      name: workspacePath.split('/').pop() || workspacePath
    };

    if (existingIndex >= 0) {
      state.workspaces[existingIndex] = workspaceEntry;
    } else {
      state.workspaces.unshift(workspaceEntry);
      // Keep only recent 10 workspaces
      state.workspaces = state.workspaces.slice(0, 10);
    }

    state.current = workspacePath;
    
    const success = await this.writeWorkspaceState(state);
    if (success) {
      this.logger.info(`Set current workspace to: ${workspacePath}`);
    }
    return success;
  }

  /**
   * Get list of all tracked workspaces
   */
  async getWorkspaces() {
    const state = await this.readWorkspaceState();
    if (!state) {
      return [];
    }

    // Validate each workspace and remove invalid ones
    const validWorkspaces = [];
    let hasChanges = false;

    for (const workspace of state.workspaces) {
      const isValid = await this.validateWorkspace(workspace.path);
      if (isValid) {
        validWorkspaces.push(workspace);
      } else {
        hasChanges = true;
        this.logger.info(`Removing invalid workspace: ${workspace.path}`);
      }
    }

    if (hasChanges) {
      state.workspaces = validWorkspaces;
      await this.writeWorkspaceState(state);
    }

    return validWorkspaces;
  }

  /**
   * Remove a workspace from tracking
   */
  async removeWorkspace(workspacePath) {
    const state = await this.readWorkspaceState();
    if (!state) {
      return true;
    }

    state.workspaces = state.workspaces.filter(w => w.path !== workspacePath);
    
    // If current workspace was removed, clear it
    if (state.current === workspacePath) {
      state.current = state.workspaces.length > 0 ? state.workspaces[0].path : null;
    }

    return await this.writeWorkspaceState(state);
  }

  /**
   * Scan for Lokus workspaces on the system
   */
  async scanForWorkspaces() {
    // Common locations to scan
    const scanPaths = [
      join(homedir(), 'Documents'),
      join(homedir(), 'Documents', 'Lokus-Workspace'),
      join(homedir(), 'Documents', 'Lokus Workspace'),
      join(homedir()),
      '/Users/pratham/Programming/Lokud Dir/Lokus/Lokus-Full-Scale-Test'
    ];

    const foundWorkspaces = [];

    for (const basePath of scanPaths) {
      try {
        // Check if the path itself is a workspace
        const isWorkspace = await this.validateWorkspace(basePath);
        if (isWorkspace) {
          foundWorkspaces.push({
            path: basePath,
            name: basePath.split('/').pop() || basePath,
            lastAccessed: new Date().toISOString()
          });
        }
      } catch (error) {
        // Skip paths that don't exist or can't be read
      }
    }

    // Scan for directories with .lokus folders
    const searchDirs = [
      homedir(),
      join(homedir(), 'Documents'),
      join(homedir(), 'Programming'),
      '/Users/pratham/Programming/Lokud Dir/Lokus'
    ];

    for (const searchDir of searchDirs) {
      try {
        const { readdir } = await import('fs/promises');
        const contents = await readdir(searchDir, { withFileTypes: true });
        
        for (const entry of contents) {
          if (entry.isDirectory()) {
            const entryPath = join(searchDir, entry.name);
            
            // Check if this directory contains .lokus or markdown files
            try {
              const isWorkspace = await this.validateWorkspace(entryPath);
              if (isWorkspace && !foundWorkspaces.some(w => w.path === entryPath)) {
                foundWorkspaces.push({
                  path: entryPath,
                  name: entry.name,
                  lastAccessed: new Date().toISOString()
                });
              }
            } catch (error) {
              // Skip if can't validate this path
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    return foundWorkspaces;
  }

  /**
   * Initialize workspace manager and return best workspace to use
   */
  async initialize() {
    let currentWorkspace = await this.getCurrentWorkspace();
    
    if (!currentWorkspace) {
      // No current workspace, try to find one
      const workspaces = await this.getWorkspaces();
      
      if (workspaces.length === 0) {
        // No tracked workspaces, scan for them
        this.logger.info('No tracked workspaces found, scanning system...');
        const foundWorkspaces = await this.scanForWorkspaces();
        
        if (foundWorkspaces.length > 0) {
          // Prioritize workspaces - prefer Lokus-Full-Scale-Test if available
          const priorityWorkspace = foundWorkspaces.find(w => 
            w.name === 'Lokus-Full-Scale-Test' || 
            w.path.includes('Lokus-Full-Scale-Test')
          );
          
          const selectedWorkspace = priorityWorkspace || foundWorkspaces[0];
          
          // Add found workspaces and set selected as current
          const state = {
            workspaces: foundWorkspaces,
            current: selectedWorkspace.path
          };
          await this.writeWorkspaceState(state);
          currentWorkspace = selectedWorkspace.path;
          this.logger.info(`Auto-detected workspace: ${currentWorkspace}`);
        }
      } else {
        // Use most recently accessed workspace
        currentWorkspace = workspaces[0].path;
        await this.setCurrentWorkspace(currentWorkspace);
        this.logger.info(`Using most recent workspace: ${currentWorkspace}`);
      }
    }

    return currentWorkspace;
  }
}

export default WorkspaceManager;