import chalk from 'chalk';
import { logger } from './logger';

export class ErrorHandler {
  static handleError(error: Error | unknown): void {
    if (error instanceof Error) {
      // Development mode - show stack trace
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
        logger.error(`${error.name}: ${error.message}`);
        if (error.stack) {
          console.error(chalk.gray(error.stack));
        }
        return;
      }

      // Production mode - show user-friendly messages
      switch (error.name) {
        case 'ValidationError':
          logger.error('Invalid configuration or input provided');
          logger.info('Please check your plugin manifest and try again');
          break;
        case 'FileNotFoundError':
          logger.error('Required file not found');
          logger.info('Make sure you\'re running this command from a plugin directory');
          break;
        case 'NetworkError':
          logger.error('Network connection failed');
          logger.info('Please check your internet connection and try again');
          break;
        case 'PermissionError':
          logger.error('Permission denied');
          logger.info('You may need to run this command with elevated privileges');
          break;
        default:
          logger.error(error.message || 'An unexpected error occurred');
          if (error.message.includes('ENOENT')) {
            logger.info('File or directory not found. Check the path and try again.');
          } else if (error.message.includes('EACCES')) {
            logger.info('Permission denied. You may need elevated privileges.');
          } else if (error.message.includes('ENOTDIR')) {
            logger.info('Path is not a directory. Check the path and try again.');
          }
          break;
      }
    } else {
      logger.error('An unknown error occurred');
      if (process.env.NODE_ENV === 'development') {
        console.error(error);
      }
    }

    logger.newLine();
    logger.info('If this problem persists, please report it at:');
    logger.info(chalk.cyan('https://github.com/lokus/lokus/issues'));
  }

  static createError(name: string, message: string): Error {
    const error = new Error(message);
    error.name = name;
    return error;
  }

  static validatePluginDirectory(cwd: string): void {
    const fs = require('fs');
    const path = require('path');

    const manifestPath = path.join(cwd, 'plugin.json');
    const packagePath = path.join(cwd, 'package.json');

    if (!fs.existsSync(manifestPath) && !fs.existsSync(packagePath)) {
      throw this.createError(
        'FileNotFoundError',
        'Not a plugin directory. Missing plugin.json or package.json file.'
      );
    }
  }

  static async validateNodeEnvironment(): Promise<void> {
    const { engines } = require('../../package.json');
    const semver = require('semver');

    // Check Node.js version
    if (engines.node && !semver.satisfies(process.version, engines.node)) {
      throw this.createError(
        'ValidationError',
        `Node.js version ${process.version} is not supported. Required: ${engines.node}`
      );
    }

    // Check npm version
    try {
      const { execSync } = require('child_process');
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      if (engines.npm && !semver.satisfies(npmVersion, engines.npm)) {
        logger.warning(`npm version ${npmVersion} may not be fully supported. Recommended: ${engines.npm}`);
      }
    } catch (error) {
      logger.warning('Could not determine npm version');
    }
  }
}