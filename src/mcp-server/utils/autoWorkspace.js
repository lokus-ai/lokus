/**
 * Auto Workspace Detection for Lokus MCP Server
 *
 * Provides smart workspace detection with priority:
 * 1. CWD detection - walk up from current directory to find .lokus folder
 * 2. Environment variable - LOKUS_WORKSPACE
 * 3. Running Lokus app API
 * 4. Last workspace from config
 * 5. Default workspace
 */

import { stat, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { constants } from 'fs';

/**
 * Walk up from a directory to find a Lokus workspace (.lokus folder)
 * @param {string} startDir - Directory to start searching from
 * @returns {Promise<string|null>} - Workspace path or null
 */
export async function findWorkspaceFromCWD(startDir = process.cwd()) {
  let currentDir = startDir;
  const root = process.platform === 'win32' ? currentDir.split(':')[0] + ':\\' : '/';

  // Walk up the directory tree
  while (currentDir !== root && currentDir !== dirname(currentDir)) {
    try {
      const lokusDir = join(currentDir, '.lokus');
      const stats = await stat(lokusDir);

      if (stats.isDirectory()) {
        // Found a .lokus folder - this is a Lokus workspace
        return currentDir;
      }
    } catch (error) {
      // .lokus doesn't exist in this directory, continue up
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Get workspace from environment variable
 * @returns {Promise<string|null>} - Workspace path or null
 */
export async function getWorkspaceFromEnv() {
  const envWorkspace = process.env.LOKUS_WORKSPACE;

  if (!envWorkspace) {
    return null;
  }

  // Validate the path exists and is a directory
  try {
    const stats = await stat(envWorkspace);
    if (stats.isDirectory()) {
      return envWorkspace;
    }
  } catch (error) {
    // Path doesn't exist
  }

  return null;
}

/**
 * Get workspace from running Lokus app API
 * @param {string} apiUrl - API base URL
 * @returns {Promise<string|null>} - Workspace path or null
 */
export async function getWorkspaceFromAPI(apiUrl = 'http://127.0.0.1:3333') {
  try {
    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${apiUrl}/api/workspace`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.workspace) {
        return data.data.workspace;
      }
    }
  } catch (error) {
    // API not available or request failed
  }

  return null;
}

/**
 * Get last workspace from config file
 * @returns {Promise<string|null>} - Workspace path or null
 */
export async function getLastWorkspace() {
  const configFile = join(homedir(), '.lokus', 'last-workspace.json');

  try {
    const content = await readFile(configFile, 'utf-8');
    const data = JSON.parse(content);

    if (data.workspace) {
      // Validate the workspace still exists
      await access(data.workspace, constants.R_OK);
      return data.workspace;
    }
  } catch (error) {
    // File doesn't exist or workspace is invalid
  }

  return null;
}

/**
 * Get MCP context workspace
 * @returns {Promise<string|null>} - Workspace path or null
 */
export async function getMcpContextWorkspace() {
  const contextFile = join(homedir(), '.lokus', 'mcp-context.json');

  try {
    const content = await readFile(contextFile, 'utf-8');
    const data = JSON.parse(content);

    if (data.currentWorkspace) {
      // Validate the workspace still exists
      await access(data.currentWorkspace, constants.R_OK);
      return data.currentWorkspace;
    }
  } catch (error) {
    // File doesn't exist or workspace is invalid
  }

  return null;
}

/**
 * Auto-detect workspace using priority chain
 * @param {Object} options - Detection options
 * @param {string} options.apiUrl - API base URL
 * @param {boolean} options.skipCWD - Skip CWD detection
 * @param {boolean} options.skipEnv - Skip environment variable
 * @param {boolean} options.skipAPI - Skip API check
 * @returns {Promise<{workspace: string|null, source: string}>}
 */
export async function autoDetectWorkspace(options = {}) {
  const {
    apiUrl = 'http://127.0.0.1:3333',
    skipCWD = false,
    skipEnv = false,
    skipAPI = false
  } = options;

  // 1. CWD detection (highest priority for CLI usage)
  if (!skipCWD) {
    const cwdWorkspace = await findWorkspaceFromCWD();
    if (cwdWorkspace) {
      return { workspace: cwdWorkspace, source: 'cwd' };
    }
  }

  // 2. Environment variable
  if (!skipEnv) {
    const envWorkspace = await getWorkspaceFromEnv();
    if (envWorkspace) {
      return { workspace: envWorkspace, source: 'env' };
    }
  }

  // 3. Running Lokus app API
  if (!skipAPI) {
    const apiWorkspace = await getWorkspaceFromAPI(apiUrl);
    if (apiWorkspace) {
      return { workspace: apiWorkspace, source: 'api' };
    }
  }

  // 4. MCP context (previously set)
  const contextWorkspace = await getMcpContextWorkspace();
  if (contextWorkspace) {
    return { workspace: contextWorkspace, source: 'context' };
  }

  // 5. Last workspace from config
  const lastWorkspace = await getLastWorkspace();
  if (lastWorkspace) {
    return { workspace: lastWorkspace, source: 'config' };
  }

  // 6. Default workspace
  const defaultWorkspace = join(homedir(), 'Documents', 'Lokus Workspace');
  try {
    await access(defaultWorkspace, constants.R_OK);
    return { workspace: defaultWorkspace, source: 'default' };
  } catch (error) {
    // Default doesn't exist
  }

  return { workspace: null, source: 'none' };
}

export default {
  findWorkspaceFromCWD,
  getWorkspaceFromEnv,
  getWorkspaceFromAPI,
  getLastWorkspace,
  getMcpContextWorkspace,
  autoDetectWorkspace
};
