import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';
import { FileUtils } from '../utils/file-utils';
import { buildPlugin } from './build';

export interface PackageOptions {
  outDir?: string;
  format?: 'zip' | 'tar';
  includeDev?: boolean;
  skipBuild?: boolean;
  skipValidation?: boolean;
}

export const packageCommand = new Command('package')
  .description('Package plugin for distribution')
  .option('-o, --out-dir <dir>', 'output directory for package', '.')
  .option('-f, --format <format>', 'package format (zip|tar)', 'zip')
  .option('--include-dev', 'include development files')
  .option('--skip-build', 'skip build step')
  .option('--skip-validation', 'skip validation step')
  .action(async (options: PackageOptions) => {
    try {
      const pluginDir = process.cwd();
      
      // Validate plugin directory
      ErrorHandler.validatePluginDirectory(pluginDir);

      logger.header('📦 Packaging Plugin');

      const manifestPath = path.join(pluginDir, 'plugin.json');
      const manifest = await pluginValidator.validateManifest(manifestPath);

      // Build plugin if not skipped
      if (!options.skipBuild) {
        logger.info('Building plugin for production...');
        await buildPlugin(pluginDir, {
          target: 'production',
          minify: true,
          sourcemap: false
        });
        logger.success('Build completed');
      }

      const buildDir = path.join(pluginDir, 'dist');
      
      // Validate build output
      if (!options.skipValidation) {
        await pluginValidator.validateBuildOutput(buildDir);
      }

      // Create package directory
      const packageName = `${manifest.name}-${manifest.version}`;
      const packageDir = path.join(pluginDir, '.package', packageName);
      
      await fs.remove(path.dirname(packageDir));
      await fs.ensureDir(packageDir);

      logger.info('Preparing package contents...');

      // Copy built files
      await fs.copy(buildDir, packageDir, {
        filter: (src) => {
          const basename = path.basename(src);
          
          // Exclude development files
          if (!options.includeDev) {
            if (basename.startsWith('.') && basename !== '.') return false;
            if (basename.endsWith('.map')) return false;
            if (basename === '.build-info.json') return false;
          }
          
          return true;
        }
      });

      // Copy additional files
      const additionalFiles = [
        'README.md',
        'LICENSE',
        'LICENSE.txt',
        'CHANGELOG.md',
        'CHANGELOG.txt'
      ];

      for (const file of additionalFiles) {
        const filePath = path.join(pluginDir, file);
        if (await fs.pathExists(filePath)) {
          await fs.copy(filePath, path.join(packageDir, file));
        }
      }

      // Create package info
      const packageInfo = {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        packagedAt: new Date().toISOString(),
        packagedBy: '@lokus/plugin-cli',
        size: await FileUtils.calculateDirSize(packageDir)
      };

      await FileUtils.writeJsonFile(
        path.join(packageDir, '.package-info.json'),
        packageInfo
      );

      // Create archive
      const outputDir = path.resolve(pluginDir, options.outDir || '.');
      await fs.ensureDir(outputDir);
      
      const archiveName = `${packageName}.${options.format}`;
      const archivePath = path.join(outputDir, archiveName);

      // Remove existing archive
      if (await fs.pathExists(archivePath)) {
        await fs.remove(archivePath);
      }

      logger.info('Creating archive...');
      await FileUtils.createArchive(packageDir, archivePath, options.format);

      // Clean up temporary directory
      await fs.remove(path.dirname(packageDir));

      // Get final package size
      const packageSize = await FileUtils.getFileSize(archivePath);

      logger.newLine();
      logger.success('Plugin packaged successfully!');
      logger.info(`Package: ${chalk.cyan(archivePath)}`);
      logger.info(`Size: ${FileUtils.formatFileSize(packageSize)}`);
      logger.info(`Format: ${options.format?.toUpperCase()}`);

      // Show package contents summary
      logger.newLine();
      logger.info('Package contents:');
      logger.info(`  📁 Plugin files: ${chalk.cyan(manifest.name)}`);
      logger.info(`  📄 Manifest: plugin.json`);
      logger.info(`  🔧 Entry point: ${manifest.main || 'index.js'}`);
      
      if (manifest.permissions && manifest.permissions.length > 0) {
        logger.info(`  🔒 Permissions: ${manifest.permissions.join(', ')}`);
      }

      logger.newLine();
      logger.info('Next steps:');
      logger.info('  lokus-plugin publish    # Publish to registry');
      logger.info('  Manual installation:   # Share the .zip/.tar file');

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });