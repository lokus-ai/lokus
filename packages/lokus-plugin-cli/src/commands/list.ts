import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { FileUtils } from '../utils/file-utils';

export interface ListOptions {
  global?: boolean;
  local?: boolean;
  json?: boolean;
  verbose?: boolean;
}

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  location: string;
  status: 'active' | 'inactive' | 'error';
  size?: number;
  installedAt?: string;
  source?: string;
}

export const listCommand = new Command('list')
  .description('List installed plugins')
  .option('-g, --global', 'list global plugins only')
  .option('-l, --local', 'list local plugins only')
  .option('--json', 'output as JSON')
  .option('-v, --verbose', 'show detailed information')
  .action(async (options: ListOptions) => {
    try {
      logger.header('📋 Installed Plugins');

      const plugins: PluginInfo[] = [];

      // Collect global plugins
      if (!options.local) {
        const globalPlugins = await getPluginsFromDirectory(await getGlobalPluginsDir(), 'global');
        plugins.push(...globalPlugins);
      }

      // Collect local plugins
      if (!options.global) {
        const localPluginsDir = await getLocalPluginsDir();
        if (localPluginsDir) {
          const localPlugins = await getPluginsFromDirectory(localPluginsDir, 'local');
          plugins.push(...localPlugins);
        }
      }

      // Sort plugins by name
      plugins.sort((a, b) => a.name.localeCompare(b.name));

      if (options.json) {
        logger.json(plugins);
        return;
      }

      if (plugins.length === 0) {
        logger.info('No plugins installed');
        logger.newLine();
        logger.info('Install plugins with:');
        logger.info('  lokus-plugin install <plugin-name>');
        return;
      }

      // Display plugins
      if (options.verbose) {
        displayDetailedList(plugins);
      } else {
        displaySimpleList(plugins);
      }

      // Summary
      logger.newLine();
      const globalCount = plugins.filter(p => p.source === 'global').length;
      const localCount = plugins.filter(p => p.source === 'local').length;
      const activeCount = plugins.filter(p => p.status === 'active').length;

      logger.info(`Total: ${chalk.cyan(plugins.length)} plugins`);
      if (globalCount > 0) logger.info(`Global: ${globalCount}`);
      if (localCount > 0) logger.info(`Local: ${localCount}`);
      logger.info(`Active: ${chalk.green(activeCount)}`);

      const errorCount = plugins.filter(p => p.status === 'error').length;
      if (errorCount > 0) {
        logger.warning(`Errors: ${errorCount}`);
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });

async function getGlobalPluginsDir(): Promise<string> {
  const os = require('os');
  const homeDir = os.homedir();
  return path.join(homeDir, '.lokus', 'plugins');
}

async function getLocalPluginsDir(): Promise<string | null> {
  const cwd = process.cwd();
  
  // Try to find Lokus workspace root
  let currentDir = cwd;
  while (currentDir !== path.dirname(currentDir)) {
    const lokusConfig = path.join(currentDir, '.lokus');
    if (await fs.pathExists(lokusConfig)) {
      return path.join(currentDir, '.lokus', 'plugins');
    }
    currentDir = path.dirname(currentDir);
  }
  
  // Check current directory
  const localDir = path.join(cwd, '.lokus', 'plugins');
  if (await fs.pathExists(localDir)) {
    return localDir;
  }
  
  return null;
}

async function getPluginsFromDirectory(pluginsDir: string, source: string): Promise<PluginInfo[]> {
  if (!await fs.pathExists(pluginsDir)) {
    return [];
  }

  const plugins: PluginInfo[] = [];
  
  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginDir = path.join(pluginsDir, entry.name);
        const pluginInfo = await getPluginInfo(pluginDir, source);
        if (pluginInfo) {
          plugins.push(pluginInfo);
        }
      }
    }
  } catch (error) {
    logger.debug(`Error reading plugins directory: ${pluginsDir}`);
  }

  return plugins;
}

async function getPluginInfo(pluginDir: string, source: string): Promise<PluginInfo | null> {
  try {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    const installInfoPath = path.join(pluginDir, '.install-info.json');
    
    if (!await fs.pathExists(manifestPath)) {
      return null;
    }

    const manifest = await fs.readJson(manifestPath);
    let installInfo: any = {};
    
    if (await fs.pathExists(installInfoPath)) {
      try {
        installInfo = await fs.readJson(installInfoPath);
      } catch (error) {
        // Ignore install info errors
      }
    }

    // Calculate directory size
    const size = await FileUtils.calculateDirSize(pluginDir);

    // Determine status
    let status: 'active' | 'inactive' | 'error' = 'inactive';
    
    const mainFile = path.join(pluginDir, manifest.main || 'index.js');
    if (await fs.pathExists(mainFile)) {
      status = 'active';
    } else {
      status = 'error';
    }

    return {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      location: pluginDir,
      status,
      size,
      installedAt: installInfo.installedAt,
      source
    };

  } catch (error) {
    logger.debug(`Error reading plugin info: ${pluginDir}`);
    return {
      name: path.basename(pluginDir),
      version: 'unknown',
      description: 'Error loading plugin',
      author: 'unknown',
      location: pluginDir,
      status: 'error',
      source
    };
  }
}

function displaySimpleList(plugins: PluginInfo[]): void {
  const tableData = plugins.map(plugin => ({
    Name: plugin.name,
    Version: plugin.version,
    Status: getStatusDisplay(plugin.status),
    Source: plugin.source === 'global' ? 'Global' : 'Local',
    Description: plugin.description.length > 50 
      ? plugin.description.substring(0, 47) + '...'
      : plugin.description
  }));

  logger.table(tableData);
}

function displayDetailedList(plugins: PluginInfo[]): void {
  plugins.forEach((plugin, index) => {
    if (index > 0) logger.newLine();
    
    logger.info(`${chalk.bold(plugin.name)} ${chalk.gray(`v${plugin.version}`)}`);
    logger.info(`  Description: ${plugin.description}`);
    logger.info(`  Author: ${plugin.author}`);
    logger.info(`  Status: ${getStatusDisplay(plugin.status)}`);
    logger.info(`  Source: ${plugin.source === 'global' ? 'Global' : 'Local'}`);
    logger.info(`  Location: ${chalk.gray(plugin.location)}`);
    
    if (plugin.size) {
      logger.info(`  Size: ${FileUtils.formatFileSize(plugin.size)}`);
    }
    
    if (plugin.installedAt) {
      const date = new Date(plugin.installedAt).toLocaleDateString();
      logger.info(`  Installed: ${date}`);
    }
  });
}

function getStatusDisplay(status: string): string {
  switch (status) {
    case 'active':
      return chalk.green('✓ Active');
    case 'inactive':
      return chalk.yellow('○ Inactive');
    case 'error':
      return chalk.red('✗ Error');
    default:
      return chalk.gray('? Unknown');
  }
}