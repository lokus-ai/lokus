import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';

export const linkCommand = new Command('link')
    .description('Link current plugin to local Lokus installation for development')
    .action(async () => {
        try {
            const pluginDir = process.cwd();

            // Validate plugin directory
            ErrorHandler.validatePluginDirectory(pluginDir);

            const manifestPath = path.join(pluginDir, 'plugin.json');
            const manifest = await pluginValidator.validateManifest(manifestPath);

            logger.header('🔗 Linking Plugin');

            // Determine extensions directory
            const homeDir = os.homedir();
            const extensionsDir = path.join(homeDir, '.lokus', 'extensions');
            const targetLinkPath = path.join(extensionsDir, manifest.id);

            // Ensure extensions directory exists
            await fs.ensureDir(extensionsDir);

            // Check if link already exists
            if (await fs.pathExists(targetLinkPath)) {
                const stats = await fs.lstat(targetLinkPath);
                if (stats.isSymbolicLink()) {
                    logger.info(`Removing existing link for ${chalk.cyan(manifest.id)}...`);
                    await fs.remove(targetLinkPath);
                } else {
                    throw ErrorHandler.createError(
                        'FileExistsError',
                        `Directory ${targetLinkPath} already exists and is not a link. Please remove it manually.`
                    );
                }
            }

            // Create symlink
            logger.info(`Linking ${chalk.cyan(pluginDir)} to ${chalk.cyan(targetLinkPath)}...`);
            await fs.ensureSymlink(pluginDir, targetLinkPath, 'dir');

            logger.success(`Plugin linked successfully!`);
            logger.info(`You can now run ${chalk.cyan('npm run watch')} to start developing.`);

        } catch (error) {
            ErrorHandler.handleError(error);
            process.exit(1);
        }
    });
