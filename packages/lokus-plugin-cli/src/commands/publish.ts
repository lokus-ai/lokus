import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import axios from 'axios';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';
import { FileUtils } from '../utils/file-utils';

export interface PublishOptions {
  registry?: string;
  token?: string;
  skipValidation?: boolean;
  dryRun?: boolean;
  tag?: string;
  access?: 'public' | 'private';
}

interface RegistryConfig {
  url: string;
  token?: string;
}

export const publishCommand = new Command('publish')
  .description('Publish plugin to registry')
  .option('-r, --registry <url>', 'registry URL', 'https://registry.lokus.dev')
  .option('-t, --token <token>', 'authentication token')
  .option('--skip-validation', 'skip plugin validation')
  .option('--dry-run', 'validate and prepare but do not publish')
  .option('--tag <tag>', 'publish with specific tag', 'latest')
  .option('--access <access>', 'package access level (public|private)', 'public')
  .action(async (options: PublishOptions) => {
    try {
      const pluginDir = process.cwd();
      
      // Validate plugin directory
      ErrorHandler.validatePluginDirectory(pluginDir);

      logger.header('🚀 Publishing Plugin');

      const manifestPath = path.join(pluginDir, 'plugin.json');
      const manifest = await pluginValidator.validateManifest(manifestPath);

      if (!options.skipValidation) {
        logger.info('Validating plugin...');
        await pluginValidator.validatePluginStructure(pluginDir);
        logger.success('Plugin validation passed');
      }

      // Get registry configuration
      const registryConfig = await getRegistryConfig(options);

      // Check if plugin already exists
      const existingVersion = await checkPluginExists(registryConfig, manifest.name, manifest.version);
      
      if (existingVersion) {
        throw ErrorHandler.createError(
          'ValidationError',
          `Plugin ${manifest.name}@${manifest.version} already exists in registry`
        );
      }

      // Prepare package data
      const packageData = await preparePackageData(pluginDir, manifest);

      if (options.dryRun) {
        logger.info('Dry run mode - would publish:');
        logger.json(packageData.metadata);
        logger.info(`Package size: ${FileUtils.formatFileSize(packageData.size)}`);
        logger.success('Dry run completed - package is ready for publishing');
        return;
      }

      // Confirm publication
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Publish ${chalk.cyan(manifest.name)}@${chalk.cyan(manifest.version)} to ${chalk.cyan(registryConfig.url)}?`,
        default: false
      }]);

      if (!confirm) {
        logger.info('Publication cancelled');
        return;
      }

      // Publish to registry
      logger.info('Publishing to registry...');
      const spinner = logger.startSpinner('Uploading package...');

      try {
        const publishResult = await publishToRegistry(registryConfig, packageData, options);
        
        spinner.succeed('Package published successfully');

        logger.newLine();
        logger.success(`${manifest.name}@${manifest.version} published to ${registryConfig.url}`);
        
        if (publishResult.url) {
          logger.info(`Package URL: ${chalk.cyan(publishResult.url)}`);
        }

        logger.newLine();
        logger.info('Installation:');
        logger.info(`  lokus-plugin install ${manifest.name}`);

      } catch (error) {
        spinner.fail('Publication failed');
        throw error;
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });

async function getRegistryConfig(options: PublishOptions): Promise<RegistryConfig> {
  const config: RegistryConfig = {
    url: options.registry || 'https://registry.lokus.dev'
  };

  // Get token from options, environment, or prompt
  if (options.token) {
    config.token = options.token;
  } else if (process.env.LOKUS_REGISTRY_TOKEN) {
    config.token = process.env.LOKUS_REGISTRY_TOKEN;
  } else {
    // Try to read from config file
    const configPath = path.join(require('os').homedir(), '.lokus', 'config.json');
    
    if (await fs.pathExists(configPath)) {
      try {
        const userConfig = await fs.readJson(configPath);
        config.token = userConfig.registryToken;
      } catch (error) {
        // Ignore config file errors
      }
    }

    // Prompt for token if not found
    if (!config.token) {
      const { token } = await inquirer.prompt([{
        type: 'password',
        name: 'token',
        message: 'Registry authentication token:',
        validate: (input: string) => input.trim() ? true : 'Token is required'
      }]);
      config.token = token;
    }
  }

  return config;
}

async function checkPluginExists(config: RegistryConfig, name: string, version: string): Promise<boolean> {
  try {
    const response = await axios.get(`${config.url}/api/plugins/${name}/${version}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'User-Agent': 'lokus-plugin-cli'
      },
      timeout: 10000
    });
    
    return response.status === 200;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return false; // Plugin doesn't exist
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw ErrorHandler.createError(
        'NetworkError',
        `Cannot connect to registry: ${config.url}`
      );
    }
    
    throw ErrorHandler.createError(
      'NetworkError',
      `Registry error: ${error.message}`
    );
  }
}

async function preparePackageData(pluginDir: string, manifest: any): Promise<{
  metadata: any;
  archive: Buffer;
  size: number;
}> {
  const buildDir = path.join(pluginDir, 'dist');
  
  // Ensure plugin is built
  if (!await fs.pathExists(buildDir)) {
    throw ErrorHandler.createError(
      'FileNotFoundError',
      'Plugin not built. Run "lokus-plugin build" first.'
    );
  }

  // Create temporary archive
  const tempDir = path.join(require('os').tmpdir(), `lokus-plugin-${Date.now()}`);
  const archivePath = path.join(tempDir, 'package.zip');
  
  await fs.ensureDir(tempDir);
  
  try {
    await FileUtils.createArchive(buildDir, archivePath, 'zip');
    
    const archive = await fs.readFile(archivePath);
    const size = archive.length;

    // Prepare metadata
    const packageJson = await fs.readJson(path.join(pluginDir, 'package.json'));
    
    const metadata = {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: packageJson.license || 'MIT',
      keywords: manifest.keywords || [],
      categories: manifest.categories || [],
      permissions: manifest.permissions || [],
      engines: manifest.engines,
      repository: packageJson.repository,
      bugs: packageJson.bugs,
      homepage: packageJson.homepage,
      main: manifest.main,
      contributes: manifest.contributes || {},
      publishedAt: new Date().toISOString(),
      size
    };

    return { metadata, archive, size };

  } finally {
    // Cleanup
    await fs.remove(tempDir);
  }
}

async function publishToRegistry(
  config: RegistryConfig, 
  packageData: any, 
  options: PublishOptions
): Promise<{ url?: string }> {
  const formData = new FormData();
  
  // Add metadata
  formData.append('metadata', JSON.stringify(packageData.metadata));
  
  // Add package file
  const blob = new Blob([packageData.archive], { type: 'application/zip' });
  formData.append('package', blob, 'package.zip');
  
  // Add publish options
  if (options.tag) {
    formData.append('tag', options.tag);
  }
  
  if (options.access) {
    formData.append('access', options.access);
  }

  try {
    const response = await axios.post(`${config.url}/api/plugins`, formData, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'User-Agent': 'lokus-plugin-cli',
        'Content-Type': 'multipart/form-data'
      },
      timeout: 60000, // 1 minute timeout for upload
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      maxBodyLength: 50 * 1024 * 1024
    });

    return response.data;

  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      switch (status) {
        case 401:
          throw ErrorHandler.createError(
            'PermissionError',
            'Authentication failed. Check your registry token.'
          );
        case 403:
          throw ErrorHandler.createError(
            'PermissionError',
            'Access denied. You may not have permission to publish this plugin.'
          );
        case 409:
          throw ErrorHandler.createError(
            'ValidationError',
            'Plugin version already exists in registry.'
          );
        case 413:
          throw ErrorHandler.createError(
            'ValidationError',
            'Package too large. Maximum size is 50MB.'
          );
        case 422:
          throw ErrorHandler.createError(
            'ValidationError',
            `Package validation failed: ${message}`
          );
        default:
          throw ErrorHandler.createError(
            'NetworkError',
            `Registry error (${status}): ${message}`
          );
      }
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw ErrorHandler.createError(
        'NetworkError',
        `Cannot connect to registry: ${config.url}`
      );
    }
    
    throw ErrorHandler.createError(
      'NetworkError',
      `Publication failed: ${error.message}`
    );
  }
}