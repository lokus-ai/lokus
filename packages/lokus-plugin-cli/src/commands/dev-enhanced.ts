import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { buildPlugin } from './build';
import * as chokidar from 'chokidar';
import * as path from 'path';

export const devEnhancedCommand = new Command('dev')
  .description('Start development mode (watch and rebuild)')
  .option('-o, --out-dir <dir>', 'output directory', 'dist')
  .option('--no-sourcemap', 'disable source map generation')
  .action(async (options) => {
    try {
      const pluginDir = process.cwd();

      // Validate plugin directory
      ErrorHandler.validatePluginDirectory(pluginDir);

      logger.header('🚀 Starting Development Mode');
      logger.info(`Watching for changes in ${chalk.cyan(pluginDir)}...`);
      logger.info(`Tip: Run ${chalk.cyan('lokus-plugin link')} to link this plugin to Lokus App.`);
      logger.info(`🔥 Hot Reloading is active. Changes will automatically reload the plugin in Lokus.`);

      const buildOptions = {
        outDir: options.outDir || 'dist',
        target: 'development' as const,
        sourcemap: options.sourcemap !== false,
        watch: false // We handle watching manually to control output
      };

      // Initial build
      await doBuild(pluginDir, buildOptions);

      // Setup watcher
      const watcher = chokidar.watch(['src/**/*', 'plugin.json'], {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        cwd: pluginDir
      });

      watcher.on('change', (filePath) => {
        logger.info(`File changed: ${chalk.cyan(filePath)}`);
        doBuild(pluginDir, buildOptions);
      });

      watcher.on('add', (filePath) => {
        logger.info(`File added: ${chalk.cyan(filePath)}`);
        doBuild(pluginDir, buildOptions);
      });

      watcher.on('unlink', (filePath) => {
        logger.info(`File removed: ${chalk.cyan(filePath)}`);
        doBuild(pluginDir, buildOptions);
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        logger.info('\nStopping watch mode...');
        watcher.close();
        process.exit(0);
      });

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });

let isBuilding = false;

async function doBuild(pluginDir: string, options: any) {
  if (isBuilding) return;

  isBuilding = true;
  try {
    const spinner = logger.startSpinner('Building...');
    await buildPlugin(pluginDir, options);
    spinner.succeed(`Built successfully at ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    logger.stopSpinner(false, 'Build failed');
    // Don't exit on build error in watch mode
    if (error instanceof Error) {
      logger.error(error.message);
    }
  } finally {
    isBuilding = false;
  }
}