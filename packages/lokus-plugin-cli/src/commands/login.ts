import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import axios from 'axios';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

export const loginCommand = new Command('login')
    .description('Login to the Lokus Plugin Registry')
    .option('-r, --registry <url>', 'registry URL', process.env.LOKUS_REGISTRY_URL || 'https://lokusmd.com')
    .option('-t, --token <token>', 'authentication token')
    .action(async (options) => {
        try {
            logger.header('🔑 Login to Registry');

            const registryUrl = options.registry;
            let token = options.token;

            if (!token) {
                logger.info(`Logging in to ${chalk.cyan(registryUrl)}`);
                logger.info('You can generate a token at https://lokusmd.com/dashboard/settings/tokens');

                const answers = await inquirer.prompt([{
                    type: 'password',
                    name: 'token',
                    message: 'Paste your authentication token:',
                    validate: (input) => input.trim().length > 0 ? true : 'Token is required'
                }]);

                token = answers.token;
            }

            // Verify token
            const spinner = logger.startSpinner('Verifying token...');

            try {
                await axios.get(`${registryUrl}/api/v1/registry/check-auth`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'lokus-plugin-cli'
                    },
                    timeout: 10000
                });

                spinner.succeed('Token verified successfully');
            } catch (error) {
                spinner.fail('Token verification failed');
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 401) {
                        throw new Error('Invalid token');
                    }
                    throw new Error(`Network error: ${error.message}`);
                }
                throw error;
            }

            // Save token
            const configPath = path.join(require('os').homedir(), '.lokus', 'config.json');
            await fs.ensureDir(path.dirname(configPath));

            interface Config {
                registryToken?: string;
                registryUrl?: string;
                [key: string]: any;
            }

            let config: Config = {};
            if (await fs.pathExists(configPath)) {
                try {
                    config = await fs.readJson(configPath);
                } catch (e) {
                    // Ignore invalid config
                }
            }

            config.registryToken = token;
            config.registryUrl = registryUrl;

            await fs.writeJson(configPath, config, { spaces: 2 });

            logger.success('Successfully logged in!');
            logger.info(`Credentials saved to ${chalk.gray(configPath)}`);

        } catch (error) {
            ErrorHandler.handleError(error);
            process.exit(1);
        }
    });
