import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

export interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  testPattern?: string;
  updateSnapshots?: boolean;
  bail?: boolean;
  maxWorkers?: number;
}

export const testCommand = new Command('test')
  .description('Run plugin tests')
  .option('-w, --watch', 'watch files for changes and rerun tests')
  .option('-c, --coverage', 'collect and report test coverage')
  .option('-v, --verbose', 'display individual test results')
  .option('-t, --test-pattern <pattern>', 'run tests matching pattern')
  .option('-u, --update-snapshots', 'update snapshots')
  .option('--bail', 'stop after first test failure')
  .option('--max-workers <number>', 'maximum number of workers', '4')
  .action(async (options: TestOptions) => {
    try {
      const pluginDir = process.cwd();
      
      // Validate plugin directory
      ErrorHandler.validatePluginDirectory(pluginDir);

      logger.header('🧪 Running Tests');

      const packageJsonPath = path.join(pluginDir, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);

      // Check if Jest is configured
      const hasJest = packageJson.devDependencies?.jest || 
                     packageJson.dependencies?.jest ||
                     await fs.pathExists(path.join(pluginDir, 'jest.config.js')) ||
                     await fs.pathExists(path.join(pluginDir, 'jest.config.json'));

      if (!hasJest) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Jest is not configured. Please install Jest and configure it in your package.json or jest.config.js'
        );
      }

      // Build Jest command
      const jestArgs = ['jest'];

      if (options.watch) {
        jestArgs.push('--watch');
      }

      if (options.coverage) {
        jestArgs.push('--coverage');
      }

      if (options.verbose) {
        jestArgs.push('--verbose');
      }

      if (options.testPattern) {
        jestArgs.push('--testNamePattern', options.testPattern);
      }

      if (options.updateSnapshots) {
        jestArgs.push('--updateSnapshot');
      }

      if (options.bail) {
        jestArgs.push('--bail');
      }

      if (options.maxWorkers) {
        const maxWorkers = parseInt(options.maxWorkers.toString(), 10);
        if (!isNaN(maxWorkers) && maxWorkers > 0) {
          jestArgs.push('--maxWorkers', maxWorkers.toString());
        }
      }

      // Add color output
      jestArgs.push('--colors');

      // Check for test files
      const testDirs = ['test', 'tests', '__tests__', 'src'];
      let hasTestFiles = false;

      for (const testDir of testDirs) {
        const testDirPath = path.join(pluginDir, testDir);
        if (await fs.pathExists(testDirPath)) {
          const { glob } = require('glob');
          const testFiles = await glob('**/*.{test,spec}.{js,ts,jsx,tsx}', {
            cwd: testDirPath
          });
          if (testFiles.length > 0) {
            hasTestFiles = true;
            break;
          }
        }
      }

      if (!hasTestFiles) {
        logger.warning('No test files found');
        logger.info('Create test files with .test.js, .test.ts, .spec.js, or .spec.ts extensions');
        return;
      }

      logger.info(`Running: ${chalk.cyan(jestArgs.join(' '))}`);
      logger.newLine();

      try {
        execSync(jestArgs.join(' '), {
          cwd: pluginDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            NODE_ENV: 'test',
            CI: 'true' // Ensure consistent behavior
          }
        });

        if (!options.watch) {
          logger.newLine();
          logger.success('All tests passed!');
        }

      } catch (error: any) {
        if (error.status !== undefined) {
          // Jest exited with non-zero code
          logger.newLine();
          logger.error('Some tests failed');
          process.exit(error.status);
        } else {
          throw error;
        }
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });