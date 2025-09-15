import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import axios from 'axios';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { FileUtils } from '../utils/file-utils';

export interface InfoOptions {
  registry?: string;
  local?: boolean;
  json?: boolean;
  versions?: boolean;
}

export const infoCommand = new Command('info')
  .description('Show plugin information')
  .argument('<name>', 'plugin name to get info for')
  .option('-r, --registry <url>', 'registry URL', 'https://registry.lokus.dev')
  .option('-l, --local', 'show local installation info only')
  .option('--json', 'output as JSON')
  .option('--versions', 'show all available versions')
  .action(async (name: string, options: InfoOptions) => {
    try {
      logger.header(`📖 Plugin Information: ${chalk.cyan(name)}`);

      let localInfo: any = null;
      let registryInfo: any = null;

      // Get local installation info
      localInfo = await getLocalPluginInfo(name);

      // Get registry info unless local-only
      if (!options.local) {
        try {
          registryInfo = await getRegistryPluginInfo(options.registry!, name, options.versions || false);
        } catch (error) {
          if (!localInfo) {
            throw error;
          }
          logger.warning('Could not fetch registry information');
        }
      }

      if (!localInfo && !registryInfo) {
        throw ErrorHandler.createError(
          'ValidationError',
          `Plugin ${name} not found locally or in registry`
        );
      }

      const combinedInfo = {
        ...registryInfo,
        local: localInfo
      };

      if (options.json) {
        logger.json(combinedInfo);
        return;
      }

      displayPluginInfo(combinedInfo, localInfo, registryInfo);

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });

async function getLocalPluginInfo(name: string): Promise<any | null> {
  // Check global installation
  const globalDir = await getGlobalPluginDir(name);
  if (await fs.pathExists(globalDir)) {
    return await readLocalPluginInfo(globalDir, 'global');
  }

  // Check local installation
  const localDir = await getLocalPluginDir(name);
  if (localDir && await fs.pathExists(localDir)) {
    return await readLocalPluginInfo(localDir, 'local');
  }

  return null;
}

async function getGlobalPluginDir(name: string): Promise<string> {
  const os = require('os');
  const homeDir = os.homedir();
  return path.join(homeDir, '.lokus', 'plugins', name);
}

async function getLocalPluginDir(name: string): Promise<string | null> {
  const cwd = process.cwd();
  
  // Try to find Lokus workspace root
  let currentDir = cwd;
  while (currentDir !== path.dirname(currentDir)) {
    const lokusConfig = path.join(currentDir, '.lokus');
    if (await fs.pathExists(lokusConfig)) {
      return path.join(currentDir, '.lokus', 'plugins', name);
    }
    currentDir = path.dirname(currentDir);
  }
  
  // Check current directory
  const localPluginDir = path.join(cwd, '.lokus', 'plugins', name);
  if (await fs.pathExists(localPluginDir)) {
    return localPluginDir;
  }
  
  return null;
}

async function readLocalPluginInfo(pluginDir: string, source: string): Promise<any> {
  const manifestPath = path.join(pluginDir, 'plugin.json');
  const installInfoPath = path.join(pluginDir, '.install-info.json');
  const buildInfoPath = path.join(pluginDir, '.build-info.json');

  const info: any = {
    source,
    location: pluginDir
  };

  // Read manifest
  if (await fs.pathExists(manifestPath)) {
    info.manifest = await fs.readJson(manifestPath);
  }

  // Read install info
  if (await fs.pathExists(installInfoPath)) {
    info.installation = await fs.readJson(installInfoPath);
  }

  // Read build info
  if (await fs.pathExists(buildInfoPath)) {
    info.build = await fs.readJson(buildInfoPath);
  }

  // Calculate directory size
  info.size = await FileUtils.calculateDirSize(pluginDir);

  // Check if main file exists
  if (info.manifest?.main) {
    const mainFile = path.join(pluginDir, info.manifest.main);
    info.hasMainFile = await fs.pathExists(mainFile);
  }

  return info;
}

async function getRegistryPluginInfo(registry: string, name: string, includeVersions: boolean): Promise<any> {
  try {
    const url = `${registry}/api/plugins/${name}`;
    const params = includeVersions ? { versions: 'all' } : {};
    
    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'lokus-plugin-cli'
      },
      timeout: 10000
    });

    return response.data;

  } catch (error: any) {
    if (error.response?.status === 404) {
      throw ErrorHandler.createError(
        'ValidationError',
        `Plugin ${name} not found in registry`
      );
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw ErrorHandler.createError(
        'NetworkError',
        `Cannot connect to registry: ${registry}`
      );
    }
    
    throw ErrorHandler.createError(
      'NetworkError',
      `Failed to fetch plugin info: ${error.message}`
    );
  }
}

function displayPluginInfo(combinedInfo: any, localInfo: any, registryInfo: any): void {
  const info = registryInfo || localInfo?.manifest || {};

  // Basic information
  logger.info(`${chalk.bold('Name:')} ${info.name}`);
  if (info.version) {
    logger.info(`${chalk.bold('Version:')} ${info.version}`);
  }
  if (info.description) {
    logger.info(`${chalk.bold('Description:')} ${info.description}`);
  }
  if (info.author) {
    logger.info(`${chalk.bold('Author:')} ${info.author}`);
  }
  if (info.license) {
    logger.info(`${chalk.bold('License:')} ${info.license}`);
  }

  logger.newLine();

  // Registry information
  if (registryInfo) {
    logger.info(chalk.bold.blue('Registry Information:'));
    
    if (registryInfo.publishedAt) {
      const date = new Date(registryInfo.publishedAt).toLocaleDateString();
      logger.info(`  Published: ${date}`);
    }
    
    if (registryInfo.downloads) {
      logger.info(`  Downloads: ${registryInfo.downloads.toLocaleString()}`);
    }
    
    if (registryInfo.size) {
      logger.info(`  Size: ${FileUtils.formatFileSize(registryInfo.size)}`);
    }

    if (registryInfo.versions && Array.isArray(registryInfo.versions)) {
      logger.info(`  Available versions: ${registryInfo.versions.length}`);
      if (registryInfo.versions.length <= 10) {
        logger.info(`    ${registryInfo.versions.join(', ')}`);
      } else {
        const recent = registryInfo.versions.slice(-5);
        logger.info(`    Latest: ${recent.join(', ')} (+${registryInfo.versions.length - 5} more)`);
      }
    }

    logger.newLine();
  }

  // Local installation
  if (localInfo) {
    logger.info(chalk.bold.green('Local Installation:'));
    logger.info(`  Status: ${localInfo.hasMainFile ? chalk.green('✓ Installed') : chalk.red('✗ Incomplete')}`);
    logger.info(`  Source: ${localInfo.source === 'global' ? 'Global' : 'Local'}`);
    logger.info(`  Location: ${chalk.gray(localInfo.location)}`);
    
    if (localInfo.size) {
      logger.info(`  Size: ${FileUtils.formatFileSize(localInfo.size)}`);
    }

    if (localInfo.installation?.installedAt) {
      const date = new Date(localInfo.installation.installedAt).toLocaleDateString();
      logger.info(`  Installed: ${date}`);
    }

    if (localInfo.build?.buildTime) {
      const date = new Date(localInfo.build.buildTime).toLocaleDateString();
      logger.info(`  Built: ${date}`);
    }

    logger.newLine();
  }

  // Plugin details
  if (info.keywords && info.keywords.length > 0) {
    logger.info(`${chalk.bold('Keywords:')} ${info.keywords.join(', ')}`);
  }

  if (info.categories && info.categories.length > 0) {
    logger.info(`${chalk.bold('Categories:')} ${info.categories.join(', ')}`);
  }

  if (info.permissions && info.permissions.length > 0) {
    logger.info(`${chalk.bold('Permissions:')} ${info.permissions.join(', ')}`);
  }

  if (info.engines) {
    logger.info(`${chalk.bold('Engine Requirements:')}`);
    Object.entries(info.engines).forEach(([engine, version]) => {
      logger.info(`  ${engine}: ${version}`);
    });
  }

  // Contributions
  if (info.contributes) {
    logger.newLine();
    logger.info(chalk.bold('Contributions:'));
    
    Object.entries(info.contributes).forEach(([key, value]: [string, any]) => {
      if (Array.isArray(value) && value.length > 0) {
        logger.info(`  ${key}: ${value.length} item(s)`);
      } else if (value && typeof value === 'object') {
        logger.info(`  ${key}: configured`);
      }
    });
  }

  // Links
  if (info.repository || info.homepage || info.bugs) {
    logger.newLine();
    logger.info(chalk.bold('Links:'));
    
    if (info.homepage) {
      logger.info(`  Homepage: ${chalk.cyan(info.homepage)}`);
    }
    
    if (info.repository) {
      const repo = typeof info.repository === 'string' ? info.repository : info.repository.url;
      logger.info(`  Repository: ${chalk.cyan(repo)}`);
    }
    
    if (info.bugs) {
      const bugs = typeof info.bugs === 'string' ? info.bugs : info.bugs.url;
      logger.info(`  Issues: ${chalk.cyan(bugs)}`);
    }
  }

  // Installation instructions
  if (!localInfo && registryInfo) {
    logger.newLine();
    logger.info(chalk.bold('Installation:'));
    logger.info(`  lokus-plugin install ${info.name}`);
  }
}