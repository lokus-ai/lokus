import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import axios from 'axios';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { FileUtils } from '../utils/file-utils';

export interface InstallOptions {
  registry?: string;
  version?: string;
  global?: boolean;
  force?: boolean;
  dev?: boolean;
}

export const installCommand = new Command('install')
  .description('Install a plugin from registry')
  .argument('<name>', 'plugin name to install')
  .option('-r, --registry <url>', 'registry URL', 'https://registry.lokus.dev')
  .option('-v, --version <version>', 'specific version to install', 'latest')
  .option('-g, --global', 'install globally')
  .option('-f, --force', 'force reinstall if already exists')
  .option('--dev', 'install as development dependency')
  .action(async (name: string, options: InstallOptions) => {
    try {
      logger.header('📥 Installing Plugin');

      const pluginsDir = await getPluginsDirectory(options.global || false);
      const pluginInstallDir = path.join(pluginsDir, name);

      // Check if plugin already exists
      if (await fs.pathExists(pluginInstallDir) && !options.force) {
        logger.warning(`Plugin ${name} is already installed`);
        logger.info('Use --force to reinstall');
        return;
      }

      // Fetch plugin metadata
      logger.info(`Fetching plugin information: ${chalk.cyan(name)}`);
      const pluginInfo = await fetchPluginInfo(options.registry!, name, options.version);

      logger.info(`Found: ${chalk.cyan(pluginInfo.name)}@${chalk.cyan(pluginInfo.version)}`);
      logger.info(`Description: ${pluginInfo.description}`);
      logger.info(`Size: ${FileUtils.formatFileSize(pluginInfo.size)}`);

      // Download plugin package
      const spinner = logger.startSpinner('Downloading plugin package...');
      
      try {
        const packageBuffer = await downloadPlugin(options.registry!, name, pluginInfo.version);
        spinner.succeed('Package downloaded');

        // Extract and install
        logger.info('Installing plugin...');
        await installPlugin(packageBuffer, pluginInstallDir, pluginInfo);

        logger.success(`Plugin ${chalk.cyan(name)}@${chalk.cyan(pluginInfo.version)} installed successfully`);
        
        // Show installation info
        logger.newLine();
        logger.info('Installation details:');
        logger.info(`  Location: ${chalk.cyan(pluginInstallDir)}`);
        logger.info(`  Version: ${pluginInfo.version}`);
        logger.info(`  Permissions: ${pluginInfo.permissions?.join(', ') || 'none'}`);

        if (pluginInfo.contributes) {
          logger.info('  Contributes:');
          Object.entries(pluginInfo.contributes).forEach(([key, value]: [string, any]) => {
            if (Array.isArray(value) && value.length > 0) {
              logger.info(`    ${key}: ${value.length} item(s)`);
            }
          });
        }

      } catch (error) {
        spinner.fail('Installation failed');
        throw error;
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });

async function getPluginsDirectory(global: boolean): Promise<string> {
  if (global) {
    // Global installation directory
    const os = require('os');
    const homeDir = os.homedir();
    return path.join(homeDir, '.lokus', 'plugins');
  } else {
    // Local installation directory
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
    
    // Fallback to current directory
    return path.join(cwd, '.lokus', 'plugins');
  }
}

async function fetchPluginInfo(registry: string, name: string, version?: string): Promise<any> {
  try {
    const versionParam = version && version !== 'latest' ? `/${version}` : '';
    const url = `${registry}/api/plugins/${name}${versionParam}`;
    
    const response = await axios.get(url, {
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

async function downloadPlugin(registry: string, name: string, version: string): Promise<Buffer> {
  try {
    const url = `${registry}/api/plugins/${name}/${version}/download`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'lokus-plugin-cli'
      },
      timeout: 60000, // 1 minute timeout
      maxContentLength: 50 * 1024 * 1024 // 50MB max
    });

    return Buffer.from(response.data);

  } catch (error: any) {
    if (error.response?.status === 404) {
      throw ErrorHandler.createError(
        'ValidationError',
        `Plugin package not found: ${name}@${version}`
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
      `Failed to download plugin: ${error.message}`
    );
  }
}

async function installPlugin(packageBuffer: Buffer, installDir: string, pluginInfo: any): Promise<void> {
  // Create temporary extraction directory
  const tempDir = path.join(require('os').tmpdir(), `lokus-plugin-${Date.now()}`);
  const tempArchive = path.join(tempDir, 'package.zip');
  
  try {
    await fs.ensureDir(tempDir);
    await fs.writeFile(tempArchive, packageBuffer);

    // Extract package
    await FileUtils.extractArchive(tempArchive, tempDir);

    // Remove existing installation
    if (await fs.pathExists(installDir)) {
      await fs.remove(installDir);
    }

    // Move to final location
    await fs.ensureDir(path.dirname(installDir));
    await fs.move(tempDir, installDir);

    // Create installation metadata
    const installInfo = {
      name: pluginInfo.name,
      version: pluginInfo.version,
      installedAt: new Date().toISOString(),
      installedBy: 'lokus-plugin-cli',
      source: 'registry'
    };

    await FileUtils.writeJsonFile(
      path.join(installDir, '.install-info.json'),
      installInfo
    );

  } finally {
    // Cleanup
    try {
      await fs.remove(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}