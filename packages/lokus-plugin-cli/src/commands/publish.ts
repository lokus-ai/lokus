import FormData from 'form-data';
import archiver from 'archiver';
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
  .option('-r, --registry <url>', 'registry URL', process.env.LOKUS_REGISTRY_URL || 'https://lokusmd.com')
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
    url: options.registry || process.env.LOKUS_REGISTRY_URL || 'https://lokusmd.com'
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

// ... checkPluginExists ...

async function preparePackageData(pluginDir: string, manifest: any): Promise<{ metadata: any, archive: any, size: number, iconPath?: string }> {
  const zipPath = path.join(pluginDir, 'package.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  // Read README.md content if it exists
  const readmePath = path.join(pluginDir, 'README.md');
  let readmeContent = '';
  if (await fs.pathExists(readmePath)) {
    try {
      readmeContent = await fs.readFile(readmePath, 'utf-8');
      logger.info('Including README.md content');
    } catch (error) {
      logger.warning('Failed to read README.md');
    }
  }

  // Read CHANGELOG.md content if it exists
  const changelogPath = path.join(pluginDir, 'CHANGELOG.md');
  let changelogContent = '';
  if (await fs.pathExists(changelogPath)) {
    try {
      changelogContent = await fs.readFile(changelogPath, 'utf-8');
      logger.info('Including CHANGELOG.md content');
    } catch (error) {
      logger.warning('Failed to read CHANGELOG.md');
    }
  }

  // Check for icon file
  let iconPath: string | undefined;
  const iconExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  for (const ext of iconExtensions) {
    const possiblePath = path.join(pluginDir, `icon.${ext}`);
    if (await fs.pathExists(possiblePath)) {
      iconPath = possiblePath;
      logger.info(`Including icon: icon.${ext}`);
      break;
    }
  }

  // Enhance manifest with file contents
  const enhancedManifest = {
    ...manifest,
    readme: readmeContent || manifest.readme || '',
    changelog: changelogContent || manifest.changelog || '',
  };

  return new Promise((resolve, reject) => {
    output.on('close', async () => {
      const size = archive.pointer();
      const fileStream = fs.createReadStream(zipPath);
      resolve({
        metadata: enhancedManifest,
        archive: fileStream,
        size,
        iconPath
      });
    });

    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Add manifest
    archive.file(path.join(pluginDir, 'plugin.json'), { name: 'plugin.json' });

    // Add main file (usually dist/index.js)
    const mainFile = manifest.main || 'dist/index.js';
    if (fs.existsSync(path.join(pluginDir, mainFile))) {
      archive.file(path.join(pluginDir, mainFile), { name: mainFile });
    } else {
      logger.warning(`Main file ${mainFile} not found, skipping...`);
    }

    // Add README if exists
    if (fs.existsSync(path.join(pluginDir, 'README.md'))) {
      archive.file(path.join(pluginDir, 'README.md'), { name: 'README.md' });
    }

    // Add CHANGELOG if exists
    if (fs.existsSync(path.join(pluginDir, 'CHANGELOG.md'))) {
      archive.file(path.join(pluginDir, 'CHANGELOG.md'), { name: 'CHANGELOG.md' });
    }

    // Add LICENSE if exists
    if (fs.existsSync(path.join(pluginDir, 'LICENSE'))) {
      archive.file(path.join(pluginDir, 'LICENSE'), { name: 'LICENSE' });
    }

    // Add dist folder if it exists and main is inside it
    if (fs.existsSync(path.join(pluginDir, 'dist'))) {
      archive.directory(path.join(pluginDir, 'dist'), 'dist');
    }

    archive.finalize();
  });
}

async function publishToRegistry(
  config: RegistryConfig,
  packageData: { metadata: any, archive: any, size: number, iconPath?: string },
  options: PublishOptions
): Promise<{ url?: string }> {
  const formData = new FormData();

  // Add metadata as 'manifest' (Server expects 'manifest')
  formData.append('manifest', JSON.stringify(packageData.metadata));

  // Add package file as 'file' (Server expects 'file')
  formData.append('file', packageData.archive, {
    filename: 'package.zip',
    contentType: 'application/zip',
    knownLength: packageData.size
  });

  // Add icon file if available (Server expects 'icon')
  if (packageData.iconPath && await fs.pathExists(packageData.iconPath)) {
    const iconStream = fs.createReadStream(packageData.iconPath);
    const iconFilename = path.basename(packageData.iconPath);
    const iconExt = path.extname(packageData.iconPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    };
    formData.append('icon', iconStream, {
      filename: iconFilename,
      contentType: mimeTypes[iconExt] || 'image/png'
    });
  }

  // Add publish options
  if (options.tag) {
    formData.append('tag', options.tag);
  }

  if (options.access) {
    formData.append('access', options.access);
  }

  try {
    const response = await axios.post(`${config.url}/api/v1/registry/publish`, formData, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'User-Agent': 'lokus-plugin-cli',
        ...formData.getHeaders()
      },
      timeout: 60000, // 1 minute timeout for upload
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      maxBodyLength: 50 * 1024 * 1024
    });

    return response.data;

  } catch (error: any) {
    // ... existing error handling ...
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